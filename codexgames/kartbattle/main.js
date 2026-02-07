import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const timerEl = document.getElementById("timer");
const lapEl = document.getElementById("lap");
const rankEl = document.getElementById("rank");
const goalEl = document.getElementById("goal");
const soundBtn = document.getElementById("soundBtn");
const restartBtn = document.getElementById("restartBtn");
const botCountEl = document.getElementById("botCount");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const driftBtn = document.getElementById("driftBtn");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fc7ff);
scene.fog = new THREE.Fog(0x7fc7ff, 30, 300);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 800);

scene.add(new THREE.HemisphereLight(0xdff2ff, 0x3d6a2f, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(50, 100, 50);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const centerPoints = [
  new THREE.Vector3(0, 0, -60),
  new THREE.Vector3(45, 0, -50),
  new THREE.Vector3(70, 0, -5),
  new THREE.Vector3(50, 0, 45),
  new THREE.Vector3(5, 0, 62),
  new THREE.Vector3(-52, 0, 48),
  new THREE.Vector3(-70, 0, 0),
  new THREE.Vector3(-42, 0, -50),
];
const centerCurve = new THREE.CatmullRomCurve3(centerPoints, true, "catmullrom", 0.1);
const trackWidth = 14;
const halfTrack = trackWidth * 0.5;
const sampleCount = 800;
const samplePoints = centerCurve.getSpacedPoints(sampleCount);
const trackLength = centerCurve.getLength();

function tangentAt(t) {
  return centerCurve.getTangentAt(norm01(t)).normalize();
}
function rightFromTangent(tan) {
  return new THREE.Vector3(tan.z, 0, -tan.x).normalize();
}
function norm01(v) {
  let t = v % 1;
  if (t < 0) t += 1;
  return t;
}

const grass = new THREE.Mesh(
  new THREE.CircleGeometry(330, 72),
  new THREE.MeshLambertMaterial({ color: 0x3ea23f })
);
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.06;
world.add(grass);

const skyRing = new THREE.Mesh(
  new THREE.CylinderGeometry(320, 320, 120, 64, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xa9deff, side: THREE.BackSide })
);
skyRing.position.y = 40;
world.add(skyRing);

function buildStrip(innerOffset, outerOffset, y, matA, matB) {
  const strip = new THREE.Group();
  for (let i = 0; i < sampleCount; i++) {
    const t0 = i / sampleCount;
    const t1 = (i + 1) / sampleCount;
    const p0 = centerCurve.getPointAt(t0);
    const p1 = centerCurve.getPointAt(t1);
    const n0 = rightFromTangent(tangentAt(t0));
    const n1 = rightFromTangent(tangentAt(t1));

    const v0 = p0.clone().addScaledVector(n0, innerOffset);
    const v1 = p0.clone().addScaledVector(n0, outerOffset);
    const v2 = p1.clone().addScaledVector(n1, innerOffset);
    const v3 = p1.clone().addScaledVector(n1, outerOffset);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([
      v0.x, y, v0.z,
      v1.x, y, v1.z,
      v2.x, y, v2.z,
      v3.x, y, v3.z,
    ], 3));
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    geo.computeVertexNormals();
    const mat = matB && i % 2 ? matB : matA;
    strip.add(new THREE.Mesh(geo, mat));
  }
  world.add(strip);
}

buildStrip(-halfTrack, halfTrack, 0.02, new THREE.MeshStandardMaterial({ color: 0x565861, roughness: 0.92, metalness: 0.06 }));
buildStrip(-halfTrack - 2.8, -halfTrack, 0.026, new THREE.MeshStandardMaterial({ color: 0xd0bf87, roughness: 1 }));
buildStrip(halfTrack, halfTrack + 2.8, 0.026, new THREE.MeshStandardMaterial({ color: 0xd0bf87, roughness: 1 }));
buildStrip(-halfTrack - 1.3, -halfTrack, 0.03, new THREE.MeshBasicMaterial({ color: 0xffffff }), new THREE.MeshBasicMaterial({ color: 0xdb2d2d }));
buildStrip(halfTrack, halfTrack + 1.3, 0.03, new THREE.MeshBasicMaterial({ color: 0xdb2d2d }), new THREE.MeshBasicMaterial({ color: 0xffffff }));
buildStrip(-0.16, 0.16, 0.031, new THREE.MeshBasicMaterial({ color: 0xf3d96f }));

function addGuardrails() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.6, metalness: 0.6 });
  const geo = new THREE.BoxGeometry(2.2, 0.6, 0.5);
  for (let i = 0; i < sampleCount; i += 4) {
    const t = i / sampleCount;
    const p = centerCurve.getPointAt(t);
    const tan = tangentAt(t);
    const n = rightFromTangent(tan);
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(p).addScaledVector(n, side * (halfTrack + 3.5));
      m.position.y = 0.35;
      m.rotation.y = Math.atan2(tan.x, tan.z);
      world.add(m);
    }
  }
}
addGuardrails();

function addCourseProps() {
  const postMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  const signMat = new THREE.MeshBasicMaterial({ color: 0x3278ff });
  for (let i = 0; i < sampleCount; i += 34) {
    const t = i / sampleCount;
    const p = centerCurve.getPointAt(t);
    const tan = tangentAt(t);
    const n = rightFromTangent(tan);
    const sign = new THREE.Group();
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), postMat);
    const rightPost = leftPost.clone();
    leftPost.position.set(-2.2, 1.5, 0);
    rightPost.position.set(2.2, 1.5, 0);
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.4, 0.2), signMat);
    board.position.set(0, 2.4, 0);
    sign.add(leftPost, rightPost, board);
    sign.position.copy(p).addScaledVector(n, (i % 68 ? 1 : -1) * (halfTrack + 8));
    sign.position.y = 0;
    sign.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI * 0.5;
    world.add(sign);
  }

  const standColors = [0xff5353, 0x53c0ff, 0xffd553, 0x82ff79];
  for (let i = 0; i < sampleCount; i += 10) {
    const t = i / sampleCount;
    const p = centerCurve.getPointAt(t);
    const n = rightFromTangent(tangentAt(t));
    const side = i % 2 ? 1 : -1;
    const xz = p.clone().addScaledVector(n, side * (halfTrack + 12 + (i % 3) * 3));
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 2.5 + (i % 4), 1.8),
      new THREE.MeshLambertMaterial({ color: standColors[i % standColors.length] })
    );
    g.position.set(xz.x, 1.2, xz.z);
    world.add(g);
  }
}
addCourseProps();

function createKart(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.3), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  body.position.y = 0.68;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.65), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  nose.position.set(0, 0.82, -1.15);
  g.add(body, nose);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 1 });
  [[-0.9, -0.8], [0.9, -0.8], [-0.9, 0.85], [0.9, 0.85]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI * 0.5;
    w.position.set(x, 0.35, z);
    g.add(w);
  });
  return g;
}

const playerKart = createKart(0xf24444);
world.add(playerKart);

const botColors = [0x3d71ff, 0xff9f3d, 0x8a4dff, 0x44d779];

const input = { left: false, right: false, drift: false };
const race = {
  lapsTotal: 3,
  startedAt: performance.now(),
  finishedAt: 0,
  finished: false,
  botCount: Number(botCountEl.value),
  soundOn: false,
};

const player = {
  pos: new THREE.Vector3(),
  heading: 0,
  speed: 0,
  yawVel: 0,
  driftCharge: 0,
  lap: 1,
  t: 0,
  prevT: 0,
  progress: 0,
};

const bots = [];

class Sfx {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  tone(f = 600, d = 0.08, gain = 0.05, type = "square") {
    if (!race.soundOn) return;
    this.ensure();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, now);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + d);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + d + 0.02);
  }
}
const sfx = new Sfx();

function nearestTrackData(pos) {
  let nearestDistSq = Infinity;
  let nearestIdx = 0;
  for (let i = 0; i < sampleCount; i++) {
    const p = samplePoints[i];
    const dx = pos.x - p.x;
    const dz = pos.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < nearestDistSq) {
      nearestDistSq = d2;
      nearestIdx = i;
    }
  }
  const t = nearestIdx / sampleCount;
  const center = samplePoints[nearestIdx];
  const tan = tangentAt(t);
  const right = rightFromTangent(tan);
  const rel = new THREE.Vector3().subVectors(pos, center);
  const lateral = rel.dot(right);
  return { t, center, tan, right, lateral, dist: Math.sqrt(nearestDistSq) };
}

function resetRace() {
  goalEl.hidden = true;
  race.finished = false;
  race.startedAt = performance.now();
  race.finishedAt = 0;

  const start = centerCurve.getPointAt(0);
  const tan = tangentAt(0);
  const right = rightFromTangent(tan);

  player.pos.copy(start).addScaledVector(right, -2.2).setY(0.02);
  player.heading = Math.atan2(tan.x, tan.z);
  player.speed = 15;
  player.yawVel = 0;
  player.driftCharge = 0;
  player.lap = 1;
  player.t = 0;
  player.prevT = 0;
  player.progress = 0;

  for (const b of bots) world.remove(b.mesh);
  bots.length = 0;

  for (let i = 0; i < race.botCount; i++) {
    const t = norm01(0.01 + i * 0.03);
    const p = centerCurve.getPointAt(t);
    const n = rightFromTangent(tangentAt(t));
    const lane = (i % 2 ? 1 : -1) * (1.6 + (i % 3) * 1.1);
    const mesh = createKart(botColors[i]);
    mesh.position.copy(p).addScaledVector(n, lane).setY(0.02);
    mesh.rotation.y = Math.atan2(tangentAt(t).x, tangentAt(t).z);
    world.add(mesh);
    bots.push({
      mesh,
      t,
      lane,
      speed: 25 + i * 1.2,
      lap: 1,
      progress: 0,
      targetSpeed: 26 + Math.random() * 6,
    });
  }
}

function setButtonHold(button, key) {
  const down = (e) => { e.preventDefault(); input[key] = true; button.classList.add("active"); };
  const up = (e) => { e.preventDefault(); input[key] = false; button.classList.remove("active"); };
  button.addEventListener("pointerdown", down, { passive: false });
  button.addEventListener("pointerup", up, { passive: false });
  button.addEventListener("pointercancel", up, { passive: false });
  button.addEventListener("pointerleave", up, { passive: false });
}
setButtonHold(leftBtn, "left");
setButtonHold(rightBtn, "right");
setButtonHold(driftBtn, "drift");

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
  race.soundOn = !race.soundOn;
  soundBtn.textContent = race.soundOn ? "SOUND ON" : "SOUND OFF";
  soundBtn.setAttribute("aria-pressed", String(race.soundOn));
  if (race.soundOn) sfx.tone(820, 0.08, 0.05, "sine");
});

botCountEl.addEventListener("change", () => {
  race.botCount = Number(botCountEl.value);
  resetRace();
});
restartBtn.addEventListener("click", resetRace);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let wasDrifting = false;

function updatePlayer(dt) {
  if (race.finished) return;

  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const drifting = input.drift && steer !== 0;
  const maxSpeed = drifting ? 40 : 46;

  player.speed += (maxSpeed - player.speed) * dt * 1.2;
  player.speed = Math.max(8, Math.min(player.speed, 55));

  const steerPower = drifting ? 2.25 : 1.5;
  const speedFactor = THREE.MathUtils.clamp(player.speed / 40, 0.5, 1.2);
  player.yawVel += steer * steerPower * speedFactor * dt;
  player.yawVel *= drifting ? 0.88 : 0.82;

  player.heading += player.yawVel;

  const forward = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  player.pos.addScaledVector(forward, player.speed * dt);

  const track = nearestTrackData(player.pos);
  player.t = track.t;

  const outside = Math.abs(track.lateral) - (halfTrack - 1.2);
  if (outside > 0) {
    const pushDir = Math.sign(track.lateral);
    player.pos.addScaledVector(track.right, -pushDir * outside * 0.45);
    player.speed *= 0.86;
    player.yawVel *= 0.65;
  }

  if (Math.abs(track.lateral) > halfTrack + 2.8) {
    player.speed *= 0.82;
  }

  const desiredHeading = Math.atan2(track.tan.x, track.tan.z);
  const turnAlign = THREE.MathUtils.clamp(Math.sin(desiredHeading - player.heading), -1, 1);
  player.heading += turnAlign * dt * 0.65;

  if (drifting) {
    player.driftCharge = Math.min(1.4, player.driftCharge + dt * 1.4);
    if (!wasDrifting) sfx.tone(430, 0.05, 0.04, "sawtooth");
  } else if (wasDrifting && player.driftCharge > 0.2) {
    player.speed += 5 + player.driftCharge * 6;
    sfx.tone(980, 0.1, 0.06, "square");
    player.driftCharge = 0;
  } else {
    player.driftCharge = Math.max(0, player.driftCharge - dt * 0.8);
  }
  wasDrifting = drifting;

  if (player.prevT > 0.85 && player.t < 0.15) {
    player.lap += 1;
    sfx.tone(760, 0.09, 0.05, "triangle");
    if (player.lap > race.lapsTotal) {
      race.finished = true;
      race.finishedAt = performance.now();
      goalEl.hidden = false;
      sfx.tone(1200, 0.15, 0.08, "square");
    }
  }
  player.prevT = player.t;
  player.progress = (player.lap - 1) + player.t;
}

function updateBots(dt) {
  for (const b of bots) {
    b.speed += (b.targetSpeed - b.speed) * dt * 0.8;
    const tNext = norm01(b.t + (b.speed * dt) / trackLength);
    if (b.t > 0.85 && tNext < 0.15) b.lap += 1;
    b.t = tNext;

    if (Math.random() < 0.015) b.targetSpeed = 25 + Math.random() * 8;

    const center = centerCurve.getPointAt(b.t);
    const tan = tangentAt(b.t);
    const n = rightFromTangent(tan);
    const target = center.clone().addScaledVector(n, b.lane).setY(0.02);
    b.mesh.position.lerp(target, 0.42);
    b.mesh.rotation.y = Math.atan2(tan.x, tan.z);
    b.progress = (b.lap - 1) + b.t;

    const diff = b.mesh.position.distanceTo(player.pos);
    if (diff < 1.8 && !race.finished) {
      player.speed *= 0.98;
    }
  }
}

function updateKartMeshes() {
  playerKart.position.copy(player.pos).setY(0.02);
  playerKart.rotation.y = player.heading;
  playerKart.rotation.z = THREE.MathUtils.clamp(-player.yawVel * 0.45, -0.25, 0.25);
}

function updateCamera() {
  const forward = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const camTarget = player.pos.clone().add(new THREE.Vector3(0, 1.0, 0)).addScaledVector(forward, 4.5);
  const camPos = player.pos.clone().addScaledVector(forward, -8.5).add(new THREE.Vector3(0, 4.4, 0));
  camera.position.lerp(camPos, 0.14);
  camera.lookAt(camTarget);
}

function updateUi() {
  const elapsed = race.finished ? race.finishedAt - race.startedAt : performance.now() - race.startedAt;
  timerEl.textContent = `TIME ${(elapsed / 1000).toFixed(2).padStart(5, "0")}`;
  lapEl.textContent = `LAP ${Math.min(player.lap, race.lapsTotal)}/${race.lapsTotal}`;

  const standings = [{ p: player.progress, isPlayer: true }, ...bots.map((b) => ({ p: b.progress, isPlayer: false }))]
    .sort((a, b) => b.p - a.p);
  const rank = standings.findIndex((s) => s.isPlayer) + 1;
  rankEl.textContent = `POS ${rank} / ${bots.length + 1}`;
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  updatePlayer(dt);
  updateBots(dt);
  updateKartMeshes();
  updateCamera();
  updateUi();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

resetRace();
requestAnimationFrame(tick);
