"""
Plotly.js figure spec generators — runs inside Pyodide (browser).
All functions return JSON-serialisable Python dicts.
"""
import json
import math
import numpy as np

_BG      = "#0D1117"
_PANEL   = "#161B22"
_CARD    = "#21262D"
_BORDER  = "#30363D"
_TEXT    = "#C9D1D9"
_TEXT2   = "#8B949E"
_BLUE    = "#58A6FF"
_RED     = "#F85149"
_GREEN   = "#3FB950"
_YELLOW  = "#D29922"
_PURPLE  = "#A371F7"

# Switchable palettes. Figure builders read the module-level colour names above
# at call time, so set_theme() before (re)building figures changes their look.
_THEMES = {
    "dark":  dict(BG="#0D1117", PANEL="#161B22", CARD="#21262D", BORDER="#30363D",
                  TEXT="#C9D1D9", TEXT2="#8B949E", BLUE="#58A6FF", RED="#F85149",
                  GREEN="#3FB950", YELLOW="#D29922", PURPLE="#A371F7"),
    "light": dict(BG="#FFFFFF", PANEL="#FFFFFF", CARD="#EEF1F4", BORDER="#D0D7DE",
                  TEXT="#1F2328", TEXT2="#57606A", BLUE="#0969DA", RED="#CF222E",
                  GREEN="#1A7F37", YELLOW="#9A6700", PURPLE="#8250DF"),
}

def set_theme(name):
    """Switch the palette used by every figure builder. Call before (re)building."""
    global _BG, _PANEL, _CARD, _BORDER, _TEXT, _TEXT2, _BLUE, _RED, _GREEN, _YELLOW, _PURPLE
    t = _THEMES.get(str(name).lower(), _THEMES["dark"])
    _BG, _PANEL, _CARD, _BORDER = t["BG"], t["PANEL"], t["CARD"], t["BORDER"]
    _TEXT, _TEXT2 = t["TEXT"], t["TEXT2"]
    _BLUE, _RED, _GREEN, _YELLOW, _PURPLE = t["BLUE"], t["RED"], t["GREEN"], t["YELLOW"], t["PURPLE"]

DEFAULT_3D_ROWS = 240        # 3D surface mesh detail (rows kept); higher = sharper, slower
Z_DTICK_3D      = 100        # depth (Z) tick spacing in the 3D channel view
COLORSCALE_3D   = "Viridis"  # default colorscale for the 3D channel surface


# ── Serialisation helpers ──────────────────────────────────────────────────────

def _v(x):
    """Scalar: nan → None, numpy scalar → Python scalar."""
    if isinstance(x, float) and math.isnan(x):
        return None
    if isinstance(x, (np.floating, np.integer)):
        v = x.item()
        return None if (isinstance(v, float) and math.isnan(v)) else v
    return x


def _arr(a):
    """1-D or 2-D array → nested list with nan→None."""
    if a is None:
        return None
    if a.ndim == 1:
        return [_v(x) for x in a.tolist()]
    return [[_v(x) for x in row] for row in a.tolist()]


def _ds(a, step):
    """Downsample 2-D array."""
    return a[::step, ::step]


def _base():
    return {
        "paper_bgcolor": _PANEL,
        "plot_bgcolor":  _BG,
        "font":  {"color": _TEXT, "family": "monospace, monospace"},
        "xaxis": {"gridcolor": _CARD, "linecolor": _BORDER, "zerolinecolor": _BORDER},
        "yaxis": {"gridcolor": _CARD, "linecolor": _BORDER, "zerolinecolor": _BORDER},
        "margin": {"t": 80, "b": 50, "l": 60, "r": 20},
        "autosize": True,
    }


def _scene(domain_x):
    return {
        "domain": {"x": domain_x, "y": [0, 1]},
        "xaxis": {"gridcolor": _CARD, "backgroundcolor": _BG, "showbackground": True,
                  "gridwidth": 1},
        "yaxis": {"gridcolor": _CARD, "backgroundcolor": _BG, "showbackground": True,
                  "gridwidth": 1},
        "zaxis": {"gridcolor": _CARD, "backgroundcolor": _BG, "showbackground": True,
                  "gridwidth": 1},
        "bgcolor": _BG,
        "camera": {"eye": {"x": 1.4, "y": 1.1, "z": 0.9}},
    }


def _ann(text, x, y, color=None):
    return {"text": text, "x": x, "xref": "paper", "y": y, "yref": "paper",
            "showarrow": False, "font": {"size": 11, "color": color or _TEXT2}}


# ── Rotation maps ──────────────────────────────────────────────────────────────

def make_rotation_fig(result):
    bg  = result["grids"]["before"]
    ag  = result["grids"]["after"]
    rot = result["rotation"]
    S   = 2

    xi_b = bg["XI"][0, ::S].tolist()
    yi_b = bg["YI"][::S, 0].tolist()
    zi_b = _arr(_ds(bg["ZI"], S))

    xi_a = ag["XI"][0, ::S].tolist()
    yi_a = ag["YI"][::S, 0].tolist()
    zi_a = _arr(_ds(ag["ZI"], S))

    xd   = np.array(bg["xd"])
    yd   = np.array(bg["yd"])
    ca   = rot["channel_axis"]
    cx_  = float(xd.mean())
    cy_  = float(yd.mean())
    alen = float(min(xd.max() - xd.min(), yd.max() - yd.min()) * 0.22)

    phi = rot["phi"]; xz = rot["xz_tilt"]; yz = rot["yz_tilt"]
    vp  = rot["var_pct"]

    layout = _base()
    layout.update({
        "title": {"text": f"Rotation  |  φ={phi:.2f}°  XZ={xz:.2f}°  YZ={yz:.2f}°  var={vp:.1f}%",
                  "font": {"size": 13}},
        "autosize": True,
        "xaxis":  {"title": "X", "domain": [0, 0.45], "gridcolor": _CARD, "linecolor": _BORDER},
        "yaxis":  {"title": "Y", "scaleanchor": "x", "gridcolor": _CARD, "linecolor": _BORDER},
        "xaxis2": {"title": "X (channel axis)", "domain": [0.55, 1.0], "gridcolor": _CARD,
                   "linecolor": _BORDER, "anchor": "y2"},
        "yaxis2": {"title": "Y (cross-channel)", "scaleanchor": "x2", "gridcolor": _CARD,
                   "linecolor": _BORDER},
        "annotations": [
            _ann("BEFORE — raw",      0.22, 1.07),
            _ann("AFTER — aligned",   0.78, 1.07),
            {"x": cx_ + alen * ca[0], "y": cy_ + alen * ca[1],
             "ax": cx_, "ay": cy_,
             "xref": "x", "yref": "y", "axref": "x", "ayref": "y",
             "showarrow": True, "arrowhead": 3, "arrowsize": 1.2,
             "arrowcolor": _RED, "arrowwidth": 2.5,
             "text": "channel", "font": {"color": _RED, "size": 9}},
        ],
        "margin": {"t": 90, "b": 50, "l": 60, "r": 60},
    })

    return {
        "data": [
            {"type": "heatmap", "x": xi_b, "y": yi_b, "z": zi_b,
             "colorscale": "Viridis", "showscale": True,
             "colorbar": {"x": 0.46, "thickness": 12, "len": 0.85,
                          "title": {"text": "Z", "side": "right"}},
             "xaxis": "x", "yaxis": "y", "name": "Before"},
            {"type": "heatmap", "x": xi_a, "y": yi_a, "z": zi_a,
             "colorscale": "Viridis", "showscale": True,
             "colorbar": {"x": 1.01, "thickness": 12, "len": 0.85,
                          "title": {"text": "Z", "side": "right"}},
             "xaxis": "x2", "yaxis": "y2", "name": "After"},
        ],
        "layout": layout,
    }


# ── Channel detection ──────────────────────────────────────────────────────────

def make_channel_fig(result):
    ag  = result["grids"]["after"]
    sl  = result["slices"]
    S   = 2

    xi = ag["XI"][0, ::S].tolist()
    yi = ag["YI"][::S, 0].tolist()
    zi = _arr(_ds(ag["ZI"], S))

    rx  = sl["rx"].tolist();  cy  = sl["cy"].tolist();  cy_s = sl["cy_std"].tolist()
    wx  = sl["width_x"].tolist()
    ry  = sl["ry"].tolist();  cx  = sl["cx"].tolist();  cx_s = sl["cx_std"].tolist()
    ly  = sl["length_y"].tolist()
    box = sl["crop_box"]

    hi = lambda a, s: [v + 2*d for v, d in zip(a, s)]
    lo = lambda a, s: [v - 2*d for v, d in zip(a, s)]

    cy_hi = hi(cy, cy_s);   cy_lo = lo(cy, cy_s)
    cx_hi = hi(cx, cx_s);   cx_lo = lo(cx, cx_s)
    wx_hi = [c + w/2 for c, w in zip(cy, wx)]

    bx = box["x_min"]; bX = box["x_max"]
    by = box["y_min"]; bY = box["y_max"]
    box_px = [bx, bX, bX, bx, bx]
    box_py = [by, by, bY, bY, by]

    hm = {"type": "heatmap", "x": xi, "y": yi, "z": zi,
          "colorscale": "Viridis", "showscale": False, "showlegend": False}

    layout = {
        "paper_bgcolor": _PANEL, "plot_bgcolor": _BG,
        "font": {"color": _TEXT, "family": "monospace, monospace"},
        "autosize": True,
        "margin": {"t": 70, "b": 80, "l": 65, "r": 20},
        # Left panel: X-slice detections
        "xaxis":  {"title": "X (channel axis)", "domain": [0.00, 0.46],
                   "gridcolor": _CARD, "linecolor": _BORDER},
        "yaxis":  {"title": "Y (cross-channel)",
                   "gridcolor": _CARD, "linecolor": _BORDER},
        # Right panel: Y-slice detections
        "xaxis2": {"title": "X (channel axis)", "domain": [0.54, 1.00],
                   "gridcolor": _CARD, "linecolor": _BORDER, "anchor": "y2"},
        "yaxis2": {"title": "Y (cross-channel)",
                   "gridcolor": _CARD, "linecolor": _BORDER},
        "showlegend": True,
        "legend": {"x": 0.5, "y": -0.18, "xanchor": "center", "orientation": "h",
                   "bgcolor": _CARD, "bordercolor": _BORDER, "borderwidth": 1, "font": {"size": 10}},
        "annotations": [
            _ann("X-slice detections — center Y & width",  0.23, 1.05),
            _ann("Y-slice detections — center X & length", 0.77, 1.05),
        ],
    }

    data = [
        # ── Left panel: X slices ─────────────────
        {**hm, "xaxis": "x", "yaxis": "y"},
        {"type": "scatter", "x": rx, "y": cy, "mode": "lines",
         "line": {"color": _RED, "width": 2}, "name": "Center Y",
         "xaxis": "x", "yaxis": "y"},
        {"type": "scatter", "x": rx + rx[::-1], "y": cy_hi + cy_lo[::-1],
         "fill": "toself", "fillcolor": "rgba(248,81,73,0.15)",
         "line": {"width": 0}, "showlegend": False,
         "xaxis": "x", "yaxis": "y", "name": "±2σ Y"},
        {"type": "scatter", "x": rx, "y": wx_hi, "mode": "lines",
         "line": {"color": "rgba(255,255,255,0.35)", "width": 1.5, "dash": "dash"},
         "name": "Width edge", "xaxis": "x", "yaxis": "y"},
        {"type": "scatter", "x": box_px, "y": box_py, "mode": "lines",
         "line": {"color": _YELLOW, "width": 2}, "name": "Crop box",
         "xaxis": "x", "yaxis": "y"},

        # ── Right panel: Y slices ────────────────
        {**hm, "xaxis": "x2", "yaxis": "y2"},
        {"type": "scatter", "x": cx, "y": ry, "mode": "lines",
         "line": {"color": _BLUE, "width": 2}, "name": "Center X",
         "xaxis": "x2", "yaxis": "y2"},
        {"type": "scatter",
         "x": cx_hi + cx_lo[::-1], "y": ry + ry[::-1],
         "fill": "toself", "fillcolor": "rgba(88,166,255,0.15)",
         "line": {"width": 0}, "showlegend": False,
         "xaxis": "x2", "yaxis": "y2", "name": "±2σ X"},
        {"type": "scatter", "x": [c + l/2 for c, l in zip(cx, ly)], "y": ry,
         "mode": "lines",
         "line": {"color": "rgba(255,255,255,0.35)", "width": 1.5, "dash": "dot"},
         "name": "Length edge", "xaxis": "x2", "yaxis": "y2"},
        {"type": "scatter", "x": box_px, "y": box_py, "mode": "lines",
         "line": {"color": _YELLOW, "width": 2}, "showlegend": False,
         "name": "Crop box (Y)", "xaxis": "x2", "yaxis": "y2"},
    ]

    return {"data": data, "layout": layout}


# ── Profile plots ──────────────────────────────────────────────────────────────

def _profile_base():
    return {
        "paper_bgcolor": _PANEL, "plot_bgcolor": _BG,
        "font": {"color": _TEXT, "family": "monospace, monospace"},
        "autosize": True,
        "margin": {"t": 70, "b": 80, "l": 65, "r": 30},
        "showlegend": True,
        "legend": {"x": 0.5, "y": -0.18, "xanchor": "center", "orientation": "h",
                   "bgcolor": _CARD, "bordercolor": _BORDER, "borderwidth": 1,
                   "font": {"size": 10}},
    }


def make_profile_ycenter_fig(result):
    sl   = result["slices"]
    ch   = result["channel"]
    rx   = sl["rx"].tolist()
    cy   = sl["cy"].tolist()
    cy_s = sl["cy_std"].tolist()
    cY   = ch["center_y"]
    cY_c = ch["center_y_conf"]

    hi  = [y + s for y, s in zip(cy, cy_s)]
    lo  = [y - s for y, s in zip(cy, cy_s)]
    bx  = rx + rx[::-1]
    by  = hi + lo[::-1]

    layout = {**_profile_base()}
    layout["title"] = {"text": f"Center Y  |  mean={cY:.2f} ± {cY_c:.2f}",
                        "font": {"size": 12}}
    layout["xaxis"] = {"title": "X (channel axis)", "gridcolor": _CARD,
                        "linecolor": _BORDER}
    layout["yaxis"] = {"title": "Center Y", "gridcolor": _CARD,
                        "linecolor": _BORDER, "scaleanchor": "x", "scaleratio": 1}

    return {
        "data": [
            {"type": "scatter", "x": rx, "y": cy, "mode": "lines",
             "line": {"color": _BLUE, "width": 2}, "name": "Center Y"},
            {"type": "scatter", "x": bx, "y": by, "fill": "toself",
             "fillcolor": "rgba(88,166,255,0.18)", "line": {"width": 0},
             "showlegend": False},
            {"type": "scatter", "x": [rx[0], rx[-1]], "y": [cY, cY], "mode": "lines",
             "line": {"color": _RED, "width": 1.2, "dash": "dash"},
             "name": f"mean {cY:.2f}"},
        ],
        "layout": layout,
    }


def make_profile_xcenter_fig(result):
    sl   = result["slices"]
    ch   = result["channel"]
    ry   = sl["ry"].tolist()
    cx   = sl["cx"].tolist()
    cx_s = sl["cx_std"].tolist()
    cX   = ch["center_x"]
    cX_c = ch["center_x_conf"]

    hi  = [c + s for c, s in zip(cx, cx_s)]
    lo  = [c - s for c, s in zip(cx, cx_s)]
    bx  = hi + lo[::-1]
    by  = ry + ry[::-1]

    layout = {**_profile_base()}
    layout["title"] = {"text": f"Center X  |  mean={cX:.2f} ± {cX_c:.2f}",
                        "font": {"size": 12}}
    layout["xaxis"] = {"title": "Center X", "gridcolor": _CARD, "linecolor": _BORDER}
    layout["yaxis"] = {"title": "Y (cross-channel)", "gridcolor": _CARD,
                        "linecolor": _BORDER, "scaleanchor": "x", "scaleratio": 1}

    return {
        "data": [
            {"type": "scatter", "x": cx, "y": ry, "mode": "lines",
             "line": {"color": _GREEN, "width": 2}, "name": "Center X"},
            {"type": "scatter", "x": bx, "y": by, "fill": "toself",
             "fillcolor": "rgba(63,185,80,0.18)", "line": {"width": 0},
             "showlegend": False},
            {"type": "scatter", "x": [cX, cX], "y": [ry[0], ry[-1]], "mode": "lines",
             "line": {"color": _RED, "width": 1.2, "dash": "dash"},
             "name": f"mean {cX:.2f}"},
        ],
        "layout": layout,
    }


def make_profile_widthlength_fig(result):
    sl   = result["slices"]
    ch   = result["channel"]
    rx   = sl["rx"].tolist()
    wx   = sl["width_x"].tolist()
    wx_s = sl["width_x_std"].tolist()
    ry   = sl["ry"].tolist()
    ly   = sl["length_y"].tolist()
    ly_s = sl["length_y_std"].tolist()
    mW   = ch["mean_width"];  mW_c = ch["mean_width_conf"]
    mL   = ch["mean_length"]; mL_c = ch["mean_length_conf"]

    bx_w = rx + rx[::-1]
    by_w = ([w + s for w, s in zip(wx, wx_s)] +
            [w - s for w, s in zip(wx, wx_s)][::-1])

    layout = {**_profile_base()}
    layout["margin"] = {"t": 70, "b": 80, "l": 65, "r": 65}
    layout["title"] = {
        "text": f"Width & Length  |  W={mW:.1f}±{mW_c:.1f}  L={mL:.1f}±{mL_c:.1f}",
        "font": {"size": 12}}
    layout["xaxis"] = {"title": "Position along axis", "gridcolor": _CARD,
                        "linecolor": _BORDER}
    layout["yaxis"] = {"title": "Width", "gridcolor": _CARD, "linecolor": _BORDER,
                        "titlefont": {"color": _YELLOW}, "tickfont": {"color": _YELLOW},
                        "scaleanchor": "x", "scaleratio": 1}
    layout["yaxis2"] = {"title": "Length", "gridcolor": _CARD, "linecolor": _BORDER,
                         "overlaying": "y", "side": "right",
                         "titlefont": {"color": _PURPLE}, "tickfont": {"color": _PURPLE}}

    return {
        "data": [
            {"type": "scatter", "x": rx, "y": wx, "mode": "lines",
             "line": {"color": _YELLOW, "width": 2}, "name": "Width"},
            {"type": "scatter", "x": bx_w, "y": by_w, "fill": "toself",
             "fillcolor": "rgba(210,153,34,0.18)", "line": {"width": 0},
             "showlegend": False},
            {"type": "scatter", "x": ry, "y": ly, "mode": "lines",
             "line": {"color": _PURPLE, "width": 2, "dash": "dashdot"},
             "name": "Length", "yaxis": "y2"},
        ],
        "layout": layout,
    }


# ── 3D channel view ────────────────────────────────────────────────────────────

def make_3d_fig(result, max_rows=None, colorscale=None):
    crop = result["grids"]["crop"]
    ch   = result["channel"]
    ZI   = crop["ZI"]
    rows = int(max_rows) if max_rows else DEFAULT_3D_ROWS
    S    = max(1, ZI.shape[0] // max(1, rows))
    cs   = colorscale or COLORSCALE_3D

    x_range = float(crop["x_max"] - crop["x_min"])
    y_range = float(crop["y_max"] - crop["y_min"])
    z_range = float(np.nanmax(ZI) - np.nanmin(ZI))

    # Normalise so Y=1, scale X and Z proportionally
    xy_ratio = (x_range / y_range) if y_range > 0 else 2.0
    z_ratio  = (z_range / y_range) if y_range > 0 else 0.3
    z_ratio  = max(0.05, min(z_ratio, 0.8))  # keep Z visible but not overwhelming

    xi_c = np.linspace(crop["x_min"], crop["x_max"], ZI.shape[1])
    yi_c = np.linspace(crop["y_min"], crop["y_max"], ZI.shape[0])
    XI_c, YI_c = np.meshgrid(xi_c, yi_c)

    return {
        "data": [
            {"type": "surface",
             "x": XI_c[::S, ::S].tolist(),
             "y": YI_c[::S, ::S].tolist(),
             "z": _arr(_ds(ZI, S)),
             "colorscale": cs, "showscale": True,
             "lighting": {"ambient": 0.55, "diffuse": 0.85,
                          "roughness": 0.3, "specular": 0.2},
             "colorbar": {"thickness": 14, "title": {"text": "Z", "side": "right"}},
             "name": "Channel"},
        ],
        "layout": {
            "paper_bgcolor": _PANEL,
            "font": {"color": _TEXT},
            "autosize": True,
            "margin": {"t": 60, "b": 10, "l": 10, "r": 80},
            "title": {"text": (f"Cropped Channel 3D  |  "
                               f"width={ch['mean_width']:.1f}  "
                               f"length={ch['mean_length']:.1f}  "
                               f"depth={ch['mean_depth']:.1f}"),
                      "font": {"size": 12}},
            "scene": {
                **_scene([0, 1]),
                "aspectmode": "manual",
                "aspectratio": {"x": xy_ratio, "y": 1.0, "z": z_ratio},
                "xaxis": {**_scene([0, 1])["xaxis"], "title": "X (channel axis)"},
                "yaxis": {**_scene([0, 1])["yaxis"], "title": "Y (cross-channel)"},
                "zaxis": {**_scene([0, 1])["zaxis"], "title": "Z", "dtick": Z_DTICK_3D},
            },
        },
    }


# ── Roughness evaluation areas ────────────────────────────────────────────────

def make_roughness_fig(result):
    rgh  = result["roughness"]
    vg   = rgh["vis_grid"]
    ZI   = vg["ZI"]
    S    = max(1, ZI.shape[0] // 160)

    xi_c = np.linspace(float(vg["x_min"]), float(vg["x_max"]), ZI.shape[1])
    yi_c = np.linspace(float(vg["y_min"]), float(vg["y_max"]), ZI.shape[0])

    def _legend(r, name):
        if r is None:
            return f"{name}: no data"
        return f"{name}  Sa={r['Sa']:.3f}  Sq={r['Sq']:.3f}  Sz={r['Sz']:.3f}"

    def _hover(r, name):
        if r is None:
            return f"<b>{name}</b><br>No data"
        return (f"<b>{name}</b><br>"
                f"Sa = {r['Sa']:.4f}<br>"
                f"Sq = {r['Sq']:.4f}<br>"
                f"Sz = {r['Sz']:.4f}<br>"
                f"Ssk = {r['Ssk']:.3f}<br>"
                f"Sku = {r['Sku']:.3f}<br>"
                f"n = {r['n_pts']}<extra></extra>")

    def _rect(reg, color, fill_rgba, name, rgh_entry):
        rx = [reg["x_min"], reg["x_max"], reg["x_max"], reg["x_min"], reg["x_min"]]
        ry = [reg["y_min"], reg["y_min"], reg["y_max"], reg["y_max"], reg["y_min"]]
        return {
            "type": "scatter", "x": rx, "y": ry,
            "mode": "lines", "fill": "toself",
            "fillcolor": fill_rgba,
            "line": {"color": color, "width": 2},
            "name": _legend(rgh_entry, name),
            "hovertemplate": _hover(rgh_entry, name),
        }

    data = [
        {"type": "heatmap",
         "x": xi_c[::S].tolist(), "y": yi_c[::S].tolist(),
         "z": _arr(_ds(ZI, S)),
         "colorscale": "Viridis", "showscale": True, "showlegend": False,
         "colorbar": {"thickness": 14, "title": {"text": "Z", "side": "right"}}},
        _rect(rgh["regions"]["floor"],
              _GREEN, "rgba(63,185,80,0.20)",   "Floor",         rgh["floor"]),
        _rect(rgh["regions"]["surf_left"],
              _BLUE,  "rgba(88,166,255,0.20)",  "Surface Left",  rgh["surf_left"]),
        _rect(rgh["regions"]["surf_right"],
              _RED,   "rgba(248,81,73,0.20)",   "Surface Right", rgh["surf_right"]),
    ]

    return {
        "data": data,
        "layout": {
            "paper_bgcolor": _PANEL, "plot_bgcolor": _BG,
            "font": {"color": _TEXT, "family": "monospace, monospace"},
            "autosize": True,
            "margin": {"t": 70, "b": 160, "l": 65, "r": 80},
            "title": {"text": "Surface Roughness — ISO 25178 Evaluation Areas",
                      "font": {"size": 13}},
            "xaxis": {"title": "X (channel axis)", "gridcolor": _CARD,
                      "linecolor": _BORDER, "scaleanchor": "y", "scaleratio": 1},
            "yaxis": {"title": "Y (cross-channel)", "gridcolor": _CARD,
                      "linecolor": _BORDER},
            "showlegend": True,
            "legend": {"x": 0.5, "y": -0.22, "xanchor": "center", "orientation": "h",
                       "bgcolor": _CARD, "bordercolor": _BORDER, "borderwidth": 1,
                       "font": {"size": 9}},
        },
    }


# ── Gradient 3D surfaces ───────────────────────────────────────────────────────

def _gradient_3d_aspect(result):
    """Real-world aspect ratios so X:Y:Z axes share the same grid unit size."""
    g   = result["grids"]
    ext = result["extents"]
    x_range = ext["x_max"] - ext["x_min"]
    y_range = ext["y_max"] - ext["y_min"]
    z1f = g["ZI1"][np.isfinite(g["ZI1"])]
    z2f = g["ZI2"][np.isfinite(g["ZI2"])]
    both = np.concatenate([a for a in [z1f, z2f] if len(a)])
    z_range = float(both.max() - both.min()) if len(both) else 1.0
    ref = max(x_range, y_range, 1.0)
    return {"x": x_range / ref, "y": y_range / ref,
            "z": max(0.05, min(z_range / ref, 1.0))}


def _grad3d_scene(ratio):
    return {
        "xaxis": {"gridcolor": _CARD, "backgroundcolor": _BG,
                  "showbackground": True, "gridwidth": 1, "title": "X"},
        "yaxis": {"gridcolor": _CARD, "backgroundcolor": _BG,
                  "showbackground": True, "gridwidth": 1, "title": "Y"},
        "zaxis": {"gridcolor": _CARD, "backgroundcolor": _BG,
                  "showbackground": True, "gridwidth": 1, "title": "Z"},
        "bgcolor": _BG,
        "camera": {"eye": {"x": 1.4, "y": 1.1, "z": 0.9}},
        "aspectmode": "manual",
        "aspectratio": ratio,
    }


def _grad3d_layout(title, ratio):
    return {
        "paper_bgcolor": _PANEL,
        "font": {"color": _TEXT},
        "autosize": True,
        "margin": {"t": 60, "b": 10, "l": 10, "r": 80},
        "title": {"text": title, "font": {"size": 12}},
        "scene": _grad3d_scene(ratio),
    }


def make_gradient_3d_cloud1_fig(result):
    g     = result["grids"]
    ratio = _gradient_3d_aspect(result)
    S     = max(1, g["ZI1"].shape[0] // 120)
    Xm = g["XI"][::S, ::S].tolist()
    Ym = g["YI"][::S, ::S].tolist()
    return {
        "data": [{"type": "surface", "x": Xm, "y": Ym,
                  "z": _arr(_ds(g["ZI1"], S)),
                  "colorscale": "Viridis", "showscale": True, "name": "Cloud 1",
                  "colorbar": {"thickness": 14,
                               "title": {"text": "Z", "side": "right"}}}],
        "layout": _grad3d_layout("Cloud 1 — Surface", ratio),
    }


def make_gradient_3d_cloud2_fig(result):
    g     = result["grids"]
    ratio = _gradient_3d_aspect(result)
    S     = max(1, g["ZI2"].shape[0] // 120)
    Xm = g["XI"][::S, ::S].tolist()
    Ym = g["YI"][::S, ::S].tolist()
    return {
        "data": [{"type": "surface", "x": Xm, "y": Ym,
                  "z": _arr(_ds(g["ZI2"], S)),
                  "colorscale": "Viridis", "showscale": True, "name": "Cloud 2",
                  "colorbar": {"thickness": 14,
                               "title": {"text": "Z", "side": "right"}}}],
        "layout": _grad3d_layout("Cloud 2 — Surface", ratio),
    }


def make_gradient_3d_error_fig(result):
    g     = result["grids"]
    ratio = _gradient_3d_aspect(result)
    S     = max(1, g["ZI2"].shape[0] // 120)
    Xm = g["XI"][::S, ::S].tolist()
    Ym = g["YI"][::S, ::S].tolist()
    return {
        "data": [{"type": "surface", "x": Xm, "y": Ym,
                  "z": _arr(_ds(g["ZI2"], S)),
                  "surfacecolor": _arr(_ds(g["error_map"], S)),
                  "colorscale": "Hot", "showscale": True, "name": "Error Map",
                  "colorbar": {"thickness": 14,
                               "title": {"text": "|∇Z|", "side": "right"}}}],
        "layout": _grad3d_layout("Gradient Magnitude Error — |∇Z|", ratio),
    }


# ── Gradient 2D maps ───────────────────────────────────────────────────────────

def make_gradient_maps_fig(result):
    g  = result["grids"]
    S  = 2

    xi = g["XI"][0, ::S].tolist()
    yi = g["YI"][::S, 0].tolist()
    z1 = _arr(_ds(g["ZI1"],  S))
    z2 = _arr(_ds(g["ZI2"],  S))
    df = _arr(_ds(g["diff"], S))

    vz  = float(np.nanpercentile(np.abs(np.concatenate(
          [g["ZI1"][~np.isnan(g["ZI1"])], g["ZI2"][~np.isnan(g["ZI2"])]])), 99))
    dv  = float(np.nanpercentile(np.abs(g["diff"][~np.isnan(g["diff"])]), 99)) if np.any(~np.isnan(g["diff"])) else 1.0

    layout = {
        "paper_bgcolor": _PANEL, "plot_bgcolor": _BG,
        "font": {"color": _TEXT, "family": "monospace, monospace"},
        "autosize": True,
        "margin": {"t": 70, "b": 55, "l": 60, "r": 60},
        "xaxis":  {"title": "X", "domain": [0.00, 0.28], "gridcolor": _CARD, "linecolor": _BORDER},
        "yaxis":  {"title": "Y", "gridcolor": _CARD, "linecolor": _BORDER},
        "xaxis2": {"title": "X", "domain": [0.37, 0.63], "gridcolor": _CARD,
                   "linecolor": _BORDER, "anchor": "y2"},
        "yaxis2": {"title": "Y", "gridcolor": _CARD, "linecolor": _BORDER},
        "xaxis3": {"title": "X", "domain": [0.72, 1.00], "gridcolor": _CARD,
                   "linecolor": _BORDER, "anchor": "y3"},
        "yaxis3": {"title": "Y", "gridcolor": _CARD, "linecolor": _BORDER},
        "annotations": [
            _ann("Cloud 1",          0.14, 1.06),
            _ann("Cloud 2",          0.50, 1.06),
            _ann("Difference C1−C2", 0.86, 1.06),
        ],
    }

    cb = lambda x: {"x": x, "thickness": 12, "len": 0.85,
                    "title": {"text": "Z", "side": "right"}}

    return {
        "data": [
            {"type": "heatmap", "x": xi, "y": yi, "z": z1, "colorscale": "Viridis",
             "zmin": -vz, "zmax": vz, "xaxis": "x",  "yaxis": "y",
             "showscale": True, "colorbar": cb(0.29), "name": "Cloud 1"},
            {"type": "heatmap", "x": xi, "y": yi, "z": z2, "colorscale": "Viridis",
             "zmin": -vz, "zmax": vz, "xaxis": "x2", "yaxis": "y2",
             "showscale": True, "colorbar": cb(0.64), "name": "Cloud 2"},
            {"type": "heatmap", "x": xi, "y": yi, "z": df, "colorscale": "RdBu",
             "zmin": -dv, "zmax": dv, "xaxis": "x3", "yaxis": "y3",
             "showscale": True,
             "colorbar": {"x": 1.01, "thickness": 12, "len": 0.85,
                          "title": {"text": "ΔZ", "side": "right"}},
             "name": "Diff"},
        ],
        "layout": layout,
    }


# ── Correlation summary ────────────────────────────────────────────────────────

def make_correlation_fig(result):
    m      = result["metrics"]
    labels = ["RQ (|∇Z|)", "RQ (∂y)", "RQ (∂x)", "RQ (Z)"]
    r_vals = [m["r_mag"], m["r_gy"], m["r_gx"], m["r_z"]]

    return {
        "data": [
            {"type": "bar",
             "orientation": "h",
             "y": labels, "x": r_vals,
             "marker": {"color": _BLUE, "line": {"color": _BORDER, "width": 1}},
             "name": "Pearson r"},
        ],
        "layout": {
            "paper_bgcolor": _PANEL, "plot_bgcolor": _BG,
            "font": {"color": _TEXT, "family": "monospace, monospace"},
            "autosize": True,
            "margin": {"t": 60, "b": 60, "l": 100, "r": 30},
            "title": {"text": "Gradient Correlation Summary", "font": {"size": 13}},
            "xaxis": {"title": "Pearson r", "range": [0, 1],
                      "gridcolor": _CARD, "linecolor": _BORDER},
            "yaxis": {"gridcolor": _CARD, "linecolor": _BORDER},
            "showlegend": False,
        },
    }


# ── JSON serialisation ─────────────────────────────────────────────────────────

def _safe(obj):
    if isinstance(obj, np.ndarray):
        return _arr(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return None if math.isnan(float(obj)) else float(obj)
    if isinstance(obj, dict):
        return {k: _safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def figures_to_json(data: dict) -> str:
    return json.dumps(_safe(data))
