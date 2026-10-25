"""End-to-end check of a running MaRQ: opens it in a real browser (headless), analyses
a sample surface and a pair, and compares the numbers with sample_data/expected_results.json.

    python tests/e2e_check.py URL SAMPLE_DIR [--browser chromium|firefox|webkit] [--offline]

--offline blocks every request that does not go to the MaRQ server, which proves that the
bundled runtime (vendor/) is used and that nothing is fetched from the internet.
Needs: pip install playwright && python -m playwright install chromium firefox webkit
Exit code 0 when everything matches.
"""
import os, sys, json, time, argparse
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("url"); ap.add_argument("samples")
ap.add_argument("--browser", default="chromium"); ap.add_argument("--offline", action="store_true")
ap.add_argument("--timeout", type=float, default=900)
a = ap.parse_args()
exp = json.load(open(os.path.join(a.samples, "expected_results.json"), encoding="utf-8"))
S = lambda n: os.path.join(a.samples, n)


def wait_status(page, needle, t):
    t0 = time.time()
    while True:
        st = page.inner_text("#status-bar")
        if needle in st:
            return st
        if "rror" in st or "failed" in st or page.locator("#startup-banner").count():
            ban = page.locator("#startup-banner").inner_text() if page.locator("#startup-banner").count() else ""
            log = page.input_value("#log-box")[-1500:] if page.locator("#log-box").count() else ""
            raise RuntimeError(f"status '{st}' {ban}\n{log}")
        if time.time() - t0 > t:
            raise TimeoutError(f"waited {t:.0f} s for '{needle}', status '{st}'")
        time.sleep(0.5)


ok = True
external, console_err = [], []
with sync_playwright() as p:
    b = getattr(p, a.browser).launch()
    ctx = b.new_context()
    host = a.url.split("/")[2]
    def route(r):
        if r.request.url.split("/")[2] != host:
            external.append(r.request.url)
            return r.abort() if a.offline else r.continue_()
        r.continue_()
    ctx.route("**/*", route)
    page = ctx.new_page()
    page.on("console", lambda m: console_err.append(m.text) if m.type == "error" else None)
    t0 = time.time()
    page.goto(a.url)
    st = wait_status(page, "Ready", a.timeout)
    print(f"[{a.browser}] ready in {time.time() - t0:.0f} s: {st}")

    def check(label, got, want, tol):
        global ok
        good = got is not None and abs(got - want) <= tol
        ok &= good
        print(f"   {'ok ' if good else 'BAD'} {label:22s} {got if got is None else round(got, 3)} (expected {want})")

    f = "HighTemp_insert_shot00_600um.txt"
    page.set_input_files("#file1-input", S(f)); time.sleep(1)
    t1 = time.time(); page.click("#run-pvisual"); wait_status(page, "Surface analysis complete", a.timeout)
    ch = page.evaluate("() => session.analyses[session.analyses.length - 1].channel")
    print(f"[{a.browser}] single surface in {time.time() - t1:.0f} s")
    e = exp["single_surface"][f]
    check("floor width (um)", ch.get("floor_width"), e["floor_width_um"], 0.15)
    check("depth (um)", ch.get("mean_depth"), e["depth_um"], 0.15)
    check("wall angle (deg)", ch.get("wall_angle_deg"), e["wall_angle_deg"], 0.06)
    check("wall dominance f_y", ch.get("f_y"), e["wall_dominance_fy"], 0.0006)

    page.click("#use-crop-a"); wait_status(page, "placed as Surface A", 120)

    f = "HighTemp_part_shot01_600um.txt"
    page.set_input_files("#file1-input", S(f)); time.sleep(1)
    page.click("#run-pvisual"); wait_status(page, "Surface analysis complete", a.timeout)
    ch = page.evaluate("() => session.analyses[session.analyses.length - 1].channel")
    check("part floor width (um)", ch.get("floor_width"), exp["single_surface"][f]["floor_width_um"], 0.15)
    check("part wall dominance", ch.get("f_y"), exp["single_surface"][f]["wall_dominance_fy"], 0.0006)
    page.click("#use-crop-b"); wait_status(page, "placed as Surface B", 120)

    t1 = time.time(); page.click("#run-gradient"); wait_status(page, "Comparison complete", a.timeout)
    m = page.evaluate("() => session.comparisons[session.comparisons.length - 1].metrics")
    print(f"[{a.browser}] comparison in {time.time() - t1:.0f} s")
    e = exp["paired"]["HighTemp_insert_shot00 -> HighTemp_part_shot01 (replication)"]
    check("RQ", m.get("r_z"), e["RQ"], 0.0006)
    check("RQd", m.get("r_mag"), e["RQd"], 0.0006)
    check("RQdy", m.get("r_gy"), e["RQdy"], 0.0006)
    b.close()

runtime_external = [u for u in external if "pyodide" in u or "plot.ly" in u or "jsdelivr" in u]
print(f"[{a.browser}] external requests: {len(external)}{' (blocked)' if a.offline else ''}"
      f"{', runtime from CDN: ' + str(runtime_external[:2]) if runtime_external else ''}")
if console_err:
    print(f"[{a.browser}] console errors: {console_err[:5]}")
if runtime_external:
    ok = False
print(f"[{a.browser}] {'PASS' if ok else 'FAIL'}")
sys.exit(0 if ok else 1)
