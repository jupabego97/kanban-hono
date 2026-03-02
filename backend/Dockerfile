# ============================================================
# Imagen oficial de Bun — Railway la detecta automáticamente
# ============================================================
FROM oven/bun:latest AS base
WORKDIR /app

# Instalar dependencias
COPY package.json bun.lock ./
RUN bun install

# Copiar código fuente
COPY src/       ./src/
COPY tsconfig.json ./

# Puerto expuesto (Railway inyecta $PORT en runtime)
EXPOSE 3000

ENV NODE_ENV=production

# Arrancar directamente con Bun (sin compilar — Bun ejecuta TypeScript nativo)
CMD ["bun", "src/index.ts"]
