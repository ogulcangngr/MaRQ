# MaRQA: the Microchannel and Replication Quality Analyzer

MaRQA measures microchannels in optical-profilometry point clouds and grades how
faithfully a channel has been replicated from a mould insert into a moulded part.
It runs entirely in the browser: the analysis core is Python (NumPy, SciPy)
executed through Pyodide, so nothing is installed and no measurement data leave
your computer.

Two workflows share one loading and preprocessing framework:

- **Single surface.** Levels the field, aligns the channel axis, detects floor and
  opening, and reports width, depth, draft and ISO 25178 roughness of the floor and
  the field. Exports a levelled, aligned crop of the channel.
- **Two surfaces.** Registers two crops on a common grid and computes the height
  correlation RQ, the directional gradient correlations RQdx and RQdy, and RQd, the
  full-surface gradient-magnitude correlation over the channel interior shared by
  the two surfaces, with signed error maps.

RQd and the software are described in: M. O. Güngör, J. Charmet, E. Yıldırım,
*A full-surface gradient-magnitude correlation metric for non-destructive assessment
of microchannel replication quality*, Measurement (submitted, 2026). The companion
archive with one real channel, expected results, the paper's tables and the analysis
scripts is on Zenodo (DOI to be added on publication).

## Running MaRQA

The page loads its Python modules with `fetch`, so it must be served over HTTP, not
opened as a local file:

```
git clone https://github.com/ogulcangngr/MaRQA.git
cd MaRQA
python -m http.server 8000
```

Open http://localhost:8000/ in Chrome, Edge or Firefox. The first start downloads
Pyodide and its NumPy and SciPy packages from the jsDelivr CDN (about 30 MB, once;
the browser caches them). The status bar reads "Ready" when the analysis modules
are loaded. The folder can be published unchanged on any static host.

The window has three parts: the sidebar (Input Files, Parameters, Actions), the
plot area with tabs that appear as results become available, and the Analysis Log,
which records every step, the quality-control flags and the numbers.

## Input formats

- Delimited text point clouds: `.txt`, `.xyz`, `.asc`, `.csv`, three columns x y z,
  any common delimiter, header rows skipped with *Skip rows*. Units are those of the
  file; the paper's data are in micrometres.
- ISO 25178-72 X3P files (`.x3p`), converted to micrometres on loading.

To test the X3P path without an instrument file, run `python tests/make_test_x3p.py`.
It writes `tests/test_channel.x3p`, a synthetic 1.2 mm by 0.5 mm surface with a
parabolic channel 200 µm wide and 60 µm deep on a 10 µm grid. Load it as Point Cloud
File 1 with Voxel size 5, Crop pad X 100, Crop pad Y 50 and Edge margin 20; the log's
first lines read "Format: X3P (ISO 25178-72)" and the reported depth is 60 µm.

## Workflow A: one surface

1. Drop the file on **Point Cloud File 1** (or use Browse).
2. Set the parameters. The paper used the interface defaults except three:

   | Parameter | Paper value | Interface default |
   |---|---|---|
   | Voxel size | 5 | 10 |
   | Crop pad X (units) | 180 | 250 |
   | Crop pad Y (units) | 100 | 150 |

   The remaining defaults are the paper's values: Field band 2.5 MAD, Opening level
   fraction 0.10, Floor width fraction 0.90, Roughness eval area (floor) 0.5, Floor
   eval length 4000, Field eval width 400, Field eval length 4000; Advanced: Edge
   margin 100, Grid resolution 300, Smooth sigma 0, Profile slices 80, Skip rows 0.
3. Click **Run Point Cloud Analysis**. The results bar shows width, depth and
   roughness; the tabs show *Rotation Maps*, *Channel Detection*, *Profiles*,
   *3D View* and *Roughness*. The log lists the residual tilt, the draft angle, the
   per-slice spread and any quality-control flag.
4. Click **Download Cropped Channel** to save the levelled, aligned, voxel-thinned
   crop (x y z in micrometres, field at z = 0, channel along x, centred). These crops
   are the inputs of Workflow B.

## Workflow B: two surfaces

1. Load the crop of the reference surface as **Point Cloud File 1** and the crop of
   the compared surface as **Point Cloud File 2**. For replication quality the
   reference is the insert and the compared surface is the part; for tool degradation
   both are the same insert at two shots, the earlier one as File 1.
2. Under **Gradient Parameters** keep Grid spacing 5 µm and Smooth sigma 0, the
   paper's values. A sigma of 0 means the one-cell Gaussian filter of the RQd
   definition. The channel-interior fraction (0.20) and the 180-degree orientation
   check are fixed in the core.
3. Click **Run Gradient Correlation**. The four cards are *r (Z)* = RQ,
   *r (dZ/dx)* = RQdx, *r (dZ/dy)* = RQdy and *r (|∇Z|)* = RQd. The tabs show the
   gradient-magnitude surfaces, the height and gradient maps with the signed errors,
   and the cell-by-cell correlation scatter. The log states which orientation of
   Cloud 2 was kept, the valid-cell fraction and the interior-mask size.

RQd is defined at a stated grid cell size. Values computed at different cell sizes
are not comparable; the paper reports RQd at 5 µm, chosen from the instrument's
lateral resolution.

## Files

| File | Role |
|---|---|
| `index.html`, `style.css`, `app.js` | Interface and main-thread logic |
| `worker.js` | Web worker that boots Pyodide and runs the analyses |
| `pvisual_core.py` | Single-surface module: levelling, alignment, geometry, roughness, crop export |
| `rq_gradient_core.py` | Paired module: registration, RQ, RQdx, RQdy, RQd, error maps |
| `x3p_loader.py` | ISO 25178-72 X3P reader |
| `plots.py` | Plotly figure builders |
| `tests/make_test_x3p.py` | Synthetic X3P generator for testing the loader |

## Citing

Please cite the paper above and the software. `CITATION.cff` carries both in a
machine-readable form; GitHub's "Cite this repository" button uses it.

## Licence

Copyright (C) 2026 Mehmet Oğulcan Güngör. MaRQA is free software released under the
GNU General Public License, version 3 (`LICENSE`). Pyodide and Plotly are loaded from
their CDNs under their own licences.

## Funding

Developed at Middle East Technical University with support from TÜBİTAK grant
22AG008 (MAESTRO) and the European Union's Horizon Europe programme, grant agreement
101079473 (OrChESTRA).
