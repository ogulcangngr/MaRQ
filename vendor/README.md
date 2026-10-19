# Bundled runtime (offline use)

These files let MaRQ run without an internet connection. They are unmodified
copies of published releases, fetched by `tools/fetch_vendor.py`, which pins the
versions and verifies the package checksums against Pyodide's lock file.

| File | What | Version | Licence | Source |
|---|---|---|---|---|
| `plotly-2.35.2.min.js` | Plotly.js, the plotting library | 2.35.2 | MIT | https://cdn.plot.ly/plotly-2.35.2.min.js |
| `three/three.module.min.js` | three.js, the 3D viewport | r169 (0.169.0) | MIT | https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js |
| `pyodide/pyodide.js`, `pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json` | Pyodide, CPython 3.12 compiled to WebAssembly | 0.26.4 | MPL-2.0 (CPython: PSF) | https://cdn.jsdelivr.net/pyodide/v0.26.4/full/ |
| `pyodide/numpy-1.26.4-*.whl` | NumPy | 1.26.4 | BSD-3-Clause | same |
| `pyodide/scipy-1.12.0-*.whl` | SciPy | 1.12.0 | BSD-3-Clause | same |
| `pyodide/openblas-0.3.26.zip` | OpenBLAS (SciPy dependency) | 0.3.26 | BSD-3-Clause | same |

`index.html` and `worker.js` load these local copies first and fall back to the
CDNs above only when a file is missing, so a checkout without this folder still
works online. Licence texts: https://github.com/plotly/plotly.js/blob/master/LICENSE, https://github.com/mrdoob/three.js/blob/dev/LICENSE,
https://github.com/pyodide/pyodide/blob/main/LICENSE, https://numpy.org/doc/stable/license.html,
https://github.com/scipy/scipy/blob/main/LICENSE.txt, https://github.com/OpenMathLib/OpenBLAS/blob/develop/LICENSE.
