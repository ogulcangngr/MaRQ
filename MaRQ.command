#!/bin/sh
# Start MaRQ on macOS (double-click this file) or Linux (sh MaRQ.sh in a terminal).
# It serves this folder on 127.0.0.1 and opens MaRQ in its own window; MaRQ stops when that
# window is closed (or when this one is), and on macOS this Terminal window then closes too.
cd "$(dirname "$0")" || exit 1

pause() { printf '\nPress Enter to close this window.'; read -r _; exit 1; }

# A double-clicked .command file runs in a Terminal window of its own, titled here; it is closed
# once MaRQ has stopped. Started as MaRQ.sh (Linux, or a terminal of your own), nothing is closed.
TITLE="MaRQ - close this window to stop MaRQ"
done_close() {
  status=$1
  case "$0" in *.command) ;; *) exit "$status" ;; esac
  if [ "$(uname -s)" = Darwin ] && [ "$status" -eq 0 ]; then
    ( sleep 0.5; osascript -e "tell application \"Terminal\" to close (every window whose name contains \"close this window to stop MaRQ\")" ) >/dev/null 2>&1 &
  fi
  exit "$status"
}
case "$0" in *.command) printf '\033]0;%s\007' "$TITLE" ;; esac

if [ ! -f index.html ] || [ ! -f worker.js ]; then
  echo "The MaRQ files (index.html, worker.js) are not in this folder:"
  echo "  $(pwd)"
  echo "Extract the downloaded zip file first, then start MaRQ from the extracted folder."
  echo "(On macOS, if Terminal asked for access to this folder, answer OK and start MaRQ again.)"
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
    "launchers/$bin" "$@"
    done_close $?
  fi
  echo "The bundled launcher (launchers/$bin) could not run on this system; trying Python instead."
fi

for py in python3 python; do
  # on a Mac without the developer tools, /usr/bin/python3 only offers to install them
  if [ "$(uname -s)" = Darwin ] && [ "$(command -v "$py")" = "/usr/bin/$py" ] && ! xcode-select -p >/dev/null 2>&1; then
    continue
  fi
  if command -v "$py" >/dev/null 2>&1 && "$py" -c "import sys; sys.exit(sys.version_info < (3, 7))" 2>/dev/null; then
    "$py" run_marq.py "$@" || pause
    done_close 0
  fi
done

echo "MaRQ could not start: the bundled launcher does not run on this system and Python 3"
echo "was not found. Install Python 3 (https://www.python.org/downloads/) and start MaRQ again,"
echo "or use any static file server in this folder and open its address in the browser."
pause
