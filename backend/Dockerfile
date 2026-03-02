# ============================================================
# Imagen oficial de Bun — Railway la detecta automáticamente
# ============================================================
FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Instalar dependencias (bun.lock garantiza versiones reproducibles)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copiar código fuente
COPY src/       ./src/
COPY tsconfig.json ./

# Puerto expuesto (Railway inyecta $PORT en runtime)
EXPOSE 3000

ENV NODE_ENV=production

# Arrancar directamente con Bun (sin compilar — Bun ejecuta TypeScript nativo)
CMD ["bun", "src/index.ts"]
