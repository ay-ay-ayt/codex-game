import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const timerEl = document.getElementById("timer");
const lapEl = document.getElementById("lap");
const soundBtn = document.getElementById("soundBtn");
const goalEl = document.getElementById("goal");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const driftBtn = document.getElementById("driftBtn");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x81cfff);
scene.fog = new THREE.Fog(0x90d3ff, 35, 260);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 700);

scene.add(new THREE.HemisphereLight(0xdff3ff, 0x2b5f30, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(40, 70, 20);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

// --- sky band / mountains ---
const skyBand = new THREE.Mesh(
  new THREE.CylinderGeometry(220, 220, 90, 42, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xb8e8ff, side: THREE.BackSide })
);
skyBand.position.y = 20;
scene.add(skyBand);

const hillMat = new THREE.MeshLambertMaterial({ color: 0x4d8e5b });
for (let i = 0; i < 70; i++) {
  const h = 10 + Math.random() * 18;
  const hill = new THREE.Mesh(new THREE.ConeGeometry(10 + Math.random() * 12, h, 8), hillMat);
  const a = (i / 70) * Math.PI * 2;
  const r = 130 + (i % 5) * 8;
  hill.position.set(Math.cos(a) * r, h * 0.5 - 2, Math.sin(a) * r);
  world.add(hill);
}

// --- track ---
const waypoints = [
  new THREE.Vector3(0, 0, -44),
  new THREE.Vector3(34, 0, -34),
  new THREE.Vector3(45, 0, 0),
  new THREE.Vector3(34, 0, 30),
  new THREE.Vector3(0, 0, 42),
  new THREE.Vector3(-35, 0, 32),
  new THREE.Vector3(-46, 0, 0),
  new THREE.Vector3(-34, 0, -33),
];

const centerCurve = new THREE.CatmullRomCurve3(waypoints, true, "catmullrom", 0.15);
const trackWidth = 9.2;

const asphalt = new THREE.MeshStandardMaterial({ color: 0x595d67, roughness: 0.96, metalness: 0.03 });
const lanePaint = new THREE.MeshBasicMaterial({ color: 0xf4cb61 });
const sidePaintA = new THREE.MeshBasicMaterial({ color: 0xffffff });
const sidePaintB = new THREE.MeshBasicMaterial({ color: 0xd53c3c });
const grassMat = new THREE.MeshLambertMaterial({ color: 0x397a38 });

const ground = new THREE.Mesh(new THREE.CircleGeometry(200, 60), grassMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.07;
world.add(ground);

const sampleCount = 420;
const centerPts = centerCurve.getSpacedPoints(sampleCount);

function tangentAt(t) {
  return centerCurve.getTangentAt((t % 1 + 1) % 1).normalize();
}
function normalFromTangent(tan) {
  return new THREE.Vector3(-tan.z, 0, tan.x).normalize();
}

const roadPositions = [];
const roadIndices = [];
const lanePositions = [];
const sideA = [];
const sideB = [];

for (let i = 0; i <= sampleCount; i++) {
  const p = centerPts[i % sampleCount];
  const t = i / sampleCount;
  const tan = tangentAt(t);
  const n = normalFromTangent(tan);

  const l = p.clone().addScaledVector(n, -trackWidth * 0.5);
  const r = p.clone().addScaledVector(n, trackWidth * 0.5);

  roadPositions.push(l.x, 0.02, l.z, r.x, 0.02, r.z);

  const laneL = p.clone().addScaledVector(n, -0.22);
  const laneR = p.clone().addScaledVector(n, 0.22);
  lanePositions.push(laneL.x, 0.04, laneL.z, laneR.x, 0.04, laneR.z);

  const edgeW = 1.05;
  const a0 = p.clone().addScaledVector(n, -trackWidth * 0.5 - edgeW);
  const a1 = p.clone().addScaledVector(n, -trackWidth * 0.5);
  const b0 = p.clone().addScaledVector(n, trackWidth * 0.5);
  const b1 = p.clone().addScaledVector(n, trackWidth * 0.5 + edgeW);

  sideA.push(a0.x, 0.03, a0.z, a1.x, 0.03, a1.z);
  sideB.push(b0.x, 0.03, b0.z, b1.x, 0.03, b1.z);

  if (i < sampleCount) {
    const i0 = i * 2;
    const i1 = i0 + 1;
    const i2 = i0 + 2;
    const i3 = i0 + 3;
    roadIndices.push(i0, i2, i1, i1, i2, i3);
  }
}

function meshFromStrip(positionArray, indexArray, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positionArray, 3));
  geo.setIndex(indexArray);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

world.add(meshFromStrip(roadPositions, roadIndices, asphalt));
world.add(meshFromStrip(lanePositions, roadIndices, lanePaint));

for (let i = 0; i < sampleCount; i++) {
  const matL = i % 2 ? sidePaintA : sidePaintB;
  const matR = i % 2 ? sidePaintB : sidePaintA;

  const idx = [i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3];
  const gL = new THREE.BufferGeometry();
  gL.setAttribute("position", new THREE.Float32BufferAttribute(sideA.slice(i * 6, i * 6 + 12), 3));
  gL.setIndex([0, 2, 1, 1, 2, 3]);
  world.add(new THREE.Mesh(gL, matL));

  const gR = new THREE.BufferGeometry();
  gR.setAttribute("position", new THREE.Float32BufferAttribute(sideB.slice(i * 6, i * 6 + 12), 3));
  gR.setIndex([0, 2, 1, 1, 2, 3]);
  world.add(new THREE.Mesh(gR, matR));
}

// --- roadside objects ---
const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4728 });
const treeLeafMat = new THREE.MeshLambertMaterial({ color: 0x2f7c36 });
const treeGeo = new THREE.ConeGeometry(1.7, 4.6, 8);
const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.5, 7);

for (let i = 0; i < sampleCount; i += 3) {
  const t = i / sampleCount;
  const p = centerCurve.getPointAt(t);
  const tan = tangentAt(t);
  const n = normalFromTangent(tan);
  const side = i % 2 ? 1 : -1;
  const offset = trackWidth * 0.7 + 5.5 + Math.random() * 5;
  const base = p.clone().addScaledVector(n, side * offset);

  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
  trunk.position.y = 0.75;
  const leaves = new THREE.Mesh(treeGeo, treeLeafMat);
  leaves.position.y = 3;
  tree.add(trunk, leaves);
  tree.position.copy(base);
  tree.scale.setScalar(0.85 + Math.random() * 0.6);
  world.add(tree);
}

// --- kart model ---
const kart = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: 0xf04545, roughness: 0.6 }));
body.position.y = 0.8;
kart.add(body);
const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xeef4ff }));
seat.position.set(0, 1.15, 0.35);
kart.add(seat);
const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 14);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
for (const [x, z] of [[-0.95, -0.85], [0.95, -0.85], [-0.95, 0.9], [0.95, 0.9]]) {
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  w.rotation.z = Math.PI * 0.5;
  w.position.set(x, 0.45, z);
  kart.add(w);
}
world.add(kart);

// --- state ---
const input = { left: false, right: false, drift: false };
const state = {
  t: 0,
  speed: 0,
  lateral: 0,
  steerVel: 0,
  boost: 0,
  lap: 0,
  raceDone: false,
  lapDone: false,
  driftOn: false,
  startedAt: performance.now(),
  finishedAt: 0,
  soundOn: false,
};

const aiDrivers = []; // extension point

class Sfx {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  tone(f = 600, d = 0.08, g = 0.05, type = "square") {
    if (!state.soundOn) return;
    this.ensure();
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const a = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    a.gain.setValueAtTime(0.0001, now);
    a.gain.exponentialRampToValueAtTime(g, now + 0.01);
    a.gain.exponentialRampToValueAtTime(0.0001, now + d);
    o.connect(a).connect(this.ctx.destination);
    o.start(now);
    o.stop(now + d + 0.02);
  }
}
const sfx = new Sfx();

function setBtnHold(btn, key) {
  const down = (e) => { e.preventDefault(); input[key] = true; btn.classList.add("active"); };
  const up = (e) => { e.preventDefault(); input[key] = false; btn.classList.remove("active"); };
  btn.addEventListener("pointerdown", down, { passive: false });
  btn.addEventListener("pointerup", up, { passive: false });
  btn.addEventListener("pointercancel", up, { passive: false });
  btn.addEventListener("pointerleave", up, { passive: false });
}
setBtnHold(leftBtn, "left");
setBtnHold(rightBtn, "right");
setBtnHold(driftBtn, "drift");

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") input.left = true;
  if (e.key === "ArrowRight") input.right = true;
  if (e.key.toLowerCase() === "z") input.drift = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") input.left = false;
  if (e.key === "ArrowRight") input.right = false;
  if (e.key.toLowerCase() === "z") input.drift = false;
});

soundBtn.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  soundBtn.textContent = state.soundOn ? "SOUND ON" : "SOUND OFF";
  soundBtn.setAttribute("aria-pressed", String(state.soundOn));
  if (state.soundOn) sfx.tone(760, 0.07, 0.05, "sine");
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function norm01(v) {
  let t = v % 1;
  if (t < 0) t += 1;
  return t;
}

let prev = performance.now();
let wasDrift = false;

function update(dt) {
  if (state.raceDone) return;

  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const drift = input.drift && steerInput !== 0;

  const targetBase = 34;
  const accel = 20;
  const driftPenalty = drift ? 4.5 : 0;
  state.speed += (targetBase - state.speed - driftPenalty) * dt * 1.8;
  state.speed += state.boost * dt;
  state.boost *= Math.exp(-4.7 * dt);

  const steerPower = drift ? 2.6 : 1.5;
  state.steerVel += steerInput * steerPower * dt;
  state.steerVel *= drift ? 0.92 : 0.84;

  state.t += state.speed * dt / 302;
  state.t = norm01(state.t);

  state.lateral += state.steerVel * (drift ? 4.5 : 2.8);
  state.lateral *= drift ? 0.992 : 0.95;
  const out = trackWidth * 0.5 - 0.6;
  if (Math.abs(state.lateral) > out) {
    state.lateral = Math.sign(state.lateral) * out;
    state.speed *= 0.84;
    state.steerVel *= 0.4;
  }

  const nearStart = state.t < 0.02 || state.t > 0.98;
  if (!state.lapDone && nearStart && performance.now() - state.startedAt > 3500) {
    state.lap = 1;
    state.lapDone = true;
    state.raceDone = true;
    state.finishedAt = performance.now();
    goalEl.hidden = false;
    sfx.tone(980, 0.12, 0.08, "triangle");
    sfx.tone(1320, 0.16, 0.06, "square");
  }

  if (drift && !wasDrift) sfx.tone(520, 0.04, 0.04, "sawtooth");
  if (!drift && wasDrift) {
    state.boost += 18;
    sfx.tone(860, 0.08, 0.05, "square");
  }
  wasDrift = drift;
  state.driftOn = drift;

  // AI placeholder update loop
  for (const ai of aiDrivers) ai.update?.(dt);
}

function renderWorld() {
  const center = centerCurve.getPointAt(state.t);
  const tan = tangentAt(state.t);
  const n = normalFromTangent(tan);

  const kartPos = center.clone().addScaledVector(n, state.lateral).add(new THREE.Vector3(0, 0.06, 0));
  kart.position.copy(kartPos);

  const yaw = Math.atan2(tan.x, tan.z);
  kart.rotation.set(0, yaw + state.steerVel * 0.18, -state.steerVel * 0.13);

  const camBack = 7.8;
  const camHeight = 3.4;
  const camTarget = kartPos.clone().add(new THREE.Vector3(0, 1.0, 0));
  const camPos = camTarget.clone().addScaledVector(tan, -camBack).add(new THREE.Vector3(0, camHeight, 0));
  camera.position.lerp(camPos, 0.15);
  camera.lookAt(camTarget);

  renderer.render(scene, camera);
}

function updateUi() {
  const ms = state.raceDone ? state.finishedAt - state.startedAt : performance.now() - state.startedAt;
  timerEl.textContent = `TIME ${(ms / 1000).toFixed(2).padStart(5, "0")}`;
  lapEl.textContent = `LAP ${state.lap}/1`;
}

function tick(now) {
  const dt = Math.min((now - prev) / 1000, 0.033);
  prev = now;
  update(dt);
  renderWorld();
  updateUi();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
