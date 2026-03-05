import { create } from 'zustand'
import { api } from '@/lib/api'
import {
  ESTADOS,
  type Solicitud,
  type Proveedor,
  type EstadoSolicitud,
  type CrearSolicitudBody,
  type SSEEvent,
} from '@/lib/types'

// ============================================================
// State shape
// ============================================================

interface KanbanState {
  // ── Datos ──────────────────────────────────────────────────
  solicitudes: Solicitud[]
  proveedores: Proveedor[]

  // ── UI global ──────────────────────────────────────────────
  loading:           boolean
  error:             string | null
  filtroProveedorId: number | null   // filtro activo en col "por_pedir"
  vista:             'mostrador' | 'kanban'
  tema:              'oscuro' | 'dia'

  // ── Derived ────────────────────────────────────────────────
  /** Solicitudes agrupadas por estado, respetando orden_columna */
  byEstado: Record<EstadoSolicitud, Solicitud[]>

  // ── Actions: carga ─────────────────────────────────────────
  fetchAll:        () => Promise<void>
  fetchProveedores:() => Promise<void>

  // ── Actions: CRUD ──────────────────────────────────────────
  createSolicitud: (body: CrearSolicitudBody) => Promise<void>
  moveCard:        (id: string, estado: EstadoSolicitud, ordenColumna?: number) => Promise<void>
  updateCard:      (id: string, body: Partial<CrearSolicitudBody>) => Promise<void>
  reorderCards:    (items: Array<{ id: string; ordenColumna: number }>) => Promise<void>
  deleteCard:      (id: string) => Promise<void>

  // ── Actions: UI ────────────────────────────────────────────
  setFiltroProveedor: (id: number | null) => void
  setVista:           (v: 'mostrador' | 'kanban') => void
  setTema:            (t: 'oscuro' | 'dia') => void
  clearError:         () => void

  // ── Actions: SSE ───────────────────────────────────────────
  applySSEEvent: (event: SSEEvent) => void

  // ── Optimistic (uso interno del drag & drop) ───────────────
  _setOptimistic: (solicitudes: Solicitud[]) => void
}

// ── Helper: recalcula byEstado desde el array plano ──────────

function buildByEstado(solicitudes: Solicitud[]): Record<EstadoSolicitud, Solicitud[]> {
  const map = Object.fromEntries(
    ESTADOS.map((e) => [e, [] as Solicitud[]])
  ) as Record<EstadoSolicitud, Solicitud[]>

  for (const s of solicitudes) {
    if (map[s.estado]) {
      map[s.estado].push(s)
    }
  }

  // Ordenar cada columna por orden_columna ASC, luego creadoEn DESC
  for (const estado of ESTADOS) {
    map[estado].sort((a, b) =>
      a.ordenColumna !== b.ordenColumna
        ? a.ordenColumna - b.ordenColumna
        : new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
    )
  }

  return map
}

// ── Helper: reemplaza/inserta una solicitud en el array ───────

function upsert(list: Solicitud[], updated: Solicitud): Solicitud[] {
  const idx = list.findIndex((s) => s.id === updated.id)
  if (idx === -1) return [updated, ...list]
  const next = [...list]
  next[idx] = updated
  return next
}

// ============================================================
// Store
// ============================================================

export const useKanbanStore = create<KanbanState>((set, get) => ({
  // ── Estado inicial ────────────────────────────────────────
  solicitudes:       [],
  proveedores:       [],
  loading:           false,
  error:             null,
  filtroProveedorId: null,
  vista:             'kanban',
  tema:              (localStorage.getItem('tema') as 'oscuro' | 'dia') ?? 'oscuro',
  byEstado:          buildByEstado([]),

  // ── fetchAll ──────────────────────────────────────────────
  async fetchAll() {
    set({ loading: true, error: null })
    try {
      const solicitudes = await api.solicitudes.getAll()
      set({ solicitudes, byEstado: buildByEstado(solicitudes), loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  // ── fetchProveedores ──────────────────────────────────────
  async fetchProveedores() {
    try {
      const proveedores = await api.proveedores.getAll()
      set({ proveedores })
    } catch (err) {
      console.error('fetchProveedores:', err)
    }
  },

  // ── createSolicitud ───────────────────────────────────────
  // El SSE event 'created' actualizará el estado definitivamente.
  // Aquí solo disparamos la request; el optimismo lo maneja el formulario.
  async createSolicitud(body) {
    try {
      await api.solicitudes.create(body)
      // El SSE 'created' actualizará el store automáticamente
    } catch (err) {
      set({ error: (err as Error).message })
      throw err  // re-throw para que el form muestre el error
    }
  },

  // ── moveCard ──────────────────────────────────────────────
  // Optimistic: actualiza localmente de inmediato, confirma por SSE.
  async moveCard(id, estado, ordenColumna) {
    const prev = get().solicitudes

    // Optimistic update
    const optimistic = prev.map((s) =>
      s.id === id
        ? { ...s, estado, ordenColumna: ordenColumna ?? s.ordenColumna }
        : s
    )
    set({ solicitudes: optimistic, byEstado: buildByEstado(optimistic) })

    try {
      await api.solicitudes.moverEstado(id, estado, ordenColumna)
    } catch (err) {
      // Rollback
      set({ solicitudes: prev, byEstado: buildByEstado(prev), error: (err as Error).message })
    }
  },

  // ── updateCard ────────────────────────────────────────────
  async updateCard(id, body) {
    try {
      await api.solicitudes.update(id, body)
      // SSE 'updated' actualizará el store
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  // ── reorderCards ──────────────────────────────────────────
  // Optimistic: el drag&drop ya movió las tarjetas visualmente.
  // Solo sincronizamos el orden con el backend.
  async reorderCards(items) {
    const prev = get().solicitudes

    // Aplicar nuevos orden_columna optimísticamente
    const idToOrden = new Map(items.map((i) => [i.id, i.ordenColumna]))
    const optimistic = prev.map((s) =>
      idToOrden.has(s.id) ? { ...s, ordenColumna: idToOrden.get(s.id)! } : s
    )
    set({ solicitudes: optimistic, byEstado: buildByEstado(optimistic) })

    try {
      await api.solicitudes.reorder(items)
    } catch (err) {
      // Rollback silencioso — el usuario no notará si el orden no persiste
      set({ solicitudes: prev, byEstado: buildByEstado(prev) })
      console.error('reorderCards rollback:', err)
    }
  },

  // ── deleteCard ────────────────────────────────────────────
  async deleteCard(id) {
    const prev = get().solicitudes

    // Optimistic: quitar de la lista de inmediato
    const optimistic = prev.filter((s) => s.id !== id)
    set({ solicitudes: optimistic, byEstado: buildByEstado(optimistic) })

    try {
      await api.solicitudes.delete(id)
    } catch (err) {
      set({ solicitudes: prev, byEstado: buildByEstado(prev), error: (err as Error).message })
    }
  },

  // ── applySSEEvent ─────────────────────────────────────────
  // Llamado por useSSE cuando llega un evento del backend.
  // Es la fuente de verdad final después de cada acción.
  applySSEEvent(event) {
    if (event.event === 'ping') return

    const current = get().solicitudes

    if (event.event === 'created') {
      const nueva = event.data as Solicitud
      // Evitar duplicados si ya está en el store (raro, pero posible)
      if (current.some((s) => s.id === nueva.id)) return
      const next = [nueva, ...current]
      set({ solicitudes: next, byEstado: buildByEstado(next) })
    }

    else if (event.event === 'updated') {
      const updated = event.data as Solicitud
      const next = upsert(current, updated)
      set({ solicitudes: next, byEstado: buildByEstado(next) })
    }

    else if (event.event === 'deleted') {
      const { id } = event.data as { id: string }
      const next = current.filter((s) => s.id !== id)
      set({ solicitudes: next, byEstado: buildByEstado(next) })
    }

    else if (event.event === 'reordered') {
      const items = event.data as Array<{ id: string; ordenColumna: number }>
      const idToOrden = new Map(items.map((i) => [i.id, i.ordenColumna]))
      const next = current.map((s) =>
        idToOrden.has(s.id) ? { ...s, ordenColumna: idToOrden.get(s.id)! } : s
      )
      set({ solicitudes: next, byEstado: buildByEstado(next) })
    }
  },

  // ── UI helpers ────────────────────────────────────────────
  setFiltroProveedor: (id) => set({ filtroProveedorId: id }),
  setVista: (vista) => set({ vista }),
  setTema: (tema) => {
    localStorage.setItem('tema', tema)
    if (tema === 'oscuro') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    set({ tema })
  },
  clearError: () => set({ error: null }),

  // ── Optimistic interno (drag & drop) ─────────────────────
  _setOptimistic(solicitudes) {
    set({ solicitudes, byEstado: buildByEstado(solicitudes) })
  },
}))

// ── Selectores derivados (para usar fuera del store) ─────────

export const selectByEstado = (estado: EstadoSolicitud) =>
  (s: KanbanState) => s.byEstado[estado]

export const selectProveedoresMap = (s: KanbanState) =>
  new Map(s.proveedores.map((p) => [p.id, p]))
