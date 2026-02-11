import * as THREE from "./vendor/three.module.min.js";

// ---- renderer ----
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(renderer.domElement);

// ---- scene ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// ---- camera ----
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.2, 3.2);
camera.lookAt(0, 0.8, 0);

// ---- lights ----
const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(3, 4, 2);
scene.add(dir);

// ---- demo objects ----
const floorGeo = new THREE.PlaneGeometry(12, 12);
const floorMat = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 1, metalness: 0 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

function createFighter() {
  const fighter = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x8f98a3, roughness: 0.55, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x3f4650, roughness: 0.65, metalness: 0.25 });
  const engineMat = new THREE.MeshStandardMaterial({ color: 0x5f6a78, roughness: 0.45, metalness: 0.45 });

  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 2.4), hullMat);
  fuselage.position.set(0, 0.74, 0);
  fighter.add(fuselage);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.58), accentMat);
  cockpit.position.set(0, 0.88, 0.45);
  fighter.add(cockpit);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.52, 4), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0.73, 1.46);
  fighter.add(nose);

  const mainWingGeo = new THREE.BoxGeometry(2.7, 0.08, 1.05);
  const mainWing = new THREE.Mesh(mainWingGeo, hullMat);
  mainWing.position.set(0, 0.66, 0.05);
  fighter.add(mainWing);

  const wingSweepLeft = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.42), accentMat);
  wingSweepLeft.position.set(-1.13, 0.67, -0.52);
  wingSweepLeft.rotation.y = 0.55;
  fighter.add(wingSweepLeft);

  const wingSweepRight = wingSweepLeft.clone();
  wingSweepRight.position.x = 1.13;
  wingSweepRight.rotation.y = -0.55;
  fighter.add(wingSweepRight);

  const tailWingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.34), hullMat);
  tailWingLeft.position.set(-0.72, 0.7, -1.05);
  tailWingLeft.rotation.y = 0.25;
  fighter.add(tailWingLeft);

  const tailWingRight = tailWingLeft.clone();
  tailWingRight.position.x = 0.72;
  tailWingRight.rotation.y = -0.25;
  fighter.add(tailWingRight);

  const finLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.38), accentMat);
  finLeft.position.set(-0.28, 0.98, -1.05);
  finLeft.rotation.z = -0.17;
  fighter.add(finLeft);

  const finRight = finLeft.clone();
  finRight.position.x = 0.28;
  finRight.rotation.z = 0.17;
  fighter.add(finRight);

  const engineLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.46, 16), engineMat);
  engineLeft.rotation.x = Math.PI / 2;
  engineLeft.position.set(-0.25, 0.71, -1.34);
  fighter.add(engineLeft);

  const engineRight = engineLeft.clone();
  engineRight.position.x = 0.25;
  fighter.add(engineRight);

  const engineGlowLeft = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: 0x66ccff }));
  engineGlowLeft.position.set(-0.25, 0.71, -1.57);
  fighter.add(engineGlowLeft);

  const engineGlowRight = engineGlowLeft.clone();
  engineGlowRight.position.x = 0.25;
  fighter.add(engineGlowRight);

  return fighter;
}

const fighter = createFighter();
scene.add(fighter);

// ---- resize ----
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", onResize);

// ---- animation ----
let t0 = performance.now();
function tick(t) {
  const dt = Math.min((t - t0) / 1000, 0.05);
  t0 = t;

  fighter.rotation.y += dt * 0.45;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
