import { useState, useRef, useCallback, useId } from 'react'
import { useKanbanStore } from '@/store/kanban'
import { useAutocomplete } from '@/hooks/useAutocomplete'
import type { TipoSolicitud, ProductoCatalogo } from '@/lib/types'

// ============================================================
// FormMostrador — Vista optimizada para mostrador/móvil
// Registra faltantes rápidamente con autocompletado
// ============================================================

interface FormState {
  tipo:             TipoSolicitud
  proveedorId:      number | null
  cantidadPedida:   number
  contactoCliente:  string
  notas:            string
}

const INITIAL_FORM: FormState = {
  tipo:            'Agotado',
  proveedorId:     null,
  cantidadPedida:  1,
  contactoCliente: '',
  notas:           '',
}

export function FormMostrador() {
  const createSolicitud = useKanbanStore((s) => s.createSolicitud)
  const proveedores     = useKanbanStore((s) => s.proveedores)

  const [form, setForm]         = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg]   = useState<string | null>(null)
  const [showExtra, setShowExtra]     = useState(false)

  // ── Estado del combobox de proveedor ───────────────────────
  const [provQuery, setProvQuery]   = useState('')
  const [provOpen, setProvOpen]     = useState(false)
  const provContainerRef = useRef<HTMLDivElement>(null)

  const inputRef    = useRef<HTMLInputElement>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseId = useId()

  // ── Autocompletado de producto ─────────────────────────────
  const handleSelectProducto = useCallback((item: ProductoCatalogo) => {
    const prov = proveedores.find((p) => p.id === item.proveedorId)
    setForm((prev) => ({ ...prev, proveedorId: item.proveedorId }))
    setProvQuery(prov ? prov.nombre : '')
  }, [proveedores])

  const ac = useAutocomplete(handleSelectProducto)

  // ── Proveedor combobox helpers ─────────────────────────────
  const provFiltered = provQuery.trim()
    ? proveedores.filter((p) =>
        p.nombre.toLowerCase().includes(provQuery.trim().toLowerCase())
      )
    : proveedores

  const handleProvSelect = (id: number, nombre: string) => {
    setForm((prev) => ({ ...prev, proveedorId: id }))
    setProvQuery(nombre)
    setProvOpen(false)
  }

  const handleProvChange = (val: string) => {
    setProvQuery(val)
    setProvOpen(true)
    if (!val.trim()) {
      setForm((prev) => ({ ...prev, proveedorId: null }))
    }
  }

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitError(null)

      const nombre = ac.query.trim()
      if (!nombre) {
        setSubmitError('El nombre del producto es obligatorio.')
        inputRef.current?.focus()
        return
      }

      setSubmitting(true)
      try {
        await createSolicitud({
          productoNombre:  nombre,
          tipo:            form.tipo,
          proveedorId:     form.proveedorId,
          cantidadPedida:  form.cantidadPedida,
          contactoCliente: form.contactoCliente.trim() || null,
          notas:           form.notas.trim() || null,
        })

        // Feedback de éxito
        if (successTimer.current) clearTimeout(successTimer.current)
        setSuccessMsg(`"${nombre}" registrado correctamente`)
        successTimer.current = setTimeout(() => setSuccessMsg(null), 3500)

        // Reset del formulario — conserva el tipo seleccionado
        ac.clear()
        setForm((prev) => ({ ...INITIAL_FORM, tipo: prev.tipo }))
        setProvQuery('')
        setShowExtra(false)

        // Re-foco inmediato para siguiente registro
        setTimeout(() => inputRef.current?.focus(), 50)
      } catch (err) {
        setSubmitError((err as Error).message)
      } finally {
        setSubmitting(false)
      }
    },
    [ac, form, createSolicitud],
  )

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-4 py-6 min-h-[calc(100dvh-57px)] bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md">

        {/* Título */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Registrar faltante</h2>
          <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
            Completa los campos y pulsa Registrar
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

          {/* ── Campo: Tipo ─────────────────────────────────── */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Tipo de faltante
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Agotado', 'Nuevo'] as TipoSolicitud[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    set('tipo', t)
                    if (t === 'Agotado') set('contactoCliente', '')
                  }}
                  className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                    form.tipo === t
                      ? t === 'Agotado'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                        : 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t === 'Agotado' ? '⚠ Agotado' : '✦ Nuevo'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Campo: Producto (con autocompletado) ────────── */}
          <div ref={ac.containerRef} className="relative">
            <label
              htmlFor={`${baseId}-producto`}
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide"
            >
              Producto
            </label>
            <div className="relative">
              <input
                id={`${baseId}-producto`}
                ref={inputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                // font-size 16px evita el zoom automático en iOS
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3.5
                           text-slate-900 dark:text-slate-100 text-[16px] placeholder:text-slate-400 dark:placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-shadow pr-10"
                placeholder="Buscar o escribir producto..."
                value={ac.query}
                onChange={(e) => ac.setQuery(e.target.value)}
                onFocus={ac.preload}
                onKeyDown={ac.handleKeyDown}
                disabled={submitting}
                aria-autocomplete="list"
                aria-expanded={ac.isOpen}
                aria-controls={`${baseId}-dropdown`}
              />

              {/* Botón limpiar */}
              {ac.query && (
                <button
                  type="button"
                  onClick={() => { ac.clear(); inputRef.current?.focus() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500
                             hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                  aria-label="Limpiar"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown de autocompletado */}
            {ac.isOpen && (
              <ul
                id={`${baseId}-dropdown`}
                role="listbox"
                className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                           rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden
                           max-h-56 overflow-y-auto"
              >
                {ac.results.map((item, idx) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={idx === ac.activeIndex}
                    onMouseDown={(e) => { e.preventDefault(); ac.select(item) }}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer
                                text-sm transition-colors select-none
                                ${idx === ac.activeIndex
                                  ? 'bg-blue-600/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-200'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                  >
                    <span className="truncate">{item.nombre}</span>
                    {item.proveedorNombre && (
                      <span className="ml-3 text-xs text-slate-400 dark:text-slate-500 shrink-0 truncate max-w-[120px]">
                        {item.proveedorNombre}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Campo: Proveedor (combobox) ──────────────────── */}
          <div ref={provContainerRef} className="relative">
            <label
              htmlFor={`${baseId}-proveedor`}
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide"
            >
              Proveedor
              <span className="ml-1.5 text-slate-400 dark:text-slate-600 normal-case font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <input
                id={`${baseId}-proveedor`}
                type="text"
                autoComplete="off"
                placeholder="Buscar proveedor..."
                value={provQuery}
                onChange={(e) => handleProvChange(e.target.value)}
                onFocus={() => setProvOpen(true)}
                onBlur={() => setTimeout(() => setProvOpen(false), 150)}
                disabled={submitting}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3.5
                           text-slate-900 dark:text-slate-100 text-[16px] placeholder:text-slate-400 dark:placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-shadow pr-10"
              />
              {provQuery && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setProvQuery(''); setForm((prev) => ({ ...prev, proveedorId: null })); setProvOpen(false) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500
                             hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                  aria-label="Limpiar proveedor"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown de proveedores */}
            {provOpen && provFiltered.length > 0 && (
              <ul
                role="listbox"
                className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                           rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden
                           max-h-48 overflow-y-auto"
              >
                {provFiltered.map((p) => (
                  <li
                    key={p.id}
                    role="option"
                    aria-selected={form.proveedorId === p.id}
                    onMouseDown={(e) => { e.preventDefault(); handleProvSelect(p.id, p.nombre) }}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer
                                text-sm transition-colors select-none
                                ${form.proveedorId === p.id
                                  ? 'bg-blue-600/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-200'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                  >
                    <span className="truncate">{p.nombre}</span>
                    <span className="ml-3 text-xs text-slate-400 dark:text-slate-500 shrink-0">
                      {p.diasEntrega}d
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Campo: Cantidad ──────────────────────────────── */}
          <div>
            <label
              htmlFor={`${baseId}-cantidad`}
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide"
            >
              Cantidad
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set('cantidadPedida', Math.max(1, form.cantidadPedida - 1))}
                className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700
                           text-slate-600 dark:text-slate-300 text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700
                           active:scale-95 transition-all flex items-center justify-center"
                aria-label="Reducir cantidad"
              >
                −
              </button>
              <input
                id={`${baseId}-cantidad`}
                type="number"
                min="1"
                max="9999"
                value={form.cantidadPedida}
                onChange={(e) => set('cantidadPedida', Math.max(1, Number(e.target.value) || 1))}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl
                           text-center text-[16px] font-bold text-slate-900 dark:text-slate-100 py-3
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => set('cantidadPedida', form.cantidadPedida + 1)}
                className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700
                           text-slate-600 dark:text-slate-300 text-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700
                           active:scale-95 transition-all flex items-center justify-center"
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>
          </div>

          {/* ── Campo: Contacto cliente (solo si tipo = Nuevo) ── */}
          {form.tipo === 'Nuevo' && (
            <div>
              <label
                htmlFor={`${baseId}-contacto`}
                className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide"
              >
                Contacto del cliente
                <span className="ml-1.5 text-slate-400 dark:text-slate-600 normal-case font-normal">(opcional)</span>
              </label>
              <input
                id={`${baseId}-contacto`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Número de WhatsApp o nombre"
                value={form.contactoCliente}
                onChange={(e) => set('contactoCliente', e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3.5
                           text-slate-900 dark:text-slate-100 text-[16px] placeholder:text-slate-400 dark:placeholder:text-slate-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-shadow"
                disabled={submitting}
              />
            </div>
          )}

          {/* ── Campos extra (colapsables) ───────────────────── */}
          <button
            type="button"
            onClick={() => setShowExtra((v) => !v)}
            className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300
                       transition-colors self-start"
          >
            <span
              className={`transition-transform duration-200 ${showExtra ? 'rotate-90' : ''}`}
            >
              ▶
            </span>
            {showExtra ? 'Ocultar campos extra' : 'Agregar notas o precio estimado'}
          </button>

          {showExtra && (
            <div className="flex flex-col gap-4">
              {/* Notas */}
              <div>
                <label
                  htmlFor={`${baseId}-notas`}
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide"
                >
                  Notas internas
                </label>
                <textarea
                  id={`${baseId}-notas`}
                  rows={2}
                  placeholder="Talla, color, referencia, urgencia..."
                  value={form.notas}
                  onChange={(e) => set('notas', e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3
                             text-slate-900 dark:text-slate-100 text-[16px] placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          {/* ── Error de validación ──────────────────────────── */}
          {submitError && (
            <p className="text-red-600 dark:text-red-400 text-sm bg-red-500/10 border border-red-500/30
                          rounded-lg px-4 py-3">
              {submitError}
            </p>
          )}

          {/* ── Botón submit ─────────────────────────────────── */}
          <button
            type="submit"
            disabled={submitting || !ac.query.trim()}
            className="w-full py-4 rounded-xl font-semibold text-base
                       bg-blue-600 text-white
                       hover:bg-blue-500 active:scale-[0.98]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all shadow-lg shadow-blue-900/30"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30
                                 border-t-white animate-spin" />
                Registrando...
              </span>
            ) : (
              'Registrar faltante'
            )}
          </button>
        </form>

        {/* ── Toast de éxito ───────────────────────────────── */}
        {successMsg && (
          <div
            className="mt-4 flex items-center gap-3 px-4 py-3.5 rounded-xl
                       bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400
                       text-sm card-enter"
          >
            <span className="text-lg">✓</span>
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* ── Historial rápido ─────────────────────────────── */}
        <RecienRegistradas />
      </div>
    </div>
  )
}

// ── Sub-componente: últimas solicitudes registradas hoy ───────

function RecienRegistradas() {
  const solicitudes = useKanbanStore((s) => s.byEstado.solicitudes)

  const hoy = new Date().toDateString()
  const recientes = solicitudes
    .filter((s) => new Date(s.creadoEn).toDateString() === hoy)
    .slice(0, 5)

  if (recientes.length === 0) return null

  return (
    <div className="mt-8">
      <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
        Registradas hoy
      </h3>
      <ul className="flex flex-col gap-2">
        {recientes.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between px-4 py-3
                       bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  s.tipo === 'Agotado'
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                    : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                }`}
              >
                {s.tipo}
              </span>
              <span className="text-slate-700 dark:text-slate-300 text-sm truncate">{s.productoNombre}</span>
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-sm font-mono ml-3 shrink-0">
              ×{s.cantidadPedida}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
