import * as THREE from "../../vendor/three.module.min.js";

const distEl = document.getElementById("dist");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a12);
scene.fog = new THREE.Fog(0x060a12, 8, 58);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0.5, 6);

scene.add(new THREE.HemisphereLight(0x9dd8ff, 0x112235, 1.1));
const dir = new THREE.DirectionalLight(0xffffff, 0.95);
dir.position.set(2, 4, 2);
scene.add(dir);

const tunnel = new THREE.Group();
scene.add(tunnel);

const laneCount = 3;
const lanes = [-1.9, 0, 1.9];
let laneIndex = 1;
let targetX = lanes[laneIndex];

const rings = [];
const ringGeo = new THREE.TorusGeometry(4.1, 0.08, 12, 56);
for (let i = 0; i < 32; i++) {
  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.58 + (i % 8) * 0.03, 0.95, 0.6),
      transparent: true,
      opacity: 0.74,
    })
  );
  ring.position.z = -i * 2.2;
  tunnel.add(ring);
  rings.push(ring);
}

const stars = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.04, transparent: true, opacity: 0.75 })
);
const starArray = [];
for (let i = 0; i < 800; i++) {
  starArray.push((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 50, -Math.random() * 100);
}
const starPositions = new THREE.Float32BufferAttribute(starArray, 3);
stars.geometry.setAttribute("position", starPositions);
scene.add(stars);

const ship = new THREE.Group();
const shipBody = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.34, 1),
  new THREE.MeshStandardMaterial({ color: 0x7cf4ff, emissive: 0x2c9fb2, emissiveIntensity: 0.6, roughness: 0.35 })
);
shipBody.rotation.x = Math.PI / 2;
ship.add(shipBody);
const shipGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.52, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x66f2ff, transparent: true, opacity: 0.15 })
);
ship.add(shipGlow);
ship.position.set(0, 0, 4.3);
scene.add(ship);

const obstacles = [];
const obsGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
for (let i = 0; i < 24; i++) {
  const obs = new THREE.Mesh(
    obsGeo,
    new THREE.MeshStandardMaterial({ color: 0xff5f8f, emissive: 0x5f1529, roughness: 0.36, metalness: 0.12 })
  );
  resetObstacle(obs, true);
  tunnel.add(obs);
  obstacles.push(obs);
}

function resetObstacle(obs, spread = false) {
  const lane = Math.floor(Math.random() * laneCount);
  obs.position.x = lanes[lane];
  obs.position.y = (Math.random() - 0.5) * 1.4;
  obs.position.z = spread ? -10 - Math.random() * 85 : -60 - Math.random() * 20;
  obs.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  obs.userData.spin = (Math.random() - 0.5) * 1.9;
}

function inputLane(dirValue) {
  laneIndex = THREE.MathUtils.clamp(laneIndex + dirValue, 0, laneCount - 1);
  targetX = lanes[laneIndex];
}

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") inputLane(-1);
  if (e.code === "ArrowRight" || e.code === "KeyD") inputLane(1);
});

let touchStartX = null;
window.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0]?.clientX ?? null;
}, { passive: true });
window.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;
  const endX = e.changedTouches[0]?.clientX ?? touchStartX;
  const dx = endX - touchStartX;
  if (dx > 28) inputLane(1);
  if (dx < -28) inputLane(-1);
  touchStartX = null;
}, { passive: true });

let speed = 18;
let distance = 0;
let hitFlash = 0;

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  speed = Math.min(speed + dt * 0.35, 28);
  distance += speed * dt;
  distEl.textContent = Math.floor(distance);

  ship.position.x += (targetX - ship.position.x) * 0.14;
  ship.position.y = Math.sin(time * 4) * 0.06;
  ship.rotation.z = (targetX - ship.position.x) * 0.12;

  camera.position.x += ((ship.position.x * 0.32) - camera.position.x) * 0.05;
  camera.position.y += ((0.46 + Math.sin(time * 2.3) * 0.03) - camera.position.y) * 0.05;
  camera.lookAt(ship.position.x * 0.2, 0, -5);

  for (const ring of rings) {
    ring.position.z += speed * dt;
    ring.rotation.z += dt * 0.25;
    if (ring.position.z > 7) ring.position.z -= rings.length * 2.2;
    const depthGlow = THREE.MathUtils.clamp((7 - ring.position.z) / 14, 0.12, 0.84);
    ring.material.opacity = depthGlow;
  }

  for (let i = 0; i < starPositions.count; i++) {
    let z = starPositions.getZ(i) + speed * dt * 0.9;
    if (z > 6) z = -100;
    starPositions.setZ(i, z);
  }
  starPositions.needsUpdate = true;

  for (const obs of obstacles) {
    obs.position.z += speed * dt;
    obs.rotation.x += dt * obs.userData.spin;
    obs.rotation.y += dt * (obs.userData.spin * 0.8);

    if (obs.position.z > 8) resetObstacle(obs);

    const dx = Math.abs(obs.position.x - ship.position.x);
    const dz = Math.abs(obs.position.z - ship.position.z);
    const dy = Math.abs(obs.position.y - ship.position.y);
    if (dx < 0.72 && dy < 0.72 && dz < 0.85) {
      hitFlash = 1;
      distance = Math.max(0, distance - 14);
      resetObstacle(obs);
    }
  }

  hitFlash = Math.max(0, hitFlash - dt * 2.2);
  scene.background.setRGB(0.024 + hitFlash * 0.32, 0.04, 0.07 + hitFlash * 0.12);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

requestAnimationFrame(animate);
