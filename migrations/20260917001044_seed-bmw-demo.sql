ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS part_number TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS compatible_models TEXT,
  ADD COLUMN IF NOT EXISTS minimum_stock INTEGER,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS supplier TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS customer TEXT,
  ADD COLUMN IF NOT EXISTS customer_tax_id TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS model_year INTEGER,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS tax NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS products_part_number_unique
  ON public.products (part_number) WHERE part_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_external_id_unique
  ON public.invoices (external_id) WHERE external_id IS NOT NULL;

INSERT INTO public.products
  (name, description, price, stock, part_number, category, compatible_models,
   minimum_stock, location, supplier, metadata)
SELECT 'Filtro de aceite original BMW',
       'Filtro de aceite original BMW para motores B48. Compatible con BMW X1, X3 y 320i.',
       486.00, 24, 'BMW-11428583898', 'Mantenimiento',
       'BMW X1, X3, 320i (motores B48)', 8, 'Estante A-01',
       'BMW Group Refacciones Mexico', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE part_number = 'BMW-11428583898');

INSERT INTO public.products
  (name, description, price, stock, part_number, category, compatible_models,
   minimum_stock, location, supplier, metadata)
SELECT 'Juego de balatas delanteras',
       'Juego de balatas delanteras para BMW X3 G01 y X4 G02.',
       4280.00, 9, 'BMW-34116878881', 'Frenos',
       'BMW X3 G01 y X4 G02', 4, 'Estante B-03',
       'BMW Group Refacciones Mexico', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE part_number = 'BMW-34116878881');

INSERT INTO public.products
  (name, description, price, stock, part_number, category, compatible_models,
   minimum_stock, location, supplier, metadata)
SELECT 'Lampara LED derecha',
       'Lampara LED derecha para BMW X1 U11.',
       12650.00, 3, 'BMW-63117263051', 'Carroceria e iluminacion',
       'BMW X1 U11', 2, 'Estante C-02',
       'BMW Group Refacciones Mexico', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE part_number = 'BMW-63117263051');

INSERT INTO public.products
  (name, description, price, stock, part_number, category, compatible_models,
   minimum_stock, location, supplier, metadata)
SELECT 'Rin de aleacion 19 pulgadas',
       'Rin de aleacion de 19 pulgadas para BMW X3 G01.',
       18900.00, 6, 'BMW-36116856044', 'Ruedas',
       'BMW X3 G01', 2, 'Patio techado P-01',
       'BMW Group Refacciones Mexico', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE part_number = 'BMW-36116856044');

INSERT INTO public.products
  (name, description, price, stock, part_number, category, compatible_models,
   minimum_stock, location, supplier, metadata)
SELECT 'Filtro de aire de motor',
       'Filtro de aire de motor para BMW 320i, 330i y X3.',
       1250.00, 18, 'BMW-13718601683', 'Mantenimiento',
       'BMW 320i, 330i y X3', 6, 'Estante A-02',
       'BMW Group Refacciones Mexico', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE part_number = 'BMW-13718601683');

INSERT INTO public.invoices
  (external_id, issue_date, customer, customer_tax_id, vehicle_model, model_year,
   subtotal, tax, total, payment_method, status, metadata)
SELECT 'FAC-HGO-0001', '2026-01-15', 'Laura Martinez Ortega', 'MART800512AB1',
       'BMW X3 xDrive30i', 2026, 1120689.66, 179310.34, 1300000.00,
       'Transferencia', 'Pagada', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.invoices WHERE external_id = 'FAC-HGO-0001');

INSERT INTO public.invoices
  (external_id, issue_date, customer, customer_tax_id, vehicle_model, model_year,
   subtotal, tax, total, payment_method, status, metadata)
SELECT 'FAC-HGO-0002', '2026-02-03', 'Transportes del Valle S.A. de C.V.', 'TVA190625KQ2',
       'BMW 320i Sedan', 2026, 732758.62, 117241.38, 850000.00,
       'Credito 30 dias', 'Pagada', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.invoices WHERE external_id = 'FAC-HGO-0002');

INSERT INTO public.invoices
  (external_id, issue_date, customer, customer_tax_id, vehicle_model, model_year,
   subtotal, tax, total, payment_method, status, metadata)
SELECT 'FAC-HGO-0003', '2026-03-11', 'Carlos Eduardo Ramirez Soto', 'RASC850921LJ4',
       'BMW X1 sDrive20i', 2026, 612068.97, 97931.03, 710000.00,
       'Tarjeta', 'Pendiente', '{"demo": true, "currency": "MXN"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.invoices WHERE external_id = 'FAC-HGO-0003');
