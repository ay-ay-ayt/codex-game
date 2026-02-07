const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthEl = document.getElementById("health");
const enemiesEl = document.getElementById("enemies");
const scoreEl = document.getElementById("score");
const botCountEl = document.getElementById("botCount");
const restartBtn = document.getElementById("restartBtn");
const messageEl = document.getElementById("message");
const radarEl = document.getElementById("radar");

const WORLD_RADIUS = 2200;
const keys = new Set();
const pointers = { x: 0, y: 0 };

let w = innerWidth;
let h = innerHeight;
let dpr = Math.min(devicePixelRatio || 1, 2);

const game = {
  player: null,
  bots: [],
  bullets: [],
  particles: [],
  clouds: [],
  score: 0,
  over: false,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function wrapWorld(e) {
  if (e.x > WORLD_RADIUS) e.x = -WORLD_RADIUS;
  if (e.x < -WORLD_RADIUS) e.x = WORLD_RADIUS;
  if (e.y > WORLD_RADIUS) e.y = -WORLD_RADIUS;
  if (e.y < -WORLD_RADIUS) e.y = WORLD_RADIUS;
}

function resize() {
  w = innerWidth;
  h = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createPlane(type, x, y, color) {
  return {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: rand(-Math.PI, Math.PI),
    speed: type === "player" ? 260 : rand(220, 260),
    throttle: type === "player" ? 0.7 : rand(0.55, 0.9),
    hp: 100,
    fireCd: rand(0, 0.35),
    size: type === "player" ? 18 : 15,
    color,
    alive: true,
    evadeTimer: rand(0.2, 1.2),
    target: null,
  };
}

function spawnExplosion(x, y, color = "#ff944d", amount = 28) {
  for (let i = 0; i < amount; i++) {
    game.particles.push({
      x,
      y,
      vx: Math.cos((Math.PI * 2 * i) / amount + rand(-0.2, 0.2)) * rand(80, 240),
      vy: Math.sin((Math.PI * 2 * i) / amount + rand(-0.2, 0.2)) * rand(80, 240),
      life: rand(0.4, 0.85),
      maxLife: 0,
      color,
      size: rand(1.5, 3.6),
    });
    game.particles[game.particles.length - 1].maxLife = game.particles[game.particles.length - 1].life;
  }
}

function spawnClouds() {
  game.clouds.length = 0;
  for (let i = 0; i < 42; i++) {
    game.clouds.push({
      x: rand(-WORLD_RADIUS, WORLD_RADIUS),
      y: rand(-WORLD_RADIUS, WORLD_RADIUS),
      r: rand(40, 160),
      alpha: rand(0.04, 0.13),
    });
  }
}

function spawnMatch() {
  game.score = 0;
  game.over = false;
  messageEl.hidden = true;
  game.bullets.length = 0;
  game.particles.length = 0;
  game.player = createPlane("player", 0, 0, "#7ef1ff");
  game.player.speed = 280;

  const count = Number(botCountEl.value);
  game.bots = Array.from({ length: count }, (_, i) => {
    const p = createPlane("bot", rand(-1100, 1100), rand(-1100, 1100), ["#ff5f66", "#ffc15b", "#c87fff"][i]);
    p.angle = angleTo(p, game.player);
    return p;
  });

  spawnClouds();
  updateHud();
}

function fireBullet(shooter, power = 1) {
  if (!shooter.alive) return;
  const muzzle = shooter.size + 8;
  game.bullets.push({
    x: shooter.x + Math.cos(shooter.angle) * muzzle,
    y: shooter.y + Math.sin(shooter.angle) * muzzle,
    vx: Math.cos(shooter.angle) * (680 + shooter.speed * 0.3),
    vy: Math.sin(shooter.angle) * (680 + shooter.speed * 0.3),
    life: 1.2,
    damage: 17 * power,
    team: shooter.type,
  });
}

function damagePlane(plane, amount) {
  plane.hp -= amount;
  spawnExplosion(plane.x, plane.y, amount > 20 ? "#ffe47e" : "#8ce4ff", 10);
  if (plane.hp <= 0 && plane.alive) {
    plane.alive = false;
    spawnExplosion(plane.x, plane.y, "#ff945b", 34);
    if (plane.type === "bot") {
      game.score += 100;
    }
  }
}

function steerTo(currentAngle, targetAngle, maxTurn) {
  let delta = targetAngle - currentAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return currentAngle + clamp(delta, -maxTurn, maxTurn);
}

function updatePlayer(dt) {
  const p = game.player;
  if (!p.alive || game.over) return;

  const turnInput = (keys.has("ArrowLeft") || keys.has("KeyA") ? -1 : 0) + (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0);
  p.angle += turnInput * dt * 2.4;

  const throttleInput = (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0) + (keys.has("ArrowDown") || keys.has("KeyS") ? -1 : 0);
  p.throttle = clamp(p.throttle + throttleInput * dt * 0.85, 0.35, 1.1);

  p.speed = 170 + p.throttle * 240;
  p.vx = Math.cos(p.angle) * p.speed;
  p.vy = Math.sin(p.angle) * p.speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  wrapWorld(p);

  p.fireCd -= dt;
  if ((keys.has("Space") || pointers.down) && p.fireCd <= 0) {
    fireBullet(p, 1);
    p.fireCd = 0.12;
  }
}

function updateBots(dt) {
  const player = game.player;
  for (const bot of game.bots) {
    if (!bot.alive) continue;

    bot.target = player.alive ? player : game.bots.find((b) => b !== bot && b.alive);
    if (!bot.target) continue;

    const targetAng = angleTo(bot, bot.target);
    const d = Math.sqrt(dist2(bot, bot.target));

    bot.evadeTimer -= dt;
    let desired = targetAng;
    if (d < 240 || bot.evadeTimer < 0) {
      bot.evadeTimer = rand(0.4, 1.2);
      desired += rand(-0.8, 0.8);
    }
    bot.angle = steerTo(bot.angle, desired, dt * (1.9 + (1 / clamp(d / 480, 1, 4))));
    bot.throttle = clamp(0.6 + (d > 520 ? 0.35 : 0.08), 0.55, 1.05);
    bot.speed = 150 + bot.throttle * 220;

    bot.vx = Math.cos(bot.angle) * bot.speed;
    bot.vy = Math.sin(bot.angle) * bot.speed;
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;
    wrapWorld(bot);

    bot.fireCd -= dt;
    const frontDot = Math.cos(targetAng - bot.angle);
    if (bot.fireCd <= 0 && d < 620 && frontDot > 0.9) {
      fireBullet(bot, 0.8 + Math.random() * 0.45);
      bot.fireCd = rand(0.24, 0.45);
    }
  }
}

function updateBullets(dt) {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (Math.abs(b.x) > WORLD_RADIUS + 200 || Math.abs(b.y) > WORLD_RADIUS + 200 || b.life <= 0) {
      game.bullets.splice(i, 1);
      continue;
    }

    const targets = b.team === "player" ? game.bots : [game.player];
    for (const t of targets) {
      if (!t.alive) continue;
      if (dist2(b, t) < (t.size + 5) ** 2) {
        damagePlane(t, b.damage);
        game.bullets.splice(i, 1);
        break;
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
}

function updateState() {
  const enemies = game.bots.filter((b) => b.alive).length;
  if (!game.player.alive && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "MISSION FAILED";
  } else if (enemies === 0 && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "MISSION COMPLETE";
    game.score += 600;
  }
}

function worldToScreen(obj) {
  const cameraX = game.player.x;
  const cameraY = game.player.y;
  return {
    x: (obj.x - cameraX) + w * 0.5,
    y: (obj.y - cameraY) + h * 0.5,
  };
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#73caff");
  grad.addColorStop(0.52, "#2c73c9");
  grad.addColorStop(1, "#03142b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (const cloud of game.clouds) {
    const s = worldToScreen(cloud);
    const r = cloud.r;
    if (s.x < -r || s.x > w + r || s.y < -r || s.y > h + r) continue;
    const c = ctx.createRadialGradient(s.x, s.y, r * 0.1, s.x, s.y, r);
    c.addColorStop(0, `rgba(255,255,255,${cloud.alpha})`);
    c.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawJet(plane) {
  const s = worldToScreen(plane);
  if (s.x < -80 || s.x > w + 80 || s.y < -80 || s.y > h + 80) return;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(plane.angle);

  ctx.shadowColor = plane.type === "player" ? "rgba(80,255,255,0.7)" : "rgba(255,140,120,0.65)";
  ctx.shadowBlur = 13;
  ctx.fillStyle = plane.color;
  ctx.beginPath();
  ctx.moveTo(plane.size + 7, 0);
  ctx.lineTo(-plane.size * 0.75, -plane.size * 0.55);
  ctx.lineTo(-plane.size * 0.35, 0);
  ctx.lineTo(-plane.size * 0.75, plane.size * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(-plane.size * 0.34, -2, plane.size * 0.9, 4);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(-plane.size * 0.8, -1, plane.size * 0.35, 2);

  const flame = clamp((plane.speed - 140) / 340, 0, 1);
  const flameLen = 8 + flame * 16;
  const fx = -plane.size * 0.8;
  const g = ctx.createLinearGradient(fx, 0, fx - flameLen, 0);
  g.addColorStop(0, "rgba(255, 220, 130, 0.75)");
  g.addColorStop(1, "rgba(85, 210, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(fx - flameLen, -2.8, flameLen, 5.6);

  ctx.restore();

  if (plane.type !== "player") {
    const barW = 28;
    const hpRatio = clamp(plane.hp / 100, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(s.x - barW * 0.5, s.y - 26, barW, 4);
    ctx.fillStyle = hpRatio > 0.45 ? "#66f7a0" : "#ff796d";
    ctx.fillRect(s.x - barW * 0.5, s.y - 26, barW * hpRatio, 4);
  }
}

function drawBullets() {
  for (const b of game.bullets) {
    const s = worldToScreen(b);
    if (s.x < -20 || s.x > w + 20 || s.y < -20 || s.y > h + 20) continue;
    ctx.fillStyle = b.team === "player" ? "#95f7ff" : "#ffb173";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawParticles() {
  for (const p of game.particles) {
    const s = worldToScreen(p);
    if (s.x < -40 || s.x > w + 40 || s.y < -40 || s.y > h + 40) continue;
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size * (0.4 + a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawReticle() {
  const x = w * 0.5;
  const y = h * 0.5;
  ctx.strokeStyle = "rgba(180,236,255,0.76)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.moveTo(x - 32, y);
  ctx.lineTo(x - 12, y);
  ctx.moveTo(x + 12, y);
  ctx.lineTo(x + 32, y);
  ctx.moveTo(x, y - 32);
  ctx.lineTo(x, y - 12);
  ctx.moveTo(x, y + 12);
  ctx.lineTo(x, y + 32);
  ctx.stroke();
}

function updateRadar() {
  radarEl.querySelectorAll(".dot").forEach((n) => n.remove());
  const entities = [game.player, ...game.bots.filter((b) => b.alive)];
  for (const e of entities) {
    const dx = clamp((e.x - game.player.x) / 700, -1, 1);
    const dy = clamp((e.y - game.player.y) / 700, -1, 1);
    const dot = document.createElement("div");
    dot.className = `dot ${e === game.player ? "player" : "enemy"}`;
    dot.style.left = `${(dx * 0.45 + 0.5) * 100}%`;
    dot.style.top = `${(dy * 0.45 + 0.5) * 100}%`;
    radarEl.appendChild(dot);
  }
}

function updateHud() {
  const enemies = game.bots.filter((b) => b.alive).length;
  healthEl.textContent = `HP ${Math.max(0, Math.round(game.player.hp))}`;
  enemiesEl.textContent = `ENEMY ${enemies}`;
  scoreEl.textContent = `SCORE ${game.score}`;
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  updatePlayer(dt);
  updateBots(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateState();

  drawSky();
  drawBullets();
  for (const bot of game.bots) if (bot.alive) drawJet(bot);
  if (game.player.alive) drawJet(game.player);
  drawParticles();
  drawReticle();

  updateHud();
  updateRadar();
  requestAnimationFrame(tick);
}

addEventListener("resize", resize);
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space") e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.code));

canvas.addEventListener("pointerdown", () => {
  pointers.down = true;
});
canvas.addEventListener("pointerup", () => {
  pointers.down = false;
});
canvas.addEventListener("pointermove", (e) => {
  pointers.x = e.clientX;
  pointers.y = e.clientY;
});

restartBtn.addEventListener("click", spawnMatch);
botCountEl.addEventListener("change", spawnMatch);

resize();
spawnMatch();
requestAnimationFrame(tick);
