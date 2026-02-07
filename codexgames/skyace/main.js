import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const healthEl = document.getElementById("health");
const enemiesEl = document.getElementById("enemies");
const scoreEl = document.getElementById("score");
const botCountEl = document.getElementById("botCount");
const restartBtn = document.getElementById("restartBtn");
const messageEl = document.getElementById("message");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x78b6ff, 600, 3600);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 8000);

scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x5e8060, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.12);
sun.position.set(600, 900, 300);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const keys = new Set();
const input = { yaw: 0, pitch: 0, throttle: 0, boost: false, fire: false };

const game = {
  player: null,
  bots: [],
  bullets: [],
  score: 0,
  over: false,
};

const ARENA = 1800;
const FLOOR_Y = 40;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }

function buildSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(6000, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x80c4ff, side: THREE.BackSide })
  );
  world.add(sky);

  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.56 });
  for (let i = 0; i < 90; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(rand(30, 90), 16, 12), cloudMat);
    cloud.scale.set(rand(1.2, 2.7), rand(0.45, 0.9), rand(1.2, 2.7));
    cloud.position.set(rand(-ARENA, ARENA), rand(120, 620), rand(-ARENA, ARENA));
    world.add(cloud);
  }

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 3, ARENA * 3, 120, 120),
    new THREE.MeshStandardMaterial({ color: 0x3d6f45, roughness: 0.98, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  world.add(floor);

  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x65756d, roughness: 1 });
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(rand(40, 120), rand(100, 300), 6), mountainMat);
    m.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(30, 80), rand(-ARENA * 1.2, ARENA * 1.2));
    m.castShadow = true;
    m.receiveShadow = true;
    world.add(m);
  }
}

function createJet(color, isPlayer = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 40, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5 }));
  body.rotation.z = Math.PI * 0.5;
  body.castShadow = true;

  const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 1.6, 9), new THREE.MeshStandardMaterial({ color: 0xe7f6ff, roughness: 0.4, metalness: 0.5 }));
  wing.position.set(0, 0, 0);
  wing.castShadow = true;

  const tail = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 1.8), new THREE.MeshStandardMaterial({ color: 0xd2edff, roughness: 0.4, metalness: 0.3 }));
  tail.position.set(-16, 4, 0);
  tail.castShadow = true;

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(4.3, 14, 12), new THREE.MeshStandardMaterial({ color: 0x9ee6ff, transparent: true, opacity: 0.8, roughness: 0.2, metalness: 0.5 }));
  canopy.scale.set(1.1, 0.65, 0.8);
  canopy.position.set(6, 2.6, 0);

  const engineGlow = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), new THREE.MeshBasicMaterial({ color: isPlayer ? 0x66eaff : 0xff994d }));
  engineGlow.position.set(-21, 0, 0);

  g.add(body, wing, tail, canopy, engineGlow);
  g.position.set(0, 280, 0);
  world.add(g);

  return {
    mesh: g,
    velocity: new THREE.Vector3(220, 0, 0),
    hp: 100,
    alive: true,
    cooldown: 0,
    speed: 220,
    boost: 0,
    turnRate: isPlayer ? 1.65 : 1.25,
    pitchRate: isPlayer ? 1.28 : 1.0,
    target: null,
  };
}

function spawnBullet(owner, color) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), new THREE.MeshBasicMaterial({ color }));
  const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  b.position.copy(owner.mesh.position).addScaledVector(dir, 28);
  b.userData = {
    vel: dir.multiplyScalar(760).add(owner.velocity.clone().multiplyScalar(0.35)),
    life: 2,
    team: owner === game.player ? "player" : "bot",
  };
  world.add(b);
  game.bullets.push(b);
}

function wrapOrBounce(plane) {
  const p = plane.mesh.position;
  if (Math.abs(p.x) > ARENA) p.x = -Math.sign(p.x) * ARENA;
  if (Math.abs(p.z) > ARENA) p.z = -Math.sign(p.z) * ARENA;
  p.y = clamp(p.y, FLOOR_Y + 90, 900);
}

function updatePlayer(dt) {
  const p = game.player;
  if (!p.alive || game.over) return;

  p.cooldown -= dt;
  p.boost = input.boost ? 1 : 0;

  p.speed = clamp(p.speed + input.throttle * dt * 190, 140, 520);
  const yaw = input.yaw * p.turnRate * dt;
  const pitch = input.pitch * p.pitchRate * dt;

  p.mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -yaw);
  p.mesh.rotateX(-pitch);

  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(p.mesh.quaternion).normalize();
  const targetSpeed = p.speed + p.boost * 220;
  const desiredVel = forward.multiplyScalar(targetSpeed);
  p.velocity.lerp(desiredVel, 0.08);
  p.mesh.position.addScaledVector(p.velocity, dt);

  if (p.mesh.position.y < FLOOR_Y + 95) {
    p.mesh.position.y = FLOOR_Y + 95;
    p.velocity.y = Math.abs(p.velocity.y) * 0.35;
  }

  wrapOrBounce(p);

  if (input.fire && p.cooldown <= 0) {
    spawnBullet(p, 0x90ecff);
    p.cooldown = 0.09;
  }
}

function updateBots(dt) {
  const player = game.player;
  for (const b of game.bots) {
    if (!b.alive) continue;
    if (!player.alive) {
      b.target = game.bots.find((x) => x !== b && x.alive) || null;
    } else {
      b.target = player;
    }
    if (!b.target) continue;

    b.cooldown -= dt;
    const toTarget = b.target.mesh.position.clone().sub(b.mesh.position);
    const distance = toTarget.length();
    const desired = toTarget.normalize();
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(b.mesh.quaternion).normalize();

    const yawErr = forward.clone().cross(desired).y;
    const pitchErr = clamp(desired.y - forward.y, -1, 1);

    b.mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -yawErr * b.turnRate * dt);
    b.mesh.rotateX(-pitchErr * b.pitchRate * dt);

    const speedTarget = clamp(180 + (distance > 500 ? 130 : 40), 170, 380);
    b.speed = THREE.MathUtils.lerp(b.speed, speedTarget, 0.04);
    const newForward = new THREE.Vector3(1, 0, 0).applyQuaternion(b.mesh.quaternion).normalize();
    const desiredVel = newForward.multiplyScalar(b.speed);
    b.velocity.lerp(desiredVel, 0.07);
    b.mesh.position.addScaledVector(b.velocity, dt);

    if (b.mesh.position.y < FLOOR_Y + 100) b.mesh.position.y += 120 * dt;
    wrapOrBounce(b);

    const aimDot = newForward.dot(toTarget.normalize());
    if (distance < 720 && aimDot > 0.94 && b.cooldown <= 0) {
      spawnBullet(b, 0xffae72);
      b.cooldown = rand(0.15, 0.3);
    }
  }
}

function hitPlane(plane, dmg) {
  if (!plane.alive) return;
  plane.hp -= dmg;
  if (plane.hp <= 0) {
    plane.alive = false;
    plane.mesh.visible = false;
    if (plane !== game.player) game.score += 100;
  }
}

function updateBullets(dt) {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.position.addScaledVector(b.userData.vel, dt);
    b.userData.life -= dt;

    const targets = b.userData.team === "player" ? game.bots : [game.player];
    for (const t of targets) {
      if (!t || !t.alive) continue;
      if (b.position.distanceToSquared(t.mesh.position) < 19 * 19) {
        hitPlane(t, rand(18, 30));
        b.userData.life = -1;
        break;
      }
    }

    if (b.userData.life <= 0 || Math.abs(b.position.x) > ARENA * 1.3 || Math.abs(b.position.z) > ARENA * 1.3 || b.position.y < FLOOR_Y - 20 || b.position.y > 1300) {
      world.remove(b);
      game.bullets.splice(i, 1);
    }
  }
}

function updateCamera(dt) {
  const p = game.player;
  if (!p) return;
  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(p.mesh.quaternion).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(p.mesh.quaternion).normalize();

  const camPos = p.mesh.position.clone().addScaledVector(forward, -80).addScaledVector(up, 30);
  camera.position.lerp(camPos, 1 - Math.exp(-dt * 8));
  const lookAt = p.mesh.position.clone().addScaledVector(forward, 200);
  camera.lookAt(lookAt);
}

function updateState() {
  const aliveEnemies = game.bots.filter((b) => b.alive).length;
  healthEl.textContent = `HP ${Math.max(0, Math.round(game.player.hp))}`;
  enemiesEl.textContent = `ENEMY ${aliveEnemies}`;
  scoreEl.textContent = `SCORE ${game.score}`;

  if (!game.player.alive && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "MISSION FAILED";
  }
  if (aliveEnemies === 0 && !game.over) {
    game.over = true;
    game.score += 500;
    scoreEl.textContent = `SCORE ${game.score}`;
    messageEl.hidden = false;
    messageEl.textContent = "MISSION COMPLETE";
  }
}

function resetMatch() {
  for (const b of game.bullets) world.remove(b);
  game.bullets = [];
  if (game.player) world.remove(game.player.mesh);
  for (const b of game.bots) world.remove(b.mesh);

  game.score = 0;
  game.over = false;
  messageEl.hidden = true;

  game.player = createJet(0x42d4ff, true);
  game.player.mesh.position.set(0, 320, 0);
  game.player.mesh.rotation.set(0, -Math.PI * 0.2, 0);

  const colors = [0xff625f, 0xffc261, 0xc992ff];
  const count = Number(botCountEl.value);
  game.bots = Array.from({ length: count }, (_, i) => {
    const bot = createJet(colors[i]);
    bot.mesh.position.set(rand(-1100, 1100), rand(220, 540), rand(-1100, 1100));
    bot.mesh.lookAt(game.player.mesh.position);
    return bot;
  });
}

function syncInput() {
  input.yaw = (keys.has("KeyA") ? -1 : 0) + (keys.has("KeyD") ? 1 : 0);
  input.pitch = (keys.has("KeyW") ? 1 : 0) + (keys.has("KeyS") ? -1 : 0);
  input.throttle = (keys.has("ArrowDown") ? -1 : 0) + (keys.has("ArrowUp") ? 1 : 0);
  input.boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
  input.fire = keys.has("Space");
}

function setupTouchButtons() {
  document.querySelectorAll("#controls button").forEach((btn) => {
    const key = btn.dataset.key;
    const on = (e) => {
      e.preventDefault();
      keys.add(key);
      btn.classList.add("active");
      syncInput();
    };
    const off = (e) => {
      e.preventDefault();
      keys.delete(key);
      btn.classList.remove("active");
      syncInput();
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", off);
  });
}

buildSky();
setupTouchButtons();

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  syncInput();
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  syncInput();
});

restartBtn.addEventListener("click", resetMatch);
botCountEl.addEventListener("change", resetMatch);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updatePlayer(dt);
  updateBots(dt);
  updateBullets(dt);
  updateCamera(dt);
  updateState();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

resetMatch();
requestAnimationFrame(tick);
