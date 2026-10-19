"""Download the third-party runtime files that MaRQ needs, so that the application
runs without internet access ("offline bundle").

    python tools/fetch_vendor.py            # fills vendor/ (skips files already present)
    python tools/fetch_vendor.py --check    # only verify what is present

Files (versions pinned; change the constants to upgrade, then re-run):
  vendor/plotly-<PLOTLY_VERSION>.min.js           Plotly.js (MIT)          from cdn.plot.ly
  vendor/three/three.module.min.js                three.js (MIT), the 3D   from cdn.jsdelivr.net
                                                  viewport
  vendor/pyodide/pyodide.js, pyodide.asm.js,      Pyodide (MPL-2.0)        from cdn.jsdelivr.net
                 pyodide.asm.wasm, python_stdlib.zip, pyodide-lock.json
  vendor/pyodide/<wheels>                         numpy, scipy and their   listed in pyodide-lock.json,
                                                  dependencies (BSD)       sha256 verified against it
The application loads these local copies first and falls back to the CDNs only if
they are missing, so a source checkout without vendor/ still works online.
"""
import hashlib
import io
import json
import os
import sys
import urllib.request

PLOTLY_VERSION  = "2.35.2"
THREE_VERSION   = "0.169.0"
PYODIDE_VERSION = "0.26.4"
PACKAGES        = ["numpy", "scipy"]          # transitive dependencies are added from the lock file

PLOTLY_URL  = f"https://cdn.plot.ly/plotly-{PLOTLY_VERSION}.min.js"
THREE_URL   = f"https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}/build/three.module.min.js"
PYODIDE_CDN = f"https://cdn.jsdelivr.net/pyodide/v{PYODIDE_VERSION}/full/"
CORE_FILES  = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "vendor")
PYDIR  = os.path.join(VENDOR, "pyodide")
CHECK  = "--check" in sys.argv
sys.stdout.reconfigure(errors="replace")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url, dest, expect_sha=None):
    name = os.path.relpath(dest, ROOT)
    if os.path.exists(dest) and (expect_sha is None or sha256(dest) == expect_sha):
        print(f"  ok       {name}  ({os.path.getsize(dest)/1e6:.1f} MB)")
        return True
    if CHECK:
        print(f"  MISSING  {name}")
        return False
    print(f"  fetching {name} ...", end="", flush=True)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as r, open(dest + ".part", "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    if expect_sha and sha256(dest + ".part") != expect_sha:
        os.remove(dest + ".part")
        sys.exit(f"\nchecksum mismatch for {url}")
    os.replace(dest + ".part", dest)
    print(f" {os.path.getsize(dest)/1e6:.1f} MB")
    return True


def main():
    ok = True
    print("Plotly.js")
    ok &= fetch(PLOTLY_URL, os.path.join(VENDOR, f"plotly-{PLOTLY_VERSION}.min.js"))
    print("three.js")
    ok &= fetch(THREE_URL, os.path.join(VENDOR, "three", "three.module.min.js"))

    print("Pyodide core")
    for name in CORE_FILES:
        ok &= fetch(PYODIDE_CDN + name, os.path.join(PYDIR, name))

    lock_path = os.path.join(PYDIR, "pyodide-lock.json")
    if not os.path.exists(lock_path):
        sys.exit("pyodide-lock.json is needed to resolve the wheels")
    lock = json.load(io.open(lock_path, encoding="utf-8"))
    pkgs = lock["packages"]

    wanted, queue = [], list(PACKAGES)
    while queue:
        p = queue.pop(0)
        if p in wanted:
            continue
        if p not in pkgs:
            sys.exit(f"package {p} not in the lock file")
        wanted.append(p)
        queue.extend(pkgs[p].get("depends", []))

    print("Pyodide packages: " + ", ".join(f"{p} {pkgs[p]['version']}" for p in wanted))
    for p in wanted:
        entry = pkgs[p]
        ok &= fetch(PYODIDE_CDN + entry["file_name"], os.path.join(PYDIR, entry["file_name"]),
                    expect_sha=entry.get("sha256"))

    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(VENDOR) for f in fs)
    print(f"\nvendor/ total {total/1e6:.0f} MB; " + ("complete" if ok else "INCOMPLETE"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
