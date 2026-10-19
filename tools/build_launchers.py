"""Build the MaRQ launchers (launcher/main.go) for every system, so that MaRQ starts
without Python. Needs Go (https://go.dev/dl/; no installation needed, the unpacked
folder is enough):

    python tools/build_launchers.py [path/to/go]

Writes, from the MaRQ folder:
    MaRQ.exe                       Windows 10/11 (x64; runs on Windows on Arm too)
    launchers/marq-macos-arm64     macOS 12+ on Apple silicon (ad-hoc signed by the Go linker)
    launchers/marq-macos-x64       macOS 12+ on Intel
    launchers/marq-linux-x64       Linux on x86-64
    launchers/marq-linux-arm64     Linux on Arm (Raspberry Pi 4/5, Arm laptops)
The builds are reproducible (no build paths or build ids in the binaries), so a rebuild
from the same source and Go version gives the same files. MaRQ.command and MaRQ.sh pick
the right macOS or Linux binary.
"""
import os, sys, shutil, hashlib, subprocess

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GO = sys.argv[1] if len(sys.argv) > 1 else (shutil.which("go") or "go")
TARGETS = [("windows", "amd64", "MaRQ.exe"),
           ("darwin", "arm64", "launchers/marq-macos-arm64"),
           ("darwin", "amd64", "launchers/marq-macos-x64"),
           ("linux", "amd64", "launchers/marq-linux-x64"),
           ("linux", "arm64", "launchers/marq-linux-arm64")]

# The Windows icon and version information (launcher/winres/winres.json, icon from logo.svg in
# launcher/icon/) are compiled into launcher/rsrc_windows_amd64.syso, which "go build" links into
# MaRQ.exe. That file is kept in the repository; to remake it after changing the icon or the
# version: go install github.com/tc-hib/go-winres@latest, then in launcher/:
#     go-winres make --in winres/winres.json --arch amd64
ver = subprocess.run([GO, "version"], capture_output=True, text=True, check=True).stdout.strip()
print(ver)
os.makedirs(os.path.join(HERE, "launchers"), exist_ok=True)
for goos, arch, out in TARGETS:
    env = dict(os.environ, GOOS=goos, GOARCH=arch, CGO_ENABLED="0", GOFLAGS="-mod=mod")
    dst = os.path.join(HERE, out)
    subprocess.run([GO, "build", "-trimpath", "-ldflags", "-s -w -buildid=", "-o", dst, "."],
                   cwd=os.path.join(HERE, "launcher"), env=env, check=True)
    h = hashlib.sha256(open(dst, "rb").read()).hexdigest()[:16]
    print(f"  {out:30s} {os.path.getsize(dst) / 1e6:5.1f} MB  sha256 {h}")
