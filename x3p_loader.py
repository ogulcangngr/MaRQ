"""
X3P (ISO 25178-72) surface file loader for Pyodide.
X3P is a ZIP archive containing main.xml (metadata) + a binary Z-data file.
Outputs coordinates in micrometres (SI metres × 1e6).
"""

import zipfile
import xml.etree.ElementTree as ET
import numpy as np

_DTYPE_MAP = {'F': np.float32, 'D': np.float64, 'I': np.int16, 'L': np.int32}
_X3P_SCALE = 1e6   # SI metres → µm


def _find(elem, tag):
    """Return first child whose local name matches tag, ignoring namespace."""
    for child in elem:
        if child.tag.split('}')[-1] == tag:
            return child
    return None


def _text(elem, tag, default=None):
    child = _find(elem, tag)
    return child.text.strip() if child is not None and child.text else default


def _parse_axis(axes_elem, tag):
    ax = _find(axes_elem, tag)
    if ax is None:
        return {'datatype': 'D', 'increment': 1.0, 'offset': 0.0}
    return {
        'datatype':  _text(ax, 'DataType', 'D'),
        'increment': float(_text(ax, 'Increment', '1.0')),
        'offset':    float(_text(ax, 'Offset',    '0.0')),
    }


def load_x3p(path, log_fn=print):
    """
    Load an X3P file and return (x, y, z) arrays in micrometres.
    Invalid / NaN measurement points are excluded.
    """
    with zipfile.ZipFile(path, 'r') as zf:
        names = zf.namelist()

        # ── Parse XML ─────────────────────────────────────────────
        xml_name = next((n for n in names if n.lower().endswith('main.xml')), None)
        if xml_name is None:
            raise ValueError("X3P: no main.xml found in archive.")
        with zf.open(xml_name) as f:
            root = ET.parse(f).getroot()

        r3 = _find(root, 'Record3')
        if r3 is None:
            raise ValueError("X3P: Record3 not found in main.xml.")

        # ── Grid size ──────────────────────────────────────────────
        md = _find(r3, 'MatrixDimension')
        nx = int(_text(md, 'SizeX', '0'))
        ny = int(_text(md, 'SizeY', '0'))
        log_fn(f"  X3P grid : {nx} × {ny}  ({nx*ny:,} points)")

        # ── Axes ───────────────────────────────────────────────────
        axes = _find(r3, 'Axes')
        cx = _parse_axis(axes, 'CX')
        cy = _parse_axis(axes, 'CY')
        cz = _parse_axis(axes, 'CZ')
        log_fn(f"  X3P step : dx={cx['increment']:.4g} m  dy={cy['increment']:.4g} m  "
               f"dz={cz['increment']:.4g} m")

        # ── Data files ─────────────────────────────────────────────
        dl         = _find(r3, 'DataLink')
        data_link  = _text(dl, 'PointDataLink',  '')
        valid_link = _text(dl, 'ValidPointsLink', None)

        # ── Read Z binary ──────────────────────────────────────────
        z_dtype = _DTYPE_MAP.get(cz['datatype'], np.float32)
        with zf.open(data_link) as f:
            z_raw = np.frombuffer(f.read(), dtype=z_dtype).astype(np.float64).reshape(ny, nx)

        # ── Valid-point mask ───────────────────────────────────────
        if valid_link and valid_link in names:
            with zf.open(valid_link) as f:
                packed = np.frombuffer(f.read(), dtype=np.uint8)
            valid_mask = np.unpackbits(packed, bitorder='little')[:ny * nx].reshape(ny, nx).astype(bool)
        else:
            valid_mask = np.ones((ny, nx), dtype=bool)

        # ── Reconstruct coordinates (metres → µm) ─────────────────
        xi = (cx['offset'] + np.arange(nx) * cx['increment']) * _X3P_SCALE
        yi = (cy['offset'] + np.arange(ny) * cy['increment']) * _X3P_SCALE
        z_um = (cz['offset'] + z_raw * cz['increment']) * _X3P_SCALE

        X, Y = np.meshgrid(xi, yi)

        valid_mask &= np.isfinite(z_um)
        x_out = X[valid_mask]
        y_out = Y[valid_mask]
        z_out = z_um[valid_mask]

        log_fn(f"  X3P valid: {valid_mask.sum():,} / {nx*ny:,} points")
        log_fn(f"  X3P X=[{x_out.min():.1f}, {x_out.max():.1f}] µm  "
               f"Y=[{y_out.min():.1f}, {y_out.max():.1f}] µm  "
               f"Z=[{z_out.min():.1f}, {z_out.max():.1f}] µm")

        return x_out, y_out, z_out
