import { useState, useEffect, useId, useCallback } from 'react'
import { useKanbanStore } from '@/store/kanban'
import { ESTADO_LABELS, ESTADOS } from '@/lib/types'
import type { Solicitud, EstadoSolicitud, TipoSolicitud } from '@/lib/types'

interface CardEditModalProps {
  solicitud: Solicitud | null
  onClose:   () => void
}

export function CardEditModal({ solicitud, onClose }: CardEditModalProps) {
  const { updateCard, moveCard, deleteCard, proveedores } = useKanbanStore()
  const baseId = useId()

  const [nombre,    setNombre]    = useState('')
  const [tipo,      setTipo]      = useState<TipoSolicitud>('Agotado')
  const [cantidad,  setCantidad]  = useState(1)
  const [provId,    setProvId]    = useState<number | string>('')
  const [contacto,  setContacto]  = useState('')
  const [notas,     setNotas]     = useState('')
  const [precio,    setPrecio]    = useState('')
  const [estado,    setEstado]    = useState<EstadoSolicitud>('solicitudes')
  const [saving,    setSaving]    = useState(false)
  const [confirmDel,setConfirmDel]= useState(false)

  // Inicializar campos cuando cambia la solicitud
  useEffect(() => {
    if (!solicitud) return
    setNombre(solicitud.productoNombre)
    setTipo(solicitud.tipo)
    setCantidad(solicitud.cantidadPedida)
    setProvId(solicitud.proveedorId ?? '')
    setContacto(solicitud.contactoCliente ?? '')
    setNotas(solicitud.notas ?? '')
    setPrecio(solicitud.precioEstimado ?? '')
    setEstado(solicitud.estado)
    setConfirmDel(false)
  }, [solicitud])

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = useCallback(async () => {
    if (!solicitud) return
    setSaving(true)
    try {
      const pId = provId === '' ? null : Number(provId)

      // Actualizar campos si cambiaron
      await updateCard(solicitud.id, {
        productoNombre:  nombre.trim() || solicitud.productoNombre,
        tipo,
        proveedorId:     pId,
        cantidadPedida:  cantidad,
        contactoCliente: contacto.trim() || null,
        notas:           notas.trim() || null,
        precioEstimado:  precio ? Number(precio) : null,
      })

      // Mover de columna si cambió el estado
      if (estado !== solicitud.estado) {
        await moveCard(solicitud.id, estado)
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }, [solicitud, nombre, tipo, cantidad, provId, contacto, notas, precio, estado, updateCard, moveCard, onClose])

  const handleDelete = useCallback(async () => {
    if (!solicitud) return
    await deleteCard(solicitud.id)
    onClose()
  }, [solicitud, deleteCard, onClose])

  if (!solicitud) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar solicitud"
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center
                   pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full sm:max-w-lg bg-slate-900 border border-slate-800
                     rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 flex flex-col
                     max-h-[90dvh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
            <h2 className="text-base font-semibold text-slate-100">Editar solicitud</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                         text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Tipo
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Agotado', 'Nuevo'] as TipoSolicitud[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      tipo === t
                        ? t === 'Agotado'
                          ? 'bg-red-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {t === 'Agotado' ? '⚠ Agotado' : '✦ Nuevo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre del producto */}
            <div>
              <label htmlFor={`${baseId}-nombre`} className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Producto
              </label>
              <input
                id={`${baseId}-nombre`}
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                           text-slate-100 text-[16px] focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Cantidad + Estado en una fila */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${baseId}-cant`} className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                  Cantidad
                </label>
                <input
                  id={`${baseId}-cant`}
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                             text-slate-100 text-[16px] text-center font-bold
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-precio`} className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                  Precio est.
                </label>
                <input
                  id={`${baseId}-precio`}
                  type="number"
                  min="0"
                  step="100"
                  placeholder="0"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                             text-slate-100 text-[16px]
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Estado (columna) */}
            <div>
              <label htmlFor={`${baseId}-estado`} className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Columna
              </label>
              <select
                id={`${baseId}-estado`}
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoSolicitud)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                           text-slate-100 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500 appearance-none"
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
                ))}
              </select>
            </div>

            {/* Proveedor */}
            <div>
              <label htmlFor={`${baseId}-prov`} className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Proveedor
              </label>
              <select
                id={`${baseId}-prov`}
                value={provId}
                onChange={(e) => setProvId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                           text-slate-100 text-sm focus:outline-none focus:ring-2
                           focus:ring-blue-500 appearance-none"
              >
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.diasEntrega}d)
                  </option>
                ))}
              </select>
            </div>

            {/* Contacto */}
            <div>
              <label htmlFor={`${baseId}-contacto`} className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Contacto cliente
              </label>
              <input
                id={`${baseId}-contacto`}
                type="tel"
                placeholder="Número o nombre"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                           text-slate-100 text-[16px] focus:outline-none focus:ring-2
                           focus:ring-blue-500"
              />
            </div>

            {/* Notas */}
            <div>
              <label htmlFor={`${baseId}-notas`} className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
                Notas
              </label>
              <textarea
                id={`${baseId}-notas`}
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                           text-slate-100 text-[16px] resize-none focus:outline-none
                           focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer con acciones */}
          <div className="px-5 py-4 border-t border-slate-800 flex flex-col gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-blue-600 text-white
                         hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>

            {/* Eliminar con doble confirmación */}
            {!confirmDel ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="w-full py-3 rounded-xl font-semibold text-sm
                           text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Eliminar solicitud
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDel(false)}
                  className="flex-1 py-3 rounded-xl text-sm text-slate-400
                             hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold
                             bg-red-600 text-white hover:bg-red-500 transition-colors"
                >
                  Confirmar eliminación
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
