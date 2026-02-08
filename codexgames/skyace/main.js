import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const healthEl = document.getElementById("health");
const enemiesEl = document.getElementById("enemies");
const scoreEl = document.getElementById("score");
const botCountEl = document.getElementById("botCount");
const mapTypeEl = document.getElementById("mapType");
const restartBtn = document.getElementById("restartBtn");
const messageEl = document.getElementById("message");
const rotateHint = document.getElementById("rotateHint");
const fireBtn = document.getElementById("fireBtn");
const boostBtn = document.getElementById("boostBtn");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x6ea2df, 900, 7200);

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 8000);
scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x5e8060, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(700, 900, 300);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const ARENA = 3600;
const FLOOR_Y = 40;
const keys = new Set();

const stickInput = {
  roll: 0,
  pitch: 0,
  yaw: 0,
  throttle: 0,
};

const input = {
  roll: 0,
  pitch: 0,
  yaw: 0,
  throttle: 0,
  boost: false,
  fire: false,
};

const game = {
  player: null,
  bots: [],
  bullets: [],
  score: 0,
  over: false,
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function rand(a, b) {
  return a + Math.random() * (b - a);
}

function fitViewport() {
  const width = Math.max(1, window.visualViewport?.width || window.innerWidth);
  const height = Math.max(1, window.visualViewport?.height || window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function buildWorld(mapType) {
  world.clear();

  const isForest = mapType === "forest";
  scene.fog = isForest ? new THREE.Fog(0x86b78d, 650, 5200) : new THREE.Fog(0x6ea2df, 900, 7200);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(9000, 36, 26),
    new THREE.MeshBasicMaterial({ color: isForest ? 0x88c6a0 : 0x75a8e0, side: THREE.BackSide })
  );
  world.add(sky);

  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: isForest ? 0.42 : 0.5 });
  for (let i = 0; i < 140; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(rand(34, 110), 14, 12), cloudMat);
    c.scale.set(rand(1.2, 3.2), rand(0.4, 0.92), rand(1.2, 3.2));
    c.position.set(rand(-ARENA * 1.1, ARENA * 1.1), rand(180, 900), rand(-ARENA * 1.1, ARENA * 1.1));
    world.add(c);
  }

  if (isForest) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 3.2, ARENA * 3.2),
      new THREE.MeshStandardMaterial({ color: 0x49643f, roughness: 0.98, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y;
    ground.receiveShadow = true;
    world.add(ground);

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5d7f57, roughness: 0.95 });
    for (let i = 0; i < 75; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(rand(80, 240), 16, 12), hillMat);
      hill.scale.y = rand(0.22, 0.48);
      hill.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(8, 24), rand(-ARENA * 1.2, ARENA * 1.2));
      hill.receiveShadow = true;
      world.add(hill);
    }

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 });
    const leafPalette = [0x2f6f3b, 0x3e8048, 0x4f9259, 0x2d5d37];
    for (let i = 0; i < 1100; i++) {
      const px = rand(-ARENA * 1.2, ARENA * 1.2);
      const pz = rand(-ARENA * 1.2, ARENA * 1.2);
      if (Math.abs(px) < 180 && Math.abs(pz) < 180) continue;

      const h = rand(22, 44);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.8, h, 8), trunkMat);
      trunk.position.set(px, FLOOR_Y + h / 2, pz);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      world.add(trunk);

      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(rand(10, 22), rand(20, 36), 8),
        new THREE.MeshStandardMaterial({
          color: leafPalette[(Math.random() * leafPalette.length) | 0],
          roughness: 0.95,
        })
      );
      crown.position.set(px, FLOOR_Y + h + crown.geometry.parameters.height * 0.45, pz);
      crown.castShadow = true;
      crown.receiveShadow = true;
      world.add(crown);
    }
    return;
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 3.2, ARENA * 3.2),
    new THREE.MeshStandardMaterial({ color: 0x42464d, roughness: 0.98, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  world.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2d3137, roughness: 0.96 });
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xa8aeb6, roughness: 0.85 });
  for (let i = -8; i <= 8; i++) {
    const roadX = new THREE.Mesh(new THREE.BoxGeometry(ARENA * 2.7, 0.2, 42), roadMat);
    roadX.position.set(0, FLOOR_Y + 0.1, i * 430);
    roadX.receiveShadow = true;
    world.add(roadX);

    const roadZ = new THREE.Mesh(new THREE.BoxGeometry(42, 0.2, ARENA * 2.7), roadMat);
    roadZ.position.set(i * 430, FLOOR_Y + 0.1, 0);
    roadZ.receiveShadow = true;
    world.add(roadZ);

    const laneX = new THREE.Mesh(new THREE.BoxGeometry(ARENA * 2.7, 0.22, 4), laneMat);
    laneX.position.set(0, FLOOR_Y + 0.14, i * 430);
    world.add(laneX);

    const laneZ = new THREE.Mesh(new THREE.BoxGeometry(4, 0.22, ARENA * 2.7), laneMat);
    laneZ.position.set(i * 430, FLOOR_Y + 0.14, 0);
    world.add(laneZ);
  }

  const buildingPalette = [0x7f8b98, 0x8e97a5, 0x646f7d, 0x5a6370, 0x9ba4b4];
  for (let i = 0; i < 420; i++) {
    const px = rand(-ARENA * 1.15, ARENA * 1.15);
    const pz = rand(-ARENA * 1.15, ARENA * 1.15);
    if (Math.abs(px) < 260 && Math.abs(pz) < 260) continue;

    const w = rand(45, 135);
    const d = rand(45, 135);
    const h = rand(90, 520);
    const baseColor = buildingPalette[(Math.random() * buildingPalette.length) | 0];

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.78, metalness: 0.1 })
    );
    tower.position.set(px, FLOOR_Y + h / 2, pz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    world.add(tower);

    if (Math.random() > 0.55) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, rand(12, 28), d * 0.7),
        new THREE.MeshStandardMaterial({ color: 0xcad2dd, roughness: 0.65 })
      );
      roof.position.set(px, FLOOR_Y + h + roof.geometry.parameters.height / 2, pz);
      roof.castShadow = true;
      world.add(roof);
    }
  }
}

function createFighter(color, isPlayer = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.62 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd9e2ea, roughness: 0.32, metalness: 0.58 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a3744, roughness: 0.58, metalness: 0.35 });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(3.3, 24, 8, 18), bodyMat);
  fuselage.rotation.z = Math.PI * 0.5;
  fuselage.castShadow = true;

  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 11, 14), trimMat);
  nose.rotation.z = -Math.PI * 0.5;
  nose.position.x = 20.5;
  nose.castShadow = true;

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(2.7, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x9ae4ff, transparent: true, opacity: 0.78, roughness: 0.18, metalness: 0.45 })
  );
  cockpit.scale.set(1.8, 0.8, 0.72);
  cockpit.position.set(6.8, 2.65, 0);

  const wingGeom = new THREE.ExtrudeGeometry(
    new THREE.Shape([
      new THREE.Vector2(-1, 0),
      new THREE.Vector2(17, 1.2),
      new THREE.Vector2(8, 7.6),
      new THREE.Vector2(-4, 6),
    ]),
    { depth: 0.8, bevelEnabled: false }
  );

  const wingL = new THREE.Mesh(wingGeom, trimMat);
  wingL.rotation.set(0, Math.PI * 0.5, Math.PI);
  wingL.position.set(-1, -1.4, 7.1);
  wingL.castShadow = true;

  const wingR = wingL.clone();
  wingR.scale.z = -1;
  wingR.position.z = -7.1;

  const tailWingL = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.8, 2.8), trimMat);
  tailWingL.position.set(-12.5, 1.5, 4.6);
  const tailWingR = tailWingL.clone();
  tailWingR.position.z = -4.6;

  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(5.6, 6.8, 0.8), bodyMat);
  tailFin.position.set(-12.3, 5.2, 0);

  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.1, 1.4), darkMat);
  intakeL.position.set(8.5, 0.2, 3.1);
  const intakeR = intakeL.clone();
  intakeR.position.z = -3.1;

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.2, 3.2, 12), darkMat);
  exhaust.rotation.z = Math.PI * 0.5;
  exhaust.position.x = -17.6;

  const missileMat = new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.24, metalness: 0.2 });
  const missileL = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 9.5, 8), missileMat);
  missileL.rotation.z = Math.PI * 0.5;
  missileL.position.set(2, -2.2, 10.2);
  const missileR = missileL.clone();
  missileR.position.z = -10.2;

  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), new THREE.MeshBasicMaterial({ color: isPlayer ? 0x67eaff : 0xff9b5a }));
  glow.position.x = -19.2;

  g.add(
    fuselage,
    nose,
    cockpit,
    wingL,
    wingR,
    tailWingL,
    tailWingR,
    tailFin,
    intakeL,
    intakeR,
    exhaust,
    missileL,
    missileR,
    glow
  );
  g.position.set(0, 300, 0);
  world.add(g);

  return {
    mesh: g,
    velocity: new THREE.Vector3(200, 0, 0),
    hp: 100,
    alive: true,
    cooldown: 0,
    speed: 220,
    target: null,
    isPlayer,
  };
}

function spawnBullet(owner, color) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), new THREE.MeshBasicMaterial({ color }));
  const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  b.position.copy(owner.mesh.position).addScaledVector(dir, 28);
  b.userData = {
    vel: dir.multiplyScalar(780).add(owner.velocity.clone().multiplyScalar(0.4)),
    life: 1.9,
    team: owner === game.player ? "player" : "bot",
  };
  world.add(b);
  game.bullets.push(b);
}

function keepInArena(plane) {
  const p = plane.mesh.position;
  if (Math.abs(p.x) > ARENA) p.x = -Math.sign(p.x) * ARENA;
  if (Math.abs(p.z) > ARENA) p.z = -Math.sign(p.z) * ARENA;
  p.y = clamp(p.y, FLOOR_Y + 90, 980);
}

function updatePlayer(dt) {
  const p = game.player;
  if (!p.alive || game.over) return;

  p.cooldown -= dt;
  p.speed = clamp(p.speed + input.throttle * dt * 170, 150, 560);

  const rollAmt = input.roll * dt * 1.8;
  const pitchAmt = input.pitch * dt * 1.2;
  const yawAmt = input.yaw * dt * 1.35;

  p.mesh.rotateX(-pitchAmt);
  p.mesh.rotateY(-yawAmt);
  p.mesh.rotateZ(-rollAmt);

  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(p.mesh.quaternion).normalize();
  const targetSpeed = p.speed + (input.boost ? 200 : 0);
  const desiredVel = forward.multiplyScalar(targetSpeed);
  p.velocity.lerp(desiredVel, 0.08);
  p.mesh.position.addScaledVector(p.velocity, dt);

  if (p.mesh.position.y < FLOOR_Y + 92) {
    p.mesh.position.y = FLOOR_Y + 92;
    p.velocity.y = Math.abs(p.velocity.y) * 0.2;
  }

  keepInArena(p);

  if (input.fire && p.cooldown <= 0) {
    spawnBullet(p, 0x95efff);
    p.cooldown = 0.085;
  }
}

function updateBots(dt) {
  const player = game.player;
  for (const b of game.bots) {
    if (!b.alive) continue;

    b.cooldown -= dt;
    b.target = player.alive ? player : game.bots.find((x) => x !== b && x.alive) || null;
    if (!b.target) continue;

    const to = b.target.mesh.position.clone().sub(b.mesh.position);
    const dist = to.length();
    const desired = to.normalize();
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(b.mesh.quaternion).normalize();

    const yawErr = forward.clone().cross(desired).y;
    const pitchErr = clamp(desired.y - forward.y, -1, 1);
    const rollErr = clamp(-yawErr * 1.4, -1, 1);

    b.mesh.rotateY(-yawErr * dt * 1.08);
    b.mesh.rotateX(-pitchErr * dt * 0.86);
    b.mesh.rotateZ(-rollErr * dt * 1.22);

    const speedTarget = clamp(185 + (dist > 540 ? 130 : 25), 170, 390);
    b.speed = THREE.MathUtils.lerp(b.speed, speedTarget, 0.05);
    const newForward = new THREE.Vector3(1, 0, 0).applyQuaternion(b.mesh.quaternion).normalize();
    b.velocity.lerp(newForward.multiplyScalar(b.speed), 0.08);
    b.mesh.position.addScaledVector(b.velocity, dt);

    if (b.mesh.position.y < FLOOR_Y + 102) b.mesh.position.y += 130 * dt;
    keepInArena(b);

    const aimDot = newForward.dot(to.normalize());
    if (dist < 780 && aimDot > 0.94 && b.cooldown <= 0) {
      spawnBullet(b, 0xffb67e);
      b.cooldown = rand(0.14, 0.28);
    }
  }
}

function hitPlane(plane, dmg) {
  if (!plane.alive) return;
  plane.hp -= dmg;
  if (plane.hp <= 0) {
    plane.alive = false;
    plane.mesh.visible = false;
    if (!plane.isPlayer) game.score += 100;
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
      if (b.position.distanceToSquared(t.mesh.position) < 18 * 18) {
        hitPlane(t, rand(16, 28));
        b.userData.life = -1;
        break;
      }
    }

    if (b.userData.life <= 0 || Math.abs(b.position.x) > ARENA * 1.3 || Math.abs(b.position.z) > ARENA * 1.3 || b.position.y < FLOOR_Y - 20 || b.position.y > 1400) {
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
  const camPos = p.mesh.position.clone().addScaledVector(forward, -84).addScaledVector(up, 26);
  camera.position.lerp(camPos, 1 - Math.exp(-dt * 8));
  camera.lookAt(p.mesh.position.clone().addScaledVector(forward, 220));
}

function updateState() {
  const alive = game.bots.filter((b) => b.alive).length;
  healthEl.textContent = `HP ${Math.max(0, Math.round(game.player.hp))}`;
  enemiesEl.textContent = `ENEMY ${alive}`;
  scoreEl.textContent = `SCORE ${game.score}`;

  if (!game.player.alive && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "MISSION FAILED";
  }

  if (alive === 0 && !game.over) {
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

  game.player = createFighter(0x48d7ff, true);
  game.player.mesh.position.set(0, 320, 0);
  game.player.mesh.rotation.set(0, -Math.PI * 0.2, 0);

  const colors = [0xff615d, 0xffc065, 0xc993ff];
  game.bots = Array.from({ length: Number(botCountEl.value) }, (_, i) => {
    const bot = createFighter(colors[i]);
    bot.mesh.position.set(rand(-1100, 1100), rand(240, 560), rand(-1100, 1100));
    bot.mesh.lookAt(game.player.mesh.position);
    return bot;
  });
}

function syncInput() {
  const kRoll = (keys.has("KeyA") ? -1 : 0) + (keys.has("KeyD") ? 1 : 0);
  const kPitch = (keys.has("KeyW") ? 1 : 0) + (keys.has("KeyS") ? -1 : 0);
  const kYaw = (keys.has("KeyQ") ? -1 : 0) + (keys.has("KeyE") ? 1 : 0);
  const kThr = (keys.has("ArrowDown") ? -1 : 0) + (keys.has("ArrowUp") ? 1 : 0);

  input.roll = clamp(input.roll + ((Math.abs(stickInput.roll) > 0.01 ? stickInput.roll : kRoll) - input.roll) * 0.38, -1, 1);
  input.pitch = clamp(input.pitch + ((Math.abs(stickInput.pitch) > 0.01 ? stickInput.pitch : kPitch) - input.pitch) * 0.38, -1, 1);
  input.yaw = clamp(input.yaw + ((Math.abs(stickInput.yaw) > 0.01 ? stickInput.yaw : kYaw) - input.yaw) * 0.38, -1, 1);
  input.throttle = clamp(input.throttle + ((Math.abs(stickInput.throttle) > 0.01 ? stickInput.throttle : kThr) - input.throttle) * 0.34, -1, 1);

  input.boost = keys.has("ShiftLeft") || keys.has("ShiftRight") || boostBtn.classList.contains("active");
  input.fire = keys.has("Space") || fireBtn.classList.contains("active");
}

function setupJoystick(stickId, onMove) {
  const stick = document.getElementById(stickId);
  const knob = stick.querySelector(".knob");
  const state = { id: null };

  function updateKnob(nx, ny) {
    const max = stick.clientWidth * 0.34;
    knob.style.transform = `translate(${nx * max}px, ${ny * max}px)`;
  }

  function handleMove(e) {
    if (state.id !== e.pointerId) return;
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let nx = (e.clientX - cx) / (rect.width / 2);
    let ny = (e.clientY - cy) / (rect.height / 2);
    const mag = Math.hypot(nx, ny);
    if (mag > 1) {
      nx /= mag;
      ny /= mag;
    }
    if (mag < 0.06) {
      nx = 0;
      ny = 0;
    }
    updateKnob(nx, ny);
    onMove(nx, ny);
  }

  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    state.id = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    handleMove(e);
  });

  const release = (e) => {
    if (state.id !== e.pointerId) return;
    state.id = null;
    updateKnob(0, 0);
    onMove(0, 0);
  };

  stick.addEventListener("pointermove", handleMove);
  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointercancel", release);
}

function bindActionButton(btn) {
  const press = (e) => {
    e.preventDefault();
    btn.classList.add("active");
    syncInput();
  };
  const release = (e) => {
    e.preventDefault();
    btn.classList.remove("active");
    syncInput();
  };
  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
}

async function tryFullscreen() {
  const target = document.documentElement;
  if (document.fullscreenElement || !target.requestFullscreen) return;
  try {
    await target.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // iOS Safari fallback is PWA standalone mode.
  }
}

async function lockLandscape() {
  if (screen.orientation?.lock) {
    try {
      await screen.orientation.lock("landscape");
    } catch {
      // Browsers may require fullscreen or block orientation lock.
    }
  }
}

function updateOrientationHint() {
  rotateHint.hidden = window.innerWidth >= window.innerHeight;
}

buildWorld(mapTypeEl.value);
setupJoystick("leftStick", (x, y) => {
  stickInput.roll = x;
  stickInput.pitch = -y;
});
setupJoystick("rightStick", (x, y) => {
  stickInput.yaw = x;
  stickInput.throttle = -y;
});
bindActionButton(fireBtn);
bindActionButton(boostBtn);

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

const restartFromHud = (e) => {
  e?.preventDefault?.();
  resetMatch();
};

restartBtn.addEventListener("click", restartFromHud);
restartBtn.addEventListener("pointerup", restartFromHud);

botCountEl.addEventListener("change", resetMatch);
botCountEl.addEventListener("input", resetMatch);
mapTypeEl.addEventListener("change", () => {
  buildWorld(mapTypeEl.value);
  resetMatch();
});

window.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  fitViewport();
  updateOrientationHint();
});
window.visualViewport?.addEventListener("resize", fitViewport);

window.addEventListener(
  "pointerdown",
  () => {
    tryFullscreen();
    lockLandscape();
  },
  { once: true }
);

let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  syncInput();
  updatePlayer(dt);
  updateBots(dt);
  updateBullets(dt);
  updateCamera(dt);
  updateState();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

fitViewport();
updateOrientationHint();
resetMatch();
requestAnimationFrame(tick);
