"""Browser check of the MaRQ interface on a synthetic insert and part (make_test_channel.py), for
systems without the sample data (continuous integration on macOS, Linux and Windows).

    python tests/e2e_features.py URL [--browser chromium|firefox|webkit] [--record]

With the internet blocked: analyses the insert and the part, keeps them as A and B, compares
them (the metrics against tests/test_features_expected.json; --record writes that file), then
goes through the views a user opens: both analyses in the tree, the height and slope maps, the
cross-section at a position, the 3D view with the one-click cross-section (when the headless
browser has WebGL), the report, the language, and a session saved and opened again in a fresh
page. Exit code 0 when everything holds.
"""
import os, sys, json, time, zipfile, argparse, tempfile, subprocess
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("url"); ap.add_argument("--browser", default="chromium"); ap.add_argument("--record", action="store_true")
a = ap.parse_args()
INS, PART = os.path.join(HERE, "test_channel_600um.txt"), os.path.join(HERE, "test_part_600um.txt")
for path, extra in ((INS, []), (PART, ["--part"])):
    if not os.path.exists(path):
        subprocess.run([sys.executable, os.path.join(HERE, "make_test_channel.py"), path, *extra], check=True)
KEYS = ("r_z", "r_gx", "r_gy", "r_mag")
tmp = tempfile.mkdtemp(prefix="marq_features_")
results, errors, cut_off = [], [], []
phase = [""]                                     # "reload" while a page reload is under way


def check(label, good, info=""):
    results.append(bool(good))
    print(f"   {'ok ' if good else 'BAD'} {label}" + (f"   [{info}]" if info != "" else ""), flush=True)


def wait(page, js, t=600):
    t0 = time.time()
    while not page.evaluate(js):
        st = page.inner_text("#status-bar")
        if page.locator("#startup-banner").count():
            raise RuntimeError(page.locator("#startup-banner").inner_text())
        if time.time() - t0 > t:
            raise TimeoutError(js + " | status: " + st)
        time.sleep(0.3)


def tree(page, view, aid=None):
    sel = f".trow[data-view='{view}'][data-aid='{aid}']" if aid else f".trow[data-view='{view}']:not([data-aid])"
    page.evaluate("(s) => document.querySelector(s).click()", sel)
    time.sleep(1.5)


with sync_playwright() as p:
    opts = {"args": ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]} if a.browser == "chromium" else {}
    b = getattr(p, a.browser).launch(**opts)
    ctx = b.new_context(viewport={"width": 1366, "height": 768}, accept_downloads=True)
    ctx.add_init_script("window.showSaveFilePicker = undefined;")    # saves go to downloads here
    host = a.url.split("/")[2]
    ctx.route("**/*", lambda r: r.continue_() if r.request.url.split("/")[2] == host else r.abort())
    page = ctx.new_page()
    # requests that a reload cuts off are no errors of the page (WebKit on macOS reports them)
    page.on("pageerror", lambda e: (cut_off if phase[0] == "reload" else errors).append(str(e)))
    page.on("dialog", lambda d: d.accept())
    t0 = time.time()
    page.goto(a.url)
    page.evaluate("() => { localStorage.clear(); localStorage.setItem('marq.lang', 'en'); }")
    phase[0] = "reload"; page.reload(); wait(page, "() => ready"); phase[0] = ""
    print(f"[{a.browser}] ready in {time.time() - t0:.0f} s")

    # two analyses, kept as A and B, compared
    for f, slot in ((INS, "a"), (PART, "b")):
        n = page.evaluate("() => session.analyses.length")
        page.set_input_files("#file1-input", f); time.sleep(0.5)
        page.click("#run-pvisual"); wait(page, f"() => !running && session.analyses.length === {n + 1}")
        page.click(f"#use-crop-{slot}"); wait(page, f"() => files.{slot.upper()} !== null", 120)
    page.click("#run-gradient"); wait(page, "() => !running && session.comparisons.length === 1")
    m = page.evaluate("() => session.comparisons[0].metrics")
    got = {k: round(m[k], 5) for k in KEYS}
    exp_path = os.path.join(HERE, "test_features_expected.json")
    if a.record:
        json.dump(got, open(exp_path, "w"), indent=1); print("recorded", got)
    exp = json.load(open(exp_path))
    check("RQ, RQdx, RQdy, RQd", all(abs(got[k] - exp[k]) <= 1e-4 for k in KEYS), f"{got} (expected {exp})")
    ids = page.evaluate("() => Object.keys(_A)")
    check("both analyses in the tree", len(ids) == 2 and page.locator("#tree-analyses .tnode.analysis").count() == 2
          and page.evaluate("() => [...document.querySelectorAll('#tree-analyses .aslot')].map(e => e.textContent)") == ["A", "B"])
    check("results not saved yet", page.evaluate("() => resultCount() > _savedCount"))

    # the first analysis again, its views
    tree(page, "channel", ids[0])
    check("the first analysis opens again", page.evaluate("() => _curA") == ids[0]
          and page.evaluate("() => document.getElementById('plot-channel')._marqOwner") == ids[0])
    tree(page, "xsview", ids[0]); wait(page, "() => _xs && _xs.d", 60)
    page.fill("#xs-frac", "0.7"); page.press("#xs-frac", "Enter"); time.sleep(1.5)
    check("cross-section at 70 % of the length", page.evaluate("() => Math.abs((_xs.x - _xs.rng.lo) / (_xs.rng.hi - _xs.rng.lo) - 0.7) < 1e-6")
          and page.evaluate("() => document.getElementById('xs-plot').data.length") == 2, page.inner_text("#xs-info"))
    with page.expect_download() as d:
        page.click("#xs-view .xs-bar button:has-text('CSV')")
    fn = os.path.join(tmp, "xs.csv"); d.value.save_as(fn)
    check("cross-section CSV", len(open(fn, encoding="utf-8").read().splitlines()) > 50, open(fn, encoding="utf-8").readline().strip())

    # the comparison views
    tree(page, "gradheight")
    nh = page.evaluate("() => document.getElementById('plot-gradheight').data.filter(d => d.type === 'heatmap').length")
    tree(page, "gradslope")
    ns = page.evaluate("() => document.getElementById('plot-gradslope').data.filter(d => d.type === 'heatmap').length")
    check("height maps and slope maps", nh == 3 and ns == 3, f"{nh}, {ns}")
    tree(page, "gradxs"); wait(page, "() => _xs && _xs.kind === 'rq_gradient' && _xs.d", 60)
    check("cross-sections of A and B", page.evaluate("() => document.getElementById('xs-plot').data.length") == 3)

    # 3D, when the headless browser has WebGL
    webgl = page.evaluate("() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }")
    if webgl:
        tree(page, "view3d", ids[1]); time.sleep(1.5)
        check("3D view drawn", page.evaluate("() => !!_viewer && _viewer._trace === _A[_curA].figs.view3d.data[0]"))
        tree(page, "gradA"); time.sleep(1.5)
        page.click('#navbar .navbtn[data-act="xsect"]'); time.sleep(0.3)
        hit = page.evaluate("() => { const v = _viewer; for (let y = 0.3; y <= 0.7; y += 0.01) for (let x = 0.3; x <= 0.7; x += 0.01) if (v.pick(x * v.w, y * v.h)) return [x, y]; return null; }")
        if hit:
            box = page.locator("#viewer3d canvas").bounding_box()
            page.mouse.click(box["x"] + box["width"] * hit[0], box["y"] + box["height"] * hit[1]); time.sleep(1.5)
        check("one-click cross-section in 3D", hit and page.is_visible("#section-panel")
              and page.evaluate("() => document.getElementById('section-plot').data.length") == 3)
        page.click('#navbar .navbtn[data-act="xsect"]'); time.sleep(0.3)
    else:
        print("   --  3D view not checked: this headless browser has no WebGL")

    # report
    page.click("#export-report"); wait(page, "() => document.getElementById('modal-report').style.display === 'flex'", 300)
    # read from the page itself (Playwright's frame access stalls on this srcdoc frame in Firefox)
    count = "(s) => { const d = document.getElementById('report-frame').contentDocument; return d ? d.querySelectorAll(s).length : 0; }"
    wait(page, f"() => ({count})('section.page') > 0", 120); time.sleep(1)
    pages_n, figs = page.evaluate(count, "section.page"), page.evaluate(count, ".figs img")
    check("report: a page per result, with figures", pages_n == 3 and figs >= 6, f"pages {pages_n}, figures {figs}")
    page.keyboard.press("Escape"); time.sleep(0.5)

    # language
    en = page.inner_text("#run-pvisual")
    page.select_option("#lang-select", "tr"); time.sleep(1); wait(page, "() => !running", 120)
    tr = page.inner_text("#run-pvisual")
    check("Turkish interface", page.evaluate("() => document.documentElement.lang") == "tr" and tr != en, f"{en!r} -> {tr!r}")
    page.select_option("#lang-select", "en"); time.sleep(1); wait(page, "() => !running", 120)

    # session: saved, then opened in a fresh page
    page.click("#file-menu-btn"); time.sleep(0.3)
    with page.expect_download(timeout=180000) as d:
        page.click('#file-menu [data-cmd="save-session"]')
    sess = os.path.join(tmp, "session.marq"); d.value.save_as(sess)
    names = set(zipfile.ZipFile(sess).namelist())
    check("session file", {"marq_session.json", "rq_gradient.json", "rq_gradient.npz", "slot_A.txt", "slot_B.txt"} <= names
          and sum(n.startswith("pvisual_") and n.endswith(".npz") for n in names) == 2, f"{os.path.getsize(sess) / 1e6:.1f} MB")
    check("results saved", page.evaluate("() => resultCount() === _savedCount"))
    phase[0] = "reload"; page.reload(); wait(page, "() => ready"); phase[0] = ""
    page.set_input_files("#session-input", sess)
    wait(page, "() => _figs.rq_gradient && _figs.pvisual && !_restoring", 300); time.sleep(1)
    m2 = page.evaluate("() => session.comparisons[0].metrics")
    check("session opened again", all(abs(m2[k] - m[k]) < 1e-12 for k in KEYS) and page.evaluate("() => Object.keys(_A).length") == 2)
    page.click("#run-gradient"); wait(page, "() => !running && session.comparisons.length === 2")
    check("compared again after opening it", abs(page.evaluate("() => session.comparisons[1].metrics.r_mag") - m["r_mag"]) < 1e-9)
    b.close()

if cut_off:
    print("   --  cut off by a reload (not counted):", cut_off[:3])
check("no script errors", not errors, errors[:3])
ok = all(results)
print(f"[{a.browser}] {'PASS' if ok else 'FAIL'} ({sum(results)} of {len(results)})")
sys.exit(0 if ok else 1)
