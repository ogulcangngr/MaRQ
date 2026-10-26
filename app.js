/* MaRQ (Microchannel and Replication Quality Analyzer): main application logic */

const APP = {
  name: "MaRQ", full: "Microchannel and Replication Quality Analyzer", version: "1.0",
  repo: "https://github.com/ogulcangngr/MaRQ", doi: "10.5281/zenodo.22813916",
  plotlyVersion: "4.1.2", pyodideVersion: "314.0.7",
  paper: "M. O. Güngör, J. Charmet, E. Yıldırım, A 3D measurement workflow for assessing replication quality " +
         "and tool degradation in moulded microfluidic channels, Measurement (submitted, 2026)",
};

// Figure ids (as produced by plots.py) -> label and 2D plot container (3D figures share one viewport)
const FIGS = {
  pvisual: {
    rotation:             ["Alignment",               "plot-rotation"],
    channel:              ["Channel detection",       "plot-channel"],
    profiles_xsection:    ["Cross-section and depth", "plot-profiles-xsection"],
    profiles_ycenter:     ["Centre line",             "plot-profiles-ycenter"],
    profiles_xcenter:     ["Longitudinal centre",     "plot-profiles-xcenter"],
    profiles_widthlength: ["Width and length",        "plot-profiles-widthlength"],
    view3d:               ["3D view",                 "viewer3d"],
    roughness:            ["Roughness areas",         "plot-roughness"],
  },
  rq_gradient: {
    grad3d_cloud1: ["Surface A (3D)",         "viewer3d"],
    grad3d_cloud2: ["Surface B (3D)",         "viewer3d"],
    grad3d_error:  ["Slope error (3D)",       "viewer3d"],
    gradheight:    ["Height maps",            "plot-gradheight"],
    gradslope:     ["Slope maps",             "plot-gradslope"],
    gradmaps:      ["Height and slope maps (all six)", null],      // for the export dialog and the report
  },
};

// The views listed in the browser: what each shows and how it is drawn
const VIEWS = {
  rotation:    { kind: "pvisual", key: "rotation", type: "2d" },
  channel:     { kind: "pvisual", key: "channel", type: "2d" },
  xsection:    { kind: "pvisual", key: "profiles_xsection", type: "2d" },
  widthlength: { kind: "pvisual", key: "profiles_widthlength", type: "2d" },
  ycenter:     { kind: "pvisual", key: "profiles_ycenter", type: "2d" },
  xcenter:     { kind: "pvisual", key: "profiles_xcenter", type: "2d" },
  view3d:      { kind: "pvisual", key: "view3d", type: "3d", value: "Height" },
  roughness:   { kind: "pvisual", key: "roughness", type: "2d" },
  xsview:      { kind: "pvisual", key: "xsview", type: "xs" },
  gradA:       { kind: "rq_gradient", key: "grad3d_cloud1", type: "3d", value: "Height" },
  gradB:       { kind: "rq_gradient", key: "grad3d_cloud2", type: "3d", value: "Height" },
  gradE:       { kind: "rq_gradient", key: "grad3d_error", type: "3d", value: "Slope error" },
  gradheight:  { kind: "rq_gradient", key: "gradheight", type: "2d" },
  gradslope:   { kind: "rq_gradient", key: "gradslope", type: "2d" },
  gradxs:      { kind: "rq_gradient", key: "gradxs", type: "xs" },
  batch:       { kind: "rq_gradient", key: null, type: "html" },
  summary:     { kind: "session", key: null, type: "html" },
};
const VIEW_OF_KEY = Object.fromEntries(Object.entries(VIEWS).filter(([, v]) => v.key).map(([id, v]) => [v.key, id]));

const PARAM_IDS = ["p-feature", "p-voxel", "p-fieldk", "p-cropx", "p-cropy", "p-ofrac", "p-flfrac", "p-rfloor",
                   "p-rfloorlen", "p-rfwidth", "p-rflen", "p-margin", "p-cell", "p-sigma", "p-slices",
                   "p-skiprows", "g-spacing", "g-sigma"];
const SHARED_PARAMS = ["p-skiprows"];          // settings of both the analysis and the comparison
const LS = { params: "marq.params.v1", theme: "marq.theme", layout: "marq.layout2", equal: "marq.equal",
             linkMaps: "marq.linkMaps", linkCams: "marq.linkCameras", lang: "marq.language", tips: "marq.tips",
             panes: "marq.panes", outline: "marq.outline", uisize: "marq.uisize" };

// ── Interface size ─────────────────────────────────────────────────────────────
// Every size of the interface is in rem, and MaRQ sets the root size itself. Automatic fits the
// window: 16 px from 1366 by 700 screen pixels up, smaller below (13 px at 1024 across, and with
// the height too), down to 60 %; the sizes under Options hold one size. Either way a browser zoom
// is undone, so MaRQ opens at its own size whatever zoom the browser remembers for its address:
// Chrome and Edge, which the launcher opens, give the zoom as the window's outer width, in screen
// pixels, over its inner width, in page pixels (other browsers give 1, and keep their zoom). The
// figures are drawn at the size they have at 100 % and scaled by the same factor (_uiK) as a whole
// (style.css, html.ui-scaled), so Plotly's legends, lines and markers, in page pixels, keep their
// proportions; Plotly undoes the scale for the pointer.
const UI_SIZES = ["auto", "0.8", "0.9", "1", "1.1", "1.25", "1.5"];
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
let _uiK = 1, _uiZoom = 1, _uiSmallSaid = false, _uiZoomSaid = 1;

function browserZoom() {
  const r = window.outerWidth / window.innerWidth;
  if (!(r > 0) || !isFinite(r)) return 1;
  const z = ZOOM_STEPS.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));
  return Math.abs(z - r) / z < 0.06 ? z : 1;       // between the steps: the borders of a small window
}
function uiSizeSetting() {
  let v = null;
  try { v = localStorage.getItem(LS.uisize); } catch {}
  return UI_SIZES.includes(v) ? v : "auto";
}
// the root size, _uiK, and the classes and the factor style.css uses (the narrow-window rules, the
// scaled figures, whose new sizes their size observers pass on to Plotly)
function applyUiSize() {
  const z = browserZoom(), w = innerWidth * z, h = innerHeight * z, set = uiSizeSetting();
  const s = set === "auto" ? Math.max(0.6, Math.min(1, (0.877 * w / 100 + 4.02) / 16, h / 700)) : parseFloat(set);
  const k = Math.abs(s / z - 1) < 1e-3 ? 1 : s / z, changed = Math.abs(k - _uiK) > 1e-4;
  _uiZoom = z; _uiK = k;
  const root = document.documentElement;
  root.style.fontSize = (16 * k).toFixed(3) + "px";
  root.style.setProperty("--ui-k", String(k));
  root.classList.toggle("ui-scaled", k !== 1);
  root.classList.toggle("ui-small", k < 0.55);     // the spin arrows of the number fields would fill them
  const across = set === "auto" ? w : w / s;       // the window's width as the layout sees it
  root.classList.toggle("ui-mid", across <= 1440);
  root.classList.toggle("ui-narrow", across <= 1100);
  if (document.getElementById("options-menu")) updateOptionsMenu();
  return changed;
}
// the keys that set the browser's zoom back to 100 %
function zoomResetKeys() { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "Command (⌘)" : "Ctrl"; }
function noticeShown(title) {
  return document.getElementById("vp-notice").style.display === "flex" && document.getElementById("vn-title").textContent === t(title);
}
// a browser zoom, which MaRQ undoes: said once for each zoom, with the keys that set the browser
// back to 100 %; the notice goes when the zoom is back at 100 %
function checkZoom() {
  const z = browserZoom();
  if (z === 1) {
    _uiZoomSaid = 1;
    if (noticeShown("Browser zoom detected")) hideNotice();
    return;
  }
  if (z === _uiZoomSaid) return;
  _uiZoomSaid = z;
  showNotice("Browser zoom detected", () => t("The browser is zoomed to {z} %, which MaRQ undoes to keep its own size. To set the browser back to 100 %, press {key} and 0.",
    { z: Math.round(z * 100), key: zoomResetKeys() }), "warn", false);
}
// a window too small for the interface even at the smallest automatic size: said once (after the
// zoom notice, which it would hide)
function checkSmallWindow() {
  const z = browserZoom();
  if (_uiSmallSaid || !(innerWidth * z < 900 || innerHeight * z < 520) || noticeShown("Browser zoom detected")) return;
  _uiSmallSaid = true;
  showNotice("The window is small", () => t("The MaRQ window leaves its views little room. Maximize the window for more room."), "warn", false);
}
applyUiSize();
// Figures whose panels share one coordinate system: zoom and pan move all panels together.
const LINKED_2D = { gradheight: true, gradslope: true };

// ── State ──────────────────────────────────────────────────────────────────────

let worker   = null;
let ready    = false;
let running  = false;
const files  = { "1": null, "A": null, "B": null };   // {name, content(Uint8Array), isCrop, from}
let batchFiles = [];
let _figs = { pvisual: null, rq_gradient: null };      // figures of the last result of each kind
let _cropText = null, _cropFilename = null, _cropAvailable = false, _cropSource = null;
let _theme          = "light";
let _lastKind       = null;     // "pvisual" | "rq_gradient": last result rendered
const _have = { pvisual: false, rq_gradient: false };   // results the worker still holds
let _rethemeQueued  = false;
let _runtime        = { pyodide: "…", plotly: (window.__marqRuntime || {}).plotly || "…" };
let _pendingKind    = null;     // kind of the run in progress (for progress text)
let _batchRows      = [];       // rows of the last batch run
let _lastBatch      = null;
let _lastPairNames  = null;
let _file1Analysed  = false;    // the point cloud in the scan slot has been analysed
let _file1Failed    = false;    // its analysis stopped with an error (the start page says so)
let _readySlot      = null;     // slot of the file opened last: the start page shows it and the next step
let _nChanged       = 0;        // analysis settings that differ from the paper defaults
let _guide          = null;     // the tip on screen: {kind, slot}
let _keepAfter      = null;     // {slot, aid}: keep this analysis as A or B as soon as it finishes
let _run            = null;     // what the run in progress was started with: kind, file or names, settings
let _batchRunning   = false;
let _batchPos       = null;     // {i, n} of the batch comparison in progress
const _serial       = { pvisual: 0, rq_gradient: 0 };   // results so far, for the 2D zoom memory
let _restoring      = null;     // {n, view} while the results of an opened session are rebuilt
let _sessionName    = "";
let _reporting      = false;    // a report is being put together
let _opening        = false;    // a session file is being read and restored
let _exporting      = false;    // a figure is being drawn for an export (it shares the off-screen stage with the report)
const busy = () => running || _reporting || _opening;   // nothing may start, be removed or be replaced meanwhile
let _reportHtml     = null;
let _section        = null;     // the section profile on screen
let _autoSkipped    = 0;        // header lines the engine skipped by itself in the run in progress
const session = { started: new Date().toISOString(), analyses: [], comparisons: [] };
let _view = null;               // id of the view on screen
const _props = { pvisual: null, rq_gradient: null };    // properties panel html per result kind
const _captions = {};           // figure key -> {title, detail}
const _cams = {};               // 3D camera per figure key, and "grad" for the linked comparison views
let _viewer = null, _viewerFailed = false, _viewerKey = null;
let _dragmode2d = "pan";
// The surface analyses of the session, by id: file, record, figures, properties, crop, and
// whether the engine still holds the result (to rebuild it, export it or keep its crop). The
// one on screen is _curA; _figs.pvisual, _props.pvisual, _have.pvisual and the crop variables
// above are its.
const _A = {};
let _aSeq = 0, _curA = null;
// The comparisons, by id (c1, c2…), in the same way: the pair, the settings, the figures, the
// properties, the batch table of a batch, the records it added to the session, and whether the
// engine still holds it (the newest four). The one on screen is _curC; _figs.rq_gradient,
// _props.rq_gradient, _have.rq_gradient, _lastPairNames, _cmpParams and _lastBatch are its.
const _C = {};
let _cSeq = 0, _curC = null;
// A redraw (a new theme, colours, 3D detail or language) builds the figure on screen; the other
// figures of each result are kept in staleKeys and built when their view is opened.
let _mapRange = null;           // the zoom the height and slope maps share
let _asks = {}, _askSeq = 0;    // engine requests waiting for their reply
let _cmpParams = null;          // the settings the comparison on screen was made with
let _example = null;            // the example under way: the slot its next analysis is kept as
let _outlineOn = true;          // the outline of the channel interior on the comparison maps

// ── Start-up checks ────────────────────────────────────────────────────────────

// What stops MaRQ from starting in this browser, said in words a first-time user can act on.
const START_HELP = "Start MaRQ with its launcher in the software folder: double-click MaRQ.exe " +
  "(Windows) or MaRQ.command (macOS), or run sh MaRQ.sh (Linux); see README.md.";
function startupProblem() {
  if (location.protocol === "file:")
    return t("MaRQ was opened as a file (index.html), so the browser blocks its analysis engine. Close this tab.") +
           " " + t(START_HELP);
  if (typeof WebAssembly !== "object" || typeof Worker !== "function" || typeof fetch !== "function")
    return t("This browser cannot run MaRQ: it lacks WebAssembly or Web Workers. Use a current Chrome, Edge, Firefox or Safari.");
  return null;
}
function showStartupBanner(msg, kind = "error") {
  let b = document.getElementById("startup-banner");
  if (!b) {
    b = document.createElement("div");
    b.id = "startup-banner";
    b.setAttribute("role", "alert");
    b.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:9999;padding:14px 18px;" +
      "background:#b3261e;color:#fff;font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe WPC','Segoe UI',system-ui,Ubuntu,'Droid Sans',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35)";
    document.body.appendChild(b);
  }
  b.textContent = msg;
  b.dataset.kind = kind;
}
const ENGINE_HELP = "The analysis engine could not be loaded. If MaRQ comes from the downloaded " +
  "package, check that the folder software/vendor is complete (extract the whole zip again if " +
  "unsure); without it MaRQ needs an internet connection. A current Chrome, Edge, Firefox or " +
  "Safari is needed, and the computer needs about 1 GB of free memory.";

// ── Worker bootstrap ───────────────────────────────────────────────────────────

// A request to the engine whose reply comes back as a promise (crops, figures, sessions,
// cross-sections): the id names it, the engine answers with the same id.
function ask(type, data, prefix) {
  return new Promise((resolve, reject) => {
    const id = `${prefix}:${++_askSeq}`;
    _asks[id] = { resolve, reject };
    worker.postMessage({ type, id, data });
  });
}

function startWorker() {
  worker = new Worker("worker.js", { type: "module" });       // Pyodide needs a module worker

  worker.onmessage = (e) => {
    const { type, kind, data, message } = e.data;
    if (type !== "error" && e.data.id && _asks[e.data.id]) {
      const w = _asks[e.data.id];
      delete _asks[e.data.id];
      w.resolve(e.data);
      return;
    }
    switch (type) {
      case "status": setStatus(message, "info"); break;
      case "log":    appendLog(e.data.line); statusFromLog(e.data.line); break;
      case "runtime":
        _runtime.pyodide = e.data.pyodide;
        _runtime.plotly  = (window.__marqRuntime || {}).plotly || "cdn";
        showRuntime();
        break;
      case "ready": {
        ready = true;
        const b = document.getElementById("startup-banner");
        if (b && b.dataset.kind === "slow") b.remove();
        setStatus(_runtime.pyodide === "local" ? "Ready (offline bundle)" : "Ready", "success");
        updateButtons();
        break;
      }
      case "result":
        if (!e.data.retheme) _batchPos = null;
        try { onResult(kind, data, e.data); }
        catch (err) {              // the interface must not stay "running" when a result cannot be shown
          appendLog("ERROR while showing the result: " + ((err && err.stack) || err));
          setStatus("Error: {msg}", "error", { msg: t("the result could not be shown") });
          showNotice(null, () => t("The result could not be shown ({m}). The log has the details.", { m: (err && err.message) || String(err) }));
        } finally { if (!e.data.retheme) setRunning(false); }
        if (_rethemeQueued && !running) { _rethemeQueued = false; retheme(); }
        break;
      case "batch_progress":
        _batchPos = { i: e.data.index + 1, n: e.data.total, name: e.data.name };
        if (_runCard) _runCard.cur = 0;              // the steps again, for the next pair
        setStatus("Batch {i} of {n}: {name}", "info", _batchPos);
        drawRunCard();
        break;
      case "batch_row":
        _batchRows.push({ name: e.data.name, metrics: e.data.metrics, error: e.data.error || null });
        break;

      case "skipped":
        _autoSkipped = e.data.n;
        break;

      case "error": {
        if (e.data.log && e.data.log.length) e.data.log.forEach(appendLog);
        appendLog("ERROR: " + message);
        if (!ready) { startupFailed(message); break; }
        // a failed figure or crop request does not end a run that may be waiting behind it
        const isRun = ["pv1", "rq1", "batch"].includes(e.data.id);
        const prefix = String(e.data.id || "").split(":")[0];
        if (_asks[e.data.id]) { _asks[e.data.id].reject(new Error(message)); delete _asks[e.data.id]; }
        if (/^rt-/.test(e.data.id || "")) {                                // a rebuild the engine could not do
          const rid = String(e.data.id).slice(3), r = _A[rid] || _C[rid];
          if (r) {
            // only the engine's own "no longer held" means it has lost the result; after another
            // failure (memory for a Very high mesh, say) it still holds it (2026-10-25)
            r.rebuilding = false; r.again = false;
            if (/no longer held/i.test(message)) r.held = false;
            if (_restoring && --_restoring.n <= 0) _restoring = null;    // a session restore does not wait for it
            if (r.id === _curA) selectAnalysis(r.id);
            if (r.id === _curC) selectComparison(r.id);
          }
        }
        const what = !isRun ? ({ fig: "The figure could not be exported", crop: "The crop could not be prepared", repfig: "The report could not be made",
                                 session: "The session could not be saved", "session-open": "The session could not be opened",
                                 xs: "The cross-section could not be read" }[prefix]
                                 || (/^rt-/.test(e.data.id || "") ? "The figures could not be drawn again" : null))
                   : _pendingKind === "pvisual" ? "The analysis stopped" : _batchRunning ? "The batch stopped" : "The comparison stopped";
        const fatal = FATAL_ERR.test(message);
        let [short, long] = explainError(message, fatal);
        // a session file that cannot be read: in words, not NumPy's message (which can even
        // suggest loading the file unsafely)
        if (prefix === "session-open" && !fatal && !/out of memory|MemoryError/i.test(message))
          [short, long] = [t("damaged session file"), t("The session file is damaged or is not a MaRQ session. The log has the details.")];
        if (isRun && _pendingKind === "pvisual") _file1Failed = true;
        if (isRun) _example = null;
        if (isRun || fatal) setRunning(false);
        setStatus("Error: {msg}", "error", { msg: short });
        showNotice(what, long);
        if (fatal) restartEngine();
        else if (_rethemeQueued && !running) { _rethemeQueued = false; retheme(); }
        break;
      }
    }
  };

  worker.onerror = (e) => {
    appendLog("Worker error: " + e.message);
    if (!ready) { startupFailed(e.message); return; }
    const [short, long] = explainError(e.message || "", true);
    setRunning(false);
    setStatus("Error: {msg}", "error", { msg: short });
    showNotice(null, long);
    restartEngine();
  };
}

// The engine did not start: the server may be gone (its window was closed), or the bundle is
// incomplete.
const SERVER_GONE = "MaRQ's server is not running any more: its window was closed. Start MaRQ again (MaRQ.exe, MaRQ.command or MaRQ.sh).";
const SLOW_START = "MaRQ is taking unusually long to start. Without the offline bundle it loads about 30 MB from the internet, which can take minutes on a slow connection. If nothing changes, close this window and start MaRQ again.";
function startupFailed(message) {
  setRunning(false);
  setStatus("MaRQ cannot start here, see the message at the top", "error");
  fetch("index.html", { method: "HEAD", cache: "no-store" })
    .then(() => showStartupBanner(t(ENGINE_HELP) + (message ? " (" + message + ")" : "")))
    .catch(() => showStartupBanner(t(SERVER_GONE)));
}

// Python errors said in words: what is wrong with the input and what to do. [short, long]
const FATAL_ERR = /out of memory|memory access out of bounds|Array buffer allocation failed|Maximum call stack|fatal error/i;
function explainError(message, fatal) {
  const msg = String(message || "");
  const last = (msg.trim().split("\n").filter((l) => l.trim()).pop() || msg).replace(/^\w*Error:\s*/, "").trim();
  let m;
  if (/out of memory|Array buffer allocation failed|MemoryError/i.test(msg))
    return [t("out of memory"), t("The browser ran out of memory. Close other tabs and try again, or use a larger voxel size (Settings).")];
  if (fatal)
    return [last, t("The analysis engine stopped unexpectedly. It is restarting; run the analysis again.")];
  if (/UnicodeDecodeError|codec can't decode/.test(msg))
    return [t("not a text file"), t("The file is not a text point cloud: it looks like an image or another binary file. MaRQ reads x y z text files (.txt, .xyz, .asc, .csv) and X3P files.")];
  if ((m = msg.match(/could not convert string '([^']*)' to float\d* at row (\d+)/)))
    return [t("text where numbers are expected"), t("Line {row} of the file holds text (“{s}”) where numbers are expected. MaRQ reads x y z numbers, one point per line; header lines at the top can be skipped with Header rows to skip in Settings.",
      { row: fileLine(Number(m[2])), s: m[1].slice(0, 40) })];
  if (/array is 1-dimensional, but 2 were indexed|input contained no data/.test(msg))
    return [t("no points in the file"), t("The file holds no points: it is empty or has a single line.")];
  if (/index 2 is out of bounds for axis 1/.test(msg))
    return [t("fewer than three columns"), t("Each line of the file needs three numbers, x y z; this file has fewer columns.")];
  if (/zero-size array to reduction/.test(msg))
    return [t("too few points"), t("Too few points are left to analyse. The scan may be nearly empty, or smaller than twice the edge margin (Settings, Advanced).")];
  if (/BadZipFile|X3P: /.test(msg))
    return [t("damaged X3P file"), t("The X3P file is damaged or is not an X3P file.") + (/X3P: /.test(last) ? " (" + last + ")" : "")];
  return [last.length > 90 ? last.slice(0, 88) + "…" : last, last];
}
// the line of the file that NumPy calls data row `row`: it counts neither blank lines nor lines
// starting with #, and the header lines skipped before reading come first
function fileLine(row) {
  const skip = skipRowsUsed(), bytes = _pendingKind === "pvisual" && _run && _run.content;
  if (bytes && bytes.subarray) {
    const lines = new TextDecoder().decode(bytes.subarray(0, 8 << 20)).split("\n");
    for (let i = skip, k = -1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l && !l.startsWith("#") && ++k === row) return i + 1;
    }
  }
  return row + 1 + skip;
}
function skipRowsUsed() { return _autoSkipped || Math.round(num("p-skiprows", 0)); }

// a message over the viewport, for errors
// a number and its per cent sign on one line ("100 %" with a space that does not break)
function keepPercent(s) { return String(s).replace(/(\d) %/g, "$1\u00a0%"); }
// body: the text, or a function that writes it (in the language of the moment, so that a notice on
// screen follows a change of language)
let _noticeArgs = null;
function showNotice(title, body, level = "error", log = true) {
  _noticeArgs = [title, body, level, log];
  const el = document.getElementById("vp-notice");
  el.classList.toggle("warn", level === "warn");
  el.querySelector(".btn-mini").style.display = log ? "" : "none";     // Show the log
  document.getElementById("vn-title").textContent = title ? t(title) : "";
  document.getElementById("vn-title").style.display = title ? "" : "none";
  document.getElementById("vn-body").textContent = keepPercent(typeof body === "function" ? body() : body);
  el.style.display = "flex";
}
function hideNotice() { document.getElementById("vp-notice").style.display = "none"; }

// a new engine, after a crash: the results it held are gone
function restartEngine() {
  try { worker.terminate(); } catch {}
  ready = false; running = false; _example = null;
  _lastKind = null; _have.pvisual = _have.rq_gradient = false;
  [...Object.values(_A), ...Object.values(_C)].forEach((r) => { r.held = false; r.rebuilding = false; r.again = false; });
  if (!_cropText) _cropAvailable = false;
  _rethemeQueued = false;
  Object.values(_asks).forEach((w) => w.reject(new Error("the analysis engine restarted")));
  _asks = {};
  updateAnalysisNodes();
  updateButtons();
  startWorker();
}

// Stopping restarts the engine, and the results it holds go with it: asked first when there are any
function cancelRun() {
  if (!worker) return;
  const held = [...Object.values(_A), ...Object.values(_C)].filter((r) => r.held).length;
  if (!held) { stopRun(); return; }
  askUser(t("Stop the analysis?"),
    t("Stopping restarts the analysis engine. The {n} results it holds stay on screen, but they can no longer be exported, saved in a session, kept as A or B or drawn again. Save the session first if you need them: wait for this step to finish, then File, Save the session.", { n: held }),
    [[t("Keep running"), null, true], [t("Stop"), stopRun]]);
}

function stopRun() {
  if (!worker || !running) return;
  setRunning(false);
  appendLog("\n[cancelled by the user; the analysis engine is restarting]");
  restartEngine();                     // the cached Python results are gone with the old engine
  setStatus("Cancelled, restarting the engine…", "info");
}

// ── Files ──────────────────────────────────────────────────────────────────────

// true: the Feature setting went back to Automatic (another point cloud to analyse)
function setFile(slot, name, content, extra = {}) {
  files[slot] = { name, content, ...extra };
  const nameEl = document.getElementById("file" + slot + "-name");
  nameEl.textContent = extra.isCrop ? t("crop of {name}", { name: extra.from }) : name;
  nameEl.title = name;
  nameEl.classList.add("has-file");
  document.getElementById("file" + slot + "-clear").style.display = "";
  let reset = false;
  if (slot === "1") { _file1Analysed = _file1Failed = false; reset = resetFeature(); }
  updateAnalysisNodes();
  updateButtons();
  return reset;
}

function readFile(file, slot) {
  if (/\.marq$/i.test(file.name)) { openSessionFile(file); return; }
  if (!file.size) {
    showNotice("The file could not be opened", () => t("{name} is empty, or is a folder. Open a point cloud file.", { name: file.name }));
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    hideNotice();
    const content = new Uint8Array(ev.target.result);
    const place = (s, extra) => {
      const reset = setFile(s, file.name, content, extra); _readySlot = s; showStart();
      setStatus(reset ? "Opened {name}. Feature is Automatic again." : "Opened {name}", "success", { name: file.name });
    };
    // a point cloud to analyse: in micrometres, or converted to them
    const toScan = (then) => withUnits(file.name, content, (extra) => { place("1", extra); if (then) then(); });
    if (slot === "1") { toScan(); return; }
    if (isCropName(file.name)) { place(slot); return; }
    askUser(t("Not analysed yet?"),
      t("<b>{name}</b> does not look like a crop saved by MaRQ. Surfaces A and B are the cropped channels of analysed surfaces: levelled, aligned and cut to the channel, so that the two can be compared. A point cloud compared as it was measured gives meaningless results. Analyse it first; MaRQ then keeps it as {slot}.", { name: esc(file.name), slot }),
      [[t("Analyse it, then keep it as {slot}", { slot }), () => toScan(() => analyseThenKeep(slot)), true],
       [t("Use it as {slot} anyway", { slot }), () => place(slot)],
       [t("Cancel"), null]]);
  };
  reader.onerror = () => showNotice("The file could not be opened",
    () => t("{name} could not be read. If it is on a network or cloud drive, copy it to this computer first.", { name: file.name }));
  reader.readAsArrayBuffer(file);
}

// The units of a text point cloud, from the spread of its coordinates. MaRQ works in micrometres,
// and a scan of a microchannel spans hundreds of micrometres to tens of millimetres; a spread
// that is far smaller or far larger read in micrometres is that of a file in millimetres, metres
// or nanometres. Read on lines spread through the whole file. null: it looks like micrometres.
const UNIT_SCALE = { millimetres: 1e3, metres: 1e6, nanometres: 1e-3 };
function guessUnits(bytes, name) {
  if (/\.x3p$/i.test(name || "")) return null;             // an X3P file states its units, and is read in micrometres
  const n = bytes.length, dec = new TextDecoder(), xs = [], ys = [], K = 600;
  for (let k = 0; k < K; k++) {
    let i = Math.floor(n * k / K);
    if (i > 0) { i = bytes.indexOf(10, i) + 1; if (i <= 0) break; }
    const j = bytes.indexOf(10, i);
    let line = dec.decode(bytes.subarray(i, j < 0 ? n : j)).trim();
    if (/;/.test(line) && /\d,\d/.test(line) && !/\d\.\d/.test(line)) line = line.replace(/,/g, ".");   // decimal commas
    const p = line.split(/[\s,;]+/);
    const v = p.slice(0, 3).map(Number);
    if (p.length >= 3 && v.every((x) => isFinite(x))) { xs.push(v[0]); ys.push(v[1]); }
  }
  if (xs.length < 20) return null;
  const span = (a) => a.reduce((m, x) => Math.max(m, x), -Infinity) - a.reduce((m, x) => Math.min(m, x), Infinity);
  const s = Math.max(span(xs), span(ys));
  // a scan of a microchannel spans about 0.1 to 30 mm: up to 0.05 it is in metres (50 mm), above that
  // and up to 150 in millimetres (a 0.3 mm scan in millimetres is not taken for metres)
  const unit = !(s > 0) ? null : s <= 0.05 ? "metres" : s <= 150 ? "millimetres" : s >= 150000 ? "nanometres" : null;
  return unit ? { unit, scale: UNIT_SCALE[unit], span: s } : null;
}

// done(extra): the file in micrometres as it is ({}), or converted ({scale, unit}); asked first
// when it does not look like micrometres
function withUnits(name, bytes, done) {
  const u = guessUnits(bytes, name);
  if (!u) { done({}); return; }
  const unit = t(u.unit), k = u.scale >= 1 ? "× " + intl(u.scale) : "÷ " + intl(1 / u.scale);
  askUser(t("Not in micrometres?"),
    t("The points of <b>{name}</b> span {s} across. MaRQ reads coordinates in micrometres, where a scan of a microchannel spans hundreds to tens of thousands. This file looks like it is in {unit}. Convert it to micrometres ({k}) for the analysis?",
      { name: esc(name), s: decimal(String(+u.span.toPrecision(3))), unit, k }),
    [[t("Convert to micrometres"), () => done({ scale: u.scale, unit: u.unit }), true],
     [t("Use the numbers as they are"), () => done({})],
     [t("Cancel"), null]]);
}

function handleFileInput(inputId, slot) {
  const el = document.getElementById(inputId);
  if (el.files[0]) readFile(el.files[0], slot);
  el.value = "";
}

function clearFile(slot) {
  files[slot] = null;
  const nameEl = document.getElementById("file" + slot + "-name");
  nameEl.textContent = t(nameEl.dataset.placeholder || ""); nameEl.title = "";
  nameEl.classList.remove("has-file");
  document.getElementById("file" + slot + "-clear").style.display = "none";
  updateAnalysisNodes();
  updateButtons();
}

// the same bytes: a surface compared with itself gives RQ = 1 (names say nothing here)
function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function handleBatchInput(fileList) {
  const el = document.getElementById("batch-input");
  const list = Array.from(fileList || el.files).filter((f) => f.size > 0);
  el.value = "";
  const raw = list.filter((f) => !isCropName(f.name));
  if (raw.length) {
    const names = raw.slice(0, 4).map((f) => "<b>" + esc(f.name) + "</b>").join(", ") + (raw.length > 4 ? ", …" : "");
    askUser(t("Not analysed yet?"),
      t("{names}: not crops saved by MaRQ, by their names. Each batch file is compared with surface A as it is, so it has to be the crop of an analysed surface (Analyse, then Save crop). A point cloud compared as it was measured gives meaningless results.", { names }),
      [[t("Cancel"), null, true], [t("Use them anyway"), () => readBatch(list)]]);
    return;
  }
  readBatch(list);
}

function readBatch(list) {
  batchFiles = [];
  updateBatchCount(); updateButtons();          // no run with a list that is still being read
  let pending = list.length;
  if (!pending) return;
  const done = () => {
    if (--pending) return;
    batchFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));   // cycle_2 before cycle_10
    updateBatchCount(); updateButtons();
  };
  list.forEach((f) => {
    const r = new FileReader();
    r.onload = (ev) => { batchFiles.push({ name: f.name, content: new Uint8Array(ev.target.result) }); done(); };
    r.onerror = () => { appendLog("Could not read " + f.name); done(); };
    r.readAsArrayBuffer(f);
  });
}

function updateBatchCount() {
  const n = batchFiles.length;
  document.getElementById("batch-count").textContent =
    n === 0 ? t("Batch files…") : n === 1 ? t("1 file chosen") : t("{n} files chosen", { n });
}

function updateButtons() {
  const idle = ready && !busy();
  document.getElementById("run-pvisual").disabled  = !(idle && files["1"]);
  document.getElementById("run-gradient").disabled = !(idle && files["A"] && files["B"]);
  document.getElementById("batch-run").disabled    = !(idle && files["A"] && batchFiles.length);
  const crop = idle && _cropAvailable;
  ["download-crop", "use-crop-a", "use-crop-b"].forEach((id) => document.getElementById(id).disabled = !crop);
  document.getElementById("export-figure").disabled = !(idle && (_have.pvisual || _have.rq_gradient));
  document.getElementById("export-report").disabled = !(idle && !_exporting && [...Object.values(_A), ...Object.values(_C)].some((r) => r.held && r.props));
  const hasData = session.analyses.length || session.comparisons.length;
  document.getElementById("export-json").disabled = !hasData;
  document.getElementById("export-csv").disabled  = !hasData;
  document.getElementById("cancel-run").style.visibility = running ? "visible" : "hidden";
  updateNext();
  updateStart();
}

// The start page after a file is opened: the file, the next step as a button, and where the
// settings are. Without a pending step it shows the welcome text.
function updateStart() {
  const box = document.getElementById("ready-box");
  const s = _readySlot, pair = s === "A" || s === "B";
  const show = s === "1" ? !!(files["1"] && !_file1Analysed) : pair && !!(files["A"] || files["B"]);
  box.style.display = show ? "" : "none";
  document.getElementById("start-box").style.display = show ? "none" : "";
  if (!show) return;
  const size = (n) => n >= 1048576 ? decimal((n / 1048576).toFixed(1)) + " MB" : decimal(Math.max(1, Math.round(n / 1024))) + " kB";
  const row = (slot) => {
    const f = files[slot];
    const tag = slot === "1" ? '<svg class="ico"><use href="#i-file"/></svg>' : `<span class="slot-tag">${slot}</span>`;
    if (!f) return `<div class="ready-file missing">${tag}<span>${esc(t(slot === "A" ? "Surface A, the reference: not opened yet" : "Surface B, the compared surface: not opened yet"))}</span></div>`;
    const name = f.isCrop ? t("crop of {name}", { name: f.from }) : f.name;
    const unit = f.scale ? `<span class="rf-size">${esc(t("in {unit}, converted to micrometres", { unit: t(f.unit) }))}</span>` : "";
    return `<div class="ready-file">${tag}<span class="rf-name" title="${esc(f.name)}">${esc(name)}</span>${unit}<span class="rf-size">${size(f.content.length)}</span></div>`;
  };
  let title, text, label, run, idle = true;
  if (s === "1" && _file1Failed) {
    title = t("This point cloud could not be analysed");
    text = t("The message above the view says why. Open another point cloud, or change the settings and analyse it again.");
    label = t("Analyse again"); run = runPvisual; idle = !document.getElementById("run-pvisual").disabled;
  } else if (s === "1") {
    title = t("Point cloud opened");
    text = t("Click <b>Analyse</b> to level and align the surface, find the channel and measure it.");
    label = t("Analyse"); run = runPvisual; idle = !document.getElementById("run-pvisual").disabled;
  } else if (files["A"] && files["B"]) {
    title = t("Surfaces A and B are ready");
    text = t("Click <b>Compare</b> to grade how closely B matches A, with RQ, RQ<sub>dx</sub>, RQ<sub>dy</sub> and RQ<sub>d</sub>.");
    label = t("Compare"); run = runGradient; idle = !document.getElementById("run-gradient").disabled;
  } else {
    const need = files["A"] ? "B" : "A";
    title = t(need === "B" ? "Surface A opened" : "Surface B opened");
    text = t(need === "B" ? "Now open surface <b>B</b>, the surface compared with A, or analyse its scan and click <b>Keep as B</b>."
                          : "Now open surface <b>A</b>, the reference, or analyse its scan and click <b>Keep as A</b>.");
    label = t(need === "B" ? "Open B…" : "Open A…"); run = () => document.getElementById("file" + need + "-input").click();
  }
  document.getElementById("ready-title").textContent = title;
  const failed = s === "1" && _file1Failed;           // a warning sign instead of the green check
  box.querySelector(".ready-head").classList.toggle("failed", failed);
  box.querySelector(".ready-head use").setAttribute("href", failed ? "#i-info" : "#i-check");
  document.getElementById("ready-files").innerHTML = s === "1" ? row("1") : row("A") + row("B");
  document.getElementById("ready-text").innerHTML = text;
  const btn = document.getElementById("ready-run");
  btn.textContent = label; btn.disabled = !idle; box._run = run;
  document.getElementById("ready-settings-label").textContent = t("Settings");
  let note = _nChanged ? t(_nChanged > 1 ? "{n} analysis settings differ from the paper defaults. To check or change them, press <b>Settings</b>."
                                         : "{n} analysis setting differs from the paper defaults. To check or change it, press <b>Settings</b>.", { n: _nChanged })
                       : t("The analysis uses the default settings of the paper. To change them before you start, press <b>Settings</b>.");
  if (!ready) note += " " + t("MaRQ is still starting; the button works in a moment.");
  document.getElementById("ready-note").innerHTML = note;
}

// The tip under the view title after each step: what finished, what can come next, and the
// next steps as buttons. Closed with ×; "Hide tips" (or the box in Help) turns them off.
function tipsOn() { try { return localStorage.getItem(LS.tips) !== "off"; } catch { return true; } }
function setTips(on) {
  try { localStorage.setItem(LS.tips, on ? "on" : "off"); } catch {}
  document.getElementById("tips-on").checked = on;
  renderGuide();
}
// a tip belongs to the result it is about (an analysis or a comparison) and goes when a view
// of another result is opened
function showGuide(kind, slot) {
  const kept = slot && files[slot] && files[slot].aid;
  _guide = { kind, slot, owner: kind === "compared" || kind === "batch" ? _curC : kept || _curA };
  renderGuide();
}
function hideGuide() { _guide = null; renderGuide(); }

function renderGuide() {
  const bar = document.getElementById("guide-bar");
  if (!_guide || !tipsOn()) { bar.style.display = "none"; return; }
  const A = !!files["A"], B = !!files["B"], { kind, slot } = _guide;
  const KEEP_A = ["Keep as A", () => keepAs("A")], KEEP_B = ["Keep as B", () => keepAs("B")], REPORT = ["Report", makeReport];
  let text, acts;
  if (kind === "analysed") {
    // short enough for one line beside the buttons at 1366 pixels with both panes open
    if (!A && !B) {
      text = "<b>Analysis finished.</b> Keep it as <b>A</b>, the reference, or as <b>B</b>.";
      acts = [KEEP_A, KEEP_B, REPORT];
    } else if (A && !B) {
      text = "<b>Analysis finished.</b> Keep it as <b>B</b> to compare it with A.";
      acts = [KEEP_B, REPORT, KEEP_A];
    } else if (!A && B) {
      text = "<b>Analysis finished.</b> Keep it as <b>A</b>, the reference for B.";
      acts = [KEEP_A, REPORT, KEEP_B];
    } else {
      text = "<b>Analysis finished.</b> It can replace surface <b>A</b> or <b>B</b>.";
      acts = [KEEP_A, KEEP_B, REPORT];
    }
  } else if (kind === "kept") {
    if (A && B) {
      text = "<b>Surfaces A and B are set.</b> <b>Compare</b> grades how closely B matches A.";
      acts = [["Compare", runGradient]];
    } else {
      text = slot === "A" ? "<b>Surface A is set.</b> Now open and analyse the other surface."
                          : "<b>Surface B is set.</b> Now open and analyse the reference.";
      acts = [["Open a point cloud…", () => document.getElementById("file1-input").click()]];
    }
  } else if (kind === "compared") {
    text = "<b>Comparison finished.</b> RQ<sub>d</sub> is under Properties.";
    acts = [REPORT, ["Figure", () => openExportDialog()], ["Save the session…", saveSession]];
  } else {
    text = "<b>Batch finished.</b> Every comparison is in <b>Batch results</b>.";
    acts = [["Results CSV", exportCSV], REPORT];
  }
  const tx = document.getElementById("gb-text");
  tx.innerHTML = t(text);
  tx.title = tx.textContent;                          // the whole tip, when the bar is too narrow for it
  const box = document.getElementById("gb-actions");
  box.innerHTML = "";
  acts.forEach(([label, fn], i) => {
    const b = document.createElement("button");
    b.className = "btn btn-mini" + (i === 0 ? " btn-primary" : "");
    b.textContent = t(label);
    b.addEventListener("click", () => { if (!running && !_reporting) fn(); });
    box.appendChild(b);
  });
  document.getElementById("gb-off").textContent = t("Hide tips");
  document.getElementById("gb-off").title = t("Turn the tips off; Help (?) turns them on again");
  document.getElementById("gb-close").title = t("Close");
  bar.style.display = "flex";
}

// The command a first-time user most likely needs next is outlined in the ribbon.
function updateNext() {
  let next = null;
  const cropInA = files["A"] && files["A"].isCrop && files["A"].from === _cropSource;
  if (!files["1"] && !files["A"]) next = "open-surface";
  else if (files["1"] && !_file1Analysed) next = "run-pvisual";
  else if (files["A"] && files["B"]) next = session.comparisons.length ? null : "run-gradient";
  else if (_cropAvailable && !files["A"]) next = "use-crop-a";
  else if (_cropAvailable && !files["B"] && !cropInA) next = "use-crop-b";
  else if (!files["B"]) next = "open-surface";
  document.querySelectorAll("#ribbon .next").forEach((el) => el.classList.remove("next"));
  if (next && ready) document.getElementById(next).classList.add("next");
}

// ── Drag & Drop ────────────────────────────────────────────────────────────────

function setupDropZone(zoneId, slot) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener("dragenter", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragover",  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
  zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag-over"); });
  zone.addEventListener("drop", (e) => {
    e.preventDefault(); e.__marqDone = true;      // the window's handler only ends the drag
    zone.classList.remove("drag-over");
    if (slot === "batch") { handleBatchInput(e.dataTransfer.files); return; }
    const file = e.dataTransfer.files[0];
    if (file) readFile(file, slot);
  });
}

// a file dropped anywhere else on the window goes to the scan slot
function setupWindowDrop() {
  const app = document.getElementById("app");
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
  window.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; depth++; app.classList.add("dropping"); });
  window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; app.classList.remove("dropping"); } });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    e.preventDefault(); depth = 0; app.classList.remove("dropping");
    if (e.__marqDone) return;
    const list = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    const f = list[0];
    if (!f) return;
    if (/\.json$/i.test(f.name)) { loadParamsFile({ files: [f] }); return; }      // a settings file
    readFile(f, "1");
    if (list.length > 1) showNotice(null, () => t("Only the first file, {name}, was opened. To compare several surfaces with A, drop them on Batch files… in the ribbon.", { name: f.name }), "warn");
  });
}

// ── Crop export and hand-over ──────────────────────────────────────────────────
// The point list stays in the worker; the text is requested once and cached until
// the next single-surface run.

// The crop of an analysis as text: cached, or asked of the engine while it holds the analysis.
function cropText(a) {
  if (a.crop.text) return Promise.resolve(a.crop.text);
  if (!a.held || !a.crop.available) return Promise.reject(new Error("the crop is no longer held"));
  setStatus("Preparing the cropped channel…", "info");
  return ask("export_crop", { aid: a.id }, "crop").then((m) => {
    a.crop.text = m.data;
    if (a.id === _curA) _cropText = m.data;
    return m.data;
  });
}

// A crop saved by MaRQ is named <scan>_Crop_Voxel<size>.txt (earlier versions: _CroppedVoxel).
function isCropName(name) { return /crop/i.test(name || ""); }

// Keep as A or B keeps the analysis on screen. Asked first when the point cloud in the Scan
// slot has not been analysed (it would keep the earlier analysis instead), and refused when
// the analysis on screen is already the other surface (a surface compared with itself).
function keepAs(slot) {
  const a = _A[_curA];
  if (!a || !ready) return;
  const other = slot === "A" ? "B" : "A", f = files["1"], inOther = !!(files[other] && files[other].aid === a.id);
  if (f && !_file1Analysed && !f.isCrop) {
    const buttons = [[t("Analyse it, then keep it as {slot}", { slot }), () => analyseThenKeep(slot), true]];
    if (!inOther) buttons.push([t("Keep {name} as {slot} instead", { name: a.file, slot }), () => useCrop(slot)]);
    buttons.push([t("Cancel"), null]);
    askUser(t("Not analysed yet"),
      t("<b>{scan}</b> is open but has not been analysed yet. Keep as {slot} keeps the cropped channel of an analysed surface, and the analysis on screen is that of <b>{name}</b>.", { scan: esc(f.name), slot, name: esc(a.file) }) +
      (inOther ? " " + t("That one is already surface {other}.", { other }) : "") + " " + t("Analyse {scan} first.", { scan: esc(f.name) }),
      buttons);
    return;
  }
  if (inOther) {
    askUser(t("Already surface {other}", { other }),
      t("<b>{name}</b> is already surface {other}. A surface compared with itself always gives RQ = 1. Open and analyse the other surface, then keep that one as {slot}.", { name: esc(a.file), other, slot }),
      [[t("Close"), null, true]]);
    return;
  }
  useCrop(slot);
}

// Analyse the point cloud in the Scan slot and keep it as A or B when the analysis is done.
function analyseThenKeep(slot) {
  if (!ready || running || !files["1"]) { setStatus("Analyse the point cloud, then keep it as {slot}", "info", { slot }); return; }
  runPvisual();
  if (running && _run && _run.kind === "pvisual") _keepAfter = { slot, aid: _run.aid };
}

// A short question with its answers as buttons: [label, action or null, primary].
function askUser(title, html, buttons) {
  document.getElementById("ask-title").textContent = title;
  document.getElementById("ask-body").innerHTML = html;
  const box = document.getElementById("ask-buttons");
  box.innerHTML = "";
  buttons.forEach(([label, fn, primary]) => {
    const b = document.createElement("button");
    b.className = "btn" + (primary ? " btn-primary" : "");
    b.textContent = label;
    b.addEventListener("click", () => { closeModal("modal-ask"); if (fn) fn(); });
    box.appendChild(b);
  });
  openModal("modal-ask");
  const first = box.querySelector(".btn-primary") || box.firstChild;
  if (first) first.focus();
}

function useCrop(slot) {
  const a = _A[_curA];
  if (!a || !ready) return;
  cropText(a).then((text) => {
    setFile(slot, a.crop.filename, new TextEncoder().encode(text), { isCrop: true, from: a.file, aid: a.id });
    setStatus("Crop placed as Surface {slot}", "success", { slot });
    updateButtons();
    showGuide("kept", slot);
    if (_example) exampleNext(slot);
  }).catch(() => { _example = null; });
}

// ── The example ────────────────────────────────────────────────────────────────
// A synthetic channel and a copy of it, shaped as tests/make_test_channel.py makes them: 600 µm
// floor, 300 µm deep, 10° walls, 4 mm long, on a 5 µm grid, the copy 4 µm wider and 3 µm
// shallower. Both carry one texture of about 2 µm (two sets of lines across the surface, as a
// print leaves them), the copy at 90 %, as a moulded copy carries that of its tool: without
// it MaRQ would take the smooth surfaces for a design (below 1.5 µm of floor texture) and make
// RQ the key result. Noise of 0.5 µm from a fixed seed, so every computer gets the same two
// files. Both are analysed and kept as A and B, then compared, one step after the other.

function exampleCloud(copy) {
  const W = copy ? 604 : 600, D = copy ? 297 : 300, tan = Math.tan(10 * Math.PI / 180), L = 4000;
  const tex = (x, y) => (copy ? 0.9 : 1) * (2.5 * Math.sin(2 * Math.PI * (0.866 * x + 0.5 * y) / 100)
                                          + 1.2 * Math.sin(2 * Math.PI * (0.5 * x - 0.866 * y) / 37));
  let s = copy ? 8 : 7;
  const rnd = () => {                                // mulberry32
    s = (s + 0x6D2B79F5) | 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const lines = [];
  for (let y = -900; y <= 900; y += 5)
    for (let x = 0; x < L + 1000; x += 5) {
      const d = Math.max(Math.abs(y) - W / 2, 500 - x, x - (L + 500), 0);      // distance from the floor, in plan
      lines.push(`${x.toFixed(2)} ${y.toFixed(2)} ${(-Math.min(Math.max(D - d / tan, 0), D) + tex(x, y) + 0.5 * gauss()).toFixed(2)}`);
    }
  return new TextEncoder().encode(lines.join("\n") + "\n");
}

function runExample() {
  if (!ready || running || _reporting) { setStatus("MaRQ is still starting; the button works in a moment.", "info"); return; }
  const go = () => { _example = "A"; exampleAnalyse("A"); };
  if (!files["A"] && !files["B"]) { go(); return; }
  askUser(t("Replace surfaces A and B?"),
    t("The example keeps its two channels as A and B, in place of the surfaces there now. The results so far stay in the session."),
    [[t("Run the example"), go, true], [t("Cancel"), null]]);
}

function exampleAnalyse(slot) {
  const copy = slot === "B";
  setFile("1", copy ? "example_copy_600um.txt" : "example_channel_600um.txt", exampleCloud(copy));
  _readySlot = "1";
  analyseThenKeep(slot);
  if (!running) _example = null;
}

function exampleNext(slot) {
  if (slot !== _example) return;
  if (slot === "A") { _example = "B"; exampleAnalyse("B"); }
  else { _example = null; runGradient(); }
}

function downloadCrop() {
  const a = _A[_curA];
  if (!a || !ready) return;
  saveFile(a.crop.filename, "text/plain", () => cropText(a).then((text) => new Blob([text], { type: "text/plain" })))
    .then((ok) => { if (ok) setStatus("Cropped channel saved", "success"); }).catch(() => {});
}

// ── Run handlers ───────────────────────────────────────────────────────────────

function viewOpts() {
  return { theme: _theme, quality: currentQuality(), palette: currentPalette(), equal: currentEqual(), lang: LANG };
}

function runPvisual() {
  const f = files["1"];
  if (!f || !ready || busy() || !checkParams("p-")) return;
  setRunning(true, "pvisual"); clearLog();
  const params = getPvisualParams();
  if (f.scale) params.input_scale = f.scale;           // a file not in micrometres, converted by the engine
  _run = { kind: "pvisual", file: f.name, content: f.content, params, aid: "a" + (++_aSeq) };
  setStatus("Analysing the surface…", "info");
  showRunCard("pvisual", "Analysing {name}", { name: f.name });
  worker.postMessage({ type: "run_pvisual", id: "pv1",
    data: { fileContent: f.content, fileName: f.name, params: _run.params, aid: _run.aid, ...viewOpts() } });
}

function runGradient(force) {
  const a = files["A"], b = files["B"];
  if (!a || !b || !ready || busy() || !checkParams("g-")) return;
  if (force !== true && sameBytes(a.content, b.content)) {
    askUser(t("A and B are the same file"),
      t("Surfaces A and B hold the same points, so the comparison gives RQ = 1. Open or keep another surface as B."),
      [[t("Cancel"), null, true], [t("Compare anyway"), () => runGradient(true)]]);
    return;
  }
  setRunning(true, "rq_gradient"); clearLog();
  _batchRows = []; _run = { kind: "rq_gradient", names: [a.name, b.name], params: getGradientParams(), cid: "c" + (++_cSeq) };
  setStatus("Comparing the two surfaces…", "info");
  showRunCard("rq_gradient", "Comparing {b} with {a}", { a: shortName(a.name), b: shortName(b.name) });
  worker.postMessage({ type: "run_rq_gradient", id: "rq1",
    data: { file1Content: a.content, fileName1: a.name, file2Content: b.content, fileName2: b.name,
            params: _run.params, cid: _run.cid, ...viewOpts() } });
}

function runBatch(force) {
  const a = files["A"];
  if (!a || !batchFiles.length || !ready || busy() || !checkParams("g-")) return;
  // the contents, not the names: files with the points of A, and second copies within the batch
  const same = batchFiles.filter((f) => sameBytes(f.content, a.content));
  const again = batchFiles.filter((f, i) => !same.includes(f) && batchFiles.findIndex((g) => sameBytes(g.content, f.content)) !== i);
  if (force !== true && (same.length || again.length)) {
    const names = (l) => l.slice(0, 4).map((f) => "<b>" + esc(f.name) + "</b>").join(", ") + (l.length > 4 ? ", …" : "");
    const say = [];
    if (same.length) say.push(t("{names}: the same points as surface A, so compared with it they give RQ = 1.", { names: names(same) }));
    if (again.length) say.push(t("{names}: the same points as another file of the batch.", { names: names(again) }));
    const rest = batchFiles.filter((f) => !same.includes(f) && !again.includes(f));
    const buttons = rest.length ? [[t("Leave them out"), () => { batchFiles = rest; updateBatchCount(); updateButtons(); runBatch(true); }, true]] : [];
    askUser(t("Repeated surfaces in the batch"), say.join(" "),
      [...buttons, [t("Compare them anyway"), () => runBatch(true), !rest.length], [t("Cancel"), null]]);
    return;
  }
  setRunning(true, "rq_gradient"); clearLog();
  _batchRunning = true;
  _batchRows = [];
  _run = { kind: "rq_gradient", names: [a.name, batchFiles.at(-1).name], params: getGradientParams(),
           batch: { a: { ...a }, items: batchFiles.slice() }, cid: "c" + (++_cSeq) };
  setStatus("Batch: {n} comparisons…", "info", { n: batchFiles.length });
  showRunCard("rq_gradient", "Comparing {n} surfaces with {a}", { n: batchFiles.length, a: shortName(a.name) });
  worker.postMessage({ type: "run_batch", id: "batch",
    data: { file1Content: a.content, fileName1: a.name,
            items: batchFiles.map((f) => ({ name: f.name, content: f.content })),
            params: _run.params, cid: _run.cid, ...viewOpts() } });
}

// ── Parameters ─────────────────────────────────────────────────────────────────

function num(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const v = parseFloat(el.value);
  return isNaN(v) ? fallback : v;
}

function getPvisualParams() {
  return {
    margin: num("p-margin", 100), voxel_size: num("p-voxel", 5),
    display_cell: num("p-cell", 0),
    smooth_sigma: num("p-sigma", 0), n_slices: Math.round(num("p-slices", 80)),
    opening_frac: num("p-ofrac", 0.10), floor_width_frac: num("p-flfrac", 0.90),
    crop_pad_x: num("p-cropx", 180), crop_pad_y: num("p-cropy", 100),
    skip_rows: Math.round(num("p-skiprows", 0)),
    field_k: num("p-fieldk", 2.5),
    floor_eval_frac: num("p-rfloor", 0.5),
    floor_eval_length: num("p-rfloorlen", 4000),
    field_eval_width: num("p-rfwidth", 400),
    field_eval_length: num("p-rflen", 4000),
    feature: document.getElementById("p-feature").value,
  };
}

function getGradientParams() {
  return { grid_spacing: num("g-spacing", 5), smooth_sigma: num("g-sigma", 0), skip_rows: Math.round(num("p-skiprows", 0)) };
}

const _paramDefaults = {};

// a setting's value as text (a check box: "1" or "0")
function paramValue(el) { return el.type === "checkbox" ? (el.checked ? "1" : "0") : el.value; }

// two values of a setting: numbers compared as numbers, the choices of a list (Feature) as text
function sameParam(a, b) {
  const x = parseFloat(a), y = parseFloat(b);
  return isNaN(x) || isNaN(y) ? String(a) === String(b) : x === y;
}

// The Feature setting of an analysis: settings of before it have turn_over, which is Ridge when true
const FEATURE_NAMES = { auto: "Automatic", channel: "Channel", ridge: "Ridge" };
function featureOf(params) { return (params && params.feature) || (params && params.turn_over ? "ridge" : "auto"); }

// The Feature setting describes one scan: Channel or Ridge goes back to Automatic when another point
// cloud is opened for analysis, so that it does not turn the next scan the wrong way. true: it did.
function resetFeature() {
  const el = document.getElementById("p-feature");
  if (!el || el.value === "auto") return false;
  el.value = "auto";
  markChangedParams(); saveParamsLocal();
  return true;
}

function collectParamValues() {
  const o = {};
  PARAM_IDS.forEach((id) => { const el = document.getElementById(id); if (el) o[id] = paramValue(el); });
  return o;
}

function applyParamValues(o) {
  // settings of before the Feature setting (a file, a session, this computer): the Raised feature
  // check box, ticked, is Ridge
  if (o && o["p-feature"] == null && o["p-raised"] != null)
    o = { ...o, "p-feature": o["p-raised"] === true || String(o["p-raised"]) === "1" ? "ridge" : "auto" };
  PARAM_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || o[id] === undefined || o[id] === null) return;
    if (el.tagName === "SELECT" && !Array.from(el.options).some((op) => op.value === String(o[id]))) return;
    if (el.type === "checkbox") el.checked = o[id] === true || String(o[id]) === "1";
    else el.value = String(o[id]);
    el.dispatchEvent(new Event("input"));     // updates the slider labels
  });
  markChangedParams();
}

// a setting that cannot be used: empty, not a number, or below its minimum
function badParam(el) { const v = el.validity || {}; return el.type !== "checkbox" && (el.value === "" || v.badInput || v.rangeUnderflow || v.rangeOverflow); }

// Before a run: unusable settings are marked in the Settings dialog, which opens.
function checkParams(prefix) {
  const bad = PARAM_IDS.filter((id) => id.startsWith(prefix) || SHARED_PARAMS.includes(id))
    .map((id) => document.getElementById(id)).filter((el) => el && badParam(el));
  if (!bad.length) return true;
  markChangedParams();
  openModal("modal-settings");
  bad[0].focus();
  const names = () => bad.map((el) => { const l = el.closest(".param-card").querySelector(".param-label"); return l ? l.textContent : el.id; });
  showNotice("Check the settings", () => t("These settings are empty or out of range: {list}.", { list: names().join("; ") }), "warn");
  return false;
}

function rangeLabel(el) {
  const out = document.getElementById(el.id + "-val");
  if (out) out.textContent = decimal(parseFloat(el.value).toFixed(2));
}

function markChangedParams() {
  if (!Object.keys(_paramDefaults).length) return;          // before the settings are set up
  let n = 0;
  PARAM_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const changed = !sameParam(paramValue(el), _paramDefaults[id]);
    el.closest(".param-card").classList.toggle("changed", changed);
    el.closest(".param-card").classList.toggle("invalid", !!badParam(el));
    if (changed) n++;
  });
  document.getElementById("params-note").textContent =
    n ? t(n > 1 ? "{n} values differ from the paper defaults (marked)." : "{n} value differs from the paper defaults (marked).", { n })
      : t("All values are the paper defaults.");
  document.getElementById("params-reset").classList.toggle("attention", n > 0);
  document.getElementById("params-summary").textContent = n ? t("Settings: {n} changed from the paper", { n }) : t("Paper defaults");
  _nChanged = n; updateStart();
  document.getElementById("settings-summary").classList.toggle("changed", n > 0);
  document.getElementById("settings-dot").style.display = n ? "" : "none";
  updateStale();
}

// ── Results made with other settings ───────────────────────────────────────────
// A result keeps the settings it was made with; when those in the dialog differ, its node in the
// browser is marked and Properties says which settings changed.

// the display cell and the display smoothing of an analysis change its figures, not its numbers; the
// Feature describes the scan, and goes back to Automatic when another file is opened
const DISPLAY_ONLY = ["display_cell", "smooth_sigma"], PER_FILE = ["feature"];

function changedSince(kind, params) {
  if (!params) return [];
  const now = kind === "pvisual" ? getPvisualParams() : getGradientParams();
  return Object.keys(now).filter((k) => !(kind === "pvisual" && (DISPLAY_ONLY.includes(k) || PER_FILE.includes(k)))
                                        && params[k] != null && !sameParam(params[k], now[k]));
}

function paramLabel(kind, key) {
  const id = Object.keys(PARAM_KEYS).find((i) => PARAM_KEYS[i] === key && (i.startsWith(kind === "pvisual" ? "p-" : "g-") || SHARED_PARAMS.includes(i)));
  const lab = id && document.getElementById(id).closest(".param-card").querySelector(".param-label");
  return lab ? lab.textContent : key;
}

function staleNote(kind, a) {
  const diff = kind === "pvisual" ? changedSince(kind, a && a.record && a.record.parameters) : changedSince(kind, _cmpParams);
  if (!diff.length) return "";
  const list = diff.map((k) => paramLabel(kind, k)).join("; ");
  return `<div class="pnote stale"><b>${esc(t("Made with other settings"))}</b> ` + esc(t(kind === "pvisual"
    ? "Changed since this analysis: {list}. Its numbers are those of the earlier settings; analyse the file again to use the new ones."
    : "Changed since this comparison: {list}. Its numbers are those of the earlier settings; compare again to use the new ones.", { list })) + "</div>";
}

function updateStale() {
  const title = t("Made with other settings than those in Settings now");
  document.querySelectorAll("#tree-analyses .tnode.analysis").forEach((n) => {
    const a = _A[n.dataset.aid], stale = !!(a && changedSince("pvisual", a.record && a.record.parameters).length);
    n.classList.toggle("stale", stale);
    n.querySelector(".anode").title = stale ? title : "";
  });
  document.querySelectorAll("#tree-comparisons .tnode.comparison").forEach((n) => {
    const c = _C[n.dataset.cid], stale = !!(c && changedSince("rq_gradient", c.params).length);
    n.classList.toggle("stale", stale);
    n.querySelector(".cnode").title = stale ? title : (c ? c.title : "");
  });
  if (_view && VIEWS[_view]) showProps(VIEWS[_view].kind);
}

function resetParams() {
  applyParamValues(_paramDefaults);
  try { localStorage.removeItem(LS.params); } catch {}
  markChangedParams();
}

function saveParamsLocal() {
  try { localStorage.setItem(LS.params, JSON.stringify(collectParamValues())); } catch {}
}

function restoreParamsLocal() {
  try {
    const s = localStorage.getItem(LS.params);
    if (s) applyParamValues(JSON.parse(s));
  } catch {}
}

function saveParamsFile() {
  const o = { software: `${APP.name} ${APP.version}`, saved: new Date().toISOString(),
              single_surface: getPvisualParams(), comparison: getGradientParams(), controls: collectParamValues() };
  saveFile("marq_parameters.json", "application/json", textBlob(JSON.stringify(o, null, 2), "application/json")).catch(() => {});
}

function loadParamsFile(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      const o = JSON.parse(ev.target.result), src = o.controls || o;
      if (!PARAM_IDS.some((id) => src[id] !== undefined && src[id] !== null)) throw new Error("no settings in the file");
      applyParamValues(src);
      saveParamsLocal();
      setStatus("Settings loaded", "success");
    } catch (err) { setStatus("Settings file not understood", "error"); }
  };
  r.readAsText(f);
  if ("value" in input) input.value = "";
}

function setupParams() {
  PARAM_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    _paramDefaults[id] = paramValue(el);          // the values written in the page are the paper's
    el.addEventListener("input",  () => { markChangedParams(); });
    el.addEventListener("change", () => { markChangedParams(); saveParamsLocal(); });
  });
  restoreParamsLocal();
  markChangedParams();
}

// ── Results ────────────────────────────────────────────────────────────────────

function onResult(kind, jsonStr, msg) {
  const result = JSON.parse(jsonStr);
  _lastKind = kind;                                 // whether the engine holds it: selectAnalysis and selectComparison say
  if (!msg.retheme) _serial[kind]++;
  if (kind === "pvisual")          renderPvisual(result, !!msg.retheme, msg);
  else if (kind === "rq_gradient") renderGradient(result, !!msg.retheme, msg);
  if (msg.retheme && _restoring && --_restoring.n <= 0) {
    const v = _restoring.view, V = v && VIEWS[v];
    _restoring = null;
    const can = V && (V.kind === "session" || (V.type === "html" ? _lastBatch : _figs[V.kind]));
    showView(can ? v : (_figs.rq_gradient ? "gradA" : "channel"), { aid: _curA, cid: _curC });
  }
  updateButtons();
}

const UM = " µm";
const fix   = (v, d) => { const s = Number(v).toFixed(d); return decimal(/^-0\.?0*$/.test(s) ? s.slice(1) : s); };   // no "-0.0"
const intl  = (n) => Number(n).toLocaleString(LANG === "tr" ? "tr-TR" : "en-GB");
const fmt   = (v, d = 2) => (v == null || isNaN(v)) ? "–" : fix(v, d);
const fmtPm = (v, e, d = 2) => (v == null || isNaN(v)) ? "–" :
  `${fix(v, d)} <span class="pm">± ${(e == null || isNaN(e)) ? "–" : fix(e, d)}</span>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TIPS = {
  floor_width: "Channel width at the floor level (90 % of the depth by default): median over the grid lines across the central 80 % of the channel, each wall position interpolated between grid points. The figure the nominal width is compared with.",
  width_sd: "Standard deviation of the grid-line floor widths over the central 80 % of the channel length: within-scan variation, not an uncertainty of the median.",
  opening_width: "Channel width near the field (10 % of the depth by default), median of the grid lines, with their standard deviation.",
  depth: "Median height of the deepest 5 % of the mean cross-section bins, below the field at z = 0.",
  draft: "Mid-wall angle from the vertical: a straight line through the wall positions at 25-75 % of the depth on every grid line, median over the lines and both walls (the walls at −Y and +Y in brackets). Below 3° the wall spans too few grid cells to be resolved.",
  corners: "Corner rounding: how far the wall lies inside the extended mid-wall line at the floor level (floor corner) and outside it at the opening level (rim corner), per corner.",
  floor_length: "Channel length along the centre line at the floor level: median of the grid lines along the channel near its centre line, each end read from the outside in, with their standard deviation.",
  opening_length: "Channel length along the centre line at the opening level.",
  orientation: "Whether the feature was a depression, or a protrusion rotated to a depression (a proper rotation, so handedness is kept).",
  f_y: "Wall dominance f_y: the share of the squared slope carried by the slope across the channel, over the channel interior (deeper than 0.20 of the depth) of the central 60 % of the crop, on a grid of the voxel size. Near 1, the slopes, and with them RQd, are governed by the sidewalls.",
  RQ:   "Pearson correlation of the two height maps over the channel-interior mask.",
  RQdx: "Pearson correlation of the signed slopes along the channel over the mask.",
  RQdy: "Pearson correlation of the signed slopes across the channel over the mask.",
  RQd:  "Pearson correlation of the slope-magnitude maps over the channel-interior mask at the stated grid cell size (5 µm in the paper). The grading metric of the paper.",
};

const prow = (label, val, tip, cls = "") =>
  `<div class="prow ${cls}" title="${esc(tip ? t(tip) : "")}"><span class="pk">${label}</span><span class="pv">${val}</span></div>`;

// the properties of an analysis, from its results (as they come from the engine, or as kept in
// the session record: the report rebuilds those of results not opened yet, or made in another language)
function analysisProps(a, ch, rot, rgh) {
  const floorPct = Math.round((ch.floor_width_frac != null ? ch.floor_width_frac : 0.90) * 100);
  const orient = t(!rot.converted ? (rot.feature === "channel" ? "depression (Feature: Channel, in Settings)" : "depression")
    : rot.turned_over ? "raised, turned over (Feature: Ridge, in Settings)" : "protrusion, rotated");
  const wa = ch.wall_angle_deg != null ? ch.wall_angle_deg : ch.draft_angle_deg;
  // lengths to 0.1 µm and the wall angles to 0.1° everywhere (Properties, figures, report); the
  // two walls and the two field strips named by their side of the channel, -Y and +Y, which reads
  // the same on the maps (lower and upper) and on the cross-sections (left and right)
  const wallTxt = (ch.wall_angle_resolved === false && wa != null && !isNaN(wa)) ? "< 3°"
    : fmt(wa, 1) + "°" + (ch.wall_angle_left_deg != null
        ? ` <span class="pm">(−Y ${fmt(ch.wall_angle_left_deg, 1)}° · +Y ${fmt(ch.wall_angle_right_deg, 1)}°)</span>` : "");
  const rr = (label, r) => r
    ? `<tr><td>${label}</td><td>${fmt(r.Sa, 2)}</td><td>${fmt(r.Sq, 2)}</td><td>${fmt(r.Sz, 1)}</td><td>${fmt(r.Ssk, 2)}</td><td>${fmt(r.Sku, 2)}</td></tr>`
    : `<tr><td>${label}</td><td colspan="5">–</td></tr>`;
  const scale = ((a.record && a.record.parameters) || (_run && _run.params) || {}).input_scale;
  const unitOf = Object.keys(UNIT_SCALE).find((u) => UNIT_SCALE[u] === scale);

  return `
    <div class="pgroup"><div class="pgroup-head">${t("Channel geometry")}</div>
      ${prow(`${t("Floor width")} <small>${t("{p} % of depth", { p: floorPct })}</small>`, fmt(ch.floor_width, 1) + UM, TIPS.floor_width, "key big")}
      ${prow(t("Channel depth"), fmt(ch.mean_depth, 1) + UM, TIPS.depth, "key big")}
      ${prow(`${t("Wall angle")} <small>${t("from vertical")}</small>`, wallTxt, TIPS.draft, "key big")}
      ${prow(`${t("Width variation")} <small>${t("SD, central 80 %")}</small>`, fmt(ch.floor_width_conf, 1) + UM, TIPS.width_sd)}
      ${prow(t("Opening width"), fmtPm(ch.opening_width, ch.opening_width_conf, 1) + UM, TIPS.opening_width)}
      ${prow(t("Corner rounding"), `${t("floor")} ${fmt(ch.floor_corner_um, 1)} · ${t("rim")} ${fmt(ch.rim_corner_um, 1)}` + UM, TIPS.corners)}
      ${ch.f_y != null ? prow(`${t("Wall dominance")} <small>f<sub>y</sub></small>`, fmt(ch.f_y, 3), TIPS.f_y) : ""}
      ${prow(t("Floor length"), fmtPm(ch.mean_length, ch.mean_length_conf, 1) + UM, TIPS.floor_length)}
      ${prow(t("Opening length"), fmtPm(ch.opening_length, ch.opening_length_conf, 1) + UM, TIPS.opening_length)}
      ${prow(t("Feature"), orient, TIPS.orientation)}
    </div>
    <div class="pgroup"><div class="pgroup-head">${t("Roughness, ISO 25178")} <span style="text-transform:none;letter-spacing:0;font-weight:500">(µm)</span></div>
      <table class="ptable">
        <thead><tr><th></th><th>Sa</th><th>Sq</th><th>Sz</th><th>Ssk</th><th>Sku</th></tr></thead>
        <tbody>${rr(t("Floor"), rgh && rgh.floor)}${rr(t("Field, −Y side"), rgh && rgh.surf_left)}${rr(t("Field, +Y side"), rgh && rgh.surf_right)}</tbody>
      </table>
    </div>
    <div class="pgroup"><div class="pgroup-head">${t("Alignment")}</div>
      ${prow(t("Rotation about Z"), fmt(rot.phi, 2) + "°")}
      ${prow(t("Residual tilt"), `XZ ${fmt(rot.xz_tilt, 2)}° · YZ ${fmt(rot.yz_tilt, 2)}°`)}
      ${prow(t("Voxel size"), fmt(rot.voxel_size, 1) + UM)}
      ${unitOf ? prow(t("Point cloud units"), esc(t("{unit}, converted", { unit: t(unitOf) }))) : ""}
    </div>`;
}

function renderPvisual(result, retheme, msg = {}) {
  if (retheme && msg.aid && !_A[msg.aid]) return;      // removed while its figures were drawn again: nothing to show
  const aid = msg.aid || (_run && _run.aid) || ("a" + (++_aSeq));
  let a = _A[aid];
  if (!a) {                                   // a new analysis (the scan slot may hold another file by now)
    const file = (_run && _run.file) || "";
    a = _A[aid] = { id: aid, file, name: uniqueName(stem(file) || "surface"), record: null, figs: null, props: null,
                    held: true, staleKeys: new Set(), rebuilding: false, crop: { filename: null, available: false, text: null } };
  }
  // a redraw of some figures replaces those; the others keep theirs, and stay stale
  a.figs = msg.partial && a.figs ? { ...a.figs, ...result.figures } : result.figures;
  if (!msg.partial || !a.staleKeys) a.staleKeys = new Set();
  Object.keys(result.figures || {}).forEach((k) => a.staleKeys.delete(k));
  a.held = true; a.rebuilding = false; a.propsLang = LANG;
  if (a.again) { a.again = false; a.staleKeys = new Set(Object.keys(a.figs)); }   // the options changed during the redraw
  (msg.dropped || []).forEach((id) => { if (_A[id]) _A[id].held = false; });
  const fname = a.file;
  const ch = result.channel_info, rot = result.rotation_info, rgh = result.roughness_info;
  a.props = analysisProps(a, ch, rot, rgh);

  if (!retheme) {
    _file1Analysed = !!(files["1"] && _run && files["1"].content === _run.content);   // not a file opened meanwhile
    if (_file1Analysed) _file1Failed = false;
    if (result.crop_points > 0)
      a.crop = { filename: `${stem(fname || "cloud")}_Crop_Voxel${voxTag(rot.voxel_size)}.txt`, available: true, text: null };
    a.record = {
      file: fname, time: new Date().toISOString(), parameters: (_run && _run.params) || getPvisualParams(),
      channel: ch, rotation: rot, roughness: rgh, display_cells: result.display_cells,
      profile: result.profile, slices: result.slices,
    };
    session.analyses.push(a.record);
    addAnalysisNode(a);
    selectAnalysis(aid);
    showView("channel", { aid });
    setStatus("Surface analysis complete", "success");
    if (!_restoring) showGuide("analysed");
    if (_keepAfter && _keepAfter.aid === aid) { const s = _keepAfter.slot; _keepAfter = null; useCrop(s); }
    // a channel no deeper than the roughness of the field is noise: say so
    // and Channel or Ridge set in Settings with nothing on that side: most likely the other kind
    const sq = Math.max(...["surf_left", "surf_right"].map((k) => (rgh && rgh[k] && rgh[k].Sq) || 0));
    if (rot.feature_side_empty)
      showNotice("Check the Feature setting", () => t(rot.feature === "channel"
        ? "Feature is set to Channel in Settings, but nothing in this scan lies below the flat surface around it, so it most likely shows a ridge and the measured geometry has no meaning. Set Feature to Ridge or Automatic and analyse it again."
        : "Feature is set to Ridge in Settings, but nothing in this scan rises above the flat surface around it, so it most likely shows a channel and the measured geometry has no meaning. Set Feature to Channel or Automatic and analyse it again."), "warn");
    else if (!(ch.mean_depth > Math.max(1, 5 * sq)))
      showNotice("No clear channel in this scan", () => t("The channel found is {d} µm deep, close to the roughness of the flat surface around it, so the measured geometry has no meaning. Check that the scan contains the channel and that the edge margin (Settings, Advanced) does not cut it away.",
        { d: fmt(ch.mean_depth, 2) }) + " " + t(rot.turned_over ? "The scan was turned over (Feature: Ridge, in Settings): for a channel, set Feature to Automatic or Channel and analyse it again."
          : "If the scan shows a raised feature, a ridge, set Feature to Ridge in Settings and analyse it again."), "warn");
  } else if (aid === _curA) {
    selectAnalysis(aid);
    const next = a.pendingView || (_view && VIEWS[_view].kind === "pvisual" ? _view : null);
    a.pendingView = null;
    if (next) showView(next, { aid, keepCamera: true });
    if (_lastStatus && _lastStatus[0] === "Drawing the analysis…")      // drawn: the status from before returns
      setStatus(...(_statusBeforeDraw || ["Ready", "success"]));
  }
  updateAnalysisNodes();
}

// ── The analyses in the tree ────────────────────────────────────────────────────
// Every analysed point cloud has a node with all its views; a click on any of them shows that
// analysis, and its properties, its crop (Keep as A or B, Save crop) and its exports follow.

function uniqueName(base) {
  const used = new Set(Object.values(_A).map((a) => a.name));
  let n = base, k = 2;
  while (used.has(n)) n = `${base} (${k++})`;
  return n;
}

function addAnalysisNode(a) {
  const node = document.getElementById("tpl-analysis").content.firstElementChild.cloneNode(true);
  node.dataset.aid = a.id;
  node.querySelectorAll(".trow").forEach((r) => { r.dataset.aid = a.id; r.tabIndex = 0; });
  const nm = node.querySelector(".aname");
  nm.textContent = a.name; nm.title = a.file;
  const box = document.getElementById("tree-analyses");
  box.querySelectorAll(".tnode.analysis").forEach((n) => n.classList.remove("open"));      // the older ones fold
  box.appendChild(node);
  applyLanguage(LANG);                                                                    // the new rows in the interface language
}

function updateAnalysisNodes() {
  document.querySelectorAll("#tree-analyses .tnode.analysis").forEach((n) => {
    const a = _A[n.dataset.aid];
    if (!a) return;
    const slots = ["A", "B"].filter((k) => files[k] && files[k].aid === a.id);
    n.querySelector(".aslot").textContent = slots.join(" ");
    n.classList.toggle("current", a.id === _curA);
    n.classList.toggle("unheld", !a.held);
  });
  updateComparisonNodes();
}

function selectAnalysis(aid) {
  const a = _A[aid];
  if (!a) return;
  _curA = aid;
  _figs.pvisual = a.figs; _props.pvisual = a.props; _have.pvisual = !!a.held;
  _cropFilename = a.crop.filename; _cropSource = a.file; _cropText = a.crop.text;
  _cropAvailable = !!(a.crop.text || (a.held && a.crop.available));
  updateAnalysisNodes();
  updateButtons();
}

// figures of the analysis in the theme, language and settings of the moment (when the engine
// holds it): those named in keys, or all; the view follows when they arrive. A view opened
// during a redraw asks for its own figure when that redraw has ended.
function rebuildAnalysis(aid, thenView, keys) {
  const a = _A[aid];
  if (!a || !a.held) return;
  if (thenView) a.pendingView = thenView;
  const opts = viewOpts(), key = JSON.stringify(opts);
  if (a.rebuilding) {                           // a redraw is under way: once more when it ends, if the options changed meanwhile
    if (key !== a.rebuildKey) a.again = true;
    return;
  }
  a.rebuilding = true; a.rebuildKey = key;
  worker.postMessage({ type: "retheme", id: "rt-" + aid, data: { kind: "pvisual", aid, keys: keys || null, ...opts } });
}

// the figure a view draws (none for the cross-section and table views)
function viewKeys(id) {
  const v = VIEWS[id];
  return v && v.key && (v.type === "2d" || v.type === "3d") ? [v.key] : [];
}

function removeAnalysis(aid) {
  const a = _A[aid];
  if (!a || busy()) return;
  askUser(t("Remove the analysis?"),
    t("Remove the analysis of <b>{name}</b> from this session? Its results leave the session and the exports.", { name: esc(a.name) }),
    [[t("Cancel"), null, true], [t("Remove"), () => forgetAnalysis(aid)]]);
}

function forgetAnalysis(aid) {
  const a = _A[aid];
  if (!a || busy()) return;
  if (ready) worker.postMessage({ type: "forget", data: { aid } });
  const i = session.analyses.indexOf(a.record);
  if (i >= 0) session.analyses.splice(i, 1);
  delete _A[aid];
  const node = document.querySelector(`#tree-analyses .tnode.analysis[data-aid="${aid}"]`);
  if (node) node.remove();
  Object.keys(_cams).forEach((k) => { if (k.endsWith("@" + aid)) delete _cams[k]; });
  if (_viewerKey && _viewerKey.endsWith("@" + aid)) _viewerKey = null;
  if (_view === "summary") renderSummaryView();
  if (_curA === aid) {
    const ids = Object.keys(_A);
    if (ids.length) selectAnalysis(ids[ids.length - 1]);
    else { _curA = null; _figs.pvisual = null; _props.pvisual = null; _have.pvisual = false; _cropAvailable = false; _cropText = null; _cropFilename = null; }
    if (_view && VIEWS[_view].kind === "pvisual") { if (_curA) showView(_view, { aid: _curA }); else showStart(); }
  }
  updateButtons();
}

function showStart() {
  _view = null;
  document.querySelectorAll("#vp-stage .vp-layer").forEach((l) => l.classList.toggle("active", l.id === "empty-state"));
  document.getElementById("navbar").style.display = "none";
  document.getElementById("vp-title").textContent = t("Start");
  document.getElementById("vp-detail").textContent = "";
  document.querySelectorAll(".trow.sel").forEach((r) => r.classList.remove("sel"));
  showProps(null); updateDocTitle(null); updateStart(); hideGuide();
}

// voxel size in a file name: 5 as "5", 2.5 as "2.5"
const voxTag = (v) => String(Math.abs(v - Math.round(v)) < 1e-6 ? Math.round(v) : +Number(v).toFixed(2));

function renderGradient(result, retheme, msg = {}) {
  if (retheme && msg.cid && !_C[msg.cid]) return;      // removed (or replaced by the same pair compared again) during the redraw
  const cid = msg.cid || (_run && _run.cid) || ("c" + (++_cSeq)), batch = msg.batch || null;
  let c = _C[cid];
  if (!c) {                                    // a new comparison: the names of this pair (the slots may hold other files by now)
    const names = _run && _run.names ? [_run.names[0], msg.lastName || _run.names[1]] : ["A", "B"], B = _run && _run.batch;
    c = _C[cid] = { id: cid, names, params: (_run && _run.params) || getGradientParams(), figs: null, props: null, metrics: null,
                    held: true, staleKeys: new Set(), rebuilding: false, records: [],
                    batch: batch && batch.length ? { names, rows: batch, a: B ? B.a : null, items: B ? B.items : [] } : null };
  }
  // a redraw of some figures replaces those; the others keep theirs, and stay stale
  c.figs = msg.partial && c.figs ? { ...c.figs, ...result.figures } : result.figures;
  if (!msg.partial || !c.staleKeys) c.staleKeys = new Set();
  Object.keys(result.figures || {}).forEach((k) => c.staleKeys.delete(k));
  c.held = true; c.rebuilding = false; c.propsLang = LANG; c.metrics = result.metrics;
  if (c.again) { c.again = false; c.staleKeys = new Set(Object.keys(c.figs)); }
  (msg.dropped || []).forEach((id) => { if (_C[id]) _C[id].held = false; });
  ["grad3d_cloud1", "grad3d_cloud2", "grad3d_error"].forEach((k) => c.figs[k] && captionFrom(k, c.figs[k].layout));
  c.props = comparisonProps(c);

  if (!retheme) {
    // the same pair compared again with the same settings (or shown again from the batch table)
    // gives the same numbers: it stays one row of the exports, moved to the end, and one
    // comparison in the browser
    const rows = batch && batch.length ? batch.filter((r) => !r.error).map((r) => ({ b: r.name, metrics: r.metrics })) : [{ b: c.names[1], metrics: c.metrics }];
    const same = (rec, r) => rec.file_a === c.names[0] && rec.file_b === r.b && JSON.stringify(rec.parameters) === JSON.stringify(c.params)
      && ["r_z", "r_gx", "r_gy", "r_mag"].every((k) => Math.abs(rec.metrics[k] - r.metrics[k]) < 1e-12);
    rows.forEach((r) => {
      const i = session.comparisons.findIndex((rec) => same(rec, r));
      const rec = i >= 0 ? session.comparisons.splice(i, 1)[0]
                         : { file_a: c.names[0], file_b: r.b, time: new Date().toISOString(), parameters: c.params, metrics: r.metrics };
      session.comparisons.push(rec);
      c.records.push(rec);
    });
    if (!c.batch) Object.values(_C).forEach((o) => { if (o !== c && !o.batch && o.records[0] === c.records[0]) dropComparison(o.id, true); });
    addComparisonNode(c);
    selectComparison(cid);
    if (_readySlot === "A" || _readySlot === "B") _readySlot = null;       // the pair is compared: no pending step
    showView(c.batch ? "batch" : "gradA", { cid });
    updateStale();
    const failed = batch ? batch.filter((r) => r.error).length : 0;
    if (failed) setStatus("Batch complete: {n} comparisons, {f} failed", "error", { n: batch.length - failed, f: failed });
    else if (batch) setStatus("Batch complete: {n} comparisons", "success", { n: batch.length });
    else setStatus("Comparison complete", "success");
    if (!_restoring) showGuide(batch ? "batch" : "compared");
  } else if (cid === _curC) {
    selectComparison(cid);
    const next = c.pendingView || (_view && VIEWS[_view].kind === "rq_gradient" ? _view : null);
    c.pendingView = null;
    if (next) showView(next, { cid, keepCamera: true });
    if (_lastStatus && _lastStatus[0] === "Drawing the analysis…") setStatus(...(_statusBeforeDraw || ["Ready", "success"]));
  }
  updateComparisonNodes();
}

// the properties of a comparison: its surfaces, the four correlations and notes
function comparisonProps(c, m = c.metrics) {
  const names = c.names;
  // correlations to three decimals, as in the batch table and the report
  const metric = (name, label, r, rmse, unit, key) =>
    `<div class="prow ${key ? "key big" : "big"}" title="${esc(t(TIPS[name]))}"><span class="pk">${label}</span><span class="pv">${fmt(r, 3)}</span>
       <span class="sub">RMSE ${rmse}${unit}</span></div>`;
  // against an idealised surface (a CAD design, found by its floor without texture) the height
  // correlation and the dimensions are the primary measures, as the engine reports in metrics.primary
  const ideal = m.primary === "r_z";
  const notes = [];
  if (ideal) {
    const tx = (m.texture_um || []).map((v) => (v == null || !isFinite(v) ? "–" : fmt(v, 2)));
    notes.push(t("One surface has no measured texture on its floor (A {a} µm, B {b} µm), as a CAD design: against an idealised surface RQ and the channel dimensions are the primary measures, and RQ<sub>d</sub> is given as well.",
                 { a: tx[0] || "–", b: tx[1] || "–" }));
  }
  if (m.z_flip != null) notes.push(t(m.z_flip ? "Surface B was rotated 180° about Z to match A." : "Surface B was used as it is."));
  if (m.cell_um)        notes.push(t("Grid {g} µm.", { g: fmt(m.cell_um[0], 2) }));
  if (m.n_mask != null && m.n_valid) notes.push(t("{n} channel-interior cells ({p} % of the valid common grid).",
                                                  { n: intl(m.n_mask), p: Math.round(100 * m.n_mask / m.n_valid) }));
  return `
    <div class="pgroup"><div class="pgroup-head">${t("Surfaces")}</div>
      <div class="prow stack" title="${esc(names[0])}"><span class="pk">${t("A, the reference")}</span><span class="pv">${esc(stem(names[0]))}</span></div>
      <div class="prow stack" title="${esc(names[1])}"><span class="pk">${t("B, the compared surface")}</span><span class="pv">${esc(stem(names[1]))}</span></div>
    </div>
    <div class="pgroup"><div class="pgroup-head">${t("Correlations")}</div>
      ${metric("RQd",  `RQ<sub>d</sub> <small>${t("slope magnitude")}</small>`, m.r_mag, fmt(m.rmse_mag, 3), "", !ideal)}
      ${metric("RQ",   `RQ <small>${t("height")}</small>`,                      m.r_z,   fmt(m.rmse_z, 1), UM, ideal)}
      ${metric("RQdx", `RQ<sub>dx</sub> <small>${t("slope along")}</small>`,    m.r_gx,  fmt(m.rmse_gx, 3), "")}
      ${metric("RQdy", `RQ<sub>dy</sub> <small>${t("slope across")}</small>`,   m.r_gy,  fmt(m.rmse_gy, 3), "")}
    </div>
    <div class="pnote">${notes.join(" ")}</div>`;
}

// ── The comparisons in the tree ─────────────────────────────────────────────────
// Every comparison (or batch) has a node with its views; a click on any of them shows that
// comparison, and its properties, its batch table and its exports follow.

function addComparisonNode(c) {
  const node = document.getElementById("tpl-comparison").content.firstElementChild.cloneNode(true);
  node.dataset.cid = c.id;
  node.querySelectorAll(".trow").forEach((r) => { r.dataset.cid = c.id; r.tabIndex = 0; });
  node.querySelector(".cbatch").style.display = c.batch ? "" : "none";
  const box = document.getElementById("tree-comparisons");
  box.querySelectorAll(".tnode.comparison").forEach((n) => n.classList.remove("open"));    // the older ones fold
  box.appendChild(node);
  applyLanguage(LANG);
  labelComparison(c);
}

// B by its name (or the size of the batch), and A beside it; both names in full on hover
function labelComparison(c) {
  const n = document.querySelector(`#tree-comparisons .tnode.comparison[data-cid="${c.id}"]`);
  if (!n) return;
  c.title = `A: ${c.names[0]}\nB: ${c.batch ? t("{n} surfaces", { n: c.batch.rows.length }) : c.names[1]}`;
  n.querySelector(".cname").textContent = c.batch ? t("Batch of {n}", { n: c.batch.rows.length }) : shortName(c.names[1]);
  n.querySelector(".cmeta").textContent = t("vs {name}", { name: shortName(c.names[0]) });
  n.querySelector(".cnode").title = c.title;
}

function updateComparisonNodes() {
  document.querySelectorAll("#tree-comparisons .tnode.comparison").forEach((n) => {
    const c = _C[n.dataset.cid];
    if (!c) return;
    n.classList.toggle("current", c.id === _curC);
    n.classList.toggle("unheld", !c.held);
  });
  document.getElementById("tree-summary").style.display = resultCount() ? "" : "none";
}

function selectComparison(cid) {
  const c = _C[cid];
  if (!c) return;
  if (cid !== _curC) _mapRange = null;          // the maps of another comparison: their own region
  _curC = cid;
  _figs.rq_gradient = c.figs; _props.rq_gradient = c.props; _have.rq_gradient = !!c.held;
  _lastPairNames = c.names; _cmpParams = c.params; _lastBatch = c.batch;
  updateComparisonNodes();
  updateButtons();
}

// figures of the comparison in the options of the moment (those named in keys, or all), as
// rebuildAnalysis does for an analysis
function rebuildComparison(cid, thenView, keys) {
  const c = _C[cid];
  if (!c || !c.held) return;
  if (thenView) c.pendingView = thenView;
  const opts = viewOpts(), key = JSON.stringify(opts);
  if (c.rebuilding) {
    if (key !== c.rebuildKey) c.again = true;
    return;
  }
  c.rebuilding = true; c.rebuildKey = key;
  worker.postMessage({ type: "retheme", id: "rt-" + cid, data: { kind: "rq_gradient", cid, keys: keys || null, ...opts } });
}

function removeComparison(cid) {
  const c = _C[cid];
  if (!c || busy()) return;
  askUser(t("Remove the comparison?"),
    t("Remove the comparison of <b>{b}</b> with <b>{a}</b> from this session? Its results leave the session and the exports.",
      { a: esc(stem(c.names[0])), b: esc(c.batch ? t("{n} surfaces", { n: c.batch.rows.length }) : stem(c.names[1])) }),
    [[t("Cancel"), null, true], [t("Remove"), () => { if (!busy()) dropComparison(cid, false); }]]);
}

// a comparison out of the session; keepRecords: its rows stay in the exports (a newer comparison
// of the same pair has taken them over)
function dropComparison(cid, keepRecords) {
  const c = _C[cid];
  if (!c) return;
  if (ready) worker.postMessage({ type: "forget", data: { cid } });
  if (!keepRecords) {
    const others = new Set(Object.values(_C).filter((o) => o !== c).flatMap((o) => o.records));
    c.records.forEach((rec) => { const i = session.comparisons.indexOf(rec); if (i >= 0 && !others.has(rec)) session.comparisons.splice(i, 1); });
  }
  delete _C[cid];
  const node = document.querySelector(`#tree-comparisons .tnode.comparison[data-cid="${cid}"]`);
  if (node) node.remove();
  Object.keys(_cams).forEach((k) => { if (k.endsWith("@" + cid)) delete _cams[k]; });
  if (_viewerKey && _viewerKey.endsWith("@" + cid)) _viewerKey = null;
  if (_curC === cid) {
    const ids = Object.keys(_C);
    if (ids.length) selectComparison(ids[ids.length - 1]);
    else { _curC = null; _figs.rq_gradient = null; _props.rq_gradient = null; _have.rq_gradient = false; _lastPairNames = null; _cmpParams = null; _lastBatch = null; }
    if (_view && VIEWS[_view].kind === "rq_gradient") { if (_curC) showView(_view === "batch" && !_lastBatch ? "gradA" : _view, { cid: _curC }); else showStart(); }
  }
  if (_view === "summary") renderSummaryView();
  updateComparisonNodes();
  updateButtons();
}

function renderBatchView() {
  const b = _lastBatch;
  const row = (r, i) => {
    const k = r.metrics, canShow = b.items && b.items[i];
    if (r.error || !k) return `<tr><td>${i + 1}</td><td title="${esc(r.name)}">${esc(r.name)}</td>
      <td colspan="6" class="err" title="${esc(r.error || "")}">${esc(t("failed: {msg}", { msg: explainError(r.error || "", false)[0] }))}</td><td></td></tr>`;
    return `<tr><td>${i + 1}</td><td title="${esc(r.name)}">${esc(r.name)}</td>
      <td${k.primary === "r_z" ? ' class="key"' : ""}>${fmt(k.r_z, 3)}</td><td>${fmt(k.r_gx, 3)}</td><td>${fmt(k.r_gy, 3)}</td><td${k.primary === "r_z" ? "" : ' class="key"'}>${fmt(k.r_mag, 3)}</td>
      <td>${t(k.z_flip ? "rotated" : "as it is")}</td><td>${k.n_mask != null ? intl(k.n_mask) : "–"}</td>
      <td>${canShow ? `<button class="btn btn-mini" onclick="showBatchPair(${i})" title="${t("Run this pair alone to see its figures")}">${t("Show")}</button>` : ""}</td></tr>`;
  };
  document.getElementById("batch-view").innerHTML = `
    <div class="batch-title">${t("Surface A, {name}, against {n} surfaces", { name: `<span class="fname">${esc(b.names[0])}</span>`, n: b.rows.length })}</div>
    <table class="batch-table">
      <thead><tr><th>#</th><th>${t("Surface B")}</th><th>RQ</th><th>RQ<sub>dx</sub></th><th>RQ<sub>dy</sub></th><th>RQ<sub>d</sub></th><th>${t("B orientation")}</th><th>${t("Cells")}</th><th></th></tr></thead>
      <tbody>${b.rows.map(row).join("")}</tbody>
    </table>
    <div class="pnote" style="padding-left:0">${t("The 3D views and maps show the last pair. Show runs one pair alone.")}</div>`;
}

// ── The summary of the session ─────────────────────────────────────────────────
// Every analysis and every comparison of the session (batch rows too, and results the engine no
// longer holds) in two tables, with a button to open those the browser lists.

function renderSummaryView() {
  const el = document.getElementById("summary-view");
  const th = (s) => `<th>${s}</th>`;
  const aRow = (r, i) => {
    const a = Object.values(_A).find((x) => x.record === r), c = r.channel || {}, fl = (r.roughness || {}).floor || {};
    const wa = c.wall_angle_resolved === false ? "< 3" : fmt(c.wall_angle_deg, 1);
    return `<tr><td>${i + 1}</td><td title="${esc(r.file)}">${esc(stem(r.file))}</td><td>${fmt(c.floor_width, 1)}</td><td>${fmt(c.opening_width, 1)}</td>
      <td>${fmt(c.mean_depth, 1)}</td><td>${wa}</td><td>${fmt(c.mean_length, 1)}</td><td>${fmt(fl.Sa, 2)}</td><td>${fmt((r.rotation || {}).voxel_size, 1)}</td>
      <td>${a ? `<button class="btn btn-mini" data-open-a="${a.id}">${esc(t("Show"))}</button>` : ""}</td></tr>`;
  };
  const cRow = (r, i) => {
    const c = Object.values(_C).find((x) => x.records.includes(r)), m = r.metrics || {}, key = m.primary === "r_z" ? "r_z" : "r_mag";
    const td = (k) => `<td${k === key ? ' class="key"' : ""}>${fmt(m[k], 3)}</td>`;
    return `<tr><td>${i + 1}</td><td title="${esc(r.file_a)}">${esc(shortName(r.file_a))}</td><td title="${esc(r.file_b)}">${esc(shortName(r.file_b))}</td>
      ${td("r_mag")}${td("r_z")}${td("r_gx")}${td("r_gy")}<td>${m.cell_um ? fmt(m.cell_um[0], 2) : "–"}</td>
      <td>${c ? `<button class="btn btn-mini" data-open-c="${c.id}">${esc(t("Show"))}</button>` : ""}</td></tr>`;
  };
  const A = session.analyses, C = session.comparisons;
  el.innerHTML = `
    <div class="sum-head"><span class="batch-title">${esc(t("Analyses"))} · ${A.length}</span><span class="sb-flex"></span>
      <button class="btn btn-mini" data-csv>${esc(t("Results CSV"))}</button></div>
    ${A.length ? `<table class="batch-table sum-table"><thead><tr>${th("#")}${th(esc(t("Point cloud")))}${th(esc(t("Floor width")) + " (µm)")}${th(esc(t("Opening width")) + " (µm)")}
      ${th(esc(t("Channel depth")) + " (µm)")}${th(esc(t("Wall angle")) + " (°)")}${th(esc(t("Floor length")) + " (µm)")}${th("Sa, " + esc(t("floor")) + " (µm)")}${th(esc(t("Voxel size")) + " (µm)")}${th("")}</tr></thead>
      <tbody>${A.map(aRow).join("")}</tbody></table>` : `<div class="pnote" style="padding-left:0">–</div>`}
    <div class="sum-head" style="margin-top:1.4rem"><span class="batch-title">${esc(t("Comparisons"))} · ${C.length}</span></div>
    ${C.length ? `<table class="batch-table sum-table cmp"><thead><tr>${th("#")}${th(esc(t("Surface A")))}${th(esc(t("Surface B")))}${th("RQ<sub>d</sub>")}${th("RQ")}${th("RQ<sub>dx</sub>")}${th("RQ<sub>dy</sub>")}${th(esc(t("Grid")) + " (µm)")}${th("")}</tr></thead>
      <tbody>${C.map(cRow).join("")}</tbody></table>` : `<div class="pnote" style="padding-left:0">–</div>`}
    <div class="pnote" style="padding-left:0">${esc(t("The key result of each comparison is in colour. Show opens a result the browser lists; Results CSV saves every number with its settings."))}</div>`;
  el.querySelector("[data-csv]").addEventListener("click", exportCSV);
  el.querySelectorAll("[data-open-a]").forEach((b) => b.addEventListener("click", () => showView("channel", { aid: b.dataset.openA })));
  el.querySelectorAll("[data-open-c]").forEach((b) => b.addEventListener("click", () => {
    const c = _C[b.dataset.openC];
    if (c) showView(c.batch ? "batch" : "gradA", { cid: c.id });
  }));
}

// one pair of the last batch alone, with its figures: the A and the file the table came from
function showBatchPair(i) {
  const b = _lastBatch, it = b && b.items[i];
  if (!it || running || !ready) return;
  if (b.a) setFile("A", b.a.name, b.a.content, b.a.isCrop ? { isCrop: true, from: b.a.from } : {});
  setFile("B", it.name, it.content);
  runGradient();
}

function showProps(kind) {
  const empty = document.getElementById("results-empty"), mp = document.getElementById("metrics-panel");
  const a = kind === "pvisual" ? _A[_curA] : null;
  const html = kind && _props[kind];
  empty.style.display = html ? "none" : "";
  mp.style.display = html ? "" : "none";
  document.getElementById("props-copy").style.display = html ? "" : "none";
  if (html) mp.innerHTML = staleNote(kind, a) + html + (a && !a.held ? `<div class="pnote">${esc(t("Shown as it was drawn: the engine no longer holds this analysis (it keeps the newest six). Analyse its file again to rebuild it, export it or keep its crop."))}</div>` : "");
  const sub = document.getElementById("props-sub");
  if (a) sub.textContent = a.name;
  else if (kind === "rq_gradient" && _lastPairNames) sub.textContent = t("A and B");
  else sub.textContent = "";
}

// ── Views ──────────────────────────────────────────────────────────────────────

function captionFrom(key, layout) {
  const t = layout && layout.title ? (typeof layout.title === "string" ? layout.title : layout.title.text || "") : "";
  const parts = t.split(/\s+\|\s+/);
  _captions[key] = { title: parts[0] || "", detail: parts.slice(1).join("  ·  ") };
}

function showView(id, opts = {}) {
  const v = VIEWS[id];
  if (!v) return;
  if (v.kind === "pvisual") {
    const aid = opts.aid || _curA, a = _A[aid];
    if (!a) return;
    if (aid !== _curA) selectAnalysis(aid);
    if (!a.figs) {                            // figures not built yet (an opened session): built now, shown then
      if (a.held) {
        if (!_lastStatus || _lastStatus[0] !== "Drawing the analysis…") _statusBeforeDraw = _lastStatus;
        rebuildAnalysis(aid, id); setStatus("Drawing the analysis…", "info");
      }
      return;
    }
    // drawn before the theme, colours, detail or language changed: drawn again now (shown as it
    // was until then); the properties too, for a view without a figure of its own
    const need = viewKeys(id).filter((k) => a.staleKeys && a.staleKeys.has(k));
    if (a.held && (need.length || a.propsLang !== LANG)) rebuildAnalysis(aid, null, need);
  } else if (v.kind === "rq_gradient") {
    const cid = opts.cid || _curC, c = _C[cid];
    if (!c) return;
    if (cid !== _curC) selectComparison(cid);
    if (v.type === "html") { if (!_lastBatch) return; }
    else if (!c.figs) {
      if (c.held) {
        if (!_lastStatus || _lastStatus[0] !== "Drawing the analysis…") _statusBeforeDraw = _lastStatus;
        rebuildComparison(cid, id); setStatus("Drawing the analysis…", "info");
      }
      return;
    }
    const need = viewKeys(id).filter((k) => c.staleKeys && c.staleKeys.has(k));
    if (c.held && (need.length || c.propsLang !== LANG)) rebuildComparison(cid, null, need);
  }
  _view = id;
  const aidSel = v.kind === "pvisual" ? _curA : null, cidSel = v.kind === "rq_gradient" ? _curC : null;
  if (_guide && _guide.owner !== (aidSel || cidSel)) hideGuide();        // the tip was about another result
  document.querySelectorAll(".trow[data-view]").forEach((r) =>
    r.classList.toggle("sel", r.dataset.view === id && (r.dataset.aid || null) === aidSel && (r.dataset.cid || null) === cidSel));
  document.querySelectorAll("#vp-stage .vp-layer").forEach((l) => l.classList.remove("active"));
  const row = document.querySelector(aidSel ? `.trow[data-view="${id}"][data-aid="${aidSel}"]`
    : cidSel ? `.trow[data-view="${id}"][data-cid="${cidSel}"]` : `.trow[data-view="${id}"]:not([data-aid]):not([data-cid])`);
  if (row) {                                     // the row of the view in sight in the browser, its groups open
    for (let n = row.parentElement.closest(".tnode"); n; n = n.parentElement.closest(".tnode")) n.classList.add("open");
    row.scrollIntoView({ block: "nearest" });
  }
  const label = row && row.querySelector(".tlabel");
  const fig = v.key && _figs[v.kind] && _figs[v.kind][v.key];
  if (fig) captionFrom(v.key, fig.layout);
  const cap = (fig && _captions[v.key]) || { title: label ? label.textContent : "", detail: "" };
  document.getElementById("vp-title").textContent = cap.title || (label ? label.textContent : "");
  document.getElementById("vp-detail").textContent = cap.detail;
  const nav = document.getElementById("navbar");
  nav.style.display = v.type === "html" ? "none" : "";
  nav.querySelector('[data-for="2d"]').style.display = v.type === "2d" || v.type === "xs" ? "" : "none";
  nav.querySelector('[data-for="maps"]').style.display = LINKED_2D[v.key] ? "" : "none";
  nav.querySelector('[data-for="3d"]').style.display = v.type === "3d" ? "" : "none";
  nav.querySelector(".nav-cmp").style.display = v.kind === "rq_gradient" ? "" : "none";
  document.getElementById("sb-coords").textContent = "";
  showProps(v.kind);
  updateDocTitle(v.kind);

  if (v.type === "2d") {
    const el = ensurePlot(v);
    el.classList.add("active");
    if (LINKED_2D[v.key]) syncMapRange(el);
    requestAnimationFrame(() => { if (el._fullLayout) Plotly.Plots.resize(el); });
  } else if (v.type === "3d") {
    document.getElementById("viewer3d").classList.add("active");
    render3d(v, opts);
  } else if (v.type === "xs") {
    document.getElementById("xs-view").classList.add("active");
    openXsView(v, opts);
  } else if (v.kind === "session") {
    renderSummaryView();
    document.getElementById("summary-view").classList.add("active");
  } else {
    renderBatchView();
    document.getElementById("batch-view").classList.add("active");
  }
}

// the 2D figure of the view in its container, drawn again when the container shows another
// analysis or an older version of the figure
function ensurePlot(v) {
  const el = document.getElementById(FIGS[v.kind][v.key][1]);
  const fig = _figs[v.kind] && _figs[v.kind][v.key];
  if (fig && el._marqFig !== fig) renderPlot(v.kind, v.key, fig, v.kind === "pvisual" ? _curA : _curC);
  return el;
}

function updateDocTitle(kind) {
  const el = document.getElementById("doc-title");
  if (kind === "pvisual" && _A[_curA]) el.textContent = _A[_curA].file;
  else if (kind === "rq_gradient" && _lastPairNames) el.textContent = `${stem(_lastPairNames[0])}  vs  ${stem(_lastPairNames[1])}`;
  else el.textContent = t(APP.full);
  document.title = kind && el.textContent !== t(APP.full) ? `${el.textContent} – MaRQ` : "MaRQ";
}

// Figure id of the view on screen (for the export dialog default)
function currentFigure() {
  const v = _view && VIEWS[_view];
  return v && v.key ? [v.kind, v.key] : null;
}

// ── 2D plots (Plotly) ──────────────────────────────────────────────────────────

function plotlyConfig() {
  return {
    displaylogo: false,
    displayModeBar: false,             // the navigation bar below the plot replaces Plotly's tool bar
    responsive: false,                 // resizing follows the panel through the ResizeObserver below
    scrollZoom: true,                  // the mouse wheel zooms
    doubleClick: "reset",
  };
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

// Screen settings shared by every figure. The figure itself (data, axes, colours) comes from
// plots.py; its title moves to the caption above the viewport.
function prepareLayout(kind, key, layout) {
  captionFrom(key, layout);
  const L = { ...layout };
  delete L.title;
  const m = L.margin || {};
  L.margin = { ...m, t: Math.max(18, (m.t || 60) - 36) };
  L.paper_bgcolor = "rgba(0,0,0,0)";
  if (LANG === "tr") L.separators = ",.";
  L.dragmode = _dragmode2d;
  L.hovermode = "closest";
  L.uirevision = key + ":" + (_curOwner || "") + ":" + _serial[kind];   // a new theme or language keeps the zoom; a new result does not
  L.hoverlabel = { ...(L.hoverlabel || {}), bgcolor: cssVar("--pane"), bordercolor: cssVar("--line-2"),
                   font: { ...((L.hoverlabel || {}).font || {}), color: cssVar("--text") } };
  if (LINKED_2D[key] && !linkMapsOn()) {          // unlinked: every panel zooms on its own, at true proportions
    const eq = L.yaxis && L.yaxis.scaleanchor;
    Object.keys(L).forEach((k) => {
      if (!/^[xy]axis\d*$/.test(k) || !L[k].matches) return;
      L[k] = { ...L[k] }; delete L[k].matches;
      if (eq) L[k] = k[0] === "y" ? { ...L[k], scaleanchor: L[k].anchor, scaleratio: 1, constrain: "range" } : { ...L[k], constrain: "range" };
    });
  }
  return L;
}

// Twice the ticks Plotly chooses by itself. Its rule is one tick per 80 pixels across and per 40
// pixels up, 5 to 10 ticks; here every axis gets double that count, from its drawn length. Axes
// with ticks of their own (listed values or a fixed step) keep them.
function denseTicks(el) {
  const fl = el._fullLayout, upd = {};
  if (!fl) return Promise.resolve();
  Object.keys(fl).forEach((k) => {
    if (!/^[xy]axis\d*$/.test(k)) return;
    const ax = fl[k], own = (el.layout && el.layout[k]) || {};
    if (!ax || !ax._length || ax.type === "category" || own.tickmode === "array" || own.dtick != null) return;
    const n = 2 * Math.round(Math.min(9, Math.max(4, ax._length / (k[0] === "x" ? 80 : 40))) + 1);
    if (own.nticks !== n) upd[k + ".nticks"] = n;
  });
  return Object.keys(upd).length ? Plotly.relayout(el, upd) : Promise.resolve();
}
// keeps the doubled ticks through every redraw of a plot on screen (a new figure, a resize);
// called after the first Plotly.react, which gives the element its events
function watchTicks(el) {
  if (el._marqTicks || typeof el.on !== "function") return;
  el._marqTicks = true;
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    requestAnimationFrame(() => denseTicks(el).catch(() => {}).finally(() => { busy = false; }));
  };
  el.on("plotly_afterplot", run);
  run();                                          // the redraw that has just happened
}
// a new figure of the same plot starts from the tick counts already worked out for it
function keepTicks(el, L) {
  Object.keys(L).forEach((k) => {
    const n = /^[xy]axis\d*$/.test(k) && el.layout && el.layout[k] && el.layout[k].nticks;
    if (n && L[k].nticks == null) L[k] = { ...L[k], nticks: n };
  });
  return L;
}

let _curOwner = null;
function renderPlot(kind, key, fig, owner) {
  const el = document.getElementById(FIGS[kind][key][1]);
  if (!el || !fig) return;
  _curOwner = owner;
  const data = LINKED_2D[key] ? fig.data.map((d) => (d.meta && d.meta.outline ? { ...d, visible: _outlineOn } : d)) : fig.data;
  Plotly.react(el, data, keepTicks(el, prepareLayout(kind, key, fig.layout)), plotlyConfig());
  _curOwner = null;
  watchTicks(el);
  el._marqFig = fig; el._marqOwner = owner;
  if (LINKED_2D[key]) linkAxes(el);
  if (!el._marqHover) {
    el._marqHover = true;
    // every axis of the 2D plots is a length in micrometres; a map's value has the unit of its trace
    el.on("plotly_hover", (ev) => {
      const p = ev.points && ev.points[0];
      if (!p) return;
      const mt = p.data.meta || {}, unit = mt.unit ? " " + mt.unit : "";
      const val = p.z != null ? `  ·  ${p.data.name || ""} ${fix(p.z, mt.nd != null ? mt.nd : 3)}${unit}` : "";
      document.getElementById("sb-coords").textContent = `x ${fix(p.x, 1)} µm  y ${fix(p.y, 1)} µm${val}`;
    });
    el.on("plotly_unhover", () => { document.getElementById("sb-coords").textContent = ""; });
  }
  watchSize(el);
}

// ── Linked zoom of the comparison maps ─────────────────────────────────────────
// The three maps of the height view, and of the slope view, show one grid: Plotly links their
// axes itself, so they zoom and pan together in one redraw. The page remembers the region, so
// the other map view shows the same one when it is opened.

function linkMapsOn() { const el = document.getElementById("link-maps"); return el ? el.checked : true; }
function linkCamsOn() { const el = document.getElementById("link-cameras"); return el ? el.checked : true; }

function linkAxes(el) {
  if (el._marqLinked) return;
  el._marqLinked = true;
  el.on("plotly_relayout", (ev) => {
    if (!ev || !linkMapsOn() || !Object.keys(ev).some((k) => /^[xy]axis\d*\.(range|autorange)/.test(k))) return;
    const fl = el._fullLayout;
    _mapRange = Object.keys(ev).some((k) => /autorange/.test(k)) ? null
      : { x: fl.xaxis.range.slice(), y: fl.yaxis.range.slice() };
    el._marqRange = _mapRange;
  });
}

function syncMapRange(el) {
  if (!linkMapsOn() || !el._fullLayout || el._marqRange === _mapRange) return;
  el._marqRange = _mapRange;
  Plotly.relayout(el, _mapRange ? { "xaxis.range": _mapRange.x.slice(), "yaxis.range": _mapRange.y.slice() }
                                : { "xaxis.autorange": true, "yaxis.autorange": true });
}

// ── Plot sizes ─────────────────────────────────────────────────────────────────

const _ro = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
  entries.forEach((e) => scheduleResize(e.target));
}) : null;
function watchSize(el) { if (_ro && !el._marqWatched) { _ro.observe(el); el._marqWatched = true; } }
function scheduleResize(el) {
  if (el._marqResize) return;
  el._marqResize = requestAnimationFrame(() => {
    el._marqResize = 0;
    if (el._fullLayout && el.closest(".vp-layer.active") && el.clientWidth > 20 && el.clientHeight > 20) Plotly.Plots.resize(el);
  });
}
function relayoutAll() {
  document.querySelectorAll(".plot-container").forEach((el) => { if (el._fullLayout) scheduleResize(el); });
}
if (typeof ResizeObserver !== "function") {
  let _resizeTimer = null;
  window.addEventListener("resize", () => { clearTimeout(_resizeTimer); _resizeTimer = setTimeout(relayoutAll, 100); });
}

// ── 3D views ───────────────────────────────────────────────────────────────────
// One three.js viewport (viewer3d.js) draws every 3D view. Each view keeps its camera when it
// is redrawn; the three views of a comparison share one camera while their link button is on.

// a camera per view of each result (key@id); the three views of a comparison share grad@id
const GRAD3D = /^grad3d_/;
const linkedCam = (key) => "grad@" + key.split("@")[1];
function cameraFor(key) { return (GRAD3D.test(key) && linkCamsOn()) ? (_cams[linkedCam(key)] || _cams[key]) : _cams[key]; }
function rememberCamera(key, cam) {
  if (!key || !cam) return;
  _cams[key] = cam;
  if (GRAD3D.test(key)) _cams[linkedCam(key)] = cam;
}
function forgetCameras() {
  Object.keys(_cams).forEach((k) => delete _cams[k]);
  _viewerKey = null;                             // or its camera would be saved again
}

function getViewer() {
  if (_viewer || _viewerFailed || !window.MarqViewer) return _viewer;
  try {
    _viewer = window.MarqViewer.create(document.getElementById("viewer3d"));
    _viewer.setTheme(_theme === "dark");
    _viewer.setLabels(cubeLabels());
    _viewer.setExaggeration(parseFloat(document.getElementById("exag-select").value) || 1);
    _viewer.on("change", (cam) => rememberCamera(_viewerKey, cam));
    _viewer.on("hover", (p) => {
      const el = document.getElementById("sb-coords");
      if (!p) { el.textContent = ""; return; }
      const v = VIEWS[_view] || {};
      const val = v.value === "Slope error" && p.value != null && isFinite(p.value) ? `  ·  ${t("slope error")} ${fix(p.value, 4)}` : "";
      el.textContent = `x ${fix(p.x, 1)} µm   y ${fix(p.y, 1)} µm   z ${fix(p.z, 2)} µm${val}`;
    });
    _viewer.onScale = updateScaleBar;
    _viewer.formatMeasure = (m) => `${fix(m.dist, 1)} µm <span class="pm">· ${esc(t("in plane"))} ${fix(m.dxy, 1)} · Δz ${fix(m.dz, 1)}</span>`;
    _viewer.on("measure", (m) => {
      toolHint(null);
      setStatus("Distance {d} µm (in plane {p} µm, height {z} µm)", "info", { d: fix(m.dist, 1), p: fix(m.dxy, 1), z: fix(m.dz, 1) });
    });
    _viewer.on("section", (m) => { toolHint(null); openSection(m.a, m.b); });
    _viewer.on("xsect", (m) => { toolHint(null); openXsPanel(m.a.x); });
    _viewer.on("marks", (m) => {
      if (m) { toolHint("Click the second point"); return; }
      closeSection();
      toolHint(_viewer && _viewer.tool ? "Click a point of the surface" : null);
    });
    _viewer.on("lost", (lost) => {
      clearTimeout(_lostTimer);
      if (!lost) { hideNotice(); return; }
      showNotice(null, () => t("The 3D view is paused: the graphics card reset it. It comes back by itself in a moment."), "warn");
      _lostTimer = setTimeout(() => {          // not back: a new viewport
        if (!_viewer || !_viewer.lost) return;
        try { _viewer.dispose(); } catch {}
        _viewer = null; _viewerKey = null; hideNotice();
        if (_view && VIEWS[_view].type === "3d") showView(_view);
      }, 5000);
    });
  } catch (err) {
    _viewerFailed = true;
    appendLog("3D viewport unavailable (" + err.message + "); the 3D views use Plotly.");
  }
  return _viewer;
}

let _lostTimer = null;
function currentExag() { return parseFloat(document.getElementById("exag-select").value) || 1; }

function render3d(v, opts = {}) {
  const fig = _figs[v.kind] && _figs[v.kind][v.key];
  if (!fig) return;
  const viewer = getViewer();
  const stage = document.getElementById("viewer3d");
  if (!viewer) {                                   // fallback: Plotly's 3D surface
    Plotly.purge(stage);
    const L = prepareLayout(v.kind, v.key, fig.layout);
    delete L.dragmode;
    Plotly.newPlot(stage, fig.data, L, plotlyConfig());
    return;
  }
  const trace = fig.data[0];
  const camKey = `${v.key}@${v.kind === "pvisual" ? _curA : _curC}`;
  const sameKey = _viewerKey === camKey;
  const prevKey = _viewerKey;
  if (prevKey) rememberCamera(prevKey, viewer.getCamera());
  _viewerKey = camKey;
  const cam = cameraFor(camKey);
  viewer.setExaggeration(currentExag());          // the depth scale is the dropdown's, in every view
  viewer.setSurface(trace, cam ? { camera: cam } : (opts.keepCamera && sameKey ? { keepCamera: true } : {}));
  updateColorBar(trace, viewer.colour);
  document.querySelector('.navbtn[data-act="ortho"]').classList.toggle("on", viewer.ortho);
}

function toolHint(msg) {
  const el = document.getElementById("tool-hint");
  el.dataset.msg = msg || "";
  el.textContent = msg ? t(msg) : "";
  el.classList.toggle("show", !!msg);
}

// ── Section profile ────────────────────────────────────────────────────────────
// The heights along the line between two points of a 3D view: of the surface, or of A and B and
// the slope error in the comparison views, read on their grids (bilinear).

function sampleGrid(tr, X, Y, field) {
  const xs = tr.x, ys = tr.y, Z = tr[field];
  if (!Z || xs.length < 2 || ys.length < 2) return null;
  const fi = (X - xs[0]) / (xs[1] - xs[0]), fj = (Y - ys[0]) / (ys[1] - ys[0]);
  if (!(fi >= 0 && fj >= 0 && fi <= xs.length - 1 && fj <= ys.length - 1)) return null;
  const i = Math.min(xs.length - 2, Math.floor(fi)), j = Math.min(ys.length - 2, Math.floor(fj)), u = fi - i, v = fj - j;
  const q = [Z[j][i], Z[j][i + 1], Z[j + 1][i], Z[j + 1][i + 1]], good = (z) => z !== null && z !== undefined && isFinite(z);
  if (!q.every(good)) { const k = (u < .5 ? 0 : 1) + (v < .5 ? 0 : 2); return good(q[k]) ? q[k] : null; }   // at a hole: the nearest point
  return (q[0] * (1 - u) + q[1] * u) * (1 - v) + (q[2] * (1 - u) + q[3] * u) * v;
}

const SECTION_CURVES = {
  pvisual: [["Height", "view3d", "z", false, "height_um"]],
  rq_gradient: [["Surface A", "grad3d_cloud1", "z", false, "height_A_um"], ["Surface B", "grad3d_cloud2", "z", false, "height_B_um"],
                ["Difference A − B", null, null, "A − B (µm)", "difference_A_minus_B_um"]],
};

function openSection(a, b) {
  const v = _view && VIEWS[_view];
  if (!v || v.type !== "3d" || !_figs[v.kind]) return;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(L > 0)) return;
  const curves = SECTION_CURVES[v.kind].filter(([, key]) => !key || _figs[v.kind][key]);
  const tr0 = _figs[v.kind][curves[0][1]].data[0], cell = Math.abs(tr0.x[1] - tr0.x[0]) || 1;
  const n = Math.max(60, Math.min(2000, Math.ceil(L / (cell / 2))));
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, X = a.x + (b.x - a.x) * f, Y = a.y + (b.y - a.y) * f;
    const val = curves.map(([, key, field]) => key ? sampleGrid(_figs[v.kind][key].data[0], X, Y, field) : null);
    if (val.length === 3 && val[2] === null)                          // A − B from the two heights at this point
      val[2] = val[0] != null && val[1] != null ? val[0] - val[1] : null;
    rows.push({ s: L * f, x: X, y: Y, v: val });
  }
  _section = { mode: "line", kind: v.kind, key: v.key, xTitle: "Distance along the section (µm)",
    detail: () => t("length {L} µm, from ({x1}; {y1}) to ({x2}; {y2}) µm", { L: fix(L, 1), x1: fix(a.x, 0), y1: fix(a.y, 0), x2: fix(b.x, 0), y2: fix(b.y, 0) }),
    series: curves.map(([name, , , y2], k) => ({ name, y2, x: rows.map((r) => r.s), y: rows.map((r) => r.v[k]) })),
    csv: { head: ["distance_um", "x_um", "y_um", ...curves.map((c) => c[4])], rows: rows.map((r) => [r.s, r.x, r.y, ...r.v]) } };
  drawSection();
}

// ── Cross-sections across the channel ──────────────────────────────────────────
// The channel runs along x in every aligned surface, so a cross-section is the profile along y at
// one x: from the points of the crop (within one voxel of the position, median per voxel-wide
// bin) for an analysis, from the common grid of A and B for the comparison. Positions are given
// along the channel, from one end (0) to the other (1); for an analysis the ends are the measured
// ones (the crop box less its margin), for the comparison the ends of the channel-interior mask.

function xsRange(kind, d) {
  if (kind === "rq_gradient") return d && d.lo != null ? { lo: d.lo, hi: d.hi } : null;
  const a = _A[_curA], r = a && a.record, cb = r && r.slices && r.slices.crop_box;
  if (!cb) return null;
  const pad = (r.parameters && r.parameters.crop_pad_x) || 0;
  return cb.x_max - cb.x_min > 2 * pad ? { lo: cb.x_min + pad, hi: cb.x_max - pad } : { lo: cb.x_min, hi: cb.x_max };
}

function xsDetail(x, rng) {
  if (!rng || !(rng.hi > rng.lo)) return t("at x = {x} µm", { x: fix(x, 0) });
  return t("at x = {x} µm, {p} % of the channel length ({L} µm)",
    { x: fix(x, 0), p: fix(100 * (x - rng.lo) / (rng.hi - rng.lo), 1), L: fix(rng.hi - rng.lo, 0) });
}

function xsSeries(kind, d, withMean) {
  if (kind === "rq_gradient")
    return [{ name: "Surface A", x: d.y, y: d.zA }, { name: "Surface B", x: d.y, y: d.zB },
            { name: "Difference A − B", x: d.y, y: d.diff, y2: "A − B (µm)" }];
  const out = [{ name: "At this position", x: d.y, y: d.z }];
  const pr = withMean && _A[_curA] && _A[_curA].record && _A[_curA].record.profile;
  if (pr && pr.yc) out.push({ name: "Mean cross-section", x: pr.yc, y: pr.zb, dash: "dash", color: cssVar("--text3") });
  return out;
}

function xsAxes(d) {
  const r = d && d.range;
  return r ? { x: r.y, y: r.z, y2: r.d } : null;
}

// a cross-section from the engine; for an analysis with the measured ends, so its fixed axes
// cover the same stretch of channel as the slider
function askXs(kind, rid, x) {
  const rng = kind === "pvisual" ? xsRange(kind) : null;
  return ask("xsection", { aid: kind === "pvisual" ? rid : null, cid: kind === "pvisual" ? null : rid, x,
                           lo: rng ? rng.lo : null, hi: rng ? rng.hi : null }, "xs");
}

function xsCsv(kind, d) {
  return kind === "rq_gradient"
    ? { head: ["y_um", "height_A_um", "height_B_um", "difference_A_minus_B_um", "slope_error"],
        rows: d.y.map((y, i) => [y, d.zA[i], d.zB[i], d.diff[i], d.err[i]]) }
    : { head: ["y_um", "height_um"], rows: d.y.map((y, i) => [y, d.z[i]]) };
}

// the one-click tool of the 3D views: the cross-section through the clicked point, below the view
function openXsPanel(x0) {
  const v = _view && VIEWS[_view];
  if (!v || v.type !== "3d") return;
  const kind = v.kind, aid = kind === "pvisual" ? _curA : _curC;
  askXs(kind, aid, x0).then((m) => {
    const d = JSON.parse(m.data), rng = xsRange(kind, d);
    _section = { mode: "xs", kind, key: kind === "pvisual" ? "cross_section" : "cross_sections", x: d.x, aid,
                 xTitle: "Y, across the channel (µm)", detail: () => xsDetail(d.x, rng), series: xsSeries(kind, d, false), csv: xsCsv(kind, d),
                 axes: xsAxes(d) };
    drawSection();
  }).catch(() => {});
}

function openXsFromPanel() {
  const S = _section;
  if (!S || S.mode !== "xs") return;
  showView(S.kind === "pvisual" ? "xsview" : "gradxs", S.kind === "pvisual" ? { aid: S.aid, x: S.x } : { cid: S.aid, x: S.x });
}

// the cross-section view: a slider along the channel, the position as a fraction or in µm
let _xs = null, _xsBusy = false, _xsAgain = false;

function openXsView(v, opts = {}) {
  const kind = v.kind, aid = kind === "pvisual" ? _curA : _curC;          // the analysis or the comparison
  if (!_xs || _xs.kind !== kind || _xs.aid !== aid) _xs = { kind, aid, x: null, rng: kind === "pvisual" ? xsRange(kind) : null, d: null };
  if (opts.x != null) _xs.x = opts.x;
  if (_xs.x == null && _xs.rng) _xs.x = (_xs.rng.lo + _xs.rng.hi) / 2;
  document.getElementById("xs-slider").disabled = !_xs.rng;
  syncXsControls();
  if (_xs.d) drawXs();
  requestXs();
}

function requestXs() {
  if (!_xs) return;
  if (_xsBusy) { _xsAgain = true; return; }
  _xsBusy = true; _xsAgain = false;
  const X = _xs;
  askXs(X.kind, X.aid, X.x).then((m) => {
    if (X !== _xs) return;
    const d = JSON.parse(m.data);
    if (X.kind === "rq_gradient") { X.rng = { lo: d.lo, hi: d.hi }; if (X.x == null) X.x = d.x; document.getElementById("xs-slider").disabled = false; }
    X.d = d;
    drawXs(); syncXsControls();
  }).catch(() => {}).finally(() => { _xsBusy = false; if (_xsAgain) requestXs(); });
}

function drawXs() {
  const X = _xs;
  if (!X || !X.d) return;
  drawProfile(document.getElementById("xs-plot"), xsSeries(X.kind, X.d, true), "Y, across the channel (µm)",
              { uirev: `xs:${X.kind}:${X.aid}`, dragmode: _dragmode2d, axes: xsAxes(X.d) });
  document.getElementById("xs-info").textContent = xsDetail(X.d.x, X.rng) + (X.kind === "pvisual"
    ? "  ·  " + t("{n} points within {w} µm of the position", { n: intl(X.d.n), w: fix(X.d.half, 1) }) : "");
}

function syncXsControls() {
  const X = _xs;
  if (!X || !X.rng || X.x == null) return;
  const L = X.rng.hi - X.rng.lo, f = L > 0 ? Math.max(0, Math.min(1, (X.x - X.rng.lo) / L)) : 0;
  document.getElementById("xs-slider").value = Math.round(f * 1000);
  const fr = document.getElementById("xs-frac"), um = document.getElementById("xs-um");
  if (document.activeElement !== fr) fr.value = (Math.round(f * 1000) / 1000).toString();
  if (document.activeElement !== um) um.value = Math.round(X.x - X.rng.lo);
  um.max = Math.round(L);
}

function setXsPosition(x) {
  const X = _xs;
  if (!X || !X.rng) return;
  X.x = Math.max(X.rng.lo, Math.min(X.rng.hi, x));
  syncXsControls();
  requestXs();
}

function exportXs() {
  const X = _xs;
  if (!X || !X.d) return;
  const c = xsCsv(X.kind, X.d);
  const lines = [c.head.join(","), ...c.rows.map((r) => r.map((v) => v == null ? "" : +Number(v).toPrecision(8)).join(","))];
  saveFile(`${exportName(X.kind, X.kind === "pvisual" ? "cross_section" : "cross_sections", X.aid)}_x${Math.round(X.d.x)}.csv`, "text/csv",
           textBlob(lines.join("\n") + "\n", "text/csv")).catch(() => {});
}

// a profile plot (the section panel and the cross-section view): heights, and the height
// difference on a second axis (its title in the series' y2). opts.axes fixes the ranges
// {x, y, y2}, so the axes stay put while the position along the channel changes.
function drawProfile(el, series, xTitle, opts = {}) {
  const font = { family: getComputedStyle(document.body).fontFamily, size: 12, color: cssVar("--text2") };
  const cols = [cssVar("--accent"), "#3d8bfd", cssVar("--text3")];
  const second = series.some((c) => c.y2);
  const data = series.map((sr, k) => ({
    type: "scatter", mode: "lines", name: t(sr.name), x: sr.x, y: sr.y, yaxis: sr.y2 ? "y2" : "y", connectgaps: false,
    line: { width: sr.y2 || sr.dash ? 1.1 : 1.8, color: sr.color || cols[k % 3], dash: sr.y2 ? "dot" : (sr.dash || "solid") },
    hovertemplate: `${esc(t(sr.name))} %{y:.3f}<extra></extra>` }));
  const ax = (title) => ({ title: { text: title, font }, tickfont: font, gridcolor: cssVar("--line"), zerolinecolor: cssVar("--line-2"),
                          linecolor: cssVar("--line-2"), automargin: true });
  const layout = { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font, dragmode: opts.dragmode || "pan", hovermode: "x unified",
    margin: { l: 60, r: second ? 64 : 18, t: series.length > 1 ? 26 : 8, b: 40 },
    showlegend: series.length > 1,
    legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font, bgcolor: "rgba(0,0,0,0)" },
    hoverlabel: { bgcolor: cssVar("--pane"), bordercolor: cssVar("--line-2"), font: { color: cssVar("--text"), size: 13 } },
    xaxis: ax(t(xTitle)), yaxis: ax(t("Height (µm)")), separators: LANG === "tr" ? ",." : ".,", uirevision: opts.uirev };
  // its own ticks (Plotly 4 syncs an overlaying axis with the one below by default)
  if (second) layout.yaxis2 = { ...ax(t(series.find((c) => c.y2).y2)), overlaying: "y", side: "right", showgrid: false, tickmode: "auto" };
  if (currentEqual() && !second) { layout.yaxis.scaleanchor = "x"; layout.yaxis.scaleratio = 1; }
  const A = opts.axes || {};
  [["xaxis", A.x], ["yaxis", A.y], ["yaxis2", A.y2]].forEach(([k, r]) => {
    if (layout[k] && Array.isArray(r) && r.every((v) => isFinite(v)) && r[1] > r[0]) { layout[k].range = r.slice(); layout[k].autorange = false; }
  });
  Plotly.react(el, data, keepTicks(el, layout), { displayModeBar: false, displaylogo: false, scrollZoom: true, responsive: false, doubleClick: "reset" });
  watchTicks(el);
  if (!el._marqRO && typeof ResizeObserver === "function") {
    el._marqRO = new ResizeObserver(() => { if (el._fullLayout && el.clientWidth > 20 && el.clientHeight > 20) Plotly.Plots.resize(el); });
    el._marqRO.observe(el);
  }
}

function drawSection() {
  const S = _section, el = document.getElementById("section-plot");
  if (!S) return;
  document.getElementById("section-panel").style.display = "flex";
  document.getElementById("viewer3d").classList.add("with-section");
  document.getElementById("sp-title").textContent = t(S.mode === "xs" ? "Cross-section" : "Section");
  document.getElementById("sp-detail").textContent = S.detail();
  document.getElementById("sp-open").style.display = S.mode === "xs" ? "" : "none";
  drawProfile(el, S.series, S.xTitle, { axes: S.axes });
  // the panel covers the lower part of the view: the clicked points move up into sight
  const panel = document.getElementById("section-panel");
  if (_viewer) _viewer.revealMarks(document.getElementById("viewer3d").getBoundingClientRect().bottom - panel.getBoundingClientRect().top);
}

function closeSection() {
  if (!_section && document.getElementById("section-panel").style.display === "none") return;
  _section = null;
  document.getElementById("section-panel").style.display = "none";
  document.getElementById("viewer3d").classList.remove("with-section");
  try { Plotly.purge(document.getElementById("section-plot")); } catch {}
}

function exportSection() {
  const S = _section;
  if (!S) return;
  const lines = [S.csv.head.join(","), ...S.csv.rows.map((r) => r.map((v) => v == null ? "" : +Number(v).toPrecision(8)).join(","))];
  saveFile(`${exportName(S.kind, S.key)}_section.csv`, "text/csv", textBlob(lines.join("\n") + "\n", "text/csv")).catch(() => {});
}

function updateColorBar(trace, c) {
  const bar = document.getElementById("colorbar3d");
  if (!c || !c.scale) { bar.classList.remove("show"); return; }
  const stops = c.scale.map(([t, col]) => `${col} ${(Number(t) * 100).toFixed(1)}%`).join(", ");
  const title = trace.colorbar && trace.colorbar.title ? (trace.colorbar.title.text || trace.colorbar.title) : "";
  // round values (1, 2 or 5 times a power of ten) at their place on the bar, not its ends divided in four
  let ticks = "";
  const span = c.cmax - c.cmin;
  if (span > 0) {
    const p = Math.pow(10, Math.floor(Math.log10(span / 4)));
    const step = [1, 2, 5, 10].map((k) => k * p).find((s) => span / s <= 7);
    const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    for (let k = Math.ceil(c.cmin / step - 1e-9); k * step <= c.cmax + step * 1e-9; k++) {
      const f = (k * step - c.cmin) / span;
      ticks += `<span class="cb-tick" style="top:${(100 - f * 100).toFixed(1)}%">${fix(k * step, dec)}</span>`;
    }
  }
  bar.innerHTML = `<span class="cb-title">${esc(title)}</span><div class="cb-bar" style="background:linear-gradient(to top, ${stops})"></div>${ticks}`;
  bar.classList.add("show");
}

// a scale bar, shown in the orthographic projection where one length holds across the view
// only in an orthographic view straight along an axis, where one length holds across the view
function updateScaleBar(pxSize) {
  const sb = document.getElementById("scalebar3d");
  const badge = document.getElementById("badge3d");
  const k = _viewer ? _viewer.exag : 1;
  badge.textContent = k !== 1 ? t("Depth ×{k}", { k }) : "";
  badge.classList.toggle("show", k !== 1);
  if (!_viewer || !_viewer.isAxisView() || !pxSize || !isFinite(pxSize)) { sb.classList.remove("show"); return; }
  const target = 110 * pxSize;
  const p10 = Math.pow(10, Math.floor(Math.log10(target)));
  const L = [1, 2, 5, 10].map((k) => k * p10).reduce((b, v) => Math.abs(v - target) < Math.abs(b - target) ? v : b);
  sb.querySelector(".sb-line").style.width = (L / pxSize).toFixed(1) + "px";
  sb.querySelector(".sb-text").textContent = L >= 1000 ? `${decimal(L / 1000)} mm` : `${decimal(L)} µm`;
  sb.classList.add("show");
}

// ── Navigation bar ─────────────────────────────────────────────────────────────

function navAction(act) {
  const v = _view && VIEWS[_view];
  if (!v) return;
  if (v.type === "3d" && _viewer) {
    if (act === "home") _viewer.view("home");
    else if (act === "fit") _viewer.fit();
    else if (act === "zoomin") _viewer.zoom(0.75);
    else if (act === "zoomout") _viewer.zoom(1 / 0.75);
    else if (["top", "front", "right"].includes(act)) _viewer.view(act);
    else if (act === "measure" || act === "section" || act === "xsect") {
      const on = _viewer.tool !== act;
      _viewer.setTool(on ? act : null);
      document.querySelectorAll('.navbtn[data-act="measure"], .navbtn[data-act="section"], .navbtn[data-act="xsect"]').forEach((b) =>
        b.classList.toggle("on", on && b.dataset.act === act));
      toolHint(on ? "Click a point of the surface" : null);
    }
    else if (act === "ortho") {
      _viewer.setProjection(!_viewer.ortho);
      document.querySelector('.navbtn[data-act="ortho"]').classList.toggle("on", _viewer.ortho);
    } else if (act === "snapshot") {
      snapshot3d(exportName(v.kind, v.key) + "_view.png");
    } else if (act === "linkcams") toggleCheck("link-cameras");
    return;
  }
  if (v.type !== "2d" && v.type !== "xs") return;
  if (act === "outline") { setOutline(!_outlineOn); return; }
  if (act === "linkmaps") { toggleCheck("link-maps"); return; }
  const el = v.type === "xs" ? document.getElementById("xs-plot") : document.getElementById(FIGS[v.kind][v.key][1]);
  if (!el._fullLayout) return;
  if (act === "fit2d") {
    const upd = {};
    Object.keys(el.layout).filter((k) => /^[xy]axis\d*$/.test(k)).forEach((k) => { upd[k + ".autorange"] = true; });
    Plotly.relayout(el, upd);
  } else if (act === "zoomin" || act === "zoomout") {
    // every axis of the figure about its centre, so 1:1 plots keep their proportions
    const f = act === "zoomin" ? 0.75 : 1 / 0.75, fl = el._fullLayout, upd = {};
    Object.keys(fl).filter((k) => /^[xy]axis\d*$/.test(k) && fl[k].range).forEach((k) => {
      const [a, b] = fl[k].range.map(Number), c = (a + b) / 2, h = (b - a) / 2 * f;
      upd[k + ".range"] = [c - h, c + h];
    });
    Plotly.relayout(el, upd);
  } else if (act === "pan" || act === "zoombox") {
    _dragmode2d = act === "pan" ? "pan" : "zoom";
    document.querySelectorAll('.navbtn[data-act="pan"], .navbtn[data-act="zoombox"]').forEach((b) =>
      b.classList.toggle("on", b.dataset.act === act));
    document.querySelectorAll(".plot-container, #xs-plot").forEach((p) => { if (p._fullLayout) Plotly.relayout(p, { dragmode: _dragmode2d }); });
  } else if (act === "snapshot") {
    // as on screen, on the background of the theme (the plot itself is drawn on a transparent one)
    const layout = { ...el.layout, paper_bgcolor: cssVar("--pane"), width: el.clientWidth, height: el.clientHeight };
    saveFile(exportName(v.kind, v.key) + ".png", "image/png",
             () => Plotly.toImage({ data: el.data, layout }, { format: "png", scale: 2, width: el.clientWidth, height: el.clientHeight })
                     .then((url) => fetch(url)).then((r) => r.blob()))
      .catch((err) => { appendLog("Snapshot failed: " + err.message); setStatus("Figure export failed, see the log", "error"); });
  }
}

// the links of the comparison views: their state in the hidden check boxes (remembered), set with
// the buttons below the views
function toggleCheck(id) {
  const el = document.getElementById(id);
  el.checked = !el.checked;
  el.dispatchEvent(new Event("change"));
  syncNavToggles();
}
function syncNavToggles() {
  document.querySelector('.navbtn[data-act="linkmaps"]').classList.toggle("on", linkMapsOn());
  document.querySelector('.navbtn[data-act="linkcams"]').classList.toggle("on", linkCamsOn());
}

// the outline of the channel interior on the height and slope maps, shown or hidden on both
function setOutline(on) {
  _outlineOn = on;
  try { localStorage.setItem(LS.outline, on ? "1" : "0"); } catch {}
  document.querySelector('.navbtn[data-act="outline"]').classList.toggle("on", on);
  Object.keys(LINKED_2D).forEach((k) => {
    const el = document.getElementById(FIGS.rq_gradient[k][1]);
    const idx = el && el.data ? el.data.map((d, i) => (d.meta && d.meta.outline ? i : -1)).filter((i) => i >= 0) : [];
    if (idx.length) Plotly.restyle(el, { visible: on }, idx);
  });
}

// ── Copying ────────────────────────────────────────────────────────────────────

function copyText(text, done) {
  const fallback = () => {                       // without the clipboard interface (an older browser)
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setStatus(done, "success"); } catch { setStatus("The text could not be copied", "error"); }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => setStatus(done, "success"), fallback);
  else fallback();
}

// Properties as a table for a spreadsheet, in the numbers of the screen: one row per quantity
// (name, value, ± spread, unit); values with two parts ("floor 9.4 · rim 0.1 µm", the two walls)
// one row per part; the roughness table as it is.
function propsTable() {
  const clean = (s) => s.replace(/\s+/g, " ").trim();
  const NUMV = /^([+−-]?\d[\d.,]*)(?=\s|$|°|%)(?:\s*±\s*([\d.,–]+))?\s*(.*)$/;     // not a file name that starts with digits
  const rows = [[clean(document.querySelector("#props-pane .pane-head span").textContent), clean(document.getElementById("props-sub").textContent)]];
  const value = (k, v) => {
    const m = v.match(NUMV);
    return m ? [k, m[1], m[2] ? "± " + m[2] : "", m[3]] : [k, v];
  };
  const parts = (k, v) => {                                    // "floor 9.4 · rim 0.1 µm": the unit of the last for both
    const out = v.split(" · ").map((p) => {
      const m = p.match(/^(\S+)\s+([+−-]?\d.*)$/);
      return m ? value(`${k}, ${m[1]}`, m[2]) : value(k, p);
    });
    const u = out[out.length - 1][3];
    out.forEach((r) => { if (r.length === 4 && !r[3] && u) r[3] = u; });
    return out;
  };
  document.querySelectorAll("#metrics-panel .pgroup").forEach((g) => {
    rows.push([], [clean(g.querySelector(".pgroup-head").textContent)]);
    g.querySelectorAll(".prow").forEach((r) => {
      const k = clean(r.querySelector(".pk").textContent), pv = r.querySelector(".pv"), pm = pv.querySelector(".pm");
      const main = clean(pm && !/±/.test(pm.textContent) ? pv.textContent.replace(pm.textContent, "") : pv.textContent);
      if (main.includes(" · ")) rows.push(...parts(k, main)); else rows.push(value(k, main));
      if (pm && !/±/.test(pm.textContent)) rows.push(...parts(k, clean(pm.textContent).replace(/^\((.*)\)$/, "$1")));
      const sub = r.querySelector(".sub"), m = sub && clean(sub.textContent).match(/^(\S+)\s+(.*)$/);
      if (m) rows.push(value(`${k}, ${m[1]}`, m[2]));
    });
    g.querySelectorAll(".ptable tr").forEach((tr) => rows.push([...tr.children].map((c) => clean(c.textContent))));
  });
  return rows.map((r) => r.join("\t")).join("\n") + "\n";
}

function copyProps() { copyText(propsTable(), "Properties copied: paste them into a spreadsheet"); }
function copyLog() { copyText(document.getElementById("log-box").value, "Log copied"); }
function saveLog() {
  saveFile(`marq_log_${stampNow()}.txt`, "text/plain", textBlob(document.getElementById("log-box").value, "text/plain")).catch(() => {});
}

// The 3D view as on screen, without the view cube, on the background of the theme, with the
// colour bar, the depth scale and the scale bar.
function snapshot3d(filename) {
  const shot = _viewer.snapshot(), W = shot.width, H = shot.height, s = W / _viewer.w;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, cssVar("--vp-top")); bg.addColorStop(1, cssVar("--vp-bottom"));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.drawImage(shot, 0, 0);
  const base = document.getElementById("viewer3d").getBoundingClientRect();
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: (r.left - base.left) * s, y: (r.top - base.top) * s, w: r.width * s, h: r.height * s }; };
  const bar = document.querySelector("#colorbar3d.show .cb-bar");
  if (bar && _viewer.colour && _viewer.colour.scale) {
    const r = box(bar), lg = g.createLinearGradient(0, r.y + r.h, 0, r.y);
    _viewer.colour.scale.forEach(([t0, col]) => lg.addColorStop(Math.min(1, Math.max(0, Number(t0))), col));
    g.fillStyle = lg; g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = cssVar("--line-2"); g.lineWidth = s; g.strokeRect(r.x, r.y, r.w, r.h);
  }
  g.strokeStyle = cssVar("--text2"); g.lineWidth = 1.5 * s;
  document.querySelectorAll("#scalebar3d.show .sb-line").forEach((el) => {
    const r = box(el);
    g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x, r.y + r.h); g.lineTo(r.x + r.w, r.y + r.h); g.lineTo(r.x + r.w, r.y); g.stroke();
  });
  document.querySelectorAll("#colorbar3d.show .cb-tick, #colorbar3d.show .cb-title, #scalebar3d.show .sb-text, #badge3d.show").forEach((el) => {
    const r = box(el), cs = getComputedStyle(el);
    g.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * s}px ${cs.fontFamily}`;
    g.fillStyle = cs.color; g.textBaseline = "middle";
    g.fillText(el.textContent, r.x + parseFloat(cs.paddingLeft || 0) * s, r.y + r.h / 2);
  });
  saveFile(filename, "image/png", () => new Promise((res) => c.toBlob(res, "image/png"))).catch(() => {});
}

// ── Exports ────────────────────────────────────────────────────────────────────

function stem(name) { return String(name).replace(/\.[^.]+$/, ""); }
// a crop by the name of its scan: "x_Crop_Voxel5.txt" (or the earlier "x_CroppedVoxel5.txt") as "x"
function shortName(name) { return stem(name).replace(/_Crop(?:ped)?_?Voxel[\d.]+$/i, ""); }

function exportName(kind, key, aid) {
  if (kind === "pvisual") { const a = _A[aid || _curA]; return `${stem(a ? a.file : "surface")}_${key}`; }
  const n = _lastPairNames || ["A", "B"];
  return `${stem(n[0])}_vs_${stem(n[1])}_${key}`;
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Saving asks where: the system's save dialog (Chrome and Edge), with the folder of the last
// save; other browsers put the file in their downloads folder, and the status bar says so.
// produce() makes the content once the place is chosen (it may wait for the engine).
// Resolves true when the file was written, false when the dialog was cancelled.
const SAVE_TYPES = { ".json": "application/json", ".csv": "text/csv", ".txt": "text/plain", ".png": "image/png",
                     ".svg": "image/svg+xml", ".html": "text/html", ".marq": "application/zip" };
async function saveFile(name, mime, produce) {
  const ext = (name.match(/\.[^.]+$/) || [""])[0].toLowerCase();
  if (window.showSaveFilePicker && window.isSecureContext) {
    let handle = null;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: name, id: "marq-save",
        types: SAVE_TYPES[ext] ? [{ description: ext.slice(1).toUpperCase(), accept: { [SAVE_TYPES[ext]]: [ext] } }] : undefined });
    } catch (err) {
      if (err && err.name === "AbortError") return false;          // cancelled
      handle = null;                                               // not allowed here: download instead
    }
    if (handle) {
      const blob = await produce();
      const w = await handle.createWritable();
      await w.write(blob); await w.close();
      setStatus("Saved: {name}", "success", { name: handle.name });
      return true;
    }
  }
  downloadBlob(name, await produce());
  setStatus("Saved to the downloads folder of the browser: {name}", "success", { name });
  return true;
}
const textBlob = (text, mime) => () => new Blob([text], { type: mime || "text/plain" });

function openExportDialog(kind, key) {
  const sel = document.getElementById("exp-figure");
  sel.innerHTML = "";
  const add = (k) => Object.keys(FIGS[k]).forEach((key2) => {
    const o = document.createElement("option");
    o.value = k + ":" + key2;
    o.textContent = (k === "pvisual" ? `${_A[_curA].name}: ` : t("Comparison: ")) + t(FIGS[k][key2][0]);
    sel.appendChild(o);
  });
  if (_have.pvisual && _figs.pvisual) add("pvisual");
  if (_have.rq_gradient && _figs.rq_gradient) add("rq_gradient");
  if (!sel.options.length) return;
  const cur = (kind && key) ? [kind, key] : currentFigure();
  if (cur && Array.from(sel.options).some((o) => o.value === cur.join(":"))) sel.value = cur.join(":");
  const sizeSel = document.getElementById("exp-size");
  sizeSel.onchange = () => {
    const v = sizeSel.value, mm = v.startsWith("mm");
    document.getElementById("exp-custom").style.display = v === "custom" ? "" : "none";
    document.getElementById("exp-mm").style.display = document.getElementById("exp-mm-note").style.display = mm ? "" : "none";
    if (mm) {                                      // the usual heights of the two column widths
      document.getElementById("exp-wmm").value = v === "mm90" ? 90 : 190;
      document.getElementById("exp-hmm").value = v === "mm90" ? 85 : 110;
    }
  };
  sizeSel.onchange();
  openModal("modal-export");
}

// A PNG that states its resolution (a pHYs chunk after the header), so word processors and
// LaTeX place it at its printed size.
const _crc = (() => { const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } return T; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (const b of bytes) c = _crc[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function pngWithDpi(blob, dpi) {
  const src = new Uint8Array(await blob.arrayBuffer()), ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4);           // length 9, "pHYs"
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;            // pixels per metre, x and y
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const at = 33;                                                       // signature (8) and IHDR (25)
  const out = new Uint8Array(src.length + 21);
  out.set(src.subarray(0, at)); out.set(chunk, at); out.set(src.subarray(at), at + 21);
  return new Blob([out], { type: "image/png" });
}

function runExport() {
  if (_reporting || _exporting) { setStatus("Wait until the report or the figure in progress is ready", "info"); return; }
  const [kind, key] = document.getElementById("exp-figure").value.split(":");
  const format = document.getElementById("exp-format").value;
  const themeSel = document.getElementById("exp-theme").value;
  const theme = themeSel === "current" ? _theme : themeSel;
  const langSel = document.getElementById("exp-lang").value;
  const lang = langSel === "current" ? LANG : langSel;
  const size = document.getElementById("exp-size").value;
  let w = 1200, h = 700, journal = null;
  if (size === "panel") {
    const el = document.getElementById("vp-stage");
    if (el && el.clientWidth > 50) { w = el.clientWidth; h = el.clientHeight; }
  } else if (size === "custom") {
    w = Math.max(300, Math.min(6000, Math.round(num("exp-w", 1400))));
    h = Math.max(200, Math.min(6000, Math.round(num("exp-h", 800))));
  } else if (size.startsWith("mm")) {
    // a journal size: drawn at the printed size (96 screen pixels to the inch), the text scaled to
    // about 7 points in one column and 8 in two, and the PNG made at the chosen resolution
    const wmm = Math.max(30, Math.min(300, num("exp-wmm", 90))), hmm = Math.max(20, Math.min(300, num("exp-hmm", 85)));
    journal = { wmm, hmm, dpi: parseInt(document.getElementById("exp-dpi").value, 10) || 300, k: wmm < 120 ? 0.78 : 0.9 };
    w = Math.round(wmm / 25.4 * 96); h = Math.round(hmm / 25.4 * 96);
  } else {
    [w, h] = size.split("x").map(Number);
  }
  closeModal("modal-export");
  const aid = kind === "pvisual" ? _curA : null;
  const req = { kind, key, format: format.startsWith("png") ? "png" : "svg", w, h, journal,
                scale: journal ? journal.dpi / 96 : format === "png3" ? 3 : 2 };
  saveFile(`${exportName(kind, key, aid)}.${req.format}`, req.format === "png" ? "image/png" : "image/svg+xml", async () => {
    setStatus("Preparing the figure…", "info");
    _exporting = true; updateButtons();
    try {
      const m = await ask("export_figure", { kind, key, aid, cid: kind === "rq_gradient" ? _curC : null, theme, lang, quality: currentQuality(),
                                             palette: currentPalette(), equal: currentEqual(), request: req }, "fig");
      return await figureBlob(JSON.parse(m.data), req);
    } finally { _exporting = false; updateButtons(); }
  }).then((ok) => {
    if (!ok) return;
    if (journal) setStatus("Figure exported ({fmt}, {w} × {h} mm at {dpi} dots per inch)", "success",
                           { fmt: req.format.toUpperCase(), w: journal.wmm, h: journal.hmm, dpi: journal.dpi });
    else setStatus("Figure exported ({fmt}, {w}×{h})", "success", { fmt: req.format.toUpperCase(), w, h });
  })
    .catch((err) => { appendLog("Figure export failed: " + err.message); setStatus("Figure export failed, see the log", "error"); });
}

// a figure drawn off screen at the requested size, as a PNG or SVG file
async function figureBlob(fig, req) {
  const stage = document.getElementById("export-stage");
  stage.style.width = req.w + "px"; stage.style.height = req.h + "px";
  if (req.journal) {                               // at the printed size: the text scaled, no title, Plotly's own ticks
    fig = reportFigure(fig, req.journal.k);
    fig.layout.title = { text: "" };
    fig.layout.margin = { ...fig.layout.margin, t: fig.layout.annotations && fig.layout.annotations.length ? 26 : 10 };
  }
  try {
    await Plotly.newPlot(stage, fig.data, { ...fig.layout, width: req.w, height: req.h, autosize: false }, { staticPlot: false, displayModeBar: false });
    if (!req.journal) await denseTicks(stage);
    await new Promise((r) => setTimeout(r, 400));          // let WebGL scenes finish a frame
    const url = await Plotly.toImage(stage, { format: req.format, width: req.w, height: req.h, scale: req.format === "png" ? req.scale : 1 });
    const blob = await (await fetch(url)).blob();
    return req.journal && req.format === "png" ? pngWithDpi(blob, req.journal.dpi) : blob;
  } finally { Plotly.purge(stage); }
}

function sessionRecord() {
  return {
    software: { name: `${APP.name}, the ${APP.full}`, version: APP.version, repository: APP.repo,
                archive_doi: APP.doi, paper: APP.paper },
    runtime: { pyodide: APP.pyodideVersion, pyodide_source: _runtime.pyodide, plotly: APP.plotlyVersion,
               plotly_source: _runtime.plotly, user_agent: navigator.userAgent },
    session_started: session.started, exported: new Date().toISOString(),
    units: "micrometres unless the input file used other units",
    analyses: session.analyses, comparisons: session.comparisons,
  };
}

function exportJSON() {
  saveFile(`marq_results_${stampNow()}.json`, "application/json", textBlob(JSON.stringify(sessionRecord(), null, 1), "application/json"))
    .then((ok) => { if (ok) markSaved(); }).catch((err) => appendLog("Save failed: " + err.message));
}

function csvCell(v) {
  if (v == null || (typeof v === "number" && isNaN(v))) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCSV() {
  const lines = [];
  const R = (r) => r || {};
  if (session.analyses.length) {
    lines.push("# analysed surfaces (micrometres; roughness per ISO 25178 on plane-removed residuals; fieldL is the field strip at -Y, fieldR at +Y; input_scale converted a file not in micrometres; turned_over: a raised feature turned over before the analysis; feature: the Feature setting, auto, channel or ridge)");
    lines.push(["file", "time", "floor_width", "floor_width_sd_central80", "opening_width", "opening_width_sd",
                "depth", "depth_sd_central80", "wall_angle_deg", "wall_angle_left_deg", "wall_angle_right_deg",
                "wall_angle_resolved", "chord_angle_deg", "floor_corner_um", "rim_corner_um", "mid_width",
                "floor_length", "floor_length_sd", "opening_length",
                "orientation", "floor_Sa", "floor_Sq", "floor_Sz", "floor_Ssk", "floor_Sku",
                "fieldL_Sa", "fieldL_Sq", "fieldL_Sz", "fieldR_Sa", "fieldR_Sq", "fieldR_Sz",
                "voxel_size", "field_k", "crop_pad_x", "crop_pad_y", "opening_frac", "floor_width_frac",
                "floor_eval_frac", "floor_eval_length", "field_eval_width", "field_eval_length",
                "margin", "display_cell", "smooth_sigma", "n_slices", "skip_rows",
                "voxel_size_used", "rotation_deg", "tilt_xz_deg", "tilt_yz_deg", "opening_length_sd",
                // added 2026-10-25 at the end, so that scripts reading the earlier columns keep working
                "fieldL_Ssk", "fieldL_Sku", "fieldR_Ssk", "fieldR_Sku", "mid_width_sd", "wall_angle_line_sd",
                "line_valid_floor", "line_valid_opening", "line_valid_wall", "input_scale", "turned_over",
                "wall_dominance_fy", "feature"].join(","));
    session.analyses.forEach((a) => {
      const c = a.channel, p = a.parameters, rg = R(a.roughness);
      const fl = R(rg.floor), l = R(rg.surf_left), r = R(rg.surf_right);
      lines.push([a.file, a.time, c.floor_width, c.floor_width_line_std, c.opening_width, c.opening_width_conf,
                  c.mean_depth, c.channel_depth_slice_std_central80, c.wall_angle_deg, c.wall_angle_left_deg,
                  c.wall_angle_right_deg, c.wall_angle_resolved, c.chord_angle_deg, c.floor_corner_um, c.rim_corner_um,
                  c.mid_width, c.mean_length, c.mean_length_conf,
                  c.opening_length, a.rotation.converted ? "protrusion_rotated" : "depression",
                  fl.Sa, fl.Sq, fl.Sz, fl.Ssk, fl.Sku, l.Sa, l.Sq, l.Sz, r.Sa, r.Sq, r.Sz,
                  p.voxel_size, p.field_k, p.crop_pad_x, p.crop_pad_y, p.opening_frac, p.floor_width_frac,
                  p.floor_eval_frac, p.floor_eval_length, p.field_eval_width, p.field_eval_length,
                  p.margin, p.display_cell, p.smooth_sigma, p.n_slices, p.skip_rows,
                  a.rotation.voxel_size, a.rotation.phi, a.rotation.xz_tilt, a.rotation.yz_tilt, c.opening_length_conf,
                  l.Ssk, l.Sku, r.Ssk, r.Sku, c.mid_width_line_std, c.wall_angle_line_std,
                  c.line_valid_floor, c.line_valid_opening, c.line_valid_wall, p.input_scale || 1, a.rotation.turned_over ? 1 : 0,
                  c.f_y, featureOf(p)].map(csvCell).join(","));
    });
    lines.push("");
  }
  if (session.comparisons.length) {
    lines.push("# comparisons (A = reference, B = compared; correlations over the channel-interior mask)");
    lines.push(["file_a", "file_b", "time", "RQ", "RQdx", "RQdy", "RQd", "RMSE_Z", "RMSE_dZdx", "RMSE_dZdy", "RMSE_gradmag",
                "B_rotated_180", "n_mask_cells", "n_valid_cells", "cell_um", "grid_spacing", "smooth_sigma", "idealised_mode",
                "cell_y_um", "floor_texture_A_um", "floor_texture_B_um", "primary"].join(","));
    session.comparisons.forEach((c) => {
      const m = c.metrics, p = c.parameters;
      lines.push([c.file_a, c.file_b, c.time, m.r_z, m.r_gx, m.r_gy, m.r_mag, m.rmse_z, m.rmse_gx, m.rmse_gy, m.rmse_mag,
                  m.z_flip ? 1 : 0, m.n_mask, m.n_valid, m.cell_um ? m.cell_um[0] : "", p.grid_spacing, p.smooth_sigma,
                  m.cad_mode ? 1 : 0, m.cell_um ? m.cell_um[1] : "", ...(m.texture_um || ["", ""]),
                  m.primary === "r_z" ? "RQ" : "RQd"].map(csvCell).join(","));
    });
  }
  lines.push(`# ${APP.name} ${APP.version}, exported ${new Date().toISOString()}`);
  saveFile(`marq_results_${stampNow()}.csv`, "text/csv", textBlob(lines.join("\n"), "text/csv"))
    .then((ok) => { if (ok) markSaved(); }).catch((err) => appendLog("Save failed: " + err.message));
}

// ── Sessions ───────────────────────────────────────────────────────────────────
// A .marq file holds the results the engine has (so they can be shown, exported and rebuilt in
// another theme or language without a new analysis), the session record, surfaces A and B and
// the settings.

function saveSession() {
  const kept = Object.values(_A).filter((a) => a.held), keptC = Object.values(_C).filter((c) => c.held);
  if (!ready || running || _reporting || !(kept.length || keptC.length)) return;
  const slot = (k) => files[k] ? { name: files[k].name, isCrop: !!files[k].isCrop, from: files[k].from || null, aid: files[k].aid || null } : null;
  // version 3 (2026-10-25): every comparison the engine holds, not only the last
  const state = { format: "marq-session", version: 3, software: `${APP.name} ${APP.version}`, saved: new Date().toISOString(),
    session,
    analyses: kept.map((a) => ({ id: a.id, file: a.file, name: a.name, crop: { filename: a.crop.filename, available: a.crop.available },
                                 record: session.analyses.indexOf(a.record) })),
    comparisons: keptC.map((c) => ({ id: c.id, names: c.names, params: c.params, records: c.records.map((r) => session.comparisons.indexOf(r)),
                                     batch: c.batch ? { names: c.batch.names, rows: c.batch.rows } : null })),
    current: _curA, currentC: _curC, aSeq: _aSeq, cSeq: _cSeq, slots: { A: slot("A"), B: slot("B") }, view: _view, settings: collectParamValues() };
  const slots = {};
  ["A", "B"].forEach((k) => { if (files[k]) slots[k] = files[k].content; });
  saveFile(`marq_session_${stampNow()}.marq`, "application/zip", async () => {
    setStatus("Saving the session…", "info");
    const m = await ask("save_session", { state: JSON.stringify(state), want: { pvisual: kept.map((a) => a.id), rq_gradient: keptC.map((c) => c.id) }, slots }, "session");
    return new Blob([m.data], { type: "application/zip" });
  }).then((ok) => { if (ok) { markSaved(); setStatus("Session saved", "success"); } }).catch(() => {});
}

function handleSessionInput(input) {
  const f = input.files[0];
  input.value = "";
  if (f) openSessionFile(f);
}

function openSessionFile(file) {
  if (!ready || busy()) {
    showNotice(null, () => t("Wait until the engine is ready, then open the session again."), "warn");
    return;
  }
  if (unsaved()) {
    askUser(t("Replace the results?"), t("The results on screen are not saved. Open the session anyway and replace them?"),
      [[t("Cancel"), null, true], [t("Open the session"), () => readSessionFile(file)]]);
    return;
  }
  readSessionFile(file);
}

function readSessionFile(file) {
  const r = new FileReader();
  r.onload = (ev) => {
    if (busy()) return;
    _sessionName = file.name;
    setStatus("Opening the session…", "info");
    const bytes = new Uint8Array(ev.target.result);
    // nothing may start or be removed until the session has replaced the results: a run started
    // meanwhile would take an id of the session's (2026-10-25)
    _opening = true; updateButtons();
    ask("open_session", { bytes }, "session-open").then((m) => {
      let st = null;
      try { st = JSON.parse(m.state); } catch {}
      _opening = false;
      restoreSession(st, m.have || {}, m.slots || {});
    }).catch(() => {}).finally(() => { _opening = false; updateButtons(); });
  };
  r.onerror = () => showNotice("The file could not be opened", () => t("{name} could not be read. If it is on a network or cloud drive, copy it to this computer first.", { name: file.name }));
  r.readAsArrayBuffer(file);
}

function restoreSession(st, have, slots) {
  if (!st || st.format !== "marq-session" || !st.session) {
    showNotice("The session could not be opened", () => t("This file is not a MaRQ session."));
    return;
  }
  hideNotice(); closeSection();
  _xs = null;                      // the session's ids repeat those of the page: no cross-section range of another channel
  session.started = st.session.started || session.started;
  session.analyses = st.session.analyses || [];
  session.comparisons = st.session.comparisons || [];
  // the analyses: those the file holds, in their order (a first-version file holds the last one)
  Object.keys(_A).forEach((k) => delete _A[k]);
  document.getElementById("tree-analyses").innerHTML = "";
  _curA = null; _figs.pvisual = null; _props.pvisual = null; _cropText = null; _cropAvailable = false;
  const heldIds = have.pvisual || [];
  const list = st.version >= 2 ? (st.analyses || [])
    : heldIds.length ? [{ id: "a1", file: (session.analyses.at(-1) || {}).file || "", crop: st.crop || {}, record: session.analyses.length - 1 }] : [];
  list.filter((x) => heldIds.includes(x.id)).forEach((x) => {
    const a = _A[x.id] = { id: x.id, file: x.file, name: x.name || uniqueName(stem(x.file) || "surface"), record: session.analyses[x.record] || null,
                           figs: null, props: null, held: true, staleKeys: new Set(), rebuilding: false,
                           crop: { filename: (x.crop || {}).filename || null, available: !!(x.crop || {}).available, text: null } };
    addAnalysisNode(a);
  });
  _aSeq = Math.max(st.aSeq || 0, ...Object.keys(_A).map((k) => parseInt(k.slice(1), 10) || 0));
  // the comparisons the file holds (a file of before version 3 holds one, the last, as c1)
  Object.keys(_C).forEach((k) => delete _C[k]);
  document.getElementById("tree-comparisons").innerHTML = "";
  _curC = null; _figs.rq_gradient = null; _props.rq_gradient = null; _have.rq_gradient = false;
  _lastPairNames = null; _cmpParams = null; _lastBatch = null;
  const heldC = Array.isArray(have.rq_gradient) ? have.rq_gradient : [];
  const nRows = (b) => b ? b.rows.filter((r) => !r.error).length : 1, last = session.comparisons.length;
  const listC = st.version >= 3 ? (st.comparisons || [])
    : heldC.length ? [{ id: "c1", names: st.lastPairNames || ["A", "B"], params: (session.comparisons.at(-1) || {}).parameters || null,
                        records: Array.from({ length: Math.min(last, nRows(st.lastBatch)) }, (_, i) => last - nRows(st.lastBatch) + i),
                        batch: st.lastBatch || null }] : [];
  listC.filter((x) => heldC.includes(x.id)).forEach((x) => {
    const c = _C[x.id] = { id: x.id, names: x.names, params: x.params, figs: null, props: null, metrics: null, held: true,
                           staleKeys: new Set(), rebuilding: false, records: (x.records || []).map((i) => session.comparisons[i]).filter(Boolean),
                           batch: x.batch ? { ...x.batch, a: null, items: [] } : null };
    addComparisonNode(c);
  });
  _cSeq = Math.max(st.cSeq || 0, ...Object.keys(_C).map((k) => parseInt(k.slice(1), 10) || 0));
  ["A", "B"].forEach((k) => {
    const m = st.slots && st.slots[k];
    if (m && slots[k]) setFile(k, m.name, slots[k], m.isCrop ? { isCrop: true, from: m.from, aid: m.aid || null } : {});
    else if (files[k]) clearFile(k);
  });
  const curC = st.currentC && _C[st.currentC] ? st.currentC : Object.keys(_C).at(-1);
  if (curC) selectComparison(curC);
  if (st.settings) { applyParamValues(st.settings); saveParamsLocal(); }
  forgetCameras();
  showStart();
  const cur = st.current && _A[st.current] ? st.current : Object.keys(_A).at(-1);
  if (cur) selectAnalysis(cur);
  // the analysis and the comparison on screen are drawn now, the others when they are opened
  const n = (cur ? 1 : 0) + (curC ? 1 : 0);
  _restoring = n ? { n, view: st.view } : null;
  if (cur) { _serial.pvisual++; rebuildAnalysis(cur); }
  if (curC) { _serial.rq_gradient++; rebuildComparison(curC); }
  markSaved();
  updateButtons();
  setStatus("Session opened: {name}", "success", { name: _sessionName });
}

// ── Report ─────────────────────────────────────────────────────────────────────
// One printable page per result: the numbers as in the properties panel, the settings, and the
// main figures rebuilt in the light theme. Shown in a dialog, printed (or saved as PDF) from
// there, or saved as one HTML file.

// [figure, width, height, text size] of the report: drawn near the size they are printed at (two
// to a row in 92 mm, one in 188 mm), with larger text, so tick labels stay readable on A4
const REPORT_FIGS = {
  pvisual: [["channel", 700, 470, 1.35], ["profiles_xsection", 700, 470, 1.35], ["profiles_widthlength", 700, 470, 1.35], ["roughness", 700, 470, 1.35]],
  rq_gradient: [["gradmaps", 1000, 880, 1.25]],
};
const PARAM_KEYS = { "p-voxel": "voxel_size", "p-fieldk": "field_k", "p-cropx": "crop_pad_x", "p-cropy": "crop_pad_y",
  "p-ofrac": "opening_frac", "p-flfrac": "floor_width_frac", "p-rfloor": "floor_eval_frac", "p-rfloorlen": "floor_eval_length",
  "p-rfwidth": "field_eval_width", "p-rflen": "field_eval_length", "p-margin": "margin", "p-cell": "display_cell",
  "p-sigma": "smooth_sigma", "p-slices": "n_slices", "p-skiprows": "skip_rows",
  "g-spacing": "grid_spacing", "g-sigma": "smooth_sigma", "p-feature": "feature" };

function figureImage(kind, key, w, h, rid, k = 1) {
  return ask("export_figure", { kind, key, aid: kind === "pvisual" ? rid : null, cid: kind === "pvisual" ? null : rid, theme: "light", lang: LANG, quality: currentQuality(),
    palette: currentPalette(), equal: currentEqual() }, "repfig").then(async (m) => {
    const fig = reportFigure(JSON.parse(m.data), k), stage = document.getElementById("export-stage");
    stage.style.width = w + "px"; stage.style.height = h + "px";
    try {
      await Plotly.newPlot(stage, fig.data, { ...fig.layout, width: w, height: h, autosize: false }, { staticPlot: true, displayModeBar: false });
      return await Plotly.toImage(stage, { format: "png", width: w, height: h, scale: 3 });
    } finally { Plotly.purge(stage); }
  });
}

// a figure for a printed page (the report, k > 1) or a journal size (k < 1): the tick labels,
// axis titles and colour bars k times the size, the axes making room for their labels, and the
// title without its details (the page states them). Grown, the legend and the margins grow half
// as much (the plot keeps its room) and labels placed at a height of the data (the level lines)
// keep their size, so close ones stay apart; shrunk, everything shrinks alike.
function reportFigure(fig, k) {
  const grow = (o, f) => {
    if (Array.isArray(o)) { o.forEach((v) => grow(v, f)); return; }
    if (!o || typeof o !== "object" || (k > 1 && /^y\d*$/.test(o.yref || ""))) return;
    Object.keys(o).forEach((key) => {
      if ((key === "font" || key === "tickfont") && o[key] && typeof o[key].size === "number") o[key] = { ...o[key], size: o[key].size * f };
      grow(o[key], f);
    });
  };
  const L = fig.layout, half = k > 1 ? (1 + k) / 2 : k;
  if (L.legend && k > 1) grow(L.legend, half / k);   // grown by k below with the rest: half in all
  grow(L, k); grow(fig.data, k);
  if (L.title) {
    const tx = typeof L.title === "string" ? L.title : L.title.text || "";
    L.title = { ...(typeof L.title === "object" ? L.title : {}), text: tx.split(/\s+\|\s+/)[0] };
  }
  L.margin = Object.fromEntries(Object.entries(L.margin || {}).map(([s, v]) => [s, typeof v === "number" ? Math.round(v * half) : v]));
  Object.keys(L).forEach((a) => { if (/^[xy]axis\d*$/.test(a)) L[a] = { ...L[a], automargin: true }; });
  return fig;
}


// the properties of a result in the language on screen, made again from its session record when
// they were never made (a result of an opened session not looked at yet) or made in another
// language; false when there is nothing to make them from
function ensureProps(r, kind) {
  if (r.props && r.propsLang === LANG) return true;
  if (kind === "pvisual") {
    const rec = r.record;
    if (!rec || !rec.channel || !rec.rotation) return !!r.props;
    r.props = analysisProps(r, rec.channel, rec.rotation, rec.roughness);
  } else {
    const m = r.metrics || (r.records.length ? r.records.at(-1).metrics : null);
    if (!m) return !!r.props;
    r.props = comparisonProps(r, m);
  }
  r.propsLang = LANG;
  return true;
}

async function makeReport() {
  if (!ready || busy() || _exporting) return;
  const items = [...Object.values(_A).filter((a) => ensureProps(a, "pvisual")).map((a) => ["pvisual", a.id]),
                 ...Object.values(_C).filter((c) => ensureProps(c, "rq_gradient")).map((c) => ["rq_gradient", c.id])];
  if (!items.length) return;
  _reporting = true; updateButtons();
  document.getElementById("spinner").style.display = "inline-block";
  setStatus("Preparing the report…", "info");
  try {
    let logo = "";
    try { logo = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(await (await fetch("logo.svg")).text()))); } catch {}
    const pages = [];
    for (const [kind, aid] of items) {
      const imgs = [], held = (kind === "pvisual" ? _A[aid] : _C[aid]).held;
      if (held) for (const [key, w, h, k] of REPORT_FIGS[kind]) imgs.push(await figureImage(kind, key, w, h, aid, k));
      pages.push(reportPage(kind, imgs, logo, aid));
    }
    _reportHtml = reportDocument(pages);
    const frame = document.getElementById("report-frame");
    // Escape closes the dialog also while the focus is inside the report (its own document)
    frame.onload = () => { try { frame.contentDocument.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal("modal-report"); }); } catch {} };
    frame.srcdoc = _reportHtml;
    openModal("modal-report");
    setStatus("Report ready", "success");
  } catch (err) {
    appendLog("Report failed: " + ((err && err.message) || err));
    setStatus("Error: {msg}", "error", { msg: t("the report could not be made") });
  } finally {
    _reporting = false; updateButtons();
    if (!running) document.getElementById("spinner").style.display = "none";
  }
}

function reportPage(kind, imgs, logo, aid) {
  const date = new Date().toLocaleString(LANG === "tr" ? "tr-TR" : "en-GB", { dateStyle: "long", timeStyle: "short" });
  const A = kind === "pvisual" ? _A[aid] : null, C = kind === "rq_gradient" ? _C[aid] : null;
  const rec = A ? A.record : C.records.at(-1);
  const subject = kind === "pvisual" ? esc(rec ? rec.file : "")
    : `A: ${esc(C.names[0])}<br>B: ${esc(C.batch ? t("{n} surfaces", { n: C.batch.rows.length }) : C.names[1])}`;
  const params = (rec && rec.parameters) || (C && C.params) || {};
  const rows = PARAM_IDS.filter((id) => id.startsWith(kind === "pvisual" ? "p-" : "g-") || SHARED_PARAMS.includes(id)).map((id) => {
    const lab = document.getElementById(id).closest(".param-card").querySelector(".param-label").textContent;
    const val = id === "p-feature" ? featureOf(params) : params[PARAM_KEYS[id]], changed = val != null && !sameParam(val, _paramDefaults[id]);
    const shown = val == null ? "–" : id === "p-feature" ? t(FEATURE_NAMES[val] || String(val))
      : typeof val === "boolean" ? t(val ? "yes" : "no") : decimal(String(val));
    return `<tr${changed ? ' class="chg"' : ""}><td>${esc(lab)}</td><td>${esc(shown)}</td></tr>`;
  }).join("");
  let batch = "";
  if (C && C.batch) {
    const r = C.batch.rows.map((x, i) => x.error || !x.metrics
      ? `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td colspan="4">${esc(t("failed"))}</td></tr>`
      : `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td${x.metrics.primary === "r_z" ? ' class="key"' : ""}>${fmt(x.metrics.r_z, 3)}</td><td>${fmt(x.metrics.r_gx, 3)}</td><td>${fmt(x.metrics.r_gy, 3)}</td><td${x.metrics.primary === "r_z" ? "" : ' class="key"'}>${fmt(x.metrics.r_mag, 3)}</td></tr>`).join("");
    batch = `<h2>${esc(t("Batch results"))}</h2><table class="batch"><tr><th>#</th><th>${esc(t("Surface B"))}</th><th>RQ</th><th>RQ<sub>dx</sub></th><th>RQ<sub>dy</sub></th><th>RQ<sub>d</sub></th></tr>${r}</table>`;
  }
  return `<section class="page ${kind}">
  <header>${logo ? `<img src="${logo}" alt="">` : ""}<div><h1>${esc(t(kind === "pvisual" ? "Surface analysis" : "Comparison"))}</h1><div class="subj">${subject}</div></div>
    <div class="when">MaRQ ${APP.version}<br>${esc(date)}</div></header>
  <div class="grid"><div class="props">${A ? A.props : C.props}</div>
    <div class="settings"><h2>${esc(t("Settings"))}</h2><table>${rows}</table><p class="note">${esc(t("Values that differ from the paper defaults are in bold."))}</p></div></div>
  ${batch}
  <div class="figs">${imgs.map((src) => `<img src="${src}" alt="">`).join("")}</div>
  <footer>${esc(APP.name)}, ${esc(t(APP.full))}, ${esc(t("version"))} ${APP.version} · ${esc(APP.repo.replace(/^https?:\/\//, ""))}</footer>
</section>`;
}

function reportDocument(pages) {
  const font = cssVar("--sans");
  return `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t("MaRQ report"))}</title>
<style>
@page { size: A4; margin: 11mm; }
* { box-sizing: border-box; }
html { background: #e7e7ea; }
body { margin: 0; font-family: ${font}; font-variant-numeric: tabular-nums; color: #1f1f22; font-size: 8.6pt; line-height: 1.35; }
.bar { position: sticky; top: 0; display: flex; justify-content: flex-end; padding: 8px 12px; background: #f3f3f4; border-bottom: 1px solid #e1e1e4; }
.bar button { font: inherit; font-size: 10pt; padding: 5px 14px; border-radius: 4px; border: 1px solid #d32f2f; background: #d32f2f; color: #fff; cursor: pointer; }
.embedded .bar { display: none; }
.page { width: 188mm; min-height: 270mm; margin: 8mm auto; padding: 9mm 10mm; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
header { display: flex; align-items: center; gap: 4mm; border-bottom: 2px solid #d32f2f; padding-bottom: 3mm; margin-bottom: 4mm; }
header img { width: 11mm; height: 11mm; }
h1 { font-size: 15pt; margin: 0 0 1mm; font-weight: 600; }
h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #8a8a92; margin: 3mm 0 1.5mm; }
.subj { color: #55555c; font-size: 8.6pt; word-break: break-all; }
.when { margin-left: auto; text-align: right; color: #8a8a92; font-size: 7.6pt; white-space: nowrap; }
.grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 7mm; align-items: start; }
.pgroup { margin-bottom: 2.5mm; }
.pgroup-head { font-size: 7.4pt; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #8a8a92; padding: 1mm 0; }
.prow { display: grid; grid-template-columns: 1fr auto; gap: 3mm; padding: .5mm 0 .5mm 2mm; border-left: 2px solid transparent; align-items: baseline; }
.prow.key { border-left-color: #d32f2f; }
.pk { color: #55555c; } .pk small { color: #8a8a92; font-size: 7pt; }
.pv { color: #1f1f22; text-align: right; white-space: nowrap; }
.prow.big .pv { font-weight: 600; font-size: 9.6pt; } .prow.key .pv { color: #d32f2f; }
.pv .pm, .sub { color: #8a8a92; font-size: 7.4pt; } .sub { grid-column: 1 / -1; text-align: right; }
.prow.stack { grid-template-columns: 1fr; } .prow.stack .pv { text-align: left; font-family: ${font}; white-space: normal; word-break: break-all; }
.ptable, .settings table, table.batch { width: 100%; border-collapse: collapse; }
.ptable th, table.batch th { font-weight: 600; color: #8a8a92; text-align: right; border-bottom: 1px solid #e1e1e4; padding: .4mm 1mm; font-size: 7.4pt; }
.ptable td, table.batch td { text-align: right; padding: .4mm 1mm; }
.ptable th:first-child, .ptable td:first-child, table.batch td:nth-child(2), table.batch th:nth-child(2) { text-align: left; font-family: ${font}; color: #55555c; }
table.batch td.key { color: #d32f2f; font-weight: 600; }
.pnote, .note { color: #8a8a92; font-size: 7.4pt; margin: 1mm 0 0; }
.settings td { padding: .35mm 0; border-bottom: 1px solid #f0f0f2; vertical-align: top; }
.settings td:last-child { text-align: right; padding-left: 3mm; white-space: nowrap; }
.settings tr.chg td { font-weight: 600; color: #1f1f22; }
.figs { display: grid; gap: 3mm; margin-top: 4mm; }
.page.pvisual .figs { grid-template-columns: 1fr 1fr; }
.figs img { width: 100%; display: block; border: 1px solid #ececee; }
.page.rq_gradient .figs img { max-height: 128mm; object-fit: contain; }
footer { margin-top: 4mm; padding-top: 1.5mm; border-top: 1px solid #e1e1e4; color: #8a8a92; font-size: 7pt; }
@media print {
  html { background: #fff; } .bar { display: none; }
  .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; break-after: page; }
  .page:last-child { break-after: auto; }
}
</style>
<script>if (window.self !== window.top) document.documentElement.className = "embedded";</script></head>
<body><div class="bar"><button onclick="print()">${esc(t("Print or save as PDF…"))}</button></div>
${pages.join("\n")}
</body></html>`;
}

function printReport() { const f = document.getElementById("report-frame"); if (f.contentWindow) f.contentWindow.print(); }
function saveReportHtml() { if (_reportHtml) saveFile(`marq_report_${stampNow()}.html`, "text/html", textBlob(_reportHtml, "text/html")).catch(() => {}); }

// ── File menu ──────────────────────────────────────────────────────────────────

function setupFileMenu() {
  const btn = document.getElementById("file-menu-btn"), menu = document.getElementById("file-menu");
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ""))
    menu.querySelectorAll("kbd").forEach((k) => { k.textContent = k.textContent.replace("Ctrl+", "⌘"); });
  const items = () => Array.from(menu.querySelectorAll("button:not(:disabled)"));
  btn.addEventListener("click", (e) => { e.stopPropagation(); closeOptionsMenu(); menu.style.display === "flex" ? closeFileMenu() : openFileMenu(); });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".tb-menu")) { closeFileMenu(); closeOptionsMenu(); } });
  menu.addEventListener("keydown", (e) => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); (it[i + 1] || it[0]).focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (it[i - 1] || it[it.length - 1]).focus(); }
    else if (e.key === "Escape") { e.stopPropagation(); closeFileMenu(); btn.focus(); }
  });
  menu.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { closeFileMenu(); fileCommand(b.dataset.cmd); }));
}
function openFileMenu() {
  const idle = ready && !busy(), data = resultCount() > 0;
  const any = _have.pvisual || [...Object.values(_A), ...Object.values(_C)].some((r) => r.held);
  const on = { "open-cloud": true, "open-session": idle, "save-session": idle && any, example: idle, report: idle && any, figure: idle && any, json: data, csv: data };
  const menu = document.getElementById("file-menu");
  menu.querySelectorAll("button").forEach((b) => { b.disabled = !on[b.dataset.cmd]; });
  menu.style.display = "flex";
  document.getElementById("file-menu-btn").setAttribute("aria-expanded", "true");
  const first = menu.querySelector("button:not(:disabled)");
  if (first) first.focus();
}
function closeFileMenu() {
  document.getElementById("file-menu").style.display = "none";
  document.getElementById("file-menu-btn").setAttribute("aria-expanded", "false");
}
// ── Options menu ───────────────────────────────────────────────────────────────
// The interface size: Automatic, or one size; remembered on this computer.

function setupOptionsMenu() {
  const btn = document.getElementById("options-menu-btn"), menu = document.getElementById("options-menu");
  const items = () => Array.from(menu.querySelectorAll("button"));
  btn.addEventListener("click", (e) => { e.stopPropagation(); closeFileMenu(); menu.style.display === "flex" ? closeOptionsMenu() : openOptionsMenu(); });
  menu.addEventListener("keydown", (e) => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); (it[i + 1] || it[0]).focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (it[i - 1] || it[it.length - 1]).focus(); }
    else if (e.key === "Escape") { e.stopPropagation(); closeOptionsMenu(); btn.focus(); }
  });
  menu.querySelectorAll("button[data-size]").forEach((b) => b.addEventListener("click", () => {
    closeOptionsMenu();
    try { localStorage.setItem(LS.uisize, b.dataset.size); } catch {}
    applyUiSize();
    setStatus(b.dataset.size === "auto" ? "Interface size: automatic" : "Interface size: {p} %", "success", { p: Math.round(parseFloat(b.dataset.size) * 100) });
  }));
  updateOptionsMenu();
}
function openOptionsMenu() {
  const menu = document.getElementById("options-menu");
  updateOptionsMenu();
  menu.style.display = "flex";
  document.getElementById("options-menu-btn").setAttribute("aria-expanded", "true");
  (menu.querySelector('button[aria-checked="true"]') || menu.querySelector("button")).focus();
}
function closeOptionsMenu() {
  const menu = document.getElementById("options-menu");
  if (!menu) return;
  menu.style.display = "none";
  document.getElementById("options-menu-btn").setAttribute("aria-expanded", "false");
}
// the size chosen, ticked; and the browser zoom undone, when there is one
function updateOptionsMenu() {
  const set = uiSizeSetting();
  document.querySelectorAll("#options-menu button[data-size]").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.size === set));
    // the percentages in the language's form (the page's translation skips text without letters)
    if (b.dataset.size !== "auto") b.querySelector("span").textContent = t("{p} %", { p: Math.round(parseFloat(b.dataset.size) * 100) });
  });
  const note = document.getElementById("options-zoom");
  note.textContent = _uiZoom !== 1 ? keepPercent(t("The browser zoom of {z} % is undone. To set the browser back to 100 %, press {key} and 0.",
    { z: Math.round(_uiZoom * 100), key: zoomResetKeys() })) : "";
  note.style.display = _uiZoom !== 1 ? "" : "none";
}

function fileCommand(cmd) {
  const f = { "open-cloud": () => document.getElementById("file1-input").click(), "open-session": () => document.getElementById("session-input").click(),
              "save-session": saveSession, example: runExample, report: makeReport, figure: () => openExportDialog(), json: exportJSON, csv: exportCSV }[cmd];
  if (f) f();
}

// ── Running with the launcher ──────────────────────────────────────────────────
// Every MaRQ page tells the launcher it is open, every 20 s, and goodbye when it closes; the
// launcher stops a minute after the last one has gone. A call that fails means it has stopped.

const PAGE_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
let _serverLost = false;
function heartbeat() {
  if (!/^https?:$/.test(location.protocol)) return;
  fetch("__alive?id=" + PAGE_ID, { method: "POST", cache: "no-store", keepalive: true })
    .then(() => {
      if (!_serverLost) return;
      _serverLost = false;
      const b = document.getElementById("startup-banner");
      if (b && b.dataset.kind === "gone") b.remove();
    })
    .catch(() => { if (!_serverLost) { _serverLost = true; showStartupBanner(t(SERVER_GONE), "gone"); } });
}
function sayGoodbye() { try { navigator.sendBeacon("__bye?id=" + PAGE_ID); } catch {} }

// Results not saved yet (as a session, JSON or CSV): closing the window asks first.
// Which records were saved, not how many: one removed and another added is still unsaved (2026-10-25).
let _saved = new Set();
function resultCount() { return session.analyses.length + session.comparisons.length; }
function markSaved() { _saved = new Set([...session.analyses, ...session.comparisons]); }
function unsaved() { return [...session.analyses, ...session.comparisons].some((r) => !_saved.has(r)); }

function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ── Dialogs ────────────────────────────────────────────────────────────────────

function openModal(id) {
  if (id === "modal-about") {
    const src = (s) => s === "local" ? t("local bundle") : s === "cdn" ? t("internet") : s;
    document.getElementById("about-runtime").textContent =
      `Pyodide ${APP.pyodideVersion} (${src(_runtime.pyodide)}), Plotly.js ${APP.plotlyVersion} (${src(_runtime.plotly)})` +
      (window.MarqViewer ? `, three.js r${window.MarqViewer.version}.` : ".");
    document.getElementById("about-version").textContent = APP.version;
  }
  const el = document.getElementById(id);
  if (el.style.display !== "flex") el._return = document.activeElement;
  el.style.display = "flex";
  const box = el.querySelector(".modal-box");
  box.setAttribute("tabindex", "-1");
  if (!box.contains(document.activeElement)) box.focus({ preventScroll: true });
}
function closeModal(id) {
  const el = document.getElementById(id), back = el._return;
  el.style.display = "none"; el._return = null;
  if (back && document.contains(back)) back.focus({ preventScroll: true });
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

// The message is English (a key of i18n.js), shown in the interface language; the last one is
// kept, so it can be shown again after a language switch.
let _lastStatus = null, _statusBeforeDraw = null;
function setStatus(msg, level, vars) {
  _lastStatus = [msg, level, vars];
  const el = document.getElementById("status-bar");
  const pre = running && _batchRunning && _batchPos && msg !== "Batch {i} of {n}: {name}" ? t("Batch {i} of {n}", _batchPos) + " · " : "";
  el.textContent = pre + t(msg, vars); el.className = "status-bar status-" + level;
}
function setRunning(isRunning, kind) {
  running = isRunning; _pendingKind = isRunning ? kind : null;
  if (isRunning) { hideNotice(); hideGuide(); _autoSkipped = 0; } else { _batchRunning = false; _batchPos = null; hideRunCard(); }
  document.getElementById("spinner").style.display = isRunning ? "inline-block" : "none";
  updateButtons();
}
function appendLog(line) {
  const el = document.getElementById("log-box");
  el.value += line + "\n"; el.scrollTop = el.scrollHeight;
}
function clearLog() { document.getElementById("log-box").value = ""; }

// Progress text from the live log, in the status bar and in the progress card
function statusFromLog(raw) {
  if (!running) return;
  const line = String(raw).trim();          // the engine starts most step lines with a new line
  let m = line.match(/^STEP (\d+)\s+\S\s+(.+)$/);
  if (m) {
    setStatus("Step {n} of 9: {text}", "info", { n: m[1], text: t(m[2].trim()) });
    runStep(Math.min(7, Number(m[1]) - 1));             // steps 1 to 7, then 9 (the roughness)
    return;
  }
  if (/^Loading clouds/.test(line))      { setStatus("Comparison: loading the two surfaces…", "info"); runStep(0); }
  else if (/^Gridding points/.test(line)) { setStatus("Comparison: gridding…", "info"); runStep(1); }
  else if (/^Computing gradients/.test(line)) { setStatus("Comparison: slopes and correlations…", "info"); runStep(2); }
  else if (/Orientation check/.test(line)) { setStatus("Comparison: building the figures…", "info"); runStep(3); }
  else if (/^Total time/.test(line))     { setStatus("Building the figures…", "info"); runStep(8); }
}

// ── Progress in the view ───────────────────────────────────────────────────────
// While the engine runs, a card over the view lists the steps of the run, marks those done and
// the one under way, counts the seconds, and has Cancel; for a batch, the pair and a bar.

const RUN_STEPS = {
  pvisual: ["Loading", "Cropping edges", "Voxel downsampling", "Field-plane leveling + orientation", "Channel-axis alignment",
            "Display grids", "Cross-section geometry", "Roughness (ISO 25178)", "Building the figures"],
  rq_gradient: ["Reading the two surfaces", "Common grid", "Slopes and correlations", "Building the figures"],
};
let _runCard = null, _runTimer = null;

function showRunCard(kind, title, vars) {
  _runCard = { kind, cur: 0, t0: performance.now(), title, vars };
  const el = document.getElementById("run-card");
  el.querySelector(".rc-steps").innerHTML = RUN_STEPS[kind].map(() => "<li></li>").join("");
  document.getElementById("rc-cancel").textContent = t("Cancel");
  clearInterval(_runTimer);
  _runTimer = setInterval(drawRunCard, 1000);
  drawRunCard();
  el.style.display = "";
}

function runStep(i) {
  if (!_runCard || i <= _runCard.cur) return;      // forward only: a comparison grids both orientations of B
  _runCard.cur = i;
  drawRunCard();
}

function hideRunCard() {
  _runCard = null;
  clearInterval(_runTimer);
  document.getElementById("run-card").style.display = "none";
}

function drawRunCard() {
  const R = _runCard, el = document.getElementById("run-card");
  if (!R) return;
  el.querySelector(".rc-title").textContent = t(R.title, R.vars);
  el.querySelector(".rc-time").textContent = t("{s} s", { s: Math.round((performance.now() - R.t0) / 1000) });
  RUN_STEPS[R.kind].forEach((s, i) => {
    const li = el.querySelectorAll(".rc-steps li")[i];
    li.textContent = t(s);
    li.className = i < R.cur ? "done" : i === R.cur ? "now" : "";
  });
  const B = _batchRunning && _batchPos;
  el.classList.toggle("batch", !!B);
  if (B) {
    el.querySelector(".rc-batch").textContent = t("Pair {i} of {n}: {name}", B);
    el.querySelector(".rc-bar > div").style.width = (100 * (B.i - 1) / B.n).toFixed(1) + "%";
  }
}

// the runtime in the status bar: said only when it is not the offline bundle (the usual case)
function showRuntime() {
  const el = document.getElementById("sb-runtime"), p = _runtime.pyodide;
  el.textContent = t(p === "…" ? "Starting…" : "Runtime from the internet");
  el.style.display = p === "local" ? "none" : "";
}

function toggleLog(show) {
  const app = document.getElementById("app");
  const on = show === undefined ? !app.classList.contains("show-log") : !!show;
  app.classList.toggle("show-log", on);
  document.getElementById("toggle-log").classList.toggle("on", on);
}

// Draggable dividers between the panes; their positions are remembered.
function setupSplitters() {
  const root = document.documentElement, body = document.getElementById("body");
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS.layout) || "{}"); } catch {}
  // a width saved on a large screen is kept below 30 % of a smaller one, for each side pane; in rem,
  // so that it follows the interface size (saved in pixels before 2026-10-27, at a root of 16 px)
  const px = () => parseFloat(getComputedStyle(root).fontSize);
  ["left", "right"].forEach((k) => {
    const r = saved[k + "Rem"] || (saved[k] ? saved[k] / 16 : 0);
    if (r) root.style.setProperty("--" + k, Math.min(r, Math.max(14, innerWidth * 0.3 / px())).toFixed(2) + "rem");
  });
  const save = () => { try { localStorage.setItem(LS.layout, JSON.stringify(saved)); } catch {} };
  const drag = (handle, onMove) => handle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add("drag");
    const move = (ev) => onMove(ev);
    const up = () => {
      handle.classList.remove("drag");
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => handle.removeEventListener(t, up));
      handle.removeEventListener("pointermove", move); save();
    };
    handle.addEventListener("pointermove", move);
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => handle.addEventListener(t, up));
  });
  drag(document.getElementById("split-left"), (ev) => {
    const rem = parseFloat(getComputedStyle(root).fontSize);
    const w = Math.max(14 * rem, Math.min(34 * rem, ev.clientX));
    saved.leftRem = +(w / rem).toFixed(2); delete saved.left;
    root.style.setProperty("--left", saved.leftRem + "rem");
  });
  drag(document.getElementById("split-right"), (ev) => {
    const rem = parseFloat(getComputedStyle(root).fontSize);
    const w = Math.max(14 * rem, Math.min(34 * rem, body.getBoundingClientRect().right - ev.clientX));
    saved.rightRem = +(w / rem).toFixed(2); delete saved.right;
    root.style.setProperty("--right", saved.rightRem + "rem");
  });
}

// a side pane hidden for more room for the view, or shown again; remembered on this computer
function setPaneHidden(side, hide, save = true) {
  document.getElementById("app").classList.toggle("hide-" + side, hide);
  if (!save) return;
  try {
    const s = JSON.parse(localStorage.getItem(LS.panes) || "{}");
    s[side] = hide;
    localStorage.setItem(LS.panes, JSON.stringify(s));
  } catch {}
}

function setupPanes() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(LS.panes) || "{}"); } catch {}
  ["left", "right"].forEach((side) => {
    setPaneHidden(side, !!s[side], false);
    document.getElementById("hide-" + side).addEventListener("click", () => setPaneHidden(side, true));
    document.getElementById("show-" + side).addEventListener("click", () => setPaneHidden(side, false));
  });
}

function setupTree() {
  const tree = document.getElementById("tree");
  tree.querySelectorAll(".trow").forEach((r) => { r.tabIndex = 0; });
  tree.addEventListener("keydown", (e) => {
    if (e.target.closest("button")) return;      // a button in a row (×) acts by itself: Enter and Space click it
    const row = e.target.closest(".trow");
    if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); row.click(); }
  });
  tree.addEventListener("click", (e) => {
    const row = e.target.closest(".trow");
    if (!row || e.target.closest(".tx:not(.aremove):not(.cremove)")) return;
    if (e.target.closest(".aremove")) { removeAnalysis(row.dataset.aid); return; }
    if (row.dataset.view) { showView(row.dataset.view, { aid: row.dataset.aid, cid: row.dataset.cid }); return; }
    if (e.target.closest(".cremove")) { removeComparison(row.dataset.cid); return; }
    if (row.classList.contains("input")) {
      document.getElementById({ "file1-zone": "file1-input", "fileA-zone": "fileA-input", "fileB-zone": "fileB-input" }[row.id]).click();
      return;
    }
    const node = row.parentElement;
    if (node.classList.contains("tnode")) node.classList.toggle("open");
    if (row.dataset.aid && _A[row.dataset.aid] && row.dataset.aid !== _curA) {      // an analysis node: it becomes the current one
      selectAnalysis(row.dataset.aid);
      if (_view && VIEWS[_view].kind === "pvisual") showView(_view, { aid: row.dataset.aid });
    }
    if (row.dataset.cid && _C[row.dataset.cid] && row.dataset.cid !== _curC) {      // a comparison node, likewise
      selectComparison(row.dataset.cid);
      if (_view && VIEWS[_view].kind === "rq_gradient") showView(_view === "batch" && !_lastBatch ? "gradA" : _view, { cid: row.dataset.cid });
    }
  });
}

// ── Theme, palette & 3D detail ─────────────────────────────────────────────────

function currentQuality() {
  const v = parseInt(document.getElementById("quality-select").value, 10);   // -1: every cell (Very high)
  return isNaN(v) ? 200000 : v;
}
function currentPalette() { return document.getElementById("palette-select").value || "Earth"; }
function currentEqual() { return document.getElementById("equal-axes").checked; }

function applyPageTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  document.getElementById("theme-toggle").title = t(theme === "light" ? "Switch to the dark theme" : "Switch to the light theme");
  if (_viewer) _viewer.setTheme(theme === "dark");
}

// Rebuild the figures of every result the worker holds, with the new theme, colours or 3D
// detail, without analysing again.
function retheme() {
  if (!ready) return;
  if (running) { _rethemeQueued = true; return; }
  // every figure of every result is out of date; the one on screen is drawn again now, the
  // others when their views are opened
  [...Object.values(_A), ...Object.values(_C)].forEach((r) => { if (r.figs) r.staleKeys = new Set(Object.keys(r.figs)); });
  const v = _view && VIEWS[_view];
  if (v && v.kind === "pvisual" && _A[_curA] && _A[_curA].held) rebuildAnalysis(_curA, null, viewKeys(_view));
  if (v && v.kind === "rq_gradient" && _C[_curC] && _C[_curC].held) rebuildComparison(_curC, null, viewKeys(_view));
}

function cubeLabels() {
  return ["Right", "Left", "Top", "Bottom", "Front", "Back"].map((w) => t(w).toLocaleUpperCase(LANG === "tr" ? "tr-TR" : "en-GB"));
}

// Switch the interface language: the page at once, then the figures and the properties of every
// result the engine holds (rebuilt in the new language, no new analysis).
function setLanguage(lang, rebuild = true) {
  applyLanguage(lang);
  document.getElementById("lang-select").value = LANG;
  document.querySelectorAll(".file-name").forEach((el) => { if (!el.classList.contains("has-file")) el.textContent = t(el.dataset.placeholder || ""); });
  ["1", "A", "B"].forEach((slot) => { const f = files[slot]; if (f && f.isCrop) document.getElementById("file" + slot + "-name").textContent = t("crop of {name}", { name: f.from }); });
  updateBatchCount();
  markChangedParams();
  updateStart();
  renderGuide();
  document.querySelectorAll('input[type="range"]').forEach(rangeLabel);
  if (_lastBatch) renderBatchView();
  Object.values(_C).forEach(labelComparison);
  applyPageTheme(_theme);
  if (_section) drawSection();
  if (_xs && _view && VIEWS[_view].type === "xs") drawXs();
  updateOptionsMenu();
  if (_noticeArgs && document.getElementById("vp-notice").style.display === "flex") showNotice(..._noticeArgs);
  toolHint(document.getElementById("tool-hint").dataset.msg || null);
  if (_lastStatus) setStatus(..._lastStatus);
  document.getElementById("status-bar").title = t("Click to show the analysis log");
  document.getElementById("log-box").placeholder = t("The log of the analysis appears here.");
  showRuntime();
  if (_viewer) _viewer.setLabels(cubeLabels());
  if (_view) showView(_view, { keepCamera: true });
  else { updateDocTitle(null); document.getElementById("vp-title").textContent = t("Start"); }
  if (rebuild) retheme();
}

function toggleTheme() {
  _theme = _theme === "light" ? "dark" : "light";
  applyPageTheme(_theme);
  if (_section) drawSection();
  if (_xs && _view && VIEWS[_view].type === "xs") drawXs();
  try { localStorage.setItem(LS.theme, _theme); } catch {}
  retheme();
}

// ── Boot ───────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  _theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  document.querySelectorAll(".file-name").forEach((el) => { el.dataset.placeholder = el.textContent; });
  // the language: the one chosen in the menu last time, otherwise English. It is saved only when
  // chosen, under a key of its own (the key of before, marq.lang, was written at every start with
  // the browser's language, and so tells no choice)
  let lang = null;
  try { lang = localStorage.getItem(LS.lang); } catch {}
  if (!LANGS[lang]) lang = "en";
  setLanguage(lang, false);
  setStatus("Loading the Python runtime…", "info");
  document.getElementById("lang-select").addEventListener("change", (e) => {
    try { localStorage.setItem(LS.lang, e.target.value); } catch {}
    setLanguage(e.target.value);
  });
  const problem = startupProblem();
  if (problem) {
    showStartupBanner(problem);
    setStatus("MaRQ cannot start here, see the message at the top", "error");
    return;
  }
  if (typeof Plotly === "undefined")
    window.addEventListener("load", () => {
      if (typeof Plotly === "undefined")
        showStartupBanner(t("The plotting library could not be loaded: the folder software/vendor is incomplete and there is no internet connection. Extract the whole zip again."));
    });
  startWorker();
  setTimeout(() => { if (!ready && !document.getElementById("startup-banner")) showStartupBanner(t(SLOW_START), "slow"); }, 150000);
  heartbeat();
  setInterval(heartbeat, 20000);
  window.addEventListener("pagehide", sayGoodbye);
  window.addEventListener("pageshow", (e) => { if (e.persisted) heartbeat(); });
  window.addEventListener("beforeunload", (e) => { if (unsaved()) { e.preventDefault(); e.returnValue = "unsaved"; } });
  setupFileMenu();
  setupOptionsMenu();
  // the window resized, or zoomed (Ctrl and plus or minus): the interface keeps its size
  let _sizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(_sizeTimer);
    _sizeTimer = setTimeout(() => { applyUiSize(); checkZoom(); checkSmallWindow(); }, 120);
  });
  setTimeout(() => { checkZoom(); checkSmallWindow(); }, 1500);
  setupDropZone("file1-zone", "1");
  setupDropZone("fileA-zone", "A");
  setupDropZone("fileB-zone", "B");
  setupDropZone("batch-zone", "batch");
  setupWindowDrop();
  setupParams();
  setupTree();
  setupSplitters();
  setupPanes();
  updateButtons();
  document.getElementById("props-copy").addEventListener("click", copyProps);
  document.getElementById("rc-cancel").addEventListener("click", cancelRun);
  try { _outlineOn = localStorage.getItem(LS.outline) !== "0"; } catch {}
  document.querySelector('.navbtn[data-act="outline"]').classList.toggle("on", _outlineOn);

  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("quality-select").addEventListener("change", retheme);
  document.getElementById("palette-select").addEventListener("change", retheme);
  document.getElementById("exag-select").addEventListener("change", () => {
    if (_viewer) { _viewer.setExaggeration(currentExag()); _viewer.fit(); }
  });
  const bindCheck = (id, key, after) => {
    const el = document.getElementById(id);
    try { const v = localStorage.getItem(key); if (v === "0" || v === "1") el.checked = v === "1"; } catch {}
    el.addEventListener("change", () => { try { localStorage.setItem(key, el.checked ? "1" : "0"); } catch {} after(); });
  };
  bindCheck("equal-axes", LS.equal, () => { retheme(); if (_section) drawSection(); if (_xs && _view && VIEWS[_view].type === "xs") drawXs(); });
  document.getElementById("xs-slider").addEventListener("input", (e) => {
    if (_xs && _xs.rng) setXsPosition(_xs.rng.lo + (_xs.rng.hi - _xs.rng.lo) * Number(e.target.value) / 1000);
  });
  document.getElementById("xs-frac").addEventListener("change", (e) => {
    const f = parseFloat(e.target.value);
    if (_xs && _xs.rng && isFinite(f)) setXsPosition(_xs.rng.lo + (_xs.rng.hi - _xs.rng.lo) * Math.max(0, Math.min(1, f)));
  });
  document.getElementById("xs-um").addEventListener("change", (e) => {
    const u = parseFloat(e.target.value);
    if (_xs && _xs.rng && isFinite(u)) setXsPosition(_xs.rng.lo + u);
  });
  bindCheck("link-maps", LS.linkMaps, () => {          // the map views are drawn again, linked or not
    Object.keys(LINKED_2D).forEach((k) => { const el = document.getElementById(FIGS.rq_gradient[k][1]); if (el) el._marqFig = null; });
    if (_view && LINKED_2D[VIEWS[_view].key]) showView(_view);
  });
  bindCheck("link-cameras", LS.linkCams, () => { Object.keys(_cams).forEach((k) => { if (k.startsWith("grad@")) delete _cams[k]; }); });
  syncNavToggles();

  document.getElementById("toggle-log").addEventListener("click", () => toggleLog());
  document.getElementById("status-bar").addEventListener("click", () => toggleLog());
  document.getElementById("settings-open").addEventListener("click", () => openModal("modal-settings"));
  document.getElementById("ready-settings").addEventListener("click", () => openModal("modal-settings"));
  document.getElementById("gb-close").addEventListener("click", hideGuide);
  document.getElementById("gb-off").addEventListener("click", () => { setTips(false); setStatus("Tips turned off; Help (?) turns them on again", "info"); });
  document.getElementById("tips-on").checked = tipsOn();
  document.getElementById("tips-on").addEventListener("change", (e) => setTips(e.target.checked));
  document.getElementById("ready-run").addEventListener("click", () => { const r = document.getElementById("ready-box")._run; if (r) r(); });
  document.getElementById("about-open").addEventListener("click", () => openModal("modal-about"));
  document.getElementById("help-open").addEventListener("click", () => openModal("modal-help"));
  document.querySelectorAll("#navbar .navbtn").forEach((b) => b.addEventListener("click", () => navAction(b.dataset.act)));
  // a click on the backdrop closes a dialog, but not a drag that started inside it
  document.querySelectorAll(".modal").forEach((m) => {
    let down = null;
    m.addEventListener("mousedown", (e) => { down = e.target; });
    m.addEventListener("click", (e) => { if (e.target === m && down === m) closeModal(m.id); down = null; });
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // the dialog on top: the last open one in the page (one opened from Settings comes after it)
      const open = Array.from(document.querySelectorAll(".modal")).filter((m) => m.style.display === "flex");
      if (open.length) closeModal(open.at(-1).id);
      toggleLog(false); closeFileMenu(); closeOptionsMenu();
      if (_viewer && _viewer.marks.length) _viewer.clearMarks();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && /^[so]$/i.test(e.key)) {
      e.preventDefault();
      if (e.key.toLowerCase() === "s") saveSession(); else document.getElementById("file1-input").click();
      return;
    }
    if (e.target.closest("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (Array.from(document.querySelectorAll(".modal")).some((m) => m.style.display === "flex")) return;
    const v = _view && VIEWS[_view];
    if (!v) return;
    if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      e.preventDefault(); navAction(e.key === "+" || e.key === "=" ? "zoomin" : "zoomout"); return;
    }
    if (v.type !== "3d") return;
    const act = { h: "home", f: "fit", "1": "top", "2": "front", "3": "right", o: "ortho", m: "measure", s: "section", c: "xsect" }[e.key.toLowerCase()];
    if (act) { e.preventDefault(); navAction(act); }
  });
});
// the 3D module may load after the page: the view on screen is drawn again with it
window.addEventListener("marq-viewer-ready", () => { if (_view && VIEWS[_view] && VIEWS[_view].type === "3d") showView(_view); });
