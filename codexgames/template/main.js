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

const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0x00aa88, roughness: 0.7, metalness: 0.05 });
const cube = new THREE.Mesh(cubeGeo, cubeMat);
cube.position.set(0, 0.5, 0);
scene.add(cube);

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

  cube.rotation.y += dt * 1.1;
  cube.rotation.x += dt * 0.6;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);