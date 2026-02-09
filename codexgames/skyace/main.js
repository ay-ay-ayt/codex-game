import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const healthEl = document.getElementById("health");
const enemiesEl = document.getElementById("enemies");
const ammoEl = document.getElementById("ammo");
const boostStatEl = document.getElementById("boostStat");
const botCountEl = document.getElementById("botCount");
const mapTypeEl = document.getElementById("mapType");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
menuPanel.hidden = false;
menuBtn.setAttribute("aria-expanded", "true");
const messageEl = document.getElementById("message");
const rotateHint = document.getElementById("rotateHint");
const fireBtn = document.getElementById("fireBtn");
const boostLeverEl = document.getElementById("boostLever");
const crosshairEl = document.getElementById("crosshair");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x6f9ed4, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 8000);
scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x5e8060, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(700, 900, 300);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const staticObstacles = [];
const tmpBox = new THREE.Box3();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();

const ARENA = 3600;
const FLOOR_Y = 40;
const MAX_BANK = THREE.MathUtils.degToRad(55);
const MAX_PITCH = THREE.MathUtils.degToRad(35);
const BANK_RATE = 3.0;
const PITCH_RATE = 2.5;
const LEVEL_RATE = 1.2;
const TURN_RATE = 1.0;
const keys = new Set();

const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
const qRoll = new THREE.Quaternion();
const qMove = new THREE.Quaternion();
const qVisual = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

const stickInput = {
  pitch: 0,
  yaw: 0,
  active: false,
};

const input = {
  roll: 0,
  pitch: 0,
  yaw: 0,
  throttle: 0,
  boost: false,
  boostLevel: 0,
  fire: false,
};

const boostLeverState = {
  level: 0,
  pointerId: null,
  applyLevel: null,
};

const game = {
  player: null,
  bots: [],
  bullets: [],
  score: 0,
  over: false,
  initialBots: 0,
  ammo: 60,
  boostFuel: 100,
  effects: [],
  playerHitTimer: 0,
  hitConfirmTimer: 0,
};

let lastHitVibeAt = 0;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function rand(a, b) {
  return a + Math.random() * (b - a);
}

function smoothApproach(current, target, rate, dt) {
  const t = 1 - Math.exp(-rate * dt);
  return current + (target - current) * t;
}

function addObstacle(mesh, padding = 0) {
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  if (padding > 0) box.expandByScalar(padding);
  staticObstacles.push(box);
}

function intersectsObstacle(position, radius = 0) {
  for (const box of staticObstacles) {
    tmpBox.copy(box).expandByScalar(radius);
    if (tmpBox.containsPoint(position)) return true;
  }
  return false;
}

function obstacleAvoidance(position, forward, lookAhead = 140) {
  const probe = tmpVecA.copy(forward).multiplyScalar(lookAhead).add(position);
  const avoid = tmpVecB.set(0, 0, 0);
  let weight = 0;

  for (const box of staticObstacles) {
    const d = box.distanceToPoint(probe);
    if (d > 120) continue;

    box.getCenter(tmpVecC);
    const away = tmpVecC.subVectors(probe, tmpVecC);
    const lenSq = away.lengthSq();
    if (lenSq < 1e-4) continue;

    away.multiplyScalar(1 / Math.sqrt(lenSq));
    avoid.addScaledVector(away, (120 - d) / 120);
    weight += 1;
  }

  if (weight > 0) avoid.multiplyScalar(1 / weight);
  return avoid;
}

function buildArenaBoundary() {
  const points = [
    new THREE.Vector3(-ARENA, FLOOR_Y + 60, -ARENA),
    new THREE.Vector3(ARENA, FLOOR_Y + 60, -ARENA),
    new THREE.Vector3(ARENA, FLOOR_Y + 60, ARENA),
    new THREE.Vector3(-ARENA, FLOOR_Y + 60, ARENA),
    new THREE.Vector3(-ARENA, FLOOR_Y + 60, -ARENA),
  ];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x9ed6ff, transparent: true, opacity: 0.45 })
  );
  world.add(line);
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
  staticObstacles.length = 0;

  const isForest = mapType === "forest";
  const skyColor = isForest ? 0x89b992 : 0x7594ba;
  scene.background = new THREE.Color(skyColor);
  scene.fog = isForest
    ? new THREE.FogExp2(skyColor, 0.0001)
    : new THREE.FogExp2(skyColor, 0.000075);

  buildArenaBoundary();

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: isForest ? 0.2 : 0.27,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < 170; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(rand(26, 68), 12, 10), cloudMat);
    cloud.scale.set(rand(2.5, 5.3), rand(0.38, 0.72), rand(1.4, 3.0));
    cloud.position.set(rand(-ARENA * 1.2, ARENA * 1.2), rand(640, 1250), rand(-ARENA * 1.2, ARENA * 1.2));
    world.add(cloud);
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
    for (let i = 0; i < 95; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(rand(90, 260), 16, 12), hillMat);
      hill.scale.y = rand(0.24, 0.55);
      hill.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(8, 32), rand(-ARENA * 1.2, ARENA * 1.2));
      hill.receiveShadow = true;
      world.add(hill);
    }

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 });
    const leafPalette = [0x2f6f3b, 0x3e8048, 0x4f9259, 0x2d5d37];
    const forestCenters = Array.from({ length: 10 }, () => new THREE.Vector2(rand(-ARENA * 0.95, ARENA * 0.95), rand(-ARENA * 0.95, ARENA * 0.95)));

    const placeTree = (px, pz, dense = false) => {
      if (Math.abs(px) < 160 && Math.abs(pz) < 160) return;
      const h = dense ? rand(110, 280) : rand(75, 190);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(dense ? rand(2.8, 5.4) : rand(2.2, 4.2), dense ? rand(4.1, 6.6) : rand(3.1, 5.2), h, 8), trunkMat);
      trunk.position.set(px, FLOOR_Y + h / 2, pz);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      world.add(trunk);
      addObstacle(trunk, 5);

      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(dense ? rand(30, 56) : rand(20, 38), dense ? rand(80, 150) : rand(52, 100), 9),
        new THREE.MeshStandardMaterial({ color: leafPalette[(Math.random() * leafPalette.length) | 0], roughness: 0.95 })
      );
      crown.position.set(px, FLOOR_Y + h + crown.geometry.parameters.height * 0.42, pz);
      crown.castShadow = true;
      crown.receiveShadow = true;
      world.add(crown);
      addObstacle(crown, 2);
    };

    for (const center of forestCenters) {
      for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = rand(0, 260) * Math.sqrt(Math.random());
        placeTree(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, true);
      }
    }

    for (let i = 0; i < 900; i++) {
      placeTree(rand(-ARENA * 1.2, ARENA * 1.2), rand(-ARENA * 1.2, ARENA * 1.2), false);
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
    addObstacle(tower, 3);

    if (Math.random() > 0.55) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, rand(12, 28), d * 0.7),
        new THREE.MeshStandardMaterial({ color: 0xcad2dd, roughness: 0.65 })
      );
      roof.position.set(px, FLOOR_Y + h + roof.geometry.parameters.height / 2, pz);
      roof.castShadow = true;
      world.add(roof);
      addObstacle(roof, 2);
    }
  }
}

function createFighter(color, isPlayer = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.68 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xdce6ef, roughness: 0.24, metalness: 0.56 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f2d3b, roughness: 0.58, metalness: 0.26 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.9, 34, 18), bodyMat);
  fuselage.rotation.z = -Math.PI * 0.5;

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.95, 12.8, 18), trimMat);
  nose.rotation.z = -Math.PI * 0.5;
  nose.position.x = 23.3;

  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 8.2, 14), darkMat);
  tailCone.rotation.z = Math.PI * 0.5;
  tailCone.position.x = -21.2;

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(2.65, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xa8eeff, transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.38 })
  );
  cockpit.scale.set(2.0, 0.78, 0.82);
  cockpit.position.set(7.9, 2.7, 0);

  const enginePodL = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 14.5, 14), bodyMat);
  enginePodL.rotation.z = -Math.PI * 0.5;
  enginePodL.position.set(-8.5, 2.6, 2.95);
  const enginePodR = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 14.5, 14), bodyMat);
  enginePodR.rotation.z = -Math.PI * 0.5;
  enginePodR.position.set(-8.5, 2.6, -2.95);

  const addPaired = (factory, z, rotY = 0, yOffset = 0, xOffset = 0) => {
    const left = factory();
    left.position.set(xOffset, yOffset, z);
    left.rotation.y = rotY;
    const right = factory();
    right.position.set(xOffset, yOffset, -z);
    right.rotation.y = -rotY;
    g.add(left, right);
  };

  addPaired(() => new THREE.Mesh(new THREE.BoxGeometry(19.5, 0.58, 5.6), trimMat), 7.2, 0.24, -1.08, -0.9);
  addPaired(() => new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.4, 2.2), trimMat), 12.6, 0.6, -1.2, 7.0);
  addPaired(() => new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.28, 1.45), trimMat), 4.4, 0.5, 0.5, 11.8);

  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8, 1.8), bodyMat);
  finL.position.set(-13.1, 7.0, 2.45);
  finL.rotation.x = 0;
  const finR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8, 1.8), bodyMat);
  finR.position.set(-13.1, 7.0, -2.45);
  finR.rotation.x = 0;

  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.7, 1.4), darkMat);
  intakeL.position.set(9.0, 0.2, 3.3);
  const intakeR = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.7, 1.4), darkMat);
  intakeR.position.set(9.0, 0.2, -3.3);

  const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, 3.2, 12), darkMat);
  exhaustL.rotation.z = Math.PI * 0.5;
  exhaustL.position.set(-20.9, 1.8, 2.9);
  const exhaustR = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, 3.2, 12), darkMat);
  exhaustR.rotation.z = Math.PI * 0.5;
  exhaustR.position.set(-20.9, 1.8, -2.9);

  const missileMat = new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.22, metalness: 0.2 });
  const missileL = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 9.4, 8), missileMat);
  missileL.rotation.z = Math.PI * 0.5;
  missileL.position.set(1.0, -2.15, 10.2);
  const missileR = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 9.4, 8), missileMat);
  missileR.rotation.z = Math.PI * 0.5;
  missileR.position.set(1.0, -2.15, -10.2);

  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.55, 12, 10), new THREE.MeshBasicMaterial({ color: isPlayer ? 0x67eaff : 0xff9b5a }));
  glow.position.x = -21.4;

  g.add(
    fuselage,
    nose,
    tailCone,
    cockpit,
    enginePodL,
    enginePodR,
    finL,
    finR,
    intakeL,
    intakeR,
    exhaustL,
    exhaustR,
    missileL,
    missileR,
    glow
  );

  g.scale.setScalar(1.14);
  g.position.set(0, 300, 0);
  g.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.frustumCulled = false;
    }
  });
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
    isColliding: false,
    yaw: 0,
    pitch: 0,
    roll: 0,
  };
}

function spawnBullet(owner, color) {
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 })
  );
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

function spawnImpactFx(position, color) {
  const fx = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  fx.position.copy(position);
  world.add(fx);
  game.effects.push({ mesh: fx, life: 0.24, scaleRate: 13 });
}

function updateEffects(dt) {
  game.playerHitTimer = Math.max(0, game.playerHitTimer - dt);
  game.hitConfirmTimer = Math.max(0, game.hitConfirmTimer - dt);
  healthEl.classList.toggle("flash", game.playerHitTimer > 0);
  crosshairEl.classList.toggle("hit", game.hitConfirmTimer > 0);

  for (let i = game.effects.length - 1; i >= 0; i--) {
    const fx = game.effects[i];
    fx.life -= dt;
    fx.mesh.scale.multiplyScalar(1 + fx.scaleRate * dt);
    fx.mesh.material.opacity = Math.max(0, fx.life / 0.24);
    if (fx.life <= 0) {
      world.remove(fx.mesh);
      game.effects.splice(i, 1);
    }
  }
}

function keepInArena(plane) {
  const p = plane.mesh.position;
  let hitBoundary = false;

  if (p.x > ARENA) {
    p.x = ARENA;
    plane.velocity.x = Math.min(plane.velocity.x, 0) * 0.35;
    hitBoundary = true;
  } else if (p.x < -ARENA) {
    p.x = -ARENA;
    plane.velocity.x = Math.max(plane.velocity.x, 0) * 0.35;
    hitBoundary = true;
  }

  if (p.z > ARENA) {
    p.z = ARENA;
    plane.velocity.z = Math.min(plane.velocity.z, 0) * 0.35;
    hitBoundary = true;
  } else if (p.z < -ARENA) {
    p.z = -ARENA;
    plane.velocity.z = Math.max(plane.velocity.z, 0) * 0.35;
    hitBoundary = true;
  }

  if (hitBoundary) plane.speed = Math.max(150, plane.speed * 0.9);
  p.y = clamp(p.y, FLOOR_Y + 90, 980);
}

function collidePlaneWithObstacles(plane, previousPosition) {
  if (!intersectsObstacle(plane.mesh.position, 12)) {
    plane.isColliding = false;
    return false;
  }

  plane.mesh.position.copy(previousPosition);

  let closestBox = null;
  let closestDist = Infinity;
  for (const box of staticObstacles) {
    const d = box.distanceToPoint(plane.mesh.position);
    if (d < closestDist) {
      closestDist = d;
      closestBox = box;
    }
  }

  if (closestBox) {
    closestBox.getCenter(tmpVecC);
    const away = tmpVecA.subVectors(plane.mesh.position, tmpVecC);
    away.y = 0;
    if (away.lengthSq() < 1e-4) away.set(Math.sign(Math.random() - 0.5), 0, Math.sign(Math.random() - 0.5));
    away.normalize();
    plane.mesh.position.addScaledVector(away, 22);
    plane.velocity.addScaledVector(away, 180);
  }

  plane.velocity.multiplyScalar(0.68);
  plane.speed = Math.max(160, plane.speed * 0.9);
  plane.isColliding = true;
  return true;
}

function updatePlayer(dt) {
  const p = game.player;
  if (!p.alive || game.over) return;

  p.cooldown -= dt;
  p.speed = clamp(p.speed + input.throttle * dt * 170, 150, 560);

  const rollTarget = clamp(input.roll, -1, 1) * MAX_BANK;
  const pitchTarget = clamp(input.pitch, -1, 1) * MAX_PITCH;

  p.roll = smoothApproach(p.roll, rollTarget, BANK_RATE, dt);
  p.pitch = smoothApproach(p.pitch, pitchTarget, PITCH_RATE, dt);

  if (Math.abs(input.roll) < 0.06) {
    p.roll = smoothApproach(p.roll, 0, LEVEL_RATE, dt);
  }

  p.roll = clamp(p.roll, -MAX_BANK, MAX_BANK);
  p.pitch = clamp(p.pitch, -MAX_PITCH, MAX_PITCH);

  const yawRate = TURN_RATE * (p.roll / MAX_BANK);
  p.yaw += yawRate * dt;

  qYaw.setFromAxisAngle(AXIS_Y, p.yaw);
  qPitch.setFromAxisAngle(AXIS_Z, p.pitch);
  qRoll.setFromAxisAngle(AXIS_X, -p.roll);

  qMove.copy(qYaw).multiply(qPitch);
  qVisual.copy(qMove).multiply(qRoll);
  p.mesh.quaternion.copy(qVisual);

  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(qMove).normalize();
  const boostLevel = input.boostLevel > 0 ? Math.min(input.boostLevel, game.boostFuel / 20) : 0;
  if (boostLevel > 0) {
    game.boostFuel = Math.max(0, game.boostFuel - 22 * boostLevel * dt);
  } else {
    game.boostFuel = Math.min(100, game.boostFuel + 12 * dt);
  }

  const targetSpeed = p.speed + boostLevel * 220;
  const desiredVel = forward.multiplyScalar(targetSpeed);
  p.velocity.lerp(desiredVel, 0.08);
  const prevPos = p.mesh.position.clone();
  p.mesh.position.addScaledVector(p.velocity, dt);

  if (p.mesh.position.y < FLOOR_Y + 92) {
    p.mesh.position.y = FLOOR_Y + 92;
    p.velocity.y = Math.abs(p.velocity.y) * 0.2;
  }

  keepInArena(p);
  collidePlaneWithObstacles(p, prevPos);

  if (!input.fire) game.ammo = Math.min(60, game.ammo + 9 * dt);

  if (input.fire && p.cooldown <= 0 && game.ammo >= 1) {
    spawnBullet(p, 0x95efff);
    game.ammo = Math.max(0, game.ammo - 1);
    p.cooldown = 0.11;
  }
}

function updateBots(dt) {
  const player = game.player;
  const botMinSpeed = 150;
  const botMaxSpeed = 560;

  for (const b of game.bots) {
    if (!b.alive) continue;

    b.cooldown -= dt;
    b.target = player.alive ? player : game.bots.find((x) => x !== b && x.alive) || null;
    if (!b.target) continue;

    const toTarget = b.target.mesh.position.clone().sub(b.mesh.position);
    const dist = Math.max(1, toTarget.length());
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(b.mesh.quaternion).normalize();
    const lead = b.target.velocity.clone().multiplyScalar(clamp(dist / 780, 0.06, 0.45));

    const desired = toTarget.add(lead).normalize();
    const avoid = obstacleAvoidance(b.mesh.position, forward, 190);
    const altitudeErr = clamp((b.target.mesh.position.y - b.mesh.position.y) / 260, -1, 1);

    const steer = desired.clone().addScaledVector(avoid, 1.5);
    steer.y += altitudeErr * 0.3;
    steer.normalize();

    const lead = b.target.velocity.clone().multiplyScalar(clamp(dist / 760, 0.08, 0.48));
    const desired = toTarget.add(lead).normalize();
    const avoid = obstacleAvoidance(b.mesh.position, forward, 185);

    const steer = desired.clone().addScaledVector(avoid, 1.45).normalize();
    const yawErr = clamp(forward.clone().cross(steer).y, -1, 1);
    const pitchErr = clamp(steer.y - forward.y, -1, 1);

    const rollTarget = clamp(-yawErr, -1, 1) * MAX_BANK;
    const pitchTarget = clamp(pitchErr, -1, 1) * MAX_PITCH;

    b.roll = smoothApproach(b.roll, rollTarget, BANK_RATE, dt);
    b.pitch = smoothApproach(b.pitch, pitchTarget, PITCH_RATE, dt);
    b.roll = clamp(b.roll, -MAX_BANK, MAX_BANK);
    b.pitch = clamp(b.pitch, -MAX_PITCH, MAX_PITCH);

    const yawRate = TURN_RATE * (b.roll / MAX_BANK);
    b.yaw += yawRate * dt;

    const lead = b.target.velocity.clone().multiplyScalar(clamp(dist / 760, 0.08, 0.48));
    const desired = toTarget.add(lead).normalize();
    const avoid = obstacleAvoidance(b.mesh.position, forward, 185);

    const steer = desired.clone().addScaledVector(avoid, 1.45).normalize();
    const yawErr = clamp(forward.clone().cross(steer).y, -1, 1);
    const pitchErr = clamp(steer.y - forward.y, -1, 1);

    const rollTarget = clamp(-yawErr, -1, 1) * MAX_BANK;
    const pitchTarget = clamp(pitchErr, -1, 1) * MAX_PITCH;

    b.roll = smoothApproach(b.roll, rollTarget, BANK_RATE, dt);
    b.pitch = smoothApproach(b.pitch, pitchTarget, PITCH_RATE, dt);
    b.roll = clamp(b.roll, -MAX_BANK, MAX_BANK);
    b.pitch = clamp(b.pitch, -MAX_PITCH, MAX_PITCH);

    const lead = b.target.velocity.clone().multiplyScalar(clamp(dist / 760, 0.08, 0.48));
    const desired = toTarget.add(lead).normalize();
    const avoid = obstacleAvoidance(b.mesh.position, forward, 185);

    const steer = desired.clone().addScaledVector(avoid, 1.45).normalize();
    const yawErr = clamp(forward.clone().cross(steer).y, -1, 1);
    const pitchErr = clamp(steer.y - forward.y, -1, 1);

    const rollTarget = clamp(-yawErr, -1, 1) * MAX_BANK;
    const pitchTarget = clamp(pitchErr, -1, 1) * MAX_PITCH;

    b.roll = smoothApproach(b.roll, rollTarget, BANK_RATE, dt);
    b.pitch = smoothApproach(b.pitch, pitchTarget, PITCH_RATE, dt);
    b.roll = clamp(b.roll, -MAX_BANK, MAX_BANK);
    b.pitch = clamp(b.pitch, -MAX_PITCH, MAX_PITCH);

    const lead = b.target.velocity.clone().multiplyScalar(clamp(dist / 760, 0.08, 0.48));
    const desired = toTarget.add(lead).normalize();
    const avoid = obstacleAvoidance(b.mesh.position, forward, 185);

    const steer = desired.clone().addScaledVector(avoid, 1.45).normalize();
    const yawErr = clamp(forward.clone().cross(steer).y, -1, 1);
    const pitchErr = clamp(steer.y - forward.y, -1, 1);

    const rollTarget = clamp(-yawErr, -1, 1) * MAX_BANK;
    const pitchTarget = clamp(pitchErr, -1, 1) * MAX_PITCH;

    b.roll = smoothApproach(b.roll, rollTarget, BANK_RATE, dt);
    b.pitch = smoothApproach(b.pitch, pitchTarget, PITCH_RATE, dt);
    b.roll = clamp(b.roll, -MAX_BANK, MAX_BANK);
    b.pitch = clamp(b.pitch, -MAX_PITCH, MAX_PITCH);

    const yawRate = TURN_RATE * (b.roll / MAX_BANK);
    b.yaw += yawRate * dt;

    qYaw.setFromAxisAngle(AXIS_Y, b.yaw);
    qPitch.setFromAxisAngle(AXIS_Z, b.pitch);
    qRoll.setFromAxisAngle(AXIS_X, -b.roll);

    qMove.copy(qYaw).multiply(qPitch);
    qVisual.copy(qMove).multiply(qRoll);
    b.mesh.quaternion.copy(qVisual);

    const newForward = new THREE.Vector3(1, 0, 0).applyQuaternion(qMove).normalize();

    const throttleTarget = dist > 650 ? 0.9 : dist > 360 ? 0.45 : 0.1;
    b.speed = clamp(b.speed + throttleTarget * dt * 170, botMinSpeed, botMaxSpeed);

    const desiredVel = newForward.multiplyScalar(b.speed);
    b.velocity.lerp(desiredVel, 0.08);

    const prevPos = b.mesh.position.clone();
    b.mesh.position.addScaledVector(b.velocity, dt);
    if (b.mesh.position.y < FLOOR_Y + 110) b.mesh.position.y += 120 * dt;

    keepInArena(b);
    collidePlaneWithObstacles(b, prevPos);

    const aimDot = newForward.dot(toTarget.normalize());
    if (dist < 820 && aimDot > 0.94 && b.cooldown <= 0) {
      spawnBullet(b, 0xffb67e);
      b.cooldown = 0.11;
    }
  }
}

function vibrateOnHit() {
  const vib = navigator.vibrate;
  if (typeof vib !== "function") return;
  const now = performance.now();
  if (now - lastHitVibeAt < 90) return;
  lastHitVibeAt = now;
  navigator.vibrate(18);
}

function hitPlane(plane, dmg, attackerTeam = null) {
  if (!plane.alive) return;
  plane.hp -= dmg;
  spawnImpactFx(plane.mesh.position, plane.isPlayer ? 0xff7a6e : 0x9dffb3);
  if (plane.isPlayer && attackerTeam === "bot") game.playerHitTimer = 0.18;
  if (!plane.isPlayer && attackerTeam === "player") {
    game.hitConfirmTimer = 0.16;
    vibrateOnHit();
  }
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

    if (intersectsObstacle(b.position, 2.5)) {
      spawnImpactFx(b.position, 0xffee9a);
      b.userData.life = -1;
    }

    const targets = b.userData.team === "player" ? game.bots : [game.player];
    for (const t of targets) {
      if (!t || !t.alive) continue;
      if (b.position.distanceToSquared(t.mesh.position) < 18 * 18) {
        hitPlane(t, rand(16, 28), b.userData.team);
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
  const camPos = p.mesh.position.clone().addScaledVector(forward, -72).addScaledVector(up, 25);
  camera.position.lerp(camPos, 1 - Math.exp(-dt * 8));
  camera.lookAt(p.mesh.position.clone().addScaledVector(forward, 208).addScaledVector(up, 18));
}

function updateState() {
  const alive = game.bots.filter((b) => b.alive).length;
  healthEl.textContent = `HP ${Math.max(0, Math.round(game.player.hp))}`;
  enemiesEl.textContent = `ENEMY ${alive}`;
  ammoEl.textContent = `AMMO ${Math.round(game.ammo)}`;
  boostStatEl.textContent = `BOOST ${Math.round(game.boostFuel)}%`;

  if (!game.player.alive && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "YOU LOSE";
  }

  if (game.initialBots > 0 && alive === 0 && game.player.alive && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "YOU WIN";
  }
}

function resetMatch() {
  for (const b of game.bullets) world.remove(b);
  game.bullets = [];
  if (game.player) world.remove(game.player.mesh);
  for (const b of game.bots) world.remove(b.mesh);
  for (const fx of game.effects) world.remove(fx.mesh);
  game.effects = [];

  game.score = 0;
  game.ammo = 60;
  game.boostFuel = 100;
  game.playerHitTimer = 0;
  game.hitConfirmTimer = 0;
  healthEl.classList.remove("flash");
  crosshairEl.classList.remove("hit");
  game.over = false;
  game.initialBots = 0;
  messageEl.hidden = true;
  messageEl.textContent = "";

  boostLeverState.applyLevel?.(0);

  game.player = createFighter(0x48d7ff, true);
  game.player.mesh.position.set(0, 320, 0);
  game.player.yaw = -Math.PI * 0.2;
  game.player.pitch = 0;
  game.player.roll = 0;

  const colors = [0xff615d, 0xffc065, 0xc993ff];
  const botCount = Number(botCountEl.value);
  game.bots = Array.from({ length: botCount }, (_, i) => {
    const bot = createFighter(colors[i]);
    for (let tries = 0; tries < 40; tries++) {
      bot.mesh.position.set(rand(-1100, 1100), rand(240, 560), rand(-1100, 1100));
      if (intersectsObstacle(bot.mesh.position, 26)) continue;
      if (bot.mesh.position.distanceToSquared(game.player.mesh.position) < 420 * 420) continue;
      break;
    }
    bot.mesh.lookAt(game.player.mesh.position);
    return bot;
  });
  game.initialBots = game.bots.length;
}

function syncInput() {
  const kRoll = (keys.has("KeyA") ? -1 : 0) + (keys.has("KeyD") ? 1 : 0);
  const kPitch = (keys.has("KeyW") ? 1 : 0) + (keys.has("KeyS") ? -1 : 0);
  const kThr = (keys.has("ArrowDown") ? -1 : 0) + (keys.has("ArrowUp") ? 1 : 0);

  const stickRoll = Math.abs(stickInput.yaw) > 0.01 ? stickInput.yaw : 0;
  const stickPitch = Math.abs(stickInput.pitch) > 0.01 ? stickInput.pitch : 0;
  const usingStick = stickInput.active;

  const rollTarget = usingStick ? -stickRoll : kRoll;
  const pitchTarget = usingStick ? stickPitch : kPitch;

  input.roll = clamp(input.roll + (rollTarget - input.roll) * (usingStick ? 0.62 : 0.36), -1, 1);
  input.pitch = clamp(input.pitch + (pitchTarget - input.pitch) * (usingStick ? 0.56 : 0.34), -1, 1);
  input.yaw = 0;

  const throttleTarget = Math.abs(kThr) > 0 ? kThr : 0.35;
  input.throttle = clamp(input.throttle + (throttleTarget - input.throttle) * 0.24, -1, 1);

  input.boostLevel = clamp(Math.max(boostLeverState.level, keys.has("ShiftLeft") || keys.has("ShiftRight") ? 1 : 0), 0, 1);
  input.boost = input.boostLevel > 0.01;
  input.fire = keys.has("Space") || fireBtn.classList.contains("active");
}

function setupJoystick(stickId, onMove) {
  const stick = document.getElementById(stickId);
  const knob = stick.querySelector(".knob");
  const state = { pointerId: null, touchId: null };

  function updateKnob(nx, ny) {
    const max = stick.clientWidth * 0.34;
    knob.style.transform = `translate(${nx * max}px, ${ny * max}px)`;
  }

  function moveFromClient(clientX, clientY) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let nx = (clientX - cx) / (rect.width / 2);
    let ny = (clientY - cy) / (rect.height / 2);
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
    stickInput.active = true;
    onMove(nx, ny);
  }

  function releaseStick() {
    state.pointerId = null;
    state.touchId = null;
    stickInput.active = false;
    updateKnob(0, 0);
    onMove(0, 0);
  }

  stick.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    state.pointerId = e.pointerId;
    stick.setPointerCapture?.(e.pointerId);
    moveFromClient(e.clientX, e.clientY);
  });
  stick.addEventListener("pointermove", (e) => {
    if (state.pointerId !== e.pointerId) return;
    e.preventDefault();
    moveFromClient(e.clientX, e.clientY);
  });
  const onPointerRelease = (e) => {
    if (state.pointerId !== e.pointerId) return;
    e.preventDefault();
    releaseStick();
  };
  stick.addEventListener("pointerup", onPointerRelease);
  stick.addEventListener("pointercancel", onPointerRelease);

  stick.addEventListener(
    "touchstart",
    (e) => {
      if (state.touchId != null) return;
      const t = e.changedTouches[0];
      state.touchId = t.identifier;
      moveFromClient(t.clientX, t.clientY);
      e.preventDefault();
    },
    { passive: false }
  );

  stick.addEventListener(
    "touchmove",
    (e) => {
      if (state.touchId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== state.touchId) continue;
        moveFromClient(t.clientX, t.clientY);
        e.preventDefault();
        break;
      }
    },
    { passive: false }
  );

  const onTouchEnd = (e) => {
    if (state.touchId == null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== state.touchId) continue;
      releaseStick();
      e.preventDefault();
      break;
    }
  };
  stick.addEventListener("touchend", onTouchEnd, { passive: false });
  stick.addEventListener("touchcancel", onTouchEnd, { passive: false });
}

function setupBoostLever() {
  const knob = boostLeverEl.querySelector(".lever-knob");

  function applyLevel(level) {
    boostLeverState.level = clamp(level, 0, 1);
    const maxTravel = boostLeverEl.clientHeight - knob.clientHeight - 16;
    const y = maxTravel * (1 - boostLeverState.level);
    knob.style.transform = `translate(-50%, ${y}px)`;
  }
  boostLeverState.applyLevel = applyLevel;

  function moveFromClient(clientY) {
    const rect = boostLeverEl.getBoundingClientRect();
    const top = rect.top + 8;
    const bottom = rect.bottom - 8;
    const clampedY = clamp(clientY, top, bottom);
    const level = 1 - (clampedY - top) / Math.max(1, bottom - top);
    applyLevel(level);
  }

  boostLeverEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    boostLeverState.pointerId = e.pointerId;
    boostLeverEl.setPointerCapture?.(e.pointerId);
    moveFromClient(e.clientY);
  });
  boostLeverEl.addEventListener("pointermove", (e) => {
    if (boostLeverState.pointerId !== e.pointerId) return;
    e.preventDefault();
    moveFromClient(e.clientY);
  });
  const release = (e) => {
    if (boostLeverState.pointerId !== e.pointerId) return;
    boostLeverState.pointerId = null;
  };
  boostLeverEl.addEventListener("pointerup", release);
  boostLeverEl.addEventListener("pointercancel", release);

  applyLevel(0);
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
  stickInput.yaw = x;
  stickInput.pitch = y;
});
bindActionButton(fireBtn);
setupBoostLever();

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

menuBtn.addEventListener("click", (e) => {
  e.preventDefault();
  menuPanel.hidden = !menuPanel.hidden;
  menuBtn.setAttribute("aria-expanded", String(!menuPanel.hidden));
});

botCountEl.addEventListener("change", resetMatch);
botCountEl.addEventListener("input", resetMatch);
mapTypeEl.addEventListener("change", () => {
  buildWorld(mapTypeEl.value);
  resetMatch();
});

botCountEl.addEventListener("input", resetMatch);
mapTypeEl.addEventListener("change", () => {
  buildWorld(mapTypeEl.value);
  resetMatch();
});

botCountEl.addEventListener("input", resetMatch);
mapTypeEl.addEventListener("change", () => {
  buildWorld(mapTypeEl.value);
  resetMatch();
});

botCountEl.addEventListener("input", resetMatch);
mapTypeEl.addEventListener("change", () => {
  buildWorld(mapTypeEl.value);
  resetMatch();
});

botCountEl.addEventListener("input", resetMatch);
mapTypeEl.addEventListener("change", () => {
  buildWorld(mapTypeEl.value);
  resetMatch();
});

botCountEl.addEventListener("input", resetMatch);
mapTypeEl.addEventListener("change", () => {
  buildWorld(mapTypeEl.value);
  resetMatch();
});

window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("selectstart", (e) => e.preventDefault());
window.addEventListener("dragstart", (e) => e.preventDefault());
window.addEventListener("gesturestart", (e) => e.preventDefault());
window.addEventListener("touchstart", (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

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
  updateEffects(dt);
  updateCamera(dt);
  updateState();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

fitViewport();
updateOrientationHint();
resetMatch();
requestAnimationFrame(tick);
