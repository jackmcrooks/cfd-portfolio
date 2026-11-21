// Animated background for the home page: particles following the
// potential-flow solution around a cylinder (uniform flow + doublet).
//   u = U [1 - R²(x² - y²)/r⁴]      v = -U · 2R²xy / r⁴
const canvas = document.querySelector("canvas.streaks");
if (canvas) {
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, R, cx, cy, parts = [];
  const U = 1.4;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.16; cx = W * 0.72; cy = H * 0.5;
    parts = Array.from({ length: 420 }, () => spawn(true));
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  }
  function spawn(anywhere) {
    return { x: anywhere ? Math.random() * W : -5, y: Math.random() * H, age: 0 };
  }
  function vel(x, y) {
    const dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy, r4 = r2 * r2;
    return [U * (1 - (R * R * (dx * dx - dy * dy)) / r4), (-U * 2 * R * R * dx * dy) / r4];
  }
  function frame() {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0, 0, W, H);
    for (const p of parts) {
      const [u, v] = vel(p.x, p.y);
      const nx = p.x + u, ny = p.y + v;
      const speed = Math.hypot(u, v) / U;            // 0 … 2 on the cylinder shoulders
      const t = Math.min(speed / 2, 1);
      ctx.strokeStyle = `rgba(${Math.round(61 + 181 * t)},${Math.round(142 + 18 * t)},${Math.round(240 - 179 * t)},0.8)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny; p.age++;
      const inside = (p.x - cx) ** 2 + (p.y - cy) ** 2 < R * R * 1.02;
      if (p.x > W + 5 || inside || p.age > 900) Object.assign(p, spawn(false));
    }
    ctx.fillStyle = "#161619";
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    if (!reduce) requestAnimationFrame(frame);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  if (reduce) for (let i = 0; i < 300; i++) frame(); else frame();
}
