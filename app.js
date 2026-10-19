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
    gradmaps:      ["Height and slope maps",  "plot-gradmaps"],
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
  gradA:       { kind: "rq_gradient", key: "grad3d_cloud1", type: "3d", value: "Height" },
  gradB:       { kind: "rq_gradient", key: "grad3d_cloud2", type: "3d", value: "Height" },
  gradE:       { kind: "rq_gradient", key: "grad3d_error", type: "3d", value: "Slope error" },
  gradmaps:    { kind: "rq_gradient", key: "gradmaps", type: "2d" },
  batch:       { kind: "rq_gradient", key: null, type: "html" },
};
const VIEW_OF_KEY = Object.fromEntries(Object.entries(VIEWS).filter(([, v]) => v.key).map(([id, v]) => [v.key, id]));

const PARAM_IDS = ["p-voxel", "p-fieldk", "p-cropx", "p-cropy", "p-ofrac", "p-flfrac", "p-rfloor",
                   "p-rfloorlen", "p-rfwidth", "p-rflen", "p-margin", "p-cell", "p-sigma", "p-slices",
                   "p-skiprows", "g-spacing", "g-sigma", "g-skiprows"];
const LS = { params: "marq.params.v1", theme: "marq.theme", layout: "marq.layout2", equal: "marq.equal",
             linkMaps: "marq.linkMaps", linkCams: "marq.linkCameras", lang: "marq.lang" };
// Figures whose panels share one coordinate system: zoom and pan move all panels together.
const LINKED_2D = { gradmaps: true };

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
const session = { started: new Date().toISOString(), analyses: [], comparisons: [] };
let _exportRequest = null;
let _view = null;               // id of the view on screen
const _props = { pvisual: null, rq_gradient: null };    // properties panel html per result kind
const _captions = {};           // figure key -> {title, detail}
const _cams = {};               // 3D camera per figure key, and "grad" for the linked comparison views
let _viewer = null, _viewerFailed = false, _viewerKey = null;
let _dragmode2d = "pan";

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
function showStartupBanner(msg) {
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
}
const ENGINE_HELP = "The analysis engine could not be loaded. If MaRQ comes from the downloaded " +
  "package, check that the folder software/vendor is complete (extract the whole zip again if " +
  "unsure); without it MaRQ needs an internet connection. A current Chrome, Edge, Firefox or " +
  "Safari is needed, and the computer needs about 1 GB of free memory.";

// ── Worker bootstrap ───────────────────────────────────────────────────────────

function startWorker() {
  worker = new Worker("worker.js");

  worker.onmessage = (e) => {
    const { type, kind, data, message } = e.data;
    switch (type) {
      case "status": setStatus(message, "info"); break;
      case "log":    appendLog(e.data.line); statusFromLog(e.data.line); break;
      case "runtime":
        _runtime.pyodide = e.data.pyodide;
        _runtime.plotly  = (window.__marqRuntime || {}).plotly || "cdn";
        document.getElementById("sb-runtime").textContent =
          t(_runtime.pyodide === "local" ? "Offline bundle" : "Runtime from the internet");
        break;
      case "ready":
        ready = true;
        setStatus(_runtime.pyodide === "local" ? "Ready (offline bundle)" : "Ready", "success");
        updateButtons();
        break;
      case "result":
        onResult(kind, data, e.data);
        if (!e.data.retheme) setRunning(false);
        if (_rethemeQueued && !running) { _rethemeQueued = false; retheme(); }
        break;
      case "batch_progress":
        setStatus("Batch {i} of {n}: {name}", "info", { i: e.data.index + 1, n: e.data.total, name: e.data.name });
        break;
      case "batch_row":
        _batchRows.push({ name: e.data.name, metrics: e.data.metrics });
        break;
      case "crop":
        onCropText(data, e.data.purpose, e.data.slot);
        break;
      case "figure":
        onExportFigure(JSON.parse(data), e.data.request);
        break;
      case "error":
        if (e.data.log && e.data.log.length) e.data.log.forEach(appendLog);
        appendLog("ERROR: " + message);
        if (!ready) showStartupBanner(t(ENGINE_HELP) + " (" + message + ")");
        setStatus("Error, see the log", "error");
        setRunning(false);
        toggleLog(true);
        break;
    }
  };

  worker.onerror = (e) => {
    appendLog("Worker error: " + e.message);
    if (!ready) showStartupBanner(t(ENGINE_HELP) + (e.message ? " (" + e.message + ")" : ""));
    setStatus("Worker error", "error");
    setRunning(false);
  };
}

function cancelRun() {
  if (!worker) return;
  worker.terminate();
  ready = false; running = false;
  _lastKind = null;                    // the cached Python results are gone with the worker
  _have.pvisual = _have.rq_gradient = false;
  setRunning(false);
  appendLog("\n[cancelled by the user; the analysis engine is restarting]");
  setStatus("Cancelled, restarting the engine…", "info");
  startWorker();
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
  updateButtons();
}

function readFile(file, slot) {
  const reader = new FileReader();
  reader.onload = (ev) => setFile(slot, file.name, new Uint8Array(ev.target.result));
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
  updateButtons();
}

function handleBatchInput(fileList) {
  const el = document.getElementById("batch-input");
  const list = Array.from(fileList || el.files);
  batchFiles = [];
  let pending = list.length;
  if (!pending) { updateBatchCount(); updateButtons(); return; }
  list.forEach((f) => {
    const r = new FileReader();
    r.onload = (ev) => {
      batchFiles.push({ name: f.name, content: new Uint8Array(ev.target.result) });
      if (--pending === 0) {
        batchFiles.sort((a, b) => a.name.localeCompare(b.name));
        updateBatchCount();
        updateButtons();
      }
    };
    r.readAsArrayBuffer(f);
  });
  el.value = "";
}

function updateBatchCount() {
  const n = batchFiles.length;
  document.getElementById("batch-count").textContent =
    n === 0 ? t("Batch files…") : n === 1 ? t("1 file chosen") : t("{n} files chosen", { n });
}

function updateButtons() {
  const idle = ready && !running;
  document.getElementById("run-pvisual").disabled  = !(idle && files["1"]);
  document.getElementById("run-gradient").disabled = !(idle && files["A"] && files["B"]);
  document.getElementById("batch-run").disabled    = !(idle && files["A"] && batchFiles.length);
  const crop = idle && _cropAvailable;
  ["download-crop", "use-crop-a", "use-crop-b"].forEach((id) => document.getElementById(id).disabled = !crop);
  document.getElementById("export-figure").disabled = !(idle && (_have.pvisual || _have.rq_gradient));
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
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove("drag-over");
    document.getElementById("app").classList.remove("dropping");
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
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) readFile(f, "1");
  });
}

// ── Crop export and hand-over ──────────────────────────────────────────────────
// The point list stays in the worker; the text is requested once and cached until
// the next single-surface run.

function requestCrop(purpose, slot) {
  if (!_cropAvailable || !ready) return;
  if (_cropText) { onCropText(_cropText, purpose, slot); return; }
  setStatus("Preparing the cropped channel…", "info");
  worker.postMessage({ type: "export_crop", id: "crop", data: { purpose, slot } });
}

function onCropText(text, purpose, slot) {
  _cropText = text;
  if (purpose === "slot") {
    setFile(slot, _cropFilename, new TextEncoder().encode(text), { isCrop: true, from: _cropSource });
    setStatus("Crop placed as Surface {slot}", "success", { slot });
  } else {
    downloadText(_cropFilename, text, "text/plain");
    setStatus("Cropped channel saved", "success");
  }
  updateButtons();
}

function downloadCrop() { requestCrop("download"); }
function useCrop(slot)  { requestCrop("slot", slot); }

function resetCrop() {
  _cropText = null; _cropAvailable = false; _cropSource = null;
  updateButtons();
}

// ── Run handlers ───────────────────────────────────────────────────────────────

function viewOpts() {
  return { theme: _theme, quality: currentQuality(), palette: currentPalette(), equal: currentEqual(), lang: LANG };
}

function runPvisual() {
  const f = files["1"];
  if (!f || !ready || running) return;
  setRunning(true, "pvisual"); clearLog(); resetCrop();
  setStatus("Analysing the surface…", "info");
  worker.postMessage({ type: "run_pvisual", id: "pv1",
    data: { fileContent: f.content, fileName: f.name, params: getPvisualParams(), ...viewOpts() } });
}

function runGradient() {
  const a = files["A"], b = files["B"];
  if (!a || !b || !ready || running) return;
  setRunning(true, "rq_gradient"); clearLog();
  _batchRows = []; _lastPairNames = [a.name, b.name];
  setStatus("Comparing the two surfaces…", "info");
  worker.postMessage({ type: "run_rq_gradient", id: "rq1",
    data: { file1Content: a.content, fileName1: a.name, file2Content: b.content, fileName2: b.name,
            params: getGradientParams(), ...viewOpts() } });
}

function runBatch() {
  const a = files["A"];
  if (!a || !batchFiles.length || !ready || running) return;
  setRunning(true, "rq_gradient"); clearLog();
  _batchRows = []; _lastPairNames = [a.name, batchFiles[batchFiles.length - 1].name];
  setStatus("Batch: {n} comparisons…", "info", { n: batchFiles.length });
  worker.postMessage({ type: "run_batch", id: "batch",
    data: { file1Content: a.content, fileName1: a.name,
            items: batchFiles.map((f) => ({ name: f.name, content: f.content })),
            params: getGradientParams(), ...viewOpts() } });
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

function markChangedParams() {
  let n = 0;
  PARAM_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const changed = parseFloat(el.value) !== parseFloat(_paramDefaults[id]);
    el.closest(".param-card").classList.toggle("changed", changed);
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
  downloadText("marq_parameters.json", JSON.stringify(o, null, 2), "application/json");
}

function loadParamsFile(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    try {
      const o = JSON.parse(ev.target.result);
      applyParamValues(o.controls || o);
      saveParamsLocal();
      setStatus("Settings loaded", "success");
    } catch (err) { setStatus("Settings file not understood", "error"); }
  };
  r.readAsText(f);
  input.value = "";
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
  _lastKind = kind; _have[kind] = true;
  if (kind === "pvisual")          renderPvisual(result, !!msg.retheme);
  else if (kind === "rq_gradient") renderGradient(result, !!msg.retheme, msg.batch || null);
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

function renderPvisual(result, retheme) {
  const figs = result.figures;
  _figs.pvisual = figs;
  Object.keys(FIGS.pvisual).forEach((key) => { if (key !== "view3d" && figs[key]) renderPlot("pvisual", key, figs[key]); });
  if (figs.view3d) captionFrom("view3d", figs.view3d.layout);

  const fname = files["1"] ? files["1"].name : (session.analyses.length ? session.analyses.at(-1).file : "");
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

  _props.pvisual = `
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

  document.getElementById("tree-surface").style.display = "";
  document.getElementById("tree-surface-name").textContent = stem(fname);
  document.getElementById("tree-surface-name").title = fname;

  if (!retheme) {
    forgetCameras("view3d");
    _file1Analysed = true;
    if (result.crop_points > 0) {
      _cropFilename  = `${stem(fname || "cloud")}_Crop_Voxel${Math.round(rot.voxel_size)}.txt`;
      _cropAvailable = true; _cropSource = fname; _cropText = null;
    }
    session.analyses.push({
      file: fname, time: new Date().toISOString(), parameters: getPvisualParams(),
      channel: ch, rotation: rot, roughness: rgh, display_cells: result.display_cells,
      profile: result.profile, slices: result.slices,
    });
    showView("channel");
    setStatus("Surface analysis complete", "success");
  } else if (_view && VIEWS[_view].kind === "pvisual") {
    showView(_view, { keepCamera: true });
  }
}

function renderGradient(result, retheme, batch) {
  const figs = result.figures;
  _figs.rq_gradient = figs;
  renderPlot("rq_gradient", "gradmaps", figs.gradmaps);
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
  if (batch && batch.length) { _lastBatch = { names, rows: batch }; renderBatchView(); }
  document.getElementById("tree-batch").style.display = _lastBatch && !retheme && !batch ? "" : (batch ? "" : document.getElementById("tree-batch").style.display);

  if (!retheme) {
    forgetCameras("grad3d_");
    const params = getGradientParams();
    const rows = batch && batch.length ? batch.map((r) => ({ b: r.name, metrics: r.metrics })) : [{ b: names[1], metrics: m }];
    rows.forEach((r) => session.comparisons.push({ file_a: names[0], file_b: r.b, time: new Date().toISOString(),
                                                    parameters: params, metrics: r.metrics }));
    showView(batch ? "batch" : "gradA");
    if (batch) setStatus("Batch complete: {n} comparisons", "success", { n: batch.length });
    else setStatus("Comparison complete", "success");
  } else if (_view && VIEWS[_view].kind === "rq_gradient") {
    showView(_view, { keepCamera: true });
  }
}

function renderBatchView() {
  const b = _lastBatch;
  const row = (r, i) => {
    const k = r.metrics;
    return `<tr><td>${i + 1}</td><td title="${esc(r.name)}">${esc(r.name)}</td>
      <td>${fmt(k.r_z, 3)}</td><td>${fmt(k.r_gx, 3)}</td><td>${fmt(k.r_gy, 3)}</td><td class="key">${fmt(k.r_mag, 3)}</td>
      <td>${t(k.z_flip ? "rotated" : "as it is")}</td><td>${k.n_mask != null ? intl(k.n_mask) : "–"}</td>
      <td><button class="btn btn-mini" onclick="showBatchPair(${i})" title="${t("Run this pair alone to see its figures")}">${t("Show")}</button></td></tr>`;
  };
  document.getElementById("batch-view").innerHTML = `
    <div class="batch-title">${t("Surface A, {name}, against {n} surfaces", { name: esc(b.names[0]), n: b.rows.length })}</div>
    <table class="batch-table">
      <thead><tr><th>#</th><th>${t("Surface B")}</th><th>RQ</th><th>RQ<sub>dx</sub></th><th>RQ<sub>dy</sub></th><th>RQ<sub>d</sub></th><th>${t("B orientation")}</th><th>${t("Cells")}</th><th></th></tr></thead>
      <tbody>${b.rows.map(row).join("")}</tbody>
    </table>
    <div class="pnote" style="padding-left:0">${t("The 3D views and maps show the last pair. Show runs one pair alone.")}</div>`;
}

function showBatchPair(i) {
  const f = batchFiles[i];
  if (!f) return;
  setFile("B", f.name, f.content);
  runGradient();
}

function showProps(kind) {
  const empty = document.getElementById("results-empty"), mp = document.getElementById("metrics-panel");
  const html = kind && _props[kind];
  empty.style.display = html ? "none" : "";
  mp.style.display = html ? "" : "none";
  if (html) mp.innerHTML = html;
  const sub = document.getElementById("props-sub");
  if (kind === "pvisual" && session.analyses.length) sub.textContent = stem(session.analyses.at(-1).file);
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
  if (!v || !_figs[v.kind] && v.type !== "html") return;
  _view = id;
  document.querySelectorAll(".trow[data-view]").forEach((r) => r.classList.toggle("sel", r.dataset.view === id));
  document.querySelectorAll("#vp-stage .vp-layer").forEach((l) => l.classList.remove("active"));
  const label = document.querySelector(`.trow[data-view="${id}"] .tlabel`);
  const cap = (v.key && _captions[v.key]) || { title: label ? label.textContent : "", detail: "" };
  document.getElementById("vp-title").textContent = cap.title || (label ? label.textContent : "");
  document.getElementById("vp-detail").textContent = cap.detail;
  const nav = document.getElementById("navbar");
  nav.style.display = v.type === "html" ? "none" : "";
  nav.querySelector('[data-for="2d"]').style.display = v.type === "2d" ? "" : "none";
  nav.querySelector('[data-for="3d"]').style.display = v.type === "3d" ? "" : "none";
  document.getElementById("sb-coords").textContent = "";
  showProps(v.kind);
  updateDocTitle(v.kind);

  if (v.type === "2d") {
    const el = document.getElementById(FIGS[v.kind][v.key][1]);
    el.classList.add("active");
    requestAnimationFrame(() => { if (el._fullLayout) Plotly.Plots.resize(el); });
  } else if (v.type === "3d") {
    document.getElementById("viewer3d").classList.add("active");
    render3d(v, opts);
  } else {
    document.getElementById("batch-view").classList.add("active");
  }
}

function updateDocTitle(kind) {
  const el = document.getElementById("doc-title");
  if (kind === "pvisual" && session.analyses.length) el.textContent = session.analyses.at(-1).file;
  else if (kind === "rq_gradient" && _lastPairNames) el.textContent = `${stem(_lastPairNames[0])}  vs  ${stem(_lastPairNames[1])}`;
  else el.textContent = t(APP.full);
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
  L.hoverlabel = { ...(L.hoverlabel || {}), bgcolor: cssVar("--pane"), bordercolor: cssVar("--line-2"),
                   font: { ...((L.hoverlabel || {}).font || {}), color: cssVar("--text") } };
  if (LINKED_2D[key] && !linkMapsOn()) {          // unlinked: every panel zooms on its own
    Object.keys(L).forEach((k) => { if (/^[xy]axis\d*$/.test(k) && L[k].matches) { L[k] = { ...L[k] }; delete L[k].matches; } });
  }
  return L;
}

function renderPlot(kind, key, fig) {
  const el = document.getElementById(FIGS[kind][key][1]);
  if (!el || !fig) return;
  Plotly.react(el, fig.data, prepareLayout(kind, key, fig.layout), plotlyConfig(kind, key));
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
// All six maps show the same common grid, so a zoom or pan in one is copied to every other
// panel. Done here rather than with Plotly's "matches", which cannot be combined with the
// 1:1 axis lock.

function linkMapsOn() { const el = document.getElementById("link-maps"); return el ? el.checked : true; }
function linkCamsOn() { const el = document.getElementById("link-cameras"); return el ? el.checked : true; }

function linkAxes(el) {
  if (el._marqLinked) return;
  el._marqLinked = true;
  let busy = false;
  el.on("plotly_relayout", (ev) => {
    if (busy || !ev || !linkMapsOn()) return;
    const src = {};
    let auto = false;
    Object.keys(ev).forEach((k) => {
      const m = k.match(/^([xy])(axis\d*)\.(range|autorange)/);
      if (m) { src[m[1]] = m[1] + m[2]; if (m[3] === "autorange") auto = true; }
    });
    if (!src.x && !src.y) return;
    const fl = el._fullLayout, upd = {};
    ["x", "y"].forEach((ax) => {
      const s = src[ax];
      if (!s || !fl[s]) return;
      Object.keys(el.layout).filter((k) => new RegExp("^" + ax + "axis\\d*$").test(k) && k !== s).forEach((k) => {
        if (auto) upd[k + ".autorange"] = true;
        else upd[k + ".range"] = fl[s].range.slice();
      });
    });
    if (!Object.keys(upd).length) return;
    busy = true;
    Plotly.relayout(el, upd).finally(() => { busy = false; });
  });
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
    if (el._fullLayout && el.classList.contains("active") && el.clientWidth > 20 && el.clientHeight > 20) Plotly.Plots.resize(el);
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
  } catch (err) {
    _viewerFailed = true;
    appendLog("3D viewport unavailable (" + err.message + "); the 3D views use Plotly.");
  }
  return _viewer;
}

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
  const sameKey = _viewerKey === v.key;
  const prevKey = _viewerKey;
  if (prevKey) rememberCamera(prevKey, viewer.getCamera());
  _viewerKey = v.key;
  const cam = cameraFor(v.key);
  viewer.setSurface(trace, cam ? { camera: cam } : (opts.keepCamera && sameKey ? { keepCamera: true } : {}));
  updateColorBar(trace, viewer.colour);
  document.querySelector('.navbtn[data-act="ortho"]').classList.toggle("on", viewer.ortho);
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
function updateScaleBar(pxSize) {
  const sb = document.getElementById("scalebar3d");
  if (!_viewer || !_viewer.ortho || !pxSize || !isFinite(pxSize)) { sb.classList.remove("show"); return; }
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
    else if (act === "ortho") {
      _viewer.setProjection(!_viewer.ortho);
      document.querySelector('.navbtn[data-act="ortho"]').classList.toggle("on", _viewer.ortho);
    } else if (act === "snapshot") {
      const a = document.createElement("a");
      a.href = _viewer.snapshot(); a.download = exportName(v.kind, v.key) + "_view.png"; a.click();
    }
    return;
  }
  if (v.type !== "2d") return;
  const el = document.getElementById(FIGS[v.kind][v.key][1]);
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
    document.querySelectorAll(".plot-container").forEach((p) => { if (p._fullLayout) Plotly.relayout(p, { dragmode: _dragmode2d }); });
  } else if (act === "snapshot") {
    Plotly.downloadImage(el, { format: "png", scale: 2, filename: exportName(v.kind, v.key) });
  }
}

// ── Exports ────────────────────────────────────────────────────────────────────

function stem(name) { return String(name).replace(/\.[^.]+$/, ""); }

function exportName(kind, key) {
  if (kind === "pvisual") return `${stem(files["1"] ? files["1"].name : "surface")}_${key}`;
  const n = _lastPairNames || ["A", "B"];
  return `${stem(n[0])}_vs_${stem(n[1])}_${key}`;
}

function downloadText(name, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function openExportDialog(kind, key) {
  const sel = document.getElementById("exp-figure");
  sel.innerHTML = "";
  const add = (k) => Object.keys(FIGS[k]).forEach((key2) => {
    const o = document.createElement("option");
    o.value = k + ":" + key2; o.textContent = t(k === "pvisual" ? "Surface: " : "Comparison: ") + t(FIGS[k][key2][0]);
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
    w = Math.round(num("exp-w", 1400)); h = Math.round(num("exp-h", 800));
  } else {
    [w, h] = size.split("x").map(Number);
  }
  closeModal("modal-export");
  setStatus("Preparing the figure…", "info");
  _exportRequest = { kind, key, format: format.startsWith("png") ? "png" : "svg",
                     scale: format === "png3" ? 3 : 2, w, h, filename: exportName(kind, key) };
  worker.postMessage({ type: "export_figure", id: "fig",
    data: { kind, key, theme, lang, quality: currentQuality(), palette: currentPalette(), equal: currentEqual(), request: _exportRequest } });
}

async function onExportFigure(fig, req) {
  const stage = document.getElementById("export-stage");
  stage.style.width = req.w + "px"; stage.style.height = req.h + "px";
  const layout = { ...fig.layout, width: req.w, height: req.h, autosize: false };
  try {
    await Plotly.newPlot(stage, fig.data, layout, { staticPlot: false, displayModeBar: false });
    await new Promise((r) => setTimeout(r, 400));          // let WebGL scenes finish a frame
    await Plotly.downloadImage(stage, { format: req.format, width: req.w, height: req.h,
                                        scale: req.format === "png" ? req.scale : 1, filename: req.filename });
    setStatus("Figure exported ({fmt}, {w}×{h})", "success", { fmt: req.format.toUpperCase(), w: req.w, h: req.h });
  } catch (err) {
    appendLog("Figure export failed: " + err.message);
    setStatus("Figure export failed, see the log", "error");
  } finally {
    Plotly.purge(stage);
  }
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
  downloadText(`marq_results_${stampNow()}.json`, JSON.stringify(sessionRecord(), null, 1), "application/json");
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
                "margin", "display_cell", "smooth_sigma", "n_slices", "skip_rows"].join(","));
    session.analyses.forEach((a) => {
      const c = a.channel, p = a.parameters, fl = R(a.roughness.floor), l = R(a.roughness.surf_left), r = R(a.roughness.surf_right);
      lines.push([a.file, a.time, c.floor_width, c.floor_width_line_std, c.opening_width, c.opening_width_conf,
                  c.mean_depth, c.channel_depth_slice_std_central80, c.wall_angle_deg, c.wall_angle_left_deg,
                  c.wall_angle_right_deg, c.wall_angle_resolved, c.chord_angle_deg, c.floor_corner_um, c.rim_corner_um,
                  c.mid_width, c.mean_length, c.mean_length_conf,
                  c.opening_length, a.rotation.converted ? "protrusion_rotated" : "depression",
                  fl.Sa, fl.Sq, fl.Sz, fl.Ssk, fl.Sku, l.Sa, l.Sq, l.Sz, r.Sa, r.Sq, r.Sz,
                  p.voxel_size, p.field_k, p.crop_pad_x, p.crop_pad_y, p.opening_frac, p.floor_width_frac,
                  p.floor_eval_frac, p.floor_eval_length, p.field_eval_width, p.field_eval_length,
                  p.margin, p.display_cell, p.smooth_sigma, p.n_slices, p.skip_rows].map(csvCell).join(","));
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
  downloadText(`marq_results_${stampNow()}.csv`, lines.join("\n"), "text/csv");
}

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
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) { document.getElementById(id).style.display = "none"; }

// ── UI helpers ─────────────────────────────────────────────────────────────────

// The message is English (a key of i18n.js), shown in the interface language; the last one is
// kept, so it can be shown again after a language switch.
let _lastStatus = null;
function setStatus(msg, level, vars) {
  _lastStatus = [msg, level, vars];
  const el = document.getElementById("status-bar");
  el.textContent = t(msg, vars); el.className = "status-bar status-" + level;
}
function setRunning(isRunning, kind) {
  running = isRunning; _pendingKind = isRunning ? kind : null;
  document.getElementById("spinner").style.display = isRunning ? "inline-block" : "none";
  updateButtons();
}
function appendLog(line) {
  const el = document.getElementById("log-box");
  el.value += line + "\n"; el.scrollTop = el.scrollHeight;
}
function clearLog() { document.getElementById("log-box").value = ""; }

// Progress text from the live log
function statusFromLog(line) {
  if (!running) return;
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
  if (saved.left) root.style.setProperty("--left", saved.left + "px");
  if (saved.browser) browser.style.height = saved.browser + "%";
  const save = () => { try { localStorage.setItem(LS.layout, JSON.stringify(saved)); } catch {} };
  const drag = (handle, onMove) => handle.addEventListener("pointerdown", (e) => {
    e.preventDefault(); handle.setPointerCapture(e.pointerId); handle.classList.add("drag");
    const move = (ev) => onMove(ev);
    const up = () => { handle.classList.remove("drag"); handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); save(); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up);
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
  document.querySelectorAll("#tree .trow").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".tx")) return;
      if (row.dataset.view) { showView(row.dataset.view); return; }
      if (row.classList.contains("input")) {
        document.getElementById({ "file1-zone": "file1-input", "fileA-zone": "fileA-input", "fileB-zone": "fileB-input" }[row.id]).click();
        return;
      }
      const node = row.parentElement;
      if (node.classList.contains("tnode")) node.classList.toggle("open");
    });
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
  ["pvisual", "rq_gradient"].forEach((kind) => {
    if (_have[kind]) worker.postMessage({ type: "retheme", id: "rt-" + kind, data: { kind, ...viewOpts() } });
  });
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
  applyPageTheme(_theme);
  if (_lastStatus) setStatus(..._lastStatus);
  document.getElementById("status-bar").title = t("Click to show the analysis log");
  if (_runtime.pyodide !== "…") document.getElementById("sb-runtime").textContent =
    t(_runtime.pyodide === "local" ? "Offline bundle" : "Runtime from the internet");
  if (_viewer) _viewer.setLabels(cubeLabels());
  if (_view) showView(_view, { keepCamera: true });
  else updateDocTitle(null);
  if (rebuild) retheme();
}

function toggleTheme() {
  _theme = _theme === "light" ? "dark" : "light";
  applyPageTheme(_theme);
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
  document.getElementById("exag-select").addEventListener("change", (e) => {
    if (_viewer) { _viewer.setExaggeration(parseFloat(e.target.value) || 1); _viewer.fit(); }
  });
  const bindCheck = (id, key, after) => {
    const el = document.getElementById(id);
    try { const v = localStorage.getItem(key); if (v === "0" || v === "1") el.checked = v === "1"; } catch {}
    el.addEventListener("change", () => { try { localStorage.setItem(key, el.checked ? "1" : "0"); } catch {} after(); });
  };
  bindCheck("equal-axes", LS.equal, retheme);
  bindCheck("link-maps", LS.linkMaps, () => { if (_figs.rq_gradient) renderPlot("rq_gradient", "gradmaps", _figs.rq_gradient.gradmaps); });
  bindCheck("link-cameras", LS.linkCams, () => { delete _cams.grad; });

  document.getElementById("toggle-log").addEventListener("click", () => toggleLog());
  document.getElementById("status-bar").addEventListener("click", () => toggleLog());
  document.getElementById("settings-open").addEventListener("click", () => openModal("modal-settings"));
  document.getElementById("about-open").addEventListener("click", () => openModal("modal-about"));
  document.getElementById("help-open").addEventListener("click", () => openModal("modal-help"));
  document.querySelectorAll("#navbar .navbtn").forEach((b) => b.addEventListener("click", () => navAction(b.dataset.act)));
  document.querySelectorAll(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.style.display = "none"; }));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { document.querySelectorAll(".modal").forEach((m) => m.style.display = "none"); toggleLog(false); return; }
    if (e.target.closest("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    const v = _view && VIEWS[_view];
    if (!v) return;
    if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
      e.preventDefault(); navAction(e.key === "+" || e.key === "=" ? "zoomin" : "zoomout"); return;
    }
    if (v.type !== "3d") return;
    const act = { h: "home", f: "fit", "1": "top", "2": "front", "3": "right", o: "ortho" }[e.key.toLowerCase()];
    if (act) { e.preventDefault(); navAction(act); }
  });
  window.addEventListener("marq-viewer-ready", () => { if (_view && VIEWS[_view].type === "3d") showView(_view); });
});
