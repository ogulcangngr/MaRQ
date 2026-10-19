"""Browser check of a running MaRQ with the synthetic channel of make_test_channel.py, for
systems without the sample data (continuous integration on macOS, Linux and Windows).

    python tests/e2e_synthetic.py URL [--browser chromium|firefox|webkit] [--record]

Analyses tests/test_channel_600um.txt (written first if missing) with the internet blocked
and compares the geometry with tests/test_channel_expected.json; --record writes that file.
The analysis runs in the browser's WebAssembly runtime, so every system must give the
same numbers. Exit code 0 when they match.
"""
import os, sys, json, time, argparse, subprocess
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("url"); ap.add_argument("--browser", default="chromium"); ap.add_argument("--record", action="store_true")
a = ap.parse_args()
data = os.path.join(HERE, "test_channel_600um.txt")
if not os.path.exists(data):
    subprocess.run([sys.executable, os.path.join(HERE, "make_test_channel.py"), data], check=True)
KEYS = ("floor_width", "opening_width", "mean_depth", "wall_angle_deg")


def wait_status(page, needle, t=900):
    t0 = time.time()
    while needle not in (st := page.inner_text("#status-bar")):
        if "rror" in st or page.locator("#startup-banner").count():
            raise RuntimeError(st + " " + (page.locator("#startup-banner").inner_text() if page.locator("#startup-banner").count() else ""))
        if time.time() - t0 > t:
            raise TimeoutError(st)
        time.sleep(0.5)
    return st


with sync_playwright() as p:
    b = getattr(p, a.browser).launch()
    ctx = b.new_context()
    host = a.url.split("/")[2]
    ctx.route("**/*", lambda r: r.continue_() if r.request.url.split("/")[2] == host else r.abort())
    page = ctx.new_page()
    t0 = time.time(); page.goto(a.url)
    print(f"[{a.browser}] {wait_status(page, 'Ready')} in {time.time() - t0:.0f} s")
    page.set_input_files("#file1-input", data); time.sleep(1)
    page.click("#run-pvisual"); wait_status(page, "Surface analysis complete")
    ch = page.evaluate("() => session.analyses[session.analyses.length - 1].channel")
    b.close()

got = {k: round(ch[k], 4) for k in KEYS}
exp_path = os.path.join(HERE, "test_channel_expected.json")
if a.record:
    json.dump(got, open(exp_path, "w"), indent=1); print("recorded", got); sys.exit(0)
exp = json.load(open(exp_path))
ok = all(abs(got[k] - exp[k]) <= 0.01 for k in KEYS)
for k in KEYS:
    print(f"   {'ok ' if abs(got[k] - exp[k]) <= 0.01 else 'BAD'} {k:16s} {got[k]} (expected {exp[k]})")
print(f"[{a.browser}] {'PASS' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
