import { Hono } from 'hono'
import sql from '../db.ts'
import { broadcast, createSSEStream } from '../sse.ts'
import {
  ESTADOS_VALIDOS,
  type CrearSolicitudBody,
  type ActualizarEstadoBody,
  type ReordenarBody,
  type Solicitud,
} from '../types.ts'

const router = new Hono()

// ── Query reutilizable con JOIN a proveedores ─────────────────
const SELECT_SOLICITUD = sql`
  SELECT
    s.id,
    s.producto_nombre,
    s.tipo,
    s.proveedor_id,
    s.cantidad_pedida,
    s.estado,
    s.contacto_cliente,
    s.notas,
    s.precio_estimado,
    s.orden_columna,
    s.creado_en,
    s.actualizado_en,
    p.nombre       AS proveedor_nombre,
    p.dias_entrega,
    p.telefono     AS proveedor_telefono
  FROM solicitudes s
  LEFT JOIN proveedores p ON s.proveedor_id = p.id
`

// ============================================================
// GET /api/solicitudes/stream  ← SSE (debe ir ANTES de /:id)
// ============================================================
router.get('/stream', (c) => {
  return createSSEStream()
})

// ============================================================
// GET /api/solicitudes
// Retorna todas las solicitudes ordenadas por columna y fecha
// ============================================================
router.get('/', async (c) => {
  try {
    const rows = await sql<Solicitud[]>`
      ${SELECT_SOLICITUD}
      ORDER BY
        CASE s.estado
          WHEN 'solicitudes' THEN 1
          WHEN 'analisis'    THEN 2
          WHEN 'por_pedir'   THEN 3
          WHEN 'en_camino'   THEN 4
          WHEN 'recibido'    THEN 5
        END,
        s.orden_columna ASC,
        s.creado_en DESC
    `
    return c.json(rows)
  } catch (err) {
    console.error('GET /solicitudes:', err)
    return c.json({ error: 'Error al obtener solicitudes' }, 500)
  }
})

// ============================================================
// GET /api/solicitudes/:id
// ============================================================
router.get('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const [row] = await sql<Solicitud[]>`
      ${SELECT_SOLICITUD}
      WHERE s.id = ${id}
    `
    if (!row) return c.json({ error: 'Solicitud no encontrada' }, 404)
    return c.json(row)
  } catch (err) {
    console.error('GET /solicitudes/:id:', err)
    return c.json({ error: 'Error al obtener solicitud' }, 500)
  }
})

// ============================================================
// POST /api/solicitudes
// Crea una nueva solicitud y la broadcast por SSE
// ============================================================
router.post('/', async (c) => {
  let body: CrearSolicitudBody
  try {
    body = await c.req.json<CrearSolicitudBody>()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  // Validación mínima
  if (!body.productoNombre?.trim()) {
    return c.json({ error: 'productoNombre es requerido' }, 400)
  }
  if (body.tipo !== 'Agotado' && body.tipo !== 'Nuevo') {
    return c.json({ error: 'tipo debe ser "Agotado" o "Nuevo"' }, 400)
  }

  try {
    // Calcular el siguiente orden_columna en la columna 'solicitudes'
    const [{ max }] = await sql<[{ max: number }]>`
      SELECT COALESCE(MAX(orden_columna), -1) AS max
      FROM solicitudes
      WHERE estado = 'solicitudes'
    `

    const [nueva] = await sql<Solicitud[]>`
      INSERT INTO solicitudes (
        producto_nombre,
        tipo,
        proveedor_id,
        cantidad_pedida,
        estado,
        contacto_cliente,
        notas,
        precio_estimado,
        orden_columna
      ) VALUES (
        ${body.productoNombre.trim()},
        ${body.tipo},
        ${body.proveedorId ?? null},
        ${body.cantidadPedida ?? 1},
        'solicitudes',
        ${body.contactoCliente?.trim() ?? null},
        ${body.notas?.trim() ?? null},
        ${body.precioEstimado ?? null},
        ${max + 1}
      )
      RETURNING *
    `

    // Obtener con join para el broadcast
    const [completa] = await sql<Solicitud[]>`
      ${SELECT_SOLICITUD}
      WHERE s.id = ${nueva.id}
    `

    broadcast({ event: 'created', data: completa })

    return c.json(completa, 201)
  } catch (err) {
    console.error('POST /solicitudes:', err)
    return c.json({ error: 'Error al crear solicitud' }, 500)
  }
})

// ============================================================
// PATCH /api/solicitudes/:id/estado
// Mueve la tarjeta a otra columna (o reordena dentro de la misma)
// Body: { estado: EstadoSolicitud, ordenColumna?: number }
// ============================================================
router.patch('/:id/estado', async (c) => {
  const { id } = c.req.param()
  let body: ActualizarEstadoBody
  try {
    body = await c.req.json<ActualizarEstadoBody>()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  if (!ESTADOS_VALIDOS.includes(body.estado)) {
    return c.json({ error: `estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}` }, 400)
  }

  try {
    // Si no llega ordenColumna, poner al final de la columna destino
    let ordenColumna = body.ordenColumna
    if (ordenColumna === undefined) {
      const [{ max }] = await sql<[{ max: number }]>`
        SELECT COALESCE(MAX(orden_columna), -1) AS max
        FROM solicitudes
        WHERE estado = ${body.estado} AND id != ${id}
      `
      ordenColumna = max + 1
    }

    const [actualizada] = await sql<Solicitud[]>`
      UPDATE solicitudes
      SET estado = ${body.estado}, orden_columna = ${ordenColumna}
      WHERE id = ${id}
      RETURNING *
    `
    if (!actualizada) return c.json({ error: 'Solicitud no encontrada' }, 404)

    const [completa] = await sql<Solicitud[]>`
      ${SELECT_SOLICITUD}
      WHERE s.id = ${id}
    `

    broadcast({ event: 'updated', data: completa })

    return c.json(completa)
  } catch (err) {
    console.error('PATCH /solicitudes/:id/estado:', err)
    return c.json({ error: 'Error al actualizar estado' }, 500)
  }
})

// ============================================================
// PATCH /api/solicitudes/:id
// Actualiza campos editables de una tarjeta (notas, cantidad, etc.)
// ============================================================
router.patch('/:id', async (c) => {
  const { id } = c.req.param()
  let body: Partial<CrearSolicitudBody>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  try {
    // Construir SET dinámico solo con los campos enviados
    const updates: Record<string, unknown> = {}
    if (body.productoNombre  !== undefined) updates.producto_nombre   = body.productoNombre.trim()
    if (body.tipo            !== undefined) updates.tipo              = body.tipo
    if (body.proveedorId     !== undefined) updates.proveedor_id      = body.proveedorId
    if (body.cantidadPedida  !== undefined) updates.cantidad_pedida   = body.cantidadPedida
    if (body.contactoCliente !== undefined) updates.contacto_cliente  = body.contactoCliente?.trim() ?? null
    if (body.notas           !== undefined) updates.notas             = body.notas?.trim() ?? null
    if (body.precioEstimado  !== undefined) updates.precio_estimado   = body.precioEstimado

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No hay campos para actualizar' }, 400)
    }

    // postgres.js admite sql({ ...object }) para SET dinámico
    const [actualizada] = await sql<Solicitud[]>`
      UPDATE solicitudes
      SET ${sql(updates)}
      WHERE id = ${id}
      RETURNING *
    `
    if (!actualizada) return c.json({ error: 'Solicitud no encontrada' }, 404)

    const [completa] = await sql<Solicitud[]>`
      ${SELECT_SOLICITUD}
      WHERE s.id = ${id}
    `

    broadcast({ event: 'updated', data: completa })

    return c.json(completa)
  } catch (err) {
    console.error('PATCH /solicitudes/:id:', err)
    return c.json({ error: 'Error al actualizar solicitud' }, 500)
  }
})

// ============================================================
// PATCH /api/solicitudes/reorder
// Reordena varias tarjetas de una columna en lote (post drag&drop)
// Body: { items: [{ id: string, ordenColumna: number }] }
// ============================================================
router.patch('/reorder', async (c) => {
  let body: ReordenarBody
  try {
    body = await c.req.json<ReordenarBody>()
  } catch {
    return c.json({ error: 'JSON inválido' }, 400)
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: 'items debe ser un array no vacío' }, 400)
  }

  try {
    // Actualización en lote con una sola query usando unnest
    await sql`
      UPDATE solicitudes AS s
      SET orden_columna = u.orden_columna
      FROM (
        SELECT
          UNNEST(${body.items.map((i) => i.id)}::uuid[])          AS id,
          UNNEST(${body.items.map((i) => i.ordenColumna)}::int[]) AS orden_columna
      ) AS u
      WHERE s.id = u.id
    `

    broadcast({ event: 'reordered', data: body.items })

    return c.json({ ok: true })
  } catch (err) {
    console.error('PATCH /solicitudes/reorder:', err)
    return c.json({ error: 'Error al reordenar' }, 500)
  }
})

// ============================================================
// DELETE /api/solicitudes/:id
// ============================================================
router.delete('/:id', async (c) => {
  const { id } = c.req.param()
  try {
    const [deleted] = await sql`
      DELETE FROM solicitudes WHERE id = ${id} RETURNING id
    `
    if (!deleted) return c.json({ error: 'Solicitud no encontrada' }, 404)

    broadcast({ event: 'deleted', data: { id } })

    return c.json({ ok: true })
  } catch (err) {
    console.error('DELETE /solicitudes/:id:', err)
    return c.json({ error: 'Error al eliminar solicitud' }, 500)
  }
})

export default router
