import { Hono } from 'hono'
import sql from '../db.ts'
import type { Proveedor } from '../types.ts'

const router = new Hono()

// GET /api/proveedores — lista completa ordenada por nombre
router.get('/', async (c) => {
  try {
    const rows = await sql<Proveedor[]>`
      SELECT id, nombre, dias_entrega, telefono, creado_en
      FROM proveedores
      ORDER BY nombre ASC
    `
    return c.json(rows)
  } catch (err) {
    console.error('GET /proveedores:', err)
    return c.json({ error: 'Error al obtener proveedores' }, 500)
  }
})

export default router
