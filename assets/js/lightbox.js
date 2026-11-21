// =============================================================
//  Click an image to see it full screen.
//
//  Add to a page:   <script src="../../assets/js/lightbox.js" defer></script>
//  Every <img> inside a <figure> or .panel gets it automatically.
//  Add class="no-zoom" to an image to leave it out.
//  Close: click anywhere, ×, or Esc.  Arrow keys / buttons: previous / next image.
// =============================================================
(function () {
  const imgs = [...document.querySelectorAll("figure img, .panel img")].filter((i) => !i.classList.contains("no-zoom"));
  if (!imgs.length) return;

  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML = `
    <button type="button" class="lb-close" aria-label="Close">×</button>
    <button type="button" class="lb-nav lb-prev" aria-label="Previous image">‹</button>
    <figure class="lb-fig"><img alt=""><figcaption></figcaption></figure>
    <button type="button" class="lb-nav lb-next" aria-label="Next image">›</button>`;
  document.body.appendChild(box);
  const big = box.querySelector("img"), cap = box.querySelector("figcaption");
  let cur = -1, lastFocus = null;

  function captionFor(img) {
    const fc = img.closest("figure")?.querySelector("figcaption");
    if (fc) return fc.innerHTML;
    const panel = img.closest(".panel");
    const t = panel?.querySelector(".chart-title");
    const sub = panel?.querySelector(".chart-sub");
    if (t) return `<strong>${t.innerHTML}</strong>${sub ? " · " + sub.innerHTML : ""}`;
    return img.alt || "";
  }

  // Size the picture ourselves (fit the window, keep its shape) so it centres the same in
  // every browser. Charts (SVG) are scaled up to fill; photos up to 1.25x their pixel size.
  function fit() {
    if (!box.classList.contains("open")) return;
    const nw = big.naturalWidth, nh = big.naturalHeight;
    if (!nw || !nh) return;
    const narrow = innerWidth < 760;
    const availW = innerWidth - (narrow ? 32 : 160);
    const availH = innerHeight - (narrow ? 150 : 110) - cap.offsetHeight;
    const maxUp = /\.svg(\?|#|$)/i.test(big.src) ? 4 : 1.25;
    const k = Math.min(availW / nw, Math.max(80, availH) / nh, maxUp);
    big.style.width = Math.round(nw * k) + "px";
    big.style.height = Math.round(nh * k) + "px";
    cap.style.maxWidth = Math.max(Math.round(nw * k), Math.min(availW, 640)) + "px";
  }
  big.addEventListener("load", fit);
  window.addEventListener("resize", fit);

  function show(i) {
    cur = (i + imgs.length) % imgs.length;
    const img = imgs[cur];
    cap.innerHTML = captionFor(img);
    big.alt = img.alt;
    big.style.width = big.style.height = "";
    const src = img.currentSrc || img.src;
    if (big.src === src && big.complete) fit(); else big.src = src;
    box.classList.toggle("single", imgs.length < 2);
  }
  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    box.classList.add("open");
    fit();
    document.documentElement.style.overflow = "hidden";
    box.querySelector(".lb-close").focus();
  }
  function close() {
    box.classList.remove("open");
    document.documentElement.style.overflow = "";
    lastFocus?.focus?.();
  }

  imgs.forEach((img, i) => {
    img.classList.add("zoomable");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", (img.alt ? img.alt + ". " : "") + "Click to enlarge");
    img.addEventListener("click", () => open(i));
    img.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } });
  });

  box.addEventListener("click", (e) => {
    if (e.target.closest(".lb-prev")) return show(cur - 1);
    if (e.target.closest(".lb-next")) return show(cur + 1);
    close();   // click on the image, background or × closes
  });
  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(cur - 1);
    else if (e.key === "ArrowRight") show(cur + 1);
  });
})();
