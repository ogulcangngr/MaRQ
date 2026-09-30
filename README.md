# MaRQ: the Microchannel and Replication Quality Analyzer

MaRQ measures microchannels in optical-profilometry point clouds and grades how
faithfully a channel has been replicated from a mould insert into a moulded part.
It runs entirely in the browser: the analysis core is Python (NumPy, SciPy)
executed through Pyodide, so nothing is installed and no measurement data leave
your computer. With the runtime bundled in `vendor/` it also works without an
internet connection.

Two workflows share one loading and preprocessing framework:

- **Single surface.** Levels the field, aligns the channel axis, detects floor and
  opening, and reports width, depth, draft and ISO 25178 roughness of the floor and
  the field, with the mean cross-section and the depth of every slice. Exports a
  levelled, aligned crop of the channel.
- **Two surfaces.** Registers two crops on a common grid and computes the height
  correlation RQ, the directional slope correlations RQdx and RQdy, and RQd, the
  full-surface slope-magnitude correlation over the channel interior shared by the
  two surfaces, with the height error map E_Z and the slope error map E_d. A batch
  mode compares one reference with several surfaces.

RQd and the software are described in: M. O. Güngör, J. Charmet, E. Yıldırım,
*A 3D measurement workflow for assessing replication quality and tool degradation
in moulded microfluidic channels*, Measurement (submitted, 2026). The companion archive, with the software,
one sample channel with its expected results, and the point clouds of the study, is on Zenodo:
https://doi.org/10.5281/zenodo.22813916 (restricted until the article is published).

## Running MaRQ

The page has to come from an HTTP server (a `file://` page cannot start the Python
worker), so a small local server is started for you:

- **Windows:** double-click `MaRQ.bat`.
- **macOS:** double-click `MaRQ.command` (the first time: right-click, Open).
  **Linux:** `sh MaRQ.command`.
- **Any system with Python 3:** `python run_marq.py` in this folder.

The launcher serves the folder on `127.0.0.1`, opens the browser and prints the
address; press Ctrl+C or close the window to stop. Python only serves the files, the
analysis runs in the browser. Without Python, any static server does the same job
(`npx serve` from Node.js, the Live Server extension of VS Code, `git clone` then
`python -m http.server 8000` as before). Browsers: Chrome, Edge or Firefox, current
versions.

**Offline.** `vendor/` holds Plotly.js and the Pyodide runtime with NumPy and SciPy
(84 MB; versions and licences in `vendor/README.md`), so the first start needs no
download and the status bar reads "Ready (offline bundle)". If `vendor/` is missing,
for example after a source-only download, the page falls back to the CDNs and needs
internet for the first start; `python tools/fetch_vendor.py` restores the bundle.

## The window

The sidebar holds the workflow strip (three steps), the single-surface input, the
comparison inputs with the batch list, the export buttons and the parameters. The
centre shows tabs that appear as results become available and, below them, the
results bar with the numbers. The right panel is the Analysis Log, streamed live,
with every step and quality-control value. The header has the height palette, the
3D detail, the theme, buttons to hide the sidebar and the log, and About. A running
analysis can be cancelled; the engine restarts in a few seconds.

The maps and the 3D views are drawn on square display cells (a few micrometres,
chosen automatically and reported in the log); they are for display only, the
numbers come from the points and, for the comparison, from the common grid at the
stated spacing. The 3D views keep the true proportions of the channel (no vertical
exaggeration). With **1:1 axes** (header, on by default) every 2D plot whose two
axes are lengths uses the same scale on both, so the channel keeps its shape and a
variation is shown in proportion to the channel's size; switch it off to let each
axis fill the panel when a small variation has to be read.

## Input formats

- Delimited text point clouds: `.txt`, `.xyz`, `.asc`, `.csv`, three columns x y z,
  any common delimiter, header rows skipped with *Skip rows*. Units are those of the
  file; the paper's data are in micrometres.
- ISO 25178-72 X3P files (`.x3p`), converted to micrometres on loading.

To test the X3P path without an instrument file, run `python tests/make_test_x3p.py`.
It writes `tests/test_channel.x3p`, a synthetic 1.2 mm by 0.5 mm surface with a
parabolic channel 200 µm wide and 60 µm deep on a 10 µm grid. Analyse it with Crop
pad X 100, Crop pad Y 50 and Edge margin 20, the rest at their defaults; the log's
first lines read "Format: X3P (ISO 25178-72)" and the reported depth is 60 µm.

## Workflow A: one surface

1. Drop the file on **Point cloud to analyse** (or use Browse).
2. Leave the parameters at the interface defaults; they are the values used in the
   paper: Voxel size 5, Field band 2.5 MAD, Crop pad X 180, Crop pad Y 100, Opening
   level fraction 0.10, Floor width fraction 0.90, Roughness eval area (floor) 0.5,
   Floor eval length 4000, Field eval width 400, Field eval length 4000; Advanced:
   Edge margin 100, Display cell size 0 (auto), Smooth sigma 0, Profile slices 80,
   Skip rows 0. Units are those of the file. Changed values are marked; **Paper
   defaults** restores them; **Save** and **Load** write and read a JSON parameter
   file; the values are remembered in the browser.
3. Click **Analyse surface**. The results bar shows width, depth and roughness; the
   tabs show *Alignment*, *Channel Detection*, *Profiles* (the mean cross-section
   with the floor, floor-width and opening levels and the detected edges, the depth
   of every slice, the centre line, and the width and length per slice), *3D View*
   and *Roughness*. The log lists the residual tilt, the draft angle, the per-slice
   spread and any quality-control flag.
4. **Crop** saves the levelled, aligned, voxel-thinned crop (x y z in micrometres,
   field at z = 0, channel along x, centred). **Use as A** and **Use as B** place the
   same crop directly in the comparison slots. These crops are the inputs of
   Workflow B.

## Workflow B: two surfaces

1. Fill **Surface A** (the reference) and **Surface B** (the compared surface) with
   crops, either with *Use as A* and *Use as B* after analysing each surface or by
   loading crop files. For replication quality the reference is the insert and the
   compared surface is the part; for tool degradation both are the same insert at
   two shots, the earlier one as A.
2. Under **Comparison Parameters** keep Grid spacing 5 µm and Smooth sigma 0, the
   paper's values. A sigma of 0 means the one-cell Gaussian filter of the RQd
   definition. The channel-interior fraction (0.20) and the 180-degree orientation
   check are fixed in the core.
3. Click **Compare A with B**. The four cards are RQ, RQdx, RQdy and RQd, each with
   its RMSE; a line states the orientation kept for B, the grid and the size of the
   channel-interior mask. The tool reports the numbers and the maps and leaves their
   interpretation to the user; the paper defines no acceptance thresholds. *Comparison 3D* shows the two
   surfaces and the slope error E_d drawn on surface B; *Comparison Maps* shows the
   height and slope-magnitude maps of both surfaces with the error maps E_Z (signed)
   and E_d (unsigned) and the outline of the channel-interior mask. The log states which
   orientation of B was kept, the valid-cell fraction and the mask size; its metrics
   table is that of the kept orientation.
4. **Batch**: choose several files under *Batch: compare A with several surfaces* and
   click **Run batch**. A table lists RQ, RQdx, RQdy and RQd for every file; *Show*
   re-runs one pair for its figures.

RQd is defined at a stated grid cell size. Values computed at different cell sizes
are not comparable; the paper reports RQd at 5 µm, chosen from the instrument's
lateral resolution.

## Exports

- **Figure…**: any figure as SVG or PNG (2× or 3×), in the light theme for documents
  or in the current theme, at a chosen size; the figure is rebuilt at that size so
  labels and line widths stay legible. On every plot the camera icon saves a PNG as
  shown and the disk icon an SVG.
- **Results JSON**: every number, every parameter and the per-slice series of the
  session, with the software and runtime versions.
- **Results CSV**: one row per analysed surface and one per comparison.

## Files

| File | Role |
|---|---|
| `index.html`, `style.css`, `app.js` | Interface and main-thread logic |
| `worker.js` | Web worker that boots Pyodide and runs the analyses |
| `pvisual_core.py` | Single-surface module: levelling, alignment, geometry, roughness, crop export |
| `rq_gradient_core.py` | Paired module: registration, RQ, RQdx, RQdy, RQd, error maps |
| `x3p_loader.py` | ISO 25178-72 X3P reader |
| `plots.py` | Plotly figure builders |
| `run_marq.py`, `MaRQ.bat`, `MaRQ.command` | Local launcher (serves the folder, opens the browser) |
| `vendor/` | Bundled Plotly.js and Pyodide runtime with NumPy and SciPy, for offline use |
| `tools/fetch_vendor.py` | Re-downloads and verifies the bundle at the pinned versions |
| `tests/make_test_x3p.py` | Synthetic X3P generator for testing the loader |

## Citing

Please cite the paper above and the software. `CITATION.cff` carries both in a
machine-readable form; GitHub's "Cite this repository" button uses it.

## Licence

Copyright (C) 2026 Mehmet Oğulcan Güngör. MaRQ is free software released under the
GNU General Public License, version 3 (`LICENSE`). The bundled third-party components
keep their own licences: Plotly.js (MIT), Pyodide (MPL-2.0), NumPy, SciPy and OpenBLAS
(BSD-3-Clause); see `vendor/README.md`.

## Funding

Developed at Middle East Technical University with support from TÜBİTAK grant
22AG008 (MAESTRO) and the European Union's Horizon Europe programme, grant agreement
101079473 (OrChESTRA).
