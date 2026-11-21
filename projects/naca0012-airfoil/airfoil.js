// =============================================================
//  NACA 0012 page: flow explorer, polar / surface / convergence charts, wing calculator.
//  Data (exported from the OpenFOAM runs by Airfoil2D/04_postprocessing/scripts/export_web_*.py):
//    data/airfoil-data.json   coefficients, surface Cp/Cf, histories, validation data, mesh study
//    data/fields/aoaXX_<view>.bin + index.json   Ux/U, Uy/U, Cp on regular grids (uint16)
//    data/mesh.bin            the C-mesh points (float32) for the "show mesh" overlay
// =============================================================
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const C = { cfd: css("--s-cfd") || "#3d8ef0", exp: css("--s-exp") || "#f2a03d", nasa: css("--s-nasa") || "#57c785",
            line: css("--line") || "#24304a", muted: css("--muted") || "#74819a", text2: css("--text-2") || "#a9b4c8",
            text: css("--text") || "#e6ebf5", bg: css("--bg") || "#0b1020" };
const fmt = (v, d) => (v == null || Number.isNaN(v) ? "–" : v.toFixed(d));
const pct = (a, b) => (b ? `${a >= b ? "+" : "−"}${Math.abs((100 * (a - b)) / b).toFixed(1)} %` : "");

let D, FI;                          // page data, field index
const state = { i: 3, view: "full", colour: "speed", polarTab: "cl", surfTab: "cp", convTab: "cl", gridTab: "0" };
const listeners = [];
const onAngle = (f) => listeners.push(f);
function setAngle(i) {
  state.i = i;
  $("aSlider").value = i;
  $("aOut").textContent = `${D.runs[i].alpha}°`;
  listeners.forEach((f) => f());
}

// ---------------------------------------------------------------- colour map (turbo, as on the Ahmed page)
function turbo(t) {
  t = Math.min(1, Math.max(0, t));
  const r = 34.61 + t * (1172.33 - t * (10793.56 - t * (33300.12 - t * (38394.49 - t * 14825.05))));
  const g = 23.31 + t * (557.33 + t * (1225.33 - t * (3574.96 - t * (1073.77 + t * 707.56))));
  const b = 27.2 + t * (3211.1 - t * (15327.97 - t * (27814 - t * (22569.18 - t * 6838.66))));
  return [r, g, b].map((v) => Math.max(0, Math.min(255, v)) | 0);
}

// ---------------------------------------------------------------- airfoil outline (NASA TMR formula)
const yNaca = (x) => 0.594689181 * (0.298222773 * Math.sqrt(x) - 0.127125232 * x - 0.357907906 * x * x
  + 0.291984971 * x ** 3 - 0.105174606 * x ** 4);
const OUTLINE = (() => {
  const up = [], lo = [];
  for (let k = 0; k <= 200; k++) { const s = k / 200, x = s * s; up.push([x, yNaca(x)]); lo.push([x, -yNaca(x)]); }
  return up.concat(lo.reverse());
})();

// ---------------------------------------------------------------- Ladson interpolation (attached flow only)
function ladsonAt(a, col) {
  const pts = D.ladson.filter((p) => p[0] < 17.5).sort((p, q) => p[0] - q[0]);
  for (let k = 1; k < pts.length; k++) {
    const [a0, a1] = [pts[k - 1][0], pts[k][0]];
    if (a >= a0 && a <= a1) return pts[k - 1][col] + ((pts[k][col] - pts[k - 1][col]) * (a - a0)) / (a1 - a0);
  }
  return null;
}

// =============================================================
//  SVG chart with hover tooltip (nearest point) and optional click
// =============================================================
function chart(el, o) {
  // drawing width follows the real width (between 360 and 760 px) so labels stay readable on phones
  const W = Math.round(Math.max(360, Math.min(o.w || 760, el.clientWidth || 760))), H = Math.round((o.h || 360) * (W < 560 ? 0.85 : 1)), P = { l: 54, r: 14, t: 14, b: 44 };
  const pts = o.series.filter((s) => !s.hidden).flatMap((s) => s.pts);
  let [x0, x1] = o.x.range || [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  let [y0, y1] = o.y.range || [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  if (!o.y.range) { const m = 0.07 * (y1 - y0 || 1); y0 -= m; y1 += m; }
  const lx = o.x.log, fx = (v) => (lx ? Math.log10(v) : v);
  const X = (v) => P.l + ((fx(v) - fx(x0)) / (fx(x1) - fx(x0))) * (W - P.l - P.r);
  const Y = (v) => { let t = (v - y0) / (y1 - y0); if (o.y.invert) t = 1 - t; return H - P.b - t * (H - P.t - P.b); };
  const ticks = (a, b, n = 6) => {
    const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 2.5, 5, 10].find((k) => (b - a) / (k * step) <= n) * step;
    const out = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-12; v += m) out.push(+v.toPrecision(10)); return out;
  };
  const xt = lx ? o.x.ticks : ticks(x0, x1), yt = ticks(y0, y1);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || ""}">`;
  (o.bands || []).forEach((b) => { s += `<rect x="${X(b[0])}" y="${P.t}" width="${X(b[1]) - X(b[0])}" height="${H - P.t - P.b}" fill="${b[2]}" />`;
    if (b[3]) s += `<text x="${(X(b[0]) + X(b[1])) / 2}" y="${P.t + 14}" fill="${C.muted}" font-size="11" text-anchor="middle">${b[3]}</text>`; });
  yt.forEach((v) => { s += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}" stroke-width="1"/>
    <text x="${P.l - 8}" y="${Y(v) + 4}" fill="${C.muted}" font-size="11" text-anchor="end">${o.y.fmt ? o.y.fmt(v) : v}</text>`; });
  xt.forEach((v) => { s += `<text x="${X(v)}" y="${H - P.b + 18}" fill="${C.muted}" font-size="11" text-anchor="middle">${o.x.fmt ? o.x.fmt(v) : v}</text>`; });
  (o.hlines || []).forEach((h) => { s += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(h[0])}" y2="${Y(h[0])}" stroke="${h[1]}" stroke-dasharray="5 4" stroke-width="1.5"/>
    <text x="${W - P.r - 4}" y="${Y(h[0]) - 6}" fill="${h[1]}" font-size="11" text-anchor="end">${h[2]}</text>`; });
  s += `<text x="${(P.l + W - P.r) / 2}" y="${H - 6}" fill="${C.text2}" font-size="12" text-anchor="middle">${o.x.label}</text>
        <text transform="translate(14 ${(P.t + H - P.b) / 2}) rotate(-90)" fill="${C.text2}" font-size="12" text-anchor="middle">${o.y.label}</text>`;
  s += `<clipPath id="clip-${el.id}"><rect x="${P.l}" y="${P.t - 6}" width="${W - P.l - P.r}" height="${H - P.t - P.b + 12}"/></clipPath><g clip-path="url(#clip-${el.id})">`;
  const hits = [];
  [...o.series].sort((a, b) => (a.z || 0) - (b.z || 0)).forEach((se) => {
    if (se.hidden || !se.pts.length) return;
    if (se.kind.includes("line")) s += `<polyline fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" ${se.dash ? `stroke-dasharray="${se.dash}"` : ""}
        points="${se.pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")}"/>`;
    se.pts.forEach((p, k) => {
      const cx = X(p[0]), cy = Y(p[1]);
      if (se.kind.includes("dots")) s += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${se.color}" stroke="${C.bg}" stroke-width="2"/>`;
      if (se.kind.includes("squares")) s += `<rect x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" fill="none" stroke="${se.color}" stroke-width="2"/>`;
      if (se.kind.includes("ring")) s += `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${se.color}" stroke-width="2" stroke-dasharray="2 2"/>`;
      if (!se.noHover) hits.push({ cx, cy, se, p, k });
    });
  });
  if (o.mark) s += `<circle cx="${X(o.mark[0])}" cy="${Y(o.mark[1])}" r="10" fill="none" stroke="${C.text}" stroke-width="2"/>`;
  s += `</g><line class="xh" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="${C.muted}" stroke-dasharray="3 3" opacity="0"/></svg><div class="tip"></div>`;
  el.innerHTML = s;
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), xh = el.querySelector(".xh");
  const near = (ev) => {
    const r = svg.getBoundingClientRect(), sx = ((ev.clientX - r.left) / r.width) * W, sy = ((ev.clientY - r.top) / r.height) * H;
    let best = null, bd = 30 ** 2;
    hits.forEach((h) => { const d = (h.cx - sx) ** 2 + (h.cy - sy) ** 2; if (d < bd) { bd = d; best = h; } });
    return { best, r };
  };
  svg.addEventListener("mousemove", (ev) => {
    const { best, r } = near(ev);
    if (!best) { tip.style.display = "none"; xh.setAttribute("opacity", 0); return; }
    xh.setAttribute("x1", best.cx); xh.setAttribute("x2", best.cx); xh.setAttribute("opacity", 0.6);
    tip.innerHTML = `<span style="color:${best.se.color}">●</span> ${best.se.name}<br>${o.tipText(best.p, best.se, best.k)}`;
    tip.style.display = "block";
    const px = (best.cx / W) * r.width, py = (best.cy / H) * r.height;
    tip.style.left = `${Math.min(px + 12, r.width - tip.offsetWidth - 4)}px`; tip.style.top = `${Math.max(py - 44, 0)}px`;
    svg.style.cursor = best.se.onClick ? "pointer" : "default";
  });
  svg.addEventListener("mouseleave", () => { tip.style.display = "none"; xh.setAttribute("opacity", 0); });
  svg.addEventListener("click", (ev) => { const { best } = near(ev); if (best && best.se.onClick) best.se.onClick(best.k); });
}

function legend(el, series, redraw) {
  el.innerHTML = "";
  series.forEach((se) => {
    const k = document.createElement("span");
    k.className = "key" + (se.hidden ? " off" : "");
    const glyph = se.kind.includes("squares") ? `<rect x="7" y="2" width="8" height="8" fill="none" stroke="${se.color}" stroke-width="2"/>`
      : se.kind.includes("dots") && !se.kind.includes("line") ? `<circle cx="11" cy="6" r="4" fill="${se.color}"/>`
      : `<line x1="1" x2="21" y1="6" y2="6" stroke="${se.color}" stroke-width="2" ${se.dash ? `stroke-dasharray="${se.dash}"` : ""}/>`;
    k.innerHTML = `<svg viewBox="0 0 22 12">${glyph}</svg>${se.name}`;
    if (redraw) k.addEventListener("click", () => { se.hidden = !se.hidden; redraw(); });
    el.appendChild(k);
  });
}

function tabs(id, key, redraw) {
  const root = $(id);
  root.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    state[key] = b.dataset.t || b.dataset.v || b.dataset.c; redraw();
  }));
}

// =============================================================
//  Flow explorer
// =============================================================
const fieldCache = {};
async function loadField(alpha, view) {
  const key = `${alpha}_${view}`;
  if (!fieldCache[key]) {
    fieldCache[key] = (async () => {
      const [nx, ny] = FI.views[view].n, v = FI.angles.find((a) => a.alpha === alpha).boxes[view];
      const buf = await (await fetch(`data/fields/aoa${String(Math.round(alpha)).padStart(2, "0")}_${view}.bin`)).arrayBuffer();
      const q = new Uint16Array(buf), n = nx * ny;
      const dec = (k, name) => { const [lo, hi] = FI.ranges[name], out = new Float32Array(n);
        for (let j = 0; j < n; j++) out[j] = q[k * n + j] ? lo + ((q[k * n + j] - 1) / 65534) * (hi - lo) : NaN; return out; };
      const f = { nx, ny, x: v.x, y: v.y, ux: dec(0, "ux"), uy: dec(1, "uy"), cp: dec(2, "cp") };
      f.speed = f.ux.map((u, j) => Math.hypot(u, f.uy[j]));
      return f;
    })();
  }
  return fieldCache[key];
}

let meshPts = null;
async function loadMesh() {
  if (!meshPts) {
    const b = new Float32Array(await (await fetch("data/mesh.bin")).arrayBuffer());
    meshPts = { ni: b[0], nj: b[1], p: b.subarray(2) };
  }
  return meshPts;
}

function explorer() {
  const cv = $("flow"), ctx = cv.getContext("2d"), wrap = $("flowWrap");
  let F = null, lines = [], seeds = [], fieldImg = null, meshImg = null, anim = 0, phase = 0;
  const view = () => F || FI.views[state.view];   // the sampling window of the field on screen
  // wind frame: the data is rotated so the free stream is horizontal and the airfoil pitches nose-up
  // by alpha about the quarter chord. Airfoil outline and mesh (body coordinates) are rotated to match.
  const rot = () => { const a = (D.runs[state.i].alpha * Math.PI) / 180; return [Math.cos(a), Math.sin(a), FI.pivot[0]]; };
  const toWind = (x, y) => { const [c, s, p] = rot(), dx = x - p; return [p + dx * c + y * s, -dx * s + y * c]; };
  const toBody = (x, y) => { const [c, s, p] = rot(), dx = x - p; return [p + dx * c - y * s, dx * s + y * c]; };

  function size() {
    const v = view(), w = wrap.clientWidth, ar = (v.y[1] - v.y[0]) / (v.x[1] - v.x[0]);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * ar * dpr);
  }
  const toPx = (x, y) => { const v = view(); return [((x - v.x[0]) / (v.x[1] - v.x[0])) * cv.width, (1 - (y - v.y[0]) / (v.y[1] - v.y[0])) * cv.height]; };
  const toXY = (px, py) => { const v = view(); return [v.x[0] + (px / cv.width) * (v.x[1] - v.x[0]), v.y[0] + (1 - py / cv.height) * (v.y[1] - v.y[0])]; };

  function sample(arr, x, y) {      // bilinear, NaN inside the airfoil or outside the box
    const fx = ((x - F.x[0]) / (F.x[1] - F.x[0])) * (F.nx - 1), fy = ((y - F.y[0]) / (F.y[1] - F.y[0])) * (F.ny - 1);
    if (fx < 0 || fy < 0 || fx > F.nx - 1 || fy > F.ny - 1) return NaN;
    const i = Math.min(Math.floor(fx), F.nx - 2), j = Math.min(Math.floor(fy), F.ny - 2), a = fx - i, b = fy - j, n = F.nx;
    return (1 - a) * (1 - b) * arr[j * n + i] + a * (1 - b) * arr[j * n + i + 1] + (1 - a) * b * arr[(j + 1) * n + i] + a * b * arr[(j + 1) * n + i + 1];
  }
  // one colour scale for every angle and both views (covers the extremes: U/Uinf 3.72, Cp -13.2 at 18 deg)
  const range = () => (state.colour === "speed" ? [0, 3.8] : [-13.5, 1]);
  function paintField() {
    const arr = state.colour === "speed" ? F.speed : F.cp, [lo, hi] = range();
    const img = new ImageData(F.nx, F.ny);
    for (let j = 0; j < F.ny; j++) for (let i = 0; i < F.nx; i++) {
      const v = arr[j * F.nx + i], o = ((F.ny - 1 - j) * F.nx + i) * 4;
      if (Number.isNaN(v)) continue;
      const [r, g, b] = turbo((v - lo) / (hi - lo)); img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    fieldImg = document.createElement("canvas"); fieldImg.width = F.nx; fieldImg.height = F.ny;
    fieldImg.getContext("2d").putImageData(img, 0, 0);
    // colour bar
    const cb = $("cbar"), c2 = cb.getContext("2d");
    for (let k = 0; k < cb.width; k++) { const [r, g, b] = turbo(k / (cb.width - 1)); c2.fillStyle = `rgb(${r},${g},${b})`; c2.fillRect(k, 0, 1, cb.height); }
    $("cbLo").textContent = lo.toFixed(1); $("cbHi").textContent = hi.toFixed(1);
    $("cbName").innerHTML = state.colour === "speed" ? "speed U / U<sub>∞</sub>" : "pressure coefficient C<sub>p</sub>";
  }
  function trace(x, y, dir, maxLen) {   // streamline by RK4 along the unit velocity direction
    const v = view(), h = (v.x[1] - v.x[0]) / 500, pts = [[x, y, 0]];
    let t = 0;
    const dirAt = (px, py) => { const u = sample(F.ux, px, py), w = sample(F.uy, px, py), m = Math.hypot(u, w);
      return Number.isNaN(m) || m < 1e-3 ? null : [dir * u / m, dir * w / m, m]; };
    for (let k = 0; k < maxLen / h; k++) {
      const k1 = dirAt(x, y); if (!k1) break;
      const k2 = dirAt(x + 0.5 * h * k1[0], y + 0.5 * h * k1[1]); if (!k2) break;
      const k3 = dirAt(x + 0.5 * h * k2[0], y + 0.5 * h * k2[1]); if (!k3) break;
      const k4 = dirAt(x + h * k3[0], y + h * k3[1]); if (!k4) break;
      x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      t += h / k1[2];                       // time = distance / speed, for the animation
      pts.push([x, y, dir * t]);
    }
    return pts;
  }
  function buildLines() {
    lines = [];
    if (!$("optStream").checked) return;
    const v = view(), L = 3 * (v.x[1] - v.x[0]);
    const n = state.view === "full" ? 26 : 22, xs = v.x[0] + 0.004 * (v.x[1] - v.x[0]);
    const ya = v.y[0] + 0.02 * (v.y[1] - v.y[0]), yb = v.y[1] - 0.02 * (v.y[1] - v.y[0]);
    for (let k = 0; k < n; k++) lines.push({ pts: trace(xs, ya + ((yb - ya) * k) / (n - 1), 1, L), user: false });
    seeds.filter((s) => s.view === state.view).forEach((s) => {
      const b = trace(s.x, s.y, -1, L).reverse(), f = trace(s.x, s.y, 1, L);
      lines.push({ pts: b.concat(f.slice(1)), user: true });
    });
  }
  async function paintMesh() {
    meshImg = null;
    if (!$("optMesh").checked) return;
    const M = await loadMesh();
    meshImg = document.createElement("canvas"); meshImg.width = cv.width; meshImg.height = cv.height;
    const g = meshImg.getContext("2d"), step = state.view === "full" ? 2 : 1;
    g.strokeStyle = "rgba(255,255,255,0.28)"; g.lineWidth = 0.6;
    const P = (i, j) => { const o = (i * M.nj + j) * 2; return toPx(...toWind(M.p[o], M.p[o + 1])); };
    for (let i = 0; i < M.ni; i += step) { g.beginPath(); for (let j = 0; j < M.nj; j++) { const [a, b] = P(i, j); j ? g.lineTo(a, b) : g.moveTo(a, b); } g.stroke(); }
    for (let j = 0; j < M.nj; j += step) { g.beginPath(); for (let i = 0; i < M.ni; i++) { const [a, b] = P(i, j); i ? g.lineTo(a, b) : g.moveTo(a, b); } g.stroke(); }
  }
  function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!F) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fieldImg, 0, 0, cv.width, cv.height);
    if (meshImg) ctx.drawImage(meshImg, 0, 0);
    ctx.lineWidth = Math.max(1, cv.width / 900);
    lines.forEach((ln) => {
      ctx.strokeStyle = ln.user ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)";
      ctx.beginPath(); ln.pts.forEach((p, k) => { const [a, b] = toPx(p[0], p[1]); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke();
    });
    if ($("optAnim").checked && lines.length) {        // pulses moving at the local flow speed
      const v = view(), period = 0.35 * (v.x[1] - v.x[0]);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      // t (travel time) increases along every line; a dot sits wherever (t - phase) crosses a multiple of the period
      lines.forEach((ln) => {
        for (let k = 1; k < ln.pts.length; k++) {
          const p = ln.pts[k], q = ln.pts[k - 1];
          if (Math.floor((p[2] - phase) / period) !== Math.floor((q[2] - phase) / period)) {
            const [a, b] = toPx(p[0], p[1]); ctx.beginPath(); ctx.arc(a, b, Math.max(1.6, cv.width / 600), 0, 7); ctx.fill();
          }
        }
      });
    }
    const fs = Math.max(11, cv.width / 70), alpha = D.runs[state.i].alpha;
    if (state.view === "full") {            // horizontal reference through the pivot + chord line, to read alpha
      const [x0, y0] = toPx(view().x[0], 0), [x1] = toPx(view().x[1], 0), [te0, te1] = toPx(...toWind(1.35, 0));
      ctx.setLineDash([6, 6]); ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.moveTo(...toPx(...toWind(-0.1, 0))); ctx.lineTo(te0, te1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.text; ctx.font = `600 ${fs * 1.15}px Inter, sans-serif`;
      ctx.fillText(`α = ${alpha}°`, te0 + 8, (te1 + y0) / 2 + fs * 0.4);
    }
    ctx.fillStyle = "#1a2133"; ctx.strokeStyle = "#d9dee8"; ctx.lineWidth = Math.max(1.2, cv.width / 700);
    ctx.beginPath(); OUTLINE.forEach((p, k) => { const [a, b] = toPx(...toWind(p[0], p[1])); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // free-stream arrow (always horizontal in the wind frame)
    const [ax, ay] = [cv.width * 0.07, cv.height * 0.12], L = cv.width * 0.06;
    ctx.strokeStyle = C.text; ctx.fillStyle = C.text; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax - L, ay); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 9, ay - 4); ctx.lineTo(ax - 9, ay + 4); ctx.fill();
    ctx.font = `${fs}px Inter, sans-serif`; ctx.fillText("U∞", ax + 6, ay + 4);
  }
  function loop() {
    phase += 0.0025 * (view().x[1] - view().x[0]);
    draw();
    anim = $("optAnim").checked ? requestAnimationFrame(loop) : 0;
  }
  async function refresh(rebuild = true) {
    $("flowLoading").style.display = "grid";
    F = await loadField(D.runs[state.i].alpha, state.view);
    size(); paintField(); if (rebuild) buildLines(); await paintMesh();
    $("flowLoading").style.display = "none";
    cancelAnimationFrame(anim); anim = 0;
    if ($("optAnim").checked) loop(); else draw();
  }

  cv.addEventListener("mousemove", (ev) => {
    if (!F) return;
    const r = cv.getBoundingClientRect(), [x, y] = toXY(((ev.clientX - r.left) / r.width) * cv.width, ((ev.clientY - r.top) / r.height) * cv.height);
    const s = sample(F.speed, x, y), cp = sample(F.cp, x, y), [bx, by] = toBody(x, y);   // position along the chord
    $("readout").textContent = Number.isNaN(s) ? `x/c ${bx.toFixed(3)}  y/c ${by.toFixed(3)}\n(inside the airfoil)`
      : `x/c ${bx.toFixed(3)}  y/c ${by.toFixed(3)}\nU/U∞ ${s.toFixed(3)}   Cp ${cp.toFixed(3)}`;
  });
  cv.addEventListener("click", (ev) => {
    const r = cv.getBoundingClientRect(), [x, y] = toXY(((ev.clientX - r.left) / r.width) * cv.width, ((ev.clientY - r.top) / r.height) * cv.height);
    if (Number.isNaN(sample(F.speed, x, y))) return;
    seeds.push({ x, y, view: state.view }); buildLines(); if (!anim) draw();
  });
  $("clearSeeds").addEventListener("click", () => { seeds = []; buildLines(); if (!anim) draw(); });
  let sweep = 0;                           // step through all angles to watch the airfoil pitch up
  $("sweep").addEventListener("click", () => {
    if (sweep) { clearInterval(sweep); sweep = 0; $("sweep").textContent = "▶ Sweep angles"; return; }
    D.runs.forEach((r) => loadField(r.alpha, state.view));          // fetch every angle up front
    $("sweep").textContent = "❚❚ Stop";
    const step = () => setAngle((state.i + 1) % D.runs.length);
    step(); sweep = setInterval(step, 1300);
  });
  ["optStream", "optAnim", "optMesh"].forEach((id) => $(id).addEventListener("change", () => refresh(id === "optStream")));
  tabs("viewSeg", "view", () => refresh());
  tabs("colSeg", "colour", () => refresh(false));
  window.addEventListener("resize", () => { clearTimeout(window._rt); window._rt = setTimeout(() => refresh(false), 150); });
  onAngle(() => refresh());
}

// =============================================================
//  Angle strip (numbers for the selected angle)
// =============================================================
function strip() {
  const r = D.runs[state.i], lcl = ladsonAt(r.alpha, 1), lcd = ladsonAt(r.alpha, 2);
  const cell = (label, value, note) => `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div><div class="note">${note}</div></div>`;
  $("strip").innerHTML =
    cell("Lift C<sub>l</sub>", fmt(r.cl, 4), lcl != null ? `Ladson ${fmt(lcl, 3)} <span class="delta">(${pct(r.cl, lcl)})</span>` : r.alpha === 18 ? `<span class="warn">Experiment stalled: 1.00</span>` : "")
    + cell("Drag C<sub>d</sub>", fmt(r.cd, 5), lcd != null ? `Ladson ${fmt(lcd, 5)} <span class="delta">(${pct(r.cd, lcd)})</span>` : r.alpha === 18 ? `<span class="warn">Experiment: 0.188</span>` : "")
    + cell("Lift / drag", r.cd ? fmt(r.cl / r.cd, 1) : "–", "efficiency")
    + cell("Moment C<sub>m</sub>", fmt(r.cm, 4), "about ¼ chord")
    + cell("Run", r.run.slice(3, 5), r.run.slice(6));
}

// =============================================================
//  Polar charts
// =============================================================
function polar() {
  const T = state.polarTab, runs = D.runs, sel = runs[state.i];
  const defs = {
    cl: { x: "angle of attack α [deg]", y: "lift coefficient C<sub>l</sub>", f: (a, cl) => [a, cl], sub: "Lift rises linearly, then the experiment stalls just past 17°" },
    polar: { x: "lift coefficient C<sub>l</sub>", y: "drag coefficient C<sub>d</sub>", f: (a, cl, cd) => [cl, cd], sub: "Drag for a given lift; Ladson points after stall left out" },
    cd: { x: "angle of attack α [deg]", y: "drag coefficient C<sub>d</sub>", f: (a, cl, cd) => [a, cd], sub: "Within 3 % up to 10°, then 9–17 % above the experiment" },
    ld: { x: "angle of attack α [deg]", y: "lift / drag C<sub>l</sub>/C<sub>d</sub>", f: (a, cl, cd) => [a, a === 0 ? 0 : cl / cd], sub: "Best efficiency around 8–10°" },
  }[T];
  const lad = D.ladson.filter((p) => p[0] > -0.5 && (T !== "polar" || p[0] < 17.5));
  polar.series = polar.series || [
    { name: "OpenFOAM k-ω SST (this work)", kind: "line dots", color: C.cfd, z: 1 },
    { name: "Ladson experiment (tripped)", kind: "dots", color: C.exp },
    { name: "NASA CFL3D SST", kind: "squares", color: C.nasa },
  ];
  const [s0, s1, s2] = polar.series;
  s0.pts = runs.map((r) => defs.f(r.alpha, r.cl, r.cd)); s0.onClick = (k) => setAngle(k);
  s1.pts = lad.map((p) => defs.f(p[0], p[1], p[2]));
  s2.pts = D.nasa.polar.map((p) => defs.f(p[0], p[1], p[2]));
  const tip = (p, se, k) => {
    if (se === s0) { const r = runs[k]; return `α ${r.alpha}° · C<sub>l</sub> ${fmt(r.cl, 4)} · C<sub>d</sub> ${fmt(r.cd, 5)}<br><span class="muted">click to select</span>`; }
    const src = se === s1 ? lad[k] : D.nasa.polar[k]; return `α ${fmt(src[0], 2)}° · C<sub>l</sub> ${fmt(src[1], 4)} · C<sub>d</sub> ${fmt(src[2], 5)}`;
  };
  $("polarSub").textContent = defs.sub;
  const redraw = () => polar();
  legend($("polarLegend"), polar.series, redraw);
  chart($("polarChart"), { series: polar.series, x: { label: defs.x }, y: { label: defs.y.replace(/<\/?sub>/g, "") },
    mark: defs.f(sel.alpha, sel.cl, sel.cd), tipText: tip, label: "Lift and drag polar",
    bands: T === "cl" || T === "cd" || T === "ld" ? [[17.05, 18.6, "rgba(242,160,61,0.08)", "stall (experiment)"]] : [] });
}

// =============================================================
//  Surface Cp / Cf
// =============================================================
function surface() {
  const r = D.runs[state.i], a = r.alpha, T = state.surfTab, col = T === "cp" ? 1 : 2, ref = [0, 10, 15].includes(a);
  surface.series = surface.series || {};
  const key = T;
  surface.series[key] = surface.series[key] || [
    { name: "OpenFOAM, upper surface", kind: "line", color: C.cfd, z: 1 },
    { name: "OpenFOAM, lower surface", kind: "line", color: C.cfd, dash: "6 4", z: 1 },
    { name: T === "cp" ? "Gregory & O'Reilly experiment (upper, Re 2.9 M)" : "", kind: "dots", color: C.exp },
    { name: "NASA CFL3D SST", kind: "squares", color: C.nasa },
  ];
  const [u, l, e, n] = surface.series[key];
  u.pts = r.surface.upper.map((p) => [p[0], p[col]]);
  l.pts = r.surface.lower.map((p) => [p[0], p[col]]);
  e.pts = T === "cp" && ref ? D.gregory[a] : [];
  const thin = (arr, n) => arr.filter((p, k) => k % Math.max(1, Math.ceil(arr.length / n)) === 0);
  n.pts = ref ? thin((T === "cp" ? D.nasa.cp[a] : D.nasa.cf[a]).filter((p) => p[0] >= 0 && p[0] <= 1), 44) : [];
  [e, n].forEach((s) => (s.noHover = false));
  const shown = surface.series[key].filter((s) => s.name && (s.pts.length || s === u || s === l));
  $("surfAngle").innerHTML = `α = ${a}° (${r.run})${ref ? "" : " · reference data only at 0°, 10°, 15°"}`;
  $("surfSub").textContent = T === "cp"
    ? "Pressure along the chord (suction plotted up). The spike at the nose is the suction peak that carries most of the lift."
    : "Wall friction along the chord. Below zero means the flow near the wall runs backwards: separation.";
  const negs = r.surface.upper.filter((p) => p[0] > 0.5 && p[2] < 0), sep = negs.length >= 3 ? negs[0] : null;
  const nose = a > 0 ? " On the lower surface, C<sub>f</sub> dips below zero right at the nose: that is the air ahead of the stagnation point running forward around the leading edge, not separation." : "";
  $("surfNote").innerHTML = T === "cf"
    ? (sep ? `<span class="warn">Upper-surface flow reverses from x/c ≈ ${fmt(sep[0], 2)} to the trailing edge</span>: trailing-edge separation, growing with angle (16° → 0.95, 17° → 0.86, 18° → 0.74). The real airfoil stalls suddenly at this point; the steady model only shows the start of it.`
           : "No reversed flow on the upper surface: the boundary layer stays attached to the trailing edge.") + nose
    : `Minimum C<sub>p</sub> ${fmt(Math.min(...r.surface.upper.map((p) => p[1])), 2)}${ref ? ` (NASA SST ${fmt(Math.min(...D.nasa.cp[a].map((p) => p[1])), 2)})` : ""}.`;
  legend($("surfLegend"), shown, () => surface());
  chart($("surfChart"), { series: shown, x: { label: "x/c", range: [0, 1] }, y: { label: T === "cp" ? "Cp" : "Cf", invert: T === "cp" },
    hlines: T === "cf" ? [[0, C.muted, "separation if below"]] : [], label: "Surface distribution",
    tipText: (p) => `x/c ${fmt(p[0], 3)} · ${T === "cp" ? "C<sub>p</sub>" : "C<sub>f</sub>"} ${fmt(p[1], T === "cp" ? 3 : 5)}` });
}

// =============================================================
//  Convergence + mesh study
// =============================================================
function convergence() {
  const r = D.runs[state.i], h = r.history, T = state.convTab, ys = T === "cl" ? h.cl : h.cd;
  const pts = h.it.map((t, k) => [t, ys[k]]), late = pts.filter((p) => p[0] >= 1000).map((p) => p[1]);
  const lo = Math.min(...late), hi = Math.max(...late), m = Math.max(hi - lo, Math.abs(hi) * 0.01) * 0.6;
  $("convSub").textContent = `α = ${r.alpha}°: ${T === "cl" ? "lift" : "drag"} coefficient over ${h.it[h.it.length - 1]} iterations`;
  chart($("convChart"), { w: 440, h: 270, label: "Convergence history",
    series: [{ name: T === "cl" ? "C<sub>l</sub>" : "C<sub>d</sub>", kind: "line", color: C.cfd, pts }],
    x: { label: "iteration", range: [0, h.it[h.it.length - 1]] }, y: { label: T === "cl" ? "Cl" : "Cd", range: [lo - m, hi + m],
      fmt: (v) => v.toPrecision(T === "cl" ? 4 : 3) },
    bands: [[5500, 6000, "rgba(61,142,240,0.12)", ""]],
    tipText: (p) => `iteration ${p[0]} · ${fmt(p[1], T === "cl" ? 4 : 5)}` });
}

function grid() {
  const a = state.gridTab, g = D.grid[a], ref = a === "0" ? [0.00809, 0.00809] : [0.02219, 0.01831];
  const done = g.filter((p) => p.cd != null);
  chart($("gridChart"), { w: 440, h: 270, label: "Mesh independence",
    series: [{ name: "OpenFOAM SST", kind: "line dots", color: C.cfd, pts: done.map((p) => [p.cells, p.cd]) }],
    x: { label: "cells", log: true, range: [20000, 640000], ticks: [28440, 112770, 450534], fmt: (v) => `${Math.round(v / 1000)}k` },
    y: { label: "Cd", range: a === "0" ? [0.0077, 0.0083] : [0.017, 0.0235], fmt: (v) => v.toFixed(4) },
    hlines: a === "0" ? [[ref[0], C.nasa, "NASA SST / Ladson 0.00809"]] : [[ref[0], C.nasa, "NASA SST 0.02219"], [ref[1], C.exp, "Ladson 0.01831"]],
    tipText: (p, se, k) => `${done[k].cells.toLocaleString()} cells · C<sub>d</sub> ${fmt(p[1], 5)} · ${done[k].run}` });
  $("gridNote").innerHTML = g.map((p) => `${(p.cells / 1000).toFixed(0)}k: ${p.cd != null ? fmt(p.cd, 5) : '<span class="pending">running</span>'}`).join(" · ")
    + (a === "0" ? ". Fine value preliminary (still being extended to 12,000 iterations)." : ". Lift is the same on all meshes (1.494).");
}

// =============================================================
//  Validation table and wing calculator
// =============================================================
function valTable() {
  const rows = D.runs.map((r) => {
    const lcl = ladsonAt(r.alpha, 1), lcd = ladsonAt(r.alpha, 2);
    const good = (v, ref, tol) => (ref == null ? "" : Math.abs((v - ref) / ref) < tol ? "good" : "warn");
    return `<tr><td>${r.alpha}°</td><td>${fmt(r.cl, 3)}</td><td class="${Math.abs(lcl || 0) < 0.05 ? "" : good(r.cl, lcl, 0.03)}">${lcl == null ? (r.alpha === 18 ? "stalled" : "–") : Math.abs(lcl) < 0.05 ? "≈ 0 both" : pct(r.cl, lcl)}</td>
      <td>${fmt(r.cd, 5)}</td><td class="${good(r.cd, lcd, 0.05)}">${lcd == null ? "–" : pct(r.cd, lcd)}</td></tr>`;
  }).join("");
  $("valTable").innerHTML = `<tr><th>Angle</th><th>C<sub>l</sub></th><th>vs Ladson</th><th>C<sub>d</sub></th><th>vs Ladson</th></tr>${rows}`;
}

function calc() {
  const g = (id) => parseFloat($(id).value);
  const run = () => {
    const V = g("cSpeed"), a = g("cAlpha"), c = g("cChord"), b = g("cSpan"), [rho, mu] = $("cAlt").value.split(",").map(Number);
    const R = D.runs, k = Math.max(1, R.findIndex((r) => r.alpha >= a)), r0 = R[k - 1], r1 = R[k];
    const t = r1.alpha === r0.alpha ? 0 : (a - r0.alpha) / (r1.alpha - r0.alpha);
    const cl = r0.cl + t * (r1.cl - r0.cl), cd = r0.cd + t * (r1.cd - r0.cd);
    const q = 0.5 * rho * V * V, S = c * b, L = q * S * cl, Dg = q * S * cd, Re = (rho * V * c) / mu;
    $("cSpeedOut").textContent = `${V} m/s (${Math.round(V * 2.23694)} mph)`;
    $("cAlphaOut").textContent = `${a}°`;
    const cell = (l, v, n) => `<div class="stat"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`;
    $("calcOut").innerHTML = cell("Lift", `${Math.round(L).toLocaleString()}<span class="unit">N</span>`, `${Math.round(L * 0.224809).toLocaleString()} lbf · C<sub>l</sub> ${cl.toFixed(3)}`)
      + cell("Drag", `${Math.round(Dg).toLocaleString()}<span class="unit">N</span>`, `${Math.round(Dg * 0.224809).toLocaleString()} lbf · C<sub>d</sub> ${cd.toFixed(5)}`)
      + cell("Lift / drag", (cl / cd).toFixed(1), "2D section")
      + cell("Reynolds number", `${(Re / 1e6).toFixed(1)}<span class="unit">M</span>`, "ρVc/μ");
    const notes = [];
    if (Math.abs(Re - 6e6) / 6e6 > 0.5) notes.push(`<span class="warn">Your Reynolds number (${(Re / 1e6).toFixed(1)} M) is far from the simulated 6 M</span>: real drag would differ, more so at low Re.`);
    if (a > 17) notes.push(`<span class="warn">Past 17° a real NACA 0012 at this Reynolds number stalls</span>; the CFD values here are optimistic.`);
    $("calcNote").innerHTML = notes.join(" ") || "Coefficients interpolated linearly between the simulated angles.";
  };
  ["cSpeed", "cAlpha", "cChord", "cSpan", "cAlt"].forEach((id) => $(id).addEventListener("input", run));
  onAngle(() => { $("cAlpha").value = D.runs[state.i].alpha; run(); });
  run();
}

// =============================================================
async function main() {
  [D, FI] = await Promise.all([fetch("data/airfoil-data.json").then((r) => r.json()), fetch("data/fields/index.json").then((r) => r.json())]);
  const nT = D.runs.length - 1;            // stop k sits at thumb/2 + k/n of the remaining track width
  $("aTicks").innerHTML = D.runs.map((r, k) => `<span style="left:calc(var(--th)/2 + (100% - var(--th))*${k / nT})">${r.alpha}°</span>`).join("");
  $("aSlider").addEventListener("input", (e) => setAngle(+e.target.value));
  tabs("polarTabs", "polarTab", polar);
  tabs("surfTabs", "surfTab", surface);
  tabs("convTabs", "convTab", convergence);
  tabs("gridTabs", "gridTab", grid);
  onAngle(strip); onAngle(polar); onAngle(surface); onAngle(convergence);
  explorer(); calc(); grid(); valTable();
  let rz = 0, lastW = window.innerWidth;
  window.addEventListener("resize", () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth;
    clearTimeout(rz); rz = setTimeout(() => { polar(); surface(); convergence(); grid(); }, 150); });
  setAngle(state.i);
}
main().catch((e) => { console.error(e); $("flowLoading").textContent = "Could not load the data (open this page through a web server, not as a file)."; });
