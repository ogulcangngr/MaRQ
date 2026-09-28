/* MaRQ (Microchannel and Replication Quality Analyzer): main application logic */

const APP = {
  name: "MaRQ", full: "Microchannel and Replication Quality Analyzer", version: "1.0",
  repo: "https://github.com/ogulcangngr/MaRQ", doi: "10.5281/zenodo.22813916",
  plotlyVersion: "2.35.2", pyodideVersion: "0.26.4",
  paper: "M. O. Güngör, J. Charmet, E. Yıldırım, A 3D slope-correlation metric and workflow for grading " +
         "microchannel replication quality, Measurement (submitted, 2026)",
};

// Figure ids (as produced by plots.py) -> label and plot container
const FIGS = {
  pvisual: {
    rotation:             ["Alignment",              "plot-rotation"],
    channel:              ["Channel detection",      "plot-channel"],
    profiles_xsection:    ["Cross-section and depth","plot-profiles-xsection"],
    profiles_ycenter:     ["Centre line",            "plot-profiles-ycenter"],
    profiles_xcenter:     ["Longitudinal centre",    "plot-profiles-xcenter"],
    profiles_widthlength: ["Width and length",       "plot-profiles-widthlength"],
    view3d:               ["3D view",                "plot-3d"],
    roughness:            ["Roughness areas",        "plot-roughness"],
  },
  rq_gradient: {
    grad3d_cloud1: ["Surface A (3D)",         "plot-grad3d-cloud1"],
    grad3d_cloud2: ["Surface B (3D)",         "plot-grad3d-cloud2"],
    grad3d_error:  ["Slope error E_d (3D)",   "plot-grad3d-error"],
    gradmaps:      ["Height and slope maps",  "plot-gradmaps"],
  },
};
const PARAM_IDS = ["p-voxel", "p-fieldk", "p-cropx", "p-cropy", "p-ofrac", "p-flfrac", "p-rfloor",
                   "p-rfloorlen", "p-rfwidth", "p-rflen", "p-margin", "p-cell", "p-sigma", "p-slices",
                   "p-skiprows", "g-spacing", "g-sigma", "g-skiprows"];
const LS = { params: "marq.params.v1", theme: "marq.theme", layout: "marq.layout", equal: "marq.equal" };

// ── State ──────────────────────────────────────────────────────────────────────

let worker   = null;
let ready    = false;
let running  = false;
const files  = { "1": null, "A": null, "B": null };   // {name, content(Uint8Array), isCrop, from}
let batchFiles = [];
let _rendering   = false;   // suppress relayout during render sequences
let _pvisualFigs = null;    // cached for 3D lazy render
let _gradFigs    = null;    // cached for comparison-3D lazy render
let _cropText = null, _cropFilename = null, _cropAvailable = false, _cropSource = null;
let _theme          = "dark";
let _lastKind       = null;     // "pvisual" | "rq_gradient": last result rendered
const _have = { pvisual: false, rq_gradient: false };   // results the worker still holds
let _pendingRetheme = false;
let _runtime        = { pyodide: "…", plotly: (window.__marqRuntime || {}).plotly || "…" };
let _pendingKind    = null;     // kind of the run in progress (for progress text)
let _batchRows      = [];       // rows of the last batch run
let _lastPairNames  = null;
const session = { started: new Date().toISOString(), analyses: [], comparisons: [] };
let _exportRequest = null;

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
        break;
      case "ready":
        ready = true;
        setStatus("Ready" + (_runtime.pyodide === "local" ? " (offline bundle)" : ""), "success");
        updateButtons();
        break;
      case "result":
        onResult(kind, data, e.data);
        setRunning(false);
        if (_pendingRetheme) { _pendingRetheme = false; rerenderActiveView(); }
        break;
      case "batch_progress":
        setStatus(`Batch ${e.data.index + 1} of ${e.data.total}: ${e.data.name}`, "info");
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
        setStatus("Error, see the log", "error");
        setRunning(false);
        break;
    }
  };

  worker.onerror = (e) => {
    appendLog("Worker error: " + e.message);
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
  nameEl.textContent = extra.isCrop ? `crop of ${extra.from}` : name;
  nameEl.title = name;
  nameEl.classList.add("has-file");
  document.getElementById("file" + slot + "-clear").style.display = "";
  updateButtons(); updateSteps();
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
  nameEl.textContent = "Drop here or Browse"; nameEl.title = "";
  nameEl.classList.remove("has-file");
  document.getElementById("file" + slot + "-clear").style.display = "none";
  updateButtons(); updateSteps();
}

function handleBatchInput() {
  const el = document.getElementById("batch-input");
  const list = Array.from(el.files);
  batchFiles = [];
  let pending = list.length;
  if (!pending) { document.getElementById("batch-count").textContent = "No files chosen"; updateButtons(); return; }
  list.forEach((f) => {
    const r = new FileReader();
    r.onload = (ev) => {
      batchFiles.push({ name: f.name, content: new Uint8Array(ev.target.result) });
      if (--pending === 0) {
        batchFiles.sort((a, b) => a.name.localeCompare(b.name));
        document.getElementById("batch-count").textContent = `${batchFiles.length} file${batchFiles.length > 1 ? "s" : ""} chosen`;
        updateButtons();
      }
    };
    r.readAsArrayBuffer(f);
  });
  el.value = "";
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
  document.getElementById("cancel-run").style.display = running ? "" : "none";
}

function updateSteps() {
  const done1 = session.analyses.length > 0;
  const done2 = !!((files["A"] && files["A"].isCrop) || (files["B"] && files["B"].isCrop)) || (files["A"] && files["B"]);
  const done3 = session.comparisons.length > 0;
  const states = [done1, done2, done3];
  let activeSet = false;
  document.querySelectorAll("#steps .step").forEach((el, i) => {
    el.classList.toggle("done", states[i]);
    const active = !states[i] && !activeSet;
    el.classList.toggle("active", active);
    if (active) activeSet = true;
  });
}

// ── Drag & Drop ────────────────────────────────────────────────────────────────

function setupDropZone(zoneId, slot) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener("dragenter", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragover",  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
  zone.addEventListener("dragleave", (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag-over"); });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    if (slot === "batch") {
      const dt = new DataTransfer();
      Array.from(e.dataTransfer.files).forEach((f) => dt.items.add(f));
      document.getElementById("batch-input").files = dt.files;
      handleBatchInput();
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) readFile(file, slot);
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
    setStatus(`Crop placed as Surface ${slot}`, "success");
  } else {
    downloadText(_cropFilename, text, "text/plain");
    setStatus("Cropped channel saved", "success");
  }
  updateSteps();
}

function downloadCrop() { requestCrop("download"); }
function useCrop(slot)  { requestCrop("slot", slot); }

function resetCrop() {
  _cropText = null; _cropAvailable = false; _cropSource = null;
  updateButtons();
}

// ── Run handlers ───────────────────────────────────────────────────────────────

function viewOpts() {
  return { theme: _theme, quality: currentQuality(), palette: currentPalette(), equal: currentEqual() };
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
  setStatus(`Batch: ${batchFiles.length} comparisons…`, "info");
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
  const note = document.getElementById("params-note");
  note.textContent = n ? `${n} value${n > 1 ? "s" : ""} differ${n > 1 ? "" : "s"} from the paper defaults (marked).`
                       : "Paper defaults. Values are remembered in this browser; changed values are marked.";
  document.getElementById("params-reset").classList.toggle("attention", n > 0);
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
      setStatus("Parameters loaded", "success");
    } catch (err) { setStatus("Parameter file not understood", "error"); }
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

// ── Result rendering ───────────────────────────────────────────────────────────

function showPanels() {
  document.getElementById("empty-state").style.display          = "none";
  document.getElementById("tab-panels-container").style.display = "";
}

function onResult(kind, jsonStr, msg) {
  const result = JSON.parse(jsonStr);
  _lastKind = kind; _have[kind] = true;
  if (result.log && !msg.retheme) result.log.forEach((l) => { if (!_liveLogged) appendLog(l); });
  showPanels();
  if (kind === "pvisual")          renderPvisual(result, !!msg.retheme);
  else if (kind === "rq_gradient") renderGradient(result, !!msg.retheme, msg.batch || null);
  updateButtons(); updateSteps();
}
let _liveLogged = true;   // log lines arrive live through "log" messages

function plotlyConfig(kind, key) {
  const name = exportName(kind, key);
  return {
    displaylogo: false,
    modeBarButtonsToRemove: ["sendDataToCloud", "lasso2d", "select2d"],
    toImageButtonOptions: { format: "png", scale: 2, filename: name },
    modeBarButtonsToAdd: [
      { name: "Download as SVG", icon: Plotly.Icons.disk,
        click: (gd) => Plotly.downloadImage(gd, { format: "svg", filename: name }) },
      { name: "Export figure (theme, size)", icon: Plotly.Icons.pencil,
        click: () => openExportDialog(kind, key) },
    ],
  };
}

// 2D plot: Plotly.react works reliably because there is no WebGL state.
function renderPlot(kind, key, fig) {
  const el = document.getElementById(FIGS[kind][key][1]);
  if (!el) return;
  void el.offsetHeight;
  Plotly.react(el, fig.data, fig.layout, plotlyConfig(kind, key));
}

// 3D plot: purge any prior Plotly/WebGL state, then newPlot on the same element.
function render3dPlot(kind, key, fig) {
  const el = document.getElementById(FIGS[kind][key][1]);
  if (!el) return;
  Plotly.purge(el);
  void el.offsetHeight;
  Plotly.newPlot(el, fig.data, fig.layout, plotlyConfig(kind, key));
}

const UM = " µm";
const fmt   = (v, d = 2) => (v == null || isNaN(v)) ? "–" : Number(v).toFixed(d);
const fmtPm = (v, e, d = 2) => (v == null || isNaN(v)) ? "–" :
  `${Number(v).toFixed(d)} <span class="metric-pm">± ${(e == null || isNaN(e)) ? "–" : Number(e).toFixed(d)}</span>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TIPS = {
  floor_width: "Width of the mean cross-section at the floor level (90 % of the depth by default). The figure the nominal width is compared with.",
  width_sd: "Standard deviation of the per-slice floor widths over the central 80 % of the channel length: within-scan variation, not an uncertainty of the mean.",
  opening_width: "Width of the mean cross-section near the field (10 % of the depth by default), with the SD of the per-slice widths.",
  depth: "Median height of the deepest 5 % of the mean cross-section bins, below the field at z = 0.",
  draft: "Wall angle from vertical between the floor-width level and the opening level.",
  floor_length: "Extent of the along-channel profile at the floor level, with the SD of the per-slice lengths.",
  opening_length: "Extent of the along-channel profile at the opening level.",
  orientation: "Whether the feature was a depression, or a protrusion rotated to a depression (a proper rotation, so handedness is kept).",
  RQ:   "Pearson correlation of the two height maps over the channel-interior mask.",
  RQdx: "Pearson correlation of the signed slopes along the channel (∂Z/∂x) over the mask.",
  RQdy: "Pearson correlation of the signed slopes across the channel (∂Z/∂y) over the mask.",
  RQd:  "Pearson correlation of the slope-magnitude maps |∇Z| over the channel-interior mask at the stated grid cell size (5 µm in the paper). The grading metric of the paper.",
};

function renderPvisual(result, retheme) {
  const figs = result.figures;
  _pvisualFigs = figs;

  ["rotation", "channel", "profiles", "3d", "roughness"].forEach((t) => {
    document.getElementById("tab-btn-" + t).style.display = "";
  });
  showPanels();

  _rendering = true;
  try {
    Object.keys(FIGS.pvisual).forEach((key) => {
      if (key !== "view3d" && figs[key]) renderPlot("pvisual", key, figs[key]);
    });
  } finally {
    _rendering = false;
  }

  if (!retheme) { switchInnerTab("profiles", "xsection"); switchTab("rotation"); }

  const ch = result.channel_info, rot = result.rotation_info, rgh = result.roughness_info;
  const floorPct = Math.round((ch.floor_width_frac != null ? ch.floor_width_frac : 0.90) * 100);
  const orient = rot.converted ? "protrusion, rotated to a depression" : "depression";
  const stat = (label, val, tip) =>
    `<div class="stat" title="${esc(tip || "")}"><div class="stat-l">${label}</div><div class="stat-v">${val}</div></div>`;
  const rghRow = (label, r) => r
    ? `<tr><td>${label}</td><td>${fmt(r.Sa, 2)}</td><td>${fmt(r.Sq, 2)}</td><td>${fmt(r.Sz, 1)}</td><td>${fmt(r.Ssk, 2)}</td><td>${fmt(r.Sku, 2)}</td></tr>`
    : `<tr><td>${label}</td><td colspan="5" class="rt-na">–</td></tr>`;
  const fname = files["1"] ? files["1"].name : "";

  showResults(`
    <div class="result-head">Surface: <b title="${esc(fname)}">${esc(fname)}</b></div>
    <div class="geom-grid">
      ${stat(`Floor width <small>${floorPct}% depth, mean cross-section</small>`, fmt(ch.floor_width) + UM, TIPS.floor_width)}
      ${stat(`Width SD along channel <small>central 80% of slices</small>`, fmt(ch.floor_width_conf) + UM, TIPS.width_sd)}
      ${stat("Opening width", fmtPm(ch.opening_width, ch.opening_width_conf) + UM, TIPS.opening_width)}
      ${stat("Channel depth", fmt(ch.mean_depth) + UM, TIPS.depth)}
      ${stat("Wall draft angle", fmt(ch.draft_angle_deg, 2) + "°", TIPS.draft)}
      ${stat(`Floor length <small>${floorPct}% depth</small>`, fmtPm(ch.mean_length, ch.mean_length_conf) + UM, TIPS.floor_length)}
      ${stat("Opening length", fmtPm(ch.opening_length, ch.opening_length_conf) + UM, TIPS.opening_length)}
      ${stat("Orientation", `<span style="font-size:12px;font-weight:600;">${orient}</span>`, TIPS.orientation)}
    </div>
    <div class="vdiv"></div>
    <div class="rough-block">
      <div class="rough-title">Roughness &middot; ISO 25178 &middot; Sa, Sq, Sz in &micro;m</div>
      <table class="rough-table">
        <thead><tr><th></th><th>Sa</th><th>Sq</th><th>Sz</th><th>Ssk</th><th>Sku</th></tr></thead>
        <tbody>
          ${rghRow("Floor", rgh && rgh.floor)}
          ${rghRow("Field L", rgh && rgh.surf_left)}
          ${rghRow("Field R", rgh && rgh.surf_right)}
        </tbody>
      </table>
    </div>`);

  if (!retheme) {
    if (result.crop_points > 0) {
      const base  = stem(fname || "cloud");
      const voxel = Math.round(rot.voxel_size);
      _cropFilename  = `${base}_Crop_Voxel${voxel}.txt`;
      _cropAvailable = true; _cropSource = fname; _cropText = null;
    }
    session.analyses.push({
      file: fname, time: new Date().toISOString(), parameters: getPvisualParams(),
      channel: ch, rotation: rot, roughness: rgh, display_cells: result.display_cells,
      profile: result.profile, slices: result.slices,
    });
    setStatus("Surface analysis complete", "success");
  }
}

function showResults(html) {
  const empty = document.getElementById("results-empty");
  if (empty) empty.style.display = "none";
  const mp = document.getElementById("metrics-panel");
  mp.style.display = "flex";
  mp.innerHTML = html;
  setTimeout(relayoutAll, 30);     // the results bar height changed, so the plot area did too
}

function renderGradient(result, retheme, batch) {
  const figs = result.figures;
  _gradFigs = figs;

  ["grad3d", "gradmaps"].forEach((t) => {
    document.getElementById("tab-btn-" + t).style.display = "";
  });
  showPanels();

  _rendering = true;
  try {
    renderPlot("rq_gradient", "gradmaps", figs.gradmaps);
  } finally {
    _rendering = false;
  }

  if (!retheme) { switchInnerTab("grad3d", "cloud1"); switchTab(batch ? "gradmaps" : "grad3d"); }

  const m = result.metrics;
  const names = _lastPairNames || ["A", "B"];
  const card = (name, sub, r, rmse, unit) =>
    `<div class="metric-card" title="${esc(TIPS[name])}"><div class="metric-label">${name} <small>${sub}</small></div>
       <div class="metric-value">${fmt(r, 4)}</div>
       <div class="metric-sub">RMSE ${rmse}${unit}</div></div>`;
  const notes = [];
  if (m.z_flip != null) notes.push(m.z_flip ? "surface B rotated 180° about Z to match A" : "surface B used as-is");
  if (m.cell_um)        notes.push(`grid ${fmt(m.cell_um[0], 2)} µm`);
  if (m.n_mask != null && m.n_valid) notes.push(`${m.n_mask.toLocaleString()} channel-interior cells (${Math.round(100 * m.n_mask / m.n_valid)}% of the valid common grid)`);

  let batchHtml = "";
  if (batch && batch.length) {
    const row = (r, i) => {
      const k = r.metrics;
      return `<tr><td>${i + 1}</td><td title="${esc(r.name)}">${esc(r.name)}</td>
        <td>${fmt(k.r_z, 3)}</td><td>${fmt(k.r_gx, 3)}</td><td>${fmt(k.r_gy, 3)}</td><td><b>${fmt(k.r_mag, 3)}</b></td>
        <td>${k.z_flip ? "rotated" : "as-is"}</td><td>${k.n_mask != null ? k.n_mask.toLocaleString() : "–"}</td>
        <td><button class="btn btn-mini" onclick="showBatchPair(${i})" title="Run this pair alone to see its figures">Show</button></td></tr>`;
    };
    batchHtml = `
      <div class="batch-block">
        <div class="rough-title">Batch: A = ${esc(names[0])} against ${batch.length} surfaces &middot; figures above are for the last pair</div>
        <table class="batch-table">
          <thead><tr><th>#</th><th>Surface B</th><th>RQ</th><th>RQdx</th><th>RQdy</th><th>RQd</th><th>B orientation</th><th>cells</th><th></th></tr></thead>
          <tbody>${batch.map(row).join("")}</tbody>
        </table>
      </div>`;
  }

  showResults(`
    <div class="result-head">A: <b title="${esc(names[0])}">${esc(names[0])}</b> &nbsp;·&nbsp; B: <b title="${esc(names[1])}">${esc(names[1])}</b></div>
    <div class="metric-grid">
      ${card("RQ",   "height Z",  m.r_z,   fmt(m.rmse_z, 3),   UM)}
      ${card("RQdx", "∂Z/∂x",     m.r_gx,  fmt(m.rmse_gx, 4),  "")}
      ${card("RQdy", "∂Z/∂y",     m.r_gy,  fmt(m.rmse_gy, 4),  "")}
      ${card("RQd",  "|∇Z|",      m.r_mag, fmt(m.rmse_mag, 4), "")}
    </div>
    <div class="metric-note">${notes.join(" &middot; ")}</div>
    ${batchHtml}`);

  if (!retheme) {
    const params = getGradientParams();
    const rows = batch && batch.length ? batch.map((r) => ({ b: r.name, metrics: r.metrics })) : [{ b: names[1], metrics: m }];
    rows.forEach((r) => session.comparisons.push({ file_a: names[0], file_b: r.b, time: new Date().toISOString(),
                                                    parameters: params, metrics: r.metrics }));
    setStatus(batch ? `Batch complete: ${batch.length} comparisons` : "Comparison complete", "success");
  }
}

function showBatchPair(i) {
  const f = batchFiles[i];
  if (!f) return;
  setFile("B", f.name, f.content);
  runGradient();
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

function replotVisible(el) {
  if (!el || !el._fullLayout) return;
  void el.offsetHeight;
  Plotly.relayout(el, { autosize: true });
}

function switchInnerTab(outerTabId, innerTabId) {
  const container = document.getElementById("tab-" + outerTabId);
  if (!container) return;
  container.querySelectorAll(".inner-tab-btn").forEach((b) => b.classList.remove("active"));
  container.querySelectorAll(".inner-tab-panel").forEach((p) => p.classList.remove("active"));
  const btn   = document.getElementById("inner-tab-btn-" + outerTabId + "-" + innerTabId);
  const panel = document.getElementById("inner-tab-" + outerTabId + "-" + innerTabId);
  if (btn)   btn.classList.add("active");
  if (panel) panel.classList.add("active");

  if (_rendering) return;

  if (outerTabId === "grad3d" && _gradFigs) {
    render3dPlot("rq_gradient", "grad3d_" + innerTabId, _gradFigs["grad3d_" + innerTabId]);
  } else {
    replotVisible(document.getElementById("plot-" + outerTabId + "-" + innerTabId));
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  const btn   = document.getElementById("tab-btn-" + tabId);
  const panel = document.getElementById("tab-" + tabId);
  if (btn)   btn.classList.add("active");
  if (panel) panel.classList.add("active");

  if (_rendering) return;

  if (tabId === "3d") {
    if (_pvisualFigs) render3dPlot("pvisual", "view3d", _pvisualFigs.view3d);
  } else if (tabId === "grad3d") {
    const activeInner = document.querySelector("#tab-grad3d .inner-tab-panel.active");
    if (activeInner && _gradFigs) {
      const innerId = activeInner.id.replace("inner-tab-grad3d-", "");
      render3dPlot("rq_gradient", "grad3d_" + innerId, _gradFigs["grad3d_" + innerId]);
    }
  } else if (tabId === "profiles") {
    replotVisible(document.querySelector("#tab-profiles .inner-tab-panel.active .plot-container"));
  } else {
    const plotId = { rotation: "plot-rotation", channel: "plot-channel", roughness: "plot-roughness",
                     gradmaps: "plot-gradmaps" }[tabId];
    replotVisible(document.getElementById(plotId));
  }
}

// Figure id of the tab currently on screen (for the export dialog default)
function currentFigure() {
  const t = document.querySelector(".tab-btn.active");
  if (!t) return null;
  const tab = t.id.replace("tab-btn-", "");
  if (tab === "profiles") {
    const inner = document.querySelector("#tab-profiles .inner-tab-panel.active");
    return ["pvisual", "profiles_" + inner.id.replace("inner-tab-profiles-", "")];
  }
  if (tab === "grad3d") {
    const inner = document.querySelector("#tab-grad3d .inner-tab-panel.active");
    return ["rq_gradient", "grad3d_" + inner.id.replace("inner-tab-grad3d-", "")];
  }
  return { rotation: ["pvisual", "rotation"], channel: ["pvisual", "channel"], "3d": ["pvisual", "view3d"],
           roughness: ["pvisual", "roughness"], gradmaps: ["rq_gradient", "gradmaps"] }[tab] || null;
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
    o.value = k + ":" + key2; o.textContent = (k === "pvisual" ? "Surface: " : "Comparison: ") + FIGS[k][key2][0];
    sel.appendChild(o);
  });
  if (_have.pvisual && _pvisualFigs) add("pvisual");
  if (_have.rq_gradient && _gradFigs) add("rq_gradient");
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
  const size = document.getElementById("exp-size").value;
  let w = 1200, h = 700;
  if (size === "panel") {
    const el = document.getElementById(FIGS[kind][key][1]);
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
    data: { kind, key, theme, quality: currentQuality(), palette: currentPalette(), request: _exportRequest } });
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
    setStatus(`Figure exported (${req.format.toUpperCase()}, ${req.w}×${req.h})`, "success");
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
                "depth", "depth_sd_central80", "draft_deg", "floor_length", "floor_length_sd", "opening_length",
                "orientation", "floor_Sa", "floor_Sq", "floor_Sz", "floor_Ssk", "floor_Sku",
                "fieldL_Sa", "fieldL_Sq", "fieldL_Sz", "fieldR_Sa", "fieldR_Sq", "fieldR_Sz",
                "voxel_size", "field_k", "crop_pad_x", "crop_pad_y", "opening_frac", "floor_width_frac",
                "floor_eval_frac", "floor_eval_length", "field_eval_width", "field_eval_length",
                "margin", "display_cell", "smooth_sigma", "n_slices", "skip_rows"].join(","));
    session.analyses.forEach((a) => {
      const c = a.channel, p = a.parameters, fl = R(a.roughness.floor), l = R(a.roughness.surf_left), r = R(a.roughness.surf_right);
      lines.push([a.file, a.time, c.floor_width, c.floor_width_slice_std_central80, c.opening_width, c.opening_width_conf,
                  c.mean_depth, c.channel_depth_slice_std_central80, c.draft_angle_deg, c.mean_length, c.mean_length_conf,
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

// ── Modals ─────────────────────────────────────────────────────────────────────

function openModal(id) {
  if (id === "modal-about") {
    const src = (s) => s === "local" ? "local bundle" : s === "cdn" ? "CDN" : s;
    document.getElementById("about-runtime").textContent =
      `Pyodide ${APP.pyodideVersion} (${src(_runtime.pyodide)}), Plotly.js ${APP.plotlyVersion} (${src(_runtime.plotly)}).`;
    document.getElementById("about-version").textContent = APP.version;
  }
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) { document.getElementById(id).style.display = "none"; }

// ── UI helpers ─────────────────────────────────────────────────────────────────

function setStatus(msg, level) {
  const el = document.getElementById("status-bar");
  el.textContent = msg; el.className = "status-bar status-" + level;
}
function setRunning(isRunning, kind) {
  running = isRunning; _pendingKind = isRunning ? kind : null;
  const s = document.getElementById("spinner");
  if (s) s.style.display = isRunning ? "inline-block" : "none";
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
  if (m) { setStatus(`Step ${m[1]} of 9: ${m[2].trim()}`, "info"); return; }
  if (/^Loading clouds/.test(line))      setStatus("Comparison: loading the two surfaces…", "info");
  else if (/^Gridding points/.test(line)) setStatus("Comparison: gridding…", "info");
  else if (/^Computing gradients/.test(line)) setStatus("Comparison: slopes and correlations…", "info");
  else if (/Orientation check/.test(line)) setStatus("Comparison: building the figures…", "info");
  else if (/^Total time/.test(line))     setStatus("Building the figures…", "info");
}

function relayoutAll() {
  if (_rendering) return;
  document.querySelectorAll(".plot-container").forEach((el) => {
    if (el._fullLayout) { void el.offsetHeight; Plotly.relayout(el, { autosize: true }); }
  });
}

let _resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(relayoutAll, 100);
});

function toggleLayout(cls) {
  const app = document.getElementById("app");
  app.classList.toggle(cls);
  try {
    localStorage.setItem(LS.layout, JSON.stringify({ sidebar: app.classList.contains("hide-sidebar"),
                                                    log: app.classList.contains("hide-log") }));
  } catch {}
  setTimeout(relayoutAll, 50);
}

// ── Theme, palette & 3D detail ─────────────────────────────────────────────────

function currentQuality() {
  const el = document.getElementById("quality-select");
  const v = el ? parseInt(el.value, 10) : 80000;
  return isNaN(v) ? 80000 : v;
}

function currentPalette() {
  const el = document.getElementById("palette-select");
  return el ? el.value : "Viridis";
}

function currentEqual() {
  const el = document.getElementById("equal-axes");
  return el ? el.checked : true;
}

function applyPageTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "🌙 Dark" : "☀ Light";
}

// Rebuild and recolor the figures from the result cached in the worker, no re-analysis.
function retheme() {
  if (!ready || !_lastKind || running) return;
  _pendingRetheme = true;
  worker.postMessage({ type: "retheme", id: "rt", data: { kind: _lastKind, ...viewOpts() } });
}

function rerenderActiveView() {
  const t = document.querySelector(".tab-btn.active");
  if (t) switchTab(t.id.replace("tab-btn-", ""));
}

function toggleTheme() {
  _theme = _theme === "light" ? "dark" : "light";
  applyPageTheme(_theme);
  try { localStorage.setItem(LS.theme, _theme); } catch {}
  retheme();
}

// ── Boot ───────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  try {
    const t = localStorage.getItem(LS.theme); if (t === "light" || t === "dark") _theme = t;
    const l = JSON.parse(localStorage.getItem(LS.layout) || "{}");
    if (l.sidebar) document.getElementById("app").classList.add("hide-sidebar");
    if (l.log)     document.getElementById("app").classList.add("hide-log");
  } catch {}
  applyPageTheme(_theme);
  startWorker();
  setupDropZone("file1-zone", "1");
  setupDropZone("fileA-zone", "A");
  setupDropZone("fileB-zone", "B");
  setupDropZone("batch-zone", "batch");
  setupParams();
  updateSteps();
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("quality-select").addEventListener("change", retheme);
  document.getElementById("palette-select").addEventListener("change", retheme);
  const eq = document.getElementById("equal-axes");
  try { const v = localStorage.getItem(LS.equal); if (v === "0" || v === "1") eq.checked = v === "1"; } catch {}
  eq.addEventListener("change", () => { try { localStorage.setItem(LS.equal, eq.checked ? "1" : "0"); } catch {} retheme(); });
  document.getElementById("toggle-sidebar").addEventListener("click", () => toggleLayout("hide-sidebar"));
  document.getElementById("toggle-log").addEventListener("click", () => toggleLayout("hide-log"));
  document.getElementById("about-open").addEventListener("click", () => openModal("modal-about"));
  document.querySelectorAll(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.style.display = "none"; }));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll(".modal").forEach((m) => m.style.display = "none"); });
});
