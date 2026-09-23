#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

python_command="python3.12"
if ! command -v "$python_command" >/dev/null 2>&1; then
  python_command="python3"
fi

if [[ ! -d backend/.venv ]]; then
  "$python_command" -m venv backend/.venv
fi

backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -e 'backend[dev]'
npm --prefix frontend install

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

echo "Setup complete. See README.md for the two development commands."
