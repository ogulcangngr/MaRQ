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
import re
import numpy as np
from scipy.ndimage import binary_erosion

# ── Theme and palette ──────────────────────────────────────────────────────────

_THEMES = {
    # dark: the greys of Visual Studio Code's dark theme; light: white with neutral greys
    "dark":  dict(BG="#1E1E1E", PANEL="#1E1E1E", CARD="#2D2D30", BORDER="#454545",
                  TEXT="#D4D4D4", TEXT2="#C0C0C0", BLUE="#4FA3F7", RED="#F14C4C",
                  GREEN="#4EC98B", YELLOW="#E2B341", PURPLE="#B48EF0", MASK="#2BFF7A"),
    "light": dict(BG="#FFFFFF", PANEL="#FFFFFF", CARD="#EDEDEF", BORDER="#CFCFD4",
                  TEXT="#1F1F1F", TEXT2="#46464C", BLUE="#1F6FD1", RED="#D32F2F",
                  GREEN="#1A7F37", YELLOW="#9A6700", PURPLE="#8250DF", MASK="#00A040"),
}
# Colour scales as explicit stop lists (sampled from matplotlib; Earth from Plotly), because
# Plotly.js knows only some names (not Plasma, Magma, Inferno or Turbo) and the 3D viewport
# needs the stops too.
_SCALES = {
    "Viridis": [[0, "#440154"], [0.0625, "#48186A"], [0.125, "#472D7B"], [0.1875, "#424086"], [0.25, "#3B528B"], [0.3125, "#33638D"], [0.375, "#2C728E"], [0.4375, "#26828E"], [0.5, "#21918C"], [0.5625, "#1FA088"], [0.625, "#28AE80"], [0.6875, "#3FBC73"], [0.75, "#5EC962"], [0.8125, "#84D44B"], [0.875, "#ADDC30"], [0.9375, "#D8E219"], [1, "#FDE725"]],
    "Cividis": [[0, "#00224E"], [0.0625, "#002E6A"], [0.125, "#1A386F"], [0.1875, "#32436D"], [0.25, "#434E6C"], [0.3125, "#535A6D"], [0.375, "#61656F"], [0.4375, "#6F7073"], [0.5, "#7D7C78"], [0.5625, "#8C8878"], [0.625, "#9B9476"], [0.6875, "#ABA072"], [0.75, "#BCAE6C"], [0.8125, "#CDBB63"], [0.875, "#DEC958"], [0.9375, "#F0D846"], [1, "#FEE838"]],
    "Plasma": [[0, "#0D0887"], [0.0625, "#310597"], [0.125, "#4C02A1"], [0.1875, "#6600A7"], [0.25, "#7E03A8"], [0.3125, "#9511A1"], [0.375, "#AA2395"], [0.4375, "#BC3587"], [0.5, "#CC4778"], [0.5625, "#DA5A6A"], [0.625, "#E66C5C"], [0.6875, "#F0804E"], [0.75, "#F89540"], [0.8125, "#FDAC33"], [0.875, "#FDC527"], [0.9375, "#F8DF25"], [1, "#F0F921"]],
    "Magma": [[0, "#000004"], [0.0625, "#0A0822"], [0.125, "#1D1147"], [0.1875, "#36106B"], [0.25, "#51127C"], [0.3125, "#6A1C81"], [0.375, "#832681"], [0.4375, "#9C2E7F"], [0.5, "#B73779"], [0.5625, "#D0416F"], [0.625, "#E75263"], [0.6875, "#F56B5C"], [0.75, "#FC8961"], [0.8125, "#FEA772"], [0.875, "#FEC488"], [0.9375, "#FDE2A3"], [1, "#FCFDBF"]],
    "Inferno": [[0, "#000004"], [0.0625, "#0B0724"], [0.125, "#210C4A"], [0.1875, "#3D0965"], [0.25, "#57106E"], [0.3125, "#71196E"], [0.375, "#8A226A"], [0.4375, "#A32C61"], [0.5, "#BC3754"], [0.5625, "#D24644"], [0.625, "#E45A31"], [0.6875, "#F1731D"], [0.75, "#F98E09"], [0.8125, "#FCAC11"], [0.875, "#F9CB35"], [0.9375, "#F2EA69"], [1, "#FCFFA4"]],
    "Turbo": [[0, "#30123B"], [0.03125, "#392A73"], [0.0625, "#4040A2"], [0.09375, "#4456C7"], [0.125, "#466BE3"], [0.1562, "#4680F6"], [0.1875, "#4294FF"], [0.2188, "#37A8FA"], [0.25, "#28BCEB"], [0.2812, "#1CCDD8"], [0.3125, "#18DDC2"], [0.3438, "#1FE9AF"], [0.375, "#32F298"], [0.4062, "#4EF97D"], [0.4375, "#6DFE62"], [0.4688, "#8BFF4B"], [0.5, "#A4FC3C"], [0.5312, "#B9F635"], [0.5625, "#CDEC34"], [0.5938, "#DFDF37"], [0.625, "#EECF3A"], [0.6562, "#F8BE39"], [0.6875, "#FDAC34"], [0.7188, "#FE962B"], [0.75, "#FB7E21"], [0.7812, "#F46617"], [0.8125, "#EB500E"], [0.8438, "#DF3F08"], [0.875, "#D02F05"], [0.9062, "#BE2102"], [0.9375, "#A91601"], [0.9688, "#920B01"], [1, "#7A0403"]],
    "Diverging": [[0, "#053061"], [0.0625, "#175290"], [0.125, "#2A71B2"], [0.1875, "#3F8EC0"], [0.25, "#6BACD1"], [0.3125, "#9BC9E0"], [0.375, "#C2DDEC"], [0.4375, "#E0ECF3"], [0.5, "#F7F6F6"], [0.5625, "#FBE5D8"], [0.625, "#FBCCB4"], [0.6875, "#F5AA89"], [0.75, "#E48066"], [0.8125, "#D05548"], [0.875, "#BA2832"], [0.9375, "#930E26"], [1, "#67001F"]],
    "Earth": [[0, "#000082"], [0.1, "#00B4B4"], [0.2, "#28D228"], [0.4, "#E6E632"], [0.6, "#784614"], [1, "#FFFFFF"]],
}


def _scale(name):
    return _SCALES.get(str(name), _SCALES["Earth"])


_T = dict(_THEMES["dark"])          # active theme colours
_CS = _scale("Earth")               # height colour scale (palette selector)
EQUAL = True                        # 1:1 axis scales on the 2D plots: a µm on x is a µm on y

SLOPE_CS = _scale("Inferno")        # slope-magnitude maps and the slope error
DIFF_CS  = _scale("Diverging")      # signed height difference A - B (E_Z of the paper): blue below, red above
FONT = '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, "Ubuntu", "Droid Sans", sans-serif'   # the interface font of Visual Studio Code
U = "µm"

Z_DTICK_3D       = 100      # Z tick spacing in the single-surface 3D view
DEFAULT_3D_CELLS = 200_000  # 3D mesh budget when the interface passes none
FULL_3D          = -1       # 3D budget of "Very high": every cell, the analysis crop gridded at the voxel size
MAP_FULL_CELLS   = 300_000  # 2D comparison maps are sent at full resolution up to this size


def set_theme(name):
    """Switch the colours used by every builder. Call before (re)building figures."""
    global _T
    _T = dict(_THEMES.get(str(name).lower(), _THEMES["dark"]))


def set_palette(name):
    """Colour scale of every height map (2D and 3D)."""
    global _CS
    _CS = _scale(name or "Earth")


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
    """Scalar: nan or inf -> None, numpy scalar -> Python scalar."""
    if isinstance(x, float) and not math.isfinite(x):
        return None
    if isinstance(x, (np.floating, np.integer)):
        v = x.item()
        return None if (isinstance(v, float) and not math.isfinite(v)) else v
    return x


def _arr(a, nd=None):
    """1-D or 2-D array -> nested list with nan and inf -> None (vectorised), optionally rounded."""
    if a is None:
        return None
    a = np.asarray(a, dtype=float)
    if nd is not None:
        a = np.round(a, nd)
    obj = a.astype(object)
    obj[~np.isfinite(a)] = None
    return obj.tolist()


def _step(shape, max_cells):
    """Isotropic downsampling step that keeps a 2D grid within max_cells."""
    n = int(shape[0]) * int(shape[1])
    if not max_cells or max_cells < 0 or n <= max_cells:      # FULL_3D: no downsampling
        return 1
    return int(math.ceil(math.sqrt(n / float(max_cells))))


def _rgba(hex_colour, alpha):
    h = hex_colour.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


# ── Layout helpers ─────────────────────────────────────────────────────────────

def _font(size=13, color=None):
    return {"family": FONT, "size": size, "color": color or C("TEXT")}


def _axis(title=None, **kw):
    d = {"gridcolor": C("CARD"), "linecolor": C("BORDER"), "zerolinecolor": C("BORDER"),
         "tickfont": {"size": 12}}
    if title:
        d["title"] = {"text": title, "font": {"size": 13}}
    d.update(kw)
    return d


def _base(**kw):
    layout = {
        "paper_bgcolor": C("PANEL"),
        "plot_bgcolor":  C("BG"),
        "font":          _font(13),
        "autosize":      True,
        "margin":        {"t": 60, "b": 55, "l": 65, "r": 30},
        "hoverlabel":    {"font": {"family": FONT, "size": 13}},
    }
    layout.update(kw)
    return layout


def _title(text, size=14):
    return {"text": text, "font": {"size": size}, "x": 0.5, "xanchor": "center"}


def _legend_bottom(y=None):
    """Horizontal legend anchored to the bottom edge of the figure (container units),
    so it never drifts into the axis title when the window is short."""
    return {"x": 0.5, "xanchor": "center", "orientation": "h",
            "yref": "container", "y": 0.012, "yanchor": "bottom",
            "bgcolor": C("CARD"), "bordercolor": C("BORDER"), "borderwidth": 1,
            "font": {"size": 12}}


def _cbar(text, **kw):
    """Colourbar with a right-hand title `text`; any key in kw (including a full
    `title` dict) overrides the defaults."""
    d = {"thickness": 12, "len": 0.85, "outlinewidth": 0,
         "title": {"text": text, "side": "right", "font": {"size": 12}},
         "tickfont": {"size": 11}}
    d.update(kw)
    return d


def _sym_ticks(v):
    """Ticks of a colour bar from -v to v: 0 and one or two round values (1, 2 or 5 times a
    power of ten) on each side. With few ticks Plotly's own step can fall outside the bar
    and leave only the 0."""
    if not (np.isfinite(v) and v > 0):
        return {}
    k = int(np.floor(np.log10(v))) - 1
    step = next(s * 10.0 ** e for e in range(k, k + 3) for s in (1, 2, 5) if np.floor(v / (s * 10.0 ** e) + 1e-9) <= 2)
    n = int(np.floor(v / step + 1e-9))
    return {"tickmode": "array", "tickvals": [round(i * step, 10) for i in range(-n, n + 1)]}


def _ann(text, x, y, xref="paper", yref="paper", size=12, color=None, **kw):
    d = {"text": text, "x": x, "y": y, "xref": xref, "yref": yref, "showarrow": False,
         "font": {"size": size, "color": color or C("TEXT2")}}
    d.update(kw)
    return d


def _panel_title(text, xaxis, yaxis, size=13):
    """Subplot title anchored to the subplot's own domain (cannot collide with a neighbour)."""
    return _ann(text, 0.5, 1.0, xref=xaxis + " domain", yref=yaxis + " domain",
                size=size, color=C("TEXT"), xanchor="center", yanchor="bottom", yshift=6)


def _heatmap(x, y, z, cs, name, cbar=None, nd=2, unit=U, zd=1, **kw):
    """A map; its value is shown with zd decimals and its unit (in the hover label, and through
    meta in the interface's coordinate readout)."""
    d = {"type": "heatmap", "x": x, "y": y, "z": _arr(z, nd), "colorscale": cs,
         "name": name, "hoverongaps": False, "meta": {"unit": unit, "nd": zd},
         "hovertemplate": "<b>" + name + "</b><br>x %{x:.0f} µm, y %{y:.0f} µm<br>%{z:." + str(zd) + "f} " + unit + "<extra></extra>",
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
        return {"title": {"text": t, "font": {"size": 12}}, "gridcolor": C("CARD"),
                "backgroundcolor": C("BG"), "showbackground": True, "gridwidth": 1,
                "linecolor": C("BORDER"), "zerolinecolor": C("BORDER"), "spikecolor": C("BORDER"),
                "tickfont": {"size": 11}}
    zax = ax(zt)
    if zdtick:
        zax["dtick"] = zdtick
    return {"xaxis": ax(xt), "yaxis": ax(yt), "zaxis": zax, "bgcolor": C("BG"),
            "camera": _camera(aspect), "aspectmode": "manual", "aspectratio": aspect}


_LIGHTING = {"ambient": 0.6, "diffuse": 0.8, "roughness": 0.5, "specular": 0.1, "fresnel": 0.2}


def _layout3d(title, scene):
    return {"paper_bgcolor": C("PANEL"), "font": _font(13), "autosize": True,
            "margin": {"t": 60, "b": 10, "l": 10, "r": 90},
            "title": _title(title, 13), "scene": scene}


# ── Rotation maps ──────────────────────────────────────────────────────────────

def make_rotation_fig(result):
    bg  = result["grids"]["before"]
    ag  = result["grids"]["after"]
    rot = result["rotation"]

    ca   = rot["channel_axis"]
    if "arrow" in bg:                         # a reopened session keeps only the arrow, not the raw points
        cx_, cy_, alen = (float(v) for v in bg["arrow"])
    else:
        xd, yd = np.asarray(bg["xd"], float), np.asarray(bg["yd"], float)
        cx_, cy_ = float(xd.mean()), float(yd.mean())
        alen = float(min(np.ptp(xd), np.ptp(yd)) * 0.22)

    # with Raised feature (Settings) the scan was turned over before anything else, so the left panel
    # already shows it turned over
    before_txt = "Before: raw scan, turned over first (Settings)" if rot.get("turned_over") else "Before: raw scan"
    after_txt = "After: field levelled, channel along X"
    if rot.get("converted"):
        after_txt += ", protrusion rotated to a depression"

    layout = _base(margin={"t": 80, "b": 55, "l": 65, "r": 80})
    layout.update({
        "title": _title(f"Levelling and alignment  |  rotation φ = {rot['phi']:.2f}°, "
                        f"residual tilt {rot['xz_tilt']:.2f}° (XZ) and {rot['yz_tilt']:.2f}° (YZ), "
                        f"axis variance {rot['var_pct']:.1f} %"),
        "xaxis":  _axis(f"X ({U})", domain=[0.0, 0.40]),
        "yaxis":  _axis(f"Y ({U})", scaleanchor="x"),
        "xaxis2": _axis(f"X, channel axis ({U})", domain=[0.60, 1.0], anchor="y2"),
        "yaxis2": _axis(f"Y, cross-channel ({U})", scaleanchor="x2", anchor="x2"),
        "annotations": [
            _panel_title(before_txt, "x", "y"),
            _panel_title(after_txt, "x2", "y2"),
            {"x": cx_ + alen * ca[0], "y": cy_ + alen * ca[1], "ax": cx_, "ay": cy_,
             "xref": "x", "yref": "y", "axref": "x", "ayref": "y",
             "showarrow": True, "arrowhead": 3, "arrowsize": 1.2,
             "arrowcolor": C("RED"), "arrowwidth": 2.5,
             "text": "channel axis", "font": {"color": C("RED"), "size": 11}},
        ],
    })

    return {
        "data": [
            _heatmap(bg["XI"][0].tolist(), bg["YI"][:, 0].tolist(), bg["ZI"], _CS, "before",
                     cbar=_cbar(f"Height ({U})", x=0.415, xanchor="left", tickfont={"size": 10},
                                title={"text": f"Height ({U})", "side": "top", "font": {"size": 11}}),
                     xaxis="x", yaxis="y"),
            _heatmap(ag["XI"][0].tolist(), ag["YI"][:, 0].tolist(), ag["ZI"], _CS, "after",
                     cbar=_cbar(f"Height ({U})", x=1.01, xanchor="left"), xaxis="x2", yaxis="y2"),
        ],
        "layout": layout,
    }


# ── Channel detection ──────────────────────────────────────────────────────────

def make_channel_fig(result):
    ag  = result["grids"]["after"]
    sl  = result["slices"]
    ch  = result["channel"]

    rx = np.asarray(sl["rx"], float); cy = np.asarray(sl["cy"], float)
    wx = np.asarray(sl["width_x"], float)
    ry = np.asarray(sl["ry"], float); cx = np.asarray(sl["cx"], float)
    ly = np.asarray(sl["length_y"], float)
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
        _heatmap(ag["XI"][0].tolist(), ag["YI"][:, 0].tolist(), ag["ZI"], _CS, "Height",
                 cbar=_cbar(f"Height ({U})", x=1.01, xanchor="left"), showlegend=False),
        {"type": "scatter", "x": rx.tolist(), "y": cy.tolist(), "mode": "lines",
         "line": {"color": C("RED"), "width": 2}, "name": "Centre line"},
        {"type": "scatter", "x": wx_x, "y": wx_y, "mode": "lines",
         "line": {"color": edge_col, "width": 1.5, "dash": "dash"},
         "name": "Floor width edges"},
        {"type": "scatter", "x": cx.tolist(), "y": ry.tolist(), "mode": "lines",
         "line": {"color": C("BLUE"), "width": 2}, "name": "Longitudinal centre"},
        {"type": "scatter", "x": ly_x, "y": ly_y, "mode": "lines",
         "line": {"color": edge_col, "width": 1.5, "dash": "dot"},
         "name": "Floor length edges"},
        {"type": "scatter", "x": box_px, "y": box_py, "mode": "lines",
         "line": {"color": C("YELLOW"), "width": 2}, "name": "Crop box"},
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
    cY, cY_c = ch["center_y"], ch["center_y_conf"]

    layout = _base(showlegend=True, legend=_legend_bottom(), margin={"t": 60, "b": 100, "l": 70, "r": 30})
    layout["title"] = _title(f"Channel centre line  |  mean Y = {cY:.1f} {U}, "
                             f"SD over the central 80 % of the grid lines {cY_c:.1f} {U}")
    layout["xaxis"] = _axis(f"X, position along the channel ({U})")
    layout["yaxis"] = _axis(f"Centre Y ({U})", **_eq("x"))
    return {
        "data": [
            {"type": "scatter", "x": rx.tolist(), "y": cy.tolist(), "mode": "lines",
             "line": {"color": C("BLUE"), "width": 2}, "name": "Centre Y per grid line"},
            {"type": "scatter", "x": [float(rx[0]), float(rx[-1])], "y": [cY, cY], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dash"}, "name": f"Mean {cY:.1f} {U}"},
        ],
        "layout": layout,
    }


def make_profile_xcenter_fig(result):
    sl, ch = result["slices"], result["channel"]
    ry = np.asarray(sl["ry"], float); cx = np.asarray(sl["cx"], float)
    cX, cX_c = ch["center_x"], ch["center_x_conf"]

    layout = _base(showlegend=True, legend=_legend_bottom(), margin={"t": 60, "b": 100, "l": 70, "r": 30})
    layout["title"] = _title(f"Longitudinal centre per grid line along the channel  |  mean X = {cX:.1f} {U}, "
                             f"SD {cX_c:.1f} {U}")
    layout["xaxis"] = _axis(f"Y, position across the channel ({U})")
    layout["yaxis"] = _axis(f"Centre X ({U})", **_eq("x"))
    return {
        "data": [
            {"type": "scatter", "x": ry.tolist(), "y": cx.tolist(), "mode": "lines",
             "line": {"color": C("GREEN"), "width": 2}, "name": "Centre X per grid line"},
            {"type": "scatter", "x": [float(ry[0]), float(ry[-1])], "y": [cX, cX], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dash"}, "name": f"Mean {cX:.1f} {U}"},
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
             "line": {"color": C("YELLOW"), "width": 2}, "name": "Floor width per grid line"},
            {"type": "scatter", "x": [float(rx[0]), float(rx[-1])], "y": [mW, mW], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dash"}, "name": f"Median width {mW:.1f} {U}"},
            {**_band(ry, ly - ly_s, ly + ly_s, C("PURPLE"), "length ±1 SD over 11 lines"), "xaxis": "x2", "yaxis": "y2"},
            {"type": "scatter", "x": ry.tolist(), "y": ly.tolist(), "mode": "lines",
             "line": {"color": C("PURPLE"), "width": 2}, "name": "Floor length per grid line",
             "xaxis": "x2", "yaxis": "y2"},
            {"type": "scatter", "x": [float(ry[0]), float(ry[-1])], "y": [mL, mL], "mode": "lines",
             "line": {"color": C("RED"), "width": 1.2, "dash": "dot"}, "name": f"Median length {mL:.1f} {U}",
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

    def hline(y, colour, dash, name, x_from=x0, x_to=x1):
        return {"type": "scatter", "x": [x_from, x_to], "y": [y, y], "mode": "lines",
                "line": {"color": colour, "width": 1.3, "dash": dash}, "name": name, "hoverinfo": "name"}

    # the level lines, each named at the right edge of the plot (above or below its line, so the
    # close pairs, field and opening, floor-width level and floor, keep apart)
    levels = [(0.0, C("TEXT2"), "dot", "Field, z = 0", "bottom"),
              (fl, C("GREEN"), "dash", f"Floor level {fl:.1f} {U}", "top"),
              (ft, C("YELLOW"), "dot", f"Floor-width level ({fpct} % of depth)", "bottom"),
              (ot, C("PURPLE"), "dot", f"Opening level ({opct} % of depth)", "top")]
    data = [
        {"type": "scatter", "x": yc.tolist(), "y": zb.tolist(), "mode": "lines",
         "line": {"color": C("BLUE"), "width": 2.2}, "name": "Mean cross-section", "showlegend": False,
         "hovertemplate": f"y %{{x:.1f}} {U}<br>z %{{y:.1f}} {U}<extra></extra>"},
    ] + [{**hline(y, col, dash, name), "showlegend": False} for y, col, dash, name, _ in levels]
    level_labels = [_ann(name, 0.995, y, xref="x domain", yref="y", size=11, color=col, xanchor="right", yanchor=side,
                         bgcolor=_rgba(C("BG"), 0.7))
                    for y, col, dash, name, side in levels if np.isfinite(y)]
    if all(np.isfinite(v) for v in fe):
        data.append({"type": "scatter", "x": list(fe), "y": [ft, ft], "mode": "markers",
                     "marker": {"color": C("YELLOW"), "size": 9, "symbol": "diamond"},
                     "name": f"Floor width {ch['floor_width']:.1f} {U}", "hoverinfo": "name+x"})
    if all(np.isfinite(v) for v in oe):
        data.append({"type": "scatter", "x": list(oe), "y": [ot, ot], "mode": "markers",
                     "marker": {"color": C("PURPLE"), "size": 9, "symbol": "diamond"},
                     "name": f"Opening width {ch['opening_width']:.1f} {U}", "hoverinfo": "name+x"})
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
                         "name": f"Mid-wall lines, wall angle {wa:.1f}°"
                                 if wa is not None and np.isfinite(wa) else "Mid-wall lines",
                         "hoverinfo": "name"})
    if valid.any():
        data.append({"type": "scatter", "x": pos[valid].tolist(), "y": dep[valid].tolist(),
                     "mode": "lines+markers", "marker": {"size": 4}, "line": {"color": C("GREEN"), "width": 1.6},
                     "name": "Local depth per slice" + (f" (SD {dsd:.1f} {U})" if dsd is not None and np.isfinite(dsd) else ""),
                     "xaxis": "x2", "yaxis": "y2",
                     "hovertemplate": f"x %{{x:.0f}} {U}<br>depth %{{y:.1f}} {U}<extra></extra>"})
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
    layout = _base(showlegend=True, legend={**_legend_bottom(), "font": {"size": 11}},
                   margin={"t": 60, "b": 140, "l": 70, "r": 30})
    layout["title"] = _title(f"Mean cross-section and local depth  |  floor width {ch['floor_width']:.1f} {U}, "
                             f"opening {ch['opening_width']:.1f} {U}, depth {depth:.1f} {U}"
                             + (f", wall angle {wall:.1f}°" if wall is not None and np.isfinite(wall) else ""))
    layout["xaxis"]  = _axis(f"Y, across the channel ({U})", range=xr, anchor="y")
    layout["yaxis"]  = _axis(f"Height ({U})", domain=[0.58, 1.0], **_eq("x"))
    layout["xaxis2"] = _axis(f"X, along the channel ({U})", anchor="y2")
    layout["yaxis2"] = _axis(f"Local depth ({U})", domain=[0.0, 0.36], anchor="x2", **_eq("x2"))
    layout["annotations"] = level_labels
    return {"data": data, "layout": layout}


# ── 3D channel view ────────────────────────────────────────────────────────────

def _crop_heights(result, max_cells):
    """Height grid of the 3D channel view. At FULL_3D the crop points are gridded again at the
    voxel size when the display grid was coarser (its cell limit keeps the 2D maps light)."""
    g    = result["grids"]
    crop = g["crop"]
    ZI   = np.asarray(crop["ZI"], float)
    vox  = float(result["rotation"].get("voxel_size") or 0)
    grid = globals().get("_pv_make_grid")     # pvisual_core runs in the same namespace in the worker
    if (max_cells != FULL_3D or grid is None or not vox > 0 or len(crop.get("x", [])) == 0
            or not float(g["cells"].get("crop") or 0) > vox * 1.01):
        return ZI
    return grid(crop["x"], crop["y"], crop["z"], vox, g.get("display_sigma", 0), min_cell=vox,
                u_range=(crop["x_min"], crop["x_max"]), v_range=(crop["y_min"], crop["y_max"]))[2]   # where it is drawn


def make_3d_fig(result, max_cells=None, colorscale=None):
    crop = result["grids"]["crop"]
    ch   = result["channel"]
    ZI   = _crop_heights(result, max_cells)
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
             "lighting": _LIGHTING, "name": "Height",
             "hovertemplate": "x %{x:.0f} µm<br>y %{y:.0f} µm<br>z %{z:.1f} µm<extra></extra>",
             "colorbar": _cbar(f"Height ({U})", thickness=14)},
        ],
        "layout": _layout3d(title, _scene(aspect, f"X, channel axis ({U})",
                                          f"Y, cross-channel ({U})", f"Height ({U})",
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
        _heatmap(xi_c.tolist(), yi_c.tolist(), ZI, _CS, "Height",
                 cbar=_cbar(f"Height ({U})", x=1.01, xanchor="left"), showlegend=False),
        # the field strips by their side of the channel: on this map -Y is the lower one
        _rect(rgh["regions"]["floor"],      C("GREEN"), "Floor",    rgh["floor"]),
        _rect(rgh["regions"]["surf_left"],  C("BLUE"),  "Field −Y", rgh["surf_left"]),
        _rect(rgh["regions"]["surf_right"], C("RED"),   "Field +Y", rgh["surf_right"]),
    ]
    layout = _base(margin={"t": 60, "b": 125, "l": 65, "r": 80}, showlegend=True,
                   legend={**_legend_bottom(), "font": {"size": 11}})
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
        trace = {"z": _arr(ZA[::S, ::S], 2), "colorscale": _CS, "name": "Surface A",
                 "colorbar": _cbar(f"Height ({U})", thickness=14)}
        title = "Surface A, the reference  |  height" + exag
    elif which == "B":
        trace = {"z": _arr(ZB[::S, ::S], 2), "colorscale": _CS, "name": "Surface B",
                 "colorbar": _cbar(f"Height ({U})", thickness=14)}
        title = ("Surface B, the compared surface  |  height" +
                 (", rotated 180° about Z to match A" if m.get("z_flip") else "") + exag)
    else:
        ED = np.asarray(g["error_map"], float)
        ed_hi = float(np.nanpercentile(ED, 99)) if np.isfinite(ED).any() else 1.0
        trace = {"z": _arr(ZB[::S, ::S], 2), "surfacecolor": _arr(ED[::S, ::S], 4),
                 "colorscale": SLOPE_CS, "cmin": 0, "cmax": ed_hi, "name": "Slope error",
                 "colorbar": _cbar("Slope error (µm/µm)", thickness=14)}
        title = ("Slope error on surface B  |  the absolute difference of the slope magnitudes "
                 "of B and A, drawn on the shape of B" + exag)

    trace.update({"type": "surface", "x": x, "y": y, "showscale": True, "lighting": _LIGHTING,
                  "hovertemplate": "x %{x:.0f} µm<br>y %{y:.0f} µm<br>z %{z:.1f} µm<extra></extra>"})
    return {"data": [trace],
            "layout": _layout3d(title, _scene(aspect, f"X ({U})", f"Y ({U})", f"Height ({U})"))}


def make_gradient_3d_cloud1_fig(result, max_cells=None):
    return _surface_fig(result, "A", max_cells)


def make_gradient_3d_cloud2_fig(result, max_cells=None):
    return _surface_fig(result, "B", max_cells)


def make_gradient_3d_error_fig(result, max_cells=None):
    return _surface_fig(result, "E", max_cells)


# ── Paired comparison: 2D height and slope maps ────────────────────────────────

def _mask_edges(xi, yi, m):
    """The outline of a mask on a grid (cells centred on xi, yi) as line segments with None
    between them: the cell edges between a cell inside and one outside, merged along each row
    and column."""
    xi, yi = np.asarray(xi, float), np.asarray(yi, float)
    dx = (xi[1] - xi[0]) if xi.size > 1 else 1.0
    dy = (yi[1] - yi[0]) if yi.size > 1 else 1.0
    xs, ys = [], []

    def runs(v):
        e = np.diff(np.r_[0, v.astype(np.int8), 0])
        return zip(np.flatnonzero(e == 1), np.flatnonzero(e == -1))
    d = m[1:, :] != m[:-1, :]                       # edges between rows j and j+1
    for j in np.flatnonzero(d.any(axis=1)):
        y = float((yi[j] + yi[j + 1]) / 2)
        for a, b in runs(d[j]):
            xs += [float(xi[a] - dx / 2), float(xi[b - 1] + dx / 2), None]; ys += [y, y, None]
    d = m[:, 1:] != m[:, :-1]                       # edges between columns i and i+1
    for i in np.flatnonzero(d.any(axis=0)):
        x = float((xi[i] + xi[i + 1]) / 2)
        for a, b in runs(d[:, i]):
            xs += [x, x, None]; ys += [float(yi[a] - dy / 2), float(yi[b - 1] + dy / 2), None]
    return xs, ys


def _mask_outline(g, mask, max_pts=3000):
    """Boundary cells of the channel-interior mask as (x, y) lists, thinned."""
    if mask.sum() == 0:
        return [], []
    b = mask & ~binary_erosion(mask, iterations=1, border_value=0)
    by, bx = np.nonzero(b)
    keep = max(1, len(bx) // max_pts)
    XI, YI = np.asarray(g["XI"]), np.asarray(g["YI"])
    return XI[by[::keep], bx[::keep]].tolist(), YI[by[::keep], bx[::keep]].tolist()


def make_gradient_maps_fig(result, which=None):
    """The comparison maps on the common grid: which="height" the heights of A and B and their
    difference, which="slope" the slope magnitudes and the slope error, one map per row; with
    which=None all six (the figure of the paper)."""
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
    small = {"xanchor": "left", "thickness": 10, "tickfont": {"size": 10}}
    #        z    colourscale  zmin  zmax  name       decimals
    P = {"ZA": (ZA, _CS,      z0,   z1,   "Height A",          1),
         "ZB": (ZB, _CS,      z0,   z1,   "Height B",          1),
         "EZ": (EZ, DIFF_CS,  -ez,  ez,   "Difference A − B",  1),
         "GA": (GA, SLOPE_CS, 0.0,  g1,   "Slope A",           3),
         "GB": (GB, SLOPE_CS, 0.0,  g1,   "Slope B",           3),
         "ED": (ED, SLOPE_CS, 0.0,  ed,   "Slope error",       3)}
    split = which in ("height", "slope")
    if split:
        order = ["ZA", "ZB", "EZ"] if which == "height" else ["GA", "GB", "ED"]
        gap = 0.07; h = (1 - 2 * gap) / 3
        rows = {i: [1 - (i - 1) * (h + gap) - h, 1 - (i - 1) * (h + gap)] for i in (1, 2, 3)}
        pos  = {key: (i, 1) for i, key in enumerate(order, 1)}
        cols = {1: [0.0, 0.92]}
        def span(r0, r1):
            top, bot = rows[r0][1], rows[r1][0]
            return {"y": (top + bot) / 2, "len": top - bot}
        if which == "height":
            cb = {"ZA": _cbar(f"Height ({U})", x=0.935, nticks=5, **span(1, 2), **small),
                  "EZ": _cbar(f"A − B ({U})",  x=0.935, nticks=4, **span(3, 3), **small)}
            lab = {"ZA": "Surface A", "ZB": "Surface B", "EZ": "A − B"}
        else:
            cb = {"GA": _cbar("Slope (µm/µm)", x=0.935, nticks=5, **span(1, 2), **small),
                  "ED": _cbar("Error (µm/µm)", x=0.935, nticks=4, **span(3, 3), **small)}
            lab = {"GA": "Surface A", "GB": "Surface B", "ED": "Slope error"}
        ylabel  = {key: f"{lab[key]}<br>Y ({U})" for key in order}
        headers = []
        title_note = "" if not EQUAL else "  |  1:1"
    elif stacked:
        order = ["ZA", "ZB", "EZ", "GA", "GB", "ED"]
        gap = 0.028; h = (1 - 5 * gap) / 6
        rows = {i: [1 - (i - 1) * (h + gap) - h, 1 - (i - 1) * (h + gap)] for i in range(1, 7)}
        pos  = {key: (i, 1) for i, key in enumerate(order, 1)}
        cols = {1: [0.0, 0.93]}
        def span(r0, r1):
            top, bot = rows[r0][1], rows[r1][0]
            return {"y": (top + bot) / 2, "len": top - bot}
        cb = {"ZA": _cbar(f"Height ({U})",  x=0.945, nticks=4, **span(1, 2), **small),
              "EZ": _cbar(f"A − B ({U})",   x=0.945, nticks=3, **span(3, 3), **small),
              "GA": _cbar("Slope (µm/µm)",  x=0.945, nticks=4, **span(4, 5), **small),
              "ED": _cbar("Error (µm/µm)",  x=0.945, nticks=3, **span(6, 6), **small)}
        short = {"ZA": "Height A", "ZB": "Height B", "EZ": "A − B", "GA": "Slope A", "GB": "Slope B", "ED": "Error"}
        ylabel  = {key: short[key] for key in order}
        headers = []
        title_note = "  |  1:1"
    else:
        order = ["ZA", "GA", "ZB", "GB", "EZ", "ED"]
        cols = {1: [0.0, 0.42], 2: [0.57, 0.99]}
        rows = {1: [0.70, 1.0], 2: [0.35, 0.65], 3: [0.0, 0.30]}
        pos  = {"ZA": (1, 1), "GA": (1, 2), "ZB": (2, 1), "GB": (2, 2), "EZ": (3, 1), "ED": (3, 2)}
        cb = {"ZA": _cbar(f"Height ({U})",  x=0.43, y=0.675, len=0.62, **small),
              "EZ": _cbar(f"A − B ({U})",   x=0.43, y=0.15,  len=0.30, **small),
              "GA": _cbar("Slope (µm/µm)",  x=1.0,  y=0.675, len=0.62, **small),
              "ED": _cbar("Error (µm/µm)",  x=1.0,  y=0.15,  len=0.30, **small)}
        row_label = {1: "Surface A", 2: "Surface B", 3: "Difference"}
        ylabel  = {key: (f"{row_label[pos[key][0]]}<br>Y ({U})" if pos[key][1] == 1 else None) for key in order}
        headers = [_panel_title(f"Height ({U})", "x", "y"),
                   _panel_title("Slope magnitude (µm/µm)", "x2", "y2")]
        title_note = "" if not EQUAL else "  |  1:1"
    if "EZ" in cb:                                   # the signed difference: 0 and round values each side
        cb["EZ"].pop("nticks", None)
        cb["EZ"].update(_sym_ticks(ez))
    nrows = max(r for r, c in pos.values())

    layout = _base(margin={"t": 70 if headers else 55, "b": 50, "l": 75, "r": 75}, showlegend=False)
    name = {"height": "Height maps on the common grid", "slope": "Slope maps on the common grid"}.get(
        which, "Height and slope maps on the common grid")
    layout["title"] = _title(name + "  |  green outline: the channel "
                             "interior over which the correlations are computed" + title_note)
    data, outline = [], None
    for k, key in enumerate(order, 1):
        z, cs, zmin, zmax, name, nd = P[key]
        r, c = pos[key]
        xa, ya = ("x" if k == 1 else f"x{k}"), ("y" if k == 1 else f"y{k}")
        xkey, ykey = ("xaxis" if k == 1 else f"xaxis{k}"), ("yaxis" if k == 1 else f"yaxis{k}")
        if split:
            # The three maps of one view show one grid in panels of one size: Plotly links them
            # itself (they move together in one redraw), the first sets the true proportions
            # (widening its range to fill the panel) and the other two follow it.
            link_x = {"matches": "x"} if k > 1 else ({"constrain": "range"} if EQUAL else {})
            link_y = {"matches": "y"} if k > 1 else _eq(xa, constrain="range")
            layout[xkey] = _axis(f"X ({U})" if r == nrows else None, domain=cols[c], anchor=ya,
                                 showticklabels=(r == nrows), **link_x)
            layout[ykey] = _axis(ylabel[key], domain=rows[r], anchor=xa, showticklabels=(c == 1), **link_y)
        else:
            # linked zoom (matches) and 1:1 scale (scaleanchor) cannot both be set on an axis
            link_x = {} if (EQUAL or k == 1) else {"matches": "x"}
            link_y = {} if (EQUAL or k == 1) else {"matches": "y"}
            layout[xkey] = _axis(f"X ({U})" if r == nrows else None, domain=cols[c], anchor=ya,
                                 showticklabels=(r == nrows), **link_x,
                                 **({"constrain": "domain"} if EQUAL else {}))
            layout[ykey] = _axis(ylabel[key], domain=rows[r], anchor=xa, showticklabels=(c == 1),
                                 **link_y, **_eq(xa, constrain="domain"))
        data.append(_heatmap(xi, yi, z[::S, ::S], cs, name, cbar=cb.get(key), nd=nd,
                             unit=U if key[0] in "ZE" and key != "ED" else "µm/µm", zd=nd,
                             zmin=zmin, zmax=zmax, xaxis=xa, yaxis=ya))
        if split and mask.any():
            # the outline of the mask as one line of ready segments, cheap to redraw on every zoom;
            # two-tone, a dark edge under the green line, so it shows on every colour of the maps
            # (meta.outline: the interface shows or hides it)
            if outline is None:
                outline = _mask_edges(xi, yi, mask[::S, ::S])
            for colour, width in (("rgba(0,0,0,0.55)", 3.0), (_rgba(C("MASK"), 0.95), 1.2)):
                data.append({"type": "scatter", "mode": "lines", "x": outline[0], "y": outline[1],
                             "line": {"color": colour, "width": width}, "connectgaps": False, "meta": {"outline": True},
                             "hoverinfo": "skip", "showlegend": False, "xaxis": xa, "yaxis": ya, "name": "mask"})
        elif mx and not split:
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
        "gradheight":    lambda r, mc: make_gradient_maps_fig(r, "height"),
        "gradslope":     lambda r, mc: make_gradient_maps_fig(r, "slope"),
        "gradmaps":      lambda r, mc: make_gradient_maps_fig(r),
    },
}
# built only when asked for (the export dialog, the report), not with every result
EXPORT_ONLY = {"gradmaps"}


def build_figs(kind, result, max_cells=None, palette=None, equal=None):
    if palette:
        set_palette(palette)
    if equal is not None:
        set_equal(equal)
    return {key: localise(fn(result, max_cells)) for key, fn in BUILDERS[kind].items() if key not in EXPORT_ONLY}


def build_one_fig(kind, key, result, max_cells=None, palette=None, equal=None):
    if palette:
        set_palette(palette)
    if equal is not None:
        set_equal(equal)
    return localise(BUILDERS[kind][key](result, max_cells))


# ── Languages ──────────────────────────────────────────────────────────────────
# The builders write English. For another language the finished figure is translated piece
# by piece: titles split at "  |  ", line breaks, runs of spaces and ", ", and each piece is
# looked up whole or matched against a template whose {} stand for numbers. Numbers then
# take the decimal comma, and Plotly's own number formatting (ticks, hover) follows through
# layout.separators.

_LANG = "en"


def set_language(lang):
    """Language of the figure texts: "en" (default) or "tr"."""
    global _LANG
    _LANG = "tr" if str(lang or "").lower().startswith("tr") else "en"


_TR = {
    "Centre line": "Merkez çizgisi",
    "Longitudinal centre": "Boyuna merkez",
    "Centre X per grid line": "Her ızgara çizgisinde merkez X",
    "Centre Y per grid line": "Her ızgara çizgisinde merkez Y",
    "Crop box": "Kırpma kutusu",
    "Difference A − B": "Fark A − B",
    "Difference": "Fark",
    "Field −Y": "Çevre yüzey −Y",
    "Field +Y": "Çevre yüzey +Y",
    "Field": "Çevre yüzey",
    "Floor": "Taban",
    "Floor length edges": "Taban uzunluğu uçları",
    "Floor length per grid line": "Her ızgara çizgisinde taban uzunluğu",
    "Floor length": "Taban uzunluğu",
    "Floor width edges": "Taban genişliği kenarları",
    "Floor width per grid line": "Her ızgara çizgisinde taban genişliği",
    "Floor width": "Taban genişliği",
    "Height": "Yükseklik",
    "Height A": "Yükseklik A",
    "Height B": "Yükseklik B",
    "Mean cross-section": "Ortalama kesit",
    "Slope A": "Eğim A",
    "Slope B": "Eğim B",
    "Slope error": "Eğim hatası",
    "Surface A": "A yüzeyi",
    "Surface B": "B yüzeyi",
    "Error": "Hata",
    "after": "sonra",
    "before": "önce",
    "mask": "maske",
    "Slice without a valid floor": "Geçerli tabanı olmayan dilim",
    "No data": "Veri yok",
    "Before: raw scan": "Önce: ham tarama",
    "turned over first (Settings)": "önce ters çevrildi (Ayarlar)",
    "After: field levelled": "Sonra: çevre yüzey yataylandı",
    "channel along X": "kanal X boyunca",
    "protrusion rotated to a depression": "çıkıntı çukura döndürüldü",
    "channel axis": "kanal ekseni",
    "Centre X (µm)": "Merkez X (µm)",
    "Centre Y (µm)": "Merkez Y (µm)",
    "Error (µm/µm)": "Hata (µm/µm)",
    "Floor length (µm)": "Taban uzunluğu (µm)",
    "Floor length (µm) (free scale)": "Taban uzunluğu (µm) (serbest ölçek)",
    "Floor width (µm)": "Taban genişliği (µm)",
    "Height (µm)": "Yükseklik (µm)",
    "Local depth (µm)": "Yerel derinlik (µm)",
    "Slope (µm/µm)": "Eğim (µm/µm)",
    "Slope error (µm/µm)": "Eğim hatası (µm/µm)",
    "Slope magnitude (µm/µm)": "Eğim büyüklüğü (µm/µm)",
    "Roughness evaluation areas (ISO 25178, plane-removed)": "Pürüzlülük değerlendirme alanları (ISO 25178, düzlem çıkarılmış)",
    "X, along the channel (µm)": "X, kanal boyunca (µm)",
    "X, channel axis (µm)": "X, kanal ekseni (µm)",
    "X, position along the channel (µm)": "X, kanal boyunca konum (µm)",
    "Y, across the channel (µm)": "Y, kanala dik (µm)",
    "Y, cross-channel (µm)": "Y, kanala dik (µm)",
    "Y, position across the channel (µm)": "Y, kanala dik konum (µm)",
    "Height and slope maps on the common grid": "Ortak ızgarada yükseklik ve eğim haritaları",
    "Height maps on the common grid": "Ortak ızgarada yükseklik haritaları",
    "Slope maps on the common grid": "Ortak ızgarada eğim haritaları",
    "green outline: the channel interior over which the correlations are computed":
        "yeşil çizgi: korelasyonların hesaplandığı kanal içi",
    "Levelling and alignment": "Yataylama ve hizalama",
    "Channel detection on the aligned surface": "Hizalanmış yüzeyde kanal tespiti",
    "crop box for export": "dışa aktarma için kırpma kutusu",
    "Channel centre line": "Kanal merkez çizgisi",
    "Cropped channel": "Kırpılmış kanal",
    "Longitudinal centre per grid line along the channel": "Kanal boyunca her ızgara çizgisinde boyuna merkez",
    "Mean cross-section and local depth": "Ortalama kesit ve yerel derinlik",
    "Slope error on surface B": "B yüzeyinde eğim hatası",
    "the absolute difference of the slope magnitudes of B and A": "B ve A eğim büyüklüklerinin mutlak farkı",
    "drawn on the shape of B": "B'nin biçimi üzerinde gösterilir",
    "the reference": "referans",
    "the compared surface": "karşılaştırılan yüzey",
    "height": "yükseklik",
    "rotated 180° about Z to match A": "A'ya uyması için Z ekseni etrafında 180° döndürüldü",
    "Local depth per slice": "Dilim başına yerel derinlik",
    "Mid-wall lines": "Orta yan duvar çizgileri",
}

# templates: {} matches a number with its unit; the Turkish order may differ
_TR_TPL = [
    ("floor edges on the grid lines at {} % of depth", "derinliğin %{} düzeyinde ızgara çizgilerindeki taban kenarları"),
    ("mean Y = {}", "ortalama Y = {}"),
    ("mean X = {}", "ortalama X = {}"),
    ("SD over the central 80 % of the grid lines {}", "ızgara çizgilerinin ortadaki %80'inde SS {}"),
    ("SD {}", "SS {}"),
    ("floor width {}", "taban genişliği {}"),
    ("length {}", "uzunluk {}"),
    ("depth {}", "derinlik {}"),
    ("opening {}", "ağız {}"),
    ("wall angle {}", "yan duvar açısı {}"),
    ("Floor width and length per grid line at {} % of depth", "Derinliğin %{} düzeyinde her ızgara çizgisinde taban genişliği ve uzunluğu"),
    ("W = {}", "G = {}"),
    ("L = {} (median ± SD of the lines)", "U = {} (çizgilerin ortancası ± SS)"),
    ("rotation φ = {}", "dönme φ = {}"),
    ("residual tilt {} (XZ) and {} (YZ)", "kalan eğiklik {} (XZ) ve {} (YZ)"),
    ("axis variance {} %", "eksen varyansı %{}"),
    ("Median width {}", "Ortanca genişlik {}"),
    ("Median length {}", "Ortanca uzunluk {}"),
    ("Floor level {}", "Taban seviyesi {}"),
    ("Floor width {}", "Taban genişliği {}"),
    ("Opening width {}", "Ağız genişliği {}"),
    ("Floor-width level ({} % of depth)", "Taban genişliği seviyesi (derinlik %{})"),
    ("Opening level ({} % of depth)", "Ağız seviyesi (derinlik %{})"),
    ("Local depth per slice (SD {})", "Dilim başına yerel derinlik (SS {})"),
    ("Mean depth {}", "Ortalama derinlik {}"),
    ("Mean {}", "Ortalama {}"),
    ("Mid-wall lines, wall angle {}", "Orta yan duvar çizgileri, yan duvar açısı {}"),
    ("width ±1 SD over {} lines", "genişlik ±1 SS, {} çizgi üzerinden"),
    ("length ±1 SD over {} lines", "uzunluk ±1 SS, {} çizgi üzerinden"),
    ("{}: no data", "{}: veri yok"),
    ("(Z exaggerated ×{})", "(Z ×{} büyütüldü)"),
]
# the most specific template first ("length ±1 SD over {} lines" before "length {}")
_TR_RX = [(re.compile("^" + re.escape(en).replace(r"\{\}", "(.+?)") + "$"), tr, (", " in en or "  " in en))
          for en, tr in sorted(_TR_TPL, key=lambda p: -len(p[0].replace("{}", "")))]
_SPLIT = re.compile(r"(\s+\|\s+|<br>|</?b>|<extra></extra>|\s{3,}|, )")


def _decimal(s):
    """Decimal comma and thousands point, for Turkish."""
    s = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "\x01", s)
    s = re.sub(r"(?<=\d)\.(?=\d)", ",", s)
    return s.replace("\x01", ".")


def _tr_piece(p, whole=False):
    """One piece of text; with whole=True only exact entries and templates that themselves
    contain a separator are tried, so a long title is not caught by a short template."""
    core = p.strip()
    if not core:
        return p, False
    out = _TR.get(core)
    if out is None:
        for rx, tr, multi in _TR_RX:
            if whole and not multi:
                continue
            m = rx.match(core)
            if m:
                out = tr.format(*[_TR.get(g.strip(), g) if isinstance(g, str) else g for g in m.groups()])
                break
    if out is None:
        return p.replace(core, _decimal(core)), False
    return p.replace(core, _decimal(out)), True


def _tr_text(s):
    if _LANG == "en" or not isinstance(s, str):
        return s
    out, hit = _tr_piece(s, whole=True)
    if hit:
        return out
    parts = _SPLIT.split(s)
    return "".join(p if (i % 2 == 1) else _tr_piece(p)[0] for i, p in enumerate(parts))


_NEG_ZERO = re.compile(r"(?<![\w.,])-(0(?:\.0+)?)(?![\w.,]*\d)")


def localise(fig):
    """Translate the texts of one figure in place, once ("-0.00" becomes "0.00" in every language)."""
    layout = fig.setdefault("layout", {})
    meta = layout.get("meta") if isinstance(layout.get("meta"), dict) else {}
    if meta.get("marq_lang"):
        return fig                                   # already done: a second pass would undo the decimals
    layout["meta"] = {**meta, "marq_lang": _LANG}

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("text", "name", "hovertemplate") and isinstance(v, str):
                    if k != "hovertemplate":
                        v = _NEG_ZERO.sub(r"\1", v)
                    o[k] = v if _LANG == "en" else _tr_text(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    walk(fig)
    if _LANG != "en":
        layout["separators"] = ",."
    return fig


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
        return None if not math.isfinite(float(obj)) else float(obj)
    if isinstance(obj, dict):
        return {k: _safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_safe(v) for v in obj]
    if isinstance(obj, float) and not math.isfinite(obj):    # JSON has no NaN or Infinity
        return None
    return obj


def figures_to_json(data: dict) -> str:
    return json.dumps(_safe(data))
