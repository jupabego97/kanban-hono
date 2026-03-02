import { useEffect, useRef, useCallback } from 'react'
import { useKanbanStore } from '@/store/kanban'
import type { SSEEvent } from '@/lib/types'

const SSE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/solicitudes/stream`

const MIN_DELAY =  1_000  //  1 segundo
const MAX_DELAY = 30_000  // 30 segundos

// ============================================================
// useSSE — conecta al stream SSE del backend y despacha
// eventos al store de Zustand. Reconexión automática con
// backoff exponencial. Re-conecta al volver a la pestaña.
// ============================================================
export function useSSE() {
  const applySSEEvent = useKanbanStore((s) => s.applySSEEvent)

  // Refs para no re-crear el efecto en cada render
  const esRef       = useRef<EventSource | null>(null)
  const retryDelay  = useRef(MIN_DELAY)
  const retryTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmounted   = useRef(false)

  const clearRetry = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current)
      retryTimer.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (unmounted.current) return
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const es = new EventSource(SSE_URL)
    esRef.current = es

    es.onopen = () => {
      // Conexión establecida — reset backoff
      retryDelay.current = MIN_DELAY
    }

    es.onmessage = (e: MessageEvent<string>) => {
      // Ignorar comentarios keep-alive (": ping")
      if (!e.data || e.data.startsWith(':')) return

      try {
        const event = JSON.parse(e.data) as SSEEvent
        applySSEEvent(event)
      } catch (err) {
        console.warn('[SSE] Mensaje malformado:', e.data, err)
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null

      if (unmounted.current) return

      // Backoff exponencial: 1s → 2s → 4s → 8s → 16s → 30s
      const delay = retryDelay.current
      retryDelay.current = Math.min(delay * 2, MAX_DELAY)

      console.info(`[SSE] Reconectando en ${delay / 1000}s...`)
      retryTimer.current = setTimeout(connect, delay)
    }
  }, [applySSEEvent])

  useEffect(() => {
    unmounted.current = false

    // Conexión inicial
    connect()

    // Reconectar cuando el tab vuelve a estar visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !esRef.current) {
        clearRetry()
        retryDelay.current = MIN_DELAY
        connect()
      }
    }

    // Reconectar cuando el navegador vuelve online
    const handleOnline = () => {
      clearRetry()
      retryDelay.current = MIN_DELAY
      connect()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      unmounted.current = true
      clearRetry()
      esRef.current?.close()
      esRef.current = null
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [connect, clearRetry])
}
