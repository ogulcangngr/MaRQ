"""Start MaRQ locally: serves this folder over HTTP and opens MaRQ in its own window (the
application mode of Chrome or Edge), or in a browser tab when neither is installed.

    python run_marq.py            # picks a free port from 8000 upward
    python run_marq.py 8080       # a specific port
    python run_marq.py --tab      # a browser tab instead of a window
    python run_marq.py --stay     # keep running after the last MaRQ window has closed

MaRQ stops a few seconds after its last window has closed (every MaRQ page says it is alive
every 20 s and goodbye when it closes).

If MaRQ already runs from this folder, a second start opens a window to it instead of a
second server (the browser keeps the settings per address, so they stay).

Nothing is installed and nothing leaves the computer; the server only hands the
browser the files of this folder. With the vendor/ bundle present the application
runs without an internet connection. Stop with Ctrl+C.
"""
import http.server
import json
import mimetypes
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import webbrowser

VERSION = "1.0"

HERE = os.path.dirname(os.path.abspath(__file__))
mimetypes.add_type("application/wasm", ".wasm")          # so the browser can stream-compile Pyodide

# Content types are fixed here and checked before the system's own table: on some Windows
# machines the registry maps .js to text/plain, and browsers then refuse to start the
# analysis worker.
TYPES = {
    ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
    ".png": "image/png", ".ico": "image/x-icon", ".wasm": "application/wasm",
    ".py": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8", ".zip": "application/zip",
    ".whl": "application/octet-stream", ".tar": "application/x-tar",
    ".data": "application/octet-stream", ".x3p": "application/octet-stream",
}


class Pages:
    """The open MaRQ windows, for the automatic stop."""
    def __init__(self):
        self.lock, self.seen, self.ever, self.empty = threading.Lock(), {}, False, None

    def alive(self, pid):
        with self.lock:
            self.seen[pid] = time.time(); self.ever = True

    def bye(self, pid):
        with self.lock:
            self.seen.pop(pid, None)

    def watch(self, grace=4):
        """Returns once no page has been open for grace seconds (a page silent for five
        minutes without a goodbye, a crashed browser, is dropped)."""
        while True:
            time.sleep(1)
            with self.lock:
                now = time.time()
                for k in [k for k, t in self.seen.items() if now - t > 300]:
                    del self.seen[k]
                if not self.ever or self.seen:
                    self.empty = None
                elif self.empty is None:
                    self.empty = now
                elif now - self.empty >= grace:
                    return


PAGES = Pages()


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = TYPES

    def do_POST(self):
        port = self.server.server_address[1]
        path, _, query = self.path.partition("?")
        if self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}") and path in ("/__alive", "/__bye"):
            pid = urllib.parse.parse_qs(query).get("id", [""])[0][:100]
            if pid:
                (PAGES.alive if path == "/__alive" else PAGES.bye)(pid)
            self.send_response(204)
            self.end_headers()
            return
        self.send_error(405)

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def send_head(self):
        # only requests for this server by its own name (no DNS rebinding), no hidden files, no
        # folder listings, and no "not modified" by date: a folder from an older zip has older
        # dates than the files the browser may hold from another MaRQ on the same port
        port = self.server.server_address[1]
        if self.headers.get("Host") not in (f"127.0.0.1:{port}", f"localhost:{port}"):
            self.send_error(403)
            return None
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path == "/__marq":
            body = json.dumps({"app": "MaRQ", "version": VERSION, "dir": HERE}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return None
        if any(seg.startswith(".") or "\\" in seg for seg in path.split("/")):
            self.send_error(404)
            return None
        if path != "/" and os.path.isdir(self.translate_path(path)):
            self.send_error(404)
            return None
        del self.headers["If-Modified-Since"]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")     # always pick up edited files
        super().end_headers()

    def log_message(self, fmt, *args):                    # quiet: one line per request is noise
        if "404" in (str(args[1]) if len(args) > 1 else ""):
            sys.stderr.write("  missing: %s\n" % args[0])


def running_marq(port):
    """The address of a MaRQ that serves this same folder on the port, or None."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/__marq", timeout=1.5) as r:
            ident = json.loads(r.read(8192))
    except Exception:
        return None
    same = os.path.normcase(os.path.normpath(str(ident.get("dir", "")))) == os.path.normcase(os.path.normpath(HERE))
    return f"http://127.0.0.1:{port}/" if ident.get("app") == "MaRQ" and same else None


class Server(http.server.ThreadingHTTPServer):
    """One server per port. On Windows the address reuse that http.server asks for lets a second
    server take a port that is in use, so a second start would not find the MaRQ already
    running; there the port is taken exclusively instead."""
    allow_reuse_address = sys.platform != "win32"

    def server_bind(self):
        if sys.platform == "win32" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def serve(port):
    """A server on the port, or on the first free port from 8000 up; or the address of the
    MaRQ that already serves this folder."""
    if port:
        return Server(("127.0.0.1", port), Handler), None
    for p in range(8000, 8050):
        try:
            return Server(("127.0.0.1", p), Handler), None
        except OSError:
            url = running_marq(p)
            if url:
                return None, url
    return Server(("127.0.0.1", 0), Handler), None


def browsers():
    """Browsers that can show a page as an application window, in order of preference."""
    if sys.platform == "darwin":
        home = os.path.expanduser("~")
        return [os.path.join(d, f"{app}.app") for app in ("Google Chrome", "Microsoft Edge", "Chromium", "Brave Browser")
                for d in ("/Applications", os.path.join(home, "Applications"))]
    if sys.platform == "win32":
        bases = [os.environ.get(v) for v in ("ProgramFiles", "ProgramFiles(x86)", "LocalAppData")]
        return [os.path.join(b, r) for r in (r"Google\Chrome\Application\chrome.exe", r"Microsoft\Edge\Application\msedge.exe",
                                             r"BraveSoftware\Brave-Browser\Application\brave.exe", r"Chromium\Application\chrome.exe")
                for b in bases if b]
    return [shutil.which(b) for b in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
                                      "microsoft-edge", "microsoft-edge-stable", "brave-browser")]


def open_window(url):
    """MaRQ in a window of its own (the application mode of Chrome or Edge); False when
    neither is installed, and the caller opens a browser tab instead."""
    args = [f"--app={url}", "--start-maximized", "--no-first-run", "--no-default-browser-check"]
    # on macOS and Linux the browser gets a session of its own: Ctrl+C here stops MaRQ, not it
    detach = {} if sys.platform == "win32" else {"start_new_session": True}
    for exe in browsers():
        if exe and os.path.exists(exe):
            cmd = ["open", "-na", exe, "--args", *args] if sys.platform == "darwin" else [exe, *args]
            subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **detach)
            return True
    return False


USAGE = "Usage: python run_marq.py [port] [--tab] [--stay]"


def main():
    if not (os.path.exists(os.path.join(HERE, "index.html")) and os.path.exists(os.path.join(HERE, "worker.js"))):
        raise SystemExit("The MaRQ files (index.html, worker.js) are not next to run_marq.py; "
                         "extract the downloaded zip first and start MaRQ from the extracted folder.")
    port, tab, stay = 0, bool(os.environ.get("MARQ_BROWSER_TAB")), False
    for a in sys.argv[1:]:
        if a == "--tab":
            tab = True
        elif a == "--stay":
            stay = True
        elif a in ("-h", "--help"):
            print(f"MaRQ {VERSION}: serves the MaRQ folder on 127.0.0.1 and opens MaRQ in its own window.\n{USAGE}")
            return
        elif a.isdigit() and 0 < int(a) < 65536:
            port = int(a)
        else:
            raise SystemExit(f"Unknown argument: {a}\n{USAGE}")
    try:
        server, running = serve(port)
    except OSError as e:
        raise SystemExit(f"Port {port} is in use or not allowed ({e}); start MaRQ without a port number.")
    if running:
        print(f"MaRQ is already running from this folder, at {running}; a new MaRQ window opens.")
        if not os.environ.get("MARQ_NO_BROWSER"):
            (not tab and open_window(running)) or webbrowser.open(running)
        return
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    bundled = os.path.exists(os.path.join(HERE, "vendor", "pyodide", "pyodide.js"))
    print(f"MaRQ {VERSION}, the Microchannel and Replication Quality Analyzer\n")
    print(f"  MaRQ is running at   {url}")
    print(f"  Folder               {HERE}")
    print("  Runtime              " + ("local bundle (works offline)" if bundled else
                                     "vendor/ not found: Plotly and Pyodide come from the internet"))
    auto = not stay and not os.environ.get("MARQ_NO_BROWSER")     # tests keep their server
    grace = 4
    if os.environ.get("MARQ_AUTOSTOP", "").isdigit() and int(os.environ["MARQ_AUTOSTOP"]) > 0:
        auto, grace = not stay, int(os.environ["MARQ_AUTOSTOP"])  # MARQ_AUTOSTOP=seconds tests the stop
    if auto:
        print("\n  MaRQ stops when its last window is closed; closing this window (or Ctrl+C)")
        print("  stops it too.\n")

        def stop_when_closed():
            PAGES.watch(grace)
            print("MaRQ stopped: its last window was closed.")
            threading.Thread(target=server.shutdown, daemon=True).start()
        threading.Thread(target=stop_when_closed, daemon=True).start()
    else:
        print("\n  Keep this window open while you use MaRQ; close it (or press Ctrl+C) to stop MaRQ.\n")
    if not os.environ.get("MARQ_NO_BROWSER"):                # tests start the server alone
        threading.Timer(0.6, lambda: (not tab and open_window(url)) or webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nMaRQ stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    if sys.version_info < (3, 7):
        raise SystemExit("MaRQ needs Python 3.7 or newer.")
    main()
