#!/bin/sh
# Start MaRQ on macOS (double-click this file) or Linux (sh MaRQ.sh in a terminal).
# It serves this folder on 127.0.0.1 and opens the browser; close this window to stop MaRQ.
cd "$(dirname "$0")" || exit 1

pause() { printf '\nPress Enter to close this window.'; read -r _; exit 1; }

if [ ! -f index.html ] || [ ! -f worker.js ]; then
  echo "The MaRQ files (index.html, worker.js) are not in this folder:"
  echo "  $(pwd)"
  echo "Extract the downloaded zip file first, then start MaRQ from the extracted \"software\" folder."
  pause
fi

case "$(uname -s)" in
  Darwin)
    # Files downloaded with a browser carry the quarantine flag, which stops the bundled
    # launcher from running; clear it on this folder only.
    xattr -dr com.apple.quarantine . 2>/dev/null
    case "$(uname -m)" in arm64) bin=marq-macos-arm64 ;; x86_64) bin=marq-macos-x64 ;; *) bin= ;; esac ;;
  Linux)
    case "$(uname -m)" in x86_64|amd64) bin=marq-linux-x64 ;; aarch64|arm64) bin=marq-linux-arm64 ;; *) bin= ;; esac ;;
  *) bin= ;;
esac

if [ -n "$bin" ] && [ -f "launchers/$bin" ]; then
  chmod +x "launchers/$bin" 2>/dev/null
  if "launchers/$bin" --help >/dev/null 2>&1; then
    exec "launchers/$bin" "$@"
  fi
  echo "The bundled launcher (launchers/$bin) could not run on this system; trying Python instead."
fi

for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1 && "$py" -c "import sys; sys.exit(sys.version_info[0] != 3)" 2>/dev/null; then
    "$py" run_marq.py "$@" || pause
    exit 0
  fi
done

echo "MaRQ could not start: the bundled launcher does not run on this system and Python 3"
echo "was not found. Install Python 3 (https://www.python.org/downloads/) and start MaRQ again,"
echo "or use any static file server in this folder and open its address in the browser."
pause
