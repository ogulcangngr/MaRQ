"""
Point cloud channel analysis — functional core (field-referenced redesign).

No matplotlib, no plt.show(), no file I/O side-effects. All print output goes
through log_fn; all results returned as a dict.

Method (replaces the old floor-percentile + Monte-Carlo approach):
  load -> crop -> voxel -> robust FIELD-PLANE leveling -> AUTO-ORIENTATION
  (a protrusion is rotated 180 deg about the in-plane axis into a depression —
  a proper rotation, NOT a z-flip mirror, so imperfection handedness is kept)
  -> PCA axis alignment -> mean cross-section profile -> direct geometry.

There is no channel_pctl and no random sampling: the field is the large flat
reference, so leveling and detection are robust for any channel width.

Grid interpolation uses numpy bin-averaging + scipy.ndimage NaN fill, avoiding
scipy.interpolate.griddata (Delaunay/qhull) which is unstable in Pyodide WASM.
"""

import io
import math
import time
import numpy as np
from scipy.ndimage import gaussian_filter, distance_transform_edt

DISPLAY_MAX_CELLS = 160_000   # auto display-cell size keeps each display grid within this
DISPLAY_HARD_MAX  = 600_000   # an explicit display-cell size is coarsened beyond this

_PV_DEFAULTS = {
    "delimiter":      None,   # None = whitespace
    "skip_rows":      0,
    "margin":         100,
    "despike_margin": 40.0,   # remove pts > field + this (µm); 0 disables. Strips
                              #   focus-variation spikes; nothing real sits above
                              #   the field except small lips, so geometry/floor are
                              #   untouched and field roughness is cleaned.
    "despike_lower":  380.0,  # remove pts > this (µm) BELOW the field; 0 disables.
                              #   Deep optical dropouts sit far below any real channel
                              #   (max ~340 µm), so this strips them without touching
                              #   geometry; it cleans the gradient/RQ_d in particular.
    "voxel_size":     20,     # 0 or None = auto
    "vsdivider":      1000,
    "display_cell":   0,      # µm; side of the square display-grid cells, 0 = auto
    "smooth_sigma":   0,      # Gaussian blur of the display grids, in cells
    "n_slices":       80,
    "floor_width_frac":     0.90,   # depth fraction for the floor (narrowest) width
    "opening_frac":         0.10,   # depth fraction for the opening width
    "crop_pad_x":          180,
    "crop_pad_y":          100,
    "field_k":              2.5,    # MAD multiplier for field-plane inlier band
    "floor_eval_frac":      0.5,      # floor strip width = this x nominal (or detected) width
    "floor_eval_length":    4000.0,   # floor strip length along X
    "field_eval_width":     400.0,    # FIXED field strip width (same for every measurement)
    "field_eval_length":    4000.0,   # FIXED field strip length along X
    "field_tol_min":        8.0,      # field-edge tolerance: max(this, frac x depth)
    "field_tol_frac":       0.04,
    "nominal_width":        0.0,      # if >0, floor strip keyed to nominal (comparability)
    # kept for UI back-compat (no longer used by the field-referenced method):
    "channel_pctl":   5,
    "z_search_frac":  0.50,
}


# ── Generic helpers ───────────────────────────────────────────────────────────

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


def _voxel_downsample(points, voxel_size):
    mins      = points.min(axis=0)
    voxel_idx = np.floor((points - mins) / voxel_size).astype(np.int32)
    keys      = (voxel_idx[:, 0].astype(np.int64) * 1_000_003 +
                 voxel_idx[:, 1].astype(np.int64) * 1_009 +
                 voxel_idx[:, 2].astype(np.int64))
    _, inv = np.unique(keys, return_inverse=True)
    n      = inv.max() + 1
    sampled = np.zeros((n, 3), dtype=np.float64)
    counts  = np.zeros(n, dtype=np.float64)
    for col in range(3):
        np.add.at(sampled[:, col], inv, points[:, col])
    np.add.at(counts, inv, 1.0)
    sampled /= counts[:, np.newaxis]
    return sampled


def _pv_fill_nan(arr):
    """Replace every NaN cell with the value of the nearest non-NaN cell."""
    mask = np.isnan(arr)
    if not mask.any() or mask.all():
        return arr
    _, idx = distance_transform_edt(mask, return_distances=True, return_indices=True)
    return arr[idx[0], idx[1]]


def _pv_make_grid(u, v, w, cell, sigma, u_range=None, v_range=None, min_cell=0.0):
    """Scatter (u, v, w) -> regular grid with SQUARE cells of side `cell` (data units),
    bin-averaged, NaN cells filled from the nearest measured cell. These grids are for
    display only; the geometry and roughness are computed from the points.

    cell <= 0: the finest square cell that keeps the grid within DISPLAY_MAX_CELLS,
    never finer than min_cell (the voxel size). An explicit cell is coarsened only if
    it would exceed DISPLAY_HARD_MAX cells. Returns (UI, VI, WI, cell)."""
    u = np.asarray(u, float); v = np.asarray(v, float); w = np.asarray(w, float)
    u0, u1 = (float(u_range[0]), float(u_range[1])) if u_range else (float("nan"), float("nan"))
    v0, v1 = (float(v_range[0]), float(v_range[1])) if v_range else (float("nan"), float("nan"))
    if len(u) and not (math.isfinite(u0) and math.isfinite(u1)):
        u0, u1 = float(np.nanmin(u)), float(np.nanmax(u))
    if len(v) and not (math.isfinite(v0) and math.isfinite(v1)):
        v0, v1 = float(np.nanmin(v)), float(np.nanmax(v))
    if not all(math.isfinite(t) for t in (u0, u1, v0, v1)):   # nothing usable: empty grid
        UI, VI = np.meshgrid(np.array([0.0, 1.0]), np.array([0.0, 1.0]))
        return UI, VI, np.full((2, 2), np.nan), float("nan")
    du, dv = max(u1 - u0, 1e-9), max(v1 - v0, 1e-9)
    if not (min_cell and math.isfinite(min_cell)):
        min_cell = 0.0
    if cell is None or not math.isfinite(cell) or cell <= 0:
        cell = math.sqrt(du * dv / DISPLAY_MAX_CELLS)
        if min_cell and cell < min_cell:
            cell = float(min_cell)
    else:
        cell = float(cell)
        if du * dv / cell ** 2 > DISPLAY_HARD_MAX:
            cell = math.sqrt(du * dv / DISPLAY_HARD_MAX)
    res_u = max(2, int(round(du / cell)))
    res_v = max(2, int(round(dv / cell)))
    ui = np.linspace(u0, u1, res_u)
    vi = np.linspace(v0, v1, res_v)

    xi = np.clip(np.searchsorted(ui, u, side="right") - 1, 0, res_u - 1)
    yi = np.clip(np.searchsorted(vi, v, side="right") - 1, 0, res_v - 1)

    gsum = np.zeros((res_v, res_u), dtype=np.float64)
    gcnt = np.zeros((res_v, res_u), dtype=np.float64)
    np.add.at(gsum, (yi, xi), w)
    np.add.at(gcnt, (yi, xi), 1.0)

    WI = np.where(gcnt > 0, gsum / gcnt, np.nan)
    WI = _pv_fill_nan(WI)
    if sigma > 0:
        WI = gaussian_filter(WI, sigma=sigma)

    UI, VI = np.meshgrid(ui, vi)
    return UI, VI, WI, cell


def _core_mean(arr):
    arr = np.asarray(arr, float)
    if len(arr) < 3:
        return float(np.nanmean(arr)) if len(arr) else float("nan")
    t = max(1, int(len(arr) * 0.10))
    return float(np.nanmean(arr[t:-t]))


def _core_std(arr):
    arr = np.asarray(arr, float)
    if len(arr) < 3:
        return float(np.nanstd(arr)) if len(arr) else float("nan")
    t = max(1, int(len(arr) * 0.10))
    return float(np.nanstd(arr[t:-t]))


def _iso25178(z_residuals):
    """ISO 25178 areal roughness parameters on plane-removed residuals."""
    z  = z_residuals - z_residuals.mean()
    Sq = float(np.sqrt(np.mean(z ** 2)))
    Sa = float(np.mean(np.abs(z)))
    Sz = float(z.max() - z.min())
    if Sq > 1e-12:
        Ssk = float(np.mean(z ** 3) / Sq ** 3)
        Sku = float(np.mean(z ** 4) / Sq ** 4)
    else:
        Ssk = Sku = 0.0
    return {"Sa": Sa, "Sq": Sq, "Sz": Sz, "Ssk": Ssk, "Sku": Sku, "n_pts": len(z)}


def _roughness_region(xp, yp, zp):
    """Fit and subtract a least-squares plane, return ISO 25178 params."""
    if len(xp) < 10:
        return None
    A = np.column_stack([xp, yp, np.ones(len(xp))])
    coeffs, _, _, _ = np.linalg.lstsq(A, zp, rcond=None)
    residuals = zp - A @ coeffs
    return _iso25178(residuals)


# ── Field-referenced leveling + orientation ───────────────────────────────────

def _fit_field_plane(pts, n_iter=6, k=2.5):
    """Robustly fit the dominant flat field plane z = a*x + b*y + c.

    Inliers are SEEDED at the modal z level (the dominant flat field) so a wide
    channel and its raised edge lips cannot drag the initial plane; then both
    tails are MAD-rejected each pass. Returns coeffs (a, b, c).
    """
    x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
    A = np.column_stack([x, y, np.ones(len(pts))])
    # Seed inliers from the outer border ring. The channel is a central stripe,
    # so the scan border is field. Seeding here avoids locking onto a WIDE
    # channel floor — a large flat region that can rival the field and capture a
    # global-mode seed (the cause of the wide-channel bistability).
    xlo, xhi = np.percentile(x, [8, 92])
    ylo, yhi = np.percentile(y, [8, 92])
    mask = (x < xlo) | (x > xhi) | (y < ylo) | (y > yhi)
    if mask.sum() < 50:
        mask = np.ones(len(pts), dtype=bool)
    coef = np.array([0.0, 0.0, float(np.median(z[mask]))])
    for _ in range(n_iter):
        coef, *_ = np.linalg.lstsq(A[mask], z[mask], rcond=None)
        resid = z - A @ coef
        med = np.median(resid[mask])
        mad = np.median(np.abs(resid[mask] - med)) + 1e-9
        mask = np.abs(resid - med) < k * mad
        if mask.sum() < 50:
            break
    return coef


def _level_and_orient(ds, k, log_fn):
    """Level on the field plane and normalize orientation to a depression.

    Returns (leveled_points, converted_flag, field_tilt_xz, field_tilt_yz).
    The field is placed at z=0 with the feature below it.
    """
    coef = _fit_field_plane(ds, k=k)
    A = np.column_stack([ds[:, 0], ds[:, 1], np.ones(len(ds))])
    z0 = ds[:, 2] - A @ coef
    lev = np.column_stack([ds[:, 0], ds[:, 1], z0])

    field_tilt_xz = float(np.degrees(np.arctan(coef[0])))
    field_tilt_yz = float(np.degrees(np.arctan(coef[1])))

    med = np.median(z0)
    down = med - np.percentile(z0, 2)
    up   = np.percentile(z0, 98) - med
    converted = bool(up > down)
    if converted:
        # Proper 180 deg rotation about the in-plane X axis: (x, -y, -z).
        # A bare z-flip would mirror the surface and reverse imperfection handedness.
        lev = np.column_stack([lev[:, 0], -lev[:, 1], -lev[:, 2]])
        log_fn(f"  orientation: PROTRUSION -> rotated to depression  (down={down:.0f} up={up:.0f})")
    else:
        log_fn(f"  orientation: depression  (down={down:.0f} up={up:.0f})")

    # Re-zero the field to exactly 0 after any conversion (robust field median).
    d = lev[:, 2] - np.median(lev[:, 2])
    fmask = np.abs(d) < (np.median(np.abs(d)) * 3 + 1e-9)
    lev[:, 2] -= np.median(lev[fmask, 2])
    return lev, converted, field_tilt_xz, field_tilt_yz


def _align_axis(lev, depth_est):
    """Rotate about Z so the channel long axis lies on X, and center it at (0,0).

    Returns (aligned_points, phi_deg, channel_axis_3d, var_pct).
    """
    sub = lev[lev[:, 2] < -0.5 * depth_est]
    if len(sub) < 20:
        return lev.copy(), 0.0, np.array([1.0, 0.0, 0.0]), float("nan")
    ctr = sub[:, :2].mean(axis=0)
    xy = sub[:, :2] - ctr
    evals, evecs = np.linalg.eigh(np.cov(xy.T))
    axis = evecs[:, -1]
    theta = np.arctan2(axis[1], axis[0])
    var_pct = float(evals[-1] / evals.sum() * 100)

    c, s = np.cos(-theta), np.sin(-theta)
    R = np.array([[c, -s], [s, c]])
    xy_all = (lev[:, :2] - ctr) @ R.T
    aligned = np.column_stack([xy_all, lev[:, 2]])

    channel_axis = np.array([np.cos(theta), np.sin(theta), 0.0])
    return aligned, float(np.degrees(theta)), channel_axis, var_pct


# ── Cross-section profile + geometry ──────────────────────────────────────────

def _channel_extent(axis_vals, z_vals, depth_est, nbin=120):
    """Span of `axis` over which the per-bin deep percentile dips below half depth."""
    a_min, a_max = axis_vals.min(), axis_vals.max()
    ed = np.linspace(a_min, a_max, nbin + 1)
    bi = np.clip(np.searchsorted(ed, axis_vals, side="right") - 1, 0, nbin - 1)
    deep = np.full(nbin, np.nan)
    for i in range(nbin):
        m = bi == i
        if m.any():
            deep[i] = np.percentile(z_vals[m], 2)
    inch = np.where(deep < -0.5 * depth_est)[0]
    if len(inch) >= 2:
        return ed[inch.min()], ed[inch.max() + 1]
    return a_min, a_max


def _mean_profile(cross_vals, z_vals, n_bins=400):
    """Mean cross-section: robust median Z per cross-bin. Returns (centers, z)."""
    lo, hi = np.percentile(cross_vals, 0.5), np.percentile(cross_vals, 99.5)
    ed = np.linspace(lo, hi, n_bins + 1)
    cc = 0.5 * (ed[:-1] + ed[1:])
    bi = np.clip(np.searchsorted(ed, cross_vals, side="right") - 1, 0, n_bins - 1)
    zb = np.full(n_bins, np.nan)
    for j in range(n_bins):
        m = bi == j
        if m.sum() >= 3:
            zb[j] = np.median(z_vals[m])
    good = np.isfinite(zb)
    return cc[good], zb[good]


def _width_at(centers, zb, zlev):
    """Extent of the channel where the profile is at/below zlev (center, width)."""
    below = centers[zb <= zlev]
    if len(below) < 2:
        return float("nan"), float("nan")
    return float((below.min() + below.max()) / 2), float(below.max() - below.min())


def _clean_field_start(yc, zb, opening_hw, tol, side, search_span=400.0, margin=30.0):
    """|y| where clean field begins on one side (+1 right / -1 left), i.e. just
    past the raised lip. Searches the mean profile from the opening edge outward
    and returns the outer edge of the disturbed (|Z| > tol) zone plus a margin;
    falls back to the opening edge if nothing exceeds tol. This auto-places the
    field strip 'far enough' from the channel without a manual offset."""
    sel = (yc * side) > 0
    ys, zs = np.abs(yc[sel]), np.abs(zb[sel])
    region = (ys >= opening_hw) & (ys <= opening_hw + search_span)
    dist = ys[region & (zs > tol)]
    edge = float(dist.max()) if len(dist) else float(opening_hw)
    return edge + margin


def _slice_widths(axis_vals, cross_vals, z_vals, n_slices, depth, frac, a_lo, a_hi):
    """Per-slice channel center & width at z = -frac*depth, for plot overlays."""
    zlev = -frac * depth
    ed = np.linspace(a_lo, a_hi, n_slices + 1)
    pos, ctr, ctr_s, wid, wid_s = [], [], [], [], []
    bi = np.clip(np.searchsorted(ed, axis_vals, side="right") - 1, 0, n_slices - 1)
    for i in range(n_slices):
        m = bi == i
        if m.sum() < 20:
            continue
        cv, zv = cross_vals[m], z_vals[m]
        # split the slice in two along the axis for a cheap local variability estimate
        order = np.argsort(axis_vals[m])
        cents, wids = [], []
        for half in (order[:len(order)//2], order[len(order)//2:]):
            if len(half) < 10:
                continue
            cen, wd = _profile_edges(cv[half], zv[half], zlev)
            if np.isfinite(wd):
                cents.append(cen); wids.append(wd)
        cen, wd = _profile_edges(cv, zv, zlev)
        if not np.isfinite(wd):
            continue
        pos.append(0.5 * (ed[i] + ed[i + 1]))
        ctr.append(cen); wid.append(wd)
        ctr_s.append(float(np.std(cents)) if len(cents) == 2 else 0.0)
        wid_s.append(float(np.std(wids)) if len(wids) == 2 else 0.0)
    return (np.array(pos), np.array(ctr), np.array(ctr_s),
            np.array(wid), np.array(wid_s))


def _slice_profile(cross_vals, z_vals, n_bins=120):
    """One slice's transverse median profile: `n_bins` equally spaced bins across
    the 1st-99th percentile span, median height per bin, bins with <2 points OMITTED
    (never interpolated). Returns (centers, zb) of the valid bins, or (None, None).
    This is the single source of the per-slice 120-bin profile used for BOTH the
    width (via `_profile_edges`) and the local depth (via `_slice_depths`)."""
    if len(cross_vals) < 10:
        return None, None
    lo, hi = np.percentile(cross_vals, 1), np.percentile(cross_vals, 99)
    if hi - lo < 1e-6:
        return None, None
    ed = np.linspace(lo, hi, n_bins + 1)
    cc = 0.5 * (ed[:-1] + ed[1:])
    bi = np.clip(np.searchsorted(ed, cross_vals, side="right") - 1, 0, n_bins - 1)
    zb = np.full(n_bins, np.nan)
    for j in range(n_bins):
        mm = bi == j
        if mm.sum() >= 2:
            zb[j] = np.median(z_vals[mm])
    good = np.isfinite(zb)
    return cc[good], zb[good]


def _floor_level_from_profile(zb, pctl=5):
    """Floor level of a cross-section profile in the leveled frame (field at z=0):
    the median height of the deepest `pctl`% of the profile bins. Channel depth is
    -floor_level. THIS IS THE SINGLE DEPTH DEFINITION applied identically to the
    aggregate mean cross-section and to every per-slice profile (same field level,
    floor-level rule, bin validity/no-interpolation, and sign convention)."""
    zb = np.asarray(zb, float)
    zb = zb[np.isfinite(zb)]
    if len(zb) < 2:
        return float("nan")
    return float(np.median(zb[zb <= np.percentile(zb, pctl)]))


def _profile_edges(cross_vals, z_vals, zlev, n_bins=120):
    """Channel center & width at zlev from a single slice's cross-section."""
    cc, zb = _slice_profile(cross_vals, z_vals, n_bins)
    if cc is None or len(cc) == 0:
        return float("nan"), float("nan")
    return _width_at(cc, zb, zlev)


def _slice_depths(axis_vals, cross_vals, z_vals, n_slices, a_lo, a_hi,
                  min_slice_pts=20, n_bins=120, floor_pctl=5):
    """Per-slice LOCAL channel depth, using the SAME depth definition as the
    aggregate cross-section (`_floor_level_from_profile`) applied to each slice's
    120-bin transverse profile. Slices are the same 80 non-overlapping longitudinal
    slices as the width extraction. Returns parallel arrays over ALL n_slices:
      pos    -- slice longitudinal center
      depth  -- local depth (NaN where invalid)
      valid  -- bool per slice
      reason -- rejection reason ('' when valid)"""
    ed = np.linspace(a_lo, a_hi, n_slices + 1)
    bi = np.clip(np.searchsorted(ed, axis_vals, side="right") - 1, 0, n_slices - 1)
    pos    = np.array([0.5 * (ed[i] + ed[i + 1]) for i in range(n_slices)])
    depth  = np.full(n_slices, np.nan)
    valid  = np.zeros(n_slices, dtype=bool)
    reason = ["" for _ in range(n_slices)]
    for i in range(n_slices):
        m = bi == i
        if m.sum() < min_slice_pts:
            reason[i] = "insufficient_points"; continue
        cc, zb = _slice_profile(cross_vals[m], z_vals[m], n_bins)
        if cc is None or len(zb) < 2:
            reason[i] = "empty_profile"; continue
        fl = _floor_level_from_profile(zb, floor_pctl)
        if not np.isfinite(fl):
            reason[i] = "no_floor"; continue
        depth[i] = float(-fl); valid[i] = True
    return pos, depth, valid, reason


# ── Public API ────────────────────────────────────────────────────────────────

def run_pvisual(file_path: str, params: dict = None, log_fn=print) -> dict:
    p = {**_PV_DEFAULTS, **(params or {})}
    t_total = time.time()

    # ── Step 1: Load ──────────────────────────────────────────────
    log_fn("=" * 55)
    log_fn("STEP 1 — Loading")
    log_fn("=" * 55)
    t0 = time.time()
    if file_path.lower().endswith('.x3p'):
        log_fn("  Format: X3P (ISO 25178-72) — coordinates in µm")
        xp, yp, zp = load_x3p(file_path, log_fn)        # noqa: F821 (injected in worker)
        points = np.column_stack([xp, yp, zp])
    else:
        delimiter = p["delimiter"] if p["delimiter"] is not None else _detect_delimiter(file_path, p["skip_rows"])
        points = np.loadtxt(file_path, delimiter=delimiter, skiprows=p["skip_rows"])
    x, y, z = points[:, 0], points[:, 1], points[:, 2]
    log_fn(f"  Loaded   : {len(points):,} points  [{time.time()-t0:.1f}s]")

    # ── Step 2: Crop edges ────────────────────────────────────────
    log_fn("\nSTEP 2 — Cropping edges")
    margin = p["margin"]
    mask   = ((x >= x.min() + margin) & (x <= x.max() - margin) &
              (y >= y.min() + margin) & (y <= y.max() - margin))
    points = points[mask]
    log_fn(f"  Margin {margin} → {len(points):,} points remaining")

    # ── Step 2.5: Despike — focus-variation spikes above the field AND deep
    #    optical dropouts far below any real channel feature ──────────
    dspk = float(p.get("despike_margin") or 0.0)
    dlow = float(p.get("despike_lower") or 0.0)
    if (dspk > 0 or dlow > 0) and len(points) > 1000:
        coarse = _voxel_downsample(points, 8.0)
        fc = _fit_field_plane(coarse, k=p.get("field_k", 2.5))
        resid = points[:, 2] - (fc[0] * points[:, 0] + fc[1] * points[:, 1] + fc[2])
        n0 = len(points)
        keep = np.ones(len(points), dtype=bool)
        if dspk > 0:
            keep &= (resid <= dspk)
        if dlow > 0:
            keep &= (resid >= -dlow)
        points = points[keep]
        log_fn(f"  Despike: removed {n0-len(points):,} pts outside field+[{-dlow:.0f},{dspk:.0f}]µm "
               f"({100*(n0-len(points))/n0:.2f}%)")

    # ── Step 3: Voxel downsample ──────────────────────────────────
    log_fn("\nSTEP 3 — Voxel downsampling")
    t0 = time.time()
    vs = p["voxel_size"]
    voxel_size = (max(points[:, 0].ptp(), points[:, 1].ptp()) / p["vsdivider"]
                  if (vs is None or vs <= 0) else float(vs))
    ds = _voxel_downsample(points, voxel_size)
    xd, yd, zd = ds[:, 0], ds[:, 1], ds[:, 2]
    log_fn(f"  voxel_size={voxel_size:.4f}  {len(points):,}→{len(ds):,} pts [{time.time()-t0:.1f}s]")

    # ── Step 4: Field-plane leveling + auto-orientation ───────────
    log_fn("\nSTEP 4 — Field-plane leveling + orientation")
    lev, converted, field_xz, field_yz = _level_and_orient(ds, p["field_k"], log_fn)
    depth_est = float(-np.percentile(lev[:, 2], 1))
    log_fn(f"  field tilt removed XZ={field_xz:.3f}° YZ={field_yz:.3f}°  depth≈{depth_est:.0f}")

    # ── Step 5: Channel-axis alignment ────────────────────────────
    log_fn("\nSTEP 5 — Channel-axis alignment")
    aligned, phi, channel_axis, var_pct = _align_axis(lev, depth_est)
    xr, yr, zr = aligned[:, 0], aligned[:, 1], aligned[:, 2]
    # Re-level in the ALIGNED frame so the field is truly flat at z=0 here. The
    # pre-rotation fit and a post-rotation fit can disagree by ~0.1° (mode-seed
    # picks slightly different inliers on the rotated data); re-leveling makes
    # the saved crop's field exactly flat — important for a clean gradient overlay.
    fc = _fit_field_plane(aligned, k=p["field_k"])
    zr = zr - (fc[0] * xr + fc[1] * yr + fc[2])
    aligned[:, 2] = zr
    fc2 = _fit_field_plane(aligned, k=p["field_k"])
    xz_tilt = float(np.degrees(np.arctan(fc2[0])))
    yz_tilt = float(np.degrees(np.arctan(fc2[1])))
    log_fn(f"  φ={phi:.3f}°  residual XZ={xz_tilt:.3f}° YZ={yz_tilt:.3f}°  var={var_pct:.1f}%")

    # ── Step 6: Display grids (square cells; display only) ────────
    log_fn("\nSTEP 6 — Display grids")
    cell = float(p.get("display_cell") or 0.0); sig = p["smooth_sigma"]
    XI_b, YI_b, ZI_b, cell_b = _pv_make_grid(xd, yd, zd, cell, sig, min_cell=voxel_size)
    XI_a, YI_a, ZI_a, cell_a = _pv_make_grid(xr, yr, zr, cell, sig, min_cell=voxel_size)
    log_fn(f"  square cells: raw {cell_b:.1f}, aligned {cell_a:.1f}  "
           f"(grids {ZI_b.shape[1]}x{ZI_b.shape[0]}, {ZI_a.shape[1]}x{ZI_a.shape[0]})")

    # ── Step 7: Geometry from the mean cross-section ──────────────
    log_fn("\nSTEP 7 — Cross-section geometry")
    floor_frac = p["floor_width_frac"]; open_frac = p["opening_frac"]

    # channel X-extent (length) and Y-extent (for cross-section window)
    xc_lo, xc_hi = _channel_extent(xr, zr, depth_est)
    in_x = (xr >= xc_lo) & (xr <= xc_hi)

    # cross-channel profile Z(Y) over the channel length
    yc, zb = _mean_profile(yr[in_x], zr[in_x])
    # Depth definition (shared with the per-slice depths, see _slice_depths):
    floor_level = _floor_level_from_profile(zb, pctl=5)
    mean_depth  = float(-floor_level)

    cen_y_f, floor_width   = _width_at(yc, zb, -floor_frac * mean_depth)
    cen_y_o, opening_width = _width_at(yc, zb, -open_frac  * mean_depth)

    # along-channel profile Z(X) over the central FLOOR band, so the median
    # tracks the floor depth (a wider window would average in walls/field and
    # never reach floor level on narrow channels -> NaN length).
    fw_for_band = floor_width if np.isfinite(floor_width) and floor_width > 0 else opening_width
    in_y = np.abs(yr - cen_y_f) <= max(fw_for_band * 0.35, 15.0)
    xc, zbx = _mean_profile(xr[in_y], zr[in_y])
    cen_x_f, mean_length    = _width_at(xc, zbx, -floor_frac * mean_depth)
    cen_x_o, opening_length = _width_at(xc, zbx, -open_frac  * mean_depth)

    if np.isfinite(floor_width) and np.isfinite(opening_width) and mean_depth > 0:
        dz = (floor_frac - open_frac) * mean_depth
        draft_angle = float(np.degrees(np.arctan2((opening_width - floor_width) / 2, dz)))
    else:
        draft_angle = float("nan")

    log_fn(f"  depth={mean_depth:.1f}  floorW={floor_width:.1f}  openW={opening_width:.1f}  "
           f"draft={draft_angle:.1f}°  length={mean_length:.0f}")

    # ── Step 8: Per-slice detection (plot overlays) ───────────────
    n_sl = int(p["n_slices"])
    rx, cy, cy_std, width_x, width_x_std = _slice_widths(
        xr, yr, zr, n_sl, mean_depth, floor_frac, xc_lo, xc_hi)
    yc_lo, yc_hi = _channel_extent(yr, zr, depth_est)
    ry, cx, cx_std, length_y, length_y_std = _slice_widths(
        yr, xr, zr, n_sl, mean_depth, floor_frac, yc_lo, yc_hi)

    # Per-slice LOCAL depth: same 80 non-overlapping longitudinal slices and same
    # transverse extent as the width extraction, same depth definition as the
    # aggregate cross-section. Additive -- does not alter any existing geometry.
    depth_pos, depth_x, depth_valid, depth_reason = _slice_depths(
        xr, yr, zr, n_sl, xc_lo, xc_hi)
    # central 80% by slice POSITION (first/last 10% of valid slices excluded), same
    # end-excluded convention as the width spread.
    depth_slice_std_c80 = _core_std(depth_x[depth_valid])

    # Channel center = centroid of the deep floor points. This is immune to the
    # end-ramp sensitivity of an extent midpoint and to the wall-slice bias of
    # the per-slice means, so the crop stays symmetric on the channel.
    deepm = zr < -0.5 * mean_depth
    center_x = float(np.mean(xr[deepm])) if deepm.any() else 0.0
    center_y = float(np.mean(yr[deepm])) if deepm.any() else 0.0
    mean_width      = floor_width
    mean_width_conf = _core_std(width_x)
    mean_length_conf = _core_std(length_y)

    # ── Crop box for the gradient module ──────────────────────────
    crop_x_min = center_x - (mean_length / 2 + p["crop_pad_x"])
    crop_x_max = center_x + (mean_length / 2 + p["crop_pad_x"])
    crop_y_min = center_y - (max(opening_width, floor_width) / 2 + p["crop_pad_y"])
    crop_y_max = center_y + (max(opening_width, floor_width) / 2 + p["crop_pad_y"])
    cmask = ((xr >= crop_x_min) & (xr <= crop_x_max) &
             (yr >= crop_y_min) & (yr <= crop_y_max))
    xc_pts, yc_pts, zc_pts = xr[cmask], yr[cmask], zr[cmask]
    log_fn(f"  Cropped {cmask.sum():,} points")

    # ── Step 9: Roughness (ISO 25178) — auto-placed, fixed-size regions ───
    log_fn("\nSTEP 9 — Roughness (ISO 25178)")
    # Floor strip: width keyed to NOMINAL (if given) so it is identical across
    # the insert->part chain; else fall back to the detected floor width.
    nominal   = float(p.get("nominal_width") or 0.0)
    floor_ref = nominal if nominal > 0 else floor_width
    fhx = p["floor_eval_length"] / 2.0
    fhy = floor_ref * p["floor_eval_frac"] / 2.0
    # Field strips: FIXED size, auto-placed past the lip (L and R kept separate).
    field_w  = p["field_eval_width"]
    field_hx = p["field_eval_length"] / 2.0
    tol      = max(p["field_tol_min"], p["field_tol_frac"] * mean_depth)
    opening_hw = (opening_width if (np.isfinite(opening_width) and opening_width > floor_width)
                  else floor_width) / 2.0

    floor_z_thr = -mean_depth * 0.70                  # bottom 30%
    surf_z_thr  = -mean_depth * 0.30                  # top 30% (field at 0)

    yL = _clean_field_start(yc, zb, opening_hw, tol, side=-1)
    yR = _clean_field_start(yc, zb, opening_hw, tol, side=+1)
    y_edge = max(yL, yR)             # farther edge for BOTH sides -> symmetric strips
    sl_y_max = -y_edge;  sl_y_min = -y_edge - field_w
    sr_y_min =  y_edge;  sr_y_max =  y_edge + field_w
    log_fn(f"  field edge L={yL:.0f} R={yR:.0f} -> sym {y_edge:.0f} (tol={tol:.1f})  strip {field_w:.0f}x{2*field_hx:.0f}")

    def _rgh(m):
        return _roughness_region(xr[m], yr[m], zr[m])

    floor_mask = (np.abs(xr) < fhx) & (np.abs(yr) < fhy) & (zr <= floor_z_thr)
    sl_mask = ((np.abs(xr) < field_hx) &
               (yr >= sl_y_min) & (yr <= sl_y_max) & (zr >= surf_z_thr))
    sr_mask = ((np.abs(xr) < field_hx) &
               (yr >= sr_y_min) & (yr <= sr_y_max) & (zr >= surf_z_thr))
    floor_rgh, sl_rgh, sr_rgh = _rgh(floor_mask), _rgh(sl_mask), _rgh(sr_mask)

    roughness_regions = {
        "floor":      {"x_min": float(-fhx), "x_max": float(fhx),
                       "y_min": float(-fhy), "y_max": float(fhy)},
        "surf_left":  {"x_min": float(-field_hx), "x_max": float(field_hx),
                       "y_min": float(sl_y_min), "y_max": float(sl_y_max)},
        "surf_right": {"x_min": float(-field_hx), "x_max": float(field_hx),
                       "y_min": float(sr_y_min), "y_max": float(sr_y_max)},
    }

    rgh_extra = max(20.0, field_w * 0.2)
    rgh_y_min = float(sl_y_min) - rgh_extra
    rgh_y_max = float(sr_y_max) + rgh_extra
    rgh_vis_mask = ((xr >= crop_x_min) & (xr <= crop_x_max) &
                    (yr >= rgh_y_min) & (yr <= rgh_y_max))
    XI_rgh, YI_rgh, ZI_rgh, cell_r = _pv_make_grid(
        xr[rgh_vis_mask], yr[rgh_vis_mask], zr[rgh_vis_mask], cell, sig,
        u_range=(float(crop_x_min), float(crop_x_max)),
        v_range=(rgh_y_min, rgh_y_max), min_cell=voxel_size)

    if cmask.sum():
        _, _, ZI_crop, cell_c = _pv_make_grid(xc_pts, yc_pts, zc_pts, cell, sig, min_cell=voxel_size)
    else:
        ZI_crop, cell_c = np.full((2, 2), np.nan), float("nan")
    log_fn(f"  display cells: crop {cell_c:.1f}, roughness view {cell_r:.1f}  "
           f"(grids {ZI_crop.shape[1]}x{ZI_crop.shape[0]}, {ZI_rgh.shape[1]}x{ZI_rgh.shape[0]})")

    log_fn(f"\nTotal time: {time.time()-t_total:.1f}s\nDone.")

    return {
        "rotation": {
            "phi":          float(phi),
            "xz_tilt":      float(xz_tilt),
            "yz_tilt":      float(yz_tilt),
            "var_pct":      float(var_pct),
            "voxel_size":   float(voxel_size),
            "channel_axis": channel_axis.tolist(),
            "converted":    bool(converted),
            "field_tilt_xz": field_xz,
            "field_tilt_yz": field_yz,
        },
        "channel": {
            "center_x":           float(center_x),
            "center_y":           float(center_y),
            "center_x_conf":      _core_std(cx),
            "center_y_conf":      _core_std(cy),
            "mean_width":         float(mean_width),
            "mean_width_conf":    float(mean_width_conf),
            "mean_length":        float(mean_length),
            "mean_length_conf":   float(mean_length_conf),
            "mean_depth":         float(mean_depth),
            # per-slice local-depth spread: SD of the valid per-slice depths over the
            # central 80% of the channel length (first/last 10% of valid slices
            # excluded by position). Same depth definition as mean_depth, applied to
            # each slice. Describes within-scan longitudinal depth variation.
            "channel_depth_slice_std_central80": float(depth_slice_std_c80),
            "opening_width":      float(opening_width),
            "opening_width_conf": _core_std(width_x),
            "opening_length":     float(opening_length),
            "opening_length_conf": _core_std(length_y),
            "floor_width":        float(floor_width),
            # Standard deviation of the per-slice floor widths over the CENTRAL 80%
            # of the channel length, after EXCLUDING the first and last 10% of slices
            # (the end regions). _core_std trims by SLICE POSITION, not by value, so
            # this is an end-excluded longitudinal SD -- NOT a value-based trimmed
            # SD and NOT a confidence interval. It describes within-scan longitudinal
            # width variation. floor_width_frac = 0.90 (crossing at 90% of depth).
            "floor_width_slice_std_central80": float(mean_width_conf),
            "floor_width_conf":              float(mean_width_conf),  # LEGACY ALIAS
            "floor_width_slice_std_trimmed": float(mean_width_conf),  # LEGACY ALIAS
            "floor_width_frac":   float(floor_frac),
            "draft_angle_deg":    float(draft_angle),
            "z_search_frac":      float(floor_frac),
        },
        "grids": {
            "before": {"XI": XI_b, "YI": YI_b, "ZI": ZI_b,
                       "xd": xd, "yd": yd, "zd": zd,
                       "channel_axis": channel_axis},
            "after":  {"XI": XI_a, "YI": YI_a, "ZI": ZI_a,
                       "xr": xr, "yr": yr, "zr": zr},
            "crop":   {"ZI": ZI_crop, "x": xc_pts, "y": yc_pts, "z": zc_pts,
                       "x_min": float(crop_x_min), "x_max": float(crop_x_max),
                       "y_min": float(crop_y_min), "y_max": float(crop_y_max)},
            # side of the square display cells actually used (units of the file)
            "cells":  {"before": float(cell_b), "after": float(cell_a),
                       "crop": float(cell_c), "roughness": float(cell_r)},
        },
        "slices": {
            "rx": rx, "cy": cy, "cy_std": cy_std,
            "width_x": width_x, "width_x_std": width_x_std,
            "ry": ry, "cx": cx, "cx_std": cx_std,
            "length_y": length_y, "length_y_std": length_y_std,
            # per-slice local depth over ALL n_slices (NaN where invalid), with
            # longitudinal positions, validity, and rejection reasons.
            "depth_pos": depth_pos, "depth_x": depth_x,
            "depth_valid": depth_valid, "depth_reason": depth_reason,
            "crop_box": {"x_min": float(crop_x_min), "x_max": float(crop_x_max),
                         "y_min": float(crop_y_min), "y_max": float(crop_y_max)},
        },
        "profile": {
            # aggregate mean cross-section on which the reported floor width is
            # measured (auditable without the raw cloud). yc = transverse centers,
            # zb = median height per transverse bin (field at z=0, channel below).
            "yc": yc, "zb": zb,
            "floor_level":     float(floor_level),
            "floor_threshold": float(-floor_frac * mean_depth),
            "open_threshold":  float(-open_frac * mean_depth),
            "floor_edge_left":  float(cen_y_f - floor_width / 2) if np.isfinite(floor_width) else float("nan"),
            "floor_edge_right": float(cen_y_f + floor_width / 2) if np.isfinite(floor_width) else float("nan"),
            "open_edge_left":   float(cen_y_o - opening_width / 2) if np.isfinite(opening_width) else float("nan"),
            "open_edge_right":  float(cen_y_o + opening_width / 2) if np.isfinite(opening_width) else float("nan"),
        },
        "cropped_cloud": np.column_stack([xc_pts, yc_pts, zc_pts]),
        "roughness": {
            "floor": floor_rgh, "surf_left": sl_rgh, "surf_right": sr_rgh,
            "regions": roughness_regions,
            "vis_grid": {"ZI": ZI_rgh,
                         "x_min": float(XI_rgh[0, 0]),  "x_max": float(XI_rgh[0, -1]),
                         "y_min": float(YI_rgh[0, 0]),  "y_max": float(YI_rgh[-1, 0])},
        },
    }


def crop_to_text(result, fmt="%.6f"):
    """The exported crop (one 'x y z' line per point, units of the input file) as text.
    Built on demand so the point list never travels to the interface as JSON."""
    buf = io.StringIO()
    np.savetxt(buf, np.asarray(result["cropped_cloud"], float), fmt=fmt, delimiter=" ")
    return buf.getvalue()
