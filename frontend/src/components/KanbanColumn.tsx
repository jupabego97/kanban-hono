import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'
import { ESTADO_COLORS, ESTADO_LABELS } from '@/lib/types'
import type { Solicitud, EstadoSolicitud } from '@/lib/types'

interface KanbanColumnProps {
  estado:      EstadoSolicitud
  cards:       Solicitud[]
  onEdit:      (s: Solicitud) => void
  onDelete:    (id: string) => void
  /** Solo para "por_pedir": selector de filtro por proveedor */
  filterSlot?: React.ReactNode
}

export function KanbanColumn({ estado, cards, onEdit, onDelete, filterSlot }: KanbanColumnProps) {
  const colors = ESTADO_COLORS[estado]

  // Hace que la columna entera sea una zona droppable
  const { setNodeRef, isOver } = useDroppable({
    id:   estado,
    data: { type: 'column', estado },
  })

  const cardIds = cards.map((c) => c.id)

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* ── Header de columna ──────────────────────────── */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl
                    border-t-2 bg-slate-900 border-b border-b-slate-800
                    ${colors.border}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2 className={`text-sm font-semibold truncate ${colors.text}`}>
            {ESTADO_LABELS[estado]}
          </h2>
        </div>
        {/* Badge con conteo */}
        <span
          className={`shrink-0 ml-2 text-xs font-bold px-2 py-0.5 rounded-full
                      ${colors.bg} ${colors.text}`}
        >
          {cards.length}
        </span>
      </div>

      {/* Filtro (solo "por_pedir") */}
      {filterSlot && (
        <div className="bg-slate-900 border-b border-slate-800 px-3 py-2">
          {filterSlot}
        </div>
      )}

      {/* ── Zona droppable + lista de tarjetas ─────────── */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2.5 p-2.5 rounded-b-xl min-h-32
                    border border-t-0 transition-colors duration-150
                    ${colors.border.replace('border', 'border')}
                    ${isOver
                      ? `${colors.bg} border-opacity-60`
                      : 'bg-slate-900/50 border-slate-800'
                    }`}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              solicitud={card}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {/* Placeholder cuando la columna está vacía */}
        {cards.length === 0 && (
          <div
            className={`flex-1 flex items-center justify-center text-xs
                        rounded-lg border-2 border-dashed min-h-24
                        transition-colors duration-150
                        ${isOver
                          ? `${colors.border} ${colors.text} opacity-60`
                          : 'border-slate-800 text-slate-700'
                        }`}
          >
            {isOver ? 'Soltar aquí' : 'Sin tarjetas'}
          </div>
        )}
      </div>
    </div>
  )
}
