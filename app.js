/* MaRQ (Microchannel and Replication Quality Analyzer): main application logic */

const APP = {
  name: "MaRQ", full: "Microchannel and Replication Quality Analyzer", version: "1.0",
  repo: "https://github.com/ogulcangngr/MaRQ", doi: "10.5281/zenodo.22813916",
  plotlyVersion: "2.35.2", pyodideVersion: "0.26.4",
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
};
const VIEW_OF_KEY = Object.fromEntries(Object.entries(VIEWS).filter(([, v]) => v.key).map(([id, v]) => [v.key, id]));

const PARAM_IDS = ["p-voxel", "p-fieldk", "p-cropx", "p-cropy", "p-ofrac", "p-flfrac", "p-rfloor",
                   "p-rfloorlen", "p-rfwidth", "p-rflen", "p-margin", "p-cell", "p-sigma", "p-slices",
                   "p-skiprows", "g-spacing", "g-sigma", "g-skiprows"];
const LS = { params: "marq.params.v1", theme: "marq.theme", layout: "marq.layout2", equal: "marq.equal",
             linkMaps: "marq.linkMaps", linkCams: "marq.linkCameras", lang: "marq.lang" };
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
let _run            = null;     // what the run in progress was started with: kind, file or names, settings
let _batchRunning   = false;
let _batchPos       = null;     // {i, n} of the batch comparison in progress
const _serial       = { pvisual: 0, rq_gradient: 0 };   // results so far, for the 2D zoom memory
let _restoring      = null;     // {n, view} while the results of an opened session are rebuilt
let _sessionName    = "";
let _reporting      = false;    // a report is being put together
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
let _mapRange = null;           // the zoom the height and slope maps share
let _asks = {}, _askSeq = 0;    // engine requests waiting for their reply

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
      "background:#b3261e;color:#fff;font:15px/1.45 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35)";
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
  worker = new Worker("worker.js");

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
        document.getElementById("sb-runtime").textContent =
          t(_runtime.pyodide === "local" ? "Offline bundle" : "Runtime from the internet");
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
          showNotice(null, t("The result could not be shown ({m}). The log has the details.", { m: (err && err.message) || String(err) }));
        } finally { if (!e.data.retheme) setRunning(false); }
        if (_rethemeQueued && !running) { _rethemeQueued = false; retheme(); }
        break;
      case "batch_progress":
        _batchPos = { i: e.data.index + 1, n: e.data.total };
        setStatus("Batch {i} of {n}: {name}", "info", { ..._batchPos, name: e.data.name });
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
        if (prefix === "rt" || /^rt-a/.test(e.data.id || "")) {            // a rebuild the engine could not do
          const a = _A[String(e.data.id).slice(3)];
          if (a) { a.rebuilding = false; a.held = false; if (a.id === _curA) selectAnalysis(a.id); }
        }
        const what = !isRun ? ({ fig: "The figure could not be exported", crop: "The crop could not be prepared", repfig: "The report could not be made",
                                 session: "The session could not be saved", "session-open": "The session could not be opened",
                                 xs: "The cross-section could not be read" }[prefix] || null)
                   : _pendingKind === "pvisual" ? "The analysis stopped" : _batchRunning ? "The batch stopped" : "The comparison stopped";
        const fatal = FATAL_ERR.test(message);
        const [short, long] = explainError(message, fatal);
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
      { row: Number(m[2]) + 1 + skipRowsUsed(), s: m[1].slice(0, 40) })];
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
function skipRowsUsed() { return _autoSkipped || Math.round(num(_pendingKind === "pvisual" ? "p-skiprows" : "g-skiprows", 0)); }

// a message over the viewport, for errors
function showNotice(title, body, level = "error") {
  const el = document.getElementById("vp-notice");
  el.classList.toggle("warn", level === "warn");
  document.getElementById("vn-title").textContent = title ? t(title) : "";
  document.getElementById("vn-title").style.display = title ? "" : "none";
  document.getElementById("vn-body").textContent = body;
  el.style.display = "flex";
}
function hideNotice() { document.getElementById("vp-notice").style.display = "none"; }

// a new engine, after a crash: the results it held are gone
function restartEngine() {
  try { worker.terminate(); } catch {}
  ready = false; running = false;
  _lastKind = null; _have.pvisual = _have.rq_gradient = false;
  Object.values(_A).forEach((a) => { a.held = false; a.rebuilding = false; });
  if (!_cropText) _cropAvailable = false;
  _rethemeQueued = false;
  Object.values(_asks).forEach((w) => w.reject(new Error("the analysis engine restarted")));
  _asks = {};
  updateAnalysisNodes();
  updateButtons();
  startWorker();
}

function cancelRun() {
  if (!worker) return;
  setRunning(false);
  appendLog("\n[cancelled by the user; the analysis engine is restarting]");
  restartEngine();                     // the cached Python results are gone with the old engine
  setStatus("Cancelled, restarting the engine…", "info");
}

// ── Files ──────────────────────────────────────────────────────────────────────

function setFile(slot, name, content, extra = {}) {
  files[slot] = { name, content, ...extra };
  const nameEl = document.getElementById("file" + slot + "-name");
  nameEl.textContent = extra.isCrop ? t("crop of {name}", { name: extra.from }) : name;
  nameEl.title = name;
  nameEl.classList.add("has-file");
  document.getElementById("file" + slot + "-clear").style.display = "";
  if (slot === "1") _file1Analysed = false;
  updateAnalysisNodes();
  updateButtons();
}

function readFile(file, slot) {
  if (/\.marq$/i.test(file.name)) { openSessionFile(file); return; }
  if (!file.size) {
    showNotice("The file could not be opened", t("{name} is empty, or is a folder. Open a point cloud file.", { name: file.name }));
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => { hideNotice(); setFile(slot, file.name, new Uint8Array(ev.target.result)); };
  reader.onerror = () => showNotice("The file could not be opened",
    t("{name} could not be read. If it is on a network or cloud drive, copy it to this computer first.", { name: file.name }));
  reader.readAsArrayBuffer(file);
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

function handleBatchInput(fileList) {
  const el = document.getElementById("batch-input");
  const list = Array.from(fileList || el.files).filter((f) => f.size > 0);
  el.value = "";
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
  const idle = ready && !running && !_reporting;
  document.getElementById("run-pvisual").disabled  = !(idle && files["1"]);
  document.getElementById("run-gradient").disabled = !(idle && files["A"] && files["B"]);
  document.getElementById("batch-run").disabled    = !(idle && files["A"] && batchFiles.length);
  const crop = idle && _cropAvailable;
  ["download-crop", "use-crop-a", "use-crop-b"].forEach((id) => document.getElementById(id).disabled = !crop);
  document.getElementById("export-figure").disabled = !(idle && (_have.pvisual || _have.rq_gradient));
  document.getElementById("export-report").disabled = !(idle && (_have.pvisual || _have.rq_gradient));
  const hasData = session.analyses.length || session.comparisons.length;
  document.getElementById("export-json").disabled = !hasData;
  document.getElementById("export-csv").disabled  = !hasData;
  document.getElementById("cancel-run").style.visibility = running ? "visible" : "hidden";
  updateNext();
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
    if (list.length > 1) showNotice(null, t("Only the first file, {name}, was opened. To compare several surfaces with A, drop them on Batch files… in the ribbon.", { name: f.name }), "warn");
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

function useCrop(slot) {
  const a = _A[_curA];
  if (!a || !ready) return;
  cropText(a).then((text) => {
    setFile(slot, a.crop.filename, new TextEncoder().encode(text), { isCrop: true, from: a.file, aid: a.id });
    setStatus("Crop placed as Surface {slot}", "success", { slot });
    updateButtons();
  }).catch(() => {});
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
  if (!f || !ready || running || !checkParams("p-")) return;
  setRunning(true, "pvisual"); clearLog();
  _run = { kind: "pvisual", file: f.name, content: f.content, params: getPvisualParams(), aid: "a" + (++_aSeq) };
  setStatus("Analysing the surface…", "info");
  worker.postMessage({ type: "run_pvisual", id: "pv1",
    data: { fileContent: f.content, fileName: f.name, params: _run.params, aid: _run.aid, ...viewOpts() } });
}

function runGradient() {
  const a = files["A"], b = files["B"];
  if (!a || !b || !ready || running || !checkParams("g-")) return;
  setRunning(true, "rq_gradient"); clearLog();
  _batchRows = []; _run = { kind: "rq_gradient", names: [a.name, b.name], params: getGradientParams() };
  setStatus("Comparing the two surfaces…", "info");
  worker.postMessage({ type: "run_rq_gradient", id: "rq1",
    data: { file1Content: a.content, fileName1: a.name, file2Content: b.content, fileName2: b.name,
            params: _run.params, ...viewOpts() } });
}

function runBatch() {
  const a = files["A"];
  if (!a || !batchFiles.length || !ready || running || !checkParams("g-")) return;
  setRunning(true, "rq_gradient"); clearLog();
  _batchRunning = true;
  _batchRows = [];
  _run = { kind: "rq_gradient", names: [a.name, batchFiles.at(-1).name], params: getGradientParams(),
           batch: { a: { ...a }, items: batchFiles.slice() } };
  setStatus("Batch: {n} comparisons…", "info", { n: batchFiles.length });
  worker.postMessage({ type: "run_batch", id: "batch",
    data: { file1Content: a.content, fileName1: a.name,
            items: batchFiles.map((f) => ({ name: f.name, content: f.content })),
            params: _run.params, ...viewOpts() } });
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
  };
}

function getGradientParams() {
  return { grid_spacing: num("g-spacing", 5), smooth_sigma: num("g-sigma", 0), skip_rows: Math.round(num("g-skiprows", 0)) };
}

const _paramDefaults = {};

function collectParamValues() {
  const o = {};
  PARAM_IDS.forEach((id) => { const el = document.getElementById(id); if (el) o[id] = el.value; });
  return o;
}

function applyParamValues(o) {
  PARAM_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el || o[id] === undefined || o[id] === null) return;
    el.value = String(o[id]);
    el.dispatchEvent(new Event("input"));     // updates the slider labels
  });
  markChangedParams();
}

// a setting that cannot be used: empty, not a number, or below its minimum
function badParam(el) { const v = el.validity || {}; return el.value === "" || v.badInput || v.rangeUnderflow || v.rangeOverflow; }

// Before a run: unusable settings are marked in the Settings dialog, which opens.
function checkParams(prefix) {
  const bad = PARAM_IDS.filter((id) => id.startsWith(prefix)).map((id) => document.getElementById(id)).filter((el) => el && badParam(el));
  if (!bad.length) return true;
  markChangedParams();
  openModal("modal-settings");
  bad[0].focus();
  const names = bad.map((el) => { const l = el.closest(".param-card").querySelector(".param-label"); return l ? l.textContent : el.id; });
  showNotice("Check the settings", t("These settings are empty or out of range: {list}.", { list: names.join("; ") }), "warn");
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
    const changed = parseFloat(el.value) !== parseFloat(_paramDefaults[id]);
    el.closest(".param-card").classList.toggle("changed", changed);
    el.closest(".param-card").classList.toggle("invalid", !!badParam(el));
    if (changed) n++;
  });
  document.getElementById("params-note").textContent =
    n ? t(n > 1 ? "{n} values differ from the paper defaults (marked)." : "{n} value differs from the paper defaults (marked).", { n })
      : t("All values are the paper defaults.");
  document.getElementById("params-reset").classList.toggle("attention", n > 0);
  document.getElementById("params-summary").textContent = n ? t("Settings: {n} changed from the paper", { n }) : t("Paper defaults");
  document.getElementById("settings-summary").classList.toggle("changed", n > 0);
  document.getElementById("settings-dot").style.display = n ? "" : "none";
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
    _paramDefaults[id] = el.value;                // the values written in the page are the paper's
    el.addEventListener("input",  () => { markChangedParams(); });
    el.addEventListener("change", () => { markChangedParams(); saveParamsLocal(); });
  });
  restoreParamsLocal();
  markChangedParams();
}

// ── Results ────────────────────────────────────────────────────────────────────

function onResult(kind, jsonStr, msg) {
  const result = JSON.parse(jsonStr);
  _lastKind = kind;
  if (kind !== "pvisual") _have[kind] = true;      // an analysis: selectAnalysis says whether the engine holds it
  if (!msg.retheme) _serial[kind]++;
  if (kind === "pvisual")          renderPvisual(result, !!msg.retheme, msg);
  else if (kind === "rq_gradient") renderGradient(result, !!msg.retheme, msg.batch || null, msg.lastName || null);
  if (msg.retheme && _restoring && --_restoring.n <= 0) {
    const v = _restoring.view, V = v && VIEWS[v];
    _restoring = null;
    showView(V && (V.type === "html" ? _lastBatch : _figs[V.kind]) ? v : (_figs.rq_gradient ? "gradA" : "channel"), { aid: _curA });
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
  draft: "Mid-wall angle from the vertical: a straight line through the wall positions at 25-75 % of the depth on every grid line, median over the lines and both walls (left and right in brackets). Below 3° the wall spans too few grid cells to be resolved.",
  corners: "Corner rounding: how far the wall lies inside the extended mid-wall line at the floor level (floor corner) and outside it at the opening level (rim corner), per corner.",
  floor_length: "Channel length along the centre line at the floor level: median of the grid lines along the channel near its centre line, each end read from the outside in, with their standard deviation.",
  opening_length: "Channel length along the centre line at the opening level.",
  orientation: "Whether the feature was a depression, or a protrusion rotated to a depression (a proper rotation, so handedness is kept).",
  RQ:   "Pearson correlation of the two height maps over the channel-interior mask.",
  RQdx: "Pearson correlation of the signed slopes along the channel over the mask.",
  RQdy: "Pearson correlation of the signed slopes across the channel over the mask.",
  RQd:  "Pearson correlation of the slope-magnitude maps over the channel-interior mask at the stated grid cell size (5 µm in the paper). The grading metric of the paper.",
};

const prow = (label, val, tip, cls = "") =>
  `<div class="prow ${cls}" title="${esc(tip ? t(tip) : "")}"><span class="pk">${label}</span><span class="pv">${val}</span></div>`;

function renderPvisual(result, retheme, msg = {}) {
  const aid = msg.aid || (_run && _run.aid) || ("a" + (++_aSeq));
  let a = _A[aid];
  if (!a) {                                   // a new analysis (the scan slot may hold another file by now)
    const file = (_run && _run.file) || "";
    a = _A[aid] = { id: aid, file, name: uniqueName(stem(file) || "surface"), record: null, figs: null, props: null,
                    held: true, stale: false, rebuilding: false, crop: { filename: null, available: false, text: null } };
  }
  a.figs = result.figures; a.held = true; a.stale = false; a.rebuilding = false;
  (msg.dropped || []).forEach((id) => { if (_A[id]) _A[id].held = false; });
  const fname = a.file;
  const ch = result.channel_info, rot = result.rotation_info, rgh = result.roughness_info;
  const floorPct = Math.round((ch.floor_width_frac != null ? ch.floor_width_frac : 0.90) * 100);
  const orient = t(rot.converted ? "protrusion, rotated" : "depression");
  const wa = ch.wall_angle_deg != null ? ch.wall_angle_deg : ch.draft_angle_deg;
  const wallTxt = (ch.wall_angle_resolved === false && wa != null && !isNaN(wa)) ? "< 3°"
    : fmt(wa, 2) + "°" + (ch.wall_angle_left_deg != null
        ? ` <span class="pm">(${fmt(ch.wall_angle_left_deg, 1)}; ${fmt(ch.wall_angle_right_deg, 1)})</span>` : "");
  const rr = (label, r) => r
    ? `<tr><td>${label}</td><td>${fmt(r.Sa, 2)}</td><td>${fmt(r.Sq, 2)}</td><td>${fmt(r.Sz, 1)}</td><td>${fmt(r.Ssk, 2)}</td><td>${fmt(r.Sku, 2)}</td></tr>`
    : `<tr><td>${label}</td><td colspan="5">–</td></tr>`;

  a.props = `
    <div class="pgroup"><div class="pgroup-head">${t("Channel geometry")}</div>
      ${prow(`${t("Floor width")} <small>${t("{p} % of depth", { p: floorPct })}</small>`, fmt(ch.floor_width) + UM, TIPS.floor_width, "key big")}
      ${prow(t("Channel depth"), fmt(ch.mean_depth) + UM, TIPS.depth, "key big")}
      ${prow(`${t("Wall angle")} <small>${t("from vertical")}</small>`, wallTxt, TIPS.draft, "key big")}
      ${prow(`${t("Width variation")} <small>${t("SD, central 80 %")}</small>`, fmt(ch.floor_width_conf) + UM, TIPS.width_sd)}
      ${prow(t("Opening width"), fmtPm(ch.opening_width, ch.opening_width_conf) + UM, TIPS.opening_width)}
      ${prow(`${t("Corner rounding")} <small>${t("floor, rim")}</small>`, `${fmt(ch.floor_corner_um, 1)}; ${fmt(ch.rim_corner_um, 1)}` + UM, TIPS.corners)}
      ${prow(t("Floor length"), fmtPm(ch.mean_length, ch.mean_length_conf, 1) + UM, TIPS.floor_length)}
      ${prow(t("Opening length"), fmtPm(ch.opening_length, ch.opening_length_conf, 1) + UM, TIPS.opening_length)}
      ${prow(t("Feature"), orient, TIPS.orientation)}
    </div>
    <div class="pgroup"><div class="pgroup-head">${t("Roughness, ISO 25178")} <span style="text-transform:none;letter-spacing:0;font-weight:500">(µm)</span></div>
      <table class="ptable">
        <thead><tr><th></th><th>Sa</th><th>Sq</th><th>Sz</th><th>Ssk</th><th>Sku</th></tr></thead>
        <tbody>${rr(t("Floor"), rgh && rgh.floor)}${rr(t("Field, left"), rgh && rgh.surf_left)}${rr(t("Field, right"), rgh && rgh.surf_right)}</tbody>
      </table>
    </div>
    <div class="pgroup"><div class="pgroup-head">${t("Alignment")}</div>
      ${prow(t("Rotation about Z"), fmt(rot.phi, 2) + "°")}
      ${prow(`${t("Residual tilt")} <small>XZ, YZ</small>`, `${fmt(rot.xz_tilt, 2)}°; ${fmt(rot.yz_tilt, 2)}°`)}
      ${prow(t("Voxel size"), fmt(rot.voxel_size, 1) + UM)}
    </div>`;

  if (!retheme) {
    _file1Analysed = !!(files["1"] && _run && files["1"].content === _run.content);   // not a file opened meanwhile
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
    // a channel no deeper than the roughness of the field is noise: say so
    const sq = Math.max(...["surf_left", "surf_right"].map((k) => (rgh && rgh[k] && rgh[k].Sq) || 0));
    if (!(ch.mean_depth > Math.max(1, 5 * sq)))
      showNotice("No clear channel in this scan", t("The channel found is {d} µm deep, close to the roughness of the flat surface around it, so the measured geometry has no meaning. Check that the scan contains the channel and that the edge margin (Settings, Advanced) does not cut it away.",
        { d: fmt(ch.mean_depth, 2) }), "warn");
  } else if (aid === _curA) {
    selectAnalysis(aid);
    const next = a.pendingView || (_view && VIEWS[_view].kind === "pvisual" ? _view : null);
    a.pendingView = null;
    if (next) showView(next, { aid, keepCamera: true });
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
// holds it); the view follows when they arrive
function rebuildAnalysis(aid, thenView) {
  const a = _A[aid];
  if (!a || !a.held) return;
  if (thenView) a.pendingView = thenView;
  if (a.rebuilding) return;
  a.rebuilding = true;
  worker.postMessage({ type: "retheme", id: "rt-" + aid, data: { kind: "pvisual", aid, ...viewOpts() } });
}

function removeAnalysis(aid) {
  const a = _A[aid];
  if (!a || running) return;
  if (!confirm(t("Remove the analysis of {name} from this session? Its results leave the session and the exports.", { name: a.name }))) return;
  if (ready) worker.postMessage({ type: "forget", data: { aid } });
  const i = session.analyses.indexOf(a.record);
  if (i >= 0) session.analyses.splice(i, 1);
  delete _A[aid];
  const node = document.querySelector(`#tree-analyses .tnode.analysis[data-aid="${aid}"]`);
  if (node) node.remove();
  Object.keys(_cams).forEach((k) => { if (k.endsWith("@" + aid)) delete _cams[k]; });
  if (_viewerKey && _viewerKey.endsWith("@" + aid)) _viewerKey = null;
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
  showProps(null); updateDocTitle(null);
}

// voxel size in a file name: 5 as "5", 2.5 as "2.5"
const voxTag = (v) => String(Math.abs(v - Math.round(v)) < 1e-6 ? Math.round(v) : +Number(v).toFixed(2));

function renderGradient(result, retheme, batch, lastName) {
  const figs = result.figures;
  // the names of the pair are those of this result (the slots may hold other files by now)
  if (!retheme && _run && _run.names) _lastPairNames = [_run.names[0], lastName || _run.names[1]];
  _figs.rq_gradient = figs;
  ["grad3d_cloud1", "grad3d_cloud2", "grad3d_error"].forEach((k) => figs[k] && captionFrom(k, figs[k].layout));

  const m = result.metrics;
  const names = _lastPairNames || ["A", "B"];
  const metric = (name, label, r, rmse, unit, key) =>
    `<div class="prow ${key ? "key big" : "big"}" title="${esc(t(TIPS[name]))}"><span class="pk">${label}</span><span class="pv">${fmt(r, 4)}</span>
       <span class="sub">RMSE ${rmse}${unit}</span></div>`;
  const notes = [];
  if (m.z_flip != null) notes.push(t(m.z_flip ? "Surface B was rotated 180° about Z to match A." : "Surface B was used as it is."));
  if (m.cell_um)        notes.push(t("Grid {g} µm.", { g: fmt(m.cell_um[0], 2) }));
  if (m.n_mask != null && m.n_valid) notes.push(t("{n} channel-interior cells ({p} % of the valid common grid).",
                                                  { n: intl(m.n_mask), p: Math.round(100 * m.n_mask / m.n_valid) }));
  _props.rq_gradient = `
    <div class="pgroup"><div class="pgroup-head">${t("Surfaces")}</div>
      <div class="prow stack" title="${esc(names[0])}"><span class="pk">${t("A, the reference")}</span><span class="pv">${esc(stem(names[0]))}</span></div>
      <div class="prow stack" title="${esc(names[1])}"><span class="pk">${t("B, the compared surface")}</span><span class="pv">${esc(stem(names[1]))}</span></div>
    </div>
    <div class="pgroup"><div class="pgroup-head">${t("Correlations")}</div>
      ${metric("RQd",  `RQ<sub>d</sub> <small>${t("slope magnitude")}</small>`, m.r_mag, fmt(m.rmse_mag, 4), "", true)}
      ${metric("RQ",   `RQ <small>${t("height")}</small>`,                      m.r_z,   fmt(m.rmse_z, 3), UM)}
      ${metric("RQdx", `RQ<sub>dx</sub> <small>${t("slope along")}</small>`,    m.r_gx,  fmt(m.rmse_gx, 4), "")}
      ${metric("RQdy", `RQ<sub>dy</sub> <small>${t("slope across")}</small>`,   m.r_gy,  fmt(m.rmse_gy, 4), "")}
    </div>
    <div class="pnote">${notes.join(" ")}</div>`;

  document.getElementById("tree-compare").style.display = "";
  if (batch && batch.length) {
    const B = _run && _run.batch;
    _lastBatch = { names, rows: batch, a: B ? B.a : null, items: B ? B.items : [] };
    renderBatchView();
  }
  document.getElementById("tree-batch").style.display = _lastBatch ? "" : "none";

  if (!retheme) {
    forgetCameras("grad3d_");
    const params = (_run && _run.params) || getGradientParams();
    const rows = batch && batch.length ? batch.filter((r) => !r.error).map((r) => ({ b: r.name, metrics: r.metrics })) : [{ b: names[1], metrics: m }];
    rows.forEach((r) => session.comparisons.push({ file_a: names[0], file_b: r.b, time: new Date().toISOString(),
                                                    parameters: params, metrics: r.metrics }));
    showView(batch ? "batch" : "gradA");
    const failed = batch ? batch.filter((r) => r.error).length : 0;
    if (failed) setStatus("Batch complete: {n} comparisons, {f} failed", "error", { n: batch.length - failed, f: failed });
    else if (batch) setStatus("Batch complete: {n} comparisons", "success", { n: batch.length });
    else setStatus("Comparison complete", "success");
  } else if (_view && VIEWS[_view].kind === "rq_gradient") {
    showView(_view, { keepCamera: true });
  }
}

function renderBatchView() {
  const b = _lastBatch;
  const row = (r, i) => {
    const k = r.metrics, canShow = b.items && b.items[i];
    if (r.error || !k) return `<tr><td>${i + 1}</td><td title="${esc(r.name)}">${esc(r.name)}</td>
      <td colspan="6" class="err" title="${esc(r.error || "")}">${esc(t("failed: {msg}", { msg: explainError(r.error || "", false)[0] }))}</td><td></td></tr>`;
    return `<tr><td>${i + 1}</td><td title="${esc(r.name)}">${esc(r.name)}</td>
      <td>${fmt(k.r_z, 3)}</td><td>${fmt(k.r_gx, 3)}</td><td>${fmt(k.r_gy, 3)}</td><td class="key">${fmt(k.r_mag, 3)}</td>
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
  if (html) mp.innerHTML = html + (a && !a.held ? `<div class="pnote">${esc(t("Shown as it was drawn: the engine no longer holds this analysis (it keeps the newest six). Analyse its file again to rebuild it, export it or keep its crop."))}</div>` : "");
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
      if (a.held) { rebuildAnalysis(aid, id); setStatus("Drawing the analysis…", "info"); }
      return;
    }
    if (a.stale && a.held) rebuildAnalysis(aid);
  } else if (v.type === "html" ? !_lastBatch : !_figs[v.kind]) return;
  _view = id;
  const aidSel = v.kind === "pvisual" ? _curA : null;
  document.querySelectorAll(".trow[data-view]").forEach((r) =>
    r.classList.toggle("sel", r.dataset.view === id && (r.dataset.aid || null) === aidSel));
  document.querySelectorAll("#vp-stage .vp-layer").forEach((l) => l.classList.remove("active"));
  const row = document.querySelector(aidSel ? `.trow[data-view="${id}"][data-aid="${aidSel}"]` : `.trow[data-view="${id}"]:not([data-aid])`);
  const label = row && row.querySelector(".tlabel");
  const fig = v.key && _figs[v.kind] && _figs[v.kind][v.key];
  if (fig) captionFrom(v.key, fig.layout);
  const cap = (fig && _captions[v.key]) || { title: label ? label.textContent : "", detail: "" };
  document.getElementById("vp-title").textContent = cap.title || (label ? label.textContent : "");
  document.getElementById("vp-detail").textContent = cap.detail;
  const nav = document.getElementById("navbar");
  nav.style.display = v.type === "html" ? "none" : "";
  nav.querySelector('[data-for="2d"]').style.display = v.type === "2d" || v.type === "xs" ? "" : "none";
  nav.querySelector('[data-for="3d"]').style.display = v.type === "3d" ? "" : "none";
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
  } else {
    document.getElementById("batch-view").classList.add("active");
  }
}

// the 2D figure of the view in its container, drawn again when the container shows another
// analysis or an older version of the figure
function ensurePlot(v) {
  const el = document.getElementById(FIGS[v.kind][v.key][1]);
  const fig = _figs[v.kind] && _figs[v.kind][v.key];
  if (fig && el._marqFig !== fig) renderPlot(v.kind, v.key, fig, v.kind === "pvisual" ? _curA : "cmp");
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

function plotlyConfig(kind, key) {
  return {
    displaylogo: false,
    displayModeBar: false,             // the navigation bar below the plot replaces Plotly's tool bar
    responsive: false,                 // resizing follows the panel through the ResizeObserver below
    scrollZoom: true,                  // the mouse wheel zooms
    doubleClick: "reset",
    toImageButtonOptions: { format: "png", scale: 2, filename: exportName(kind, key) },
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

let _curOwner = null;
function renderPlot(kind, key, fig, owner) {
  const el = document.getElementById(FIGS[kind][key][1]);
  if (!el || !fig) return;
  _curOwner = owner;
  Plotly.react(el, fig.data, prepareLayout(kind, key, fig.layout), plotlyConfig(kind, key));
  _curOwner = null;
  el._marqFig = fig; el._marqOwner = owner;
  if (LINKED_2D[key]) linkAxes(el);
  if (!el._marqHover) {
    el._marqHover = true;
    el.on("plotly_hover", (ev) => {
      const p = ev.points && ev.points[0];
      if (!p) return;
      const val = p.z != null ? `  ·  ${p.data.name || ""} ${fix(p.z, 3)}` : "";
      document.getElementById("sb-coords").textContent =
        `x ${fix(p.x, 1)}  y ${fix(p.y, p.z != null ? 1 : 2)}${val}`;
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
// is redrawn; the three comparison views share one camera while "Link the 3D views" is on.

const GRAD3D = /^grad3d_/;
function cameraFor(key) { return (GRAD3D.test(key) && linkCamsOn()) ? (_cams.grad || _cams[key]) : _cams[key]; }
function rememberCamera(key, cam) {
  if (!key || !cam) return;
  _cams[key] = cam;
  if (GRAD3D.test(key)) _cams.grad = cam;
}
function forgetCameras(prefix) {
  Object.keys(_cams).forEach((k) => { if (k.startsWith(prefix) || (prefix === "grad3d_" && k === "grad")) delete _cams[k]; });
  if (_viewerKey && _viewerKey.startsWith(prefix)) _viewerKey = null;   // or its camera would be saved again
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
      showNotice(null, t("The 3D view is paused: the graphics card reset it. It comes back by itself in a moment."), "warn");
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
    Plotly.newPlot(stage, fig.data, L, plotlyConfig(v.kind, v.key));
    return;
  }
  const trace = fig.data[0];
  const camKey = v.kind === "pvisual" ? `${v.key}@${_curA}` : v.key;
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
                ["Slope error", "grad3d_error", "surfacecolor", true, "slope_error"]],
};

function openSection(a, b) {
  const v = _view && VIEWS[_view];
  if (!v || v.type !== "3d" || !_figs[v.kind]) return;
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(L > 0)) return;
  const curves = SECTION_CURVES[v.kind].filter(([, key]) => _figs[v.kind][key]);
  const tr0 = _figs[v.kind][curves[0][1]].data[0], cell = Math.abs(tr0.x[1] - tr0.x[0]) || 1;
  const n = Math.max(60, Math.min(2000, Math.ceil(L / (cell / 2))));
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, X = a.x + (b.x - a.x) * f, Y = a.y + (b.y - a.y) * f;
    rows.push({ s: L * f, x: X, y: Y, v: curves.map(([, key, field]) => sampleGrid(_figs[v.kind][key].data[0], X, Y, field)) });
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
    return [{ name: "Surface A", x: d.y, y: d.zA }, { name: "Surface B", x: d.y, y: d.zB }, { name: "Slope error", x: d.y, y: d.err, y2: true }];
  const out = [{ name: "At this position", x: d.y, y: d.z }];
  const pr = withMean && _A[_curA] && _A[_curA].record && _A[_curA].record.profile;
  if (pr && pr.yc) out.push({ name: "Mean cross-section", x: pr.yc, y: pr.zb, dash: "dash", color: cssVar("--text3") });
  return out;
}

function xsCsv(kind, d) {
  return kind === "rq_gradient"
    ? { head: ["y_um", "height_A_um", "height_B_um", "slope_error"], rows: d.y.map((y, i) => [y, d.zA[i], d.zB[i], d.err[i]]) }
    : { head: ["y_um", "height_um"], rows: d.y.map((y, i) => [y, d.z[i]]) };
}

// the one-click tool of the 3D views: the cross-section through the clicked point, below the view
function openXsPanel(x0) {
  const v = _view && VIEWS[_view];
  if (!v || v.type !== "3d") return;
  const kind = v.kind, aid = kind === "pvisual" ? _curA : null;
  ask("xsection", { aid, x: x0 }, "xs").then((m) => {
    const d = JSON.parse(m.data), rng = xsRange(kind, d);
    _section = { mode: "xs", kind, key: kind === "pvisual" ? "cross_section" : "cross_sections", x: d.x, aid,
                 xTitle: "Y, across the channel (µm)", detail: () => xsDetail(d.x, rng), series: xsSeries(kind, d, false), csv: xsCsv(kind, d) };
    drawSection();
  }).catch(() => {});
}

function openXsFromPanel() {
  const S = _section;
  if (!S || S.mode !== "xs") return;
  showView(S.kind === "pvisual" ? "xsview" : "gradxs", { aid: S.aid, x: S.x });
}

// the cross-section view: a slider along the channel, the position as a fraction or in µm
let _xs = null, _xsBusy = false, _xsAgain = false;

function openXsView(v, opts = {}) {
  const kind = v.kind, aid = kind === "pvisual" ? _curA : null;
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
  ask("xsection", { aid: X.aid, x: X.x }, "xs").then((m) => {
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
              { uirev: `xs:${X.kind}:${X.aid}`, dragmode: _dragmode2d });
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

// a profile plot (the section panel and the cross-section view): heights, and the slope error
// on a second axis
function drawProfile(el, series, xTitle, opts = {}) {
  const font = { family: getComputedStyle(document.body).fontFamily, size: 11, color: cssVar("--text2") };
  const cols = [cssVar("--accent"), "#3d8bfd", cssVar("--text3")];
  const second = series.some((c) => c.y2);
  const data = series.map((sr, k) => ({
    type: "scatter", mode: "lines", name: t(sr.name), x: sr.x, y: sr.y, yaxis: sr.y2 ? "y2" : "y", connectgaps: false,
    line: { width: sr.y2 || sr.dash ? 1.1 : 1.8, color: sr.color || cols[k % 3], dash: sr.y2 ? "dot" : (sr.dash || "solid") },
    hovertemplate: `${esc(t(sr.name))} %{y:.3f}<extra></extra>` }));
  const ax = (title) => ({ title: { text: title, font }, tickfont: font, gridcolor: cssVar("--line"), zerolinecolor: cssVar("--line-2"),
                          linecolor: cssVar("--line-2"), automargin: true });
  const layout = { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font, dragmode: opts.dragmode || "pan", hovermode: "x unified",
    margin: { l: 60, r: second ? 64 : 18, t: series.length > 1 ? 26 : 8, b: 40 }, showlegend: series.length > 1,
    legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font, bgcolor: "rgba(0,0,0,0)" },
    hoverlabel: { bgcolor: cssVar("--pane"), bordercolor: cssVar("--line-2"), font: { color: cssVar("--text") } },
    xaxis: ax(t(xTitle)), yaxis: ax(t("Height (µm)")), separators: LANG === "tr" ? ",." : ".,", uirevision: opts.uirev };
  if (second) layout.yaxis2 = { ...ax(t("Slope error")), overlaying: "y", side: "right", showgrid: false };
  if (currentEqual() && !second) { layout.yaxis.scaleanchor = "x"; layout.yaxis.scaleratio = 1; }
  Plotly.react(el, data, layout, { displayModeBar: false, displaylogo: false, scrollZoom: true, responsive: false, doubleClick: "reset" });
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
  drawProfile(el, S.series, S.xTitle);
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
  let ticks = "";
  const n = 5, span = c.cmax - c.cmin;
  const dec = Math.abs(span) < 1 ? 3 : Math.abs(span) < 20 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    ticks += `<span class="cb-tick" style="top:${(100 - f * 100).toFixed(1)}%">${fix(c.cmin + f * span, dec)}</span>`;
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
    }
    return;
  }
  if (v.type !== "2d" && v.type !== "xs") return;
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
  document.getElementById("exp-size").onchange = (e) =>
    document.getElementById("exp-custom").style.display = e.target.value === "custom" ? "" : "none";
  openModal("modal-export");
}

function runExport() {
  const [kind, key] = document.getElementById("exp-figure").value.split(":");
  const format = document.getElementById("exp-format").value;
  const themeSel = document.getElementById("exp-theme").value;
  const theme = themeSel === "current" ? _theme : themeSel;
  const langSel = document.getElementById("exp-lang").value;
  const lang = langSel === "current" ? LANG : langSel;
  const size = document.getElementById("exp-size").value;
  let w = 1200, h = 700;
  if (size === "panel") {
    const el = document.getElementById("vp-stage");
    if (el && el.clientWidth > 50) { w = el.clientWidth; h = el.clientHeight; }
  } else if (size === "custom") {
    w = Math.max(300, Math.min(6000, Math.round(num("exp-w", 1400))));
    h = Math.max(200, Math.min(6000, Math.round(num("exp-h", 800))));
  } else {
    [w, h] = size.split("x").map(Number);
  }
  closeModal("modal-export");
  const aid = kind === "pvisual" ? _curA : null;
  const req = { kind, key, format: format.startsWith("png") ? "png" : "svg", scale: format === "png3" ? 3 : 2, w, h };
  saveFile(`${exportName(kind, key, aid)}.${req.format}`, req.format === "png" ? "image/png" : "image/svg+xml", async () => {
    setStatus("Preparing the figure…", "info");
    const m = await ask("export_figure", { kind, key, aid, theme, lang, quality: currentQuality(), palette: currentPalette(),
                                           equal: currentEqual(), request: req }, "fig");
    return figureBlob(JSON.parse(m.data), req);
  }).then((ok) => { if (ok) setStatus("Figure exported ({fmt}, {w}×{h})", "success", { fmt: req.format.toUpperCase(), w, h }); })
    .catch((err) => { appendLog("Figure export failed: " + err.message); setStatus("Figure export failed, see the log", "error"); });
}

// a figure drawn off screen at the requested size, as a PNG or SVG file
async function figureBlob(fig, req) {
  const stage = document.getElementById("export-stage");
  stage.style.width = req.w + "px"; stage.style.height = req.h + "px";
  try {
    await Plotly.newPlot(stage, fig.data, { ...fig.layout, width: req.w, height: req.h, autosize: false }, { staticPlot: false, displayModeBar: false });
    await new Promise((r) => setTimeout(r, 400));          // let WebGL scenes finish a frame
    const url = await Plotly.toImage(stage, { format: req.format, width: req.w, height: req.h, scale: req.format === "png" ? req.scale : 1 });
    return await (await fetch(url)).blob();
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
    lines.push("# analysed surfaces (micrometres; roughness per ISO 25178 on plane-removed residuals)");
    lines.push(["file", "time", "floor_width", "floor_width_sd_central80", "opening_width", "opening_width_sd",
                "depth", "depth_sd_central80", "wall_angle_deg", "wall_angle_left_deg", "wall_angle_right_deg",
                "wall_angle_resolved", "chord_angle_deg", "floor_corner_um", "rim_corner_um", "mid_width",
                "floor_length", "floor_length_sd", "opening_length",
                "orientation", "floor_Sa", "floor_Sq", "floor_Sz", "floor_Ssk", "floor_Sku",
                "fieldL_Sa", "fieldL_Sq", "fieldL_Sz", "fieldR_Sa", "fieldR_Sq", "fieldR_Sz",
                "voxel_size", "field_k", "crop_pad_x", "crop_pad_y", "opening_frac", "floor_width_frac",
                "floor_eval_frac", "floor_eval_length", "field_eval_width", "field_eval_length",
                "margin", "display_cell", "smooth_sigma", "n_slices", "skip_rows",
                "voxel_size_used", "rotation_deg", "tilt_xz_deg", "tilt_yz_deg", "opening_length_sd"].join(","));
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
                  a.rotation.voxel_size, a.rotation.phi, a.rotation.xz_tilt, a.rotation.yz_tilt, c.opening_length_conf].map(csvCell).join(","));
    });
    lines.push("");
  }
  if (session.comparisons.length) {
    lines.push("# comparisons (A = reference, B = compared; correlations over the channel-interior mask)");
    lines.push(["file_a", "file_b", "time", "RQ", "RQdx", "RQdy", "RQd", "RMSE_Z", "RMSE_dZdx", "RMSE_dZdy", "RMSE_gradmag",
                "B_rotated_180", "n_mask_cells", "n_valid_cells", "cell_um", "grid_spacing", "smooth_sigma", "idealised_mode"].join(","));
    session.comparisons.forEach((c) => {
      const m = c.metrics, p = c.parameters;
      lines.push([c.file_a, c.file_b, c.time, m.r_z, m.r_gx, m.r_gy, m.r_mag, m.rmse_z, m.rmse_gx, m.rmse_gy, m.rmse_mag,
                  m.z_flip ? 1 : 0, m.n_mask, m.n_valid, m.cell_um ? m.cell_um[0] : "", p.grid_spacing, p.smooth_sigma,
                  m.cad_mode ? 1 : 0].map(csvCell).join(","));
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
  if (!ready || running || _reporting || !(_have.pvisual || _have.rq_gradient || Object.values(_A).some((a) => a.held))) return;
  const slot = (k) => files[k] ? { name: files[k].name, isCrop: !!files[k].isCrop, from: files[k].from || null, aid: files[k].aid || null } : null;
  const kept = Object.values(_A).filter((a) => a.held);
  const state = { format: "marq-session", version: 2, software: `${APP.name} ${APP.version}`, saved: new Date().toISOString(),
    session, lastPairNames: _lastPairNames, lastBatch: _lastBatch ? { names: _lastBatch.names, rows: _lastBatch.rows } : null,
    analyses: kept.map((a) => ({ id: a.id, file: a.file, name: a.name, crop: { filename: a.crop.filename, available: a.crop.available },
                                 record: session.analyses.indexOf(a.record) })),
    current: _curA, aSeq: _aSeq, slots: { A: slot("A"), B: slot("B") }, view: _view, settings: collectParamValues() };
  const slots = {};
  ["A", "B"].forEach((k) => { if (files[k]) slots[k] = files[k].content; });
  saveFile(`marq_session_${stampNow()}.marq`, "application/zip", async () => {
    setStatus("Saving the session…", "info");
    const m = await ask("save_session", { state: JSON.stringify(state), want: { pvisual: kept.map((a) => a.id), rq_gradient: _have.rq_gradient }, slots }, "session");
    return new Blob([m.data], { type: "application/zip" });
  }).then((ok) => { if (ok) { markSaved(); setStatus("Session saved", "success"); } }).catch(() => {});
}

function handleSessionInput(input) {
  const f = input.files[0];
  input.value = "";
  if (f) openSessionFile(f);
}

function openSessionFile(file) {
  if (!ready || running || _reporting) {
    showNotice(null, t("Wait until the engine is ready, then open the session again."), "warn");
    return;
  }
  if (resultCount() > _savedCount && !confirm(t("The results on screen are not saved. Open the session anyway and replace them?"))) return;
  const r = new FileReader();
  r.onload = (ev) => {
    _sessionName = file.name;
    setStatus("Opening the session…", "info");
    const bytes = new Uint8Array(ev.target.result);
    ask("open_session", { bytes }, "session-open").then((m) => {
      let st = null;
      try { st = JSON.parse(m.state); } catch {}
      restoreSession(st, m.have || {}, m.slots || {});
    }).catch(() => {});
  };
  r.onerror = () => showNotice("The file could not be opened", t("{name} could not be read. If it is on a network or cloud drive, copy it to this computer first.", { name: file.name }));
  r.readAsArrayBuffer(file);
}

function restoreSession(st, have, slots) {
  if (!st || st.format !== "marq-session" || !st.session) {
    showNotice("The session could not be opened", t("This file is not a MaRQ session."));
    return;
  }
  hideNotice(); closeSection();
  session.started = st.session.started || session.started;
  session.analyses = st.session.analyses || [];
  session.comparisons = st.session.comparisons || [];
  _lastPairNames = st.lastPairNames || null;
  _lastBatch = st.lastBatch ? { ...st.lastBatch, a: null, items: [] } : null;
  // the analyses: those the file holds, in their order (a first-version file holds the last one)
  Object.keys(_A).forEach((k) => delete _A[k]);
  document.getElementById("tree-analyses").innerHTML = "";
  _curA = null; _figs.pvisual = null; _props.pvisual = null; _cropText = null; _cropAvailable = false;
  const heldIds = have.pvisual || [];
  const list = st.version >= 2 ? (st.analyses || [])
    : heldIds.length ? [{ id: "a1", file: (session.analyses.at(-1) || {}).file || "", crop: st.crop || {}, record: session.analyses.length - 1 }] : [];
  list.filter((x) => heldIds.includes(x.id)).forEach((x) => {
    const a = _A[x.id] = { id: x.id, file: x.file, name: x.name || uniqueName(stem(x.file) || "surface"), record: session.analyses[x.record] || null,
                           figs: null, props: null, held: true, stale: false, rebuilding: false,
                           crop: { filename: (x.crop || {}).filename || null, available: !!(x.crop || {}).available, text: null } };
    addAnalysisNode(a);
  });
  _aSeq = Math.max(st.aSeq || 0, ...Object.keys(_A).map((k) => parseInt(k.slice(1), 10) || 0));
  ["A", "B"].forEach((k) => {
    const m = st.slots && st.slots[k];
    if (m && slots[k]) setFile(k, m.name, slots[k], m.isCrop ? { isCrop: true, from: m.from, aid: m.aid || null } : {});
    else if (files[k]) clearFile(k);
  });
  if (st.settings) { applyParamValues(st.settings); saveParamsLocal(); }
  _have.rq_gradient = !!have.rq_gradient;
  _figs.rq_gradient = null; _props.rq_gradient = null;
  document.getElementById("tree-compare").style.display = "none";
  document.getElementById("tree-batch").style.display = _lastBatch ? "" : "none";
  if (_lastBatch) renderBatchView();
  forgetCameras("view3d"); forgetCameras("grad3d_");
  showStart();
  const cur = st.current && _A[st.current] ? st.current : Object.keys(_A).at(-1);
  if (cur) selectAnalysis(cur);
  // the analysis on screen and the comparison are drawn now, the others when they are opened
  const n = (cur ? 1 : 0) + (_have.rq_gradient ? 1 : 0);
  _restoring = n ? { n, view: st.view } : null;
  if (cur) { _serial.pvisual++; rebuildAnalysis(cur); }
  if (_have.rq_gradient) { _serial.rq_gradient++; worker.postMessage({ type: "retheme", id: "rt-rq_gradient", data: { kind: "rq_gradient", ...viewOpts() } }); }
  markSaved();
  updateButtons();
  setStatus("Session opened: {name}", "success", { name: _sessionName });
}

// ── Report ─────────────────────────────────────────────────────────────────────
// One printable page per result: the numbers as in the properties panel, the settings, and the
// main figures rebuilt in the light theme. Shown in a dialog, printed (or saved as PDF) from
// there, or saved as one HTML file.

const REPORT_FIGS = {
  pvisual: [["channel", 1150, 560], ["profiles_xsection", 1150, 560], ["profiles_widthlength", 1150, 560], ["roughness", 1150, 560]],
  rq_gradient: [["gradmaps", 1150, 1000]],
};
const PARAM_KEYS = { "p-voxel": "voxel_size", "p-fieldk": "field_k", "p-cropx": "crop_pad_x", "p-cropy": "crop_pad_y",
  "p-ofrac": "opening_frac", "p-flfrac": "floor_width_frac", "p-rfloor": "floor_eval_frac", "p-rfloorlen": "floor_eval_length",
  "p-rfwidth": "field_eval_width", "p-rflen": "field_eval_length", "p-margin": "margin", "p-cell": "display_cell",
  "p-sigma": "smooth_sigma", "p-slices": "n_slices", "p-skiprows": "skip_rows",
  "g-spacing": "grid_spacing", "g-sigma": "smooth_sigma", "g-skiprows": "skip_rows" };

function figureImage(kind, key, w, h, aid) {
  return ask("export_figure", { kind, key, aid: aid || null, theme: "light", lang: LANG, quality: currentQuality(),
    palette: currentPalette(), equal: currentEqual() }, "repfig").then(async (m) => {
    const fig = JSON.parse(m.data), stage = document.getElementById("export-stage");
    stage.style.width = w + "px"; stage.style.height = h + "px";
    try {
      await Plotly.newPlot(stage, fig.data, { ...fig.layout, width: w, height: h, autosize: false }, { staticPlot: true, displayModeBar: false });
      return await Plotly.toImage(stage, { format: "png", width: w, height: h, scale: 2 });
    } finally { Plotly.purge(stage); }
  });
}


async function makeReport() {
  if (!ready || running || _reporting) return;
  const items = Object.values(_A).filter((a) => a.props).map((a) => ["pvisual", a.id]);
  if (_have.rq_gradient && _props.rq_gradient) items.push(["rq_gradient", null]);
  if (!items.length) return;
  _reporting = true; updateButtons();
  document.getElementById("spinner").style.display = "inline-block";
  setStatus("Preparing the report…", "info");
  try {
    let logo = "";
    try { logo = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(await (await fetch("logo.svg")).text()))); } catch {}
    const pages = [];
    for (const [kind, aid] of items) {
      const imgs = [], held = kind === "pvisual" ? _A[aid].held : _have.rq_gradient;
      if (held) for (const [key, w, h] of REPORT_FIGS[kind]) imgs.push(await figureImage(kind, key, w, h, aid));
      pages.push(reportPage(kind, imgs, logo, aid));
    }
    _reportHtml = reportDocument(pages);
    document.getElementById("report-frame").srcdoc = _reportHtml;
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
  const A = kind === "pvisual" ? _A[aid] : null;
  const rec = A ? A.record : session.comparisons.at(-1);
  const subject = kind === "pvisual" ? esc(rec ? rec.file : "")
    : `A: ${esc((_lastPairNames || [""])[0])}<br>B: ${esc((_lastPairNames || ["", ""])[1])}`;
  const params = (rec && rec.parameters) || {};
  const rows = PARAM_IDS.filter((id) => id.startsWith(kind === "pvisual" ? "p-" : "g-")).map((id) => {
    const lab = document.getElementById(id).closest(".param-card").querySelector(".param-label").textContent;
    const val = params[PARAM_KEYS[id]], changed = val != null && parseFloat(val) !== parseFloat(_paramDefaults[id]);
    return `<tr${changed ? ' class="chg"' : ""}><td>${esc(lab)}</td><td>${val == null ? "–" : esc(decimal(String(val)))}</td></tr>`;
  }).join("");
  let batch = "";
  if (kind === "rq_gradient" && _lastBatch) {
    const r = _lastBatch.rows.map((x, i) => x.error || !x.metrics
      ? `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td colspan="4">${esc(t("failed"))}</td></tr>`
      : `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${fmt(x.metrics.r_z, 3)}</td><td>${fmt(x.metrics.r_gx, 3)}</td><td>${fmt(x.metrics.r_gy, 3)}</td><td class="key">${fmt(x.metrics.r_mag, 3)}</td></tr>`).join("");
    batch = `<h2>${esc(t("Batch results"))}</h2><table class="batch"><tr><th>#</th><th>${esc(t("Surface B"))}</th><th>RQ</th><th>RQ<sub>dx</sub></th><th>RQ<sub>dy</sub></th><th>RQ<sub>d</sub></th></tr>${r}</table>`;
  }
  return `<section class="page ${kind}">
  <header>${logo ? `<img src="${logo}" alt="">` : ""}<div><h1>${esc(t(kind === "pvisual" ? "Surface analysis" : "Comparison"))}</h1><div class="subj">${subject}</div></div>
    <div class="when">MaRQ ${APP.version}<br>${esc(date)}</div></header>
  <div class="grid"><div class="props">${A ? A.props : _props[kind]}</div>
    <div class="settings"><h2>${esc(t("Settings"))}</h2><table>${rows}</table><p class="note">${esc(t("Values that differ from the paper defaults are in bold."))}</p></div></div>
  ${batch}
  <div class="figs">${imgs.map((src) => `<img src="${src}" alt="">`).join("")}</div>
  <footer>${esc(APP.name)}, ${esc(t(APP.full))}, ${esc(t("version"))} ${APP.version} · ${esc(APP.repo.replace(/^https?:\/\//, ""))}</footer>
</section>`;
}

function reportDocument(pages) {
  const font = cssVar("--sans"), mono = cssVar("--mono");
  return `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t("MaRQ report"))}</title>
<style>
@page { size: A4; margin: 11mm; }
* { box-sizing: border-box; }
html { background: #e7e7ea; }
body { margin: 0; font-family: ${font}; color: #1f1f22; font-size: 8.6pt; line-height: 1.35; }
.bar { position: sticky; top: 0; display: flex; justify-content: flex-end; padding: 8px 12px; background: #f3f3f4; border-bottom: 1px solid #e1e1e4; }
.bar button { font: inherit; font-size: 10pt; padding: 5px 14px; border-radius: 4px; border: 1px solid #d32f2f; background: #d32f2f; color: #fff; cursor: pointer; }
.embedded .bar { display: none; }
.page { width: 188mm; min-height: 270mm; margin: 8mm auto; padding: 9mm 10mm; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
header { display: flex; align-items: center; gap: 4mm; border-bottom: 2px solid #d32f2f; padding-bottom: 3mm; margin-bottom: 4mm; }
header img { width: 11mm; height: 11mm; }
h1 { font-size: 15pt; margin: 0 0 1mm; font-weight: 650; }
h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #8a8a92; margin: 3mm 0 1.5mm; }
.subj { color: #55555c; font-size: 8.6pt; word-break: break-all; }
.when { margin-left: auto; text-align: right; color: #8a8a92; font-size: 7.6pt; white-space: nowrap; }
.grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 7mm; align-items: start; }
.pgroup { margin-bottom: 2.5mm; }
.pgroup-head { font-size: 7.4pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #8a8a92; padding: 1mm 0; }
.prow { display: grid; grid-template-columns: 1fr auto; gap: 3mm; padding: .5mm 0 .5mm 2mm; border-left: 2px solid transparent; align-items: baseline; }
.prow.key { border-left-color: #d32f2f; }
.pk { color: #55555c; } .pk small { color: #8a8a92; font-size: 7pt; }
.pv { font-family: ${mono}; color: #1f1f22; text-align: right; white-space: nowrap; }
.prow.big .pv { font-weight: 600; font-size: 9.6pt; } .prow.key .pv { color: #d32f2f; }
.pv .pm, .sub { color: #8a8a92; font-size: 7.4pt; } .sub { grid-column: 1 / -1; text-align: right; font-family: ${mono}; }
.prow.stack { grid-template-columns: 1fr; } .prow.stack .pv { text-align: left; font-family: ${font}; white-space: normal; word-break: break-all; }
.ptable, .settings table, table.batch { width: 100%; border-collapse: collapse; }
.ptable th, table.batch th { font-weight: 600; color: #8a8a92; text-align: right; border-bottom: 1px solid #e1e1e4; padding: .4mm 1mm; font-size: 7.4pt; }
.ptable td, table.batch td { font-family: ${mono}; text-align: right; padding: .4mm 1mm; }
.ptable th:first-child, .ptable td:first-child, table.batch td:nth-child(2), table.batch th:nth-child(2) { text-align: left; font-family: ${font}; color: #55555c; }
table.batch td.key { color: #d32f2f; font-weight: 600; }
.pnote, .note { color: #8a8a92; font-size: 7.4pt; margin: 1mm 0 0; }
.settings td { padding: .35mm 0; border-bottom: 1px solid #f0f0f2; vertical-align: top; }
.settings td:last-child { font-family: ${mono}; text-align: right; padding-left: 3mm; white-space: nowrap; }
.settings tr.chg td { font-weight: 700; color: #1f1f22; }
.figs { display: grid; gap: 3mm; margin-top: 4mm; }
.page.pvisual .figs { grid-template-columns: 1fr 1fr; }
.figs img { width: 100%; display: block; border: 1px solid #ececee; }
.page.rq_gradient .figs img { max-height: 150mm; object-fit: contain; }
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
  btn.addEventListener("click", (e) => { e.stopPropagation(); menu.style.display === "flex" ? closeFileMenu() : openFileMenu(); });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".tb-menu")) closeFileMenu(); });
  menu.addEventListener("keydown", (e) => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); (it[i + 1] || it[0]).focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (it[i - 1] || it[it.length - 1]).focus(); }
    else if (e.key === "Escape") { e.stopPropagation(); closeFileMenu(); btn.focus(); }
  });
  menu.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { closeFileMenu(); fileCommand(b.dataset.cmd); }));
}
function openFileMenu() {
  const idle = ready && !running && !_reporting, any = _have.pvisual || _have.rq_gradient, data = resultCount() > 0;
  const on = { "open-cloud": true, "open-session": idle, "save-session": idle && any, report: idle && any, figure: idle && any, json: data, csv: data };
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
function fileCommand(cmd) {
  const f = { "open-cloud": () => document.getElementById("file1-input").click(), "open-session": () => document.getElementById("session-input").click(),
              "save-session": saveSession, report: makeReport, figure: () => openExportDialog(), json: exportJSON, csv: exportCSV }[cmd];
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
let _savedCount = 0;
function resultCount() { return session.analyses.length + session.comparisons.length; }
function markSaved() { _savedCount = resultCount(); }

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
  if (el.style.display !== "flex") _modalReturn = document.activeElement;
  el.style.display = "flex";
  const box = el.querySelector(".modal-box");
  box.setAttribute("tabindex", "-1");
  if (!box.contains(document.activeElement)) box.focus({ preventScroll: true });
}
let _modalReturn = null;
function closeModal(id) {
  document.getElementById(id).style.display = "none";
  if (_modalReturn && document.contains(_modalReturn)) _modalReturn.focus({ preventScroll: true });
  _modalReturn = null;
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

// The message is English (a key of i18n.js), shown in the interface language; the last one is
// kept, so it can be shown again after a language switch.
let _lastStatus = null;
function setStatus(msg, level, vars) {
  _lastStatus = [msg, level, vars];
  const el = document.getElementById("status-bar");
  const pre = running && _batchRunning && _batchPos && msg !== "Batch {i} of {n}: {name}" ? t("Batch {i} of {n}", _batchPos) + " · " : "";
  el.textContent = pre + t(msg, vars); el.className = "status-bar status-" + level;
}
function setRunning(isRunning, kind) {
  running = isRunning; _pendingKind = isRunning ? kind : null;
  if (isRunning) { hideNotice(); _autoSkipped = 0; } else { _batchRunning = false; _batchPos = null; }
  document.getElementById("spinner").style.display = isRunning ? "inline-block" : "none";
  updateButtons();
}
function appendLog(line) {
  const el = document.getElementById("log-box");
  el.value += line + "\n"; el.scrollTop = el.scrollHeight;
}
function clearLog() { document.getElementById("log-box").value = ""; }

// Progress text from the live log
function statusFromLog(raw) {
  if (!running) return;
  const line = String(raw).trim();          // the engine starts most step lines with a new line
  let m = line.match(/^STEP (\d+)\s+\S\s+(.+)$/);
  if (m) { setStatus("Step {n} of 9: {text}", "info", { n: m[1], text: t(m[2].trim()) }); return; }
  if (/^Loading clouds/.test(line))      setStatus("Comparison: loading the two surfaces…", "info");
  else if (/^Gridding points/.test(line)) setStatus("Comparison: gridding…", "info");
  else if (/^Computing gradients/.test(line)) setStatus("Comparison: slopes and correlations…", "info");
  else if (/Orientation check/.test(line)) setStatus("Comparison: building the figures…", "info");
  else if (/^Total time/.test(line))     setStatus("Building the figures…", "info");
}

function toggleLog(show) {
  const app = document.getElementById("app");
  const on = show === undefined ? !app.classList.contains("show-log") : !!show;
  app.classList.toggle("show-log", on);
  document.getElementById("toggle-log").classList.toggle("on", on);
}

// Draggable dividers between the panes; their positions are remembered.
function setupSplitters() {
  const root = document.documentElement, left = document.getElementById("leftpane");
  const browser = document.getElementById("browser-pane");
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS.layout) || "{}"); } catch {}
  // a width saved on a large screen is kept below 40 % of a smaller one
  if (saved.left) root.style.setProperty("--left", Math.min(saved.left, Math.max(220, innerWidth * 0.4)) + "px");
  if (saved.browser) browser.style.height = saved.browser + "%";
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
    root.style.setProperty("--left", w + "px"); saved.left = Math.round(w);
  });
  drag(document.getElementById("split-props"), (ev) => {
    const r = left.getBoundingClientRect();
    const pct = Math.max(18, Math.min(78, (ev.clientY - r.top) / r.height * 100));
    browser.style.height = pct + "%"; saved.browser = Math.round(pct);
  });
}

function setupTree() {
  const tree = document.getElementById("tree");
  tree.querySelectorAll(".trow").forEach((r) => { r.tabIndex = 0; });
  tree.addEventListener("keydown", (e) => {
    const row = e.target.closest(".trow");
    if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); row.click(); }
  });
  tree.addEventListener("click", (e) => {
    const row = e.target.closest(".trow");
    if (!row || e.target.closest(".tx:not(.aremove)")) return;
    if (e.target.closest(".aremove")) { removeAnalysis(row.dataset.aid); return; }
    if (row.dataset.view) { showView(row.dataset.view, { aid: row.dataset.aid }); return; }
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
  });
}

// ── Theme, palette & 3D detail ─────────────────────────────────────────────────

function currentQuality() {
  const v = parseInt(document.getElementById("quality-select").value, 10);
  return isNaN(v) ? 80000 : v;
}
function currentPalette() { return document.getElementById("palette-select").value || "Viridis"; }
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
  Object.values(_A).forEach((a) => { a.stale = true; });
  if (_A[_curA] && _A[_curA].held) rebuildAnalysis(_curA);
  if (_have.rq_gradient) worker.postMessage({ type: "retheme", id: "rt-rq_gradient", data: { kind: "rq_gradient", ...viewOpts() } });
}

function cubeLabels() {
  return ["Right", "Left", "Top", "Bottom", "Front", "Back"].map((w) => t(w).toLocaleUpperCase(LANG === "tr" ? "tr-TR" : "en-GB"));
}

// Switch the interface language: the page at once, then the figures and the properties of every
// result the engine holds (rebuilt in the new language, no new analysis).
function setLanguage(lang, rebuild = true) {
  applyLanguage(lang);
  try { localStorage.setItem(LS.lang, LANG); } catch {}
  document.getElementById("lang-select").value = LANG;
  document.querySelectorAll(".file-name").forEach((el) => { if (!el.classList.contains("has-file")) el.textContent = t(el.dataset.placeholder || ""); });
  ["1", "A", "B"].forEach((slot) => { const f = files[slot]; if (f && f.isCrop) document.getElementById("file" + slot + "-name").textContent = t("crop of {name}", { name: f.from }); });
  updateBatchCount();
  markChangedParams();
  document.querySelectorAll('input[type="range"]').forEach(rangeLabel);
  if (_lastBatch) renderBatchView();
  applyPageTheme(_theme);
  if (_section) drawSection();
  if (_xs && _view && VIEWS[_view].type === "xs") drawXs();
  toolHint(document.getElementById("tool-hint").dataset.msg || null);
  if (_lastStatus) setStatus(..._lastStatus);
  document.getElementById("status-bar").title = t("Click to show the analysis log");
  document.getElementById("log-box").placeholder = t("The log of the analysis appears here.");
  document.getElementById("sb-runtime").textContent = t(_runtime.pyodide === "…" ? "Starting…" :
    _runtime.pyodide === "local" ? "Offline bundle" : "Runtime from the internet");
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
  // the language: the one chosen last time, otherwise the language of the browser
  let lang = null;
  try { lang = localStorage.getItem(LS.lang); } catch {}
  if (!LANGS[lang]) lang = /^tr\b/i.test(navigator.language || "") ? "tr" : "en";
  setLanguage(lang, false);
  setStatus("Loading the Python runtime…", "info");
  document.getElementById("lang-select").addEventListener("change", (e) => setLanguage(e.target.value));
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
  window.addEventListener("beforeunload", (e) => { if (resultCount() > _savedCount) { e.preventDefault(); e.returnValue = "unsaved"; } });
  setupFileMenu();
  setupDropZone("file1-zone", "1");
  setupDropZone("fileA-zone", "A");
  setupDropZone("fileB-zone", "B");
  setupDropZone("batch-zone", "batch");
  setupWindowDrop();
  setupParams();
  setupTree();
  setupSplitters();
  updateButtons();

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
  bindCheck("link-cameras", LS.linkCams, () => { delete _cams.grad; });

  document.getElementById("toggle-log").addEventListener("click", () => toggleLog());
  document.getElementById("status-bar").addEventListener("click", () => toggleLog());
  document.getElementById("settings-open").addEventListener("click", () => openModal("modal-settings"));
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
      document.querySelectorAll(".modal").forEach((m) => { if (m.style.display === "flex") closeModal(m.id); });
      toggleLog(false); closeFileMenu();
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
