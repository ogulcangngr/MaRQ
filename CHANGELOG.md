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
- Launchers that need nothing installed (2026-10-19): `MaRQ.exe` (Windows) and
  `launchers/` binaries for macOS (Apple silicon, Intel) and Linux (x86-64, Arm),
  built from `launcher/main.go` with `tools/build_launchers.py`. They serve the folder
  on 127.0.0.1 with fixed content types (a Windows registry that maps `.js` to
  `text/plain` no longer stops the worker), pick a free port, open the browser, and
  keep their window open with a plain message when the zip was not extracted or a
  port is taken. `MaRQ.command` / `MaRQ.sh` pick the binary for the system, clear the
  macOS download quarantine of the folder, and fall back to Python; `MaRQ.bat` starts
  `MaRQ.exe` and falls back to Python; `run_marq.py` uses the same fixed content types.
  The page shows a red notice when it is opened as a file, when the browser lacks
  WebAssembly or workers, or when the analysis engine cannot be loaded.
  `tests/e2e_check.py` checks a running MaRQ in a browser. No analysis change.
- Icon (2026-10-19): the MaRQ logo is the icon of `MaRQ.exe` (with its name and version
  in the file properties; `launcher/winres/`, `launcher/icon/`) and of the browser tab
  (`favicon.ico`, `logo.svg`, `apple-touch-icon.png`).
- Interface redesign (2026-10-19). No analysis change: the sample data give the same
  numbers in Chromium, Firefox and WebKit. The earlier interface of 1.0 is that of
  commit 030a690.
  - A CAD-style workspace: a command ribbon (Surface, Comparison, Export, View, Setup);
    a browser tree on the left with the inputs and every view of each result; a
    properties panel with the measured values; one viewport with a caption; a status bar
    with the progress, a live coordinate readout, the settings state and the runtime.
    The analysis parameters moved to a Settings dialog. The panes can be resized and the
    sizes are remembered; every size scales with the window, so the proportions are the
    same on a laptop and on a large monitor.
  - Colours: white in the light theme, the greys of Visual Studio Code in the dark
    theme (which follows the system setting until chosen), red only for the primary
    commands, the selection and the key results.
  - 3D viewport (`viewer3d.js`, three.js r169 in `vendor/three/`): left-drag turns about
    the point under the cursor with Z kept up, right-, middle- or Shift-drag pans, the
    wheel zooms towards the cursor, a double-click fits; a view cube, preset views
    (home, top, front, right; keys H, 1, 2, 3, F), orthographic projection with a scale
    bar (O), depth scale ×1 to ×10, a colour bar and a PNG snapshot. The three
    comparison views share one camera. Plotly draws the 3D views if WebGL or the
    module is unavailable.
  - 2D plots: drag pans and the wheel zooms; a box-zoom tool; the comparison maps zoom
    and pan together, also at true proportions; plots follow the size of their pane.
  - Labels in words instead of symbols (Height, Difference A − B, Slope A, Slope error;
    RQ<sub>d</sub> typeset); plot titles moved to the viewport caption.
  - Colour scales are passed as explicit stops: Plotly.js does not know Plasma, Magma,
    Inferno or Turbo by name, so in 1.0 before this change those palettes, and the
    Inferno scale of the slope maps, fell back to a default scale.
  - The launchers open MaRQ in a window of its own (the application mode of Chrome or
    Edge, without address bar or tabs; Edge comes with every Windows 10 and 11), or in
    a browser tab when neither is installed or with `--tab`.
  - New icon: a scanned surface receding into the distance, cut along a channel whose
    cross-section forms the red μ (`tools/make_icons.py` renders every size).
  - Languages: English and Turkish (`i18n.js`), chosen in the title bar; without a choice
    MaRQ follows the browser language. Everything on screen is translated, the figures
    included (`plots.localise`: the builders write English and the finished figure is
    translated piece by piece); Turkish numbers take the decimal comma. The terms follow
    the thesis (iç kalıp, kalıplanmış parça, kopyalama kalitesi). Exported figures can be
    written in either language; the CSV and JSON exports stay in English with decimal
    points.
  - Zoom in and out buttons below every plot and 3D view (keys + and −).
- Review of the redesign (2026-10-20). No analysis change: the sample data give the
  same numbers in Chromium, Firefox and WebKit.
  - Sizes: the root size meant to follow the window never applied (the page reset it to
    16 px), so the ribbon ran off windows narrower than about 1300 pixels. The interface
    now shrinks to 13 px at 1024 pixels, and on windows up to 1440 pixels Open A / Open B
    and Settings / Log become small stacked commands; the ribbon fits from 1024 pixels in
    English and Turkish.
  - Fonts of Visual Studio Code: Segoe UI (Windows), the system font (macOS), system-ui or
    Ubuntu (Linux); numbers in Consolas or Menlo.
  - Errors in words: a file that cannot be read (an image, an empty file, two columns, text
    where numbers are expected, a damaged X3P) is named in a notice over the viewport, not
    a Python traceback in the log. Header lines at the top of a text point cloud are
    skipped by themselves. A scan whose channel is no deeper than the roughness of the
    field gets a warning that its geometry means nothing. After a fatal engine error the
    engine restarts by itself. When the server is gone (its window closed), MaRQ says so.
  - Runs keep what they were started with: a file opened, a slot changed or a setting
    edited during a run no longer renames the result or changes the settings recorded with
    it. A display error no longer leaves MaRQ "running". Empty or out-of-range settings
    stop the run and are marked in the Settings dialog.
  - Batch: a pair that fails is a row with its error and the batch goes on; files sorted
    naturally (2 before 10); *Show* runs the pair of the table; the step and the batch
    position show in the status bar (the progress text stayed at step 1 before).
  - 3D viewport: no data in the slope error is a hole, not the colour of zero; the hover
    readout and the turning point need a real crossing of the surface (no values over
    the background or through holes) and are read on the drawn triangles; a new result
    starts at the home view; the depth scale is the dropdown's in every view, with a
    badge when it is not ×1; the scale bar only in views straight along an axis; zoom
    limits; two-finger touch and trackpad pinch; a lost graphics context comes back;
    snapshots on the theme background with the colour bar.
  - 2D plots: the zoom stays over a theme, palette or language change; snapshots on the
    theme background.
  - Cancel switches off the crop commands when the engine no longer holds the crop; the
    batch table, the slider values (decimal comma), "Start" and "Starting…" follow the
    language; keyboard shortcuts wait while a dialog is open; tree rows work from the
    keyboard; the CSV gains the voxel size used, the alignment angles and the
    opening-length spread.
  - Launchers: a second start opens a window on the MaRQ already running from that folder
    instead of a second server; the browser revalidates files by content tag, so a folder
    from an older zip never gets newer cached files from another MaRQ; requests by
    another host name, hidden files and folders are refused; the default browser comes
    first when it is Chromium-based; on Linux, Ctrl+C no longer closes the browser; the
    console window is titled; the macOS launchers are built with Go 1.24 and run from
    macOS 11 (they needed macOS 13). `MaRQ.bat` works on network paths; `run_marq.py`
    behaves like the Go launcher; README troubleshooting in English and Turkish.
- New in the redesign (2026-10-20). No analysis change.
  - Measure and Section in the 3D views: two clicks on the surface give their distance
    (in the plane and in height), or the height profile along the line between them in a
    panel below the view (surfaces A and B and the slope error in the comparison views),
    with a CSV export.
  - Sessions: *File*, *Save the session* (Ctrl+S) writes a `.marq` file with every result
    the engine holds (JSON and NumPy arrays, no pickles; the grids the figures are drawn
    from in single precision, the crop and every number in double precision), the
    session record, the settings and surfaces A and B; *Open a session*, or a drop on the window, brings them
    back without a new analysis, ready to export, compare again or rebuild.
  - Report: one printable page per result (the properties, the settings with the changed
    ones in bold, the main figures in the light theme), printed or saved as PDF from its
    dialog, or saved as HTML.
  - A *File* menu in the title bar; closing MaRQ with results saved neither as a session
    nor as JSON or CSV asks first.
  - Closing MaRQ's window stops MaRQ and closes its console window a few seconds later
    (every page says it is alive every 20 s and goodbye when it closes; a reload says hello
    again in time; on macOS the Terminal window of a double-clicked `MaRQ.command` closes
    too); `--stay` keeps the launcher running.
  - Every analysed point cloud has its own node in the browser with all its views, so the
    analysis of surface A can be opened again after B was analysed and compared. The
    analysis on screen is the one *Keep as A* or *B*, *Save crop*, the exports and the
    report use; A and B mark the analyses whose crops fill the slots; a node can be removed
    from the session. The engine holds the newest six analyses (an older one stays
    viewable); a new theme or language rebuilds the analysis on screen at once and the
    others when they are opened. Sessions keep every analysis held.
  - The comparison maps are two views, *Height maps* (A, B, A − B) and *Slope maps* (A, B,
    slope error), one map per row; the six-map figure of the paper stays in the export
    dialog and the report. The three maps of a view are linked by Plotly itself and the
    mask outline is drawn as ready line segments, so a zoom or pan moves all three at once
    without the page stalling (a redraw took about 0.45 s, now about 0.15 s, once, after
    the scrolling); *Link the maps* off gives each its own zoom, still at true proportions.
  - Cross-sections across the channel: *Cross-section at a position* for every analysis and
    *Cross-sections of A and B* for the comparison, with a slider from one end of the channel
    to the other and the position as a fraction of the length or in µm from the start (the
    profile from the points within one voxel of the position, with the mean cross-section;
    on the common grid for A and B), and a one-click *Cross-section* tool in the 3D views
    that opens the profile through the clicked point below the view. Both save as CSV.
  - Saving asks where: the save dialog of the system in Chrome and Edge (at the folder of the
    last save); the downloads folder, named in the status bar, in Firefox and Safari.
  - Tests: `tests/e2e_features.py` goes through the interface on a synthetic insert and part
    (comparison, maps, cross-sections, 3D, report, language, a session saved and opened
    again) and `tests/launcher_check.py` checks a launcher without a browser (what it
    serves, one MaRQ per folder, the stop after the last goodbye); both run in the GitHub
    check on Windows, macOS and Linux. The check found that `run_marq.py` on Windows let a
    second start take the port of the first; it now takes its port exclusively.
  - Turkish: the field is *çevre yüzey* (it was *düzlem*, which also means a plane), the
    Browser *Model ağacı*, the wall angle *yan duvar açısı*, Run batch *Toplu karşılaştır*;
    MaRQ takes the suffixes of "mark" (MaRQ'ı, MaRQ'ın).
- From the first users (2026-10-21). No analysis change.
  - After a file is opened, the start page shows it (name and size, with surfaces A and B
    when one of them was opened), the next step as a button (*Analyse*, *Compare*, or
    opening the missing surface) and a *Settings* button, with a note that the analysis
    uses the paper defaults or how many settings differ from them; the status bar says
    the file was opened. Before, only the file name in the browser showed that it was.
  - Tips: after each step a bar under the view title says what finished and what can come
    next, with the next steps as buttons (after an analysis *Keep as A* or *B* and *Report*;
    after *Keep as* the next scan or *Compare*; after a comparison *Report*, *Figure* and
    *Save the session*, with a word on the browser, Properties and *Batch files…*; after a
    batch *Results CSV*). Closed with ×; *Hide tips*, or the box in Help, turns them off.
  - Surfaces A and B are described neutrally, as the reference and the surface compared
    with it, without naming a mould insert or a moulded part (the start page, the tips,
    the tooltips, Help, About and the README).
  - One font for every text, numbers included: the interface font of Visual Studio Code
    (the editor font is gone from the properties, tables, log, 3D labels and the report),
    with digits of one width so columns of numbers still line up. Two weights only, regular and
    semibold (bold is gone), and one letter spacing for every heading in capitals. The grey texts are
    brighter in the dark theme and darker in the light theme, the pane titles almost
    white in the dark theme, and the names in Properties at full brightness. The start
    page no longer says that everything runs on this computer.
  - Every text in the plots is one point larger: titles, axis titles and ticks, legends,
    colour bars, annotations and hover labels (`plots.py`), the profile plots of the
    cross-section panels, and the colour bar, scale bar and labels of the 3D view.

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
