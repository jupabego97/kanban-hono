import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useKanbanStore } from '@/store/kanban'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { CardEditModal } from './CardEditModal'
import { ESTADOS } from '@/lib/types'
import type { Solicitud, EstadoSolicitud } from '@/lib/types'

export function KanbanBoard() {
  const {
    byEstado,
    solicitudes,
    proveedores,
    filtroProveedorId,
    setFiltroProveedor,
    moveCard,
    reorderCards,
    deleteCard,
    _setOptimistic,
  } = useKanbanStore()

  // ── Estado local del drag ─────────────────────────────────
  const [activeCard, setActiveCard] = useState<Solicitud | null>(null)
  const [editCard,   setEditCard]   = useState<Solicitud | null>(null)

  // ── Sensores: PointerSensor con distancia mínima para no
  //   interferir con clicks. TouchSensor para móvil.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  // ── Utilidades de búsqueda ────────────────────────────────

  /** Dado un ID (UUID de solicitud o string de estado), devuelve el estado de la columna */
  const findEstado = useCallback(
    (id: string): EstadoSolicitud | null => {
      // ¿Es un estado directo (columna)?
      if (ESTADOS.includes(id as EstadoSolicitud)) return id as EstadoSolicitud
      // ¿Es una tarjeta?
      const card = solicitudes.find((s) => s.id === id)
      return card?.estado ?? null
    },
    [solicitudes],
  )

  const findCard = useCallback(
    (id: string) => solicitudes.find((s) => s.id === id) ?? null,
    [solicitudes],
  )

  // ── Handlers DnD ──────────────────────────────────────────

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setActiveCard(findCard(active.id as string))
    },
    [findCard],
  )

  /**
   * onDragOver: reordenación optimista en tiempo real mientras
   * el usuario arrastra (visual inmediato sin esperar al servidor).
   */
  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over || active.id === over.id) return

      const fromEstado = findEstado(active.id as string)
      const toEstado   = findEstado(over.id as string)

      if (!fromEstado || !toEstado || fromEstado === toEstado) return

      // Mover tarjeta optimísticamente entre columnas en el store
      const next = solicitudes.map((s) =>
        s.id === active.id ? { ...s, estado: toEstado } : s
      )
      _setOptimistic(next)
    },
    [solicitudes, findEstado, _setOptimistic],
  )

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveCard(null)

      if (!over) {
        // Cancelado — restaurar estado original desde el servidor
        const { fetchAll } = useKanbanStore.getState()
        fetchAll()
        return
      }

      const activeId   = active.id as string
      const overId     = over.id  as string
      const fromEstado = active.data.current?.solicitud?.estado as EstadoSolicitud | undefined
        ?? findEstado(activeId)
      const toEstado   = findEstado(overId)

      if (!fromEstado || !toEstado) return

      if (fromEstado !== toEstado) {
        // ── Cross-column drop ──────────────────────────────
        // byEstado ya fue actualizado optimísticamente en onDragOver
        const col       = useKanbanStore.getState().byEstado[toEstado]
        const newIndex  = col.findIndex((c) => c.id === overId)
        const finalIdx  = newIndex === -1 ? col.length - 1 : newIndex

        await moveCard(activeId, toEstado, finalIdx)
      } else {
        // ── Same-column reorder ────────────────────────────
        const col      = useKanbanStore.getState().byEstado[fromEstado]
        const oldIndex = col.findIndex((c) => c.id === activeId)
        const newIndex = col.findIndex((c) => c.id === overId)

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

        const reordered = arrayMove(col, oldIndex, newIndex)
        const items     = reordered.map((c, idx) => ({ id: c.id, ordenColumna: idx }))

        await reorderCards(items)
      }
    },
    [findEstado, moveCard, reorderCards],
  )

  // ── Handlers UI ───────────────────────────────────────────

  const handleEdit = useCallback((s: Solicitud) => setEditCard(s), [])

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('¿Eliminar esta solicitud?')) return
      await deleteCard(id)
    },
    [deleteCard],
  )

  // ── Filtrado de "por_pedir" por proveedor ─────────────────

  const columnCards = useMemo(() => {
    const map: Record<EstadoSolicitud, Solicitud[]> = { ...byEstado }
    if (filtroProveedorId !== null) {
      map.por_pedir = byEstado.por_pedir.filter(
        (c) => c.proveedorId === filtroProveedorId,
      )
    }
    return map
  }, [byEstado, filtroProveedorId])

  // ── Filtro slot para la columna "por_pedir" ───────────────

  const filterSlot = (
    <select
      value={filtroProveedorId ?? ''}
      onChange={(e) => setFiltroProveedor(e.target.value === '' ? null : Number(e.target.value))}
      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5
                 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500
                 appearance-none"
      title="Filtrar por proveedor"
    >
      <option value="">Todos los proveedores</option>
      {proveedores.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </select>
  )

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      <div className="h-[calc(100dvh-57px)] flex flex-col bg-slate-50 dark:bg-slate-950">

        {/* Barra superior del kanban con stats */}
        <KanbanStatsBar />

        {/* Tablero horizontal con scroll */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden kanban-scroll">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 p-4 h-full items-start">
              {ESTADOS.map((estado) => (
                <KanbanColumn
                  key={estado}
                  estado={estado}
                  cards={columnCards[estado]}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  filterSlot={estado === 'por_pedir' ? filterSlot : undefined}
                />
              ))}
            </div>

            {/* Tarjeta flotante durante el drag */}
            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
              {activeCard && (
                <KanbanCard
                  solicitud={activeCard}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  isOverlay
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Modal de edición */}
      <CardEditModal
        solicitud={editCard}
        onClose={() => setEditCard(null)}
      />
    </>
  )
}

// ── Stats bar: resumen rápido del tablero ─────────────────────

function KanbanStatsBar() {
  const { solicitudes } = useKanbanStore()

  const total    = solicitudes.length
  const agotados = solicitudes.filter((s) => s.tipo === 'Agotado').length
  const nuevos   = solicitudes.filter((s) => s.tipo === 'Nuevo').length
  const enCamino = solicitudes.filter((s) => s.estado === 'en_camino').length

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900
                    text-xs text-slate-400 dark:text-slate-500 overflow-x-auto shrink-0">
      <span className="shrink-0">
        <span className="text-slate-700 dark:text-slate-300 font-semibold">{total}</span> solicitudes
      </span>
      <span className="text-slate-300 dark:text-slate-700">·</span>
      <span className="shrink-0">
        <span className="text-red-500 dark:text-red-400 font-semibold">{agotados}</span> agotados
      </span>
      <span className="text-slate-300 dark:text-slate-700">·</span>
      <span className="shrink-0">
        <span className="text-blue-500 dark:text-blue-400 font-semibold">{nuevos}</span> nuevos
      </span>
      <span className="text-slate-300 dark:text-slate-700">·</span>
      <span className="shrink-0">
        <span className="text-cyan-500 dark:text-cyan-400 font-semibold">{enCamino}</span> en camino
      </span>
    </div>
  )
}
