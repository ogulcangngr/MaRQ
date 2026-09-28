"""Start MaRQ locally: serves this folder over HTTP and opens the browser.

    python run_marq.py            # picks a free port from 8000 upward
    python run_marq.py 8080       # a specific port

Nothing is installed and nothing leaves the computer; the server only hands the
browser the files of this folder. With the vendor/ bundle present the application
runs without an internet connection. Stop with Ctrl+C.
"""
import http.server
import mimetypes
import os
import socket
import sys
import threading
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
mimetypes.add_type("application/wasm", ".wasm")          # so the browser can stream-compile Pyodide
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/octet-stream", ".whl")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")     # always pick up edited files
        super().end_headers()

    def log_message(self, fmt, *args):                    # quiet: one line per request is noise
        if "404" in (args[1] if len(args) > 1 else ""):
            sys.stderr.write("  missing: %s\n" % args[0])


def free_port(start):
    for port in range(start, start + 50):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise SystemExit("no free port found")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else free_port(8000)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    bundled = os.path.exists(os.path.join(HERE, "vendor", "pyodide", "pyodide.js"))
    print(f"MaRQ is served at {url}")
    print("Runtime: " + ("local bundle (works offline)" if bundled else
                         "vendor/ not found, Plotly and Pyodide will come from their CDNs (internet needed)"))
    print("Press Ctrl+C in this window to stop.")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
