import type { SSEEvent } from './types.ts'

// ============================================================
// SSE Manager — gestiona conexiones de clientes en tiempo real
// ============================================================

type SSEController = ReadableStreamDefaultController<string>

// Set de controladores activos (uno por pestaña/cliente conectado)
const clients = new Set<SSEController>()

/**
 * Serializa y envía un evento SSE a TODOS los clientes conectados.
 * Las conexiones muertas se eliminan automáticamente.
 */
export function broadcast(event: SSEEvent): void {
  const message = `data: ${JSON.stringify(event)}\n\n`

  for (const ctrl of clients) {
    try {
      ctrl.enqueue(message)
    } catch {
      // El cliente se desconectó — limpiar
      clients.delete(ctrl)
    }
  }
}

/**
 * Crea un ReadableStream SSE y registra el cliente.
 * Retorna el Response listo para enviar desde el endpoint.
 */
export function createSSEStream(): Response {
  let controller: SSEController

  const stream = new ReadableStream<string>({
    start(ctrl) {
      controller = ctrl
      clients.add(controller)

      // Ping inicial para confirmar conexión al cliente
      ctrl.enqueue(`: connected clients=${clients.size}\n\n`)
    },
    cancel() {
      // El cliente cerró la conexión (navegador cerrado, tab cambiada, etc.)
      clients.delete(controller)
    },
  })

  // Keep-alive: ping cada 25s para evitar timeout en proxies/Railway
  const keepAlive = setInterval(() => {
    try {
      controller.enqueue(': ping\n\n')
    } catch {
      clearInterval(keepAlive)
      clients.delete(controller)
    }
  }, 25_000)

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      // Desactiva buffering en nginx (necesario para Railway y proxies)
      'X-Accel-Buffering': 'no',
    },
  })
}

/** Para debugging — cuántos clientes activos hay */
export function clientCount(): number {
  return clients.size
}
