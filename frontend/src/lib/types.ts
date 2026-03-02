// ============================================================
// Tipos compartidos del frontend
// Deben mantenerse sincronizados con backend/src/types.ts
// ============================================================

export type TipoSolicitud = 'Agotado' | 'Nuevo'

export type EstadoSolicitud =
  | 'solicitudes'
  | 'analisis'
  | 'por_pedir'
  | 'en_camino'
  | 'recibido'

export const ESTADOS: EstadoSolicitud[] = [
  'solicitudes',
  'analisis',
  'por_pedir',
  'en_camino',
  'recibido',
]

// Etiquetas legibles para cada columna
export const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
  solicitudes: 'Nuevas Solicitudes',
  analisis:    'En Análisis / Cotización',
  por_pedir:   'Lista de Compras',
  en_camino:   'Pedido Realizado',
  recibido:    'Recibido / Avisar Cliente',
}

// Colores Tailwind v4 para cada columna (borde + badge)
export const ESTADO_COLORS: Record<EstadoSolicitud, { border: string; bg: string; text: string }> = {
  solicitudes: { border: 'border-blue-500',   bg: 'bg-blue-500/10',   text: 'text-blue-400'   },
  analisis:    { border: 'border-amber-500',   bg: 'bg-amber-500/10',  text: 'text-amber-400'  },
  por_pedir:   { border: 'border-violet-500',  bg: 'bg-violet-500/10', text: 'text-violet-400' },
  en_camino:   { border: 'border-cyan-500',    bg: 'bg-cyan-500/10',   text: 'text-cyan-400'   },
  recibido:    { border: 'border-green-500',   bg: 'bg-green-500/10',  text: 'text-green-400'  },
}

export interface Proveedor {
  id:          number
  nombre:      string
  diasEntrega: number
  telefono:    string | null
  creadoEn:    string
}

export interface ProductoCatalogo {
  id:              number
  nombre:          string
  proveedorId:     number | null
  proveedorNombre: string | null
}

export interface Solicitud {
  id:               string
  productoNombre:   string
  tipo:             TipoSolicitud
  proveedorId:      number | null
  cantidadPedida:   number
  estado:           EstadoSolicitud
  contactoCliente:  string | null
  notas:            string | null
  precioEstimado:   string | null
  ordenColumna:     number
  creadoEn:         string
  actualizadoEn:    string
  // Join
  proveedorNombre?:   string | null
  diasEntrega?:       number | null
  proveedorTelefono?: string | null
}

export interface CrearSolicitudBody {
  productoNombre:   string
  tipo:             TipoSolicitud
  proveedorId?:     number | null
  cantidadPedida?:  number
  contactoCliente?: string | null
  notas?:           string | null
  precioEstimado?:  number | null
}

export interface SSEEvent {
  event: 'created' | 'updated' | 'deleted' | 'reordered' | 'ping'
  data:  Solicitud | { id: string } | Array<{ id: string; ordenColumna: number }> | null
}
