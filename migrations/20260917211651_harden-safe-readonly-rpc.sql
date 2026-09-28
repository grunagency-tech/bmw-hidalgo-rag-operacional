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

  IF statement ~ ';|--|/\*|\*/'
     OR statement ~* '\m(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|call|copy|vacuum|analyze|set|show|lock|execute|prepare|deallocate|do)\M'
     OR statement ~* '\m(password|token|secret|api_?key|private_?key|embedding)\w*\M' THEN
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
      SELECT 1 FROM information_schema.tables AS t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND t.table_name = relation_name
    ) THEN
      RAISE EXCEPTION 'Relation % is not queryable', relation_name;
    END IF;
  END LOOP;

  IF NOT FOUND THEN RAISE EXCEPTION 'A queryable public table is required'; END IF;
  statement := regexp_replace(statement, '\s+limit\s+[0-9]+\s*$', '', 'i') || ' LIMIT 50';
  RETURN QUERY EXECUTE format('SELECT to_jsonb(q) FROM (%s) AS q', statement);
END;
$$;
