const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

const hudTime = document.getElementById("time");
const hudLap = document.getElementById("lap");
const goalBanner = document.getElementById("goalBanner");
const soundToggle = document.getElementById("soundToggle");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const driftBtn = document.getElementById("driftBtn");

const TAU = Math.PI * 2;
const TRACK = {
  a: 270,
  b: 170,
  width: 96,
  startAngle: -Math.PI / 2,
};

const state = {
  input: { left: false, right: false, drift: false, pointerX: 0.5, pointerActive: false },
  physics: {
    angle: TRACK.startAngle,
    speed: 160,
    steerVel: 0,
    lateral: 0,
    drifting: false,
    boost: 0,
    lap: 0,
    lapDone: false,
    raceDone: false,
    startTime: performance.now(),
    finishTime: 0,
  },
  soundOn: false,
};

let view = { w: 1, h: 1, dpr: 1 };

class Sfx {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  beep(freq = 440, duration = 0.07, gainAmount = 0.04, type = "square") {
    if (!state.soundOn) return;
    this.ensure();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainAmount, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
}

const sfx = new Sfx();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normAngle(angle) {
  let v = angle % TAU;
  if (v < 0) v += TAU;
  return v;
}

function resetCanvasSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(window.innerWidth));
  const h = Math.max(1, Math.floor(window.innerHeight));
  view = { w, h, dpr };
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function bindHold(button, key) {
  const down = (ev) => {
    ev.preventDefault();
    state.input[key] = true;
    button.classList.add("active");
    if (key === "drift") sfx.beep(500, 0.04, 0.03, "triangle");
  };
  const up = (ev) => {
    ev.preventDefault();
    state.input[key] = false;
    button.classList.remove("active");
  };
  button.addEventListener("pointerdown", down, { passive: false });
  button.addEventListener("pointerup", up, { passive: false });
  button.addEventListener("pointercancel", up, { passive: false });
  button.addEventListener("pointerleave", up, { passive: false });
}

bindHold(leftBtn, "left");
bindHold(rightBtn, "right");
bindHold(driftBtn, "drift");

canvas.addEventListener(
  "pointerdown",
  (ev) => {
    state.input.pointerActive = true;
    state.input.pointerX = ev.clientX / Math.max(1, view.w);
  },
  { passive: true }
);
canvas.addEventListener(
  "pointermove",
  (ev) => {
    if (!state.input.pointerActive) return;
    state.input.pointerX = ev.clientX / Math.max(1, view.w);
  },
  { passive: true }
);
const cancelPointer = () => {
  state.input.pointerActive = false;
  state.input.pointerX = 0.5;
};
canvas.addEventListener("pointerup", cancelPointer);
canvas.addEventListener("pointercancel", cancelPointer);

soundToggle.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  soundToggle.textContent = state.soundOn ? "SOUND: ON" : "SOUND: OFF";
  soundToggle.setAttribute("aria-pressed", String(state.soundOn));
  if (state.soundOn) {
    sfx.beep(660, 0.06, 0.05, "sine");
  }
});

window.addEventListener("resize", resetCanvasSize);
resetCanvasSize();

let prev = performance.now();
let prevDrift = false;

function updateInputMix() {
  let steer = 0;
  if (state.input.left) steer -= 1;
  if (state.input.right) steer += 1;
  if (state.input.pointerActive && state.input.pointerX < 0.38) steer -= 1;
  if (state.input.pointerActive && state.input.pointerX > 0.62) steer += 1;
  return clamp(steer, -1, 1);
}

function updatePhysics(dt) {
  const p = state.physics;
  if (p.raceDone) return;

  const steerInput = updateInputMix();
  const driftActive = state.input.drift && steerInput !== 0;
  p.drifting = driftActive;

  const steerPower = driftActive ? 3.9 : 2.35;
  p.steerVel += steerInput * steerPower * dt;
  p.steerVel *= driftActive ? 0.92 : 0.86;
  p.steerVel = clamp(p.steerVel, -1.5, 1.5);

  const baseSpeed = 168;
  const speedLoss = Math.abs(p.lateral) * 0.06;
  const driftPenalty = driftActive ? 24 : 0;
  p.speed += (baseSpeed - p.speed - speedLoss - driftPenalty) * dt * 1.4;
  p.speed += p.boost * dt;
  p.boost *= Math.exp(-5.2 * dt);

  const tangentLen = Math.hypot(TRACK.a * Math.sin(p.angle), TRACK.b * Math.cos(p.angle));
  const turnScale = 1 / Math.max(70, tangentLen);
  p.angle += p.speed * turnScale * dt;

  p.lateral += p.steerVel * (driftActive ? 40 : 22) * dt;
  const wall = TRACK.width * 0.5;
  if (Math.abs(p.lateral) > wall) {
    p.lateral = Math.sign(p.lateral) * wall;
    p.speed *= 0.84;
    p.steerVel *= 0.4;
  }
  if (Math.abs(p.lateral) > wall * 0.72) {
    p.speed *= 0.988;
  }
  p.lateral *= driftActive ? 0.998 : 0.976;

  const a = normAngle(p.angle);
  const start = normAngle(TRACK.startAngle);
  const nearStart = Math.abs(a - start) < 0.08 || Math.abs(a - start) > TAU - 0.08;
  if (!p.lapDone && nearStart && performance.now() - p.startTime > 1800) {
    p.lap = 1;
    p.lapDone = true;
    p.raceDone = true;
    p.finishTime = performance.now();
    goalBanner.hidden = false;
    sfx.beep(880, 0.11, 0.06, "triangle");
    sfx.beep(1175, 0.13, 0.05, "square");
  }

  if (!prevDrift && driftActive) {
    sfx.beep(520, 0.05, 0.03, "sawtooth");
  }
  if (prevDrift && !driftActive) {
    p.boost += 96;
    sfx.beep(980, 0.08, 0.05, "square");
  }
  prevDrift = driftActive;
}

function drawBackground() {
  const { w, h } = view;
  const horizon = h * 0.38;

  ctx.fillStyle = "#7bc9ff";
  ctx.fillRect(0, 0, w, horizon);

  ctx.fillStyle = "#9be6ff";
  ctx.fillRect(0, horizon - 32, w, 36);

  ctx.fillStyle = "#5ea2db";
  ctx.fillRect(0, horizon + 2, w, 14);

  ctx.fillStyle = "#2f8d46";
  ctx.fillRect(0, horizon + 16, w, h - horizon);
}

function drawRoad() {
  const { w, h } = view;
  const horizon = h * 0.38;
  const p = state.physics;

  for (let y = Math.floor(horizon); y < h; y += 2) {
    const depth = (y - horizon) / Math.max(1, h - horizon);
    const perspective = 1 / (depth * 3.8 + 0.06);
    const roadHalf = clamp(34 * perspective, 14, w * 0.46);
    const grassHalf = clamp(56 * perspective, 20, w * 0.5);

    const curve = Math.sin(p.angle * 1.8 + depth * 4.4) * 48 * (1 - depth);
    const slip = (-p.lateral / (TRACK.width * 0.5)) * roadHalf * 0.82;
    const cx = w * 0.5 + curve + slip;

    const stripe = (Math.floor((p.angle * 480 + depth * 900) / 90) & 1) === 0;
    ctx.fillStyle = stripe ? "#6ba04a" : "#4f8338";
    ctx.fillRect(cx - grassHalf, y, grassHalf * 2, 2);

    ctx.fillStyle = "#6e6f78";
    ctx.fillRect(cx - roadHalf, y, roadHalf * 2, 2);

    const edgeColor = (Math.floor((p.angle * 520 + depth * 1100) / 70) & 1) === 0 ? "#f8f8f8" : "#da2d2d";
    ctx.fillStyle = edgeColor;
    ctx.fillRect(cx - roadHalf - 4, y, 4, 2);
    ctx.fillRect(cx + roadHalf, y, 4, 2);

    if (y > h * 0.73) {
      ctx.fillStyle = "#f6c24a";
      ctx.fillRect(w * 0.5 - 2, y, 4, 2);
    }
  }
}

function drawKart() {
  const { w, h } = view;
  const p = state.physics;
  const x = w * 0.5 + clamp((-p.lateral / (TRACK.width * 0.5)) * 70, -80, 80);
  const y = h * 0.83;
  const tilt = p.steerVel * 0.25;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  ctx.fillStyle = p.drifting ? "#6ed9ff" : "#ff5757";
  ctx.fillRect(-22, -18, 44, 26);
  ctx.fillStyle = "#111";
  ctx.fillRect(-24, -16, 10, 8);
  ctx.fillRect(14, -16, 10, 8);
  ctx.fillRect(-24, 6, 10, 8);
  ctx.fillRect(14, 6, 10, 8);
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(-10, -12, 20, 8);

  if (p.boost > 2) {
    ctx.fillStyle = "rgba(255, 233, 120, 0.85)";
    ctx.fillRect(-6, 11, 12, 8 + p.boost * 0.06);
  }

  ctx.restore();
}

function updateUi() {
  const p = state.physics;
  const timeMs = p.raceDone ? p.finishTime - p.startTime : performance.now() - p.startTime;
  hudTime.textContent = `TIME ${(timeMs / 1000).toFixed(2).padStart(5, "0")}`;
  hudLap.textContent = `LAP ${p.lap} / 1`;
}

function frame(now) {
  const dt = Math.min(0.033, (now - prev) / 1000);
  prev = now;

  updatePhysics(dt);
  drawBackground();
  drawRoad();
  drawKart();
  updateUi();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
