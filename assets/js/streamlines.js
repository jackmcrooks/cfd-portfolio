// =============================================================
//  Interactive streamlines for the 3D viewer
//
//  Traces streamlines live in the browser from a CFD velocity field
//  sampled on a regular grid (see ahmedBody25/04_postprocessing/scripts/
//  export_velocity_grid.py). The visitor moves a seed rake with sliders;
//  lines are integrated with RK4 and drawn as lit tubes coloured by |U|/U_inf.
//
//  Used by viewer.js when the viewer div has
//    data-streamlines="models/ahmed-velocity.json"   (grid header; .bin next to it)
//    data-controls="id-of-an-empty-div"              (where the control panel goes)
//  Optional: data-presets='[{...}]' (JSON list, see DEFAULT_PRESETS below)
//
//  Coordinates are the CFD ones (metres, z up). The field is a half model
//  (symmetry plane y = 0); y < 0 is filled in by mirroring.
// =============================================================
import * as THREE from "three";

const DEFAULT_PRESETS = [
  { name: "Overview", view: "front", rake: "vertical", x: -0.15, y: 0.12, z: 0.2, len: 0.34, n: 18, mirror: true, both: false },
  { name: "C-pillar vortices", view: "behind", rake: "grid", x: 0.8, y: 0.22, z: 0.305, len: 0.05, n: 36, mirror: true, both: false },
  { name: "Base wake", view: "side", rake: "grid", x: 1.12, y: 0.09, z: 0.17, len: 0.2, n: 36, mirror: true, both: true },
  { name: "Roof + slant", view: "side", rake: "vertical", x: -0.15, y: 0.02, z: 0.33, len: 0.12, n: 14, mirror: true, both: false },
  { name: "Underbody", view: "rear", rake: "horizontal", x: -0.15, y: 0.0, z: 0.03, len: 0.4, n: 20, mirror: false, both: false },
];

// ---- turbo colour map (Google, polynomial fit) ----
function turbo(t, out) {
  t = Math.min(1, Math.max(0, t));
  const t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t;
  out[0] = Math.min(1, Math.max(0, 0.13572138 + 4.6153926 * t - 42.66032258 * t2 + 132.13108234 * t3 - 152.94239396 * t4 + 59.28637943 * t5));
  out[1] = Math.min(1, Math.max(0, 0.09140261 + 2.19418839 * t + 4.84296658 * t2 - 14.18503333 * t3 + 4.27729857 * t4 + 2.82956604 * t5));
  out[2] = Math.min(1, Math.max(0, 0.1066733 + 12.64194608 * t - 60.58204836 * t2 + 110.36276771 * t3 - 89.90310912 * t4 + 27.34824973 * t5));
  return out;
}
const U_MAX_COLOUR = 1.4;   // colour scale top, in U/U_inf

// ---- velocity field on a regular grid ----
class Field {
  constructor(hdr, buf) {
    this.o = hdr.origin; this.h = hdr.spacing; this.n = hdr.dims;
    this.uInf = hdr.uInf; this.scale = hdr.scale;
    this.d = new Int16Array(buf);
    const [nx, ny, nz] = this.n;
    this.max = [this.o[0] + (nx - 1) * this.h, this.o[1] + (ny - 1) * this.h, this.o[2] + (nz - 1) * this.h];
  }
  // trilinear sample at (x,y,z); writes U (m/s) into out; returns false if outside the box
  sample(x, y, z, out) {
    const neg = y < 0; if (neg) y = -y;
    const { o, h, n, d } = this;
    const fx = (x - o[0]) / h, fy = (y - o[1]) / h, fz = (z - o[2]) / h;
    if (fx < 0 || fy < 0 || fz < 0 || fx > n[0] - 1 || fy > n[1] - 1 || fz > n[2] - 1) return false;
    let i = Math.min(Math.floor(fx), n[0] - 2), j = Math.min(Math.floor(fy), n[1] - 2), k = Math.min(Math.floor(fz), n[2] - 2);
    const tx = fx - i, ty = fy - j, tz = fz - k;
    const sx = 3, sy = 3 * n[0], sz = 3 * n[0] * n[1];
    const b = 3 * i + sy * j + sz * k;
    for (let c = 0; c < 3; c++) {
      const p = b + c;
      const c00 = d[p] * (1 - tx) + d[p + sx] * tx;
      const c10 = d[p + sy] * (1 - tx) + d[p + sy + sx] * tx;
      const c01 = d[p + sz] * (1 - tx) + d[p + sz + sx] * tx;
      const c11 = d[p + sz + sy] * (1 - tx) + d[p + sz + sy + sx] * tx;
      out[c] = ((c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz) / this.scale;
    }
    if (neg) out[1] = -out[1];
    return true;
  }
}

// ---- RK4 streamline integration with a fixed arc-length step ----
// Returns { pts: Float32Array xyz, spd: Float32Array |U|/Uinf, tau: Float32Array time in L/U_inf units }
function trace(field, seed, dir, opts) {
  const { ds, maxSteps, lRef } = opts;
  const pts = [seed[0], seed[1], seed[2]], spd = [], tau = [0];
  const u = [0, 0, 0], k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0];
  const stop = 0.02 * field.uInf;
  let x = seed[0], y = seed[1], z = seed[2], t = 0;
  // unit-direction field (so every step moves ds metres)
  const f = (px, py, pz, o) => {
    if (!field.sample(px, py, pz, u)) return -1;
    const m = Math.hypot(u[0], u[1], u[2]);
    if (m < stop) return -1;
    o[0] = dir * u[0] / m; o[1] = dir * u[1] / m; o[2] = dir * u[2] / m;
    return m;
  };
  let m0 = f(x, y, z, k1);
  if (m0 < 0) return null;
  spd.push(m0 / field.uInf);
  for (let s = 0; s < maxSteps; s++) {
    if (f(x + 0.5 * ds * k1[0], y + 0.5 * ds * k1[1], z + 0.5 * ds * k1[2], k2) < 0) break;
    if (f(x + 0.5 * ds * k2[0], y + 0.5 * ds * k2[1], z + 0.5 * ds * k2[2], k3) < 0) break;
    if (f(x + ds * k3[0], y + ds * k3[1], z + ds * k3[2], k4) < 0) break;
    x += ds / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += ds / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += ds / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    const m1 = f(x, y, z, k1);
    if (m1 < 0) break;
    t += ds / (0.5 * (m0 + m1)) * field.uInf / lRef;   // convective time units
    pts.push(x, y, z); spd.push(m1 / field.uInf); tau.push(t);
    m0 = m1;
  }
  if (spd.length < 3) return null;
  if (dir < 0) {   // flip backward lines so they run with the flow
    const n = spd.length, P = new Float32Array(3 * n), S = new Float32Array(n), T = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = n - 1 - i;
      P[3 * i] = pts[3 * r]; P[3 * i + 1] = pts[3 * r + 1]; P[3 * i + 2] = pts[3 * r + 2];
      S[i] = spd[r]; T[i] = tau[n - 1] - tau[r];
    }
    return { pts: P, spd: S, tau: T, back: true };
  }
  return { pts: new Float32Array(pts), spd: new Float32Array(spd), tau: new Float32Array(tau) };
}

// ---- build one merged tube mesh from many polylines ----
function buildTubes(lines, radius, sides) {
  let nv = 0, ni = 0;
  for (const L of lines) { const n = L.spd.length; nv += n * sides; ni += (n - 1) * sides * 6; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), tau = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  const c = [0, 0, 0];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), Tp = new THREE.Vector3(), tmp = new THREE.Vector3();
  let v = 0, q = 0;
  for (const L of lines) {
    const n = L.spd.length, P = L.pts, base = v;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      T.set(P[3 * b] - P[3 * a], P[3 * b + 1] - P[3 * a + 1], P[3 * b + 2] - P[3 * a + 2]).normalize();
      if (i === 0) {   // initial normal: any vector not parallel to T
        tmp.set(Math.abs(T.z) < 0.9 ? 0 : 1, 0, Math.abs(T.z) < 0.9 ? 1 : 0);
        N.crossVectors(T, tmp).normalize();
      } else {         // parallel transport
        N.addScaledVector(T, -N.dot(T)).normalize();
        if (!isFinite(N.x) || N.lengthSq() < 0.5) { tmp.set(0, 0, 1); N.crossVectors(T, tmp).normalize(); }
      }
      B.crossVectors(T, N);
      Tp.copy(T);
      turbo(L.spd[i] / U_MAX_COLOUR, c);
      for (let s = 0; s < sides; s++) {
        const ang = (s / sides) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = N.x * ca + B.x * sa, ny = N.y * ca + B.y * sa, nz = N.z * ca + B.z * sa;
        pos[3 * v] = P[3 * i] + radius * nx; pos[3 * v + 1] = P[3 * i + 1] + radius * ny; pos[3 * v + 2] = P[3 * i + 2] + radius * nz;
        nor[3 * v] = nx; nor[3 * v + 1] = ny; nor[3 * v + 2] = nz;
        col[3 * v] = c[0]; col[3 * v + 1] = c[1]; col[3 * v + 2] = c[2];
        tau[v] = L.tau[i];
        v++;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < sides; s++) {
        const a = base + i * sides + s, b = base + i * sides + ((s + 1) % sides);
        const a2 = a + sides, b2 = b + sides;
        idx[q++] = a; idx[q++] = a2; idx[q++] = b;
        idx[q++] = b; idx[q++] = a2; idx[q++] = b2;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aTau", new THREE.BufferAttribute(tau, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// lit tubes, with optional pulses travelling along each line at the local flow speed
function tubeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAnimate: { value: 1 } },
    vertexShader: `
      attribute vec3 color; attribute float aTau;
      varying vec3 vCol; varying vec3 vN; varying float vTau;
      void main() {
        vCol = color; vTau = aTau;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uAnimate;
      varying vec3 vCol; varying vec3 vN; varying float vTau;
      void main() {
        vec3 n = normalize(vN);
        float d1 = max(dot(n, normalize(vec3(0.4, 0.7, 0.6))), 0.0);
        float d2 = max(dot(n, normalize(vec3(-0.6, -0.2, 0.5))), 0.0);
        float shade = 0.45 + 0.55 * d1 + 0.25 * d2;
        float k = 1.0;
        if (uAnimate > 0.5) {
          float f = fract(vTau * 2.5 - uTime * 0.35);      // a pulse every 0.4 L/U_inf
          k = 0.8 + 0.9 * pow(f, 8.0);
        }
        vec3 c = pow(vCol, vec3(2.2)) * shade * k;          // colours are sRGB
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// =============================================================
export async function attachStreamlines(ctx) {
  const { el, gltfScene, camera, controls, onFrame } = ctx;
  const panelHost = el.dataset.controls ? document.getElementById(el.dataset.controls) : null;
  const url = el.dataset.streamlines;
  const lRef = parseFloat(el.dataset.lref || "1.044");
  let presets = DEFAULT_PRESETS;
  try { if (el.dataset.presets) presets = JSON.parse(el.dataset.presets); } catch (e) { /* keep defaults */ }

  // ---- body appearance (Cp colours / grey / hidden) ----
  const bodyMeshes = [];
  gltfScene.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();   // ParaView export has none
    bodyMeshes.push({ o, mat: o.material });
  });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a93a6, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide,
    transparent: true, opacity: 0.92 });
  function setBody(mode) {
    for (const b of bodyMeshes) {
      b.o.visible = mode !== "hide";
      b.o.material = mode === "cp" ? b.mat : grey;
    }
  }

  // ---- camera views around the body (world coords: CFD x -> x, z -> y, y -> -z) ----
  gltfScene.updateWorldMatrix(true, true);
  const bb = new THREE.Box3().setFromObject(gltfScene);
  const bc = bb.getCenter(new THREE.Vector3()), bs = bb.getSize(new THREE.Vector3());
  const Lb = bs.x;
  const VIEWS = {
    front:  { label: "Front ¾",     pos: [-1.3, 0.75, 1.45], tgt: [0.25, 0, 0] },
    rear:   { label: "Rear ¾",      pos: [1.9, 0.8, 1.3],    tgt: [0.45, 0, 0] },
    behind: { label: "From behind", pos: [2.9, 1.1, 0.0],    tgt: [0.75, -0.1, 0] },
    side:   { label: "Side",        pos: [0.55, 0.1, 2.3],   tgt: [0.55, 0, 0] },
    top:    { label: "Top",         pos: [0.6, 2.6, 0.001],  tgt: [0.6, 0, 0] },
  };
  function setView(name) {
    const v = VIEWS[name]; if (!v) return;
    const a = el.clientWidth / Math.max(1, el.clientHeight), f = a < 1 ? Math.min(1.8, 1 / Math.sqrt(a)) : 1;
    controls.target.set(bc.x + v.tgt[0] * Lb, bc.y + v.tgt[1] * Lb, bc.z + v.tgt[2] * Lb);
    camera.position.set(controls.target.x + (v.pos[0] - v.tgt[0]) * Lb * f, controls.target.y + (v.pos[1] - v.tgt[1]) * Lb * f,
      controls.target.z + (v.pos[2] - v.tgt[2]) * Lb * f);
    controls.update();
  }

  // ---- load the field ----
  const status = document.createElement("div");
  status.className = "sl-status";
  el.appendChild(status);
  status.textContent = "Loading velocity field…";
  let field;
  try {
    const hdr = await (await fetch(url)).json();
    const binUrl = new URL(url.replace(/\.json$/i, ".bin"), location.href);
    const res = await fetch(binUrl);
    if (!res.ok) throw new Error(res.status);
    field = new Field(hdr, await res.arrayBuffer());
  } catch (e) {
    status.textContent = "Couldn't load the velocity field.";
    return;
  }

  // ---- scene objects (in CFD coordinates, inside the model) ----
  const group = new THREE.Group();
  gltfScene.add(group);
  const mat = tubeMaterial();
  let tubes = null;
  const rakeGeo = new THREE.BufferGeometry();
  const rake = new THREE.Points(rakeGeo, new THREE.PointsMaterial({ color: 0xf2a03d, size: 6, sizeAttenuation: false, depthTest: false }));
  rake.renderOrder = 10;
  const rakeLine = new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xf2a03d, depthTest: false, transparent: true, opacity: 0.7 }));
  rakeLine.renderOrder = 10;
  group.add(rake, rakeLine);

  onFrame((t) => { mat.uniforms.uTime.value = t; });

  // ---- control panel ----
  const s = { ...presets[0], radius: 2.5, animate: true, body: "grey", showRake: true };
  const B = { x: [field.o[0] + 0.02, field.max[0] - 0.3], y: [-0.35, 0.35], z: [0.01, field.max[2] - 0.02] };
  const panel = document.createElement("div");
  panel.className = "sl-panel";
  panel.innerHTML = `
    <div class="sl-row sl-presets"><span class="sl-lbl">Presets</span>${presets.map((p, i) => `<button type="button" data-preset="${i}">${p.name}</button>`).join("")}</div>
    <div class="sl-row sl-presets"><span class="sl-lbl">View</span>${Object.entries(VIEWS).map(([k, v]) => `<button type="button" data-view="${k}">${v.label}</button>`).join("")}</div>
    <div class="sl-grid">
      <label>Seed rake
        <select data-k="rake">
          <option value="vertical">Vertical line</option>
          <option value="horizontal">Horizontal line</option>
          <option value="grid">Square grid</option>
        </select></label>
      <label>Streamwise x <output data-o="x"></output>
        <input type="range" data-k="x" min="${B.x[0]}" max="${B.x[1]}" step="0.005"></label>
      <label>Lateral y <output data-o="y"></output>
        <input type="range" data-k="y" min="${B.y[0]}" max="${B.y[1]}" step="0.005"></label>
      <label>Height z <output data-o="z"></output>
        <input type="range" data-k="z" min="${B.z[0]}" max="${B.z[1]}" step="0.005"></label>
      <label>Rake size <output data-o="len"></output>
        <input type="range" data-k="len" min="0.01" max="0.5" step="0.005"></label>
      <label>Seeds <output data-o="n"></output>
        <input type="range" data-k="n" min="2" max="64" step="1"></label>
      <label>Tube size <output data-o="radius"></output>
        <input type="range" data-k="radius" min="0.8" max="6" step="0.1"></label>
      <label>Body
        <select data-k="body">
          <option value="grey">Grey</option>
          <option value="cp">Coloured by C<sub>p</sub></option>
          <option value="hide">Hidden</option>
        </select></label>
    </div>
    <div class="sl-row">
      <label class="sl-check"><input type="checkbox" data-k="mirror"> Mirror to both sides</label>
      <label class="sl-check"><input type="checkbox" data-k="both"> Trace upstream too</label>
      <label class="sl-check"><input type="checkbox" data-k="animate"> Animate flow</label>
      <label class="sl-check"><input type="checkbox" data-k="showRake"> Show rake</label>
    </div>
    <div class="sl-foot">
      <div class="legend"><span>|U|/U<sub>∞</sub> 0</span><span class="bar"></span><span>${U_MAX_COLOUR}</span></div>
      <span class="sl-info"></span>
    </div>`;
  (panelHost || el.parentNode).appendChild(panel);
  const info = panel.querySelector(".sl-info");
  const fmt = { x: (v) => `${(+v).toFixed(3)} m`, y: (v) => `${(+v).toFixed(3)} m`, z: (v) => `${(+v).toFixed(3)} m`,
    len: (v) => `${(+v * 1000).toFixed(0)} mm`, n: (v) => `${v}`, radius: (v) => `${(+v).toFixed(1)} mm` };

  function syncPanel() {
    panel.querySelectorAll("[data-k]").forEach((inp) => {
      const k = inp.dataset.k;
      if (inp.type === "checkbox") inp.checked = !!s[k]; else inp.value = s[k];
      const o = panel.querySelector(`[data-o="${k}"]`);
      if (o) o.textContent = fmt[k](s[k]);
    });
  }

  panel.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    s[k] = e.target.type === "checkbox" ? e.target.checked : (e.target.tagName === "SELECT" ? e.target.value : +e.target.value);
    const o = panel.querySelector(`[data-o="${k}"]`);
    if (o) o.textContent = fmt[k](s[k]);
    if (k === "body") setBody(s.body);
    else if (k === "animate") mat.uniforms.uAnimate.value = s.animate ? 1 : 0;
    else if (k === "showRake") { rake.visible = rakeLine.visible = s.showRake; }
    else schedule();
  });
  panel.addEventListener("click", (e) => {
    const vb = e.target.closest("[data-view]");
    if (vb) { setView(vb.dataset.view); return; }
    const b = e.target.closest("[data-preset]");
    if (!b) return;
    Object.assign(s, presets[+b.dataset.preset]);
    if (s.view) setView(s.view);
    panel.querySelectorAll("[data-preset]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    syncPanel();
    schedule();
  });

  // ---- seeds from the rake settings ----
  function seeds() {
    const out = [], half = s.len / 2, n = Math.max(2, Math.round(s.n));
    if (s.rake === "grid") {
      const m = Math.max(2, Math.round(Math.sqrt(n)));
      for (let a = 0; a < m; a++) for (let b = 0; b < m; b++)
        out.push([s.x, s.y - half + (s.len * a) / (m - 1), s.z - half + (s.len * b) / (m - 1)]);
    } else {
      for (let a = 0; a < n; a++) {
        const f = -half + (s.len * a) / (n - 1);
        out.push(s.rake === "vertical" ? [s.x, s.y, s.z + f] : [s.x, s.y + f, s.z]);
      }
    }
    for (const p of out) p[2] = Math.max(0.002, p[2]);
    if (s.mirror) {
      const extra = [];
      for (const p of out) if (Math.abs(p[1]) > 0.004) extra.push([p[0], -p[1], p[2]]);
      out.push(...extra);
    }
    return out;
  }

  // ---- trace + rebuild (throttled to one rebuild per animation frame) ----
  let pending = false;
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(rebuild); } }
  function rebuild() {
    pending = false;
    const t0 = performance.now();
    const sd = seeds();
    const lines = [];
    const opts = { ds: 0.005, maxSteps: 900, lRef };
    for (const p of sd) {
      const f = trace(field, p, 1, opts); if (f) lines.push(f);
      if (s.both) { const b = trace(field, p, -1, opts); if (b) lines.push(b); }
    }
    if (tubes) { group.remove(tubes); tubes.geometry.dispose(); tubes = null; }
    if (lines.length) {
      tubes = new THREE.Mesh(buildTubes(lines, s.radius / 1000, 6), mat);
      tubes.frustumCulled = false;
      group.add(tubes);
    }
    // rake marker
    rakeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sd.flat()), 3));
    const segs = [];
    const half = s.len / 2;
    const add = (a, b) => segs.push(...a, ...b);
    const sides = s.mirror && Math.abs(s.y) > 0.004 ? [1, -1] : [1];
    for (const sg of sides) {
      const y = s.y * sg;
      if (s.rake === "vertical") add([s.x, y, s.z - half], [s.x, y, s.z + half]);
      else if (s.rake === "horizontal") add([s.x, y - half, s.z], [s.x, y + half, s.z]);
      else {
        const c = [[y - half, s.z - half], [y + half, s.z - half], [y + half, s.z + half], [y - half, s.z + half]];
        for (let i = 0; i < 4; i++) add([s.x, c[i][0], c[i][1]], [s.x, c[(i + 1) % 4][0], c[(i + 1) % 4][1]]);
      }
    }
    rakeLine.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs), 3));
    info.textContent = `${lines.length} lines · traced in ${Math.round(performance.now() - t0)} ms`;
  }

  setBody(s.body);
  syncPanel();
  status.remove();
  rebuild();
}
