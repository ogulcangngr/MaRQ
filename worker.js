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
  try {
    pyodide = await loadPyodide({ indexURL: runtimeSource === "local" ? LOCAL_RUNTIME : CDN_RUNTIME });
    post({ type: "status", message: "Loading numpy & scipy…" });
    await pyodide.loadPackage(["numpy", "scipy"]);
  } catch (err) {
    // a damaged or incomplete local bundle: the same runtime from the internet, when there is one
    if (runtimeSource !== "local") throw err;
    runtimeSource = "cdn";
    post({ type: "status", message: "Loading the Python runtime (CDN)…" });
    pyodide = await loadPyodide({ indexURL: CDN_RUNTIME });
    post({ type: "status", message: "Loading numpy & scipy…" });
    await pyodide.loadPackage(["numpy", "scipy"]);
  }

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
  pyodide.runPython(PY_SESSION);
  pyodide.runPython(PY_HELD);
  post({ type: "runtime", pyodide: runtimeSource, pyodideVersion: PYODIDE_VERSION });
  post({ type: "ready" });
}

// A session file is a zip: the state of the page (JSON), the results the engine holds as JSON
// with their arrays in an .npz (no pickles, so opening a file runs no code from it), and the
// surfaces in slots A and B.
const PY_SESSION = String.raw`
import io as _sio, json as _sjson, zipfile as _szip
import numpy as _snp

# The display grids (under "grids": the points and maps the figures are drawn from) are kept in
# single precision, which halves the file; everything the numbers and the crop come from keeps
# double precision.
def _s_enc(o, arrays, path=""):
    if isinstance(o, _snp.ndarray):
        if o.dtype.kind in "biufc":
            k = "a%d" % len(arrays)
            if o.dtype == _snp.float64 and path.startswith("/grids"):
                arrays[k] = o.astype(_snp.float32)
                return {"__nd__": k, "f64": True}
            arrays[k] = o
            return {"__nd__": k}
        return {"__list__": [_s_enc(v, arrays) for v in o.tolist()]}
    if isinstance(o, dict):
        return {"__dict__": [[_s_enc(k, arrays), _s_enc(v, arrays, path + "/" + str(k))] for k, v in o.items()]}
    if isinstance(o, tuple):
        return {"__tuple__": [_s_enc(v, arrays, path) for v in o]}
    if isinstance(o, (set, frozenset)):
        return {"__set__": [_s_enc(v, arrays, path) for v in o]}
    if isinstance(o, list):
        return [_s_enc(v, arrays, path) for v in o]
    if isinstance(o, _snp.generic):
        return o.item()
    if o is None or isinstance(o, (bool, int, float, str)):
        return o
    raise TypeError("a result holds %s, which a session cannot store" % type(o).__name__)

def _s_dec(o, arrays):
    if isinstance(o, list):
        return [_s_dec(v, arrays) for v in o]
    if isinstance(o, dict):
        if "__nd__" in o:
            a = arrays[o["__nd__"]]
            return a.astype(_snp.float64) if o.get("f64") else a
        if "__dict__" in o:
            return {_s_dec(k, arrays): _s_dec(v, arrays) for k, v in o["__dict__"]}
        if "__tuple__" in o:
            return tuple(_s_dec(v, arrays) for v in o["__tuple__"])
        if "__set__" in o:
            return set(_s_dec(v, arrays) for v in o["__set__"])
        if "__list__" in o:
            return _snp.array([_s_dec(v, arrays) for v in o["__list__"]], dtype=object)
    return o

def _s_put(z, name, obj):
    arrays = {}
    tree = _s_enc(obj, arrays)
    z.writestr(name + ".json", _sjson.dumps(tree))
    ab = _sio.BytesIO()
    _snp.savez_compressed(ab, **arrays)
    z.writestr(name + ".npz", ab.getvalue(), compress_type=_szip.ZIP_STORED)

def _s_get(z, name):
    with _snp.load(_sio.BytesIO(z.read(name + ".npz")), allow_pickle=False) as npz:
        arrays = {k: npz[k] for k in npz.files}
    return _s_dec(_sjson.loads(z.read(name + ".json")), arrays)

def session_pack(state, want, slots):
    buf = _sio.BytesIO()
    with _szip.ZipFile(buf, "w", _szip.ZIP_DEFLATED) as z:
        z.writestr("marq_session.json", state)
        for aid in want.get("pvisual") or []:
            if aid in _results:
                _s_put(z, "pvisual_" + aid, _results[aid])
        if want.get("rq_gradient") and globals().get("_result2") is not None:
            _s_put(z, "rq_gradient", _result2)
        for slot, data in slots.items():
            z.writestr("slot_" + slot + ".txt", data)
    return buf.getvalue()

def session_unpack(data):
    z = _szip.ZipFile(_sio.BytesIO(data))
    names = z.namelist()
    if "marq_session.json" not in names:
        raise ValueError("not a MaRQ session file")
    have = {"pvisual": [], "rq_gradient": False}
    _results.clear(); _held.clear()
    for n in names:
        if n.startswith("pvisual") and n.endswith(".json"):
            aid = n[8:-5] if n.startswith("pvisual_") else "a1"          # "pvisual.json": a first-version file
            _results[aid] = _s_get(z, n[:-5]); _held.append(aid)
            have["pvisual"].append(aid)
    if "rq_gradient.json" in names:
        globals()["_result2"] = _s_get(z, "rq_gradient")
        have["rq_gradient"] = True
    slots = {n[5:-4]: z.read(n) for n in names if n.startswith("slot_")}
    return z.read("marq_session.json").decode("utf-8"), have, slots
`;

// The surface analyses the engine holds, by id (the newest MAX_HELD; an older one keeps its
// figures in the page but can no longer be rebuilt), and the cross-sections of a result.
const PY_HELD = String.raw`
import numpy as _xnp
_results, _held, MAX_HELD = {}, [], 6

def hold(aid, result):
    _results[aid] = result
    if aid in _held:
        _held.remove(aid)
    _held.append(aid)
    dropped = []
    while len(_held) > MAX_HELD:
        old = _held.pop(0)
        _results.pop(old, None)
        dropped.append(old)
    return dropped

def use(aid):
    global _result
    if aid not in _results:
        raise KeyError("this analysis is no longer held by the engine")
    _result = _results[aid]
    return _result

def forget(aid):
    _results.pop(aid, None)
    if aid in _held:
        _held.remove(aid)

def xs_pvisual(result, x0):
    """The cross-section of the aligned crop at x0, across the channel: the points within one
    voxel of x0 (three where they are sparse), median height per voxel-wide bin in y."""
    P = _xnp.asarray(result["cropped_cloud"], float)
    vox = float((result.get("rotation") or {}).get("voxel_size") or 5.0) or 5.0
    half = vox
    sel = _xnp.abs(P[:, 0] - x0) <= half
    if sel.sum() < 30:
        half = 3 * vox
        sel = _xnp.abs(P[:, 0] - x0) <= half
    y, z = P[sel, 1], P[sel, 2]
    out = {"x": float(x0), "half": half, "n": int(sel.sum()), "y": [], "z": []}
    if y.size:
        b = _xnp.floor((y - y.min()) / vox).astype(int)
        order = _xnp.argsort(b, kind="stable")
        bs, zs = b[order], z[order]
        cut = _xnp.flatnonzero(_xnp.diff(bs)) + 1
        ids = bs[_xnp.r_[0, cut]]
        out["y"] = (y.min() + (ids + 0.5) * vox).tolist()
        out["z"] = [float(_xnp.median(g)) for g in _xnp.split(zs, cut)]
    return out

def xs_gradient(result, x0):
    """The cross-sections of A and B and the slope error on the common grid at x0 (the
    nearest grid column), and the extent of the channel-interior mask along x."""
    g = result["grids"]
    XI, YI = _xnp.asarray(g["XI"], float), _xnp.asarray(g["YI"], float)
    mask = _xnp.asarray(g.get("mask", g["valid"]), bool)
    cols = _xnp.flatnonzero(mask.any(axis=0))
    lo, hi = (float(XI[0, cols[0]]), float(XI[0, cols[-1]])) if cols.size else (float(XI[0, 0]), float(XI[0, -1]))
    if x0 is None:
        x0 = (lo + hi) / 2
    j = int(_xnp.argmin(_xnp.abs(XI[0] - x0)))
    col = lambda a: [float(v) if _xnp.isfinite(v) else None for v in _xnp.asarray(a, float)[:, j]]
    return {"x": float(XI[0, j]), "y": YI[:, 0].tolist(), "zA": col(g["ZI1"]), "zB": col(g["ZI2"]),
            "err": col(g["error_map"]), "lo": lo, "hi": hi}
`;

// Python bytes as a Uint8Array of their own
function pyBytes(proxy) {
  const buf = proxy.getBuffer("u8");
  try { return buf.data.slice(); } finally { buf.release(); proxy.destroy(); }
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

// Header lines at the top of a text point cloud (column names, instrument metadata) are left
// out by themselves when no number of header rows is set: every line before the first line
// of three numbers, if any of them is text. Returns the bytes to analyse.
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$|^[+-]?(nan|inf|infinity)$/i;
function withoutHeader(bytes, name, skipRows) {
  if (skipRows || (name || "").toLowerCase().endsWith(".x3p")) return bytes;
  const lines = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 65536)).split("\n");
  const isRow = (l) => { const p = l.trim().split(/[\s,;]+/).filter(Boolean); return p.length >= 3 && p.slice(0, 3).every((s) => NUMBER.test(s)); };
  let text = false, n = -1;
  for (let i = 0; i < Math.min(lines.length - 1, 500); i++) {
    const l = lines[i].trim();
    if (isRow(l)) { n = i; break; }
    if (l && !l.startsWith("#")) text = true;
  }
  if (n <= 0 || !text) return bytes;
  let off = 0;
  for (let k = 0; k < n; k++) off = bytes.indexOf(10, off) + 1;
  post({ type: "log", line: `  Skipped ${n} header line${n > 1 ? "s" : ""} at the top of ${name}` });
  post({ type: "skipped", n });
  return bytes.subarray(off);
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
      pyodide.FS.writeFile(path1, withoutHeader(data.fileContent, data.fileName, data.params.skip_rows));
      pyodide.globals.set("_input1_path", path1);
      pyodide.globals.set("_params_json", JSON.stringify(data.params));
      pyodide.globals.set("_log_lines", pyodide.toPy([]));
      setView(data);
      pyodide.runPython(`
import json as _json
_log_fn = _live_log(_log_lines)
_result = run_pvisual(_input1_path, _json.loads(_params_json), _log_fn)
` + PY_PVISUAL_OUTPUT);
      pyodide.globals.set("_aid", data.aid);
      const dp = pyodide.runPython("hold(_aid, _result)"), dropped = dp.toJs(); dp.destroy();
      post({ type: "result", id, kind: "pvisual", aid: data.aid, dropped, data: pyodide.globals.get("_output_json") });
    } catch (err) { fail(id, err, null); }
  }

  if (type === "run_rq_gradient") {
    try {
      const path1 = inputPath(data.fileName1, 1);
      const path2 = inputPath(data.fileName2, 2);
      pyodide.FS.writeFile(path1, withoutHeader(data.file1Content, data.fileName1, data.params.skip_rows));
      pyodide.FS.writeFile(path2, withoutHeader(data.file2Content, data.fileName2, data.params.skip_rows));
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
    let lastOk = null;
    try {
      const path1 = inputPath(data.fileName1, 1);
      pyodide.FS.writeFile(path1, withoutHeader(data.file1Content, data.fileName1, data.params.skip_rows));
      pyodide.globals.set("_input1_path", path1);
      pyodide.globals.set("_params2_json", JSON.stringify(data.params));
      setView(data);
      const n = data.items.length;
      for (let i = 0; i < n; i++) {
        const it = data.items[i];
        post({ type: "batch_progress", index: i, total: n, name: it.name });
        post({ type: "log", line: "\n" + "#".repeat(55) + `\n# Batch ${i + 1} of ${n}: ${it.name}\n` + "#".repeat(55) });
        // one pair that fails (a bad file) is a row with its error; the batch goes on
        try {
          const path2 = inputPath(it.name, 2);
          pyodide.FS.writeFile(path2, withoutHeader(it.content, it.name, data.params.skip_rows));
          pyodide.globals.set("_input2_path", path2);
          pyodide.globals.set("_log_lines2", pyodide.toPy([]));
          pyodide.runPython(`
import json as _json
_log_fn2 = _live_log(_log_lines2)
_r2 = run_rq_gradient(_input1_path, _input2_path, _json.loads(_params2_json), _log_fn2)
_result2 = _r2
_m_json = figures_to_json(_r2["metrics"])
`);
          const m = JSON.parse(pyodide.globals.get("_m_json"));
          rows.push({ name: it.name, metrics: m });
          lastOk = it.name;
          post({ type: "batch_row", index: i, total: n, name: it.name, metrics: m });
        } catch (err) {
          const msg = err && err.message ? err.message : String(err);
          if (/fatal/i.test(msg)) throw err;
          post({ type: "log", line: "ERROR: " + msg });
          rows.push({ name: it.name, metrics: null, error: msg });
          post({ type: "batch_row", index: i, total: n, name: it.name, metrics: null, error: msg });
        }
      }
      if (!lastOk) throw new Error(rows.length ? rows[0].error : "no files");
      pyodide.runPython(PY_GRADIENT_OUTPUT);
      post({ type: "result", id, kind: "rq_gradient", data: pyodide.globals.get("_output2_json"),
             batch: rows, lastName: lastOk });
    } catch (err) { fail(id, err, null); }
  }

  if (type === "retheme") {
    // Rebuild the figures from the cached result with a new theme, palette or 3D budget.
    try {
      setView(data);
      if (data.kind === "pvisual") {
        pyodide.globals.set("_log_lines", pyodide.toPy([]));
        pyodide.globals.set("_aid", data.aid);
        pyodide.runPython("use(_aid)\n" + PY_PVISUAL_OUTPUT);
        post({ type: "result", id, kind: "pvisual", aid: data.aid, data: pyodide.globals.get("_output_json"), retheme: true });
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
      pyodide.globals.set("_aid", data.aid || null);
      pyodide.runPython(`
set_theme(_theme)
set_equal(_equal_axes)
set_language(_lang)
_one = build_one_fig(_fig_kind, _fig_key, use(_aid) if _fig_kind == "pvisual" else _result2, _q3d or None, _cs)
_one_json = figures_to_json(_one)
`);
      post({ type: "figure", id, kind: data.kind, key: data.key, request: data.request,
             data: pyodide.globals.get("_one_json") });
    } catch (err) { fail(id, new Error("Figure export failed: " + err.message), null); }
  }

  if (type === "save_session") {
    try {
      pyodide.globals.set("_sess_state", data.state);
      pyodide.globals.set("_sess_want", pyodide.toPy(data.want));
      const keys = Object.keys(data.slots || {});
      keys.forEach((k) => pyodide.globals.set("_sess_slot_" + k, data.slots[k]));   // bytes, not text
      pyodide.globals.set("_sess_keys", pyodide.toPy(keys));
      pyodide.runPython(`
_sess_slots = {k: globals().pop("_sess_slot_" + k).to_bytes() for k in _sess_keys}
_sess_bytes = session_pack(_sess_state, _sess_want, _sess_slots)
_sess_slots = None`);
      const proxy = pyodide.globals.get("_sess_bytes"), bytes = pyBytes(proxy);
      pyodide.runPython("_sess_bytes = None");
      self.postMessage({ type: "session_file", id, data: bytes }, [bytes.buffer]);
    } catch (err) { fail(id, new Error("The session could not be saved: " + err.message), null); }
  }

  if (type === "open_session") {
    try {
      pyodide.globals.set("_sess_in", data.bytes);
      pyodide.runPython("_sess_state, _sess_have, _sess_slots = session_unpack(_sess_in.to_bytes()); _sess_in = None");
      const state = pyodide.globals.get("_sess_state");
      const hp = pyodide.globals.get("_sess_have"), have = hp.toJs({ dict_converter: Object.fromEntries }); hp.destroy();
      have.pvisual = Array.from(have.pvisual || []);
      const sp = pyodide.globals.get("_sess_slots"), slots = {};
      for (const k of sp.keys()) slots[k] = pyBytes(sp.get(k));
      sp.destroy();
      pyodide.runPython("_sess_state = _sess_have = _sess_slots = None");
      post({ type: "session_opened", id, state, have, slots });
    } catch (err) { fail(id, new Error("The session could not be opened: " + err.message), null); }
  }

  if (type === "xsection") {
    try {
      pyodide.globals.set("_aid", data.aid || null);
      pyodide.globals.set("_xs_x", data.x == null ? null : Number(data.x));
      pyodide.runPython(`
import json as _json
_xs_json = _json.dumps(xs_pvisual(use(_aid), _xs_x) if _aid else xs_gradient(_result2, _xs_x))`);
      post({ type: "xsection", id, req: data, data: pyodide.globals.get("_xs_json") });
    } catch (err) { fail(id, new Error("The cross-section could not be read: " + err.message), null); }
  }

  if (type === "forget") {
    try { pyodide.globals.set("_aid", data.aid); pyodide.runPython("forget(_aid)"); } catch {}
  }

  if (type === "export_crop") {
    try {
      pyodide.globals.set("_aid", data.aid);
      pyodide.runPython("_crop_txt = crop_to_text(use(_aid))");
      post({ type: "crop", id, purpose: data && data.purpose, slot: data && data.slot, req: data,
             data: pyodide.globals.get("_crop_txt") });
      pyodide.runPython("_crop_txt = None");
    } catch (err) { fail(id, new Error("Crop export failed: " + err.message), null); }
  }
};

init().catch((err) => {
  post({ type: "error", message: "Python runtime failed to start: " + err.message });
});
