"""Check of a MaRQ launcher as a user starts it, without a browser (continuous integration on
Windows, macOS and Linux): what it serves, that a second start uses the MaRQ already running
from the folder, and that MaRQ stops once its last window has said goodbye.

    python tests/launcher_check.py ./MaRQ.exe          (Windows)
    python tests/launcher_check.py sh MaRQ.command     (macOS)
    python tests/launcher_check.py sh MaRQ.sh          (Linux)
    python tests/launcher_check.py --python            (run_marq.py, the fallback through Python)

The launcher serves a scratch folder holding index.html and worker.js (with --dir, or a copy of
run_marq.py), so it never meets a MaRQ that is already running here. The pages are stood in for
by the requests a MaRQ window sends: /__alive every 20 s, /__bye when it closes. Exit code 0
when everything holds.
"""
import os, re, sys, time, signal, shutil, tempfile, threading, subprocess, http.client

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GRACE = 3                                         # MARQ_AUTOSTOP: seconds after the last goodbye
args = sys.argv[1:]
if not args:
    sys.exit(__doc__)
stub = tempfile.mkdtemp(prefix="marq_launcher_")
for n in ("index.html", "worker.js"):
    shutil.copy2(os.path.join(ROOT, n), stub)
open(os.path.join(stub, ".hidden"), "w").write("not to be served")
if args == ["--python"]:
    shutil.copy2(os.path.join(ROOT, "run_marq.py"), stub)
    cmd = [sys.executable, "-X", "faulthandler", os.path.join(stub, "run_marq.py")]
else:
    cmd = args + ["--dir", stub]
    if cmd[0].lower().endswith(".exe"):
        cmd[0] = os.path.abspath(cmd[0])
results = []


def check(label, good, info=""):
    results.append(bool(good))
    print(f"   {'ok ' if good else 'BAD'} {label}" + (f"   [{info}]" if info else ""), flush=True)


class Run:
    """The launcher in its own process, its output collected as it comes."""
    def __init__(self, **env):
        e = dict(os.environ, MARQ_NO_BROWSER="1", PYTHONUNBUFFERED="1", **env)
        self.p = subprocess.Popen(cmd, cwd=ROOT, env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                  stdin=subprocess.DEVNULL, text=True, encoding="utf-8", errors="replace")
        self.out = []
        threading.Thread(target=lambda: [self.out.append(l) for l in self.p.stdout], daemon=True).start()

    def text(self):
        return "".join(self.out)

    def find(self, pattern, t=30):
        t0 = time.time()
        while time.time() - t0 < t:
            m = re.search(pattern, self.text())
            if m:
                return m
            if self.p.poll() is not None:
                time.sleep(0.3)
                return re.search(pattern, self.text())
            time.sleep(0.2)
        return None

    def ended(self, t):
        try:
            return self.p.wait(t)
        except subprocess.TimeoutExpired:
            return None

    def stop(self):
        if self.p.poll() is None:
            self.p.kill()


def request(port, method, path, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
    c.request(method, path, headers=headers or {})
    r = c.getresponse()
    body = r.read()
    c.close()
    return r.status, dict((k.lower(), v) for k, v in r.getheaders()), body


first = Run(MARQ_AUTOSTOP=str(GRACE))
second = None
try:
    m = first.find(r"http://127\.0\.0\.1:(\d+)/")
    if not m and first.p.poll() is None and os.name != "nt":
        first.p.send_signal(signal.SIGABRT)          # Python (faulthandler) and Go print where they wait
        time.sleep(2)
    check("starts and names its address", m, m.group(0) if m else "output: " + first.text()[-3000:])
    if not m:
        raise SystemExit(1)
    port = int(m.group(1))
    check("says it stops when its last window closes", "when its last window" in first.text())

    st, h, _ = request(port, "GET", "/index.html")
    check("serves index.html", st == 200 and h.get("content-type", "").startswith("text/html"), f"{st} {h.get('content-type')}")
    if "etag" in h:
        st2, _, _ = request(port, "GET", "/index.html", {"If-None-Match": h["etag"]})
        check("content tag: unchanged file not sent again", st2 == 304, st2)
    st, h, _ = request(port, "GET", "/worker.js")
    check("worker.js as JavaScript", st == 200 and "javascript" in h.get("content-type", ""), h.get("content-type"))
    st, _, _ = request(port, "GET", "/.hidden")
    check("hidden files refused", st in (403, 404), st)
    st, _, _ = request(port, "GET", "/index.html", {"Host": "attacker.example"})
    check("other host names refused", st == 403, st)
    st, h, body = request(port, "GET", "/__marq")
    check("identity", st == 200 and b'"MaRQ"' in body, body[:120])

    time.sleep(GRACE + 2)
    check("keeps running before any window has opened", first.p.poll() is None)
    st, _, _ = request(port, "POST", "/__alive?id=check1")
    check("a window says it is alive", st == 204, st)
    time.sleep(GRACE + 2)
    check("keeps running while a window is open", first.p.poll() is None)

    second = Run()
    m2 = second.find(r"already running[^\n]*?(http://127\.0\.0\.1:\d+/)", 20)
    code2 = second.ended(20)
    check("a second start uses the MaRQ already running", m2 and m2.group(1) == f"http://127.0.0.1:{port}/" and code2 == 0,
          f"exit {code2}: " + second.text().strip()[-200:])
    check("the first keeps running after the second start", first.p.poll() is None)

    t0 = time.time()
    request(port, "POST", "/__bye?id=check1")
    code = first.ended(GRACE + 8)
    took = time.time() - t0
    check("stops after the last window's goodbye", code == 0 and GRACE - 0.5 <= took <= GRACE + 4,
          f"exit {code} after {took:.1f} s")
    check("says it stopped", "stopped" in first.text(), first.text().strip().splitlines()[-1] if first.text().strip() else "")
finally:
    first.stop()
    if second:
        second.stop()
    shutil.rmtree(stub, ignore_errors=True)

ok = all(results)
print(f"[launcher {' '.join(args)}] {'PASS' if ok else 'FAIL'} ({sum(results)} of {len(results)})")
sys.exit(0 if ok else 1)
