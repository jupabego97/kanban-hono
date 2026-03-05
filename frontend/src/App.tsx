import { useEffect } from 'react'
import { useKanbanStore } from '@/store/kanban'
import { useSSE } from '@/hooks/useSSE'

import { FormMostrador } from '@/components/FormMostrador'
import { KanbanBoard }   from '@/components/KanbanBoard'

export default function App() {
  const { fetchAll, fetchProveedores, loading, error, vista, setVista, clearError, tema, setTema } =
    useKanbanStore()

  // Conectar SSE — una sola instancia en la raíz de la app
  useSSE()

  // Carga inicial de datos
  useEffect(() => {
    fetchAll()
    fetchProveedores()
  }, [fetchAll, fetchProveedores])

  // Aplicar clase dark en <html> al montar y cuando cambia el tema
  useEffect(() => {
    if (tema === 'oscuro') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [tema])

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Barra de navegación */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h1 className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Kanban Compras
        </h1>

        <nav className="flex items-center gap-1">
          <button
            onClick={() => setVista('mostrador')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              vista === 'mostrador'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Mostrador
          </button>
          <button
            onClick={() => setVista('kanban')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              vista === 'kanban'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Kanban
          </button>

          {/* Toggle modo oscuro/día */}
          <button
            onClick={() => setTema(tema === 'oscuro' ? 'dia' : 'oscuro')}
            title={tema === 'oscuro' ? 'Cambiar a modo día' : 'Cambiar a modo oscuro'}
            className="ml-1 w-8 h-8 flex items-center justify-center rounded-md text-base
                       text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800
                       transition-colors"
          >
            {tema === 'oscuro' ? '☀' : '☾'}
          </button>
        </nav>
      </header>

      {/* Error global */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="font-bold hover:text-red-800 dark:hover:text-red-200">✕</button>
        </div>
      )}

      {/* Contenido principal */}
      <main className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500 text-sm">
            Cargando datos...
          </div>
        ) : vista === 'mostrador' ? (
          <FormMostrador />
        ) : (
          <KanbanBoard />
        )}
      </main>
    </div>
  )
}
