#!/bin/bash
set -e

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        InsightFlow AI — v1.0         ║"
echo "  ║   Premium Predictive Intelligence    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

ROOT="$(cd "$(dirname "$0")" && pwd)"

# --- Backend ---
echo "▸ Starting backend..."
cd "$ROOT/backend"
/opt/homebrew/bin/python3.13 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID (http://localhost:8000)"

# --- Frontend ---
echo "▸ Starting frontend..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "  Installing frontend dependencies..."
  npm install
fi

npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "  ✓ InsightFlow AI is running"
echo "  → Open: http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

cleanup() {
  echo ""
  echo "  Shutting down InsightFlow AI..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM
wait
