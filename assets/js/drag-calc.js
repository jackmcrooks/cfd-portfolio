// =============================================================
//  Interactive drag & power calculator
//    F = ½ ρ V² Cd A        P = F · V
//
//  Put this in a page:
//    <div class="drag-calc" data-cd="0.50" data-area="2.667" data-speed="60" data-max="200"></div>
// =============================================================
const RHO = 1.205;          // kg/m³ (matches the OpenFOAM rhoInf)
const MPH = 0.44704;        // m/s per mph
const N_TO_LBF = 0.224809;
const KW_TO_HP = 1.34102;

function el(tag, attrs = {}, html = "") {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (html) e.innerHTML = html;
  return e;
}
const fmt = (x, d = 0) => x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

function initCalc(root) {
  const maxMph = +root.dataset.max || 200;
  root.innerHTML = `
    <div class="controls">
      <div><label for="cd">Drag coefficient C<sub>d</sub></label><input id="cd" type="number" step="0.01" min="0.05" max="2" value="${root.dataset.cd || 0.5}"></div>
      <div><label for="area">Frontal area A (m²)</label><input id="area" type="number" step="0.01" min="0.1" max="20" value="${root.dataset.area || 2.0}"></div>
      <div><label for="spd">Speed: <output id="spdOut"></output></label><input id="spd" type="range" min="10" max="${maxMph}" step="1" value="${root.dataset.speed || 60}"></div>
    </div>
    <div class="stats" style="margin-bottom:18px">
      <div class="stat"><div class="label">Drag force</div><div class="value" id="oF"></div><div class="note" id="oF2"></div></div>
      <div class="stat"><div class="label">Power to beat drag</div><div class="value" id="oP"></div><div class="note" id="oP2"></div></div>
      <div class="stat"><div class="label">Dynamic pressure</div><div class="value" id="oQ"></div><div class="note">½ρV²</div></div>
    </div>
    <div class="two-col">
      <div><p class="chart-title">Drag force vs speed</p><p class="chart-sub">N · F = ½ρV²C<sub>d</sub>A</p><div class="chart" id="cF"></div></div>
      <div><p class="chart-title">Power to overcome drag vs speed</p><p class="chart-sub">kW · P = F·V</p><div class="chart" id="cP"></div></div>
    </div>`;

  const $ = (id) => root.querySelector("#" + id);
  const charts = [
    makeChart($("cF"), (v) => dragN(v), (v, y) => `${v} mph · <b>${fmt(y)} N</b> (${fmt(y * N_TO_LBF)} lbf)`),
    makeChart($("cP"), (v) => dragN(v) * v * MPH / 1000, (v, y) => `${v} mph · <b>${fmt(y, 1)} kW</b> (${fmt(y * KW_TO_HP)} hp)`),
  ];

  function dragN(mph) {
    const V = mph * MPH;
    return 0.5 * RHO * V * V * (+$("cd").value || 0) * (+$("area").value || 0);
  }

  function update() {
    const mph = +$("spd").value;
    const F = dragN(mph), P = F * mph * MPH / 1000, V = mph * MPH;
    $("spdOut").textContent = `${mph} mph (${fmt(V, 1)} m/s)`;
    $("oF").innerHTML = `${fmt(F)}<span class="unit">N</span>`;
    $("oF2").textContent = `${fmt(F * N_TO_LBF)} lbf`;
    $("oP").innerHTML = `${fmt(P, 1)}<span class="unit">kW</span>`;
    $("oP2").textContent = `${fmt(P * KW_TO_HP)} hp`;
    $("oQ").innerHTML = `${fmt(0.5 * RHO * V * V)}<span class="unit">Pa</span>`;
    charts.forEach((c) => c.draw(maxMph, mph));
  }
  root.querySelectorAll("input").forEach((i) => i.addEventListener("input", update));
  update();
}

// ---- small dependency-free SVG line chart with a hover crosshair ----
function makeChart(host, f, tipText) {
  const W = 520, H = 280, m = { l: 56, r: 16, t: 12, b: 36 };
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  host.appendChild(svg);
  const tip = el("div", { class: "tip" });
  host.appendChild(tip);
  let state = null;

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  function draw(maxX, cur) {
    const xs = Array.from({ length: maxX + 1 }, (_, i) => i);
    const ys = xs.map(f);
    const yStep = niceStep(Math.max(...ys) / 4);
    const yMax = Math.ceil(Math.max(...ys) / yStep) * yStep;
    const nTicks = Math.round(yMax / yStep);
    const X = (v) => m.l + (v / maxX) * (W - m.l - m.r);
    const Y = (v) => H - m.b - (v / yMax) * (H - m.t - m.b);
    state = { X, Y, maxX, ys };

    let g = "";
    for (let i = 0; i <= nTicks; i++) {      // recessive gridlines + y labels
      const v = yStep * i;
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#24304a" stroke-width="1"/>`;
      g += `<text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#74819a" font-size="11">${fmt(v)}</text>`;
    }
    const step = maxX > 120 ? 50 : 20;
    for (let v = 0; v <= maxX; v += step)
      g += `<text x="${X(v)}" y="${H - m.b + 18}" text-anchor="middle" fill="#74819a" font-size="11">${v}</text>`;
    g += `<text x="${(W + m.l) / 2}" y="${H - 4}" text-anchor="middle" fill="#a9b4c8" font-size="11">Speed (mph)</text>`;

    const path = xs.map((v, i) => `${i ? "L" : "M"}${X(v).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join("");
    g += `<path d="${path}" fill="none" stroke="#3d8ef0" stroke-width="2" stroke-linejoin="round"/>`;
    // current speed marker
    const cy = f(cur);
    g += `<line x1="${X(cur)}" x2="${X(cur)}" y1="${m.t}" y2="${H - m.b}" stroke="#f2a03d" stroke-width="1" stroke-dasharray="3 3"/>`;
    g += `<circle cx="${X(cur)}" cy="${Y(cy)}" r="5" fill="#f2a03d" stroke="#0c0c0e" stroke-width="2"/>`;
    // hover layer
    g += `<g class="hover" style="display:none"><line class="hx" y1="${m.t}" y2="${H - m.b}" stroke="#a9b4c8" stroke-width="1"/><circle class="hc" r="4" fill="#3d8ef0" stroke="#0c0c0e" stroke-width="2"/></g>`;
    g += `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" class="hit"/>`;
    svg.innerHTML = g;
  }

  svg.addEventListener("pointermove", (e) => {
    if (!state) return;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const v = Math.round(((sx - m.l) / (W - m.l - m.r)) * state.maxX);
    if (v < 0 || v > state.maxX) return hide();
    const y = state.ys[v];
    const hov = svg.querySelector(".hover");
    hov.style.display = "";
    hov.querySelector(".hx").setAttribute("x1", state.X(v));
    hov.querySelector(".hx").setAttribute("x2", state.X(v));
    hov.querySelector(".hc").setAttribute("cx", state.X(v));
    hov.querySelector(".hc").setAttribute("cy", state.Y(y));
    tip.innerHTML = tipText(v, y);
    tip.style.display = "block";
    const px = (state.X(v) / W) * r.width, py = (state.Y(y) / H) * r.height;
    tip.style.left = Math.min(px + 12, r.width - tip.offsetWidth) + "px";
    tip.style.top = Math.max(py - 36, 0) + "px";
  });
  const hide = () => { tip.style.display = "none"; const h = svg.querySelector(".hover"); if (h) h.style.display = "none"; };
  svg.addEventListener("pointerleave", hide);
  return { draw };
}

document.querySelectorAll(".drag-calc").forEach(initCalc);
