import type {
  Solicitud,
  Proveedor,
  ProductoCatalogo,
  CrearSolicitudBody,
  EstadoSolicitud,
} from './types'

// En dev usa el proxy de Vite (/api → localhost:3000)
// En prod usa la URL del backend en Railway
const BASE = import.meta.env.VITE_API_URL ?? ''

// ── Helpers ───────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? 'Error desconocido')
  }

  // 204 No Content no tiene body
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Solicitudes ───────────────────────────────────────────────

export const api = {
  solicitudes: {
    /** Carga todas las tarjetas con join a proveedor */
    getAll(): Promise<Solicitud[]> {
      return request('/api/solicitudes')
    },

    /** Crea una tarjeta nueva */
    create(body: CrearSolicitudBody): Promise<Solicitud> {
      return request('/api/solicitudes', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },

    /** Mueve una tarjeta a otro estado (columna) */
    moverEstado(
      id: string,
      estado: EstadoSolicitud,
      ordenColumna?: number,
    ): Promise<Solicitud> {
      return request(`/api/solicitudes/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado, ordenColumna }),
      })
    },

    /** Edita campos de una tarjeta (notas, cantidad, proveedor, etc.) */
    update(id: string, body: Partial<CrearSolicitudBody>): Promise<Solicitud> {
      return request(`/api/solicitudes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },

    /** Reordena varias tarjetas de una columna en lote (post drag&drop) */
    reorder(items: Array<{ id: string; ordenColumna: number }>): Promise<{ ok: boolean }> {
      return request('/api/solicitudes/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ items }),
      })
    },

    /** Elimina una tarjeta */
    delete(id: string): Promise<{ ok: boolean }> {
      return request(`/api/solicitudes/${id}`, { method: 'DELETE' })
    },
  },

  // ── Proveedores ─────────────────────────────────────────────

  proveedores: {
    getAll(): Promise<Proveedor[]> {
      return request('/api/proveedores')
    },
  },

  // ── Catálogo / Autocompletado ───────────────────────────────

  catalogo: {
    buscar(q: string, limit = 10): Promise<ProductoCatalogo[]> {
      const params = new URLSearchParams({ q, limit: String(limit) })
      return request(`/api/productos-catalogo?${params}`)
    },
  },
}

export { ApiError }
