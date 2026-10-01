"""
Plotly.js figure builders for MaRQ. Runs inside Pyodide (browser); every builder
returns a JSON-serialisable dict {data, layout}.

The numbers come from pvisual_core.run_pvisual and rq_gradient_core.run_rq_gradient;
this module only decides how they are drawn. Units: the analysis core works in the
units of the input file, which for profilometry exports is micrometres, and the
axes are labelled accordingly.
"""
import json
import math
import numpy as np
from scipy.ndimage import binary_erosion

# ── Theme and palette ──────────────────────────────────────────────────────────

_THEMES = {
    "dark":  dict(BG="#0D1117", PANEL="#161B22", CARD="#21262D", BORDER="#30363D",
                  TEXT="#C9D1D9", TEXT2="#8B949E", BLUE="#58A6FF", RED="#F85149",
                  GREEN="#3FB950", YELLOW="#D29922", PURPLE="#A371F7", MASK="#2BFF7A"),
    "light": dict(BG="#FFFFFF", PANEL="#FFFFFF", CARD="#EEF1F4", BORDER="#D0D7DE",
                  TEXT="#1F2328", TEXT2="#57606A", BLUE="#0969DA", RED="#CF222E",
                  GREEN="#1A7F37", YELLOW="#9A6700", PURPLE="#8250DF", MASK="#00A040"),
}
_T = dict(_THEMES["dark"])          # active theme colours
_CS = "Viridis"                     # height colour scale (palette selector)
EQUAL = True                        # 1:1 axis scales on the 2D plots: a µm on x is a µm on y

SLOPE_CS = "Inferno"                # slope-magnitude maps and the slope error E_d
DIFF_CS  = "RdBu"                   # signed height error E_Z
FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
U = "µm"

Z_DTICK_3D       = 100      # Z tick spacing in the single-surface 3D view
DEFAULT_3D_CELLS = 80_000   # 3D mesh budget when the interface passes none
MAP_FULL_CELLS   = 300_000  # 2D comparison maps are sent at full resolution up to this size


def set_theme(name):
    """Switch the colours used by every builder. Call before (re)building figures."""
    global _T
    _T = dict(_THEMES.get(str(name).lower(), _THEMES["dark"]))


def set_palette(name):
    """Colour scale of every height map (2D and 3D)."""
    global _CS
    _CS = str(name) if name else "Viridis"


def set_equal(flag):
    """1:1 axis scales on every 2D plot whose two axes are lengths."""
    global EQUAL
    EQUAL = bool(flag)


def _eq(xaxis, constrain=None):
    """Axis attributes that lock the y scale to the x scale when EQUAL is on."""
    if not EQUAL:
        return {}
    d = {"scaleanchor": xaxis, "scaleratio": 1}
    if constrain:
        d["constrain"] = constrain
    return d


def C(key):
    return _T[key]


# ── Serialisation helpers ──────────────────────────────────────────────────────

def _v(x):
    """Scalar: nan -> None, numpy scalar -> Python scalar."""
    if isinstance(x, float) and math.isnan(x):
        return None
    if isinstance(x, (np.floating, np.integer)):
        v = x.item()
        return None if (isinstance(v, float) and math.isnan(v)) else v
    return x


def _arr(a, nd=None):
    """1-D or 2-D array -> nested list with nan -> None (vectorised), optionally rounded."""
    if a is None:
        return None
    a = np.asarray(a, dtype=float)
    if nd is not None:
        a = np.round(a, nd)
    obj = a.astype(object)
    obj[np.isnan(a)] = None
    return obj.tolist()


def _step(shape, max_cells):
    """Isotropic downsampling step that keeps a 2D grid within max_cells."""
    n = int(shape[0]) * int(shape[1])
    if not max_cells or n <= max_cells:
        return 1
    return int(math.ceil(math.sqrt(n / float(max_cells))))


def _rgba(hex_colour, alpha):
    h = hex_colour.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


# ── Layout helpers ─────────────────────────────────────────────────────────────

def _font(size=12, color=None):
    return {"family": FONT, "size": size, "color": color or C("TEXT")}


def _axis(title=None, **kw):
    d = {"gridcolor": C("CARD"), "linecolor": C("BORDER"), "zerolinecolor": C("BORDER"),
         "tickfont": {"size": 11}}
    if title:
        d["title"] = {"text": title, "font": {"size": 12}}
    d.update(kw)
    return d


def _base(**kw):
    layout = {
        "paper_bgcolor": C("PANEL"),
        "plot_bgcolor":  C("BG"),
        "font":          _font(12),
        "autosize":      True,
        "margin":        {"t": 60, "b": 55, "l": 65, "r": 30},
        "hoverlabel":    {"font": {"family": FONT, "size": 12}},
    }
    layout.update(kw)
    return layout


def _title(text, size=13):
    return {"text": text, "font": {"size": size}, "x": 0.5, "xanchor": "center"}


def _legend_bottom(y=None):
    """Horizontal legend anchored to the bottom edge of the figure (container units),
    so it never drifts into the axis title when the window is short."""
    return {"x": 0.5, "xanchor": "center", "orientation": "h",
            "yref": "container", "y": 0.012, "yanchor": "bottom",
            "bgcolor": C("CARD"), "bordercolor": C("BORDER"), "borderwidth": 1,
            "font": {"size": 11}}


def _cbar(text, **kw):
    """Colourbar with a right-hand title `text`; any key in kw (including a full
    `title` dict) overrides the defaults."""
    d = {"thickness": 12, "len": 0.85, "outlinewidth": 0,
         "title": {"text": text, "side": "right", "font": {"size": 11}},
         "tickfont": {"size": 10}}
    d.update(kw)
    return d


def _ann(text, x, y, xref="paper", yref="paper", size=11, color=None, **kw):
    d = {"text": text, "x": x, "y": y, "xref": xref, "yref": yref, "showarrow": False,
         "font": {"size": size, "color": color or C("TEXT2")}}
    d.update(kw)
    return d


def _panel_title(text, xaxis, yaxis, size=12):
    """Subplot title anchored to the subplot's own domain (cannot collide with a neighbour)."""
    return _ann(text, 0.5, 1.0, xref=xaxis + " domain", yref=yaxis + " domain",
                size=size, color=C("TEXT"), xanchor="center", yanchor="bottom", yshift=6)


def _heatmap(x, y, z, cs, name, cbar=None, nd=2, **kw):
    d = {"type": "heatmap", "x": x, "y": y, "z": _arr(z, nd), "colorscale": cs,
         "name": name, "hoverongaps": False,
         "hovertemplate": "x %{x:.0f}<br>y %{y:.0f}<br>%{z:.2f}<extra>" + name + "</extra>",
         "showscale": cbar is not None}
    if cbar is not None:
        d["colorbar"] = cbar
    d.update(kw)
    return d


# ── 3D helpers ─────────────────────────────────────────────────────────────────

def _aspect3d(x_range, y_range, z_range):
    """True proportions: the same micrometres per scene unit on X, Y and Z (no Z
    exaggeration); the longest lateral axis is 1. The second value is kept for
    the titles and is always 1."""
    ref = max(float(x_range), float(y_range), 1e-9)
    return {"x": float(x_range) / ref, "y": float(y_range) / ref,
            "z": max(float(z_range), 1e-9) / ref}, 1


def _camera(aspect):
    """Oblique view from the side of the long axis, far enough to show the whole box."""
    # The box spans ±aspect/2 about the origin; an eye about one unit away fills a
    # wide panel with a long thin channel without noticeable perspective distortion.
    if aspect["x"] >= aspect["y"]:
        eye = {"x": 0.38, "y": -0.92, "z": 0.48}
    else:
        eye = {"x": 0.92, "y": -0.38, "z": 0.48}
    return {"eye": eye, "up": {"x": 0, "y": 0, "z": 1}, "center": {"x": 0, "y": 0, "z": -0.02}}


def _scene(aspect, xt, yt, zt, zdtick=None):
    def ax(t):
        return {"title": {"text": t, "font": {"size": 11}}, "gridcolor": C("CARD"),
                "backgroundcolor": C("BG"), "showbackground": True, "gridwidth": 1,
                "tickfont": {"size": 10}}
    zax = ax(zt)
    if zdtick:
        zax["dtick"] = zdtick
    return {"xaxis": ax(xt), "yaxis": ax(yt), "zaxis": zax, "bgcolor": C("BG"),
            "camera": _camera(aspect), "aspectmode": "manual", "aspectratio": aspect}


_LIGHTING = {"ambient": 0.6, "diffuse": 0.8, "roughness": 0.5, "specular": 0.1, "fresnel": 0.2}


def _layout3d(title, scene):
    return {"paper_bgcolor": C("PANEL"), "font": _font(12), "autosize": True,
            "margin": {"t": 60, "b": 10, "l": 10, "r": 90},
            "title": _title(title, 12), "scene": scene}


# ── Rotation maps ──────────────────────────────────────────────────────────────

def make_rotation_fig(result):
    bg  = result["grids"]["before"]
    ag  = result["grids"]["after"]
    rot = result["rotation"]

    xd, yd = np.asarray(bg["xd"], float), np.asarray(bg["yd"], float)
    ca   = rot["channel_axis"]
    cx_, cy_ = float(xd.mean()), float(yd.mean())
    alen = float(min(np.ptp(xd), np.ptp(yd)) * 0.22)

    after_txt = "After: field levelled, channel along X"
    if rot.get("converted"):
        after_txt += ", protrusion rotated to a depression"

    layout = _base(margin={"t": 80, "b": 55, "l": 65, "r": 80})
    layout.update({
        "title": _title(f"Levelling and alignment  |  φ = {rot['phi']:.2f}°   "
                        f"residual tilt XZ {rot['xz_tilt']:.2f}°  YZ {rot['yz_tilt']:.2f}°   "
                        f"axis variance {rot['var_pct']:.1f} %"),
        "xaxis":  _axis(f"X ({U})", domain=[0.0, 0.40]),
        "yaxis":  _axis(f"Y ({U})", scaleanchor="x"),
        "xaxis2": _axis(f"X, channel axis ({U})", domain=[0.60, 1.0], anchor="y2"),
        "yaxis2": _axis(f"Y, cross-channel ({U})", scaleanchor="x2", anchor="x2"),
        "annotations": [
            _panel_title("Before: raw scan", "x", "y"),
            _panel_title(after_txt, "x2", "y2"),
            {"x": cx_ + alen * ca[0], "y": cy_ + alen * ca[1], "ax": cx_, "ay": cy_,
             "xref": "x", "yref": "y", "axref": "x", "ayref": "y",
             "showarrow": True, "arrowhead": 3, "arrowsize": 1.2,
             "arrowcolor": C("RED"), "arrowwidth": 2.5,
             "text": "channel axis", "font": {"color": C("RED"), "size": 10}},
        ],
    })

    return {
        "data": [
            _heatmap(bg["XI"][0].tolist(), bg["YI"][:, 0].tolist(), bg["ZI"], _CS, "before",
                     cbar=_cbar(f"Z ({U})", x=0.415, xanchor="left", tickfont={"size": 9},
                                title={"text": f"Z ({U})", "side": "top", "font": {"size": 10}}),
                     xaxis="x", yaxis="y"),
            _heatmap(ag["XI"][0].tolist(), ag["YI"][:, 0].tolist(), ag["ZI"], _CS, "after",
                     cbar=_cbar(f"Z ({U})", x=1.01, xanchor="left"), xaxis="x2", yaxis="y2"),
        ],
        "layout": layout,
    }


# ── Channel detection ──────────────────────────────────────────────────────────

def make_channel_fig(result):
    ag  = result["grids"]["after"]
    sl  = result["slices"]
    ch  = result["channel"]

    rx = np.asarray(sl["rx"], float); cy = np.asarray(sl["cy"], float)
    cy_s = np.asarray(sl["cy_std"], float); wx = np.asarray(sl["width_x"], float)
    ry = np.asarray(sl["ry"], float); cx = np.asarray(sl["cx"], float)
    cx_s = np.asarray(sl["cx_std"], float); ly = np.asarray(sl["length_y"], float)
    box = sl["crop_box"]

    def two_lines(px1, py1, px2, py2):
        """Two polylines in one trace, separated by a None break."""
        return (list(px1) + [None] + list(px2), list(py1) + [None] + list(py2))

    wx_x, wx_y = two_lines(rx, cy - wx / 2, rx, cy + wx / 2)
    ly_x, ly_y = two_lines(cx - ly / 2, ry, cx + ly / 2, ry)
    box_px = [box["x_min"], box["x_max"], box["x_max"], box["x_min"], box["x_min"]]
    box_py = [box["y_min"], box["y_min"], box["y_max"], box["y_max"], box["y_min"]]
    edge_col = _rgba(C("TEXT"), 0.65)
    fpct = int(round(ch.get("floor_width_frac", 0.9) * 100))

    layout = _base(margin={"t": 60, "b": 120, "l": 65, "r": 80}, showlegend=True,
                   legend=_legend_bottom())
    layout["title"] = _title("Channel detection on the aligned surface  |  "
                             f"floor edges on the grid lines at {fpct} % of depth, crop box for export")
    layout["xaxis"] = _axis(f"X, channel axis ({U})")
    layout["yaxis"] = _axis(f"Y, cross-channel ({U})", scaleanchor="x")

    data = [
        _heatmap(ag["XI"][0].tolist(), ag["YI"][:, 0].tolist(), ag["ZI"], _CS, "height",
                 cbar=_cbar(f"Z ({U})", x=1.01, xanchor="left"), showlegend=False),
        {"type": "scatter", "x": (list(rx) + list(rx[::-1])),
         "y": (list(cy + 2 * cy_s) + list((cy - 2 * cy_s)[::-1])),
         "fill": "toself", "fillcolor": _rgba(C("RED"), 0.18), "line": {"width": 0},
         "hoverinfo": "skip", "showlegend": False, "name": "centre Y ±2 SD"},
        {"type": "scatter", "x": rx.tolist(), "y": cy.tolist(), "mode": "lines",
         "line": {"color": C("RED"), "width": 2}, "name": "Centre Y per grid line across the channel"},
        {"type": "scatter", "x": wx_x, "y": wx_y, "mode": "lines",
         "line": {"color": edge_col, "width": 1.5, "dash": "dash"},
         "name": "Floor width edges"},
        {"type": "scatter", "x": (list(cx + 2 * cx_s) + list((cx - 2 * cx_s)[::-1])),
         "y": (list(ry) + list(ry[::-1])),
         "fill": "toself", "fillcolor": _rgba(C("BLUE"), 0.18), "line": {"width": 0},
         "hoverinfo": "skip", "showlegend": False, "name": "centre X ±2 SD"},
        {"type": "scatter", "x": cx.tolist(), "y": ry.tolist(), "mode": "lines",
         "line": {"color": C("BLUE"), "width": 2}, "name": "Centre X per grid line along the channel"},
        {"type": "scatter", "x": ly_x, "y": ly_y, "mode": "lines",
         "line": {"color": edge_col, "width": 1.5, "dash": "dot"},
         "name": "Floor length edges"},
        {"type": "scatter", "x": box_px, "y": box_py, "mode": "lines",
         "line": {"color": C("YELLOW"), "width": 2}, "name": "Crop box (exported channel)"},
    ]
    return {"data": data, "layout": layout}


# ── Profile plots ──────────────────────────────────────────────────────────────

def _band(x, lo, hi, colour, name):
    return {"type": "scatter", "x": list(x) + list(x[::-1]), "y": list(hi) + list(lo[::-1]),
            "fill": "toself", "fillcolor": _rgba(colour, 0.18), "line": {"width": 0},
            "hoverinfo": "skip", "showlegend": False, "name": name}


def make_profile_ycenter_fig(result):
    sl, ch = result["slices"], result["channel"]
    rx = np.asarray(sl["rx"], float); cy = np.asarray(sl["cy"], float)
    cy_s = np.asarray(sl["cy_std"], float)
    cY, cY_c = ch["center_y"], ch["center_y_conf"]

    layout = _base(showlegend=True, legend=_legend_bottom(), margin={"t": 60, "b": 100, "l": 70, "r": 30})
    layout["title"] = _title(f"Channel centre line  |  mean Y = {cY:.2f} {U}, "
                             f"SD over the central 80 % of the grid lines {cY_c:.2f} {U}")
    layout["xaxis"] = _axis(f"X, position along the channel ({U})")
    layout["yaxis"] = _axis(f"Centre Y ({U})", **_eq("x"))
    return {
        "data": [
            {"type": "scatter", "x": rx.tolist(), "y": cy.tolist(), "mode": "lines",
             "line": {"color": C("BLUE"), "width": 2}, "name": "Centre Y per grid line across the channel"},
            {"type": "scatter", "x": [float(rx[0]), float(rx[-1])], "y": [cY, cY], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dash"}, "name": f"Mean {cY:.2f} {U}"},
        ],
        "layout": layout,
    }


def make_profile_xcenter_fig(result):
    sl, ch = result["slices"], result["channel"]
    ry = np.asarray(sl["ry"], float); cx = np.asarray(sl["cx"], float)
    cx_s = np.asarray(sl["cx_std"], float)
    cX, cX_c = ch["center_x"], ch["center_x_conf"]

    layout = _base(showlegend=True, legend=_legend_bottom(), margin={"t": 60, "b": 100, "l": 70, "r": 30})
    layout["title"] = _title(f"Longitudinal centre per grid line along the channel  |  mean X = {cX:.2f} {U}, "
                             f"SD {cX_c:.2f} {U}")
    layout["xaxis"] = _axis(f"Y, position across the channel ({U})")
    layout["yaxis"] = _axis(f"Centre X ({U})", **_eq("x"))
    return {
        "data": [
            {"type": "scatter", "x": ry.tolist(), "y": cx.tolist(), "mode": "lines",
             "line": {"color": C("GREEN"), "width": 2}, "name": "Centre X per grid line along the channel"},
            {"type": "scatter", "x": [float(ry[0]), float(ry[-1])], "y": [cX, cX], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dash"}, "name": f"Mean {cX:.2f} {U}"},
        ],
        "layout": layout,
    }


def make_profile_widthlength_fig(result):
    sl, ch = result["slices"], result["channel"]
    rx = np.asarray(sl["rx"], float); wx = np.asarray(sl["width_x"], float)
    wx_s = np.asarray(sl["width_x_std"], float)
    ry = np.asarray(sl["ry"], float); ly = np.asarray(sl["length_y"], float)
    ly_s = np.asarray(sl["length_y_std"], float)
    mW, mW_c = ch["mean_width"], ch["mean_width_conf"]
    mL, mL_c = ch["mean_length"], ch["mean_length_conf"]
    fpct = int(round(ch.get("floor_width_frac", 0.9) * 100))

    layout = _base(showlegend=True, legend=_legend_bottom(),
                   margin={"t": 60, "b": 115, "l": 70, "r": 30})
    layout["title"] = _title(f"Floor width and length per grid line at {fpct} % of depth  |  "
                             f"W = {mW:.1f} ± {mW_c:.1f} {U}   L = {mL:.1f} ± {mL_c:.1f} {U} (median ± SD of the lines)")
    layout["xaxis"]  = _axis(f"X, position along the channel ({U})", anchor="y")
    layout["yaxis"]  = _axis(f"Floor width ({U})", domain=[0.6, 1.0], **_eq("x"))
    layout["xaxis2"] = _axis(f"Y, position across the channel ({U})", anchor="y2")
    layout["yaxis2"] = _axis(f"Floor length ({U})" + (" (free scale)" if EQUAL else ""),
                             domain=[0.0, 0.4], anchor="x2")
    return {
        "data": [
            _band(rx, wx - wx_s, wx + wx_s, C("YELLOW"), "width ±1 SD over 11 lines"),
            {"type": "scatter", "x": rx.tolist(), "y": wx.tolist(), "mode": "lines",
             "line": {"color": C("YELLOW"), "width": 2}, "name": "Floor width per grid line across the channel"},
            {"type": "scatter", "x": [float(rx[0]), float(rx[-1])], "y": [mW, mW], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dash"}, "name": f"Floor width, median of the lines {mW:.1f} {U}"},
            {**_band(ry, ly - ly_s, ly + ly_s, C("PURPLE"), "length ±1 SD over 11 lines"), "xaxis": "x2", "yaxis": "y2"},
            {"type": "scatter", "x": ry.tolist(), "y": ly.tolist(), "mode": "lines",
             "line": {"color": C("PURPLE"), "width": 2}, "name": "Floor length per grid line along the channel",
             "xaxis": "x2", "yaxis": "y2"},
            {"type": "scatter", "x": [float(ry[0]), float(ry[-1])], "y": [mL, mL], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dot"}, "name": f"Floor length, median of the lines {mL:.1f} {U}",
             "xaxis": "x2", "yaxis": "y2"},
        ],
        "layout": layout,
    }


# ── Mean cross-section and per-slice depth ─────────────────────────────────────

def make_cross_section_fig(result):
    """Top: the mean cross-section on which the depth is measured, with the field,
    floor level, floor-width level and opening level, the median wall positions of
    the grid lines at the two width levels, and the mid-wall lines of the wall angle.
    Bottom: the local depth of every longitudinal slice against the mean depth."""
    pr, ch, sl = result["profile"], result["channel"], result["slices"]
    yc, zb = np.asarray(pr["yc"], float), np.asarray(pr["zb"], float)
    depth = float(ch["mean_depth"]) if ch["mean_depth"] is not None else float("nan")
    fl, ft, ot = pr["floor_level"], pr["floor_threshold"], pr["open_threshold"]
    fe = (pr["floor_edge_left"], pr["floor_edge_right"])
    oe = (pr["open_edge_left"], pr["open_edge_right"])
    fpct = int(round(-ft / depth * 100)) if depth and np.isfinite(ft) else 90
    opct = int(round(-ot / depth * 100)) if depth and np.isfinite(ot) else 10

    # focus on the channel: opening width plus some field on each side
    if all(np.isfinite(v) for v in oe):
        half = (oe[1] - oe[0]) / 2; cen = (oe[0] + oe[1]) / 2
        xr = [max(float(yc.min()), cen - 1.7 * half), min(float(yc.max()), cen + 1.7 * half)]
    else:
        xr = [float(yc.min()), float(yc.max())]
    x0, x1 = float(yc.min()), float(yc.max())

    pos = np.asarray(sl["depth_pos"], float); dep = np.asarray(sl["depth_x"], float)
    valid = np.asarray(sl["depth_valid"], bool)
    dsd = ch.get("channel_depth_slice_std_central80")
    dsd_txt = f", SD over the central 80 % of slices {dsd:.2f} {U}" if dsd is not None and np.isfinite(dsd) else ""

    def hline(y, colour, dash, name, x_from=x0, x_to=x1):
        return {"type": "scatter", "x": [x_from, x_to], "y": [y, y], "mode": "lines",
                "line": {"color": colour, "width": 1.3, "dash": dash}, "name": name, "hoverinfo": "name"}

    data = [
        {"type": "scatter", "x": yc.tolist(), "y": zb.tolist(), "mode": "lines",
         "line": {"color": C("BLUE"), "width": 2.2}, "name": "Mean cross-section", "showlegend": False,
         "hovertemplate": "y %{x:.1f}<br>z %{y:.2f}<extra></extra>"},
        {**hline(0.0, C("TEXT2"), "dot", "Field, z = 0"), "showlegend": False},
        {**hline(fl, C("GREEN"), "dash", f"Floor level {fl:.1f} {U}"), "showlegend": False},
        {**hline(ft, C("YELLOW"), "dot", f"Floor-width level ({fpct} % of depth)"), "showlegend": False},
        {**hline(ot, C("PURPLE"), "dot", f"Opening level ({opct} % of depth)"), "showlegend": False},
    ]
    if all(np.isfinite(v) for v in fe):
        data.append({"type": "scatter", "x": list(fe), "y": [ft, ft], "mode": "markers",
                     "marker": {"color": C("YELLOW"), "size": 9, "symbol": "diamond"},
                     "name": f"Floor width {ch['floor_width']:.1f} {U} ({fpct} % of depth)", "hoverinfo": "name+x"})
    if all(np.isfinite(v) for v in oe):
        data.append({"type": "scatter", "x": list(oe), "y": [ot, ot], "mode": "markers",
                     "marker": {"color": C("PURPLE"), "size": 9, "symbol": "diamond"},
                     "name": f"Opening width {ch['opening_width']:.1f} {U} ({opct} % of depth)", "hoverinfo": "name+x"})
    fr, wl, wr, band = pr.get("wall_fractions"), pr.get("wall_left"), pr.get("wall_right"), pr.get("wall_band")
    if fr and band and depth and np.isfinite(depth):
        # mid-wall line of each wall: fitted through the median wall positions of the
        # band levels, drawn from the floor-width level to the opening level
        zs = np.array([-f * depth for f in fr]); inb = np.isin(np.round(fr, 6), np.round(band, 6))
        lx, ly_ = [], []
        for W_ in (np.asarray(wl, float), np.asarray(wr, float)):
            ok = inb & np.isfinite(W_)
            if ok.sum() >= 3:
                b_, a_ = np.polyfit(zs[ok], W_[ok], 1)
                lx += [a_ + b_ * ft, a_ + b_ * ot, None]; ly_ += [ft, ot, None]
        if lx:
            wa = ch.get("wall_angle_deg")
            data.append({"type": "scatter", "x": lx, "y": ly_, "mode": "lines",
                         "line": {"color": C("RED"), "width": 1.4, "dash": "dash"},
                         "name": f"Mid-wall lines (25–75 % of depth), wall angle {wa:.1f}°"
                                 if wa is not None and np.isfinite(wa) else "Mid-wall lines (25–75 % of depth)",
                         "hoverinfo": "name"})
    if valid.any():
        data.append({"type": "scatter", "x": pos[valid].tolist(), "y": dep[valid].tolist(),
                     "mode": "lines+markers", "marker": {"size": 4}, "line": {"color": C("GREEN"), "width": 1.6},
                     "name": "Local depth per slice"
                             + (f" (SD, central 80 %: {dsd:.2f} {U})" if dsd is not None and np.isfinite(dsd) else ""),
                     "xaxis": "x2", "yaxis": "y2",
                     "hovertemplate": "x %{x:.0f}<br>depth %{y:.2f}<extra></extra>"})
        data.append({"type": "scatter", "x": [float(pos.min()), float(pos.max())], "y": [depth, depth],
                     "mode": "lines", "line": {"color": C("RED"), "width": 1.2, "dash": "dash"},
                     "name": f"Mean depth {depth:.1f} {U}", "xaxis": "x2", "yaxis": "y2", "hoverinfo": "name",
                     "showlegend": False})
    if (~valid).any():
        data.append({"type": "scatter", "x": pos[~valid].tolist(), "y": [depth] * int((~valid).sum()),
                     "mode": "markers", "marker": {"symbol": "x", "size": 6, "color": C("TEXT2")},
                     "name": "Slice without a valid floor", "xaxis": "x2", "yaxis": "y2", "hoverinfo": "x+name",
                     "showlegend": False})

    wall = ch.get("wall_angle_deg", ch.get("draft_angle_deg"))
    layout = _base(showlegend=True, legend={**_legend_bottom(), "font": {"size": 10}},
                   margin={"t": 60, "b": 140, "l": 70, "r": 30})
    layout["title"] = _title(f"Mean cross-section and local depth  |  floor width {ch['floor_width']:.1f} {U}, "
                             f"opening {ch['opening_width']:.1f} {U}, depth {depth:.1f} {U}"
                             + (f", wall angle {wall:.1f}°" if wall is not None and np.isfinite(wall) else ""))
    layout["xaxis"]  = _axis(f"Y, across the channel ({U})", range=xr, anchor="y")
    layout["yaxis"]  = _axis(f"Z ({U})", domain=[0.58, 1.0], **_eq("x"))
    layout["xaxis2"] = _axis(f"X, along the channel ({U})", anchor="y2")
    layout["yaxis2"] = _axis(f"Local depth ({U})", domain=[0.0, 0.36], anchor="x2", **_eq("x2"))
    return {"data": data, "layout": layout}


# ── 3D channel view ────────────────────────────────────────────────────────────

def make_3d_fig(result, max_cells=None, colorscale=None):
    crop = result["grids"]["crop"]
    ch   = result["channel"]
    ZI   = np.asarray(crop["ZI"], float)
    S    = _step(ZI.shape, max_cells or DEFAULT_3D_CELLS)
    cs   = colorscale or _CS

    x_range = float(crop["x_max"] - crop["x_min"])
    y_range = float(crop["y_max"] - crop["y_min"])
    zf = ZI[np.isfinite(ZI)]
    z_range = float(zf.max() - zf.min()) if zf.size else 1.0
    aspect, zex = _aspect3d(x_range, y_range, z_range)

    xi_c = np.linspace(crop["x_min"], crop["x_max"], ZI.shape[1])[::S]
    yi_c = np.linspace(crop["y_min"], crop["y_max"], ZI.shape[0])[::S]

    title = (f"Cropped channel  |  floor width {ch['mean_width']:.1f} {U}   "
             f"length {ch['mean_length']:.1f} {U}   depth {ch['mean_depth']:.1f} {U}")
    if zex > 1:
        title += f"   (Z exaggerated ×{zex})"

    return {
        "data": [
            {"type": "surface", "x": xi_c.tolist(), "y": yi_c.tolist(),
             "z": _arr(ZI[::S, ::S], 2), "colorscale": cs, "showscale": True,
             "lighting": _LIGHTING, "name": "channel",
             "hovertemplate": "x %{x:.0f}<br>y %{y:.0f}<br>z %{z:.1f}<extra></extra>",
             "colorbar": _cbar(f"Z ({U})", thickness=14)},
        ],
        "layout": _layout3d(title, _scene(aspect, f"X, channel axis ({U})",
                                          f"Y, cross-channel ({U})", f"Z ({U})",
                                          zdtick=Z_DTICK_3D)),
    }


# ── Roughness evaluation areas ────────────────────────────────────────────────

def make_roughness_fig(result):
    rgh  = result["roughness"]
    vg   = rgh["vis_grid"]
    ZI   = np.asarray(vg["ZI"], float)
    xi_c = np.linspace(float(vg["x_min"]), float(vg["x_max"]), ZI.shape[1])
    yi_c = np.linspace(float(vg["y_min"]), float(vg["y_max"]), ZI.shape[0])

    def _legend(r, name):
        if r is None:
            return f"{name}: no data"
        return f"{name}   Sa {r['Sa']:.2f}   Sq {r['Sq']:.2f}   Sz {r['Sz']:.1f} {U}"

    def _hover(r, name):
        if r is None:
            return f"<b>{name}</b><br>No data<extra></extra>"
        return (f"<b>{name}</b><br>Sa = {r['Sa']:.3f} {U}<br>Sq = {r['Sq']:.3f} {U}<br>"
                f"Sz = {r['Sz']:.2f} {U}<br>Ssk = {r['Ssk']:.3f}<br>Sku = {r['Sku']:.3f}<br>"
                f"n = {r['n_pts']:,}<extra></extra>")

    def _rect(reg, colour, name, entry):
        rx = [reg["x_min"], reg["x_max"], reg["x_max"], reg["x_min"], reg["x_min"]]
        ry = [reg["y_min"], reg["y_min"], reg["y_max"], reg["y_max"], reg["y_min"]]
        return {"type": "scatter", "x": rx, "y": ry, "mode": "lines", "fill": "toself",
                "fillcolor": _rgba(colour, 0.2), "line": {"color": colour, "width": 2},
                "name": _legend(entry, name), "hovertemplate": _hover(entry, name)}

    data = [
        _heatmap(xi_c.tolist(), yi_c.tolist(), ZI, _CS, "height",
                 cbar=_cbar(f"Z ({U})", x=1.01, xanchor="left"), showlegend=False),
        _rect(rgh["regions"]["floor"],      C("GREEN"), "Floor",       rgh["floor"]),
        _rect(rgh["regions"]["surf_left"],  C("BLUE"),  "Field left",  rgh["surf_left"]),
        _rect(rgh["regions"]["surf_right"], C("RED"),   "Field right", rgh["surf_right"]),
    ]
    layout = _base(margin={"t": 60, "b": 125, "l": 65, "r": 80}, showlegend=True,
                   legend={**_legend_bottom(), "font": {"size": 10}})
    layout["title"] = _title("Roughness evaluation areas (ISO 25178, plane-removed)")
    layout["xaxis"] = _axis(f"X, channel axis ({U})")
    layout["yaxis"] = _axis(f"Y, cross-channel ({U})", scaleanchor="x")
    return {"data": data, "layout": layout}


# ── Paired comparison: 3D surfaces ─────────────────────────────────────────────

def _surface_fig(result, which, max_cells=None):
    g   = result["grids"]
    ext = result["extents"]
    m   = result["metrics"]
    ZA, ZB = np.asarray(g["ZI1"], float), np.asarray(g["ZI2"], float)
    zf = np.concatenate([ZA[np.isfinite(ZA)], ZB[np.isfinite(ZB)]])
    z_range = float(zf.max() - zf.min()) if zf.size else 1.0
    aspect, zex = _aspect3d(ext["x_max"] - ext["x_min"], ext["y_max"] - ext["y_min"], z_range)
    S = _step(ZA.shape, max_cells or DEFAULT_3D_CELLS)
    x = g["XI"][0, ::S].tolist(); y = g["YI"][::S, 0].tolist()
    exag = f"   (Z exaggerated ×{zex})" if zex > 1 else ""

    if which == "A":
        trace = {"z": _arr(ZA[::S, ::S], 2), "colorscale": _CS, "name": "surface A",
                 "colorbar": _cbar(f"Z ({U})", thickness=14)}
        title = "Surface A, the reference: height" + exag
    elif which == "B":
        trace = {"z": _arr(ZB[::S, ::S], 2), "colorscale": _CS, "name": "surface B",
                 "colorbar": _cbar(f"Z ({U})", thickness=14)}
        title = ("Surface B, the compared surface: height" +
                 (", rotated 180° about Z to match A" if m.get("z_flip") else "") + exag)
    else:
        ED = np.asarray(g["error_map"], float)
        ed_hi = float(np.nanpercentile(ED, 99)) if np.isfinite(ED).any() else 1.0
        trace = {"z": _arr(ZB[::S, ::S], 2), "surfacecolor": _arr(ED[::S, ::S], 4),
                 "colorscale": SLOPE_CS, "cmin": 0, "cmax": ed_hi, "name": "E_d",
                 "colorbar": _cbar("E_d (µm/µm)", thickness=14)}
        title = "Slope-magnitude error E_d = | |∇Z_B| − |∇Z_A| | drawn on surface B" + exag

    trace.update({"type": "surface", "x": x, "y": y, "showscale": True, "lighting": _LIGHTING,
                  "hovertemplate": "x %{x:.0f}<br>y %{y:.0f}<br>z %{z:.1f}<extra></extra>"})
    return {"data": [trace],
            "layout": _layout3d(title, _scene(aspect, f"X ({U})", f"Y ({U})", f"Z ({U})"))}


def make_gradient_3d_cloud1_fig(result, max_cells=None):
    return _surface_fig(result, "A", max_cells)


def make_gradient_3d_cloud2_fig(result, max_cells=None):
    return _surface_fig(result, "B", max_cells)


def make_gradient_3d_error_fig(result, max_cells=None):
    return _surface_fig(result, "E", max_cells)


# ── Paired comparison: 2D height and slope maps ────────────────────────────────

def _mask_outline(g, mask, max_pts=3000):
    """Boundary cells of the channel-interior mask as (x, y) lists, thinned."""
    if mask.sum() == 0:
        return [], []
    b = mask & ~binary_erosion(mask, iterations=1, border_value=0)
    by, bx = np.nonzero(b)
    keep = max(1, len(bx) // max_pts)
    XI, YI = np.asarray(g["XI"]), np.asarray(g["YI"])
    return XI[by[::keep], bx[::keep]].tolist(), YI[by[::keep], bx[::keep]].tolist()


def make_gradient_maps_fig(result):
    g = result["grids"]
    ZA, ZB = np.asarray(g["ZI1"], float), np.asarray(g["ZI2"], float)
    GA, GB = np.asarray(g["mag1"], float), np.asarray(g["mag2"], float)
    EZ, ED = np.asarray(g["diff"], float), np.asarray(g["error_map"], float)
    mask = np.asarray(g.get("mask", g["valid"]), bool)

    S  = _step(ZA.shape, MAP_FULL_CELLS)
    xi = g["XI"][0, ::S].tolist(); yi = g["YI"][::S, 0].tolist()

    zall = np.concatenate([ZA[np.isfinite(ZA)], ZB[np.isfinite(ZB)]])
    z0, z1 = (float(np.percentile(zall, 0.5)), float(np.percentile(zall, 99.5))) if zall.size else (0.0, 1.0)
    gall = np.concatenate([GA[np.isfinite(GA)], GB[np.isfinite(GB)]])
    g1 = float(np.percentile(gall, 99.5)) if gall.size else 1.0
    ez = float(np.nanpercentile(np.abs(EZ), 99)) if np.isfinite(EZ).any() else 1.0
    ed = float(np.nanpercentile(ED, 99)) if np.isfinite(ED).any() else 1.0
    mx, my = _mask_outline(g, mask)

    x_range = float(g["XI"][0, -1] - g["XI"][0, 0]); y_range = float(g["YI"][-1, 0] - g["YI"][0, 0])
    stacked = EQUAL and (x_range / max(y_range, 1e-9) > 2.5)      # long channel at true scale: one map per row
    small = {"xanchor": "left", "thickness": 10, "tickfont": {"size": 9}}
    #        z    colourscale  zmin  zmax  name       decimals
    P = {"ZA": (ZA, _CS,      z0,   z1,   "Z_A",     1),
         "ZB": (ZB, _CS,      z0,   z1,   "Z_B",     1),
         "EZ": (EZ, DIFF_CS,  -ez,  ez,   "E_Z",     1),
         "GA": (GA, SLOPE_CS, 0.0,  g1,   "|∇Z_A|",  3),
         "GB": (GB, SLOPE_CS, 0.0,  g1,   "|∇Z_B|",  3),
         "ED": (ED, SLOPE_CS, 0.0,  ed,   "E_d",     3)}
    if stacked:
        order = ["ZA", "ZB", "EZ", "GA", "GB", "ED"]
        gap = 0.028; h = (1 - 5 * gap) / 6
        rows = {i: [1 - (i - 1) * (h + gap) - h, 1 - (i - 1) * (h + gap)] for i in range(1, 7)}
        pos  = {key: (i, 1) for i, key in enumerate(order, 1)}
        cols = {1: [0.0, 0.93]}
        def span(r0, r1):
            top, bot = rows[r0][1], rows[r1][0]
            return {"y": (top + bot) / 2, "len": top - bot}
        cb = {"ZA": _cbar(f"Z ({U})",     x=0.945, nticks=4, **span(1, 2), **small),
              "EZ": _cbar(f"E_Z ({U})",   x=0.945, nticks=3, **span(3, 3), **small),
              "GA": _cbar("|∇Z| (µm/µm)", x=0.945, nticks=4, **span(4, 5), **small),
              "ED": _cbar("E_d (µm/µm)",  x=0.945, nticks=3, **span(6, 6), **small)}
        ylabel  = {key: P[key][4] for key in order}
        headers = []
        title_note = "  |  1:1"
    else:
        order = ["ZA", "GA", "ZB", "GB", "EZ", "ED"]
        cols = {1: [0.0, 0.42], 2: [0.57, 0.99]}
        rows = {1: [0.70, 1.0], 2: [0.35, 0.65], 3: [0.0, 0.30]}
        pos  = {"ZA": (1, 1), "GA": (1, 2), "ZB": (2, 1), "GB": (2, 2), "EZ": (3, 1), "ED": (3, 2)}
        cb = {"ZA": _cbar(f"Z ({U})",     x=0.43, y=0.675, len=0.62, **small),
              "EZ": _cbar(f"E_Z ({U})",   x=0.43, y=0.15,  len=0.30, **small),
              "GA": _cbar("|∇Z| (µm/µm)", x=1.0,  y=0.675, len=0.62, **small),
              "ED": _cbar("E_d (µm/µm)",  x=1.0,  y=0.15,  len=0.30, **small)}
        row_label = {1: "Surface A", 2: "Surface B", 3: "Error"}
        ylabel  = {key: (f"{row_label[pos[key][0]]}<br>Y ({U})" if pos[key][1] == 1 else None) for key in order}
        headers = [_panel_title(f"Height Z ({U})", "x", "y"),
                   _panel_title("Slope magnitude |∇Z| (µm/µm)", "x2", "y2")]
        title_note = "" if not EQUAL else "  |  1:1"
    nrows = max(r for r, c in pos.values())

    layout = _base(margin={"t": 70 if headers else 55, "b": 50, "l": 75, "r": 75}, showlegend=False)
    layout["title"] = _title("Height and slope maps on the common grid  |  green outline: metric mask" + title_note)
    data = []
    for k, key in enumerate(order, 1):
        z, cs, zmin, zmax, name, nd = P[key]
        r, c = pos[key]
        xa, ya = ("x" if k == 1 else f"x{k}"), ("y" if k == 1 else f"y{k}")
        xkey, ykey = ("xaxis" if k == 1 else f"xaxis{k}"), ("yaxis" if k == 1 else f"yaxis{k}")
        # linked zoom (matches) and 1:1 scale (scaleanchor) cannot both be set on an axis
        link_x = {} if (EQUAL or k == 1) else {"matches": "x"}
        link_y = {} if (EQUAL or k == 1) else {"matches": "y"}
        layout[xkey] = _axis(f"X ({U})" if r == nrows else None, domain=cols[c], anchor=ya,
                             showticklabels=(r == nrows), **link_x,
                             **({"constrain": "domain"} if EQUAL else {}))
        layout[ykey] = _axis(ylabel[key], domain=rows[r], anchor=xa, showticklabels=(c == 1),
                             **link_y, **_eq(xa, constrain="domain"))
        data.append(_heatmap(xi, yi, z[::S, ::S], cs, name, cbar=cb.get(key), nd=nd,
                             zmin=zmin, zmax=zmax, xaxis=xa, yaxis=ya))
        if mx:
            data.append({"type": "scatter", "x": mx, "y": my, "mode": "markers",
                         "marker": {"size": 1.4, "color": _rgba(C("MASK"), 0.8)}, "hoverinfo": "skip",
                         "showlegend": False, "xaxis": xa, "yaxis": ya, "name": "mask"})
    layout["annotations"] = headers
    return {"data": data, "layout": layout}


# ── Figure sets (called by the worker) ─────────────────────────────────────────

# key -> builder(result, max_cells); the keys are the figure ids used by the interface
BUILDERS = {
    "pvisual": {
        "rotation":             lambda r, mc: make_rotation_fig(r),
        "channel":              lambda r, mc: make_channel_fig(r),
        "profiles_xsection":    lambda r, mc: make_cross_section_fig(r),
        "profiles_ycenter":     lambda r, mc: make_profile_ycenter_fig(r),
        "profiles_xcenter":     lambda r, mc: make_profile_xcenter_fig(r),
        "profiles_widthlength": lambda r, mc: make_profile_widthlength_fig(r),
        "view3d":               lambda r, mc: make_3d_fig(r, mc),
        "roughness":            lambda r, mc: make_roughness_fig(r),
    },
    "rq_gradient": {
        "grad3d_cloud1": lambda r, mc: make_gradient_3d_cloud1_fig(r, mc),
        "grad3d_cloud2": lambda r, mc: make_gradient_3d_cloud2_fig(r, mc),
        "grad3d_error":  lambda r, mc: make_gradient_3d_error_fig(r, mc),
        "gradmaps":      lambda r, mc: make_gradient_maps_fig(r),
    },
}


def build_figs(kind, result, max_cells=None, palette=None, equal=None):
    if palette:
        set_palette(palette)
    if equal is not None:
        set_equal(equal)
    return {key: fn(result, max_cells) for key, fn in BUILDERS[kind].items()}


def build_one_fig(kind, key, result, max_cells=None, palette=None, equal=None):
    if palette:
        set_palette(palette)
    if equal is not None:
        set_equal(equal)
    return BUILDERS[kind][key](result, max_cells)


def build_pvisual_figs(result, max_cells=None, palette=None, equal=None):
    return build_figs("pvisual", result, max_cells, palette, equal)


def build_gradient_figs(result, max_cells=None, palette=None, equal=None):
    return build_figs("rq_gradient", result, max_cells, palette, equal)


# ── JSON serialisation ─────────────────────────────────────────────────────────

def _safe(obj):
    if isinstance(obj, np.ndarray):
        return _arr(obj) if obj.dtype.kind in "fiub" else obj.tolist()
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return None if math.isnan(float(obj)) else float(obj)
    if isinstance(obj, dict):
        return {k: _safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_safe(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def figures_to_json(data: dict) -> str:
    return json.dumps(_safe(data))
