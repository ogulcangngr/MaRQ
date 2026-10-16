# Changelog

## 1.0 (2026-10)

The version used for the Measurement paper. The geometry of the single-surface module
is read in a new way; RQ, RQdx, RQdy, RQd and the depth are computed as in 0.9, but
the exported crop and the roughness strips are placed from the new widths and length,
so every downstream number was recomputed.

- Widths on grid lines. The aligned points are averaged on a grid (cells of one voxel
  across the channel, lines two voxels apart along it) over the central 80 % of the
  channel length, the rounded channel ends excluded. On every line the wall position
  at a level is where the height profile first rises above the level, moving outwards
  from the channel centre line, interpolated linearly between the two grid points that
  bracket it (at most three empty cells between them). The floor, mid-depth and
  opening widths (90, 50 and 10 % of the depth) are the medians over the lines, and
  their standard deviations the longitudinal spreads. 0.9 took the span of the
  outermost bin centres of the pooled cross-section below the level, without
  interpolation: widths were quantised to the bin (about 7.5 um; 25 um per slice) and
  read short by up to 15 um on the CAD references, whose widths the new reading
  recovers within 0.1 um.
- Wall angle. The draft of 0.9 was the chord between the wall positions at the two
  width levels, which mixes the wall inclination with the rounding of the corners. The
  wall angle is now a straight line through the wall positions at 25, 37.5, 50, 62.5
  and 75 % of the depth on every grid line, median over the lines and both walls,
  measured from the vertical and negative for an undercut; left and right are also
  given. It recovers the 10 deg of the CAD references within 0.02 deg. Walls steeper
  than about 3 deg span too few grid cells to be resolved and are flagged. The chord
  angle is kept as chord_angle_deg; draft_angle_deg now holds the wall angle.
- Corner rounding. How far the wall lies inside the extended mid-wall line at the
  floor level (floor corner) and outside it at the opening level (rim corner), in um.
- Length on grid lines along the channel, near its centre line. Each end is read from
  the outside in (the outermost run of at least three cells below the level, and the
  interpolated crossing just outside it), so a floor that undulates across the level
  along a worn insert or a partly filled part does not end the length early; 0.9 read
  the length short by 30 to 110 um on synthetic channels. The crop box spans the two
  measured ends plus the pad; if no end is found (a mislevelled, warped field), it
  falls back to the channel extent and the log says so.
- The per-slice width and length overlays are replaced by the per-line values; the
  per-slice depth is unchanged. run_pvisual also accepts a point array (tests).
- Windows launcher `MaRQ.bat` (2026-10-16): the window stays open with a message
  when Python is missing (the Microsoft Store placeholder is no longer taken for
  Python), when MaRQ is started from inside the zip, or when the server stops with
  an error; the `py` launcher is found again; Windows line endings. No analysis
  change.

## 0.9 (2026-09-30)

The version the author's MS thesis is based on, kept as tag v0.9. It was labelled
1.0 until 2026-10-01, when it was relabelled 0.9 because the geometry extraction was
revised for the release that follows. Builds of 2026-09-17 and 2026-09-28 existed in
the private repository; the analysis modules give identical results (checked on the
sample channel: geometry, roughness, RQ, RQdx, RQdy, RQd and the exported crop).

Compared with the internal "Microchannel Analyzer" 0.6.0:

- Renamed to MaRQ, the Microchannel and Replication Quality Analyzer. The
  developer's name was removed from the interface; the credits show the tool
  name, the version and the repository. The bundled Satoshi web fonts were
  replaced by the system font stack (their licence does not permit
  redistribution). Interface defaults set to the values used in the paper:
  Voxel size 5 (was 10), Crop pad X 180 (was 250), Crop pad Y 100 (was 150).
  Two prototype modules never loaded by the application are not shipped.
- Analysis core: the numbers are unchanged from 0.6.0. `pvisual_core.py` now
  builds its display grids with square cells ("Display cell size", 0 = auto,
  replaces "Grid resolution"; on the exported crop the cells used to be seven
  times longer along the channel than across) and produces the crop text on
  demand (`crop_to_text`). `rq_gradient_core.py` logs the kept orientation of
  surface B (the log used to show the rejected one) and reports the mask size,
  the valid-cell count and the grid cell.
- Plots (`plots.py`, rewritten): units on every axis and colourbar; the
  alignment panel's axes no longer overprint; channel detection in one panel;
  profile plots with free axes in µm and separate width and length subplots;
  a mean cross-section and per-slice depth figure; 3D views that frame the
  whole channel at its true proportions; a "1:1 axes" switch (on by default)
  that gives every 2D plot of lengths the same scale on both axes, with the
  comparison maps stacked one per row for long channels; comparison maps with the height
  and slope-magnitude maps of both surfaces, E_Z and E_d, and the outline of
  the channel-interior mask, on the shared actual colour ranges; the bar chart
  that repeated the card values is gone; the palette applies to every height
  map.
- Interface: three file slots (the surface to analyse, Surface A, Surface B)
  with a workflow strip and crop hand-over buttons ("Use as A", "Use as B");
  batch comparison of A against several files with a results table; the
  paper's names on the cards (RQ, RQdx, RQdy, RQd) with units and no colour
  grading or interpretation; live log with
  step progress and a cancel button that restarts the engine; figure export
  dialog (SVG or PNG, light or current theme, chosen size) and per-plot SVG
  button; results export as JSON and CSV; parameter presets ("Paper
  defaults"), save and load, marking of changed values, values remembered in
  the browser; collapsible sidebar and log; About dialog; results bar that
  wraps instead of clipping on narrow windows; texts revised.
- Offline bundle: `vendor/` carries Plotly.js 2.35.2 and Pyodide 0.26.4 with
  NumPy 1.26.4, SciPy 1.12.0 and OpenBLAS (84 MB, fetched and verified by
  `tools/fetch_vendor.py`); the page loads them first and falls back to the
  CDNs only when they are missing. Launchers `run_marq.py`, `MaRQ.bat` and
  `MaRQ.command` serve the folder and open the browser.
- `tests/make_test_x3p.py` writes its test file next to itself.
