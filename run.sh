#!/usr/bin/env bash
# Запуск локального бэкенда со сторонним OWL 2 RL ризонером (owlrl).
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

# Если есть локальное окружение .venv — используем его
if [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
  "$PY" -m pip install -q -r requirements.txt
else
  PY="python3"
  python3 -m pip install -q -r requirements.txt
fi

echo "Сервер: http://127.0.0.1:${PORT}"
exec "$PY" -m uvicorn app:app --host 127.0.0.1 --port "${PORT}"
