/* MaRQ 3D viewport: a height map drawn as a lit surface with three.js, navigated like a CAD
   viewport.

   Mouse: left-drag orbits about the point under the cursor (Z stays up), right- or middle-drag
   (or Shift + left-drag) pans, the wheel zooms towards the cursor, a double-click fits the
   surface. The view cube in the top-right corner shows the orientation; a click on one of its
   faces turns the view to that side. With a tool on (setTool "measure" or "section"), a click
   that does not move picks a point; two points give a distance or a section line.

   window.MarqViewer.create(container) returns a viewer; app.js gives it the surface traces that
   plots.py builds (x, y, z, optional surfacecolor, colour scale, cmin/cmax). */

import * as THREE from "./vendor/three/three.module.js";      // it imports ./three.core.js

const DEG = Math.PI / 180;
const FOV = 30;                                   // vertical field of view, perspective camera
const TAN = Math.tan(FOV / 2 * DEG);
const EL_MAX = 89.9 * DEG;
const AXIS_COL = { x: "#e5484d", y: "#3fae5a", z: "#3d8bfd" };
// the interface size (app.js sets the root size, 16 px at 100 %): what is drawn in page pixels
// here, the view cube, follows it as the rest of the interface does
const uiScale = () => (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;

// named views: azimuth (about +Z, from +X) and elevation, in degrees
const VIEWS = {
  home:   { az: -62, el: 28 },
  top:    { az: -90, el: 90 },
  bottom: { az: -90, el: -90 },
  front:  { az: -90, el: 0 },     // looking from -Y: the channel seen from the side, along its length
  back:   { az: 90, el: 0 },
  right:  { az: 0, el: 0 },       // looking from +X: the cross-section of the channel
  left:   { az: 180, el: 0 },
};

function hexToRgb(h) {
  if (h.startsWith("rgb")) { const m = h.match(/[\d.]+/g).map(Number); return [m[0] / 255, m[1] / 255, m[2] / 255]; }
  const v = parseInt(h.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// colour scale [[t, colour], ...] -> 256-entry table in linear RGB, for the vertex colours
function makeLut(scale) {
  const stops = scale.map(([t, c]) => [Number(t), hexToRgb(c)]);
  const lut = new Float32Array(256 * 3), col = new THREE.Color();
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[Math.min(k + 1, stops.length - 1)];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    col.setRGB(c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f, THREE.SRGBColorSpace);
    lut[i * 3] = col.r; lut[i * 3 + 1] = col.g; lut[i * 3 + 2] = col.b;
  }
  return lut;
}

function faceTexture(label, dark) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = dark ? "#3a3a3e" : "#f4f4f6";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = dark ? "#5a5a60" : "#b9b9c0";
  g.lineWidth = 4;
  g.strokeRect(2, 2, 124, 124);
  g.fillStyle = dark ? "#e0e0e0" : "#3a3a40";
  g.font = `600 ${label.length > 6 ? 20 : 24}px -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, Ubuntu, "Droid Sans", sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(label, 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

class Viewer {
  constructor(container) {
    this.el = container;
    this.dark = false;
    this.exag = 1;
    this.ortho = false;
    this.listeners = { hover: [], change: [], lost: [], measure: [], section: [], marks: [], xsect: [] };
    this.tool = null;
    this.marks = [];
    this.markEls = [];
    this.state = { target: new THREE.Vector3(), dist: 1000, az: VIEWS.home.az * DEG, el: VIEWS.home.el * DEG };
    this.anim = null;
    this.reserveRight = 95;                       // pixels kept free for the colour bar

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "viewer-canvas";
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.persp = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1e6);
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1e6);
    [this.persp, this.orthoCam].forEach((c) => { c.up.set(0, 0, 1); });

    // light: a soft sky/ground fill plus a key light that follows the camera, so the shape
    // reads from every side while the colour scale stays recognisable
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.55);
    this.hemi.position.set(0, 0, 1);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 1.45);
    this.scene.add(this.key);
    this.scene.add(this.key.target);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.mesh = null;
    this.grid = null;

    // a lost graphics context (driver reset, sleep, too many contexts) comes back by itself; the
    // view is drawn again then
    this.lost = false;
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; this._emit("lost", true); });
    this.canvas.addEventListener("webglcontextrestored", () => { this.lost = false; this._emit("lost", false); this.render(); });

    this._buildCube();
    this._bindInput();
    this.resize();
    this._ro = new ResizeObserver(() => { this.resize(); });
    this._ro.observe(container);
    this._onWinResize = () => this.resize();       // a move to a screen of another pixel density
    window.addEventListener("resize", this._onWinResize);
  }

  // ── public ─────────────────────────────────────────────────────────────────
  on(ev, fn) { this.listeners[ev].push(fn); }
  _emit(ev, v) { this.listeners[ev].forEach((f) => f(v)); }

  // face labels of the view cube: right, left, top, bottom, front, back
  setLabels(labels) {
    if (Array.isArray(labels) && labels.length === 6) this.cubeLabels = labels;
    this._buildCube();
    this.render();
  }

  setTheme(dark) {
    this.dark = !!dark;
    this.hemi.groundColor.set(dark ? 0x3a3a3a : 0x8a8a8a);
    this._buildCube();
    this._drawMarks(false);
    this.render();
  }

  // ── tools ───────────────────────────────────────────────────────────────────
  setTool(name) {
    this.tool = name || null;
    this.canvas.classList.toggle("tool", !!this.tool);
    this.clearMarks();
  }

  clearMarks() {
    this.marks = []; this.xline = null;
    this._drawMarks();
    this._emit("marks", null);
  }

  // a point of the surface for the tool on; the second gives the measurement or the section
  _toolClick(px, py) {
    const hit = this.pick(px, py);
    if (!hit) return;
    const o0 = this.origin;
    if (this.tool === "xsect") {                 // one point: the line across the channel (along y) through it
      const f = this.field;
      this.marks = [{ x: hit.world.x, y: hit.world.y, z: hit.z, value: hit.value }];
      this.xline = [{ x: hit.world.x, y: f.y0 }, { x: hit.world.x, y: f.y1 }];
      this._drawMarks();
      this._emit("xsect", { a: { x: hit.world.x + o0.x, y: hit.world.y + o0.y, z: hit.z } });
      return;
    }
    if (this.marks.length >= 2) this.marks = [];
    this.marks.push({ x: hit.world.x, y: hit.world.y, z: hit.z, value: hit.value });   // z in true units
    this._drawMarks();
    const o = this.origin, data = (m) => ({ x: m.x + o.x, y: m.y + o.y, z: m.z, value: m.value });
    if (this.marks.length === 2) this._emit(this.tool, { a: data(this.marks[0]), b: data(this.marks[1]), ...this._measure() });
    else this._emit("marks", { a: data(this.marks[0]) });
  }

  // the points of the tool, when a panel over the lower `inset` pixels of the view would cover
  // them: the view moves up until they sit in the middle of the part above the panel
  revealMarks(inset) {
    if (!this.marks.length || !(inset > 0) || !this.h) return;
    const cam = this._camera();
    const ys = this.marks.map((q) => (1 - new THREE.Vector3(q.x, q.y, q.z * this.exag).project(cam).y) / 2 * this.h);
    const free = this.h - inset, low = Math.max(...ys);
    if (low < free - 24) return;
    const st = { ...this.state, target: this.state.target.clone() };
    st.target.addScaledVector(this._dirs(st).up, -((Math.min(...ys) + low) / 2 - free / 2) * this._pixelSize());
    this._go(st, true);
  }

  _measure() {
    const [a, b] = this.marks, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    return { dist: Math.hypot(dx, dy, dz), dxy: Math.hypot(dx, dy), dz };
  }

  // the section line follows the surface; holes are left out
  _surfacePath(a, b) {
    const n = 240, out = [];
    for (let i = 0; i <= n; i++) {
      const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n, h = this._heightAt(x, y);
      if (h) out.push({ x, y, z: h.z });
    }
    return out.length > 1 ? out : [a, b];
  }

  _drawMarks(render = true) {
    if (this.markLine) { this.scene.remove(this.markLine); this.markLine.geometry.dispose(); this.markLine.material.dispose(); this.markLine = null; }
    this.markEls.forEach((e) => e.remove());
    this.markEls = []; this.markLabel = null;
    const pts = this.marks;
    pts.forEach(() => { const d = document.createElement("div"); d.className = "mk-dot"; this.el.appendChild(d); this.markEls.push(d); });
    const path = this.tool === "xsect" && this.xline && pts.length === 1 ? this._surfacePath(this.xline[0], this.xline[1])
      : pts.length === 2 ? (this.tool === "section" ? this._surfacePath(pts[0], pts[1]) : pts) : null;
    if (path) {
      const geo = new THREE.BufferGeometry().setFromPoints(path.map((q) => new THREE.Vector3(q.x, q.y, q.z)));
      const mat = new THREE.LineBasicMaterial({ color: this.dark ? 0xff6b6b : 0xd32f2f, depthTest: false, transparent: true });
      this.markLine = new THREE.Line(geo, mat);
      this.markLine.renderOrder = 999;
      this.markLine.scale.z = this.exag;
      this.scene.add(this.markLine);
      if (this.tool === "measure" && pts.length === 2) {
        const l = document.createElement("div");
        l.className = "mk-label";
        l.innerHTML = this.formatMeasure ? this.formatMeasure(this._measure()) : "";
        this.el.appendChild(l); this.markEls.push(l); this.markLabel = l;
      }
    }
    if (render) this.render();
  }

  // the points and the label follow the view
  _placeMarks(cam) {
    if (!this.markEls.length) return;
    const proj = (q) => {
      const v = new THREE.Vector3(q.x, q.y, q.z * this.exag).project(cam);
      return [(v.x + 1) / 2 * this.w, (1 - v.y) / 2 * this.h, v.z < 1 && v.z > -1];
    };
    this.marks.forEach((q, i) => {
      const [x, y, vis] = proj(q), e = this.markEls[i];
      e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      e.style.display = vis ? "" : "none";
    });
    if (this.markLabel && this.marks.length === 2) {
      const [a, b] = this.marks, [x, y] = proj({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
      this.markLabel.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  // trace: plotly-style surface {x:[nx], y:[ny], z:[[ny][nx]], surfacecolor?, colorscale, cmin?, cmax?}
  setSurface(trace, opts = {}) {
    if (trace === this._trace && this.mesh) {          // the same surface again: only the camera
      if (opts.camera) this.setCamera(opts.camera, false);
      else if (!opts.keepCamera) this.view("home", false);
      this.render();
      return;
    }
    this._trace = trace;
    if (this.marks.length) { this.marks = []; this._drawMarks(false); this._emit("marks", null); }
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    const xs = trace.x, ys = trace.y, Z = trace.z, Cv = trace.surfacecolor || null;
    const nx = xs.length, ny = ys.length;
    const cx = (xs[0] + xs[nx - 1]) / 2, cy = (ys[0] + ys[ny - 1]) / 2;
    this.origin = { x: cx, y: cy };
    const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
    const ok = new Uint8Array(nx * ny);
    const zgrid = new Float32Array(nx * ny).fill(NaN), vgrid = new Float32Array(nx * ny).fill(NaN);
    let zmin = Infinity, zmax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (let j = 0; j < ny; j++) {
      const zr = Z[j], cr = Cv ? Cv[j] : null;
      for (let i = 0; i < nx; i++) {
        const z = zr[i], k = j * nx + i;
        if (z === null || z === undefined || !isFinite(z)) continue;
        const v = cr ? cr[i] : z;
        // a point without a colour value (no slope error where A has no data) is left out, as a
        // hole, rather than drawn in the colour of the lowest value
        if (v === null || v === undefined || !isFinite(v)) continue;
        ok[k] = 1; zgrid[k] = z; vgrid[k] = v;
        if (z < zmin) zmin = z; if (z > zmax) zmax = z;
        if (v < vmin) vmin = v; if (v > vmax) vmax = v;
      }
    }
    if (!isFinite(zmin)) { zmin = 0; zmax = 1; }
    const cmin = trace.cmin != null ? trace.cmin : vmin, cmax = trace.cmax != null ? trace.cmax : vmax;
    const lut = makeLut(trace.colorscale || [[0, "#440154"], [1, "#fde725"]]);
    const span = (cmax - cmin) || 1;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      pos[k * 3] = xs[i] - cx; pos[k * 3 + 1] = ys[j] - cy; pos[k * 3 + 2] = ok[k] ? zgrid[k] : 0;
      const v = vgrid[k];
      const li = isFinite(v) ? Math.max(0, Math.min(255, Math.round((v - cmin) / span * 255))) : 0;
      col[k * 3] = lut[li * 3]; col[k * 3 + 1] = lut[li * 3 + 1]; col[k * 3 + 2] = lut[li * 3 + 2];
    }
    // two triangles per grid cell with four valid corners, one where three are valid
    const idx = new Uint32Array(Math.max(0, (nx - 1) * (ny - 1) * 6));
    let m = 0;
    const tri = (p, q, r) => { idx[m++] = p; idx[m++] = q; idx[m++] = r; };
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      const n = ok[a] + ok[b] + ok[c] + ok[d];
      if (n === 4) { tri(a, b, d); tri(a, d, c); }
      else if (n === 3) {
        if (!ok[a]) tri(b, d, c); else if (!ok[b]) tri(a, d, c);
        else if (!ok[c]) tri(a, b, d); else tri(a, b, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(nx * ny > 65535 ? idx.slice(0, m) : Uint16Array.from(idx.subarray(0, m)), 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.scale.z = this.exag;
    this.group.add(this.mesh);
    this.field = { xs, ys, nx, ny, cx, cy, zgrid, vgrid, ok, zmin, zmax,
                   dx: Math.abs(xs[1] - xs[0]) || 1, dy: Math.abs(ys[1] - ys[0]) || 1,
                   x0: Math.min(xs[0], xs[nx - 1]) - cx, x1: Math.max(xs[0], xs[nx - 1]) - cx,
                   y0: Math.min(ys[0], ys[ny - 1]) - cy, y1: Math.max(ys[0], ys[ny - 1]) - cy };
    this.colour = { scale: trace.colorscale, cmin, cmax };
    if (opts.camera) this.setCamera(opts.camera, false);
    else if (!opts.keepCamera) this.view("home", false);
    this.render();
  }

  setExaggeration(k) {
    const e = Math.max(1, Number(k) || 1);
    this.state.target.z *= e / this.exag;          // the same point stays in the middle
    this.exag = e;
    if (this.mesh) this.mesh.scale.z = this.exag;
    if (this.markLine) this.markLine.scale.z = this.exag;
    this.render();
  }

  // an orthographic view straight along an axis, where one scale holds across the picture
  isAxisView() {
    const r = (a) => Math.abs(Math.atan2(Math.sin(a * 2), Math.cos(a * 2))) < 0.6 * DEG;   // a multiple of 90°
    const el = Math.abs(this.state.el);
    return this.ortho && (el > EL_MAX - 0.2 * DEG || (el < 0.3 * DEG && r(this.state.az)));
  }

  setProjection(ortho) { this.ortho = !!ortho; this.render(); this._emit("change", this.getCamera()); }

  // the camera, with the target height in true units: the depth scale is not part of it
  getCamera() {
    const s = this.state;
    return { target: [s.target.x, s.target.y, s.target.z / this.exag], dist: s.dist, az: s.az, el: s.el, ortho: this.ortho };
  }

  setCamera(c, animate = true) {
    if (!c) return;
    if (c.ortho !== undefined) this.ortho = !!c.ortho;
    this._go({ target: new THREE.Vector3(c.target[0], c.target[1], c.target[2] * this.exag), dist: c.dist, az: c.az, el: c.el }, animate);
  }

  // turn to a named view and fit the surface in it
  view(name, animate = true) {
    const v = VIEWS[name] || VIEWS.home;
    const st = { target: new THREE.Vector3(), dist: this.state.dist, az: v.az * DEG, el: Math.max(-EL_MAX, Math.min(EL_MAX, v.el * DEG)) };
    st.target.copy(this._boxCentre());
    st.dist = this._fitDist(st);
    this._go(st, animate);
  }

  // zoom about the centre of the view; f < 1 zooms in
  zoom(f, animate = true) {
    this._go({ ...this.state, target: this.state.target.clone(), dist: this._clampDist(this.state.dist * f) }, animate);
  }

  // from a few grid cells across up to far beyond the whole surface
  _clampDist(d) {
    const f = this.field;
    const lo = f ? Math.min(f.dx, f.dy) * 3 : 1e-3, hi = this._fitDist(this.state) * 25;
    return Math.max(lo, Math.min(hi, d));
  }

  fit(animate = true) {
    const st = { ...this.state, target: this._boxCentre() };
    st.dist = this._fitDist(st);
    this._go(st, animate);
  }

  // the view without the view cube, copied to a 2D canvas (in device pixels) for a picture
  snapshot() {
    this.render(false);
    const c = document.createElement("canvas");
    c.width = this.canvas.width; c.height = this.canvas.height;
    c.getContext("2d").drawImage(this.canvas, 0, 0);
    this.render();
    return c;
  }

  resize() {
    const w = Math.max(10, this.el.clientWidth), h = Math.max(10, this.el.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (dpr !== this.renderer.getPixelRatio()) this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
    this.w = w; this.h = h;
    this.render();
  }

  // ── camera ─────────────────────────────────────────────────────────────────
  _dirs(st) {
    const ce = Math.cos(st.el), back = new THREE.Vector3(ce * Math.cos(st.az), ce * Math.sin(st.az), Math.sin(st.el));
    const right = new THREE.Vector3(-Math.sin(st.az), Math.cos(st.az), 0);   // back x up, with up = +Z
    const up = new THREE.Vector3().crossVectors(back, right);
    return { back, right, up };
  }

  _boxCentre() {
    if (!this.field) return new THREE.Vector3();
    const f = this.field;
    return new THREE.Vector3((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, (f.zmin + f.zmax) / 2 * this.exag);
  }

  _corners() {
    const f = this.field || { x0: -1, x1: 1, y0: -1, y1: 1, zmin: 0, zmax: 1 };
    const out = [];
    for (const x of [f.x0, f.x1]) for (const y of [f.y0, f.y1]) for (const z of [f.zmin * this.exag, f.zmax * this.exag]) out.push(new THREE.Vector3(x, y, z));
    return out;
  }

  // camera distance at which the surface's box fills about 88 % of the viewport
  _fitDist(st) {
    const { back, right, up } = this._dirs(st);
    // fit into the canvas less the colour bar on the right, keeping the surface centred
    const aspect = Math.max(0.2, (this.w - 2 * (this.reserveRight || 0)) / this.h), m = 0.9;
    let d = 0;
    for (const c of this._corners()) {
      const v = c.clone().sub(st.target);
      const r = Math.abs(v.dot(right)), u = Math.abs(v.dot(up)), f = v.dot(back);
      if (this.ortho) d = Math.max(d, u / (TAN * m), r / (TAN * aspect * m));
      else d = Math.max(d, f + u / (TAN * m), f + r / (TAN * aspect * m));
    }
    return Math.max(d, 1);
  }

  _go(st, animate) {
    if (!animate) { this.state = st; this.anim = null; this.render(); this._emit("change", this.getCamera()); return; }
    const a = { target: this.state.target.clone(), dist: this.state.dist, az: this.state.az, el: this.state.el };
    let daz = st.az - a.az;
    daz = Math.atan2(Math.sin(daz), Math.cos(daz));           // the short way round
    const t0 = performance.now(), T = 380;
    this.anim = (now) => {
      const t = Math.min(1, (now - t0) / T), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.state = { target: a.target.clone().lerp(st.target, e), dist: a.dist * Math.pow(st.dist / a.dist, e),
                     az: a.az + daz * e, el: a.el + (st.el - a.el) * e };
      if (t >= 1) { this.state = { ...st, az: a.az + daz }; this.anim = null; this._emit("change", this.getCamera()); }
    };
    this._loop();
  }

  _loop() {
    if (this._raf) return;
    const step = (now) => {
      this._raf = 0;
      if (this.anim) this.anim(now);
      this.render();
      if (this.anim) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  _camera() {
    const st = this.state, { back } = this._dirs(st);
    const aspect = this.w / this.h;
    const radius = this._corners().reduce((m, c) => Math.max(m, c.distanceTo(st.target)), 1);
    if (this.ortho) {
      const hh = st.dist * TAN, cam = this.orthoCam, D = Math.max(st.dist, radius * 3);
      cam.left = -hh * aspect; cam.right = hh * aspect; cam.top = hh; cam.bottom = -hh;
      cam.near = 0.01 * D; cam.far = D + radius * 4;
      cam.position.copy(st.target).addScaledVector(back, D);
      cam.lookAt(st.target);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      return cam;
    }
    const cam = this.persp;
    cam.aspect = aspect;
    cam.near = Math.max(st.dist / 500, 0.01); cam.far = st.dist + radius * 4;
    cam.position.copy(st.target).addScaledVector(back, st.dist);
    cam.lookAt(st.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    return cam;
  }

  // world size of one screen pixel at the target
  _pixelSize() { return 2 * this.state.dist * TAN / this.h; }

  render(cube = true) {
    if (!this.w || this.lost) return;
    const cam = this._camera();
    // key light from above-left of the viewer
    const { back, right, up } = this._dirs(this.state);
    this.key.position.copy(this.state.target).addScaledVector(back, 1000).addScaledVector(up, 700).addScaledVector(right, -500);
    this.key.target.position.copy(this.state.target);
    const r = this.renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.w, this.h);
    r.clear();
    r.render(this.scene, cam);
    if (cube) this._renderCube();
    this._placeMarks(cam);
    this._emitScale();
  }

  _emitScale() {
    if (!this.onScale) return;
    this.onScale(this._pixelSize());
  }

  // ── picking: march the ray over the height field ─────────────────────────────
  _ray(px, py) {
    const ndc = new THREE.Vector2(px / this.w * 2 - 1, -(py / this.h) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this._camera());
    return rc.ray;
  }

  // height and colour value at (x, y) on the triangles the mesh draws, or null over a hole
  _heightAt(x, y) {
    const f = this.field;
    const fi = (x - (f.xs[0] - f.cx)) / (f.xs[1] - f.xs[0]), fj = (y - (f.ys[0] - f.cy)) / (f.ys[1] - f.ys[0]);
    if (!(fi >= 0 && fj >= 0 && fi <= f.nx - 1 && fj <= f.ny - 1)) return null;
    const i = Math.min(f.nx - 2, Math.floor(fi)), j = Math.min(f.ny - 2, Math.floor(fj));
    const u = fi - i, v = fj - j;
    const a = j * f.nx + i, b = a + 1, c = a + f.nx, d = c + 1, ok = f.ok;
    // the triangle of the cell that holds the point, as split in setSurface
    let T = null;
    if (ok[a] + ok[b] + ok[c] + ok[d] === 4) T = u >= v ? [a, b, d] : [a, d, c];
    else if (ok[a] + ok[b] + ok[c] + ok[d] === 3) T = !ok[a] ? [b, d, c] : !ok[b] ? [a, d, c] : !ok[c] ? [a, b, d] : [a, b, c];
    if (!T) return null;
    const P = (k) => [(k % f.nx) - i, Math.floor(k / f.nx) - j];
    const [p0, p1, p2] = T.map(P);
    const det = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
    const w0 = ((p1[1] - p2[1]) * (u - p2[0]) + (p2[0] - p1[0]) * (v - p2[1])) / det;
    const w1 = ((p2[1] - p0[1]) * (u - p2[0]) + (p0[0] - p2[0]) * (v - p2[1])) / det;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) return null;      // in the missing half of the cell
    const z = w0 * f.zgrid[T[0]] + w1 * f.zgrid[T[1]] + w2 * f.zgrid[T[2]];
    const val = w0 * f.vgrid[T[0]] + w1 * f.vgrid[T[1]] + w2 * f.vgrid[T[2]];
    return { z, v: val };
  }

  // the first point where the ray crosses the surface; the ray has to pass from one side of the
  // surface to the other, so a ray through empty space or a hole finds nothing
  pick(px, py) {
    if (!this.field || this.lost) return null;
    const ray = this._ray(px, py), f = this.field, k = this.exag;
    const pad = Math.max((f.zmax - f.zmin) * k * 1e-3, Math.min(f.dx, f.dy) * 1e-2);
    const box = new THREE.Box3(new THREE.Vector3(f.x0, f.y0, f.zmin * k - pad), new THREE.Vector3(f.x1, f.y1, f.zmax * k + pad));
    const p0 = ray.intersectBox(box, new THREE.Vector3());
    if (!p0) return null;
    const inside = box.containsPoint(ray.origin);
    const start = inside ? ray.origin.clone() : p0;
    const far = new THREE.Ray(start.clone().addScaledVector(ray.direction, 1e-3 + box.getSize(new THREE.Vector3()).length() * 2), ray.direction.clone().negate());
    const p1 = far.intersectBox(box, new THREE.Vector3()) || start;
    const len = start.distanceTo(p1), stepLen = Math.min(f.dx, f.dy) * 0.5;
    const n = Math.min(4000, Math.ceil(len / stepLen) + 1);
    const at = (t) => { const q = start.clone().addScaledVector(ray.direction, t), h = this._heightAt(q.x, q.y); return h ? { q, h, side: q.z - h.z * k > 0 } : null; };
    let prev = null;
    for (let s = 0; s <= n; s++) {
      const t = len * s / n, cur = at(t);
      if (!cur) { prev = null; continue; }
      if (prev && cur.side !== prev.side) {
        let a = prev.t, b = t, best = cur;
        for (let it = 0; it < 14; it++) {                 // refine the crossing
          const mid = (a + b) / 2, m = at(mid);
          if (m && m.side !== prev.side) { b = mid; best = m; } else a = mid;
        }
        return { world: best.q, x: best.q.x + f.cx, y: best.q.y + f.cy, z: best.h.z, value: best.h.v };
      }
      prev = { t, side: cur.side };
    }
    return null;
  }

  // ── mouse ──────────────────────────────────────────────────────────────────
  _bindInput() {
    const c = this.canvas;
    let drag = null;
    const pts = new Map();                       // active pointers (two fingers: pinch and pan)
    let pinch = null;
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("pointerdown", (e) => {
      const [px, py] = this._xy(e);
      const face = this._cubeFace(px, py);
      if (face >= 0) {                           // the view cube: a click turns to that side
        if (e.button === 0) this.view(["right", "left", "top", "bottom", "front", "back"][face]);
        return;
      }
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [px, py]);
      this.anim = null;
      if (pts.size === 2) {                      // a second finger: pinch to zoom, move to pan
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
        drag = null;
        c.classList.remove("orbiting", "panning");
        return;
      }
      if (pts.size > 2) return;
      const pan = e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey);
      const hit = pan ? null : this.pick(px, py);
      drag = { pan, button: e.button, x: px, y: py, x0: px, y0: py, pivot: hit ? hit.world : null, moved: false };
      c.classList.add(pan ? "panning" : "orbiting");
      this._emit("hover", null);
    });
    c.addEventListener("pointermove", (e) => {
      const [px, py] = this._xy(e);
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [px, py]);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this._pan(mx - pinch.mx, my - pinch.my);
        this._zoomAt(mx, my, pinch.d / d);
        pinch = { d, mx, my };
        this.render();
        return;
      }
      if (!drag) {
        if (this._cubeFace(px, py) >= 0) { this._cancelHover(); this._emit("hover", null); }
        else this._hoverAt(px, py);
        this._cubeHover(px, py);
        return;
      }
      const dx = px - drag.x, dy = py - drag.y;
      drag.x = px; drag.y = py; drag.moved = true;
      if (drag.pan) this._pan(dx, dy); else this._orbit(dx, dy, drag.pivot);
      this.render();
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      try { c.releasePointerCapture(e.pointerId); } catch {}
      if (pinch) { if (pts.size < 2) { pinch = null; this._emit("change", this.getCamera()); } return; }
      if (!drag) return;
      c.classList.remove("panning", "orbiting");
      // a right-drag that ends outside the view must not open the browser's menu there
      if (drag.moved && drag.button === 2) {
        const stop = (ev) => ev.preventDefault();
        window.addEventListener("contextmenu", stop, true);
        setTimeout(() => window.removeEventListener("contextmenu", stop, true), 400);
      }
      const click = e.type === "pointerup" && drag.button === 0 && !drag.pan && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < 4;
      drag = null;
      this._emit("change", this.getCamera());
      if (e.type === "pointerup") {
        const [px, py] = this._xy(e);
        if (click && this.tool) this._toolClick(px, py);
        this._hoverAt(px, py);
      }
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", () => { if (!drag) { this._cancelHover(); this._emit("hover", null); } this._cubeHover(-1, -1); });
    c.addEventListener("dblclick", (e) => { const [px, py] = this._xy(e); if (this._cubeFace(px, py) < 0) this.fit(); });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.anim = null;
      const [px, py] = this._xy(e);
      // a trackpad pinch arrives as a wheel with Ctrl and small steps
      const k = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0015;
      const f = Math.exp(Math.max(-1, Math.min(1, e.deltaY * k)));
      if (this._cubeFace(px, py) >= 0) this.zoom(f, false);
      else this._zoomAt(px, py, f);
      this.render();
      clearTimeout(this._wheelT);
      this._wheelT = setTimeout(() => this._emit("change", this.getCamera()), 150);
    }, { passive: false });
  }

  // zoom by f towards the point of the surface under (px, py), or the point of the view plane
  _zoomAt(px, py, f) {
    const st = this.state;
    const f2 = this._clampDist(st.dist * f) / st.dist;
    const hit = this.pick(px, py);
    let P = hit ? hit.world : null;
    if (!P) {
      const { back } = this._dirs(st);
      P = this._ray(px, py).intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(back, st.target), new THREE.Vector3());
    }
    if (P) st.target = P.clone().add(st.target.clone().sub(P).multiplyScalar(f2));
    st.dist *= f2;
  }

  _cancelHover() { if (this._hoverRaf) { cancelAnimationFrame(this._hoverRaf); this._hoverRaf = 0; } }

  _xy(e) { const r = this.canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  _hoverAt(px, py) {
    if (this._hoverRaf) { this._hoverPt = [px, py]; return; }
    this._hoverPt = [px, py];
    this._hoverRaf = requestAnimationFrame(() => {
      this._hoverRaf = 0;
      const [x, y] = this._hoverPt;
      this._emit("hover", this.pick(x, y));
    });
  }

  _orbit(dx, dy, pivot) {
    const st = this.state, s = 0.0075;
    const daz = -dx * s;
    let del = dy * s;
    const el1 = Math.max(-EL_MAX, Math.min(EL_MAX, st.el + del));
    del = el1 - st.el;
    if (pivot) {
      // turn the target about the pivot with the same rotation as the view
      const { right } = this._dirs(st);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), daz)
        .multiply(new THREE.Quaternion().setFromAxisAngle(right, -del));
      st.target = pivot.clone().add(st.target.clone().sub(pivot).applyQuaternion(q));
    }
    st.az += daz; st.el = el1;
  }

  _pan(dx, dy) {
    const { right, up } = this._dirs(this.state), p = this._pixelSize();
    this.state.target.addScaledVector(right, -dx * p).addScaledVector(up, dy * p);
  }

  // ── view cube ──────────────────────────────────────────────────────────────
  _buildCube() {
    if (this.cubeRoot) {
      this.cubeScene.remove(this.cubeRoot);
      this.cubeRoot.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        [].concat(o.material || []).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
    }
    this.cubeScene = this.cubeScene || new THREE.Scene();
    this.cubeCam = this.cubeCam || new THREE.OrthographicCamera(-1.05, 1.05, 1.05, -1.05, 0.1, 10);
    this.cubeCam.up.set(0, 0, 1);
    const d = this.dark;
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. The cube is built Y-up and turned so that its
    // +Y points along +Z, which keeps every label upright.
    const labels = this.cubeLabels || ["RIGHT", "LEFT", "TOP", "BOTTOM", "FRONT", "BACK"];
    const mats = labels.map((l) => new THREE.MeshBasicMaterial({ map: faceTexture(l, d) }));
    // the +y face of the box (TOP after the turn) has its texture up along -z, which the turn
    // brings to +Y: TOP reads upright from the front and in the top view without a rotation
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats);
    this.cubeRoot = new THREE.Group();
    this.cube.rotation.x = Math.PI / 2;
    this.cubeRoot.add(this.cube);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(this.cube.geometry),
      new THREE.LineBasicMaterial({ color: d ? 0x6a6a70 : 0x9a9aa2 }));
    edges.rotation.x = Math.PI / 2;
    this.cubeRoot.add(edges);
    // axis triad from the lower front-left corner
    const o = new THREE.Vector3(-.5, -.5, -.5);
    [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]].forEach(([a, v]) => {
      const g = new THREE.BufferGeometry().setFromPoints([o, o.clone().add(new THREE.Vector3(...v).multiplyScalar(1.25))]);
      this.cubeRoot.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: AXIS_COL[a] })));
    });
    this.cubeScene.add(this.cubeRoot);
    this._cubeHoverFace = -1;
  }

  _cubeRect() {
    const u = uiScale(), s = Math.round(Math.min(118, Math.max(84, this.w / u * 0.09)) * u), m = Math.round(10 * u);
    return { x: this.w - s - m, y: m, s };
  }

  _renderCube() {
    const r = this.renderer, R = this._cubeRect();
    const { back } = this._dirs(this.state);
    this.cubeCam.position.copy(back).multiplyScalar(3);
    this.cubeCam.lookAt(0, 0, 0);
    r.setScissorTest(true);
    r.setScissor(R.x, this.h - R.y - R.s, R.s, R.s);
    r.setViewport(R.x, this.h - R.y - R.s, R.s, R.s);
    r.clearDepth();
    r.render(this.cubeScene, this.cubeCam);
    r.setScissorTest(false);
  }

  _cubeFace(px, py) {
    const R = this._cubeRect();
    if (px < R.x || px > R.x + R.s || py < R.y || py > R.y + R.s) return -1;
    const ndc = new THREE.Vector2((px - R.x) / R.s * 2 - 1, -((py - R.y) / R.s) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.cubeCam);
    const hit = rc.intersectObject(this.cube)[0];
    return hit ? hit.face.materialIndex : -1;
  }

  _cubeHover(px, py) {
    const f = this._cubeFace(px, py);
    if (f === this._cubeHoverFace) return;
    if (this._cubeHoverFace >= 0) this.cube.material[this._cubeHoverFace].color.set(0xffffff);
    this._cubeHoverFace = f;
    if (f >= 0) this.cube.material[f].color.set(this.dark ? 0xff9a9a : 0xffb4b4);
    this.canvas.classList.toggle("on-cube", f >= 0);
    this.render();
  }

  dispose() {
    this._ro.disconnect();
    window.removeEventListener("resize", this._onWinResize);
    cancelAnimationFrame(this._raf); this._cancelHover(); clearTimeout(this._wheelT);
    this.anim = null;
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    if (this.cubeRoot) this.cubeRoot.traverse((o) => { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
    this.marks = []; this._drawMarks(false);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

window.MarqViewer = { create: (el) => new Viewer(el), version: THREE.REVISION };
window.dispatchEvent(new Event("marq-viewer-ready"));
