# MaRQ: the Microchannel and Replication Quality Analyzer

*Türkçe: [README.tr.md](README.tr.md)*

MaRQ measures microchannels in optical-profilometry point clouds and compares two
surfaces of a channel, A and B, grading how closely B matches A.
It runs entirely on your computer: the analysis core is Python (NumPy, SciPy)
executed in the browser engine through Pyodide, so nothing is installed and no
measurement data leave the computer. With the runtime bundled in `vendor/` it also
works without an internet connection. The interface is in English or Turkish.

Two workflows share one loading and preprocessing framework:

- **Single surface.** Levels the field, aligns the channel axis, and reports the
  floor, mid-depth and opening widths, the depth, the wall angle, the rounding of
  the floor and rim corners, the length and ISO 25178 roughness of the floor and the
  field, with the mean cross-section, the widths along the channel and the depth of
  every slice. Exports a levelled, aligned crop of the channel.
- **Two surfaces.** Registers two crops on a common grid and computes the height
  correlation RQ, the directional slope correlations RQdx and RQdy, and RQd, the
  full-surface slope-magnitude correlation over the channel interior shared by the
  two surfaces, with maps of the height difference and of the slope error. A batch
  mode compares one reference with several surfaces.

RQd and the software are described in: M. O. Güngör, J. Charmet, E. Yıldırım,
*A 3D measurement workflow for assessing replication quality and tool degradation
in moulded microfluidic channels*, Measurement (submitted, 2026). The companion archive, with the software,
one sample channel with its expected results, and the point clouds of the study, is on Zenodo:
https://doi.org/10.5281/zenodo.22813916 (restricted until the article is published).

## Running MaRQ

Nothing has to be installed, Python included. Extract the zip, open this folder and:

- **Windows 10/11:** double-click `MaRQ.exe`. If *Windows protected your PC* appears,
  click *More info*, *Run anyway* (the program is not code-signed).
- **macOS 11+:** double-click `MaRQ.command`. The first time macOS asks to confirm:
  on macOS 15+ open *System Settings*, *Privacy & Security*, *Open Anyway*; on older
  versions Control-click the file and choose *Open*. If it still does not start, type
  `sh ` in Terminal, drag `MaRQ.command` into the window and press Return.
- **Linux:** `sh MaRQ.sh` in a terminal in this folder.

A small console window shows *MaRQ is running at http://127.0.0.1:8000/*, and MaRQ opens
in a window of its own: the application mode of Chrome or Edge, without address bar or
tabs (Edge comes with every Windows 10 and 11). Without either browser MaRQ opens in a
tab of the default browser (a current Firefox or Safari works too); `MaRQ.exe --tab`
asks for a tab on purpose. Closing MaRQ's window stops MaRQ, and its console window closes
too a few seconds later; closing the console also stops MaRQ (`MaRQ.exe --stay` keeps it
running after its window is closed). If nothing opens, type the address into a browser yourself. Starting MaRQ
again while it runs opens another window on the same MaRQ, so the settings, which the
browser keeps per address, stay.

**If MaRQ does not start**

- *Windows protected your PC*: *More info*, *Run anyway*. Before extracting, right-click
  the zip, *Properties*, tick *Unblock*: the extracted files are then not marked as
  downloaded, and the question does not come back.
- MaRQ.exe disappears or is blocked by antivirus software, or Smart App Control offers no
  *Run anyway*: programs written in Go are sometimes taken for malware. Restore and allow
  it, or install Python 3 and double-click `MaRQ.bat`, which then starts MaRQ with Python.
- *The MaRQ files are not next to this program*: the zip was opened but not extracted, or
  MaRQ.exe was copied somewhere else. Start it in the extracted folder; for an icon on the
  Desktop make a shortcut (right-click MaRQ.exe, *Send to*, *Desktop*; on macOS, *Make
  Alias*).
- macOS asks whether Terminal may access the Downloads folder: answer *OK*, then start
  MaRQ again. Extracting MaRQ to a folder outside Downloads avoids the question.
- A folder synchronised by OneDrive, iCloud or Dropbox may hold only placeholders of the
  files: extract MaRQ to a local folder.
- A red notice at the top of MaRQ says what is missing: an `index.html` opened directly
  (use the launcher), an incomplete `vendor/` folder (extract the whole zip again), or a
  console window that was closed (start MaRQ again).
- To update MaRQ, close its console window first: Windows cannot replace a running
  `MaRQ.exe`.

The page has to come from an HTTP server (a `file://` page cannot start the analysis
worker; double-clicking `index.html` shows a red notice saying so). The launchers are
small programs built from the Go sources in `launcher/` with `tools/build_launchers.py` (no
dependencies): they serve this folder on 127.0.0.1 only, with fixed content types, and
open the window. `MaRQ.exe` is the Windows build; `MaRQ.command` and `MaRQ.sh` start
the right one in `launchers/` for macOS (Apple silicon or Intel) or Linux (x86-64 or
Arm), and fall back to Python 3 when it does not run. `MaRQ.bat` does the same on
Windows, and `python run_marq.py` works anywhere Python 3 is installed. Any static
server works too (`npx serve`, the Live Server extension of VS Code). The archive's
`HOW_TO_RUN.txt` lists the messages a first start can bring and what to do about each.
`tests/e2e_check.py` drives a running MaRQ in Chromium, Firefox or WebKit and checks
it against the sample data of the archive.

**Offline.** `vendor/` holds Plotly.js, three.js and the Pyodide runtime with NumPy and
SciPy (84 MB; versions and licences in `vendor/README.md`), so the first start needs no
download and the status bar reads "Ready (offline bundle)". If `vendor/` is missing,
for example after a source-only download, the page falls back to the CDNs and needs
internet for the first start; `python tools/fetch_vendor.py` restores the bundle.

## The window

- **Ribbon** (top): the commands, grouped as *Surface* (Open, Analyse, Keep as A,
  Keep as B, Save crop), *Comparison* (Open A, Open B, Compare, the batch), *Export*,
  *View* and *Setup* (Settings, Log). The command a first-time user most likely needs
  next is outlined in red.
- **Browser** (left): the inputs (the scan to analyse, surface A, surface B; click a row
  to open a file, or drop a file on it) and every view of each result. Every analysed
  point cloud has its own node with all its views, so an earlier analysis (surface A's,
  say, after B was analysed and compared) can be opened again at any time. The analysis
  on screen, its name in red, is the one *Keep as A*, *Keep as B*, *Save crop*, the
  exports and the report use; A and B beside a name mark the analyses whose crops fill the
  slots. The engine keeps the newest six analyses (an older one can still be viewed), and
  the × of a node removes its analysis from the session.
- **Properties** (left, below): the measured values of the result on screen, with an
  explanation of each on hover.
- **Viewport** (centre): the view selected in the browser, its title and details above,
  the navigation bar below. A file dropped anywhere on the window is opened as the
  scan to analyse.
- **Status bar** (bottom): the progress of a run (click it for the live analysis log
  with every step and quality-control value), the coordinates under the cursor, whether
  the settings are the paper's, and whether the runtime is the offline bundle.
- **Title bar**: the *File* menu (open a point cloud or a session, save the session, the
  report and the exports), the language (English, Türkçe), the light or dark theme, help
  and About. Without a choice MaRQ follows the language and the theme of the system.

The panes can be resized by dragging their borders. Below 1366 pixels every size shrinks
with the window, so the ribbon and the panes keep their proportions on a small laptop
screen; above, a wider window gives the viewport more room. A running
analysis can be cancelled (*Cancel* in the ribbon); the engine restarts in a few
seconds.

**Navigating.** In the 3D views, drag with the left button to turn the surface about the
point under the cursor (Z stays up), drag with the right or middle button (or Shift and
the left button) to pan, and use the wheel to zoom towards the cursor; a double-click fits
the surface. The view cube in the corner shows the orientation, and a click on one of its
faces turns the view to that side. The navigation bar below the view has the home view,
fit, zoom in and out, the top, front (along the channel) and right (cross-section) views,
an orthographic projection (with a scale bar in the views along an axis), the tools and
a PNG snapshot. Keys: H home, F fit, + and − zoom, 1 top, 2 front, 3 right, O orthographic
or perspective, M measure, S section, C cross-section, Esc clears the points. **Measure**
gives the distance between two clicked points of the surface, in the plane and in height;
**Section** opens the height profile along the line between two clicked points below the
view, and **Cross-section** the profile across the channel through one clicked point
(surfaces A and B and their height difference A − B in the comparison views), each with a
CSV export.
In the 2D plots,
drag to pan and use the wheel or the + and − buttons to zoom; the box tool zooms into a
drawn box, and a double-click resets the view.

The maps and the 3D views are drawn on square display cells (a few micrometres,
chosen automatically and reported in the log); they are for display only, the
numbers come from the points and, for the comparison, from the common grid at the
stated spacing. The 3D views show the true proportions of the channel unless *Depth
scale* (View) stretches the heights, ×2 to ×10, to show shallow features. With
**True proportions** (View, on by default) every 2D plot whose two axes are lengths uses
the same scale on both, so the channel keeps its shape and a variation is shown in
proportion to the channel's size; switch it off to let each axis fill the panel when a
small variation has to be read. **Link the maps** zooms and pans the six comparison maps
together; **Link the 3D views** keeps one camera for surface A, surface B and the slope
error. *Colours* sets the colour scale of the height maps and *3D detail* the mesh of
the 3D views.

## Input formats

- Delimited text point clouds: `.txt`, `.xyz`, `.asc`, `.csv`, three columns x y z,
  any common delimiter. Lines of text at the top (column names, instrument metadata) are
  skipped by themselves; *Header rows to skip* (Settings) sets their number by hand. Units
  are those of the file; the paper's data are in micrometres.
- ISO 25178-72 X3P files (`.x3p`), converted to micrometres on loading.

To test the X3P path without an instrument file, run `python tests/make_test_x3p.py`.
It writes `tests/test_channel.x3p`, a synthetic 1.2 mm by 0.5 mm surface with a
parabolic channel 200 µm wide and 60 µm deep on a 10 µm grid. Analyse it with *Crop
margin along the channel* 100, *Crop margin across the channel* 50 and *Edge margin* 20,
the rest at their defaults; the log's first lines read "Format: X3P (ISO 25178-72)" and
the reported depth is 60 µm.

## Workflow A: one surface

1. **Open** the point cloud (or drop it on the window).
2. Leave the settings at their defaults; they are the values used in the paper.
   *Settings* (ribbon) lists them: Voxel size 5, Field band 2.5 median absolute
   deviations, Crop margin along the channel 180, Crop margin across the channel 100,
   Opening level 0.10 and Floor level 0.90 of the depth, Floor roughness strip width 0.5
   of the channel width, Floor roughness strip length 4000, Field roughness strip width
   400 and length 4000; under *Advanced*: Edge margin 100, Display cell size 0
   (automatic), Display smoothing 0, Depth profile slices 80, Header rows to skip 0.
   Units are those of the file. Changed values are marked and the status bar says how
   many differ from the paper; *Paper defaults* restores them; *Save* and *Load* write
   and read a JSON settings file; the values are remembered on the computer.
3. **Analyse**. The properties show the widths, the depth, the wall angle, the corner
   rounding, the lengths, the roughness and the alignment; the browser lists the views:
   *Alignment*, *Channel detection*, *Profiles* (the mean cross-section with the
   floor-width and opening levels, the wall positions and the mid-wall lines, and the
   depth of every slice; the cross-section at a position; the width and length per grid
   line; the centre lines), *3D view* and *Roughness areas*. *Cross-section at a position*
   shows the channel across at any point along it: a slider from one end of the channel
   (the measured floor-level ends) to the other, or the position typed as a fraction of the
   length (0 to 1) or in micrometres from the start; the profile is read from the points
   within one voxel of the position, with the mean cross-section for comparison, and can be
   saved as CSV. Its axes stay fixed along the whole channel (the full width and the largest
   height range), so profiles at different positions can be compared by eye. The log lists the residual tilt, the wall angle of each
   wall, the corner rounding, the grid lines used and any quality-control flag.

   How the geometry is read: the depth comes from the mean cross-section of the
   whole channel. The widths, the wall angle and the corner rounding are read on grid
   lines across the channel (cells of one voxel, lines two voxels apart, over the
   central 80 % of the channel): on every line the wall at a level is where the height
   profile first rises above it moving out from the centre line, interpolated between
   the two grid points around it, and each value is the median over the lines. The
   widths are taken at 90, 50 and 10 % of the depth. The wall angle is a straight line
   through the wall positions at 25 to 75 % of the depth, measured from the vertical
   (negative for an undercut); a wall within 3° of the vertical is reported as below
   3°, because it then spans too few cells to be resolved. The corner rounding is how
   far the wall lies inside that line at the floor level and outside it at the opening
   level. The length is read on lines along the channel, each end from the outside in,
   and the exported crop spans the two ends plus the crop margin.
4. **Save crop** saves the levelled, aligned, voxel-thinned crop (x y z in micrometres,
   field at z = 0, channel along x, centred). **Keep as A** and **Keep as B** place the
   same crop directly in the comparison slots. These crops are the inputs of
   Workflow B.

## Workflow B: two surfaces

1. Fill surface A (the reference) and surface B (the compared surface) with crops,
   either with *Keep as A* and *Keep as B* after analysing each surface or with *Open A*
   and *Open B* for crop files. MaRQ asks before keeping when the point cloud in the scan
   slot has not been analysed yet, refuses to keep one analysis as both A and B, and asks
   before taking a file without "crop" in its name as A, B or a batch file. Any two surfaces of the same channel can be compared. In
   the study behind MaRQ the reference was the mould insert and the compared surface the
   moulded part; for tool degradation both were the same insert at two shots, the
   earlier one as A.
2. In *Settings*, under *Comparison*, keep Grid spacing 5 µm and Smoothing before the
   slopes 0, the paper's values. A smoothing of 0 means the one-cell Gaussian filter of
   the RQd definition. The channel-interior fraction (0.20) and the 180-degree
   orientation check are fixed in the core.
3. **Compare**. The properties show RQd, RQ, RQdx and RQdy, each with its RMSE, and
   state the orientation kept for B, the grid and the size of the channel-interior
   mask. The tool reports the numbers and the maps and leaves their interpretation to
   the user; the paper defines no acceptance thresholds. The views are *Surface A* and
   *Surface B* in 3D, the *Slope error* drawn in 3D on surface B, the *Height maps* (A, B
   and the signed difference A − B) and the *Slope maps* (the slope magnitudes of A and B
   and the unsigned slope error), each with the outline of the channel-interior mask, and
   the *Cross-sections of A and B* at a chosen position along the channel, as for one
   surface, with the height difference A − B on a second axis; the height and difference
   axes are fixed at their largest ranges over the channel. The two map views zoom and pan together. The log states which orientation of B was kept, the
   valid-cell fraction and the mask size; its metrics table is that of the kept
   orientation.
4. **Batch**: choose several files with *Batch files…* and click **Run batch**. The
   *Batch results* view lists RQ, RQdx, RQdy and RQd for every file; *Show* re-runs one
   pair for its figures.

RQd is defined at a stated grid cell size. Values computed at different cell sizes
are not comparable; the paper reports RQd at 5 µm, chosen from the instrument's
lateral resolution.

## Exports

- **Figure**: any figure as SVG or PNG (2× or 3×), in the light theme for documents
  or in the current theme, with its text in the interface language, English or Turkish,
  at a chosen size; the figure is rebuilt at that size, with axes and a colour bar, so
  labels and line widths stay legible; the six comparison maps can also be exported as one
  figure. The camera button below a view saves it as a PNG as it is on screen.
- **Results JSON**: every number, every setting and the per-line and per-slice
  series of the session, with the software and runtime versions.
- **Results CSV**: one row per analysed surface and one per comparison.
- **Report** (Export, or the File menu): one printable page per result, with the numbers
  of the properties panel, the settings (those that differ from the paper's in bold) and
  the main figures in the light theme. Print it or save it as PDF from the dialog, or save
  it as an HTML file.
- **Session** (File, *Save the session*, Ctrl+S): a `.marq` file with every result the
  engine holds, the session record, the settings and surfaces A and B. *Open a session*,
  or dropping the file on the window, brings the results back without a new analysis:
  they can be viewed, exported, compared again and rebuilt in another theme or language.
  The file holds data only (JSON and NumPy arrays), nothing that runs.

Saving asks where: Chrome and Edge open the save dialog of the system, at the folder of
the last save; Firefox and Safari save into their downloads folder, and the status bar
names the file. Closing MaRQ while some results are saved neither as a session nor as
JSON or CSV asks first.

The JSON and CSV files are in English with decimal points in either interface language,
so they read the same in every spreadsheet and script.

## Files

| File | Role |
|---|---|
| `index.html`, `style.css`, `app.js` | Interface and main-thread logic |
| `viewer3d.js` | The 3D viewport (three.js) |
| `i18n.js` | Interface languages (Turkish strings) |
| `worker.js` | Web worker that boots Pyodide and runs the analyses |
| `pvisual_core.py` | Single-surface module: levelling, alignment, geometry, roughness, crop export |
| `rq_gradient_core.py` | Paired module: registration, RQ, RQdx, RQdy, RQd, error maps |
| `x3p_loader.py` | ISO 25178-72 X3P reader |
| `plots.py` | Plotly figure builders, and their translation |
| `MaRQ.exe`, `MaRQ.command`, `MaRQ.sh`, `launchers/` | Launchers that need nothing installed (Windows; macOS; Linux), built from the Go sources in `launcher/` by `tools/build_launchers.py` |
| `MaRQ.bat`, `run_marq.py` | Fallback launchers through Python 3 |
| `tests/e2e_check.py`, `tests/e2e_synthetic.py`, `tests/e2e_features.py` | Browser tests of a running MaRQ: the numbers against the sample data or a synthetic channel, and the interface on a synthetic insert and part |
| `tests/launcher_check.py` | Test of a launcher without a browser: what it serves, one MaRQ per folder, the stop when the last window closes |
| `vendor/` | Bundled Plotly.js, three.js and the Pyodide runtime with NumPy and SciPy, for offline use |
| `tools/fetch_vendor.py` | Re-downloads and verifies the bundle at the pinned versions |
| `tools/make_icons.py` | Renders the icon (`logo.svg`) into every size the launchers and the page use |
| `tests/make_test_x3p.py` | Synthetic X3P generator for testing the loader |

## Citing

Please cite the paper above and the software. `CITATION.cff` carries both in a
machine-readable form; GitHub's "Cite this repository" button uses it.

## Licence

Copyright (C) 2026 Mehmet Oğulcan Güngör. MaRQ is free software released under the
GNU General Public License, version 3 (`LICENSE`). The bundled third-party components
keep their own licences: Plotly.js and three.js (MIT), Pyodide (MPL-2.0), NumPy, SciPy
and OpenBLAS (BSD-3-Clause); see `vendor/README.md`.

## Funding

Developed at Middle East Technical University with support from TÜBİTAK grant
22AG008 (MAESTRO) and the European Union's Horizon Europe programme, grant agreement
101079473 (OrChESTRA).
