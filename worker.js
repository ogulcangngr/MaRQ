/* MaRQ web worker: boots Pyodide off the main thread and runs the analyses.
   The Python runtime is loaded from the local bundle (vendor/pyodide/) when present,
   otherwise from the jsDelivr CDN. */

const BASE            = self.location.href.replace(/worker\.js$/, "");
const PYODIDE_VERSION = "0.26.4";
const LOCAL_RUNTIME   = BASE + "vendor/pyodide/";
const CDN_RUNTIME     = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let runtimeSource = "local";
try {
  importScripts(LOCAL_RUNTIME + "pyodide.js");
} catch (e) {
  runtimeSource = "cdn";
  importScripts(CDN_RUNTIME + "pyodide.js");
}

let pyodide = null;
const post = (m) => self.postMessage(m);

async function init() {
  post({ type: "status", message: runtimeSource === "local"
        ? "Loading the Python runtime (local bundle)…" : "Loading the Python runtime (CDN)…" });
  pyodide = await loadPyodide({ indexURL: runtimeSource === "local" ? LOCAL_RUNTIME : CDN_RUNTIME });

  post({ type: "status", message: "Loading numpy & scipy…" });
  await pyodide.loadPackage(["numpy", "scipy"]);

  post({ type: "status", message: "Loading analysis modules…" });
  const fetchText = (name) => fetch(BASE + name).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch " + name + ": " + r.status);
    return r.text();
  });
  const [x3pSrc, pvSrc, rqSrc, plotSrc] = await Promise.all([
    fetchText("x3p_loader.py"), fetchText("pvisual_core.py"),
    fetchText("rq_gradient_core.py"), fetchText("plots.py"),
  ]);
  pyodide.runPython(x3pSrc);
  pyodide.runPython(pvSrc);
  pyodide.runPython(rqSrc);
  pyodide.runPython(plotSrc);

  // Log lines reach the page as they are produced (live log and progress).
  pyodide.globals.set("_js_log", (msg) => post({ type: "log", line: String(msg) }));
  pyodide.runPython(`
def _live_log(buf):
    def f(msg):
        s = str(msg)
        buf.append(s)
        _js_log(s)
    return f
`);
  post({ type: "runtime", pyodide: runtimeSource, pyodideVersion: PYODIDE_VERSION });
  post({ type: "ready" });
}

// Theme, 3D mesh budget, height palette and language travel with every request.
function setView(data) {
  pyodide.globals.set("_theme", data.theme || "dark");
  pyodide.globals.set("_lang", data.lang || "en");
  pyodide.globals.set("_q3d", data.quality || 0);
  pyodide.globals.set("_cs", data.palette || "Viridis");
  pyodide.globals.set("_equal_axes", data.equal !== false);
}

// Figures and summary numbers only: the point list stays in the worker and the
// crop text is produced on demand (export_crop), so a result is a few MB, not tens.
const PY_PVISUAL_OUTPUT = `
set_theme(_theme)
set_equal(_equal_axes)
set_language(_lang)
_figs = build_pvisual_figs(_result, _q3d or None, _cs)
_output_json = figures_to_json({
    "log":            list(_log_lines),
    "figures":        _figs,
    "channel_info":   _result["channel"],
    "rotation_info":  _result["rotation"],
    "roughness_info": {k: v for k, v in _result["roughness"].items() if k != "vis_grid"},
    "display_cells":  _result["grids"]["cells"],
    "profile":        _result["profile"],
    "slices":         _result["slices"],
    "crop_points":    int(len(_result["cropped_cloud"])),
})
`;

const PY_GRADIENT_OUTPUT = `
set_theme(_theme)
set_equal(_equal_axes)
set_language(_lang)
_figs2 = build_gradient_figs(_result2, _q3d or None, _cs)
_output2_json = figures_to_json({
    "log":     list(_log_lines2),
    "figures": _figs2,
    "metrics": _result2["metrics"],
})
`;

function inputPath(name, slot) {
  const ext = (name || "").toLowerCase().endsWith(".x3p") ? ".x3p" : ".txt";
  return "/input" + slot + ext;
}

function fail(id, err, logName) {
  let log = [];
  try { if (logName) log = pyodide.globals.get(logName).toJs(); } catch {}
  post({ type: "error", id, message: err && err.message ? err.message : String(err), log });
}

self.onmessage = async (e) => {
  const { type, id, data } = e.data;

  if (type === "run_pvisual") {
    try {
      const path1 = inputPath(data.fileName, 1);
      pyodide.FS.writeFile(path1, data.fileContent);
      pyodide.globals.set("_input1_path", path1);
      pyodide.globals.set("_params_json", JSON.stringify(data.params));
      pyodide.globals.set("_log_lines", pyodide.toPy([]));
      setView(data);
      pyodide.runPython(`
import json as _json
_log_fn = _live_log(_log_lines)
_result = run_pvisual(_input1_path, _json.loads(_params_json), _log_fn)
` + PY_PVISUAL_OUTPUT);
      post({ type: "result", id, kind: "pvisual", data: pyodide.globals.get("_output_json") });
    } catch (err) { fail(id, err, null); }
  }

  if (type === "run_rq_gradient") {
    try {
      const path1 = inputPath(data.fileName1, 1);
      const path2 = inputPath(data.fileName2, 2);
      pyodide.FS.writeFile(path1, data.file1Content);
      pyodide.FS.writeFile(path2, data.file2Content);
      pyodide.globals.set("_input1_path", path1);
      pyodide.globals.set("_input2_path", path2);
      pyodide.globals.set("_params2_json", JSON.stringify(data.params));
      pyodide.globals.set("_log_lines2", pyodide.toPy([]));
      setView(data);
      pyodide.runPython(`
import json as _json
_log_fn2 = _live_log(_log_lines2)
_result2 = run_rq_gradient(_input1_path, _input2_path, _json.loads(_params2_json), _log_fn2)
` + PY_GRADIENT_OUTPUT);
      post({ type: "result", id, kind: "rq_gradient", data: pyodide.globals.get("_output2_json") });
    } catch (err) { fail(id, err, null); }
  }

  if (type === "run_batch") {
    // File 1 against each item in turn; metrics per item, figures of the last pair.
    const rows = [];
    try {
      const path1 = inputPath(data.fileName1, 1);
      pyodide.FS.writeFile(path1, data.file1Content);
      pyodide.globals.set("_input1_path", path1);
      pyodide.globals.set("_params2_json", JSON.stringify(data.params));
      setView(data);
      const n = data.items.length;
      for (let i = 0; i < n; i++) {
        const it = data.items[i];
        post({ type: "batch_progress", index: i, total: n, name: it.name });
        post({ type: "log", line: "\n" + "#".repeat(55) + `\n# Batch ${i + 1} of ${n}: ${it.name}\n` + "#".repeat(55) });
        const path2 = inputPath(it.name, 2);
        pyodide.FS.writeFile(path2, it.content);
        pyodide.globals.set("_input2_path", path2);
        pyodide.globals.set("_log_lines2", pyodide.toPy([]));
        pyodide.runPython(`
import json as _json
_log_fn2 = _live_log(_log_lines2)
_result2 = run_rq_gradient(_input1_path, _input2_path, _json.loads(_params2_json), _log_fn2)
_m_json = figures_to_json(_result2["metrics"])
`);
        const m = JSON.parse(pyodide.globals.get("_m_json"));
        rows.push({ name: it.name, metrics: m });
        post({ type: "batch_row", index: i, total: n, name: it.name, metrics: m });
      }
      pyodide.runPython(PY_GRADIENT_OUTPUT);
      post({ type: "result", id, kind: "rq_gradient", data: pyodide.globals.get("_output2_json"),
             batch: rows, lastName: n ? data.items[n - 1].name : null });
    } catch (err) { fail(id, err, null); }
  }

  if (type === "retheme") {
    // Rebuild the figures from the cached result with a new theme, palette or 3D budget.
    try {
      setView(data);
      if (data.kind === "pvisual") {
        pyodide.globals.set("_log_lines", pyodide.toPy([]));
        pyodide.runPython(PY_PVISUAL_OUTPUT);
        post({ type: "result", id, kind: "pvisual", data: pyodide.globals.get("_output_json"), retheme: true });
      } else if (data.kind === "rq_gradient") {
        pyodide.globals.set("_log_lines2", pyodide.toPy([]));
        pyodide.runPython(PY_GRADIENT_OUTPUT);
        post({ type: "result", id, kind: "rq_gradient", data: pyodide.globals.get("_output2_json"), retheme: true });
      }
    } catch (err) { fail(id, new Error("Re-theme failed: " + err.message), null); }
  }

  if (type === "export_figure") {
    // One figure, rebuilt in the requested theme/palette, for the export dialog.
    try {
      setView(data);
      pyodide.globals.set("_fig_kind", data.kind);
      pyodide.globals.set("_fig_key", data.key);
      pyodide.runPython(`
set_theme(_theme)
set_equal(_equal_axes)
set_language(_lang)
_one = build_one_fig(_fig_kind, _fig_key, _result if _fig_kind == "pvisual" else _result2, _q3d or None, _cs)
_one_json = figures_to_json(_one)
`);
      post({ type: "figure", id, kind: data.kind, key: data.key, request: data.request,
             data: pyodide.globals.get("_one_json") });
    } catch (err) { fail(id, new Error("Figure export failed: " + err.message), null); }
  }

  if (type === "export_crop") {
    try {
      pyodide.runPython("_crop_txt = crop_to_text(_result)");
      post({ type: "crop", id, purpose: data && data.purpose, slot: data && data.slot,
             data: pyodide.globals.get("_crop_txt") });
      pyodide.runPython("_crop_txt = None");
    } catch (err) { fail(id, new Error("Crop export failed: " + err.message), null); }
  }
};

init().catch((err) => {
  post({ type: "error", message: "Python runtime failed to start: " + err.message });
});
