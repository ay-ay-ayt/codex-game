const BUILD_NUMBER = 83421;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const lapEl = document.getElementById("lap");
const speedEl = document.getElementById("speed");
const rankEl = document.getElementById("rank");
const buildEl = document.getElementById("build");
const mapSelect = document.getElementById("mapSelect");
const botCountEl = document.getElementById("botCount");
const restartBtn = document.getElementById("restartBtn");
const burstFillEl = document.getElementById("burstFill");
const centerMsg = document.getElementById("centerMsg");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const driftBtn = document.getElementById("driftBtn");

buildEl.textContent = `BUILD ${BUILD_NUMBER}`;

const KEY = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  Shift: "drift",
  " ": "drift",
};

const MAPS = {
  neon: {
    name: "NEON CITY",
    sky: ["#04122d", "#20063e"],
    horizon: "#42056f",
    groundA: "#0f3d43",
    groundB: "#134b2d",
    roadA: "#212738",
    roadB: "#252f45",
    lane: "#76f7ff",
    accent: "#fe4bd8",
    segments: [
      [70, 0, 0], [60, 0, 0.6], [80, 0, -0.45], [65, 0, 0],
      [55, 40, 0.25], [45, -34, -0.85], [70, 10, 0.4], [40, 0, 0],
      [50, 15, -0.8], [60, -15, 0.5], [80, 0, 0.15],
    ],
  },
  sunset: {
    name: "SUNSET LOOP",
    sky: ["#ff9f63", "#ff4779"],
    horizon: "#ffce78",
    groundA: "#6aa04d",
    groundB: "#89b45f",
    roadA: "#4b464a",
    roadB: "#58525a",
    lane: "#fff1b3",
    accent: "#ffd86b",
    segments: [
      [110, 0, 0], [45, 12, 0.7], [65, 30, -0.4], [60, -38, -0.68],
      [95, 0, 0], [52, 20, 0.25], [50, -24, -0.95], [80, 0, 0.35],
      [70, 0, -0.55], [85, 0, 0],
    ],
  },
  alpine: {
    name: "ALPINE TWIST",
    sky: ["#5aa4ff", "#dbf2ff"],
    horizon: "#eff8ff",
    groundA: "#2c5d42",
    groundB: "#3a774f",
    roadA: "#2d3340",
    roadB: "#3b4250",
    lane: "#ffffff",
    accent: "#86e6ff",
    segments: [
      [60, 25, 0], [52, 35, -0.95], [68, -15, 0.74], [85, -28, 0],
      [58, 20, 0.6], [60, 0, -0.85], [60, 30, 0.5], [54, -40, -0.35],
      [84, 0, 0.12], [96, 0, 0],
    ],
  },
};

const SEGMENT_LENGTH = 180;
const ROAD_WIDTH = 2100;
const CAMERA_HEIGHT = 900;
const DRAW_DISTANCE = 230;
const MAX_SPEED = SEGMENT_LENGTH * 3.5;
const LAPS_TOTAL = 3;

const state = {
  mapKey: "neon",
  segments: [],
  trackLength: 0,
  player: {
    x: 0,
    z: 0,
    speed: 0,
    lap: 1,
    finished: false,
    driftPower: 0,
    driftLock: 0,
    burst: 0,
    burstTimer: 0,
  },
  bots: [],
  pickups: [],
  totalRacers: 1,
  input: { left: false, right: false, drift: false },
  raceStart: performance.now(),
  lastTime: performance.now(),
  messageTimer: 0,
  messageText: "",
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function addSegment(curve, y1, y2) {
  const index = state.segments.length;
  state.segments.push({
    index,
    curve,
    p1: { world: { y: y1 }, camera: {}, screen: {} },
    p2: { world: { y: y2 }, camera: {}, screen: {} },
    sprites: [],
    pickups: [],
  });
}

function easeInOut(a, b, p) {
  return a + (b - a) * ((-Math.cos(Math.PI * p) / 2) + 0.5);
}

function buildTrack(mapKey) {
  state.mapKey = mapKey;
  state.segments = [];
  state.pickups = [];
  const profile = MAPS[mapKey];

  let currentY = 0;
  profile.segments.forEach(([count, hill, curve]) => {
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const segCurve = easeInOut(0, curve, t);
      const nextY = currentY + hill / count;
      addSegment(segCurve, currentY, nextY);
      currentY = nextY;
    }
  });

  state.trackLength = state.segments.length * SEGMENT_LENGTH;

  for (let i = 20; i < state.segments.length; i += 26) {
    state.segments[i].pickups.push({ lane: (Math.sin(i * 0.47) * 0.65), taken: false, z: i * SEGMENT_LENGTH });
  }
}

function resetRace() {
  const botCount = Number(botCountEl.value);
  state.player = {
    x: 0,
    z: 0,
    speed: MAX_SPEED * 0.4,
    lap: 1,
    finished: false,
    driftPower: 0,
    driftLock: 0,
    burst: 0,
    burstTimer: 0,
  };

  state.bots = [];
  for (let i = 0; i < botCount; i++) {
    state.bots.push({
      id: i,
      x: -0.8 + (i / Math.max(1, botCount - 1)) * 1.6,
      targetX: Math.random() * 1.6 - 0.8,
      z: (i + 1) * 620,
      speed: MAX_SPEED * (0.58 + Math.random() * 0.27),
      lap: 1,
      color: `hsl(${(i * 58 + 195) % 360} 90% 62%)`,
    });
  }

  state.totalRacers = botCount + 1;
  state.raceStart = performance.now();
  state.lastTime = performance.now();
  burstFillEl.style.width = "0%";
  setCenterMessage(`${MAPS[state.mapKey].name}\nREADY`, 1300);
}

function setCenterMessage(text, ms = 800) {
  state.messageText = text;
  state.messageTimer = ms;
  centerMsg.textContent = text;
  centerMsg.classList.add("show");
}

function findSegment(z) {
  return state.segments[Math.floor(z / SEGMENT_LENGTH) % state.segments.length];
}

function percentRemaining(z, length) {
  return (z % length) / length;
}

function project(point, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
  const dz = point.world.z - cameraZ;
  point.camera.x = point.world.x - cameraX;
  point.camera.y = point.world.y - cameraY;
  point.camera.z = dz;
  point.screen.scale = cameraDepth / Math.max(0.01, dz);
  point.screen.x = Math.round((width / 2) + (point.screen.scale * point.camera.x * width / 2));
  point.screen.y = Math.round((height / 2) - (point.screen.scale * point.camera.y * height / 2));
  point.screen.w = Math.round((point.screen.scale * roadWidth * width / 2));
}

function update(dt) {
  const p = state.player;
  if (p.finished) return;

  const steer = (state.input.left ? -1 : 0) + (state.input.right ? 1 : 0);
  const drifting = state.input.drift;

  const baseTarget = p.burstTimer > 0 ? MAX_SPEED * 1.18 : MAX_SPEED;
  const offroad = Math.abs(p.x) > 1.06;
  const targetSpeed = offroad ? baseTarget * 0.68 : baseTarget;
  p.speed += (targetSpeed - p.speed) * dt * 1.25;

  let turnRate = 2.35;
  if (drifting) {
    turnRate *= 1.6;
    p.driftPower = Math.min(1, p.driftPower + dt * (Math.abs(steer) > 0 ? 0.75 : 0.35));
  } else if (p.driftPower > 0.05) {
    p.burst = Math.min(1, p.burst + p.driftPower * 0.5);
    p.speed = Math.min(MAX_SPEED * 1.1, p.speed + MAX_SPEED * 0.1 * p.driftPower);
    setCenterMessage("DRIFT BOOST!", 480);
    p.driftPower = 0;
  }

  const seg = findSegment(p.z + CAMERA_HEIGHT);
  const curvePull = seg.curve * 0.7;
  p.x += steer * turnRate * dt * (p.speed / MAX_SPEED) - curvePull * dt * (p.speed / MAX_SPEED);
  p.x = Math.max(-1.28, Math.min(1.28, p.x));

  p.z += p.speed * dt;
  while (p.z >= state.trackLength) {
    p.z -= state.trackLength;
    p.lap += 1;
    if (p.lap > LAPS_TOTAL) {
      p.finished = true;
      const elapsed = (performance.now() - state.raceStart) / 1000;
      setCenterMessage(`FINISH!\n${elapsed.toFixed(2)}s`, 4000);
    } else {
      setCenterMessage(`LAP ${p.lap}/${LAPS_TOTAL}`, 750);
    }
  }

  p.burst = Math.max(0, p.burst - dt * 0.025);
  if (p.burst >= 0.995 && p.burstTimer <= 0) {
    p.burst = 0;
    p.burstTimer = 2.6;
    setCenterMessage("PHOTON BURST!", 900);
  }
  p.burstTimer = Math.max(0, p.burstTimer - dt);

  const pickupSegment = findSegment(p.z);
  for (const pickup of pickupSegment.pickups) {
    if (pickup.taken) continue;
    const dz = Math.abs((pickup.z % state.trackLength) - p.z);
    const laneGap = Math.abs(pickup.lane - p.x);
    if (dz < 140 && laneGap < 0.24) {
      pickup.taken = true;
      p.burst = Math.min(1, p.burst + 0.3);
    }
  }

  for (const bot of state.bots) {
    bot.speed += ((MAX_SPEED * (0.58 + (bot.id % 3) * 0.08)) - bot.speed) * dt * 0.8;
    bot.z += bot.speed * dt;
    if (Math.random() < 0.018) bot.targetX = Math.random() * 1.8 - 0.9;
    bot.x += (bot.targetX - bot.x) * dt * 0.8;

    while (bot.z >= state.trackLength) {
      bot.z -= state.trackLength;
      bot.lap += 1;
    }

    let dz = bot.z - p.z;
    if (dz < -state.trackLength * 0.5) dz += state.trackLength;
    if (dz > state.trackLength * 0.5) dz -= state.trackLength;

    if (Math.abs(dz) < 120 && Math.abs(bot.x - p.x) < 0.18) {
      p.speed *= 0.95;
      p.x += dz > 0 ? -0.02 : 0.02;
    }
  }

  if (state.messageTimer > 0) {
    state.messageTimer -= dt * 1000;
    if (state.messageTimer <= 0) centerMsg.classList.remove("show");
  }
}

function drawQuad(x1, y1, w1, x2, y2, w2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1);
  ctx.lineTo(x2 - w2, y2);
  ctx.lineTo(x2 + w2, y2);
  ctx.lineTo(x1 + w1, y1);
  ctx.closePath();
  ctx.fill();
}

function drawPlayerCar() {
  const y = canvas.height * 0.81;
  const x = canvas.width * 0.5 + state.player.x * canvas.width * 0.18;
  const w = Math.max(56, canvas.width * 0.062);
  const h = w * 0.58;

  if (state.input.drift) {
    ctx.fillStyle = "rgba(255,210,80,0.85)";
    ctx.beginPath();
    ctx.arc(x - w * 0.45, y + h * 0.2, 10 + state.player.driftPower * 12, 0, Math.PI * 2);
    ctx.arc(x + w * 0.45, y + h * 0.2, 10 + state.player.driftPower * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.player.burstTimer > 0) {
    ctx.fillStyle = "rgba(80,255,243,0.35)";
    ctx.fillRect(x - w * 1.1, y - h * 0.4, w * 2.2, h * 1.6);
  }

  ctx.fillStyle = "#ff4a76";
  ctx.fillRect(x - w * 0.5, y - h * 0.5, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - w * 0.23, y - h * 0.58, w * 0.46, h * 0.2);
  ctx.fillStyle = "#111";
  ctx.fillRect(x - w * 0.44, y + h * 0.24, w * 0.2, h * 0.17);
  ctx.fillRect(x + w * 0.24, y + h * 0.24, w * 0.2, h * 0.17);
}

function drawWorld() {
  const map = MAPS[state.mapKey];
  const width = canvas.width;
  const height = canvas.height;
  const cameraDepth = 1 / Math.tan((80 / 2) * Math.PI / 180);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.62);
  skyGrad.addColorStop(0, map.sky[0]);
  skyGrad.addColorStop(1, map.sky[1]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = map.horizon;
  ctx.fillRect(0, height * 0.52, width, height * 0.04);

  const baseSegment = Math.floor(state.player.z / SEGMENT_LENGTH);
  const basePercent = percentRemaining(state.player.z, SEGMENT_LENGTH);

  let x = 0;
  let dx = -(state.segments[baseSegment].curve * basePercent);
  let maxY = height;

  const cameraX = state.player.x * ROAD_WIDTH;
  const cameraY = CAMERA_HEIGHT + findSegment(state.player.z).p2.world.y;
  const cameraZ = state.player.z;

  for (let n = 0; n < DRAW_DISTANCE; n++) {
    const index = (baseSegment + n) % state.segments.length;
    const segment = state.segments[index];
    const looped = index < baseSegment;

    segment.p1.world.z = n * SEGMENT_LENGTH;
    segment.p2.world.z = (n + 1) * SEGMENT_LENGTH;

    const worldY1 = segment.p1.world.y;
    const worldY2 = segment.p2.world.y;

    segment.p1.world.x = x;
    segment.p2.world.x = x + dx;

    project(segment.p1, cameraX, cameraY, cameraZ - (looped ? state.trackLength : 0), cameraDepth, width, height, ROAD_WIDTH);
    project(segment.p2, cameraX, cameraY, cameraZ - (looped ? state.trackLength : 0), cameraDepth, width, height, ROAD_WIDTH);

    x += dx;
    dx += segment.curve;

    if (segment.p1.camera.z <= cameraDepth || segment.p2.screen.y >= maxY) continue;
    maxY = segment.p2.screen.y;

    const grass = (index % 2 === 0) ? map.groundA : map.groundB;
    const rumble = (index % 2 === 0) ? map.accent : "#ffffff";
    const road = (index % 2 === 0) ? map.roadA : map.roadB;

    ctx.fillStyle = grass;
    ctx.fillRect(0, segment.p2.screen.y, width, segment.p1.screen.y - segment.p2.screen.y + 1);

    drawQuad(segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w * 1.16, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w * 1.16, rumble);
    drawQuad(segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w, segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w, road);

    if (index % 3 === 0) {
      drawQuad(
        segment.p1.screen.x,
        segment.p1.screen.y,
        segment.p1.screen.w * 0.04,
        segment.p2.screen.x,
        segment.p2.screen.y,
        segment.p2.screen.w * 0.04,
        map.lane
      );
    }

    for (const pickup of segment.pickups) {
      if (pickup.taken) continue;
      const sx = segment.p2.screen.x + segment.p2.screen.w * pickup.lane;
      const sy = segment.p2.screen.y - 8;
      const size = Math.max(4, segment.p2.screen.w * 0.05);
      ctx.fillStyle = "#62ecff";
      ctx.fillRect(sx - size * 0.5, sy - size, size, size);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.strokeRect(sx - size * 0.5, sy - size, size, size);
    }
  }

  const racers = [{
    progress: (state.player.lap - 1) * state.trackLength + state.player.z,
    isPlayer: true,
  }];

  for (const bot of state.bots) {
    racers.push({ progress: (bot.lap - 1) * state.trackLength + bot.z, isPlayer: false, bot });

    let dz = bot.z - state.player.z;
    if (dz < -state.trackLength * 0.5) dz += state.trackLength;
    if (dz > state.trackLength * 0.5) dz -= state.trackLength;
    if (dz < 50 || dz > 3500) continue;

    const rel = dz / (SEGMENT_LENGTH * DRAW_DISTANCE);
    const scale = Math.max(0.2, 1 - rel * 1.8);
    const sx = width * 0.5 + bot.x * width * 0.28 * scale;
    const sy = height * (0.85 - rel * 0.72);
    const w = Math.max(14, width * 0.032 * scale);
    const h = w * 0.58;
    ctx.fillStyle = bot.color;
    ctx.fillRect(sx - w * 0.5, sy - h * 0.5, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx - w * 0.18, sy - h * 0.56, w * 0.36, h * 0.18);
  }

  racers.sort((a, b) => b.progress - a.progress);
  const pos = racers.findIndex((r) => r.isPlayer) + 1;

  drawPlayerCar();

  lapEl.textContent = `LAP ${Math.min(state.player.lap, LAPS_TOTAL)} / ${LAPS_TOTAL}`;
  speedEl.textContent = `SPEED ${Math.round((state.player.speed / MAX_SPEED) * 320).toString().padStart(3, "0")}`;
  rankEl.textContent = `POS ${pos} / ${state.totalRacers}`;
  burstFillEl.style.width = `${Math.min(100, state.player.burst * 100)}%`;

  if (window.innerWidth < window.innerHeight * 1.15) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.font = "700 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("横画面でプレイしてね", width * 0.5, height * 0.5);
  }
}

function animate(t) {
  const dt = Math.min(0.05, (t - state.lastTime) / 1000);
  state.lastTime = t;
  update(dt);
  drawWorld();
  requestAnimationFrame(animate);
}

function bindButton(btn, key) {
  const down = (e) => {
    e.preventDefault();
    state.input[key] = true;
    btn.classList.add("active");
  };
  const up = (e) => {
    e.preventDefault();
    state.input[key] = false;
    btn.classList.remove("active");
  };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointerleave", up);
  btn.addEventListener("pointercancel", up);
}

bindButton(leftBtn, "left");
bindButton(rightBtn, "right");
bindButton(driftBtn, "drift");

window.addEventListener("keydown", (e) => {
  const key = KEY[e.key];
  if (!key) return;
  e.preventDefault();
  state.input[key] = true;
});
window.addEventListener("keyup", (e) => {
  const key = KEY[e.key];
  if (!key) return;
  e.preventDefault();
  state.input[key] = false;
});

mapSelect.addEventListener("change", () => {
  buildTrack(mapSelect.value);
  resetRace();
});
botCountEl.addEventListener("change", resetRace);
restartBtn.addEventListener("click", resetRace);

buildTrack(state.mapKey);
resetRace();
requestAnimationFrame(animate);
