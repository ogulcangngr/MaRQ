"""Tests of MaRQ's analysis modules without a browser: the surface analysis (pvisual_core.py),
the comparison (rq_gradient_core.py), the X3P reader and the figures, run as the engine runs
them (all modules in one namespace) with the settings of the interface (the paper defaults).

Two kinds of test:
- known answers: synthetic channels of known shape, so the measured widths, depth, wall angle
  and length, and the correlations of a surface with itself, are known in advance;
- recorded numbers: the results for the synthetic channel and its copy are kept in
  tests/test_cores_expected.json and must stay the same (to 1e-6), so any change of a result,
  wanted or not, shows here; and the comparison must match the browser's
  (tests/test_features_expected.json, to 1e-4).

    python tests/test_cores.py            run every test
    python tests/test_cores.py --record   write tests/test_cores_expected.json again
    pytest tests/test_cores.py            the same with pytest

MaRQ's runtime (Pyodide 314.0.7) has Python 3.14, NumPy 2.4.6 and SciPy 1.18.0; the GitHub check runs
these tests with the same versions.
"""
import os, sys, json, math, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EXPECTED = os.path.join(HERE, "test_cores_expected.json")

# the modules in one namespace, as worker.js runs them
M = {"__name__": "marq_engine"}
for _f in ("x3p_loader.py", "pvisual_core.py", "rq_gradient_core.py", "plots.py"):
    exec(compile(open(os.path.join(ROOT, _f), encoding="utf-8").read(), _f, "exec"), M)

# the settings MaRQ's interface sends (index.html, the paper defaults)
UI = dict(margin=100, voxel_size=5, display_cell=0, smooth_sigma=0, n_slices=80, opening_frac=0.10,
          floor_width_frac=0.90, crop_pad_x=180, crop_pad_y=100, skip_rows=0, field_k=2.5,
          floor_eval_frac=0.5, floor_eval_length=4000, field_eval_width=400, field_eval_length=4000)
UI_CMP = dict(grid_spacing=5, smooth_sigma=0, skip_rows=0)
TAN10 = math.tan(math.radians(10))
quiet = lambda *a, **k: None
TMP = tempfile.mkdtemp(prefix="marq_cores_")


def channel(W=600.0, D=300.0, L=4000.0, seed=7, noise=0.5, texture=0.0, rotate=0.0, tilt=(0.0, 0.0),
            protrusion=False, round2=True, pitch=5.0, scattered=False):
    """A channel as tests/make_test_channel.py makes it: floor W wide, D deep, 10° walls, L long,
    in a flat field, on a 5 µm grid with Gaussian noise; optionally a texture of lines across
    the surface (texture: its amplitude, µm), turned in the plane by `rotate` degrees, the field
    tilted (slopes in x and y), or upside down (a ridge); another grid `pitch`, or each point
    placed at random within its grid cell (`scattered`, as a CAD model sampled at random).
    Coordinates rounded to 0.01 µm, as the text file is written."""
    x = np.arange(0.0, L + 1000.0, pitch)
    y = np.arange(-900.0, 900.0 + 1e-9, pitch)
    X, Y = np.meshgrid(x, y)
    if scattered:
        rng = np.random.default_rng(seed + 1000)
        X, Y = X + rng.uniform(0, pitch, X.shape), Y + rng.uniform(0, pitch, Y.shape)
    dist = np.maximum(np.clip(np.abs(Y) - W / 2, 0, None), np.clip(np.maximum(500.0 - X, X - (L + 500.0)), 0, None))
    Z = -np.clip(D - dist / TAN10, 0, D)
    Z = Z + np.random.default_rng(seed).normal(0, noise, Z.shape)
    if texture:
        Z = Z + texture * (np.sin(2 * np.pi * (0.866 * X + 0.5 * Y) / 100) + 0.48 * np.sin(2 * np.pi * (0.5 * X - 0.866 * Y) / 37))
    if protrusion:
        Z = -Z
    Z = Z + tilt[0] * X + tilt[1] * Y
    if rotate:
        a = math.radians(rotate)
        X, Y = X * math.cos(a) - Y * math.sin(a), X * math.sin(a) + Y * math.cos(a)
    P = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()])
    return np.round(P, 2) if round2 else P


def analyse(P):
    return M["run_pvisual"](P, dict(UI), quiet)


def crop_file(result, name):
    path = os.path.join(TMP, name)
    with open(path, "w") as f:
        f.write(M["crop_to_text"](result))
    return path


def compare(path_a, path_b):
    return M["run_rq_gradient"](path_a, path_b, dict(UI_CMP), quiet)


_cache = {}
def base():
    """The synthetic channel and its copy (tests/make_test_channel.py, seeds 7 and 8), analysed
    and compared as MaRQ does: analysis, crop as text, comparison of the two crop files."""
    if not _cache:
        ra, rb = analyse(channel(seed=7)), analyse(channel(W=604.0, D=297.0, seed=8))
        _cache.update(ra=ra, rb=rb, cmp=compare(crop_file(ra, "a.txt"), crop_file(rb, "b.txt")))
    return _cache


def near(a, b, tol):
    return a is not None and b is not None and abs(a - b) <= tol


# ── known answers: the surface analysis ─────────────────────────────────────────

def test_known_channel_geometry():
    ch = base()["ra"]["channel"]
    assert near(ch["mean_depth"], 300.0, 0.3), ch["mean_depth"]
    assert near(ch["floor_width"], 600 + 2 * 30 * TAN10, 0.3), ch["floor_width"]          # at 90 % of the depth
    assert near(ch["opening_width"], 600 + 2 * 270 * TAN10, 0.3), ch["opening_width"]     # at 10 %
    assert near(ch["wall_angle_deg"], 10.0, 0.1), ch["wall_angle_deg"]
    assert near(ch["wall_angle_left_deg"], 10.0, 0.2) and near(ch["wall_angle_right_deg"], 10.0, 0.2)
    assert near(ch["mean_length"], 4000 + 2 * 30 * TAN10, 0.5), ch["mean_length"]
    assert ch["wall_angle_resolved"] is True


def test_turned_and_tilted_scan():
    ref = base()["ra"]["channel"]
    ch = analyse(channel(rotate=25.0, tilt=(0.004, -0.003)))["channel"]
    for k, tol in (("floor_width", 0.6), ("opening_width", 0.6), ("mean_depth", 0.5), ("wall_angle_deg", 0.2), ("mean_length", 1.5)):
        assert near(ch[k], ref[k], tol), (k, ch[k], ref[k])


def test_raised_feature_turned_over():
    # a ridge 300 um high: the despike step would remove it with the spikes above the field, so
    # it is turned over first when Settings say the feature is raised (turn_over)
    r = M["run_pvisual"](channel(protrusion=True), {**UI, "turn_over": True}, quiet)
    assert r["rotation"]["converted"] is True and r["rotation"]["turned_over"] is True
    assert near(r["channel"]["mean_depth"], 300.0, 0.5), r["channel"]["mean_depth"]
    assert near(r["channel"]["floor_width"], 600 + 2 * 30 * TAN10, 0.6), r["channel"]["floor_width"]
    assert near(r["channel"]["wall_angle_deg"], 10.0, 0.2)


def test_low_ridge_turned_over_by_itself():
    # a ridge lower than the despike margin (40 um) is found and turned over without the setting
    r = analyse(channel(D=30.0, protrusion=True))
    assert r["rotation"]["converted"] is True and r["rotation"]["turned_over"] is False
    assert near(r["channel"]["mean_depth"], 30.0, 0.5), r["channel"]["mean_depth"]


def test_automatic_voxel_size():
    r = M["run_pvisual"](channel(), {**UI, "voxel_size": 0}, quiet)
    assert r["rotation"]["voxel_size"] > 0 and near(r["channel"]["mean_depth"], 300.0, 1.0)


def test_points_from_a_file_and_from_an_array_agree():
    P = channel()
    path = os.path.join(TMP, "channel.txt")
    np.savetxt(path, P, fmt="%.2f")
    a, b = M["run_pvisual"](path, dict(UI), quiet)["channel"], base()["ra"]["channel"]
    for k in ("floor_width", "opening_width", "mean_depth", "wall_angle_deg", "mean_length"):
        assert a[k] == b[k], (k, a[k], b[k])


def test_crop_text_keeps_the_points():
    r = base()["ra"]
    back = np.loadtxt(crop_file(r, "roundtrip.txt"))
    assert back.shape == np.asarray(r["cropped_cloud"]).shape
    assert np.abs(back - np.asarray(r["cropped_cloud"])).max() <= 5e-7


def test_voxels_with_a_shared_key_stay_apart():
    # (ix, iy + 991, iz + 84) and (ix + 1, iy, iz) shared the key of the first 1.0 release
    pts = np.array([[0.2, 0.2, 0.2], [0.3, 991.3, 84.3], [1.4, 0.4, 0.4], [0.25, 0.25, 0.25]])
    out = M["_voxel_downsample"](pts, 1.0)
    assert len(out) == 3, out
    assert any(np.allclose(o, [0.3, 991.3, 84.3]) for o in out) and any(np.allclose(o, [1.4, 0.4, 0.4]) for o in out)


def test_voxel_thinning_is_the_mean_per_voxel():
    rng = np.random.default_rng(3)
    pts = rng.uniform(0, 50, (5000, 3))
    out = M["_voxel_downsample"](pts, 5.0)
    idx = np.floor((pts - pts.min(axis=0)) / 5.0).astype(int)
    keys, inv = np.unique(idx, axis=0, return_inverse=True)
    inv = inv.ravel()
    ref = np.array([pts[inv == i].mean(axis=0) for i in range(len(keys))])
    assert len(out) == len(ref)
    a, b = out[np.lexsort(out.T[::-1])], ref[np.lexsort(ref.T[::-1])]
    assert np.abs(a - b).max() < 1e-9


# ── known answers: the comparison ───────────────────────────────────────────────

def test_a_surface_compared_with_itself():
    p = crop_file(base()["ra"], "self.txt")
    m = compare(p, p)["metrics"]
    for k in ("r_z", "r_gx", "r_gy", "r_mag"):
        assert abs(m[k] - 1.0) < 1e-12, (k, m[k])
    assert m["z_flip"] is False


def test_a_copy_turned_half_round_is_turned_back():
    r = base()["ra"]
    P = np.asarray(r["cropped_cloud"], float).copy()
    P[:, :2] *= -1
    path = os.path.join(TMP, "turned.txt")
    np.savetxt(path, P, fmt="%.6f")
    m = compare(crop_file(r, "a.txt"), path)["metrics"]
    assert m["z_flip"] is True
    assert abs(m["r_mag"] - 1.0) < 1e-9 and abs(m["r_z"] - 1.0) < 1e-9


def test_grid_cell_is_the_stated_spacing():
    m = base()["cmp"]["metrics"]
    assert near(m["cell_um"][0], 5.0, 1e-9) and near(m["cell_um"][1], 5.0, 1e-9), m["cell_um"]


def test_a_lattice_copy_moved_less_than_half_a_cell():
    # points on an axis-aligned 5 µm lattice, as gridded instrument files and synthetic
    # surfaces have them: the cells are centred on the grid points, so a copy moved by 0.3 µm
    # puts every point in the same cell (cells running from one grid point to the next had
    # their edges on the lattice, and the copy fell one cell over)
    P = channel(L=1000.0, texture=2.5, seed=17) - [1000.0, 0.0, 0.0]   # about the origin, as crops are
    a, b = os.path.join(TMP, "lattice_a.txt"), os.path.join(TMP, "lattice_b.txt")
    np.savetxt(a, P, fmt="%.2f")
    np.savetxt(b, P + [0.3, 0.3, 0.0], fmt="%.2f")
    m = compare(a, b)["metrics"]
    assert near(m["r_mag"], 1.0, 1e-9) and near(m["r_z"], 1.0, 1e-9), (m["r_z"], m["r_mag"])


def test_idealised_reference_found_by_its_smooth_floor():
    smooth = analyse(channel(noise=0.1, seed=11))
    rough = analyse(channel(noise=0.5, texture=2.5, seed=12))
    rough2 = analyse(channel(W=604.0, D=297.0, noise=0.5, texture=2.5, seed=13))
    ideal = compare(crop_file(smooth, "smooth.txt"), crop_file(rough, "rough.txt"))["metrics"]
    real = compare(crop_file(rough, "rough.txt"), crop_file(rough2, "rough2.txt"))["metrics"]
    assert ideal["cad_mode"] is True and ideal["primary"] == "r_z", ideal["texture_um"]
    assert real["cad_mode"] is False and real["primary"] == "r_mag", real["texture_um"]


def test_a_narrow_idealised_channel_is_recognised():
    # on a narrow floor the cells at the foot of the walls, which average floor and wall
    # points, were a large share of the floor and read as texture (100 µm CAD: 3.4 µm); the
    # ideal surface is sampled more sparsely than the grid, as the CAD references are, so
    # many of its cells are empty
    ideal = analyse(channel(W=100.0, L=1500.0, noise=0.0, seed=21, pitch=6.0, scattered=True))
    rough = analyse(channel(W=104.0, D=297.0, noise=0.5, texture=2.5, seed=22))
    m = compare(crop_file(ideal, "ideal100.txt"), crop_file(rough, "rough100.txt"))["metrics"]
    assert m["cad_mode"] is True and m["texture_um"][0] < 0.5 and m["texture_um"][1] > 1.5, m["texture_um"]


# ── the X3P reader ──────────────────────────────────────────────────────────────

def test_x3p_file_in_micrometres():
    import subprocess
    path = os.path.join(TMP, "test_channel.x3p")
    subprocess.run([sys.executable, os.path.join(HERE, "make_test_x3p.py"), path], check=True, capture_output=True)
    x, y, z = M["load_x3p"](path, quiet)
    assert near(float(np.ptp(x)), 1190.0, 1e-6) and near(float(np.ptp(y)), 490.0, 1e-6)     # 120 x 50 points, 10 µm apart
    r = M["run_pvisual"](path, {**UI, "crop_pad_x": 100, "crop_pad_y": 50, "margin": 20}, quiet)   # as in README.md
    assert near(r["channel"]["mean_depth"], 60.0, 1.0), r["channel"]["mean_depth"]


# ── the figures ─────────────────────────────────────────────────────────────────

def test_figures_build_in_both_languages():
    c = base()
    for lang in ("en", "tr"):
        M["set_language"](lang)
        for theme in ("light", "dark"):
            M["set_theme"](theme)
            figs = {**M["build_pvisual_figs"](c["ra"], 200000, "Earth"), **M["build_gradient_figs"](c["cmp"], 200000, "Earth")}
            json.loads(M["figures_to_json"](figs))
            assert {"channel", "profiles_xsection", "view3d", "gradheight", "gradslope"} <= set(figs)
    M["set_language"]("en")


# ── recorded numbers ────────────────────────────────────────────────────────────

CH_KEYS = ("floor_width", "opening_width", "mid_width", "mean_depth", "wall_angle_deg", "floor_corner_um",
           "rim_corner_um", "mean_length", "opening_length", "channel_depth_slice_std_central80")
CMP_KEYS = ("r_z", "r_gx", "r_gy", "r_mag", "rmse_z", "rmse_mag")


def numbers():
    c = base()
    out = {}
    for name in ("ra", "rb"):
        r = c[name]
        out[name] = {k: r["channel"][k] for k in CH_KEYS}
        out[name]["floor_Sa"] = r["roughness"]["floor"]["Sa"]
        out[name]["field_Sq"] = r["roughness"]["surf_left"]["Sq"]
        out[name]["crop_points"] = int(len(r["cropped_cloud"]))
    out["cmp"] = {k: c["cmp"]["metrics"][k] for k in CMP_KEYS}
    out["cmp"]["n_mask"] = int(c["cmp"]["metrics"]["n_mask"])
    return out


def test_recorded_numbers_unchanged():
    if not os.path.exists(EXPECTED):
        raise AssertionError("no recorded numbers: run python tests/test_cores.py --record")
    exp, got = json.load(open(EXPECTED)), numbers()
    bad = [(g, k, got[g][k], exp[g][k]) for g in exp for k in exp[g]
           if not (abs(got[g][k] - exp[g][k]) <= 1e-6 * max(1.0, abs(exp[g][k])))]
    assert not bad, bad


def test_comparison_matches_the_browser():
    exp = json.load(open(os.path.join(HERE, "test_features_expected.json")))     # written by e2e_features.py
    m = base()["cmp"]["metrics"]
    assert all(abs(round(m[k], 5) - exp[k]) <= 1e-4 for k in exp), ({k: m[k] for k in exp}, exp)


# ── running without pytest ──────────────────────────────────────────────────────

if __name__ == "__main__":
    if "--record" in sys.argv:
        json.dump(numbers(), open(EXPECTED, "w"), indent=1)
        print("recorded", EXPECTED)
    import numpy, scipy
    print(f"Python {sys.version.split()[0]}, NumPy {numpy.__version__}, SciPy {scipy.__version__}")
    tests = [(n, f) for n, f in list(globals().items()) if n.startswith("test_") and callable(f)]
    failed = 0
    for name, f in tests:
        try:
            f(); print("   ok ", name)
        except Exception as e:
            failed += 1; print("   BAD", name, "  ", repr(e)[:400])
    print(f"{'PASS' if not failed else 'FAIL'} ({len(tests) - failed} of {len(tests)})")
    sys.exit(1 if failed else 0)
