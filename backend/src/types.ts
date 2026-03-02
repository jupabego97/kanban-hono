// ============================================================
// Tipos compartidos — reflejan el schema.sql exactamente
// ============================================================

export type TipoSolicitud = 'Agotado' | 'Nuevo'

export type EstadoSolicitud =
  | 'solicitudes'
  | 'analisis'
  | 'por_pedir'
  | 'en_camino'
  | 'recibido'

export const ESTADOS_VALIDOS: EstadoSolicitud[] = [
  'solicitudes',
  'analisis',
  'por_pedir',
  'en_camino',
  'recibido',
]

export interface Proveedor {
  id:           number
  nombre:       string
  diasEntrega:  number
  telefono:     string | null
  creadoEn:     string
}

export interface ProductoCatalogo {
  id:           number
  nombre:       string
  proveedorId:  number | null
  activo:       boolean
  creadoEn:     string
  // join con proveedores (opcional)
  proveedorNombre?: string | null
}

export interface Solicitud {
  id:               string    // UUID
  productoNombre:   string
  tipo:             TipoSolicitud
  proveedorId:      number | null
  cantidadPedida:   number
  estado:           EstadoSolicitud
  contactoCliente:  string | null
  notas:            string | null
  precioEstimado:   string | null  // NUMERIC viene como string en postgres.js
  ordenColumna:     number
  creadoEn:         string
  actualizadoEn:    string
  // join con proveedores
  proveedorNombre?:   string | null
  diasEntrega?:       number | null
  proveedorTelefono?: string | null
}

// Payloads de entrada (validación manual, sin Zod para mantener ligereza)
export interface CrearSolicitudBody {
  productoNombre:  string
  tipo:            TipoSolicitud
  proveedorId?:    number | null
  cantidadPedida?: number
  contactoCliente?: string | null
  notas?:          string | null
  precioEstimado?: number | null
}

export interface ActualizarEstadoBody {
  estado:        EstadoSolicitud
  ordenColumna?: number
}

export interface ReordenarBody {
  items: Array<{ id: string; ordenColumna: number }>
}

// Evento SSE — mismo shape en frontend y backend
export interface SSEEvent {
  event: 'created' | 'updated' | 'deleted' | 'reordered' | 'ping'
  data:  Solicitud | { id: string } | Array<{ id: string; ordenColumna: number }> | null
}
