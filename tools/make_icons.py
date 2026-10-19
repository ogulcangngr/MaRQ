"""Render the MaRQ icon (logo.svg) into every file that carries it:

    python tools/make_icons.py

    launcher/icon/marq-<size>.png   16 ... 1024 px, the source of the Windows icon
    launcher/icon/marq.ico          the icon compiled into MaRQ.exe (via go-winres)
    favicon.ico                     the browser tab icon
    apple-touch-icon.png            180 px, for macOS and iOS bookmarks

The SVG is drawn by a headless Chromium (pip install playwright, then
python -m playwright install chromium), so the edges are anti-aliased exactly as in the
browser. Afterwards remake launcher/rsrc_windows_amd64.syso and MaRQ.exe as described in
tools/build_launchers.py.
"""
import io, os
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = [16, 24, 32, 48, 64, 128, 180, 256, 512, 1024]
svg = open(os.path.join(ROOT, "logo.svg"), encoding="utf-8").read()
out = os.path.join(ROOT, "launcher", "icon")
os.makedirs(out, exist_ok=True)

imgs = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(device_scale_factor=1)
    for s in SIZES:
        page.set_viewport_size({"width": s, "height": s})
        sized = svg.replace('width="100" height="100"', f'width="{s}" height="{s}"')
        page.set_content("<html><body style='margin:0;background:transparent'>"
                         f"<div style='width:{s}px;height:{s}px'>{sized}</div></body></html>")
        png = page.screenshot(omit_background=True, clip={"x": 0, "y": 0, "width": s, "height": s})
        imgs[s] = Image.open(io.BytesIO(png)).convert("RGBA")
        imgs[s].save(os.path.join(out, f"marq-{s}.png"))
    b.close()

ico_sizes = [16, 24, 32, 48, 64, 128, 256]
imgs[256].save(os.path.join(out, "marq.ico"), sizes=[(s, s) for s in ico_sizes],
               append_images=[imgs[s] for s in ico_sizes if s != 256])
imgs[48].save(os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)],
              append_images=[imgs[16], imgs[32]])
imgs[180].save(os.path.join(ROOT, "apple-touch-icon.png"))
print("icons written:", ", ".join(f"{s}" for s in SIZES), "+ marq.ico, favicon.ico, apple-touch-icon.png")
