-- Dynamic catalog used by the ask edge function.  It intentionally exposes
-- only application tables/columns that are safe to query in a response.
CREATE OR REPLACE FUNCTION public.get_queryable_schema()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH safe_columns AS (
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.ordinal_position
    FROM information_schema.columns AS c
    JOIN information_schema.tables AS t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      -- Documents are retrieved by vector similarity, never as arbitrary SQL.
      AND c.table_name <> 'documents'
      AND c.column_name !~* '(password|token|secret|api_?key|private_?key|embedding)'
  ),
  foreign_keys AS (
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
  ),
  table_catalog AS (
    SELECT
      sc.table_name,
      jsonb_agg(
        jsonb_build_object(
          'name', sc.column_name,
          'type', sc.data_type,
          'nullable', sc.is_nullable = 'YES'
        )
        ORDER BY sc.ordinal_position
      ) AS columns,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'column', fk.column_name,
            'foreign_table', fk.foreign_table,
            'foreign_column', fk.foreign_column
          )
          ORDER BY fk.column_name
        )
        FROM foreign_keys AS fk
        WHERE fk.table_name = sc.table_name
      ), '[]'::jsonb) AS relations
    FROM safe_columns AS sc
    GROUP BY sc.table_name
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', table_name,
        'columns', columns,
        'relations', relations
      )
      ORDER BY table_name
    ),
    '[]'::jsonb
  )
  FROM table_catalog;
$$;

-- The edge function validates columns against the catalog.  This second
-- barrier prevents the database RPC from executing non-SELECT statements or
-- reading relations outside public application tables if the function is ever
-- called directly.
CREATE OR REPLACE FUNCTION public.run_safe_readonly_query(sql_query text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  statement text := btrim(sql_query);
  relation_match text[];
  relation_name text;
BEGIN
  IF statement !~* '^select\s' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed';
  END IF;

  IF statement ~ ';|--|/\*|\*/' OR statement ~* '\m(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|call|copy|vacuum|analyze|set|show|lock|execute|prepare|deallocate|do)\M' THEN
    RAISE EXCEPTION 'Unsafe SQL statement';
  END IF;

  IF statement ~* '^select\s+(distinct\s+)?\*' THEN
    RAISE EXCEPTION 'SELECT * is not allowed';
  END IF;

  FOR relation_match IN
    SELECT regexp_matches(statement, '\m(?:from|join)[[:space:]]+((?:public\.)?[a-z_][a-z0-9_]*)', 'gi')
  LOOP
    relation_name := regexp_replace(relation_match[1], '^public\.', '', 'i');
    IF relation_name = 'documents' OR NOT EXISTS (
      SELECT 1
      FROM information_schema.tables AS t
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name = relation_name
    ) THEN
      RAISE EXCEPTION 'Relation % is not queryable', relation_name;
    END IF;
  END LOOP;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A queryable public table is required';
  END IF;

  -- Enforce the cap even if a candidate provided another LIMIT.
  statement := regexp_replace(statement, '\s+limit\s+[0-9]+\s*$', '', 'i');
  statement := statement || ' LIMIT 50';
  RETURN QUERY EXECUTE format('SELECT to_jsonb(q) FROM (%s) AS q', statement);
END;
$$;
