#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ALGATWIN_PYTHON:-python3}"

cleanup() {
  if [[ -n "${MODEL_API_PID:-}" ]]; then
    kill "$MODEL_API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ -f "$PROJECT_ROOT/model-api/.env" ]]; then
  set -a
  source "$PROJECT_ROOT/model-api/.env"
  set +a
fi

if [[ ! -d "$PROJECT_ROOT/frontend/node_modules" ]]; then
  (cd "$PROJECT_ROOT/frontend" && npm install)
fi

(
  cd "$PROJECT_ROOT/model-api"
  PYTHONPATH=. "$PYTHON_BIN" -m uvicorn alga_twin_api.main:app --host 127.0.0.1 --port 8000
) &
MODEL_API_PID=$!

cd "$PROJECT_ROOT/frontend"
npm run dev -- --host 127.0.0.1
