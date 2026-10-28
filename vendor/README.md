# Bundled runtime (offline use)

These files let MaRQ run without an internet connection. They are unmodified
copies of published releases, fetched by `tools/fetch_vendor.py`, which pins the
versions and verifies the package checksums against Pyodide's lock file.

| File | What | Version | Licence | Source |
|---|---|---|---|---|
| `plotly-4.1.2.min.js` | Plotly.js, the plotting library | 4.1.2 | MIT | https://cdn.plot.ly/plotly-4.1.2.min.js |
| `three/three.module.js`, `three/three.core.js` | three.js, the 3D viewport (the module imports the core) | r186 (0.186.1) | MIT | https://cdn.jsdelivr.net/npm/three@0.186.1/build/ |
| `pyodide/pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json` | Pyodide, CPython 3.14 compiled to WebAssembly | 314.0.7 | MPL-2.0 (CPython: PSF) | https://cdn.jsdelivr.net/pyodide/v314.0.7/full/ |
| `pyodide/numpy-2.4.6-*.whl` | NumPy | 2.4.6 | BSD-3-Clause | same |
| `pyodide/scipy-1.18.0-*.whl` | SciPy, with OpenBLAS inside (`scipy.libs/libopenblas.so`) | 1.18.0 | BSD-3-Clause | same |

`index.html` and `worker.js` load these local copies first and fall back to the
CDNs above only when a file is missing (three.js has no fallback: without it the 3D views are
drawn with Plotly), so a checkout without this folder still
works online. Licence texts: https://github.com/plotly/plotly.js/blob/master/LICENSE, https://github.com/mrdoob/three.js/blob/dev/LICENSE,
https://github.com/pyodide/pyodide/blob/main/LICENSE, https://numpy.org/doc/stable/license.html,
https://github.com/scipy/scipy/blob/main/LICENSE.txt, https://github.com/OpenMathLib/OpenBLAS/blob/develop/LICENSE.
