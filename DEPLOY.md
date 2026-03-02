# Deploy en Railway — Guía paso a paso

## Pre-requisitos
- Cuenta en [railway.app](https://railway.app)
- CLI de Railway: `npm install -g @railway/cli` → `railway login`
- Bun >= 1.1 instalado localmente
- Node >= 20 instalado localmente

---

## 1. Generar íconos PWA (una sola vez)

```bash
cd frontend
npm install --save-dev sharp
node generate-icons.mjs
# → Genera public/icon-192.png, public/icon-512.png, public/favicon.ico
```

Agrega los PNGs al repo:
```bash
git add frontend/public/icon-192.png frontend/public/icon-512.png frontend/public/favicon.ico
git commit -m "chore: add PWA icons"
```

---

## 2. Preparar el repositorio

```bash
cd kanban-hono
git init        # si aún no existe
git add .
git commit -m "feat: initial kanban-hono monorepo"
git remote add origin https://github.com/tu-usuario/kanban-hono.git
git push -u origin main
```

---

## 3. Crear proyecto en Railway

En [railway.app](https://railway.app):
1. **New Project** → **Deploy from GitHub repo** → selecciona `kanban-hono`
2. Railway detecta el repo como monorepo

---

## 4. Agregar PostgreSQL

1. En el proyecto: **+ New** → **Database** → **PostgreSQL**
2. Railway crea la instancia y genera `DATABASE_URL` automáticamente
3. Conectarse y ejecutar el schema:

```bash
# Desde tu máquina local con Railway CLI
railway run --service postgres psql $DATABASE_URL -f schema.sql
```

O desde el panel de Railway → PostgreSQL → **Query** → pegar el contenido de `schema.sql`.

---

## 5. Configurar el servicio Backend

1. **+ New** → **GitHub Repo** → selecciona `kanban-hono` → **Root Directory: `backend`**
2. Railway detecta `nixpacks.toml` y usa Bun automáticamente
3. En **Variables**, agregar:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | _(se obtiene después de crear el frontend)_ |

> `DATABASE_URL` se inyecta automáticamente desde el plugin de PostgreSQL.

4. Una vez desplegado, copiar la URL pública del backend (ej: `https://kanban-backend.railway.app`)

---

## 6. Configurar el servicio Frontend

1. **+ New** → **GitHub Repo** → selecciona `kanban-hono` → **Root Directory: `frontend`**
2. En **Variables**, agregar:

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://kanban-backend.railway.app` _(URL del paso anterior, sin barra final)_ |

3. Railway ejecuta `npm ci && npm run build` y sirve `/dist` con `serve`

---

## 7. Actualizar FRONTEND_URL en el backend

1. Copiar la URL pública del frontend (ej: `https://kanban-frontend.railway.app`)
2. En el servicio Backend → **Variables** → actualizar `FRONTEND_URL`
3. Railway reinicia el backend automáticamente

---

## 8. Verificar deploy

```bash
# Health check del backend
curl https://kanban-backend.railway.app/health

# Respuesta esperada:
# { "status": "ok", "service": "kanban-hono-backend", "ts": "...", "sse_clients": 0 }

# API de solicitudes
curl https://kanban-backend.railway.app/api/solicitudes | head -c 200
```

---

## Desarrollo local

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env   # editar DATABASE_URL
bun dev                # http://localhost:3000

# Terminal 2 — Frontend
cd frontend
npm run dev            # http://localhost:5173
# El proxy de Vite redirige /api → localhost:3000 automáticamente
```

---

## Estructura de servicios en Railway

```
Proyecto Railway
├── PostgreSQL          ← Plugin nativo (DATABASE_URL automática)
├── kanban-backend      ← Hono + Bun (root: /backend)
└── kanban-frontend     ← Vite SPA + serve (root: /frontend)
```

---

## Notas importantes

- **`VITE_API_URL`** se embebe en el bundle en tiempo de BUILD. Si cambias la URL del backend, debes re-deployar el frontend.
- El SSE (`/api/solicitudes/stream`) funciona en Railway sin configuración extra gracias al header `X-Accel-Buffering: no`.
- Railway cierra conexiones inactivas > 60s; el keep-alive de 25s en el backend previene esto.
