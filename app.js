/* MaRQ (Microchannel and Replication Quality Analyzer): main application logic */

const PLOTLY_CONFIG = {
  displaylogo: false,
  modeBarButtonsToRemove: ["sendDataToCloud"],
  toImageButtonOptions: { format: "png", scale: 2 },
};

// ── State ──────────────────────────────────────────────────────────────────────

let worker     = null;
let ready      = false;
let file1      = null;
let file2      = null;
let _rendering   = false;   // suppress relayout during render sequences
let _pvisualFigs = null;    // cached for 3D lazy render
let _gradFigs    = null;    // cached for grad-3D lazy render
let _cropBlobUrl = null;
let _cropFilename = null;
let _theme          = "dark";   // current plot + UI theme
let _lastKind       = null;     // "pvisual" | "rq_gradient" — last result rendered
let _pendingRetheme = false;    // a retheme result should re-render the active 3D view

// ── Worker bootstrap ───────────────────────────────────────────────────────────

function startWorker() {
  worker = new Worker("worker.js");

  worker.onmessage = (e) => {
    const { type, kind, data, message } = e.data;
    switch (type) {
      case "status": setStatus(message, "info"); break;
      case "ready":
        ready = true;
        setStatus("Ready — Pyodide loaded", "success");
        updateButtons();
        break;
      case "result":
        onResult(kind, data);
        setRunning(false);
        if (_pendingRetheme) { _pendingRetheme = false; rerenderActiveView(); }
        break;
      case "error":
        if (e.data.log && e.data.log.length) e.data.log.forEach(appendLog);
        appendLog("ERROR: " + message);
        setStatus("Error — see log", "error");
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

// ── File handling ──────────────────────────────────────────────────────────────

function readFile(file, slot, nameId) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const content = new Uint8Array(ev.target.result);
    if (slot === 1) { file1 = { name: file.name, content }; }
    else            { file2 = { name: file.name, content }; }
    const nameEl = document.getElementById(nameId);
    nameEl.textContent = file.name;
    nameEl.classList.add("has-file");
    document.getElementById("file" + slot + "-clear").style.display = "";
    updateButtons();
  };
  reader.readAsArrayBuffer(file);
}

function handleFileInput(inputId, slot, nameId) {
  const el   = document.getElementById(inputId);
  const file = el.files[0];
  if (!file) return;
  readFile(file, slot, nameId);
}

function clearFile(slot) {
  if (slot === 1) { file1 = null; }
  else            { file2 = null; }
  const nameEl = document.getElementById("file" + slot + "-name");
  nameEl.textContent = "Drop here or Browse";
  nameEl.classList.remove("has-file");
  document.getElementById("file" + slot + "-clear").style.display = "none";
  document.getElementById("file" + slot + "-input").value = "";
  updateButtons();
}

function updateButtons() {
  if (!ready) return;
  document.getElementById("run-pvisual").disabled  = !file1;
  document.getElementById("run-gradient").disabled = !(file1 && file2);
}

// ── Drag & Drop ────────────────────────────────────────────────────────────────

function setupDropZone(zoneId, slot, nameId) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener("dragenter", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragover",  (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
  zone.addEventListener("dragleave", (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag-over");
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) readFile(file, slot, nameId);
  });
}

// ── Run handlers ───────────────────────────────────────────────────────────────

function downloadCrop() {
  if (!_cropBlobUrl) return;
  const a = document.createElement("a");
  a.href = _cropBlobUrl;
  a.download = _cropFilename;
  a.click();
}

function runPvisual() {
  if (!file1 || !ready) return;
  setRunning(true); clearLog();
  setStatus("Running point cloud analysis…", "info");
  worker.postMessage({ type: "run_pvisual", id: "pv1",
    data: { fileContent: file1.content, fileName: file1.name, params: getPvisualParams(),
            theme: _theme, quality: currentQuality(), palette: currentPalette() } });
}

function runGradient() {
  if (!file1 || !file2 || !ready) return;
  setRunning(true); clearLog();
  setStatus("Running gradient correlation…", "info");
  worker.postMessage({ type: "run_rq_gradient", id: "rq1",
    data: { file1Content: file1.content, fileName1: file1.name,
            file2Content: file2.content, fileName2: file2.name,
            params: getGradientParams(), theme: _theme, quality: currentQuality(), palette: currentPalette() } });
}

// ── Parameter collection ───────────────────────────────────────────────────────

function num(id, fallback) {
  const el = document.getElementById(id);
  if (!el) return fallback;                 // tolerate removed/optional controls
  const v = parseFloat(el.value);
  return isNaN(v) ? fallback : v;
}

function getPvisualParams() {
  return {
    margin: num("p-margin",100), voxel_size: num("p-voxel",5),
    grid_res: Math.round(num("p-res",300)),
    smooth_sigma: num("p-sigma",0), n_slices: Math.round(num("p-slices",80)),
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
  return { grid_spacing: num("g-spacing",5), smooth_sigma: num("g-sigma",0), skip_rows: Math.round(num("g-skiprows",0)) };
}

// ── Result rendering ───────────────────────────────────────────────────────────

function showPanels() {
  document.getElementById("empty-state").style.display          = "none";
  document.getElementById("tab-panels-container").style.display = "";
}

function onResult(kind, jsonStr) {
  const result = JSON.parse(jsonStr);
  _lastKind = kind;
  if (result.log) result.log.forEach(appendLog);
  showPanels();
  if (kind === "pvisual")          renderPvisual(result);
  else if (kind === "rq_gradient") renderGradient(result);
}

// 2D plot: Plotly.react works reliably because there is no WebGL state.
function renderPlot(plotId, data, layout) {
  const el = document.getElementById(plotId);
  if (!el) return;
  void el.offsetHeight;
  Plotly.react(el, data, layout, PLOTLY_CONFIG);
}

// 3D plot: purge any prior Plotly/WebGL state, then newPlot on the same element.
// visibility:hidden (not display:none) keeps the canvas in the render tree so
// WebGL dimensions are valid even when the tab is not the active one.
function render3dPlot(plotId, data, layout) {
  const el = document.getElementById(plotId);
  if (!el) return;
  Plotly.purge(el);
  void el.offsetHeight;
  Plotly.newPlot(el, data, layout, PLOTLY_CONFIG);
}

function renderPvisual(result) {
  const figs = result.figures;
  _pvisualFigs = figs;

  document.getElementById("tab-btn-rotation").style.display  = "";
  document.getElementById("tab-btn-channel").style.display   = "";
  document.getElementById("tab-btn-profiles").style.display  = "";
  document.getElementById("tab-btn-3d").style.display        = "";
  document.getElementById("tab-btn-roughness").style.display = "";
  showPanels();

  _rendering = true;
  try {
    renderPlot("plot-rotation",             figs.rotation.data,             figs.rotation.layout);
    renderPlot("plot-channel",              figs.channel.data,              figs.channel.layout);
    renderPlot("plot-profiles-ycenter",     figs.profiles_ycenter.data,     figs.profiles_ycenter.layout);
    renderPlot("plot-profiles-xcenter",     figs.profiles_xcenter.data,     figs.profiles_xcenter.layout);
    renderPlot("plot-profiles-widthlength", figs.profiles_widthlength.data, figs.profiles_widthlength.layout);
    renderPlot("plot-roughness",            figs.roughness.data,            figs.roughness.layout);
  } finally {
    _rendering = false;
  }

  switchInnerTab("profiles", "ycenter");
  switchTab("rotation");

  // Metrics
  const ch  = result.channel_info, rot = result.rotation_info;
  const rgh = result.roughness_info;
  const floorPct = Math.round((ch.floor_width_frac != null ? ch.floor_width_frac : 0.90) * 100);
  const orient = rot.converted ? "auto-converted from protrusion" : "depression";
  const fmt     = (v, d=2) => (v == null || isNaN(v)) ? "—" : v.toFixed(d);
  const fmtPm   = (v, e, d=2) => (v == null || isNaN(v)) ? "—" :
    `${v.toFixed(d)} <span class="metric-pm">± ${e.toFixed(d)}</span>`;

  const stat = (label, val) => `<div class="stat"><div class="stat-l">${label}</div><div class="stat-v">${val}</div></div>`;
  const rghRow = (label, r) => r
    ? `<tr><td>${label}</td><td>${fmt(r.Sa,2)}</td><td>${fmt(r.Sq,2)}</td><td>${fmt(r.Sz,1)}</td><td>${fmt(r.Ssk,2)}</td><td>${fmt(r.Sku,2)}</td></tr>`
    : `<tr><td>${label}</td><td colspan="5" class="rt-na">—</td></tr>`;

  showResults(`
    <div class="geom-grid">
      ${stat(`Floor width <small>${floorPct}% depth, aggregate profile</small>`, fmt(ch.floor_width) + " &micro;m")}
      ${stat(`Longitudinal width SD <small>central 80% of length</small>`, fmt(ch.floor_width_conf) + " &micro;m")}
      ${stat("Opening width", fmtPm(ch.opening_width, ch.opening_width_conf))}
      ${stat("Channel depth", fmt(ch.mean_depth))}
      ${stat("Wall draft angle", fmt(ch.draft_angle_deg, 2) + "&deg;")}
      ${stat(`Floor length <small>${floorPct}% depth</small>`, fmtPm(ch.mean_length, ch.mean_length_conf))}
      ${stat("Opening length", fmtPm(ch.opening_length, ch.opening_length_conf))}
      ${stat("Orientation", `<span style="font-size:12px;font-weight:600;">${orient}</span>`)}
    </div>
    <div class="vdiv"></div>
    <div class="rough-block">
      <div class="rough-title">Roughness &middot; ISO 25178 (&micro;m)</div>
      <table class="rough-table">
        <thead><tr><th></th><th>Sa</th><th>Sq</th><th>Sz</th><th>Ssk</th><th>Sku</th></tr></thead>
        <tbody>
          ${rghRow("Floor", rgh && rgh.floor)}
          ${rghRow("Field L", rgh && rgh.surf_left)}
          ${rghRow("Field R", rgh && rgh.surf_right)}
        </tbody>
      </table>
    </div>`);

  const cloud = result.cropped_cloud;
  if (cloud && cloud.length > 0) {
    const rows  = cloud.map(([x,y,z]) => `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`).join("\n");
    const blob  = new Blob([rows], { type: "text/plain" });
    const base  = (file1.name || "cloud").replace(/\.txt$/i, "");
    const voxel = Math.round(result.rotation_info.voxel_size);
    if (_cropBlobUrl) URL.revokeObjectURL(_cropBlobUrl);
    _cropBlobUrl  = URL.createObjectURL(blob);
    _cropFilename = `${base}_Crop_Voxel${voxel}.txt`;
    document.getElementById("download-crop").disabled = false;
  }
  setStatus("Point cloud analysis complete", "success");
}

function showResults(html) {
  const empty = document.getElementById("results-empty");
  if (empty) empty.style.display = "none";
  const mp = document.getElementById("metrics-panel");
  mp.style.display = "flex";
  mp.innerHTML = html;
}

function renderGradient(result) {
  const figs = result.figures;
  _gradFigs = figs;

  document.getElementById("tab-btn-grad3d").style.display   = "";
  document.getElementById("tab-btn-gradmaps").style.display = "";
  document.getElementById("tab-btn-corr").style.display     = "";
  showPanels();

  _rendering = true;
  try {
    renderPlot("plot-gradmaps", figs.gradmaps.data, figs.gradmaps.layout);
    renderPlot("plot-corr",     figs.corr.data,     figs.corr.layout);
  } finally {
    _rendering = false;
  }

  switchInnerTab("grad3d", "cloud1");
  switchTab("grad3d");

  // Metrics
  const m = result.metrics;
  const rqClass = (r) => r >= 0.99 ? "metric-good" : r >= 0.95 ? "metric-warn" : "metric-bad";
  showResults(`
    <div class="metric-grid">
      <div class="metric-card ${rqClass(m.r_z)}"><div class="metric-label">r (Z)</div>
        <div class="metric-value">${m.r_z.toFixed(6)}</div>
        <div class="metric-sub">RMSE ${m.rmse_z.toFixed(4)}</div></div>
      <div class="metric-card ${rqClass(m.r_gx)}"><div class="metric-label">r (dZ/dx)</div>
        <div class="metric-value">${m.r_gx.toFixed(6)}</div>
        <div class="metric-sub">RMSE ${m.rmse_gx.toFixed(6)}</div></div>
      <div class="metric-card ${rqClass(m.r_gy)}"><div class="metric-label">r (dZ/dy)</div>
        <div class="metric-value">${m.r_gy.toFixed(6)}</div>
        <div class="metric-sub">RMSE ${m.rmse_gy.toFixed(6)}</div></div>
      <div class="metric-card ${rqClass(m.r_mag)}"><div class="metric-label">r (|∇Z|)</div>
        <div class="metric-value">${m.r_mag.toFixed(6)}</div>
        <div class="metric-sub">RMSE ${m.rmse_mag.toFixed(6)}</div></div>
    </div>`);
  setStatus("Gradient correlation complete", "success");
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
    render3dPlot("plot-grad3d-" + innerTabId,
                 _gradFigs["grad3d_" + innerTabId].data,
                 _gradFigs["grad3d_" + innerTabId].layout);
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
    if (_pvisualFigs) {
      render3dPlot("plot-3d", _pvisualFigs.view3d.data, _pvisualFigs.view3d.layout);
    }
  } else if (tabId === "roughness") {
    replotVisible(document.getElementById("plot-roughness"));
  } else if (tabId === "grad3d") {
    const activeInner = document.querySelector("#tab-grad3d .inner-tab-panel.active");
    if (activeInner && _gradFigs) {
      const innerId = activeInner.id.replace("inner-tab-grad3d-", "");
      render3dPlot("plot-grad3d-" + innerId,
                   _gradFigs["grad3d_" + innerId].data,
                   _gradFigs["grad3d_" + innerId].layout);
    }
  } else if (tabId === "profiles") {
    const p = document.querySelector("#tab-profiles .inner-tab-panel.active .plot-container");
    replotVisible(p);
  } else {
    const plotId = { rotation:"plot-rotation", channel:"plot-channel",
                     roughness:"plot-roughness",
                     gradmaps:"plot-gradmaps", corr:"plot-corr" }[tabId];
    replotVisible(document.getElementById(plotId));
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

function setStatus(msg, level) {
  const el = document.getElementById("status-bar");
  el.textContent = msg; el.className = "status-bar status-" + level;
}
function setRunning(running) {
  document.getElementById("run-pvisual").disabled  = running || !file1 || !ready;
  document.getElementById("run-gradient").disabled = running || !(file1 && file2) || !ready;
  const s = document.getElementById("spinner");
  if (s) s.style.display = running ? "inline-block" : "none";
}
function appendLog(line) {
  const el = document.getElementById("log-box");
  el.value += line + "\n"; el.scrollTop = el.scrollHeight;
}
function clearLog() { document.getElementById("log-box").value = ""; }

// ── Boot ───────────────────────────────────────────────────────────────────────

let _resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (_rendering) return;
    document.querySelectorAll(".plot-container").forEach((el) => {
      if (el._fullLayout) { void el.offsetHeight; Plotly.relayout(el, { autosize: true }); }
    });
  }, 100);
});

// ── Theme & 3D quality ──────────────────────────────────────────────────────────

function currentQuality() {
  const el = document.getElementById("quality-select");
  const v = el ? parseInt(el.value, 10) : 240;
  return isNaN(v) ? 240 : v;
}

function currentPalette() {
  const el = document.getElementById("palette-select");
  return el ? el.value : "Viridis";
}

function applyPageTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "🌙 Dark" : "☀ Light";
}

// Rebuild and recolor the figures from the result cached in the worker — no re-analysis.
function retheme() {
  if (!ready || !_lastKind) return;
  _pendingRetheme = true;
  worker.postMessage({ type: "retheme", id: "rt",
    data: { kind: _lastKind, theme: _theme, quality: currentQuality(), palette: currentPalette() } });
}

function rerenderActiveView() {
  const t = document.querySelector(".tab-btn.active");
  if (t) switchTab(t.id.replace("tab-btn-", ""));
}

function toggleTheme() {
  _theme = _theme === "light" ? "dark" : "light";
  applyPageTheme(_theme);
  retheme();
}

window.addEventListener("DOMContentLoaded", () => {
  startWorker();
  setStatus("Loading Pyodide…", "info");
  setupDropZone("file1-zone", 1, "file1-name");
  setupDropZone("file2-zone", 2, "file2-name");
  applyPageTheme(_theme);
  const tt = document.getElementById("theme-toggle");
  if (tt) tt.addEventListener("click", toggleTheme);
  const qs = document.getElementById("quality-select");
  if (qs) qs.addEventListener("change", retheme);
  const ps = document.getElementById("palette-select");
  if (ps) ps.addEventListener("change", retheme);
});
