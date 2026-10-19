"""Write a synthetic channel scan for launcher and browser tests: a 600 um wide, 300 um
deep channel with 10 degree walls in a flat field, 4 mm long, x y z in micrometres on a
5 um grid with 0.5 um noise (fixed seed, so every system gets the same file).

    python tests/make_test_channel.py [OUT.txt]       (default tests/test_channel_600um.txt)
"""
import os, sys
import numpy as np

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_channel_600um.txt")
W, D, ANG, L = 600.0, 300.0, 10.0, 4000.0          # floor width, depth, wall angle, channel length
x = np.arange(0.0, L + 1000.0, 5.0)                 # 500 um of field beyond each end
y = np.arange(-900.0, 900.0 + 1e-9, 5.0)
X, Y = np.meshgrid(x, y)
t = np.tan(np.radians(ANG))
half_floor = W / 2
# depth below the field: full depth on the floor, falling along the walls to 0 at the opening
dist_y = np.clip(np.abs(Y) - half_floor, 0, None)
dist_x = np.clip(np.maximum(500.0 - X, X - (L + 500.0)), 0, None)
dist = np.maximum(dist_y, dist_x)
Z = -np.clip(D - dist / t, 0, D)
Z += np.random.default_rng(7).normal(0, 0.5, Z.shape)
np.savetxt(out, np.column_stack([X.ravel(), Y.ravel(), Z.ravel()]), fmt="%.2f")
print(f"wrote {out}: {X.size} points")
