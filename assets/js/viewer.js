// =============================================================
//  Interactive 3D viewer for CFD results (three.js)
//
//  Put this in any page:
//    <div class="viewer" data-model="models/my-model.glb" data-up="z"></div>
//
//  Options (HTML attributes on the div):
//    data-model    path to a .glb / .gltf file (export from ParaView)
//    data-up       "z" (OpenFOAM / ParaView default) or "y"
//    data-flow     "+x" draws a flow-direction arrow along +x  (or "none")
//    data-mini     "true" = small auto-spinning preview with no buttons
//    data-missing  message shown if the model file isn't there yet
//
//  Visitors can also drag a .glb file onto the viewer to look at it —
//  handy for checking your ParaView export before you upload it.
// =============================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function initViewer(el) {
  const mini = el.dataset.mini === "true";
  const up = (el.dataset.up || "z").toLowerCase();
  const flow = el.dataset.flow || "+x";

  // ---- renderer, scene, camera ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 1000);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2133, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb8ff, 1.0);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = mini;
  controls.autoRotateSpeed = mini ? 1.2 : 0.8;
  if (mini) { controls.enableZoom = false; controls.enablePan = false; }

  const helpers = new THREE.Group();   // ground grid + flow arrow
  scene.add(helpers);
  let model = null;
  let home = null;                      // saved camera view for "Reset"

  // ---- toolbar ----
  const state = { wire: false, spin: mini, helpers: true };
  if (!mini) {
    const bar = document.createElement("div");
    bar.className = "toolbar";
    bar.innerHTML = `
      <button data-act="reset">Reset view</button>
      <button data-act="spin" aria-pressed="false">Spin</button>
      <button data-act="wire" aria-pressed="false">Wireframe</button>
      <button data-act="helpers" aria-pressed="true">Ground + flow</button>
      <button data-act="shot">Screenshot</button>`;
    el.appendChild(bar);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const act = b.dataset.act;
      if (act === "reset" && home) { camera.position.copy(home.pos); controls.target.copy(home.target); }
      if (act === "spin") { state.spin = !state.spin; controls.autoRotate = state.spin; b.setAttribute("aria-pressed", state.spin); }
      if (act === "wire") { state.wire = !state.wire; setWire(state.wire); b.setAttribute("aria-pressed", state.wire); }
      if (act === "helpers") { state.helpers = !state.helpers; helpers.visible = state.helpers; b.setAttribute("aria-pressed", state.helpers); }
      if (act === "shot") screenshot();
    });
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Drag to rotate · scroll to zoom · right-drag to pan · drop a .glb to preview";
    el.appendChild(hint);
  }

  const msg = document.createElement("div");
  msg.className = "msg";
  el.appendChild(msg);
  const showMsg = (html) => { msg.innerHTML = html ? `<div>${html}</div>` : ""; msg.style.display = html ? "grid" : "none"; };

  function setWire(on) {
    model?.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => (m.wireframe = on)); });
  }

  function screenshot() {
    renderer.render(scene, camera);
    const a = document.createElement("a");
    a.href = renderer.domElement.toDataURL("image/png");
    a.download = "cfd-view.png";
    a.click();
  }

  // ---- put a loaded model in the scene and frame the camera on it ----
  function addModel(gltfScene) {
    if (model) scene.remove(model);
    helpers.clear();
    model = new THREE.Group();
    if (up === "z") gltfScene.rotation.x = -Math.PI / 2;   // CFD Z-up  ->  three.js Y-up
    model.add(gltfScene);

    // Make CFD surfaces look good: show both sides, keep ParaView's colours if present
    gltfScene.traverse((o) => {
      if (!o.isMesh) return;
      [].concat(o.material).forEach((m) => {
        m.side = THREE.DoubleSide;
        if (!o.geometry.attributes.color && m.color && m.color.getHex() === 0xffffff) m.color.set(0xb4bccb);
        if ("metalness" in m) { m.metalness = Math.min(m.metalness ?? 0, 0.3); m.roughness = 0.55; }
      });
    });
    scene.add(model);

    // centre it on the origin, sitting on the ground
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    const L = Math.max(size.x, size.y, size.z);

    // ground grid + flow arrow
    const grid = new THREE.GridHelper(L * 4, 40, 0x3d8ef0, 0x24304a);
    grid.material.transparent = true; grid.material.opacity = 0.35;
    helpers.add(grid);
    if (flow !== "none") {
      const dir = new THREE.Vector3(flow.startsWith("-") ? -1 : 1, 0, 0);
      const start = new THREE.Vector3(-dir.x * L * 1.1, size.y * 0.5, 0);
      helpers.add(new THREE.ArrowHelper(dir, start, L * 0.45, 0xf2a03d, L * 0.08, L * 0.04));
    }

    // camera: 3/4 front view
    controls.target.set(0, size.y * 0.4, 0);
    camera.position.set(-L * 1.25, L * 0.65, L * 1.35);
    camera.near = L / 200; camera.far = L * 100; camera.updateProjectionMatrix();
    home = { pos: camera.position.clone(), target: controls.target.clone() };
    showMsg("");
  }

  const loader = new GLTFLoader();
  function loadUrl(url, onFail) {
    showMsg("Loading 3D model…");
    loader.load(url, (g) => addModel(g.scene), undefined, onFail);
  }

  if (el.dataset.model) {
    const url = el.dataset.model;
    const fail = () => showMsg(el.dataset.missing || `Couldn't load <code>${url}</code>.`);
    // If "truck.glb" isn't there, also try "truck.gltf" (ParaView saves .gltf)
    const alt = /\.glb$/i.test(url) ? url.replace(/\.glb$/i, ".gltf") : null;
    loadUrl(url, alt ? () => loadUrl(alt, fail) : fail);
  } else {
    showMsg(el.dataset.missing || "No model set.");
  }

  // ---- drag & drop a local .glb to preview it ----
  if (!mini) {
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("dragover"); });
    el.addEventListener("dragleave", () => el.classList.remove("dragover"));
    el.addEventListener("drop", (e) => {
      e.preventDefault(); el.classList.remove("dragover");
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (!/\.(glb|gltf)$/i.test(f.name)) { showMsg("Drop a <code>.glb</code> file (ParaView → File → Export Scene → glTF)."); return; }
      const url = URL.createObjectURL(f);
      loadUrl(url, () => showMsg("That file couldn't be read. Try exporting as .glb from ParaView."));
    });
  }

  // ---- resize + render loop (pauses when off-screen) ----
  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(el);
  resize();

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(el);
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
  });
}

// Start every viewer on the page automatically
document.querySelectorAll(".viewer").forEach(initViewer);
