#!/bin/sh
# Start MaRQ (macOS: double-click; Linux: sh MaRQ.command). Serves this folder locally and opens the browser.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 run_marq.py "$@"
elif command -v python >/dev/null 2>&1; then
  python run_marq.py "$@"
else
  echo "Python 3 was not found. Install it, or start any static file server in this folder and open its address."
  read -r _
fi
