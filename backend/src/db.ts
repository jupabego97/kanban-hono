import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno')
}

const sql = postgres(process.env.DATABASE_URL, {
  // Railway PostgreSQL requiere SSL en producción
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,

  max: 10,              // pool máximo de conexiones
  idle_timeout: 30,     // cierra conexiones idle después de 30s
  connect_timeout: 10,  // timeout de conexión en segundos

  // Transforma snake_case de la DB → camelCase en JS automáticamente
  transform: {
    column: {
      from: postgres.toCamel,
      to:   postgres.fromCamel,
    },
  },

  onnotice: () => {},   // silencia NOTICEs de PostgreSQL en los logs
})

export default sql
