#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ ! -x backend/.venv/bin/python ]]; then
  echo "backend/.venv is missing; run ./scripts/setup.sh first" >&2
  exit 1
fi

backend/.venv/bin/python -m ruff check backend
backend/.venv/bin/python -m pytest backend/tests
npm --prefix frontend run lint
npm --prefix frontend run build

echo "All checks passed."
