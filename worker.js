/* Pyodide Web Worker — runs Python computation off the main thread */

importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodide = null;

async function init() {
  self.postMessage({ type: "status", message: "Loading Pyodide runtime…" });
  pyodide = await loadPyodide();

  self.postMessage({ type: "status", message: "Loading numpy & scipy…" });
  await pyodide.loadPackage(["numpy", "scipy"]);

  self.postMessage({ type: "status", message: "Loading analysis modules…" });
  const base = self.location.href.replace(/worker\.js$/, "");

  const [pvSrc, rqSrc, plotSrc, x3pSrc] = await Promise.all([
    fetch(base + "pvisual_core.py").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch pvisual_core.py: " + r.status);
      return r.text();
    }),
    fetch(base + "rq_gradient_core.py").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch rq_gradient_core.py: " + r.status);
      return r.text();
    }),
    fetch(base + "plots.py").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch plots.py: " + r.status);
      return r.text();
    }),
    fetch(base + "x3p_loader.py").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch x3p_loader.py: " + r.status);
      return r.text();
    }),
  ]);

  pyodide.runPython(x3pSrc);
  pyodide.runPython(pvSrc);
  pyodide.runPython(rqSrc);
  pyodide.runPython(plotSrc);

  self.postMessage({ type: "ready" });
}

self.onmessage = async (e) => {
  const { type, id, data } = e.data;

  if (type === "run_pvisual") {
    try {
      const ext1   = (data.fileName || "").toLowerCase().endsWith(".x3p") ? ".x3p" : ".txt";
      const path1  = "/input1" + ext1;
      pyodide.FS.writeFile(path1, data.fileContent);

      pyodide.globals.set("_input1_path", path1);
      pyodide.globals.set("_params_json", JSON.stringify(data.params));
      pyodide.globals.set("_theme", data.theme || "dark");
      pyodide.globals.set("_q3d", data.quality || 0);
      pyodide.globals.set("_cs", data.palette || "Viridis");
      pyodide.globals.set("_log_lines", pyodide.toPy([]));

      pyodide.runPython(`
import json as _json
set_theme(_theme)
_log_fn = lambda msg: _log_lines.append(str(msg))
_result = run_pvisual(_input1_path, _json.loads(_params_json), _log_fn)
_figs = {
    "rotation":             make_rotation_fig(_result),
    "channel":              make_channel_fig(_result),
    "profiles_ycenter":     make_profile_ycenter_fig(_result),
    "profiles_xcenter":     make_profile_xcenter_fig(_result),
    "profiles_widthlength": make_profile_widthlength_fig(_result),
    "view3d":               make_3d_fig(_result, max_rows=_q3d, colorscale=_cs),
    "roughness":            make_roughness_fig(_result),
}
_output = {
    "log":            list(_log_lines),
    "figures":        _figs,
    "channel_info":   _result["channel"],
    "rotation_info":  _result["rotation"],
    "roughness_info": _result["roughness"],
    "cropped_cloud":  _result["cropped_cloud"].tolist(),
}
_output_json = figures_to_json(_output)
`);

      const json = pyodide.globals.get("_output_json");
      self.postMessage({ type: "result", id, kind: "pvisual", data: json });

    } catch (err) {
      let log = [];
      try { log = pyodide.globals.get("_log_lines").toJs(); } catch {}
      self.postMessage({ type: "error", id, message: err.message, log });
    }
  }

  if (type === "run_rq_gradient") {
    try {
      const ext1  = (data.fileName1 || "").toLowerCase().endsWith(".x3p") ? ".x3p" : ".txt";
      const ext2  = (data.fileName2 || "").toLowerCase().endsWith(".x3p") ? ".x3p" : ".txt";
      const path1 = "/input1" + ext1;
      const path2 = "/input2" + ext2;
      pyodide.FS.writeFile(path1, data.file1Content);
      pyodide.FS.writeFile(path2, data.file2Content);

      pyodide.globals.set("_input1_path", path1);
      pyodide.globals.set("_input2_path", path2);
      pyodide.globals.set("_params2_json", JSON.stringify(data.params));
      pyodide.globals.set("_theme", data.theme || "dark");
      pyodide.globals.set("_log_lines2", pyodide.toPy([]));

      pyodide.runPython(`
import json as _json
set_theme(_theme)
_log_fn2 = lambda msg: _log_lines2.append(str(msg))
_result2 = run_rq_gradient(_input1_path, _input2_path, _json.loads(_params2_json), _log_fn2)
_figs2 = {
    "grad3d_cloud1": make_gradient_3d_cloud1_fig(_result2),
    "grad3d_cloud2": make_gradient_3d_cloud2_fig(_result2),
    "grad3d_error":  make_gradient_3d_error_fig(_result2),
    "gradmaps":      make_gradient_maps_fig(_result2),
    "corr":          make_correlation_fig(_result2),
}
_output2 = {
    "log":     list(_log_lines2),
    "figures": _figs2,
    "metrics": _result2["metrics"],
}
_output2_json = figures_to_json(_output2)
`);

      const json2 = pyodide.globals.get("_output2_json");
      self.postMessage({ type: "result", id, kind: "rq_gradient", data: json2 });

    } catch (err) {
      let log = [];
      try { log = pyodide.globals.get("_log_lines2").toJs(); } catch {}
      self.postMessage({ type: "error", id, message: err.message, log });
    }
  }

  if (type === "retheme") {
    // Rebuild figures from the cached result with a new theme / 3D quality.
    try {
      pyodide.globals.set("_theme", data.theme || "dark");
      pyodide.globals.set("_q3d", data.quality || 0);
      pyodide.globals.set("_cs", data.palette || "Viridis");
      if (data.kind === "pvisual") {
        pyodide.runPython(`
set_theme(_theme)
_figs = {
    "rotation":             make_rotation_fig(_result),
    "channel":              make_channel_fig(_result),
    "profiles_ycenter":     make_profile_ycenter_fig(_result),
    "profiles_xcenter":     make_profile_xcenter_fig(_result),
    "profiles_widthlength": make_profile_widthlength_fig(_result),
    "view3d":               make_3d_fig(_result, max_rows=_q3d, colorscale=_cs),
    "roughness":            make_roughness_fig(_result),
}
_output = {
    "log":            [],
    "figures":        _figs,
    "channel_info":   _result["channel"],
    "rotation_info":  _result["rotation"],
    "roughness_info": _result["roughness"],
    "cropped_cloud":  _result["cropped_cloud"].tolist(),
}
_output_json = figures_to_json(_output)
`);
        self.postMessage({ type: "result", id, kind: "pvisual",
                           data: pyodide.globals.get("_output_json") });
      } else if (data.kind === "rq_gradient") {
        pyodide.runPython(`
set_theme(_theme)
_figs2 = {
    "grad3d_cloud1": make_gradient_3d_cloud1_fig(_result2),
    "grad3d_cloud2": make_gradient_3d_cloud2_fig(_result2),
    "grad3d_error":  make_gradient_3d_error_fig(_result2),
    "gradmaps":      make_gradient_maps_fig(_result2),
    "corr":          make_correlation_fig(_result2),
}
_output2 = {
    "log":     [],
    "figures": _figs2,
    "metrics": _result2["metrics"],
}
_output2_json = figures_to_json(_output2)
`);
        self.postMessage({ type: "result", id, kind: "rq_gradient",
                           data: pyodide.globals.get("_output2_json") });
      }
    } catch (err) {
      self.postMessage({ type: "error", id, message: "Re-theme failed: " + err.message, log: [] });
    }
  }
};

init().catch((err) => {
  self.postMessage({ type: "error", message: "Pyodide init failed: " + err.message });
});
