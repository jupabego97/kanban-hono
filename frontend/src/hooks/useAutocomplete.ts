import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import type { ProductoCatalogo } from '@/lib/types'

const DEBOUNCE_MS = 250

// ============================================================
// useAutocomplete
// Maneja búsqueda debounced, navegación por teclado y
// pre-carga de resultados al hacer foco por primera vez.
// ============================================================
export function useAutocomplete(onSelect: (item: ProductoCatalogo) => void) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<ProductoCatalogo[]>([])
  const [isOpen, setIsOpen]         = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading]       = useState(false)

  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preloadedRef  = useRef<ProductoCatalogo[]>([])  // caché para query vacía
  const containerRef  = useRef<HTMLDivElement>(null)

  // ── Pre-carga al primer foco (query vacía → lista inicial) ──
  const preload = useCallback(async () => {
    if (preloadedRef.current.length > 0) {
      setResults(preloadedRef.current)
      setIsOpen(true)
      return
    }
    try {
      const data = await api.catalogo.buscar('', 15)
      preloadedRef.current = data
      setResults(data)
      setIsOpen(data.length > 0)
    } catch {}
  }, [])

  // ── Búsqueda debounced cuando cambia query ──────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length === 0) {
      // Mostrar lista pre-cargada si existe
      if (preloadedRef.current.length > 0) {
        setResults(preloadedRef.current)
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
      setActiveIndex(-1)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.catalogo.buscar(query.trim(), 10)
        setResults(data)
        setIsOpen(data.length > 0)
        setActiveIndex(-1)
      } catch {
        setIsOpen(false)
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // ── Click fuera del contenedor cierra el dropdown ──────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Seleccionar un ítem del dropdown ───────────────────────
  const select = useCallback(
    (item: ProductoCatalogo) => {
      setQuery(item.nombre)
      setIsOpen(false)
      setActiveIndex(-1)
      onSelect(item)
    },
    [onSelect],
  )

  // ── Navegación con teclado ─────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || results.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, results.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && results[activeIndex]) {
            select(results[activeIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          setActiveIndex(-1)
          break
        case 'Tab':
          // Tab selecciona el primero si hay resultados
          if (activeIndex === -1 && results[0]) {
            select(results[0])
          } else if (activeIndex >= 0 && results[activeIndex]) {
            select(results[activeIndex])
          }
          break
      }
    },
    [isOpen, results, activeIndex, select],
  )

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setActiveIndex(-1)
  }, [])

  return {
    query,
    setQuery,
    results,
    isOpen,
    activeIndex,
    loading,
    containerRef,
    preload,
    select,
    handleKeyDown,
    clear,
  }
}
