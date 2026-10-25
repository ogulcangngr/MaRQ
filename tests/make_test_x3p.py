"""Generate a small synthetic X3P test file — parabolic channel surface."""
import os
import sys
import zipfile
import numpy as np

NX, NY = 120, 50        # grid points (along × across)
DX = DY = 10e-6         # 10 µm step (metres)

channel_width  = 200e-6  # 200 µm wide
channel_depth  = 60e-6   # 60 µm deep

x = np.arange(NX) * DX
y = np.arange(NY) * DY
Y_c = (NY - 1) / 2 * DY  # channel centre in Y

_, Y = np.meshgrid(x, y)
dy = Y - Y_c

# Parabolic channel cross-section; flat surface outside
z = np.where(
    np.abs(dy) < channel_width / 2,
    channel_depth * (dy / (channel_width / 2))**2 - channel_depth,
    0.0
)

# Small random noise (±0.2 µm)
rng = np.random.default_rng(42)
z += rng.normal(0, 0.2e-6, z.shape)

# Mark steep sidewall region as invalid (as an optical profiler would)
valid = np.ones((NY, NX), dtype=bool)
sidewall = (np.abs(dy) > channel_width * 0.44) & (np.abs(dy) < channel_width * 0.56)
valid[sidewall] = False

# Pack valid mask as LSB-first bits
flat = valid.ravel()
n_bytes = (len(flat) + 7) // 8
padded = np.zeros(n_bytes * 8, dtype=np.uint8)
padded[:len(flat)] = flat.astype(np.uint8)
valid_bytes = np.packbits(padded.reshape(-1, 8)[:, ::-1], axis=1).ravel().tobytes()

# Z binary — float32, stored in metres
z_bytes = z.astype(np.float32).tobytes()

xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<ISO25178-72>
  <Record1>
    <Revision>ISO25178-72:2012</Revision>
    <FeatureType>SUR</FeatureType>
    <Axes>
      <CX>
        <AxisType>I</AxisType>
        <DataType>D</DataType>
        <Increment>{DX}</Increment>
        <Offset>0.0</Offset>
      </CX>
      <CY>
        <AxisType>I</AxisType>
        <DataType>D</DataType>
        <Increment>{DY}</Increment>
        <Offset>0.0</Offset>
      </CY>
      <CZ>
        <AxisType>A</AxisType>
        <DataType>F</DataType>
        <Increment>1.0</Increment>
        <Offset>0.0</Offset>
      </CZ>
    </Axes>
  </Record1>
  <Record3>
    <MatrixDimension>
      <SizeX>{NX}</SizeX>
      <SizeY>{NY}</SizeY>
      <SizeZ>1</SizeZ>
    </MatrixDimension>
    <DataLink>
      <PointDataLink>bindata/data.bin</PointDataLink>
      <ValidPointsLink>bindata/valid.bin</ValidPointsLink>
    </DataLink>
  </Record3>
</ISO25178-72>"""

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_channel.x3p")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.writestr("main.xml", xml)
    zf.writestr("bindata/data.bin", z_bytes)
    zf.writestr("bindata/valid.bin", valid_bytes)

print(f"Created: {out}")
print(f"Grid   : {NX} x {NY}  ({NX*NY} points, {valid.sum()} valid)")
print(f"X range: 0 – {(NX-1)*DX*1e6:.0f} µm")
print(f"Y range: 0 – {(NY-1)*DY*1e6:.0f} µm")
print(f"Z range: {z[valid].min()*1e6:.1f} – {z[valid].max()*1e6:.1f} µm")
