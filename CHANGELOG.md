# Changelog

## 1.0 (2026-09-28)

First public release; the version used for the Measurement paper. A 1.0 build of
2026-09-17 existed in the private repository and was superseded by this one before
any public release. The analysis modules give identical results (checked on the
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
