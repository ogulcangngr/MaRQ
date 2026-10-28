"""Browser check of the MaRQ interface on a synthetic insert and part (make_test_channel.py), for
systems without the sample data (continuous integration on macOS, Linux and Windows).

    python tests/e2e_features.py URL [--browser chromium|firefox|webkit] [--record]

With the internet blocked: analyses the insert and the part, keeps them as A and B, compares
them (the metrics against tests/test_features_expected.json; --record writes that file), then
goes through the views a user opens: both analyses in the tree, the height and slope maps, the
cross-section at a position, the 3D view with the one-click cross-section (when the headless
browser has WebGL), Interpret and its view, the report, the language, a session saved and opened again in a fresh
page, and the conveniences (one header-rows setting, results made with other settings marked,
the side panes hidden, MaRQ's own dialogs, the Feature setting and its dialog, the Options menu and
the interface size, a file in millimetres, the example). Exit code 0 when everything holds.
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
    # without a choice, MaRQ starts in English, in a Turkish browser too
    ctx0 = b.new_context(locale="tr-TR")
    host0 = a.url.split("/")[2]
    ctx0.route("**/*", lambda r: r.continue_() if r.request.url.split("/")[2] == host0 else r.abort())
    p0 = ctx0.new_page(); p0.goto(a.url); p0.wait_for_function("() => _lastStatus !== null", timeout=60000)      # set after the language
    first = p0.evaluate("() => [navigator.language, LANG, document.documentElement.lang, document.getElementById('lang-select').value, localStorage.getItem('marq.language')]")
    ctx0.close()
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
    page.evaluate("() => { localStorage.clear(); localStorage.setItem('marq.language', 'en'); }")
    phase[0] = "reload"; page.reload(); wait(page, "() => ready"); phase[0] = ""
    print(f"[{a.browser}] ready in {time.time() - t0:.0f} s")

    # two analyses, kept as A and B, compared
    for f, slot in ((INS, "a"), (PART, "b")):
        n = page.evaluate("() => session.analyses.length")
        page.set_input_files("#file1-input", f); time.sleep(0.5)
        if slot == "b":                          # Keep as B before the scan is analysed: asked, not kept
            page.click("#use-crop-b"); time.sleep(0.5)
            asked = page.evaluate("""() => document.getElementById('modal-ask').style.display === 'flex'
                && document.querySelector('#ask-buttons .btn-primary').textContent""")
            page.evaluate("() => closeModal('modal-ask')")
            check("Keep as B on an unanalysed scan asks first", asked and page.evaluate("() => files.B === null"), asked)
        if slot == "a":
            card = page.evaluate("""() => getComputedStyle(document.getElementById('ready-box')).display !== 'none'
                && document.getElementById('ready-files').textContent.includes('test_channel_600um.txt')
                && document.getElementById('ready-run').textContent""")
            check("the opened file on the start page, with the next step", card == "Analyse", card)
        page.click("#run-pvisual"); wait(page, f"() => !running && session.analyses.length === {n + 1}")
        if slot == "a":
            tip = page.evaluate("""() => getComputedStyle(document.getElementById('guide-bar')).display !== 'none'
                && [...document.querySelectorAll('#gb-actions button')].map((b) => b.textContent).join(', ')""")
            check("a tip with the next steps after the analysis", tip and tip.startswith("Keep as A"), tip)
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
    check("results not saved yet", page.evaluate("() => unsaved()"))

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

    # Interpret: the Properties of the comparison place RQd and RQ on their 0 to 1 scale and say how
    # to read them; the roles of A and B make the task, whose values the Interpretation view shows
    # with A and B side by side (the part is made 4 µm wider); A set as the later surface asks, and
    # Keep as it is or swapping the roles is taken; a second scan of a surface is its rescan level
    pp = page.evaluate("""() => { const p = document.getElementById('metrics-panel'), m = session.comparisons[0].metrics;
        return [!!p.querySelector('.rbar .rb-val'), !!p.querySelector('.rbar .rb-band') === (m.primary !== 'r_z'),
                p.textContent.includes('How to read these'), !document.getElementById('interpret-open').disabled]; }""")
    check("Properties: the values on their 0 to 1 scale, and how to read them", pp == [True, True, True, True], pp)

    def roles(a_role, b_role):
        page.evaluate("() => openInterpret()"); time.sleep(0.3)
        page.select_option("#int-a", a_role); page.select_option("#int-b", b_role); time.sleep(0.2)
        said = page.evaluate("() => [document.getElementById('int-task').textContent.split('.')[0], (document.querySelector('#int-table th.on') || {}).textContent || null]")
        page.click("#int-go"); time.sleep(0.6)
        return said
    FW = """() => { const v = document.getElementById('interpret-view'), c = _C[_curC];
        const row = [...v.querySelectorAll('table.size tbody tr')].find(r => r.cells[0].textContent.startsWith('Floor width'));
        const ra = surfaceRecord(c, 0), rb = surfaceRecord(c, 1);
        return [_view, (v.querySelector('.int-title') || {}).textContent, row ? row.cells[3].textContent : null,
                ra && rb ? +(rb.channel.floor_width - ra.channel.floor_width).toFixed(1) : null, c.interp.a + ',' + c.interp.b,
                getComputedStyle(document.querySelector(`.trow.cinterp[data-cid="${c.id}"]`)).display !== 'none',
                (session.comparisons[0].interpretation || {}).task || null, !!v.querySelector('.int-note')]; }"""
    num = lambda s: float(s.replace("\u2212", "-").replace("µm", "").replace("+", "").strip()) if s else float("nan")
    said = roles("tool", "part")
    v1 = page.evaluate(FW)
    check("Interpret: a tool and its part are Replication quality, A and B side by side",
          said == ["This pair: Replication quality", "Replication quality"] and v1[:2] == ["interpret", "Replication quality"]
          and v1[3] is not None and abs(num(v1[2]) - v1[3]) < 0.051 and abs(v1[3] - 4) < 1
          and v1[4:7] == ["tool,part", True, "replication"] and not v1[7], f"{said} {v1}")
    roles("part", "tool")
    asked = page.evaluate("() => [document.getElementById('modal-ask').style.display, document.querySelectorAll('#ask-buttons button').length, document.getElementById('ask-title').textContent]")
    page.click("#ask-buttons button:has-text('Keep as it is')"); time.sleep(0.6)
    v2 = page.evaluate(FW)
    roles("part", "tool")
    page.click("#ask-buttons button:has-text('swap the roles only')"); time.sleep(0.6)
    v3 = page.evaluate(FW)
    check("Interpret: A set as the later surface asks; kept, the differences are later minus earlier; or the roles swap",
          asked == ["flex", 3, "A is the later surface"] and v2[4] == "part,tool" and v2[7] and abs(num(v2[2]) + v1[3]) < 0.051
          and v3[4] == "tool,part" and not v3[7], f"{asked} {v2} {v3}")
    # the record of a rescan pair of A's surface (as noteInterpChange writes it); one made with other
    # settings, or without a number, does not count
    lev = page.evaluate("""() => { const c = _C[_curC], rec = (par, r) => ({ file_a: c.names[0], file_b: 'rescan.txt', parameters: par,
                                    metrics: { r_mag: r }, interpretation: { task: 'reference' } });
        session.comparisons.push(rec(c.params, 0.93));
        const r = rescanLevel(c, 0), read = readRQd(0.85, r, 'replication');
        session.comparisons.splice(-1, 1, rec({ ...c.params, grid_spacing: 7 }, 0.93));
        const other = rescanLevel(c, 0);
        session.comparisons.splice(-1, 1, rec(c.params, NaN));
        const none = rescanLevel(c, 0);
        session.comparisons.pop();
        return [r && r.r, read.startsWith('0.080 below'), interpTask({ a: 'tool', b: 'rescan' }), other, none]; }""")
    check("a second scan of the same surface, with the same settings, is its rescan level", lev == [0.93, True, "reference", None, None], lev)
    order = page.evaluate("""() => [interpTask({ a: 'used', aN: 2000000, b: 'part', bN: 5 }), interpEarlier({ a: 'used', aN: 2000000, b: 'part', bN: 5 }),
        interpEarlier({ a: 'rescan', b: 'design' }), interpEarlier({ a: 'rescan', b: 'rescan' }), interpEarlier({ a: 'rescan', b: 'tool' }),
        interpTask({ a: 'used', aN: 20, b: 'used', bN: 5 }), interpEarlier({ a: 'used', aN: 20, b: 'used', bN: 5 }),
        JSON.stringify(cleanInterp({ a: 'tool', b: 'part', aN: 2.5, bN: 3 })), cleanInterp({ a: null, b: 'part' }), cleanInterp({ a: 'constructor', b: 'part' })]""")
    check("Interpret: the stage decides the order at any number of uses; roles read back are checked",
          order == ["replication", 0, 0, 0, 1, "degradation", 1, '{"a":"tool","b":"part","aN":null,"bN":3}', None, None], order)

    # 3D, when the headless browser has WebGL: the three.js viewport, or Plotly's 3D surface where
    # three.js cannot start (no WebGL 2 in some headless browsers without a graphics card)
    webgl = page.evaluate("() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }")
    mode = ""
    if webgl:
        tree(page, "view3d", ids[1]); time.sleep(1.5)
        mode = page.evaluate("""() => _viewer && _viewer._trace === _A[_curA].figs.view3d.data[0] ? "three.js"
            : _viewerFailed && (document.getElementById("viewer3d").data || []).length ? "Plotly" : "" """)
        why = page.evaluate("() => (document.getElementById('log-box').value.match(/3D viewport unavailable[^\\n]*/) || [''])[0]")
        check("3D view drawn", mode, mode + (f"; {why}" if mode == "Plotly" else ""))
    if not webgl:
        print("   --  3D view not checked: this headless browser has no WebGL")
    elif mode == "Plotly":
        print("   --  one-click cross-section not checked: it needs the three.js viewport")
    else:
        tree(page, "gradA"); time.sleep(1.5)
        page.click('#navbar .navbtn[data-act="xsect"]'); time.sleep(0.3)
        hit = page.evaluate("() => { const v = _viewer; for (let y = 0.3; y <= 0.7; y += 0.01) for (let x = 0.3; x <= 0.7; x += 0.01) if (v.pick(x * v.w, y * v.h)) return [x, y]; return null; }")
        if hit:
            box = page.locator("#viewer3d canvas").bounding_box()
            page.mouse.click(box["x"] + box["width"] * hit[0], box["y"] + box["height"] * hit[1]); time.sleep(1.5)
        check("one-click cross-section in 3D", hit and page.is_visible("#section-panel")
              and page.evaluate("() => document.getElementById('section-plot').data.length") == 3)
        page.click('#navbar .navbtn[data-act="xsect"]'); time.sleep(0.3)

    # report
    page.click("#export-report"); wait(page, "() => document.getElementById('modal-report').style.display === 'flex'", 300)
    # read from the page itself (Playwright's frame access stalls on this srcdoc frame in Firefox)
    count = "(s) => { const d = document.getElementById('report-frame').contentDocument; return d ? d.querySelectorAll(s).length : 0; }"
    wait(page, f"() => ({count})('section.page') > 0", 120); time.sleep(1)
    pages_n, figs = page.evaluate(count, "section.page"), page.evaluate(count, ".figs img")
    check("report: a page per result, with figures", pages_n == 3 and figs >= 6, f"pages {pages_n}, figures {figs}")
    check("report: the interpretation on the page of the comparison", page.evaluate(count, ".interp") == 1 and page.evaluate(count, ".rbar") >= 4)
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
    check("session file", {"marq_session.json", "slot_A.txt", "slot_B.txt"} <= names
          and sum(n.startswith("pvisual_") and n.endswith(".npz") for n in names) == 2
          and sum(n.startswith("rq_gradient_") and n.endswith(".npz") for n in names) == 1, f"{os.path.getsize(sess) / 1e6:.1f} MB")
    check("results saved", page.evaluate("() => !unsaved()"))
    phase[0] = "reload"; page.reload(); wait(page, "() => ready"); phase[0] = ""
    page.set_input_files("#session-input", sess)
    wait(page, "() => _figs.rq_gradient && _figs.pvisual && !_restoring", 300); time.sleep(1)
    m2 = page.evaluate("() => session.comparisons[0].metrics")
    check("session opened again", all(abs(m2[k] - m[k]) < 1e-12 for k in KEYS) and page.evaluate("() => Object.keys(_A).length") == 2)
    check("the interpretation kept in the session", page.evaluate("() => Object.values(_C).map(c => c.interp ? c.interp.a + ',' + c.interp.b : '-').join()") == "tool,part")
    n0 = page.evaluate("() => _serial.rq_gradient")
    page.click("#run-gradient"); wait(page, f"() => !running && _serial.rq_gradient > {n0}")
    # the same pair with the same settings stays one row of the exports
    check("compared again after opening it, still one row", page.evaluate("() => session.comparisons.length") == 1
          and abs(page.evaluate("() => session.comparisons[0].metrics.r_mag") - m["r_mag"]) < 1e-9)

    # a session file whose record is damaged is refused before the engine replaces anything: the
    # results on the page keep their own crops; one edited by hand opens, its odd fields left out
    def session_copy(name, edit, swap=False):  # swap: the two analyses' results trade places in the file
        out = os.path.join(tmp, name)
        with zipfile.ZipFile(sess) as zi, zipfile.ZipFile(out, "w") as zo:
            ids = sorted({n.split(".")[0][8:] for n in zi.namelist() if n.startswith("pvisual_")})
            ren = {ids[0]: ids[1], ids[1]: ids[0]} if swap and len(ids) == 2 else {}
            for it in zi.infolist():
                data, fn = zi.read(it.filename), it.filename
                if fn.startswith("pvisual_") and fn.split(".")[0][8:] in ren:
                    fn = "pvisual_" + ren[fn.split(".")[0][8:]] + "." + fn.split(".", 1)[1]
                zo.writestr(fn, edit(data) if fn == "marq_session.json" else data)
        return out
    def open_session(path):                     # MaRQ asks first when the results on screen are not saved
        page.set_input_files("#session-input", path); time.sleep(0.5)
        if page.evaluate("() => document.getElementById('modal-ask').style.display === 'flex'"):
            page.click("#ask-buttons button:has-text('Open the session')")
    crop_len = "async () => (await ask('export_crop', { aid: Object.keys(_A)[0] }, 'crop')).data.length"
    c0 = page.evaluate(crop_len)
    open_session(session_copy("damaged.marq", lambda d: d + b"x", swap=True))
    wait(page, "() => !_opening", 120); time.sleep(0.5)
    dmg = [page.inner_text("#status-bar"), page.evaluate(crop_len) == c0, page.evaluate("() => Object.keys(_A).length")]
    def edited(d):
        st = json.loads(d)
        st["comparisons"][0]["names"] = None; st["comparisons"][0]["interp"] = {"a": None, "b": "part"}
        return json.dumps(st).encode()
    open_session(session_copy("edited.marq", edited))
    wait(page, "() => !_opening && !_restoring", 300); time.sleep(1)
    ed = page.evaluate("() => { const c = Object.values(_C)[0]; return [c.names.join(), c.interp, _lastStatus[0]]; }")
    check("a damaged session file is refused, the results kept; one edited by hand opens",
          "damaged session file" in dmg[0] and dmg[1] and dmg[2] == 2 and ed == ["A,B", None, "Session opened: {name}"], f"{dmg} {ed}")
    open_session(sess)                                                # the session as saved, for what follows
    wait(page, "() => !_opening && _figs.rq_gradient && _figs.pvisual && !_restoring", 300); time.sleep(1)

    # conveniences: one header-rows setting, results made with other settings, the side panes,
    # MaRQ's own dialogs, a file in millimetres, the example
    both = page.evaluate("""() => { const e = document.getElementById('p-skiprows'); e.value = '2'; e.dispatchEvent(new Event('input'));
        const r = [document.querySelectorAll('#modal-settings input[id$="skiprows"]').length, getPvisualParams().skip_rows, getGradientParams().skip_rows];
        e.value = '0'; e.dispatchEvent(new Event('input')); return r; }""")
    check("one header-rows setting for the analysis and the comparison", both == [1, 2, 2], both)
    stale = page.evaluate("""() => { const e = document.getElementById('g-spacing'); e.value = '6'; e.dispatchEvent(new Event('input'));
        const on = document.querySelector('#tree-comparisons .tnode.comparison').classList.contains('stale');
        e.value = '5'; e.dispatchEvent(new Event('input')); return [on, document.querySelector('#tree-comparisons .tnode.comparison').classList.contains('stale')]; }""")
    check("a result made with other settings is marked", stale == [True, False], stale)
    w0 = page.evaluate("() => document.getElementById('viewport').clientWidth")
    page.click("#hide-left"); page.click("#hide-right"); time.sleep(0.5)
    w1 = page.evaluate("() => document.getElementById('viewport').clientWidth")
    page.click("#show-left"); page.click("#show-right"); time.sleep(0.5)
    check("side panes hidden and shown again", w1 > w0 + 400 and abs(page.evaluate("() => document.getElementById('viewport').clientWidth") - w0) < 3, f"{w0} -> {w1} px")
    page.evaluate("() => document.querySelector('#tree-analyses .aremove').click()"); time.sleep(0.4)
    asked = page.evaluate("() => document.getElementById('modal-ask').style.display === 'flex' && document.getElementById('ask-title').textContent")
    page.evaluate("() => closeModal('modal-ask')")
    check("removing an analysis asks in MaRQ's own dialog", asked == "Remove the analysis?", asked)

    # the Feature setting: Automatic, Channel or Ridge, with the Raised feature tick of before read as
    # Ridge; its Channel or ridge dialog opens over Settings and Escape closes it alone
    fe = page.evaluate("""() => { const e = document.getElementById('p-feature');
        const opts = [...e.options].map(o => o.value).join(','); applyParamValues({'p-raised': '1'}); const old = e.value;
        e.value = 'auto'; e.dispatchEvent(new Event('change')); return [opts, old, getPvisualParams().feature]; }""")
    check("Feature: Automatic, Channel or Ridge; a Raised feature tick of before is Ridge", fe == ["auto,channel,ridge", "ridge", "auto"], fe)
    page.evaluate("() => { openModal('modal-settings'); document.querySelector('#modal-settings .param-link').click(); }"); time.sleep(0.3)
    shown = "() => ['modal-settings', 'modal-feature'].map(id => document.getElementById(id).style.display === 'flex')"
    on = page.evaluate(shown); page.keyboard.press("Escape"); time.sleep(0.2)
    off = page.evaluate(shown); page.keyboard.press("Escape"); time.sleep(0.2)
    check("the Channel or ridge dialog opens over Settings and closes alone", on == [True, True] and off == [True, False]
          and page.evaluate(shown) == [False, False], f"{on} {off}")

    # the Options menu: an interface size (remembered), Automatic again; the figures are drawn as at
    # 100 % and scaled as a whole, and the pointer still finds the point under it; a browser zoom of
    # 300 % (as Chrome and Edge report it, the outer width three times the inner) is undone, and
    # nothing is undone once it is gone
    tree(page, "channel", ids[0])          # its figures built first (the analysis comes from the session opened)
    wait(page, "() => _view === 'channel' && !!document.querySelector('.vp-layer.active.plot-container')", 120); time.sleep(0.5)
    fig = """() => { const el = document.querySelector('.vp-layer.active.plot-container'), st = document.getElementById('vp-stage').getBoundingClientRect();
        const tf = getComputedStyle(el).transform, s = tf === 'none' ? 1 : new DOMMatrix(tf).a;
        return [+s.toFixed(4), el._fullLayout.font.size, Math.round(el.getBoundingClientRect().width - st.width), Math.round(el._fullLayout.width * s - st.width)]; }"""
    f0 = page.evaluate(fig)
    page.click("#options-menu-btn"); time.sleep(0.2)
    opt = page.evaluate("""() => [document.getElementById('options-menu').style.display,
        [...document.querySelectorAll('#options-menu button[data-size]')].map(b => b.dataset.size).join(','),
        document.querySelector('#options-menu button[aria-checked="true"]').dataset.size]""")
    page.click('#options-menu button[data-size="1.25"]'); time.sleep(1.5)
    big = page.evaluate("() => [parseFloat(getComputedStyle(document.documentElement).fontSize), _uiK, localStorage.getItem('marq.uisize')]")
    f1 = page.evaluate(fig)
    # the data point under a position of the page, from the axes, against the one Plotly reports there
    pt = page.evaluate("""() => { const el = document.querySelector('.vp-layer.active.plot-container'), fl = el._fullLayout, r = el.getBoundingClientRect();
        const k = r.width / el.offsetWidth, px = r.left + k * (fl.xaxis._offset + 0.4 * fl.xaxis._length), py = r.top + k * (fl.yaxis._offset + 0.55 * fl.yaxis._length);
        window._hv = null; el.on('plotly_hover', (e) => { window._hv = e.points[0].x; });
        return [px, py, fl.xaxis.p2l(0.4 * fl.xaxis._length), 4 * Math.abs(fl.xaxis.range[1] - fl.xaxis.range[0]) / fl.xaxis._length]; }""")
    page.mouse.move(pt[0] - 4, pt[1] - 4); page.mouse.move(pt[0], pt[1], steps=3); time.sleep(0.5)
    hv = page.evaluate("() => window._hv")
    page.mouse.move(2, 2)
    page.click("#options-menu-btn"); time.sleep(0.2); page.click('#options-menu button[data-size="auto"]'); time.sleep(1.5)
    back = page.evaluate("() => [parseFloat(getComputedStyle(document.documentElement).fontSize), _uiK]")
    check("Options: interface size 125 %, then Automatic again", opt == ["flex", "auto,0.8,0.9,1,1.1,1.25,1.5", "auto"]
          and big == [20, 1.25, "1.25"] and back == [16, 1], f"{opt} {big} {back}")
    check("the figure drawn as at 100 % and scaled with the interface, the pointer on its point",
          f0[0] == 1 and f1[0] == 1.25 and f1[1] == f0[1] and max(abs(v) for v in f0[2:] + f1[2:]) <= 2
          and hv is not None and abs(hv - pt[2]) <= pt[3], f"{f0} {f1}; hover {hv} for {pt[2:]}")
    zoomed = page.evaluate("""() => {
        const own = Object.getOwnPropertyDescriptor(window, 'outerWidth');
        Object.defineProperty(window, 'outerWidth', { configurable: true, get: () => innerWidth * 3 });
        applyUiSize(); checkZoom(); const r = [browserZoom(), +parseFloat(getComputedStyle(document.documentElement).fontSize).toFixed(2)];
        const said = noticeShown('Browser zoom detected') && /300\\u00a0%.*and 0\\./.test(document.getElementById('vn-body').textContent);
        setLanguage('tr', false); const tr = [document.getElementById('vn-title').textContent, /^Tarayıcı %300 /.test(document.getElementById('vn-body').textContent)];
        setLanguage('en', false);
        if (own) Object.defineProperty(window, 'outerWidth', own); else delete window.outerWidth;
        applyUiSize(); checkZoom();
        return r.concat([browserZoom(), parseFloat(getComputedStyle(document.documentElement).fontSize), said, document.getElementById('vp-notice').style.display, tr]); }""")
    # 16 / 3 px as the browser keeps it (Firefox in sixtieths of a pixel: 5.34)
    check("a browser zoom of 300 % undone and said, with the keys back to 100 %, in a new language too; nothing undone without one, the notice gone",
          zoomed[0] == 3 and abs(zoomed[1] - 16 / 3) < 0.02 and zoomed[2:] == [1, 16, True, "none", ["Tarayıcı yakınlaştırması algılandı", True]], zoomed)
    check("English without a choice, in a Turkish browser too", first[0].startswith("tr") and first[1:] == ["en", "en", "en", None], first)

    mm = os.path.join(tmp, "test_channel_600um_in_mm.txt")
    with open(INS) as fi, open(mm, "w") as fo:
        for line in fi:
            fo.write(" ".join(f"{float(v) / 1000:.5f}" for v in line.split()) + "\n")
    n = page.evaluate("() => session.analyses.length")
    setf = "(v) => { const e = document.getElementById('p-feature'); e.value = v; e.dispatchEvent(new Event('change')); }"
    page.evaluate(setf, "ridge")                 # set before another file is opened: back to Automatic
    page.set_input_files("#file1-input", mm); time.sleep(1)
    unit = page.evaluate("() => document.getElementById('modal-ask').style.display === 'flex' && document.getElementById('ask-title').textContent")
    page.evaluate("() => [...document.querySelectorAll('#ask-buttons button')][0].click()"); time.sleep(0.3)
    back = page.evaluate("() => [document.getElementById('p-feature').value, document.getElementById('status-bar').textContent]")
    check("Feature back to Automatic when another file is opened", back[0] == "auto" and back[1].endswith("Feature is Automatic again."), back)
    page.click("#run-pvisual"); wait(page, f"() => !running && session.analyses.length === {n + 1}")
    fw = page.evaluate("() => [session.analyses.find(a => a.file === 'test_channel_600um.txt').channel.floor_width, session.analyses.at(-1).channel.floor_width, session.analyses.at(-1).parameters.input_scale]")
    check("a file in millimetres found and converted", unit == "Not in micrometres?" and fw[2] == 1000 and abs(fw[0] - fw[1]) < 0.05, f"{unit}; {fw}")
    # Ridge set for this channel: reported; and its result is not marked as made with other settings
    # when the Feature is Automatic again (it describes the scan, not the session's settings)
    page.evaluate(setf, "ridge")
    page.click("#run-pvisual"); wait(page, f"() => !running && session.analyses.length === {n + 2}")
    rep = page.evaluate("""() => [session.analyses.at(-1).rotation.feature_side_empty,
        document.getElementById('vp-notice').style.display === 'flex' && document.getElementById('vn-title').textContent]""")
    page.evaluate(setf, "auto")
    rep.append(page.evaluate("() => changedSince('pvisual', session.analyses.at(-1).parameters).length"))
    check("a Ridge set for a channel is reported, its result not marked once Automatic again", rep == [True, "Check the Feature setting", 0], rep)
    nc = page.evaluate("() => session.comparisons.length")
    page.click("#file-menu-btn"); time.sleep(0.3)
    page.click('#file-menu [data-cmd="example"]'); time.sleep(0.4)
    page.evaluate("() => { const b = document.querySelector('#ask-buttons .btn-primary'); if (document.getElementById('modal-ask').style.display === 'flex' && b) b.click(); }")
    wait(page, f"() => !running && session.comparisons.length === {nc + 1} && _example === null", 600)
    ex = page.evaluate("() => [session.comparisons.at(-1).file_a, session.comparisons.at(-1).metrics.primary]")
    check("the example: analysed, kept as A and B, compared", ex[0].startswith("example_channel_600um") and ex[1] == "r_mag", ex)
    b.close()

if cut_off:
    print("   --  cut off by a reload (not counted):", cut_off[:3])
check("no script errors", not errors, errors[:3])
ok = all(results)
print(f"[{a.browser}] {'PASS' if ok else 'FAIL'} ({sum(results)} of {len(results)})")
sys.exit(0 if ok else 1)
