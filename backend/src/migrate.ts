import sql from './db.ts'

// ============================================================
// migrate.ts — Crea tablas e índices si no existen.
// Se ejecuta en cada arranque del servidor (idempotente).
// ============================================================

export async function runMigrations() {
  console.log('[DB] Ejecutando migraciones...')

  await sql.begin(async (sql) => {

    // ── ENUM ───────────────────────────────────────────────
    await sql`
      DO $$ BEGIN
        CREATE TYPE tipo_solicitud AS ENUM ('Agotado', 'Nuevo');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `

    // ── proveedores ────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS proveedores (
        id            SERIAL PRIMARY KEY,
        nombre        TEXT NOT NULL UNIQUE,
        dias_entrega  INTEGER NOT NULL DEFAULT 3,
        telefono      TEXT,
        creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    // ── productos_catalogo ─────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS productos_catalogo (
        id            SERIAL PRIMARY KEY,
        nombre        TEXT NOT NULL,
        proveedor_id  INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
        activo        BOOLEAN NOT NULL DEFAULT true,
        creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    // Índice GIN para búsqueda full-text (IF NOT EXISTS requiere PG 9.5+)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_productos_nombre
        ON productos_catalogo USING GIN (to_tsvector('spanish', nombre))
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_productos_proveedor
        ON productos_catalogo(proveedor_id)
    `

    // ── solicitudes ────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS solicitudes (
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
        orden_columna     INTEGER     NOT NULL DEFAULT 0,
        creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
        actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS idx_solicitudes_estado       ON solicitudes(estado)`
    await sql`CREATE INDEX IF NOT EXISTS idx_solicitudes_proveedor_id ON solicitudes(proveedor_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_solicitudes_creado_en    ON solicitudes(creado_en DESC)`
    await sql`CREATE INDEX IF NOT EXISTS idx_solicitudes_tipo         ON solicitudes(tipo)`

    // ── Trigger actualizado_en ─────────────────────────────
    await sql`
      CREATE OR REPLACE FUNCTION set_actualizado_en()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.actualizado_en = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `
    await sql`
      DO $$ BEGIN
        CREATE TRIGGER trg_solicitudes_actualizado
          BEFORE UPDATE ON solicitudes
          FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `

    // ── Seed data (solo si proveedores está vacío) ─────────
    const [{ count }] = await sql<[{ count: string }]>`
      SELECT COUNT(*) FROM proveedores
    `

    if (Number(count) === 0) {
      console.log('[DB] Insertando datos de prueba...')

      await sql`
        INSERT INTO proveedores (nombre, dias_entrega, telefono) VALUES
          ('Distribuidora El Rayo',    2, '3001234567'),
          ('Importaciones Orión',      5, '3117890123'),
          ('Ferretería Central',       1, '3204567890'),
          ('Papelería Mundo Nuevo',    3, '3158901234'),
          ('Electrónica del Norte',    7, '3009876543'),
          ('Suministros La Torre',     4, '3123456789'),
          ('Confecciones Vargas Hnos', 6, NULL)
      `

      await sql`
        INSERT INTO productos_catalogo (nombre, proveedor_id) VALUES
          ('Tornillos 1/2" x 1" (caja x100)',   3),
          ('Alambre calibre 12 (rollo 100m)',    3),
          ('Pintura anticorrosiva gris 1/4',     3),
          ('Sellador de silicona transparente',  3),
          ('Aceite de motor 10W-40 (litro)',     1),
          ('Filtro de aire universal',           1),
          ('Bujía NGK BP6ES',                    1),
          ('Frenos de disco trasero',            1),
          ('Resma papel carta 75g',              4),
          ('Esfero azul Kilométrico x12',        4),
          ('Marcador permanente negro x5',       4),
          ('Cable USB-C 2m',                     5),
          ('Regleta eléctrica 6 puestos',        5),
          ('Cargador 65W GaN tipo C',            5),
          ('Mouse inalámbrico básico',           5),
          ('Memoria USB 32GB 3.0',               5),
          ('Camiseta deportiva talla M',         2),
          ('Maleta escolar 20L',                 2),
          ('Zapato industrial punta acero T42',  2),
          ('Guante de látex talla M (par)',      6),
          ('Tapabocas desechable x50',           6),
          ('Alcohol antiséptico 500ml',          6),
          ('Jabón antibacterial litro',          6)
      `

      await sql`
        INSERT INTO solicitudes
          (producto_nombre, tipo, proveedor_id, cantidad_pedida, estado, contacto_cliente, notas, precio_estimado, orden_columna)
        VALUES
          ('Cable USB-C 2m',                  'Agotado', 5,  3, 'solicitudes', '3001112233', NULL,                15000, 0),
          ('Guante de látex talla M (par)',   'Agotado', 6, 10, 'solicitudes', NULL,         'Urgente para obra',  8500, 1),
          ('Camiseta deportiva talla M',      'Nuevo',   2,  5, 'solicitudes', '3154445566', NULL,                25000, 2),
          ('Regleta eléctrica 6 puestos',     'Agotado', 5,  4, 'analisis',    '3207778899', 'Verificar voltaje', 35000, 0),
          ('Filtro de aire universal',        'Agotado', 1,  2, 'analisis',    NULL,         NULL,                28000, 1),
          ('Tornillos 1/2" x 1" (caja x100)','Agotado', 3,  5, 'por_pedir',   NULL,         NULL,                 9500, 0),
          ('Bujía NGK BP6ES',                 'Agotado', 1,  8, 'por_pedir',   '3001234000', NULL,                14000, 1),
          ('Tapabocas desechable x50',        'Agotado', 6,  3, 'por_pedir',   NULL,         'Marca Protex',       7200, 2),
          ('Aceite de motor 10W-40 (litro)',  'Agotado', 1, 12, 'en_camino',   NULL,         'Pedido #2891',      18500, 0),
          ('Memoria USB 32GB 3.0',            'Agotado', 5,  6, 'en_camino',   '3016667788', NULL,                22000, 1),
          ('Mouse inalámbrico básico',        'Agotado', 5,  2, 'recibido',    '3221112222', NULL,                45000, 0),
          ('Pintura anticorrosiva gris 1/4',  'Agotado', 3,  3, 'recibido',    NULL,         NULL,                38000, 1)
      `

      console.log('[DB] Datos de prueba insertados ✓')
    }
  })

  console.log('[DB] Migraciones completadas ✓')
}
