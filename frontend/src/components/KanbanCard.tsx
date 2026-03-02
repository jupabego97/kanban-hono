import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Solicitud } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────

function buildWaLink(contact: string): string | null {
  const digits = contact.replace(/\D/g, '')
  if (digits.length === 0) return null
  // Número colombiano de 10 dígitos → prefijo 57
  if (digits.length === 10 && digits.startsWith('3')) return `https://wa.me/57${digits}`
  if (digits.length >= 10) return `https://wa.me/${digits}`
  return null
}

// ── Props ─────────────────────────────────────────────────────

interface KanbanCardProps {
  solicitud:  Solicitud
  onEdit:     (s: Solicitud) => void
  onDelete:   (id: string) => void
  /** Cuando es true la tarjeta está siendo renderizada en el DragOverlay */
  isOverlay?: boolean
}

// ============================================================
// KanbanCard — Tarjeta draggable del tablero
// ============================================================
export function KanbanCard({ solicitud: s, onEdit, onDelete, isOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id:   s.id,
    data: { type: 'card', solicitud: s },
  })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  }

  const waLink = s.contactoCliente ? buildWaLink(s.contactoCliente) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-slate-800 border rounded-xl p-3.5 select-none
                  transition-shadow cursor-grab active:cursor-grabbing
                  ${isDragging
                    ? 'opacity-30 border-slate-600'
                    : 'border-slate-700 hover:border-slate-600 hover:shadow-lg hover:shadow-black/30'
                  }
                  ${isOverlay ? 'dnd-overlay border-slate-500' : ''}
                  card-enter`}
      {...attributes}
      {...listeners}
    >
      {/* ── Fila superior: badge tipo + cantidad ─────────── */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0
            ${s.tipo === 'Agotado'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-blue-500/20 text-blue-400'
            }`}
        >
          {s.tipo === 'Agotado' ? '⚠ Agotado' : '✦ Nuevo'}
        </span>

        {/* Cantidad — tipografía grande y prominente */}
        <span className="text-2xl font-bold text-slate-100 leading-none tabular-nums">
          ×{s.cantidadPedida}
        </span>
      </div>

      {/* ── Nombre del producto ──────────────────────────── */}
      <p
        className="text-slate-200 text-sm font-medium leading-snug mb-3 line-clamp-2
                   cursor-pointer hover:text-white transition-colors"
        onClick={(e) => { e.stopPropagation(); onEdit(s) }}
      >
        {s.productoNombre}
      </p>

      {/* ── Footer: proveedor + acciones ─────────────────── */}
      <div className="flex items-center justify-between gap-2">
        {/* Proveedor */}
        <span className="text-xs text-slate-500 truncate">
          {s.proveedorNombre ?? 'Sin proveedor'}
          {s.diasEntrega != null && (
            <span className="ml-1 text-slate-600">· {s.diasEntrega}d</span>
          )}
        </span>

        {/* Acciones — siempre visibles en mobile, hover en desktop */}
        <div
          className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0
                     sm:group-hover:opacity-100 transition-opacity"
          // Evita que los clicks en botones activen el drag
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* WhatsApp */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              title={`WhatsApp: ${s.contactoCliente}`}
              className="flex items-center justify-center w-7 h-7 rounded-lg
                         text-green-500 hover:bg-green-500/10 transition-colors"
              aria-label="Abrir WhatsApp"
            >
              <WhatsAppIcon />
            </a>
          )}

          {/* Editar */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(s) }}
            title="Editar"
            className="flex items-center justify-center w-7 h-7 rounded-lg
                       text-slate-500 hover:text-slate-300 hover:bg-slate-700
                       transition-colors"
          >
            <PencilIcon />
          </button>

          {/* Eliminar */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
            title="Eliminar"
            className="flex items-center justify-center w-7 h-7 rounded-lg
                       text-slate-600 hover:text-red-400 hover:bg-red-500/10
                       transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Nota (si existe) */}
      {s.notas && (
        <p className="mt-2 text-xs text-slate-500 italic line-clamp-1 border-t border-slate-700/60 pt-2">
          {s.notas}
        </p>
      )}
    </div>
  )
}

// ── Íconos inline (sin dependencia de librería) ───────────────

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  )
}
