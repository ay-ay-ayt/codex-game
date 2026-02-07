import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const timerEl = document.getElementById("timer");
const lapEl = document.getElementById("lap");
const posEl = document.getElementById("position");
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
scene.background = new THREE.Color(0x78c9ff);
scene.fog = new THREE.Fog(0x8ad0ff, 48, 320);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 900);
scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x4a8246, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(80, 120, 40);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const skyBand = new THREE.Mesh(
  new THREE.CylinderGeometry(300, 300, 120, 52, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xb9eaff, side: THREE.BackSide })
);
skyBand.position.y = 36;
world.add(skyBand);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(280, 64),
  new THREE.MeshLambertMaterial({ color: 0x5bb64f })
);
ground.rotation.x = -Math.PI * 0.5;
ground.position.y = -0.08;
world.add(ground);

const waypoints = [
  new THREE.Vector3(0, 0, -66),
  new THREE.Vector3(58, 0, -56),
  new THREE.Vector3(76, 0, -18),
  new THREE.Vector3(72, 0, 22),
  new THREE.Vector3(34, 0, 56),
  new THREE.Vector3(-10, 0, 66),
  new THREE.Vector3(-58, 0, 58),
  new THREE.Vector3(-82, 0, 20),
  new THREE.Vector3(-74, 0, -26),
  new THREE.Vector3(-34, 0, -56),
];

const curve = new THREE.CatmullRomCurve3(waypoints, true, "catmullrom", 0.16);
const trackWidth = 12.5;
const segments = 520;
const centerPts = curve.getSpacedPoints(segments);

const asphalt = new THREE.MeshStandardMaterial({ color: 0x626873, roughness: 0.95, metalness: 0.03 });
const lanePaint = new THREE.MeshBasicMaterial({ color: 0xf8d565 });
const sideRed = new THREE.MeshBasicMaterial({ color: 0xd73f3f });
const sideWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
const wallMatA = new THREE.MeshLambertMaterial({ color: 0xff5050 });
const wallMatB = new THREE.MeshLambertMaterial({ color: 0xffffff });

function tangentAt(t) {
  return curve.getTangentAt((t % 1 + 1) % 1).normalize();
}

function normalFromTan(tan) {
  return new THREE.Vector3(-tan.z, 0, tan.x).normalize();
}

const roadPos = [];
const lanePos = [];
const roadIdx = [];
const edgeLPos = [];
const edgeRPos = [];

for (let i = 0; i <= segments; i++) {
  const p = centerPts[i % segments];
  const t = i / segments;
  const tan = tangentAt(t);
  const n = normalFromTan(tan);

  const left = p.clone().addScaledVector(n, -trackWidth * 0.5);
  const right = p.clone().addScaledVector(n, trackWidth * 0.5);
  roadPos.push(left.x, 0.03, left.z, right.x, 0.03, right.z);

  const laneLeft = p.clone().addScaledVector(n, -0.23);
  const laneRight = p.clone().addScaledVector(n, 0.23);
  lanePos.push(laneLeft.x, 0.05, laneLeft.z, laneRight.x, 0.05, laneRight.z);

  const curbW = 1.15;
  const l0 = p.clone().addScaledVector(n, -trackWidth * 0.5 - curbW);
  const l1 = p.clone().addScaledVector(n, -trackWidth * 0.5);
  const r0 = p.clone().addScaledVector(n, trackWidth * 0.5);
  const r1 = p.clone().addScaledVector(n, trackWidth * 0.5 + curbW);
  edgeLPos.push(l0.x, 0.04, l0.z, l1.x, 0.04, l1.z);
  edgeRPos.push(r0.x, 0.04, r0.z, r1.x, 0.04, r1.z);

  if (i < segments) {
    const a = i * 2;
    roadIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
}

function stripMesh(position, index, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

world.add(stripMesh(roadPos, roadIdx, asphalt));
world.add(stripMesh(lanePos, roadIdx, lanePaint));

for (let i = 0; i < segments; i++) {
  const leftG = new THREE.BufferGeometry();
  leftG.setAttribute("position", new THREE.Float32BufferAttribute(edgeLPos.slice(i * 6, i * 6 + 12), 3));
  leftG.setIndex([0, 2, 1, 1, 2, 3]);
  world.add(new THREE.Mesh(leftG, i % 2 ? sideWhite : sideRed));

  const rightG = new THREE.BufferGeometry();
  rightG.setAttribute("position", new THREE.Float32BufferAttribute(edgeRPos.slice(i * 6, i * 6 + 12), 3));
  rightG.setIndex([0, 2, 1, 1, 2, 3]);
  world.add(new THREE.Mesh(rightG, i % 2 ? sideRed : sideWhite));

  if (i % 6 === 0) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = tangentAt(t);
    const n = normalFromTan(tan);
    const outer = p.clone().addScaledVector(n, (trackWidth * 0.5 + 2.8) * (i % 12 ? 1 : -1));
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.8), i % 12 ? wallMatA : wallMatB);
    w.position.copy(outer).add(new THREE.Vector3(0, 0.65, 0));
    w.lookAt(outer.clone().add(tan));
    world.add(w);
  }
}

const grandstandMatA = new THREE.MeshLambertMaterial({ color: 0xf8cf45 });
const grandstandMatB = new THREE.MeshLambertMaterial({ color: 0x4c7dff });
for (let i = 0; i < 40; i++) {
  const t = i / 40;
  const p = curve.getPointAt(t);
  const tan = tangentAt(t);
  const n = normalFromTan(tan);
  const side = i % 2 ? 1 : -1;
  const base = p.clone().addScaledVector(n, side * (trackWidth * 0.5 + 14 + (i % 3) * 2));
  const stand = new THREE.Group();
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 3), s % 2 ? grandstandMatA : grandstandMatB);
    step.position.set(0, 0.6 + s * 1.1, -2 + s * 1.3);
    stand.add(step);
  }
  stand.position.copy(base);
  stand.lookAt(base.clone().add(tan));
  world.add(stand);
}

const balloonColors = [0xff4e50, 0x4ec1ff, 0xffd24e, 0x60db77, 0xf48bff];
for (let i = 0; i < 18; i++) {
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 14, 14),
    new THREE.MeshLambertMaterial({ color: balloonColors[i % balloonColors.length] })
  );
  const a = (i / 18) * Math.PI * 2;
  const r = 140 + (i % 3) * 8;
  balloon.position.set(Math.cos(a) * r, 18 + (i % 4) * 2, Math.sin(a) * r);
  world.add(balloon);
}

const bannerMat = new THREE.MeshLambertMaterial({ color: 0x1f2c4a });
const banner = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 1.2), bannerMat);
banner.position.set(0, 5.2, -66);
world.add(banner);

function buildKart(color = 0xf04545) {
  const k = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.58, 2.45), new THREE.MeshStandardMaterial({ color, roughness: 0.62 }));
  body.position.y = 0.84;
  k.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.82), new THREE.MeshStandardMaterial({ color: 0xeef4ff }));
  seat.position.set(0, 1.16, 0.35);
  k.add(seat);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 1 });
  for (const [x, z] of [[-0.95, -0.85], [0.95, -0.85], [-0.95, 0.9], [0.95, 0.9]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI * 0.5;
    w.position.set(x, 0.45, z);
    k.add(w);
  }
  return k;
}

const playerKart = buildKart(0xea4040);
world.add(playerKart);

const botColors = [0x4ec1ff, 0x63e16c, 0xffd34e];
const bots = botColors.map((c, i) => {
  const mesh = buildKart(c);
  world.add(mesh);
  return {
    id: `BOT${i + 1}`,
    mesh,
    t: (0.75 + i * 0.06) % 1,
    prevT: (0.75 + i * 0.06) % 1,
    lateral: (i - 1) * 1.8,
    speed: 32.5 + i * 0.35,
    lap: 0,
    finishedAt: 0,
  };
});

const input = { left: false, right: false, drift: false };
const race = {
  lapTarget: 1,
  raceDone: false,
  playerFinishPos: 0,
};

const player = {
  id: "YOU",
  t: 0,
  prevT: 0,
  speed: 0,
  lateral: 0,
  steerVel: 0,
  boost: 0,
  driftOn: false,
  lap: 0,
  finishedAt: 0,
  startedAt: performance.now(),
  soundOn: false,
};

class Sfx {
  constructor() { this.ctx = null; }
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  tone(freq = 620, dur = 0.08, gain = 0.05, type = "square") {
    if (!player.soundOn) return;
    this.ensure();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
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
  player.soundOn = !player.soundOn;
  soundBtn.textContent = player.soundOn ? "SOUND ON" : "SOUND OFF";
  soundBtn.setAttribute("aria-pressed", String(player.soundOn));
  if (player.soundOn) sfx.tone(780, 0.06, 0.05, "sine");
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function wrap01(v) {
  let t = v % 1;
  if (t < 0) t += 1;
  return t;
}

function progressValue(d) {
  return d.lap + d.t;
}

function maybeLapUp(driver) {
  if (driver.prevT > 0.94 && driver.t < 0.08) {
    driver.lap += 1;
    if (!driver.finishedAt && driver.lap >= race.lapTarget) {
      driver.finishedAt = performance.now();
    }
  }
}

function updatePlayer(dt) {
  if (player.finishedAt) return;
  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const drift = input.drift && steerInput !== 0;

  const target = 36;
  const driftPenalty = drift ? 5 : 0;
  player.speed += (target - player.speed - driftPenalty) * dt * 1.85;
  player.speed += player.boost * dt;
  player.boost *= Math.exp(-4.6 * dt);

  const steerPower = drift ? 2.5 : 1.48;
  player.steerVel += steerInput * steerPower * dt;
  player.steerVel *= drift ? 0.92 : 0.84;

  player.prevT = player.t;
  player.t = wrap01(player.t + (player.speed * dt / 410));

  player.lateral += player.steerVel * (drift ? 4.3 : 2.7);
  player.lateral *= drift ? 0.992 : 0.95;

  const out = trackWidth * 0.5 - 0.9;
  if (Math.abs(player.lateral) > out) {
    player.lateral = Math.sign(player.lateral) * out;
    player.speed *= 0.84;
    player.steerVel *= 0.45;
  }

  if (!player.driftOn && drift) sfx.tone(520, 0.05, 0.04, "sawtooth");
  if (player.driftOn && !drift) {
    player.boost += 18;
    sfx.tone(900, 0.09, 0.05, "square");
  }
  player.driftOn = drift;
  maybeLapUp(player);
}

function updateBots(dt) {
  for (const bot of bots) {
    if (bot.finishedAt) continue;
    bot.prevT = bot.t;
    const wave = Math.sin(performance.now() * 0.0012 + bot.speed) * 0.06;
    bot.t = wrap01(bot.t + (bot.speed + wave) * dt / 410);

    const ideal = Math.sin(bot.t * Math.PI * 2 + bot.speed) * 1.7;
    bot.lateral += (ideal - bot.lateral) * dt * 2.5;
    bot.lateral = Math.max(-(trackWidth * 0.5 - 1), Math.min(trackWidth * 0.5 - 1, bot.lateral));

    maybeLapUp(bot);
  }
}

function setKartTransform(mesh, t, lateral, steerFactor = 0) {
  const center = curve.getPointAt(t);
  const tan = tangentAt(t);
  const n = normalFromTan(tan);
  const pos = center.clone().addScaledVector(n, lateral).add(new THREE.Vector3(0, 0.06, 0));
  mesh.position.copy(pos);
  const yaw = Math.atan2(tan.x, tan.z);
  mesh.rotation.set(0, yaw + steerFactor * 0.17, -steerFactor * 0.12);
  return { pos, tan };
}

function rankList() {
  const drivers = [
    { id: player.id, t: player.t, lap: player.lap, finish: player.finishedAt || Infinity },
    ...bots.map((b) => ({ id: b.id, t: b.t, lap: b.lap, finish: b.finishedAt || Infinity })),
  ];

  drivers.sort((a, b) => {
    const aDone = Number.isFinite(a.finish);
    const bDone = Number.isFinite(b.finish);
    if (aDone && bDone) return a.finish - b.finish;
    if (aDone) return -1;
    if (bDone) return 1;
    return progressValue(b) - progressValue(a);
  });
  return drivers;
}

function ordinal(n) {
  return ["1st", "2nd", "3rd", "4th"][n - 1] || `${n}th`;
}

let prev = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - prev) / 1000);
  prev = now;

  if (!race.raceDone) {
    updatePlayer(dt);
    updateBots(dt);
  }

  const playerPose = setKartTransform(playerKart, player.t, player.lateral, player.steerVel);
  for (const bot of bots) setKartTransform(bot.mesh, bot.t, bot.lateral, 0.25);

  const camTarget = playerPose.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
  const camPos = camTarget.clone().addScaledVector(playerPose.tan, -9.2).add(new THREE.Vector3(0, 3.9, 0));
  camera.position.lerp(camPos, 0.16);
  camera.lookAt(camTarget);

  const order = rankList();
  const pos = order.findIndex((d) => d.id === player.id) + 1;
  posEl.textContent = `POS ${pos}/4`;

  if (!race.raceDone && player.finishedAt) {
    race.raceDone = true;
    race.playerFinishPos = pos;
    goalEl.hidden = false;
    goalEl.textContent = `FINISH\n${ordinal(pos)}`;
    sfx.tone(pos === 1 ? 1180 : 900, 0.15, 0.08, "triangle");
  }

  const elapsed = player.finishedAt ? player.finishedAt - player.startedAt : performance.now() - player.startedAt;
  timerEl.textContent = `TIME ${(elapsed / 1000).toFixed(2).padStart(5, "0")}`;
  lapEl.textContent = `LAP ${Math.min(player.lap + 1, race.lapTarget)}/${race.lapTarget}`;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
