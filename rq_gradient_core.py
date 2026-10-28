"""
Gradient-based RQ correlation between two aligned point clouds — functional core.
No matplotlib, no plt.show(), no file I/O side-effects.
All print output goes through log_fn; all results returned as a dict.
"""

import numpy as np
from scipy.ndimage import gaussian_filter, binary_erosion
from scipy.stats import pearsonr


def _detect_delimiter(file_path, skip_rows=0):
    """Sniff the delimiter from the first non-empty, non-comment data line."""
    with open(file_path, 'r') as f:
        for i, line in enumerate(f):
            if i < skip_rows:
                continue
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if ',' in line:
                return ','
            if ';' in line:
                return ';'
            return None  # whitespace
    return None

_RQ_DEFAULTS = {
    "skip_rows":    0,      # files have no header row
    "grid_spacing": 5.0,    # µm per grid cell (isotropic) — standardizes |∇Z|/r_mag
                            #   across comparisons by sampling every pair the same way.
    "grid_res":     0,      # if >0, legacy fixed NxN square grid (overrides spacing)
    "smooth_sigma": 0.0,    # µm gaussian blur before gradient (min 1 cell enforced)
    "max_cells":    8_000_000,  # cap on the cells of the common grid (memory of a browser tab)
    "cad":          False,  # force CAD/idealized mode (reliable; set by caller)
    "cad_tex_tol":  1.5,    # µm; floor microtexture below this => idealized (auto hint,
                            #   reliable for wider channels; use `cad` for narrow CAD)
    "channel_frac": 0.20,   # metrics are computed on the CHANNEL INTERIOR — cells where
                            #   both surfaces lie below this fraction of depth. Excludes
                            #   the flat field (no slope signal) and the rim/opening
                            #   transition (edge/lip/coating-artifact prone, e.g. graphite
                            #   build-up). 0 = use the whole overlap.
}


# ── Grid helpers ──────────────────────────────────────────────────────────────

def _nan_gaussian_filter(arr, sigma):
    """Gaussian filter that respects NaN — only real measurements influence the result."""
    nan_mask = np.isnan(arr)
    d  = np.where(nan_mask, 0.0, arr)
    w  = np.where(nan_mask, 0.0, 1.0)
    sm_d = gaussian_filter(d, sigma=sigma)
    sm_w = gaussian_filter(w, sigma=sigma)
    return np.where(sm_w > 1e-6, sm_d / sm_w, np.nan)


def _rq_bin_grid(x, y, z, xi, yi):
    """Bin scattered (x,y,z) points onto a regular xi×yi grid, each cell centred on its grid
    point (it holds the points nearer to that point than to its neighbours). NaN where no data."""
    res_x, res_y = len(xi), len(yi)
    ix = np.searchsorted((xi[:-1] + xi[1:]) / 2, x, side="right")
    iy = np.searchsorted((yi[:-1] + yi[1:]) / 2, y, side="right")
    gsum = np.zeros((res_y, res_x), dtype=np.float64)
    gcnt = np.zeros((res_y, res_x), dtype=np.float64)
    np.add.at(gsum, (iy, ix), z)
    np.add.at(gcnt, (iy, ix), 1.0)
    return np.where(gcnt > 0, gsum / gcnt, np.nan)


# ── Public API ────────────────────────────────────────────────────────────────

def _load_cloud(path, p, log_fn):
    if path.lower().endswith('.x3p'):
        log_fn("  Format: X3P (ISO 25178-72) — coordinates in µm")
        xp, yp, zp = load_x3p(path, log_fn)
        return np.column_stack([xp, yp, zp])
    delim = _detect_delimiter(path, p["skip_rows"])
    log_fn(f"  Delimiter: {repr(delim) if delim else 'whitespace (auto-detected)'}")
    pts = np.loadtxt(path, skiprows=p["skip_rows"], delimiter=delim)
    finite = np.isfinite(pts[:, :3]).all(axis=1)
    if not finite.all():           # points without a number are left out (2026-10-25)
        log_fn(f"  Left out : {int((~finite).sum()):,} points without a number (NaN or infinite)")
        pts = pts[finite]
    return pts


def run_rq_gradient(file1: str, file2: str,
                    params: dict = None, log_fn=print) -> dict:
    """
    Compute gradient-based correlation metrics between two point clouds.

    The channel-axis alignment (PCA) has a 180°-about-Z sign ambiguity, so the
    two surfaces can come out reversed relative to each other (a valid channel
    either way). We therefore compute the metrics with cloud 2 as-is AND rotated
    180° about Z (x,y)→(−x,−y), and keep whichever orientation gives the higher
    primary correlation (r_mag, or r_z for CAD). metrics['z_flip'] records it.

    Returns dict with keys: metrics, grids, extents.
    """
    p = {**_RQ_DEFAULTS, **(params or {})}
    log_fn("=" * 55); log_fn("Loading clouds"); log_fn("=" * 55)
    c1 = _load_cloud(file1, p, log_fn)
    c2 = _load_cloud(file2, p, log_fn)

    # Both orientations are computed with their own log buffers and only the kept
    # orientation's log is emitted, so the numbers in the log are the reported ones.
    log_a, log_b = [], []
    res_a = _gradient_metrics(c1, c2, p, log_a.append)
    c2f = c2.copy(); c2f[:, 0] = -c2f[:, 0]; c2f[:, 1] = -c2f[:, 1]
    res_b = _gradient_metrics(c1, c2f, p, log_b.append)

    key  = "r_z" if res_a["metrics"]["cad_mode"] else "r_mag"
    name = {"r_z": "RQ", "r_mag": "RQd"}[key]
    flip = bool(res_b["metrics"][key] > res_a["metrics"][key])
    res  = res_b if flip else res_a
    res["metrics"]["z_flip"] = flip
    log_fn(f"\n  Orientation check on surface B (File 2): {name} as-is = {res_a['metrics'][key]:.3f}, "
           f"rotated 180° about Z = {res_b['metrics'][key]:.3f}  ->  "
           f"keeping the {'ROTATED' if flip else 'AS-IS'} orientation")
    for line in (log_b if flip else log_a):
        log_fn(line)
    return res


def _gradient_metrics(c1, c2, p, log_fn) -> dict:
    x1, y1, z1 = c1[:, 0], c1[:, 1], c1[:, 2]
    x2, y2, z2 = c2[:, 0], c2[:, 1], c2[:, 2]
    log_fn(f"  Cloud 1 : {len(c1):,} points  "
           f"X=[{x1.min():.3f}, {x1.max():.3f}]  Y=[{y1.min():.3f}, {y1.max():.3f}]")
    log_fn(f"  Cloud 2 : {len(c2):,} points  "
           f"X=[{x2.min():.3f}, {x2.max():.3f}]  Y=[{y2.min():.3f}, {y2.max():.3f}]")

    # ── Common grid ───────────────────────────────────────────────
    x_min = max(x1.min(), x2.min())
    x_max = min(x1.max(), x2.max())
    y_min = max(y1.min(), y2.min())
    y_max = min(y1.max(), y2.max())

    if x_min >= x_max or y_min >= y_max:
        raise ValueError(
            f"Files have no XY overlap.\n"
            f"  Cloud 1 X=[{x1.min():.3f}, {x1.max():.3f}]  Y=[{y1.min():.3f}, {y1.max():.3f}]\n"
            f"  Cloud 2 X=[{x2.min():.3f}, {x2.max():.3f}]  Y=[{y2.min():.3f}, {y2.max():.3f}]\n"
            "Both files must cover the same physical area."
        )

    log_fn(f"\n  Common grid  : X=[{x_min:.3f}, {x_max:.3f}]  "
           f"Y=[{y_min:.3f}, {y_max:.3f}]")

    # Fixed physical spacing (isotropic, non-square): the same dx=dy=spacing for
    # every comparison, so r_mag is sampled identically and is comparable across
    # all channel widths instead of varying with a fixed NxN over varying extents.
    # The grid points lie exactly the spacing apart from the start of the overlap (2026-10-25):
    # before, round(extent / spacing) points were spread over the extent, one interval fewer
    # than the cells, so the cells came out larger than stated (5.004 x 5.030 um for 5 um). Each
    # cell is centred on its point, so the end cells reach past the overlap by up to half a
    # cell. Cells running from one point to the next put their edges on the points of a surface
    # sampled on an axis-aligned 5 um lattice, where rounding then decided the cell of every
    # point. The spacing holds at any length (2026-10-25: beyond 2000 points per axis the extent
    # was divided evenly instead, so long crops had cells larger along the channel than across);
    # only a grid too large for the memory of a browser tab, or an overlap under 20 cells, stops.
    sp = float(p.get("grid_spacing", 5.0)) or 5.0

    def _axis(lo, hi):
        if p.get("grid_res"):
            return np.linspace(lo, hi, int(p["grid_res"]))
        n = int(np.ceil((hi - lo) / sp - 0.5 - 1e-9)) + 1
        if n < 20:
            raise ValueError(f"The two surfaces overlap over {hi - lo:.0f} µm, fewer than 20 grid cells of "
                             f"{sp:g} µm: check that A and B are crops of the same channel, or use a smaller grid spacing.")
        return lo + sp * np.arange(n)
    xi, yi = _axis(x_min, x_max), _axis(y_min, y_max)
    if len(xi) * len(yi) > int(p.get("max_cells") or 8_000_000):
        raise ValueError(f"The common grid would have {len(xi) * len(yi) / 1e6:.1f} million cells of {sp:g} µm, more "
                         f"than a browser tab can hold: use a larger grid spacing (Settings, Comparison) or crop the surfaces.")
    res_x, res_y = len(xi), len(yi)
    XI, YI = np.meshgrid(xi, yi)
    ncells = res_x * res_y
    log_fn(f"  Grid: {res_x}x{res_y}  (dx={xi[1]-xi[0]:.2f} dy={yi[1]-yi[0]:.2f} µm)")

    # ── Bin-average onto grid ─────────────────────────────────────
    log_fn("\nGridding points...")

    # Clip each cloud to the common extent before gridding
    m1 = ((x1 >= x_min) & (x1 <= x_max) & (y1 >= y_min) & (y1 <= y_max))
    m2 = ((x2 >= x_min) & (x2 <= x_max) & (y2 >= y_min) & (y2 <= y_max))
    log_fn(f"  Cloud 1 in common extent : {m1.sum():,} / {len(c1):,} pts")
    log_fn(f"  Cloud 2 in common extent : {m2.sum():,} / {len(c2):,} pts")
    if m1.sum() == 0 or m2.sum() == 0:
        raise ValueError(
            "No points from one or both files fall inside the common XY extent. "
            "Check that both files are in the same coordinate system."
        )
    ZI1 = _rq_bin_grid(x1[m1], y1[m1], z1[m1], xi, yi)
    ZI2 = _rq_bin_grid(x2[m2], y2[m2], z2[m2], xi, yi)

    raw_valid = np.isfinite(ZI1) & np.isfinite(ZI2)
    log_fn(f"  Valid cells (raw) : {raw_valid.sum():,} / {ncells:,}  "
           f"({100*raw_valid.sum()/ncells:.1f}%)")

    # CAD / idealized-surface detection: microtexture = plane-removed residual on
    # the flat channel FLOOR (deepest few % of the z range). An idealized CAD
    # surface is perfectly flat there (~0 µm) while a measured surface carries
    # print/mould roughness (~µm); the missing texture only serves to RECOGNISE
    # the CAD surface. Against an ideal surface the height correlation r_z does
    # not saturate and the difference is dominated by systematic wall offsets,
    # which the extracted dimensions measure directly, so r_z (with the
    # dimensions) is the primary metric; r_mag is still computed and reported.
    # (The explicit `cad` param overrides the detection.)
    def _texture_amp(ZI):
        m = np.isfinite(ZI)
        if m.sum() < 200:
            return float("nan")
        zz = ZI[m]
        lo, hi = np.percentile(zz, 1), np.percentile(zz, 99)
        fl = m & (ZI <= lo + 0.05 * (hi - lo))           # flat floor only
        # two cells away from the walls: the cells at the foot of a wall average floor and wall
        # points, which on a CAD floor read as 1 to 3 µm of texture. Empty cells count as
        # floor here, as a CAD cloud sparser than the grid leaves many (2026-10-25)
        fl = fl & binary_erosion(fl | ~m, iterations=2)
        if fl.sum() < 50:
            return float("nan")
        A = np.column_stack([XI[fl], YI[fl], np.ones(int(fl.sum()))])
        coef, *_ = np.linalg.lstsq(A, ZI[fl], rcond=None)
        return float(np.std(ZI[fl] - A @ coef))
    tex1, tex2 = _texture_amp(ZI1), _texture_amp(ZI2)
    cad_mode = bool(p.get("cad") or
                    (np.isfinite(tex1) and tex1 < p["cad_tex_tol"]) or
                    (np.isfinite(tex2) and tex2 < p["cad_tex_tol"]))
    if cad_mode:
        log_fn(f"  IDEALIZED surface detected (floor texture {tex1:.2f}/{tex2:.2f} µm): "
               f"RQ and the extracted dimensions are the primary measures for this pair; "
               f"against an ideal surface RQ does not saturate and the difference is "
               f"dominated by systematic wall offsets, which the dimensions give directly.")

    # NaN-aware smoothing. smooth_sigma is in µm; convert per-axis to cells so the
    # physical blur is the same regardless of grid spacing, with a 1-cell floor so
    # np.gradient sees a smooth surface.
    dx = xi[1] - xi[0]
    dy = yi[1] - yi[0]
    sig_um = float(p["smooth_sigma"])
    sig_yx = (max(sig_um / dy, 1.0), max(sig_um / dx, 1.0))
    ZI1 = _nan_gaussian_filter(ZI1, sigma=sig_yx)
    ZI2 = _nan_gaussian_filter(ZI2, sigma=sig_yx)
    log_fn(f"  Smoothing σ={sig_um:.1f}µm → cells (y,x)=({sig_yx[0]:.2f},{sig_yx[1]:.2f})")

    valid = np.isfinite(ZI1) & np.isfinite(ZI2)
    log_fn(f"  Valid cells (smoothed) : {valid.sum():,} / {ncells:,}  "
           f"({100*valid.sum()/ncells:.1f}%)")

    # ── Gradients ─────────────────────────────────────────────────
    log_fn("\nComputing gradients...")

    g1y, g1x = np.gradient(ZI1, dy, dx)
    g2y, g2x = np.gradient(ZI2, dy, dx)

    mag1 = np.sqrt(g1x**2 + g1y**2)
    mag2 = np.sqrt(g2x**2 + g2y**2)

    finite_mask = (np.isfinite(g1x) & np.isfinite(g1y) &
                   np.isfinite(g2x) & np.isfinite(g2y) &
                   np.isfinite(mag1) & np.isfinite(mag2))
    valid = valid & finite_mask
    log_fn(f"  Valid after finite mask : {valid.sum():,}")

    # ── Metric region: the CHANNEL INTERIOR ───────────────────────
    # Restrict the correlations to where BOTH surfaces lie below a fraction of
    # depth — i.e. the walls + floor. This drops the flat field (which carries
    # no slope signal) and the rim/opening transition (edge/lip/coating artifacts
    # such as graphite build-up), so r_mag reflects the channel that actually
    # replicates rather than measurement noise at the mouth.
    cf = float(p.get("channel_frac") or 0.0)
    fallback = False                               # the whole overlap used: said in the metrics (2026-10-28)
    if cf > 0:
        d = -0.5 * (np.nanpercentile(ZI1, 1) + np.nanpercentile(ZI2, 1))   # ~depth
        thr = -cf * d
        mmask = valid & (ZI1 < thr) & (ZI2 < thr)
        if mmask.sum() < 10:                       # fallback if channel too small
            mmask, fallback = valid, True
            log_fn("  QA: fewer than 10 cells lie in the channel interior of both surfaces; the whole overlap is used")
    else:
        mmask = valid
    log_fn(f"  Metric cells (channel interior, frac={cf}) : {mmask.sum():,}")

    # ── Metrics ───────────────────────────────────────────────────
    if mmask.sum() < 10:
        raise ValueError(
            f"Only {mmask.sum()} valid cells found after gridding. "
            "Check that both files cover the same XY area and "
            "that skip_rows matches your file format (header vs no header)."
        )

    log_fn("\n" + "=" * 55)
    log_fn("Metrics")
    log_fn("=" * 55)

    rmse_z   = float(np.sqrt(np.mean((ZI1[mmask]  - ZI2[mmask] )**2)))
    rmse_gx  = float(np.sqrt(np.mean((g1x[mmask]  - g2x[mmask] )**2)))
    rmse_gy  = float(np.sqrt(np.mean((g1y[mmask]  - g2y[mmask] )**2)))
    rmse_mag = float(np.sqrt(np.mean((mag1[mmask] - mag2[mmask])**2)))

    r_z,   _ = pearsonr(ZI1[mmask].ravel(),  ZI2[mmask].ravel())
    r_gx,  _ = pearsonr(g1x[mmask].ravel(),  g2x[mmask].ravel())
    r_gy,  _ = pearsonr(g1y[mmask].ravel(),  g2y[mmask].ravel())
    r_mag, _ = pearsonr(mag1[mmask].ravel(), mag2[mmask].ravel())

    log_fn(f"  {'Metric':<20} {'Pearson r':>10}  {'RMSE':>10}")
    log_fn(f"  {'-'*42}")
    log_fn(f"  {'RQ   (height Z)':<20} {r_z:>10.6f}  {rmse_z:>10.4f}")
    log_fn(f"  {'RQdx (dZ/dx)':<20} {r_gx:>10.6f}  {rmse_gx:>10.6f}")
    log_fn(f"  {'RQdy (dZ/dy)':<20} {r_gy:>10.6f}  {rmse_gy:>10.6f}")
    log_fn(f"  {'RQd  (|∇Z|)':<20} {r_mag:>10.6f}  {rmse_mag:>10.6f}")
    log_fn("\nDone.")

    error_map         = np.abs(mag1 - mag2).astype(float)
    error_map[~valid] = np.nan
    diff              = (ZI1 - ZI2).astype(float)
    diff[~valid]      = np.nan

    return {
        "metrics": {
            "r_z":    float(r_z),   "rmse_z":   rmse_z,
            "r_gx":   float(r_gx),  "rmse_gx":  rmse_gx,
            "r_gy":   float(r_gy),  "rmse_gy":  rmse_gy,
            "r_mag":  float(r_mag), "rmse_mag": rmse_mag,
            "cad_mode":   cad_mode,
            "texture_um": [tex1, tex2],
            "primary":    "r_z" if cad_mode else "r_mag",
            "n_mask":     int(mmask.sum()),
            "mask_fallback": fallback,
            "n_valid":    int(valid.sum()),
            "n_cells":    int(ncells),
            "cell_um":    [float(dx), float(dy)],
            "grid_shape": [int(res_x), int(res_y)],
        },
        "grids": {
            "XI": XI, "YI": YI,
            "mask": mmask,
            "ZI1": ZI1, "ZI2": ZI2,
            "diff": diff,
            "mag1": mag1, "mag2": mag2,
            "error_map": error_map,
            "g1x": g1x, "g1y": g1y,
            "g2x": g2x, "g2y": g2y,
            "valid": valid,
        },
        "extents": {
            "x_min": float(x_min), "x_max": float(x_max),
            "y_min": float(y_min), "y_max": float(y_max),
        },
    }
    