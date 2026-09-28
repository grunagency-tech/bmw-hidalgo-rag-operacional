-- Inventario demostrativo para RAG.AI: refacciones BMW en Hidalgo, Mexico.
CREATE TABLE IF NOT EXISTS piezas_bmw_hidalgo (
  numero_parte VARCHAR(30) PRIMARY KEY, descripcion VARCHAR(160) NOT NULL,
  categoria VARCHAR(60) NOT NULL, modelos_compatibles VARCHAR(160) NOT NULL,
  existencia SMALLINT NOT NULL, stock_minimo SMALLINT NOT NULL,
  precio_unitario_mxn NUMERIC(10,2) NOT NULL, ubicacion VARCHAR(30) NOT NULL,
  proveedor VARCHAR(100) NOT NULL
);
INSERT INTO piezas_bmw_hidalgo VALUES
('BMW-11428583898','Filtro de aceite original BMW','Mantenimiento','BMW X1, X3, 320i (motores B48)',24,8,486.00,'Estante A-01','BMW Group Refacciones Mexico'),
('BMW-34116878881','Juego de balatas delanteras','Frenos','BMW X3 G01 y X4 G02',9,4,4280.00,'Estante B-03','BMW Group Refacciones Mexico'),
('BMW-63117263051','Lampara LED derecha','Carroceria e iluminacion','BMW X1 U11',3,2,12650.00,'Estante C-02','BMW Group Refacciones Mexico'),
('BMW-36116856044','Rin de aleacion 19 pulgadas','Ruedas','BMW X3 G01',6,2,18900.00,'Patio techado P-01','BMW Group Refacciones Mexico'),
('BMW-13718601683','Filtro de aire de motor','Mantenimiento','BMW 320i, 330i y X3',18,6,1250.00,'Estante A-02','BMW Group Refacciones Mexico');
