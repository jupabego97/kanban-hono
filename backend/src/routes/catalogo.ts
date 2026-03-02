import { Hono } from 'hono'
import sql from '../db.ts'
import type { ProductoCatalogo } from '../types.ts'

const router = new Hono()

// ============================================================
// GET /api/productos-catalogo?q=texto&limit=10
//
// Búsqueda full-text con fallback a ILIKE para queries cortas.
// Usado por el autocompletado del formulario de mostrador.
// ============================================================
router.get('/', async (c) => {
  const q     = c.req.query('q')?.trim() ?? ''
  const limit = Math.min(Number(c.req.query('limit') ?? '10'), 30)

  try {
    let rows: ProductoCatalogo[]

    if (q.length === 0) {
      // Sin búsqueda: devuelve los más recientes (para precargar)
      rows = await sql<ProductoCatalogo[]>`
        SELECT
          pc.id,
          pc.nombre,
          pc.proveedor_id,
          p.nombre AS proveedor_nombre
        FROM productos_catalogo pc
        LEFT JOIN proveedores p ON pc.proveedor_id = p.id
        WHERE pc.activo = true
        ORDER BY pc.nombre ASC
        LIMIT ${limit}
      `
    } else if (q.length <= 2) {
      // Query muy corta: ILIKE es más preciso que full-text
      rows = await sql<ProductoCatalogo[]>`
        SELECT
          pc.id,
          pc.nombre,
          pc.proveedor_id,
          p.nombre AS proveedor_nombre
        FROM productos_catalogo pc
        LEFT JOIN proveedores p ON pc.proveedor_id = p.id
        WHERE pc.activo = true
          AND pc.nombre ILIKE ${'%' + q + '%'}
        ORDER BY pc.nombre ASC
        LIMIT ${limit}
      `
    } else {
      // Full-text search con el índice GIN (español)
      // ts_rank ordena por relevancia, con fallback ILIKE para parciales
      rows = await sql<ProductoCatalogo[]>`
        SELECT
          pc.id,
          pc.nombre,
          pc.proveedor_id,
          p.nombre AS proveedor_nombre,
          ts_rank(
            to_tsvector('spanish', pc.nombre),
            plainto_tsquery('spanish', ${q})
          ) AS rank
        FROM productos_catalogo pc
        LEFT JOIN proveedores p ON pc.proveedor_id = p.id
        WHERE pc.activo = true
          AND (
            to_tsvector('spanish', pc.nombre) @@ plainto_tsquery('spanish', ${q})
            OR pc.nombre ILIKE ${'%' + q + '%'}
          )
        ORDER BY rank DESC, pc.nombre ASC
        LIMIT ${limit}
      `
    }

    return c.json(rows)
  } catch (err) {
    console.error('GET /productos-catalogo:', err)
    return c.json({ error: 'Error en la búsqueda' }, 500)
  }
})

export default router
