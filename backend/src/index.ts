import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { clientCount } from './sse.ts'
import { runMigrations } from './migrate.ts'
import solicitudesRouter from './routes/solicitudes.ts'
import proveedoresRouter from './routes/proveedores.ts'
import catalogoRouter   from './routes/catalogo.ts'

// Ejecutar migraciones antes de arrancar el servidor
// Crea tablas + seed data si la BD está vacía
await runMigrations()

const app = new Hono()

// ── Middleware global ─────────────────────────────────────────
app.use('*', logger())
app.use('*', secureHeaders())

app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // Permitir: localhost en dev, dominio Railway en prod
      const allowed = [
        process.env.FRONTEND_URL ?? 'http://localhost:5173',
        'http://localhost:4173',  // vite preview
      ]
      return allowed.includes(origin ?? '') ? origin : allowed[0]
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    maxAge: 600,
  })
)

// ── Health check (Railway lo usa para saber si el servicio está vivo) ──
app.get('/health', (c) =>
  c.json({
    status:  'ok',
    service: 'kanban-hono-backend',
    ts:      new Date().toISOString(),
    sse_clients: clientCount(),
  })
)

// ── Rutas de la API ───────────────────────────────────────────
// IMPORTANTE: /reorder debe montarse antes que /:id para evitar
// que Hono interprete "reorder" como un UUID.
// Hono resuelve rutas en orden de registro, esto está cubierto
// dentro del router de solicitudes con .get('/stream') al inicio.
app.route('/api/solicitudes',      solicitudesRouter)
app.route('/api/proveedores',      proveedoresRouter)
app.route('/api/productos-catalogo', catalogoRouter)

// ── 404 global ────────────────────────────────────────────────
app.notFound((c) =>
  c.json({ error: `Ruta no encontrada: ${c.req.method} ${c.req.path}` }, 404)
)

// ── Error handler global ──────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Error interno del servidor' }, 500)
})

// ── Arrancar servidor ─────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000)

console.log(`
╔══════════════════════════════════════╗
║   Kanban Hono Backend               ║
║   Puerto: ${port.toString().padEnd(27)}║
║   Env:    ${(process.env.NODE_ENV ?? 'development').padEnd(27)}║
╚══════════════════════════════════════╝
`)

export default {
  port,
  fetch: app.fetch,
}
