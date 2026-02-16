import * as THREE from "../../vendor/three.module.min.js";

const yawEl = document.getElementById("yaw");
const pitchEl = document.getElementById("pitch");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050711);
scene.fog = new THREE.Fog(0x050711, 7, 38);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 90);
const target = new THREE.Vector3(0, 0.1, 0);
const radius = 7.2;

scene.add(new THREE.HemisphereLight(0x93b9ff, 0x111727, 1.08));
const key = new THREE.DirectionalLight(0xffffff, 0.92);
key.position.set(2.6, 3.8, 2.1);
scene.add(key);

const room = new THREE.Group();
scene.add(room);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 22),
  new THREE.MeshStandardMaterial({ color: 0x0d1223, roughness: 0.92, metalness: 0.08 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.05;
room.add(floor);

const grid = new THREE.GridHelper(22, 24, 0x2f4f86, 0x1b2b4d);
grid.position.y = -2.04;
grid.material.opacity = 0.22;
grid.material.transparent = true;
room.add(grid);

function makeLayerTexture(colorA, colorB, shapeCount, glowCount) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 640;
  const g = c.getContext("2d");

  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < shapeCount; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const w = 90 + Math.random() * 230;
    const h = 32 + Math.random() * 80;
    g.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.12})`;
    g.fillRect(x, y, w, h);
  }

  for (let i = 0; i < glowCount; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = 18 + Math.random() * 58;
    const radial = g.createRadialGradient(x, y, 0, x, y, r);
    radial.addColorStop(0, "rgba(255,255,255,0.32)");
    radial.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = radial;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 8;
  g.strokeRect(24, 24, c.width - 48, c.height - 48);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const depthPlanes = [];
const layerDefs = [
  { z: -1.3, scale: 1.44, colors: ["#0d1b3f", "#102b63"], opacity: 0.88, jitter: 0.28 },
  { z: -0.56, scale: 1.22, colors: ["#15326d", "#1e4b9e"], opacity: 0.82, jitter: 0.36 },
  { z: 0.08, scale: 1.02, colors: ["#1d4b98", "#2f72d8"], opacity: 0.78, jitter: 0.48 },
  { z: 0.72, scale: 0.84, colors: ["#2f83e4", "#57beff"], opacity: 0.72, jitter: 0.58 },
  { z: 1.28, scale: 0.68, colors: ["#63d5ff", "#9af2ff"], opacity: 0.62, jitter: 0.66 },
];

for (const def of layerDefs) {
  const tex = makeLayerTexture(def.colors[0], def.colors[1], 16, 18);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4 * def.scale, 3.3 * def.scale),
    new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      opacity: def.opacity,
      emissive: new THREE.Color(def.colors[1]),
      emissiveIntensity: 0.22,
      roughness: 0.28,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })
  );
  mesh.position.set(0, 0.28, def.z);
  room.add(mesh);
  depthPlanes.push({ mesh, zBase: def.z, jitter: def.jitter });
}

const crystalGroup = new THREE.Group();
room.add(crystalGroup);
for (let i = 0; i < 26; i++) {
  const geo = new THREE.OctahedronGeometry(0.09 + Math.random() * 0.18, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.54 + Math.random() * 0.1, 0.9, 0.68),
    emissive: 0x2da8d8,
    emissiveIntensity: 0.22,
    roughness: 0.34,
    metalness: 0.2,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((Math.random() - 0.5) * 4.8, (Math.random() - 0.5) * 2.8, (Math.random() - 0.5) * 2.6);
  m.userData.rot = new THREE.Vector3((Math.random() - 0.5) * 1.7, (Math.random() - 0.5) * 1.7, (Math.random() - 0.5) * 1.7);
  crystalGroup.add(m);
}

const pointer = {
  active: false,
  x: 0,
  y: 0,
  yaw: 0,
  pitch: 0,
  targetYaw: 0,
  targetPitch: 0,
};

function onPointerDown(e) {
  pointer.active = true;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
}

function onPointerMove(e) {
  if (!pointer.active) return;
  const dx = e.clientX - pointer.x;
  const dy = e.clientY - pointer.y;
  pointer.x = e.clientX;
  pointer.y = e.clientY;

  pointer.targetYaw += dx * 0.005;
  pointer.targetPitch += dy * 0.004;
  pointer.targetYaw = THREE.MathUtils.clamp(pointer.targetYaw, -0.9, 0.9);
  pointer.targetPitch = THREE.MathUtils.clamp(pointer.targetPitch, -0.55, 0.55);
}

function onPointerUp() {
  pointer.active = false;
}

window.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
window.addEventListener("mouseleave", onPointerUp);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();

  if (!pointer.active) {
    pointer.targetYaw *= 0.992;
    pointer.targetPitch *= 0.992;
    pointer.targetYaw += Math.sin(t * 0.35) * 0.0005;
  }

  pointer.yaw += (pointer.targetYaw - pointer.yaw) * 0.08;
  pointer.pitch += (pointer.targetPitch - pointer.pitch) * 0.08;

  yawEl.textContent = Math.round(THREE.MathUtils.radToDeg(pointer.yaw));
  pitchEl.textContent = Math.round(-THREE.MathUtils.radToDeg(pointer.pitch));

  const cx = Math.sin(pointer.yaw) * radius;
  const cy = 0.5 + Math.sin(pointer.pitch) * 2.2;
  const cz = Math.cos(pointer.yaw) * radius;
  camera.position.set(cx, cy, cz);
  camera.lookAt(target);

  for (let i = 0; i < depthPlanes.length; i++) {
    const p = depthPlanes[i];
    const sway = Math.sin(t * (0.6 + i * 0.15)) * 0.04;
    p.mesh.position.x = pointer.yaw * p.jitter + sway;
    p.mesh.position.y = 0.28 + pointer.pitch * p.jitter * -0.9;
    p.mesh.position.z = p.zBase + Math.cos(t * 0.8 + i) * 0.025;
    p.mesh.rotation.y = -pointer.yaw * 0.45;
    p.mesh.rotation.x = pointer.pitch * 0.25;
  }

  for (const c of crystalGroup.children) {
    c.rotation.x += c.userData.rot.x * 0.01;
    c.rotation.y += c.userData.rot.y * 0.01;
    c.rotation.z += c.userData.rot.z * 0.01;
  }
  crystalGroup.rotation.y = t * 0.12 + pointer.yaw * 0.35;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
