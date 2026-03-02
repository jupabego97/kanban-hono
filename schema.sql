-- ============================================================
-- KANBAN COMPRAS & FALTANTES — Schema PostgreSQL
-- Compatible con Railway PostgreSQL plugin
-- ============================================================

-- Limpieza (útil para re-runs en dev)
DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS productos_catalogo CASCADE;
DROP TABLE IF EXISTS proveedores CASCADE;
DROP TYPE IF EXISTS tipo_solicitud CASCADE;

-- ============================================================
-- ENUM
-- ============================================================
CREATE TYPE tipo_solicitud AS ENUM ('Agotado', 'Nuevo');

-- ============================================================
-- TABLA: proveedores
-- ============================================================
CREATE TABLE proveedores (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  dias_entrega  INTEGER NOT NULL DEFAULT 3,
  telefono      TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLA: productos_catalogo
-- Para autocompletado rápido en el formulario de mostrador
-- ============================================================
CREATE TABLE productos_catalogo (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  proveedor_id  INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
  activo        BOOLEAN NOT NULL DEFAULT true,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_productos_nombre ON productos_catalogo USING GIN (to_tsvector('spanish', nombre));
CREATE INDEX idx_productos_proveedor ON productos_catalogo(proveedor_id);

-- ============================================================
-- TABLA: solicitudes (tabla central del kanban)
-- ============================================================
CREATE TABLE solicitudes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_nombre   TEXT        NOT NULL,
  tipo              tipo_solicitud NOT NULL DEFAULT 'Agotado',
  proveedor_id      INTEGER     REFERENCES proveedores(id) ON DELETE SET NULL,
  cantidad_pedida   INTEGER     NOT NULL DEFAULT 1 CHECK (cantidad_pedida > 0),
  estado            TEXT        NOT NULL DEFAULT 'solicitudes'
                                CHECK (estado IN ('solicitudes','analisis','por_pedir','en_camino','recibido')),
  contacto_cliente  TEXT,
  notas             TEXT,
  precio_estimado   NUMERIC(10,2),
  orden_columna     INTEGER     NOT NULL DEFAULT 0,  -- para ordenar tarjetas dentro de la columna
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de acceso frecuente
CREATE INDEX idx_solicitudes_estado        ON solicitudes(estado);
CREATE INDEX idx_solicitudes_proveedor_id  ON solicitudes(proveedor_id);
CREATE INDEX idx_solicitudes_creado_en     ON solicitudes(creado_en DESC);
CREATE INDEX idx_solicitudes_tipo          ON solicitudes(tipo);

-- Trigger: actualiza automáticamente actualizado_en
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitudes_actualizado
  BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- ============================================================
-- DATOS DE PRUEBA: proveedores
-- ============================================================
INSERT INTO proveedores (nombre, dias_entrega, telefono) VALUES
  ('Distribuidora El Rayo',    2,  '3001234567'),
  ('Importaciones Orión',      5,  '3117890123'),
  ('Ferretería Central',       1,  '3204567890'),
  ('Papelería Mundo Nuevo',    3,  '3158901234'),
  ('Electrónica del Norte',    7,  '3009876543'),
  ('Suministros La Torre',     4,  '3123456789'),
  ('Confecciones Vargas Hnos', 6,  NULL);

-- ============================================================
-- DATOS DE PRUEBA: productos_catalogo
-- ============================================================
INSERT INTO productos_catalogo (nombre, proveedor_id) VALUES
  -- Ferretería Central (id=3)
  ('Tornillos 1/2" x 1" (caja x100)',  3),
  ('Alambre calibre 12 (rollo 100m)',  3),
  ('Pintura anticorrosiva gris 1/4',   3),
  ('Lija grano 120 (pliego)',          3),
  ('Sellador de silicona transparente',3),

  -- Distribuidora El Rayo (id=1)
  ('Aceite de motor 10W-40 (litro)',   1),
  ('Filtro de aire universal',         1),
  ('Bujía NGK BP6ES',                  1),
  ('Frenos de disco trasero',          1),
  ('Liquido de frenos DOT 4',          1),

  -- Papelería Mundo Nuevo (id=4)
  ('Resma papel carta 75g',            4),
  ('Esfero azul Kilométrico x12',      4),
  ('Carpeta con gancho legajadora',    4),
  ('Marcador permanente negro x5',     4),
  ('Post-it 3x3 (bloque x100)',        4),

  -- Electrónica del Norte (id=5)
  ('Cable USB-C 2m',                   5),
  ('Regleta eléctrica 6 puestos',      5),
  ('Cargador 65W GaN tipo C',          5),
  ('Mouse inalámbrico básico',         5),
  ('Memoria USB 32GB 3.0',             5),

  -- Importaciones Orión (id=2)
  ('Camiseta deportiva talla M',       2),
  ('Maleta escolar 20L',               2),
  ('Zapato industrial punta acero T42',2),

  -- Suministros La Torre (id=6)
  ('Guante de látex talla M (par)',    6),
  ('Tapabocas desechable x50',         6),
  ('Alcohol antiséptico 500ml',        6),
  ('Jabón antibacterial litro',        6);

-- ============================================================
-- DATOS DE PRUEBA: solicitudes
-- ============================================================
INSERT INTO solicitudes
  (producto_nombre, tipo, proveedor_id, cantidad_pedida, estado, contacto_cliente, notas, precio_estimado, orden_columna)
VALUES
  -- Columna: solicitudes (recién registradas en mostrador)
  ('Cable USB-C 2m',                 'Agotado', 5, 3,  'solicitudes', '3001112233', NULL,               15000.00, 0),
  ('Guante de látex talla M (par)',  'Agotado', 6, 10, 'solicitudes', NULL,          'Urgente para obra', 8500.00, 1),
  ('Camiseta deportiva talla M',     'Nuevo',   2, 5,  'solicitudes', '3154445566', NULL,               25000.00, 2),
  ('Sellador de silicona transparente','Agotado',3,2,  'solicitudes', NULL,          NULL,               12000.00, 3),

  -- Columna: analisis (en cotización / revisión)
  ('Regleta eléctrica 6 puestos',    'Agotado', 5, 4,  'analisis',   '3207778899', 'Verificar voltaje', 35000.00, 0),
  ('Filtro de aire universal',       'Agotado', 1, 2,  'analisis',   NULL,          NULL,               28000.00, 1),
  ('Resma papel carta 75g',          'Agotado', 4, 20, 'analisis',   '3119990011', NULL,               11000.00, 2),

  -- Columna: por_pedir (lista de compras aprobada)
  ('Tornillos 1/2" x 1" (caja x100)','Agotado', 3, 5, 'por_pedir',  NULL,          NULL,                9500.00, 0),
  ('Bujía NGK BP6ES',                'Agotado', 1, 8,  'por_pedir',  '3001234000', NULL,               14000.00, 1),
  ('Tapabocas desechable x50',       'Agotado', 6, 3,  'por_pedir',  NULL,          'Marca Protex',      7200.00, 2),
  ('Zapato industrial punta acero T42','Nuevo', 2, 2,  'por_pedir',  '3223334455', 'Talla 42',         95000.00, 3),

  -- Columna: en_camino (pedido hecho, esperando entrega)
  ('Aceite de motor 10W-40 (litro)', 'Agotado', 1, 12, 'en_camino',  NULL,          'Pedido #2891',     18500.00, 0),
  ('Memoria USB 32GB 3.0',           'Agotado', 5, 6,  'en_camino',  '3016667788', NULL,               22000.00, 1),
  ('Alcohol antiséptico 500ml',      'Agotado', 6, 8,  'en_camino',  NULL,          NULL,                9800.00, 2),

  -- Columna: recibido (completados, avisar cliente)
  ('Mouse inalámbrico básico',       'Agotado', 5, 2,  'recibido',   '3221112222', NULL,               45000.00, 0),
  ('Pintura anticorrosiva gris 1/4', 'Agotado', 3, 3,  'recibido',   NULL,          NULL,               38000.00, 1),
  ('Esfero azul Kilométrico x12',    'Agotado', 4, 5,  'recibido',   '3178889900', NULL,                4500.00, 2);

-- ============================================================
-- VISTAS ÚTILES (opcional, para queries de debug)
-- ============================================================
CREATE OR REPLACE VIEW v_solicitudes_completas AS
SELECT
  s.id,
  s.producto_nombre,
  s.tipo,
  s.cantidad_pedida,
  s.estado,
  s.contacto_cliente,
  s.notas,
  s.precio_estimado,
  s.orden_columna,
  s.creado_en,
  s.actualizado_en,
  p.nombre      AS proveedor_nombre,
  p.dias_entrega,
  p.telefono    AS proveedor_telefono
FROM solicitudes s
LEFT JOIN proveedores p ON s.proveedor_id = p.id
ORDER BY s.estado, s.orden_columna, s.creado_en DESC;

-- ============================================================
-- VERIFICACIÓN RÁPIDA
-- ============================================================
SELECT
  estado,
  COUNT(*) AS total,
  SUM(cantidad_pedida) AS unidades_totales
FROM solicitudes
GROUP BY estado
ORDER BY CASE estado
  WHEN 'solicitudes' THEN 1
  WHEN 'analisis'    THEN 2
  WHEN 'por_pedir'   THEN 3
  WHEN 'en_camino'   THEN 4
  WHEN 'recibido'    THEN 5
END;
