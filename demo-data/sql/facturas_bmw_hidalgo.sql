-- Datos demostrativos para RAG.AI: distribuidor BMW en Hidalgo, Mexico.
CREATE TABLE IF NOT EXISTS facturas_bmw_hidalgo (
  id_factura VARCHAR(20) PRIMARY KEY, fecha_emision DATE NOT NULL,
  cliente VARCHAR(120) NOT NULL, rfc_cliente VARCHAR(13) NOT NULL,
  modelo VARCHAR(80) NOT NULL, anio_modelo SMALLINT NOT NULL,
  subtotal_mxn NUMERIC(12,2) NOT NULL, iva_mxn NUMERIC(12,2) NOT NULL,
  total_mxn NUMERIC(12,2) NOT NULL, metodo_pago VARCHAR(30) NOT NULL,
  estatus VARCHAR(20) NOT NULL
);
INSERT INTO facturas_bmw_hidalgo VALUES
('FAC-HGO-0001','2026-01-15','Laura Martinez Ortega','MART800512AB1','BMW X3 xDrive30i',2026,1120689.66,179310.34,1300000.00,'Transferencia','Pagada'),
('FAC-HGO-0002','2026-02-03','Transportes del Valle S.A. de C.V.','TVA190625KQ2','BMW 320i Sedan',2026,732758.62,117241.38,850000.00,'Credito 30 dias','Pagada'),
('FAC-HGO-0003','2026-03-11','Carlos Eduardo Ramirez Soto','RASC850921LJ4','BMW X1 sDrive20i',2026,612068.97,97931.03,710000.00,'Tarjeta','Pendiente');
