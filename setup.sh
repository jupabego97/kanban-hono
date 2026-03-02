#!/usr/bin/env bash
# ============================================================
# KANBAN COMPRAS — Setup Script
# Ejecutar desde la raíz del proyecto: bash setup.sh
# Requisitos: Bun >= 1.1, Node >= 20 (para el frontend)
# ============================================================

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║    Kanban Compras — Setup Monorepo   ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── BACKEND ──────────────────────────────────────────────────
echo "▶ [1/4] Instalando dependencias del backend (Bun)..."
cd backend
bun install
cp -n .env.example .env 2>/dev/null || true
echo "   ✓ Backend listo"
cd ..

# ── FRONTEND ─────────────────────────────────────────────────
echo "▶ [2/4] Instalando dependencias del frontend (npm)..."
cd frontend
npm install
cp -n .env.example .env 2>/dev/null || true
echo "   ✓ Frontend listo"
cd ..

# ── GIT ──────────────────────────────────────────────────────
echo "▶ [3/4] Inicializando git (si no existe)..."
if [ ! -d ".git" ]; then
  git init
  git add .
  git commit -m "chore: initial kanban-hono monorepo setup"
  echo "   ✓ Git inicializado"
else
  echo "   · Git ya existe, saltando"
fi

echo ""
echo "▶ [4/4] Setup completado."
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  PRÓXIMOS PASOS                                      ║"
echo "║                                                      ║"
echo "║  1. Edita backend/.env con tu DATABASE_URL           ║"
echo "║  2. Ejecuta el schema.sql en tu PostgreSQL:          ║"
echo "║     psql \$DATABASE_URL -f ../schema.sql              ║"
echo "║                                                      ║"
echo "║  Para desarrollo local:                              ║"
echo "║    Terminal 1 → cd backend && bun dev               ║"
echo "║    Terminal 2 → cd frontend && npm run dev          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
