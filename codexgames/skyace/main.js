import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const healthEl = document.getElementById("health");
const ammoEl = document.getElementById("ammo");
const boostStatEl = document.getElementById("boostStat");
const botCountEl = document.getElementById("botCount");
const mapTypeEl = document.getElementById("mapType");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn");
const botCountButtons = botCountEl ? Array.from(botCountEl.querySelectorAll(".tap-btn[data-bot-count]")) : [];
const mapTypeButtons = mapTypeEl ? Array.from(mapTypeEl.querySelectorAll(".tap-btn[data-map-type]")) : [];

const initialBotButton = botCountButtons.find((btn) => btn.classList.contains("is-active"));
let selectedBotCount = Number((initialBotButton && initialBotButton.dataset.botCount) || 2);
if (!Number.isFinite(selectedBotCount)) selectedBotCount = 2;
const initialMapButton = mapTypeButtons.find((btn) => btn.classList.contains("is-active"));
let selectedMapType = (initialMapButton && initialMapButton.dataset.mapType) || "city";
const menuPanel = document.getElementById("menuPanel");
menuPanel.hidden = true;
menuBtn.setAttribute("aria-expanded", "false");
const messageEl = document.getElementById("message");
const rotateHint = document.getElementById("rotateHint");
const fireBtn = document.getElementById("fireBtn");
const missileBtn = document.getElementById("missileBtn");
const boostLeverEl = document.getElementById("boostLever");
const crosshairEl = document.getElementById("crosshair");
const missileWarningEl = document.getElementById("missileWarning");
const lockOnCueEl = document.getElementById("lockOnCue");
const lockCancelBtn = document.getElementById("lockCancelBtn");
const buildDebugEl = document.getElementById("buildDebug");
let hpPanelReady = false;

// DEBUG_BUILD_NUMBER block: remove this block to hide the temporary build marker.
const DEBUG_BUILD_NUMBER = 194;
if (buildDebugEl) buildDebugEl.textContent = `BUILD ${DEBUG_BUILD_NUMBER}`;

const coarsePointerQuery = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
const isMobile = (coarsePointerQuery && coarsePointerQuery.matches)
  || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  const preventZoomGesture = (event) => event.preventDefault();
  document.addEventListener("gesturestart", preventZoomGesture, { passive: false });
  document.addEventListener("dblclick", preventZoomGesture, { passive: false });
}

function setupHudHealthPanel() {
  healthEl.innerHTML = "";
  hpPanelReady = true;
}

function hpBarClass(ratio) {
  if (ratio > 0.6) return "good";
  if (ratio > 0.3) return "warn";
  return "danger";
}

function hpRowMarkup(label, hp, locked = false) {
  const hpInt = Math.max(0, Math.round(hp));
  const ratio = clamp(hpInt / 100, 0, 1);
  const sizeClass = `hp-row${locked ? " is-locked" : ""}`;
  return `
    <div class="${sizeClass}">
      <span class="hp-name">${label}</span>
      <span class="hp-track"><span class="hp-fill ${hpBarClass(ratio)}" style="width:${Math.round(ratio * 100)}%"></span></span>
      <span class="hp-val">${hpInt}</span>
    </div>
  `;
}

function updateHudHealthPanel() {
  if (!hpPanelReady || !game.player) return;

  const rows = [hpRowMarkup("YOU", game.player.hp, false)];
  game.bots.forEach((b, i) => {
    rows.push(hpRowMarkup(`EN${i + 1}`, b.hp, b === game.missileLockTarget));
  });
  healthEl.innerHTML = rows.join("");
}

function createRenderer() {
  const attempts = [
    { canvas, antialias: !isMobile, powerPreference: isMobile ? "low-power" : "high-performance" },
    { canvas, antialias: false, powerPreference: "low-power", precision: "lowp", alpha: false, depth: false, stencil: false },
  ];

  for (const options of attempts) {
    try {
      return new THREE.WebGLRenderer(options);
    } catch (err) {
      // fall through to the next option
    }
  }
  return null;
}

function drawRendererFallback() {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = Math.max(1, window.innerWidth || 1);
  const h = Math.max(1, window.innerHeight || 1);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#5f8fc6");
  sky.addColorStop(0.62, "#3f6ea5");
  sky.addColorStop(1, "#1b2f46");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(16, 36, 58, 0.58)";
  ctx.fillRect(0, h * 0.64, w, h * 0.36);

  ctx.strokeStyle = "rgba(168, 229, 255, 0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.52);
  ctx.lineTo(w * 0.62, h * 0.5);
  ctx.lineTo(w * 0.72, h * 0.47);
  ctx.lineTo(w * 0.79, h * 0.48);
  ctx.lineTo(w * 0.71, h * 0.52);
  ctx.lineTo(w * 0.62, h * 0.55);
  ctx.lineTo(w * 0.56, h * 0.58);
  ctx.lineTo(w * 0.48, h * 0.58);
  ctx.closePath();
  ctx.stroke();
}

const renderer = createRenderer();
const rendererReady = Boolean(renderer);
if (rendererReady) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x6f9ed4, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

const scene = new THREE.Scene();

const textureLoader = new THREE.TextureLoader();
const textureAnisotropy = rendererReady ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;

function loadTiledTexture(path, repeat = [1, 1], colorSpace = THREE.NoColorSpace) {
  const tex = textureLoader.load(path);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = colorSpace;
  tex.anisotropy = textureAnisotropy;
  return tex;
}

const fighterTextures = {
  bodyColor: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_diff_2k.jpg", [3.2, 1.1], THREE.SRGBColorSpace),
  bodyNormal: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_nor_gl_2k.jpg", [3.2, 1.1]),
  bodyRoughness: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_rough_2k.jpg", [3.2, 1.1]),
  bodyMetalness: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_metal_2k.jpg", [3.2, 1.1]),
  trimColor: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_diff_2k.jpg", [1.8, 1], THREE.SRGBColorSpace),
  trimNormal: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_nor_gl_2k.jpg", [1.8, 1]),
  trimRoughness: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_rough_2k.jpg", [1.8, 1]),
};

const worldTextures = {
  cityGroundColor: loadTiledTexture("../../assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_diff_2k.jpg", [26, 26], THREE.SRGBColorSpace),
  cityGroundNormal: loadTiledTexture("../../assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_nor_gl_2k.jpg", [26, 26]),
  cityGroundRoughness: loadTiledTexture("../../assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_rough_2k.jpg", [26, 26]),
  cityRoadColor: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_diff_2k.jpg", [20, 8], THREE.SRGBColorSpace),
  cityRoadNormal: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_nor_gl_2k.jpg", [20, 8]),
  cityRoadRoughness: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_rough_2k.jpg", [20, 8]),
  cityBuildingColor: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_diff_2k.jpg", [2.4, 3.4], THREE.SRGBColorSpace),
  cityBuildingNormal: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_nor_gl_2k.jpg", [2.4, 3.4]),
  cityBuildingRoughness: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_rough_2k.jpg", [2.4, 3.4]),
  forestGroundColor: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_diff_2k.jpg", [18, 18], THREE.SRGBColorSpace),
  forestGroundNormal: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_nor_gl_2k.jpg", [18, 18]),
  forestGroundRoughness: loadTiledTexture("../../assets/polyhaven/textures/brushed_concrete/brushed_concrete_rough_2k.jpg", [18, 18]),
  rockColor: loadTiledTexture("../../assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_diff_2k.jpg", [1.4, 1.4], THREE.SRGBColorSpace),
  rockNormal: loadTiledTexture("../../assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_nor_gl_2k.jpg", [1.4, 1.4]),
  rockRoughness: loadTiledTexture("../../assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_rough_2k.jpg", [1.4, 1.4]),
  trunkColor: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_diff_2k.jpg", [1.1, 3.2], THREE.SRGBColorSpace),
  trunkNormal: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_nor_gl_2k.jpg", [1.1, 3.2]),
  trunkRoughness: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_rough_2k.jpg", [1.1, 3.2]),
};

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 8000);
scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x5e8060, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(700, 900, 300);
sun.castShadow = !isMobile;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const staticObstacles = [];
const staticObstacleMeshes = [];
const tmpBox = new THREE.Box3();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();
const tmpVecD = new THREE.Vector3();
const losRaycaster = new THREE.Raycaster();

const ARENA = 3600;
const FLOOR_Y = 40;
const worldDetail = isMobile
  ? {
    clouds: 110,
    cloudBands: 16,
    hills: 52,
    forestCenters: 7,
    forestDenseTrees: 76,
    forestSparseTrees: 420,
    forestRocks: 170,
    forestShrubs: 240,
    cityBuildings: 380,
    cityWindowBands: 1,
  }
  : {
    clouds: 220,
    cloudBands: 34,
    hills: 120,
    forestCenters: 12,
    forestDenseTrees: 140,
    forestSparseTrees: 1050,
    forestRocks: 420,
    forestShrubs: 520,
    cityBuildings: 520,
    cityWindowBands: 2,
  };
const MAX_BANK = THREE.MathUtils.degToRad(55);
const MAX_PITCH = THREE.MathUtils.degToRad(35);
const BANK_RATE = 3.0;
const PITCH_RATE = 2.5;
const LEVEL_RATE = 1.2;
const TURN_RATE = 1.0;
const BOOST_SPEED_BONUS_MAX = 260;
const BOOST_FUEL_BURN_BASE_PER_SEC = 22;
const BOOST_FUEL_BURN_CURVE = 0.35; // Higher boost levels become less fuel-efficient toward 100%.
const BOOST_FUEL_MAX = 130;
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
  lockToggle: false,
  lockTogglePressed: false,
  missileLaunchPressed: false,
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
  missiles: [],
  score: 0,
  over: false,
  initialBots: 0,
  ammo: 60,
  boostFuel: BOOST_FUEL_MAX,
  effects: [],
  playerHitTimer: 0,
  hitConfirmTimer: 0,
  boostAutoDropAt: null,
  missileLockTarget: null,
  missileLockLostTimer: 0,
  missileIncomingTimer: 0,
  shiftBoostRelatchRequired: false,
  lockToggleButtonLatch: false,
  lockToggleTapQueuedCount: 0,
  missileLaunchTapQueuedCount: 0,
  matchElapsed: 0,
};

let lastHitVibeAt = 0;

const MISSILE_MAX_AMMO = 2;
const MISSILE_SPEED = 650;
const MISSILE_TURN_RATE = 1.02;
const MISSILE_LOCK_RANGE = 1800;
const MISSILE_LOCK_DOT = 0.58;
const MISSILE_LOCK_DROP_RANGE = 2000;
const MISSILE_LOCK_DROP_DOT = 0.42;


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
  if (!mesh) return;
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  if (padding > 0) box.expandByScalar(padding);
  staticObstacles.push(box);
  staticObstacleMeshes.push(mesh);
}

function getLockAimPoint(plane, out = tmpVecD) {
  const pos = plane && plane.mesh ? plane.mesh.position : null;
  if (!pos) return out.set(0, 0, 0);
  out.copy(pos);
  out.y += 14;
  return out;
}

function hasLineOfSight(origin, targetPlane) {
  if (!targetPlane || !targetPlane.mesh || staticObstacleMeshes.length === 0) return true;
  const targetPos = getLockAimPoint(targetPlane, tmpVecD);
  const dir = tmpVecB.copy(targetPos).sub(origin);
  const dist = dir.length();
  if (dist <= 1e-3) return true;

  dir.multiplyScalar(1 / dist);
  losRaycaster.set(origin, dir);
  losRaycaster.near = 0.1;
  losRaycaster.far = dist - 2;

  const hits = losRaycaster.intersectObjects(staticObstacleMeshes, false);
  return hits.length === 0;
}

function intersectsObstacle(position, radius = 0) {
  for (const box of staticObstacles) {
    tmpBox.copy(box).expandByScalar(radius);
    if (tmpBox.containsPoint(position)) return true;
  }
  return false;
}

function intersectsObstacleSegment(start, end, radius = 0) {
  const segmentDir = tmpVecA.subVectors(end, start);
  const segmentLength = segmentDir.length();
  if (segmentLength <= 1e-6) return intersectsObstacle(start, radius);
  segmentDir.multiplyScalar(1 / segmentLength);
  const segmentRay = new THREE.Ray(start, segmentDir);

  for (const box of staticObstacles) {
    tmpBox.copy(box).expandByScalar(radius);
    if (tmpBox.containsPoint(start) || tmpBox.containsPoint(end)) return true;
    const hit = segmentRay.intersectBox(tmpBox, tmpVecB);
    if (hit && hit.distanceToSquared(start) <= segmentLength * segmentLength) return true;
  }
  return false;
}


function obstacleThreat(position, forward, distances = [70, 120, 180], radius = 26) {
  const probe = new THREE.Vector3();
  for (const d of distances) {
    probe.copy(forward).multiplyScalar(d).add(position);
    if (intersectsObstacle(probe, radius)) return 1 - (d / Math.max(...distances));
  }
  return 0;
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
  const visualViewport = window.visualViewport;
  const width = Math.max(1, (visualViewport && visualViewport.width) || window.innerWidth);
  const height = Math.max(1, (visualViewport && visualViewport.height) || window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}


function updateMenuPanelPosition() {
  const menuRect = menuBtn.getBoundingClientRect();
  const menuBottom = Math.ceil(menuRect.bottom);
  document.documentElement.style.setProperty("--menu-bottom", `${menuBottom}px`);
}

function buildWorld(mapType) {
  world.clear();
  staticObstacles.length = 0;
  staticObstacleMeshes.length = 0;

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
  for (let i = 0; i < worldDetail.clouds; i++) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(rand(26, 68), 12, 10), cloudMat);
    cloud.scale.set(rand(2.5, 5.3), rand(0.38, 0.72), rand(1.4, 3.0));
    cloud.position.set(rand(-ARENA * 1.2, ARENA * 1.2), rand(640, 1250), rand(-ARENA * 1.2, ARENA * 1.2));
    world.add(cloud);
  }

  const cirrusMat = new THREE.MeshBasicMaterial({
    color: isForest ? 0xe9f6ef : 0xeef6ff,
    transparent: true,
    opacity: isForest ? 0.1 : 0.14,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < worldDetail.cloudBands; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(rand(420, 860), rand(58, 120)), cirrusMat);
    band.rotation.x = -Math.PI / 2;
    band.rotation.z = rand(-0.45, 0.45);
    band.position.set(rand(-ARENA * 1.25, ARENA * 1.25), rand(780, 1320), rand(-ARENA * 1.25, ARENA * 1.25));
    world.add(band);
  }

  if (isForest) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 3.2, ARENA * 3.2),
      new THREE.MeshStandardMaterial({
        color: 0x5f8550,
        map: worldTextures.forestGroundColor,
        normalMap: worldTextures.forestGroundNormal,
        roughnessMap: worldTextures.forestGroundRoughness,
        roughness: 0.96,
        metalness: 0.02,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y;
    ground.receiveShadow = true;
    world.add(ground);

    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x6e9561,
      map: worldTextures.forestGroundColor,
      normalMap: worldTextures.forestGroundNormal,
      roughnessMap: worldTextures.forestGroundRoughness,
      roughness: 0.94,
      metalness: 0.03,
    });
    for (let i = 0; i < worldDetail.hills; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(rand(90, 260), 16, 12), hillMat);
      hill.scale.y = rand(0.24, 0.55);
      hill.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(8, 32), rand(-ARENA * 1.2, ARENA * 1.2));
      hill.receiveShadow = true;
      world.add(hill);
    }

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x8f9792,
      map: worldTextures.rockColor,
      normalMap: worldTextures.rockNormal,
      roughnessMap: worldTextures.rockRoughness,
      roughness: 0.92,
      metalness: 0.04,
    });
    for (let i = 0; i < worldDetail.forestRocks; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(8, 26), 0), rockMat);
      rock.scale.y = rand(0.45, 1.0);
      rock.rotation.set(rand(-0.3, 0.3), rand(0, Math.PI), rand(-0.2, 0.2));
      rock.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(4, 15), rand(-ARENA * 1.2, ARENA * 1.2));
      rock.castShadow = true;
      rock.receiveShadow = true;
      world.add(rock);
      addObstacle(rock, 2);
    }

    const shrubMat = new THREE.MeshStandardMaterial({ color: 0x567a48, roughness: 0.94 });
    for (let i = 0; i < worldDetail.forestShrubs; i++) {
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(rand(10, 24), 10, 8), shrubMat);
      shrub.scale.y = rand(0.3, 0.7);
      shrub.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(4, 10), rand(-ARENA * 1.2, ARENA * 1.2));
      shrub.receiveShadow = true;
      world.add(shrub);
    }

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x7d5c3f,
      map: worldTextures.trunkColor,
      normalMap: worldTextures.trunkNormal,
      roughnessMap: worldTextures.trunkRoughness,
      roughness: 0.9,
      metalness: 0.05,
    });
    const leafPalette = [0x2f6f3b, 0x3e8048, 0x4f9259, 0x2d5d37];
    const forestCenters = Array.from({ length: worldDetail.forestCenters }, () => new THREE.Vector2(rand(-ARENA * 0.95, ARENA * 0.95), rand(-ARENA * 0.95, ARENA * 0.95)));

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
      for (let i = 0; i < worldDetail.forestDenseTrees; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = rand(0, 260) * Math.sqrt(Math.random());
        placeTree(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, true);
      }
    }

    for (let i = 0; i < worldDetail.forestSparseTrees; i++) {
      placeTree(rand(-ARENA * 1.2, ARENA * 1.2), rand(-ARENA * 1.2, ARENA * 1.2), false);
    }
    return;
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 3.2, ARENA * 3.2),
    new THREE.MeshStandardMaterial({
      color: 0x89909a,
      map: worldTextures.cityGroundColor,
      normalMap: worldTextures.cityGroundNormal,
      roughnessMap: worldTextures.cityGroundRoughness,
      roughness: 0.92,
      metalness: 0.08,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  world.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x40464e,
    map: worldTextures.cityRoadColor,
    normalMap: worldTextures.cityRoadNormal,
    roughnessMap: worldTextures.cityRoadRoughness,
    roughness: 0.86,
    metalness: 0.08,
  });
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
  for (let i = 0; i < worldDetail.cityBuildings; i++) {
    const px = rand(-ARENA * 1.15, ARENA * 1.15);
    const pz = rand(-ARENA * 1.15, ARENA * 1.15);
    if (Math.abs(px) < 260 && Math.abs(pz) < 260) continue;

    const w = rand(45, 135);
    const d = rand(45, 135);
    const h = rand(90, 520);
    const baseColor = buildingPalette[(Math.random() * buildingPalette.length) | 0];

    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor).lerp(new THREE.Color(0xbcc5ce), 0.2),
        map: worldTextures.cityBuildingColor,
        normalMap: worldTextures.cityBuildingNormal,
        roughnessMap: worldTextures.cityBuildingRoughness,
        roughness: 0.72,
        metalness: 0.12,
      })
    );
    tower.position.set(px, FLOOR_Y + h / 2, pz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    world.add(tower);
    addObstacle(tower, 3);

    for (let j = 0; j < worldDetail.cityWindowBands; j++) {
      if (h < 140 && j > 0) continue;
      const bandY = FLOOR_Y + h * rand(0.25, 0.86);
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.01, rand(2.2, 4.6), d * 1.01),
        new THREE.MeshBasicMaterial({ color: 0xcde6ff, transparent: true, opacity: rand(0.14, 0.24) })
      );
      band.position.set(px, bandY, pz);
      world.add(band);
    }

    if (Math.random() > 0.55) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, rand(12, 28), d * 0.7),
        new THREE.MeshStandardMaterial({ color: 0xcad2dd, roughness: 0.65 })
      );
      roof.position.set(px, FLOOR_Y + h + roof.geometry.parameters.height / 2, pz);
      roof.castShadow = true;
      world.add(roof);
      addObstacle(roof, 2);

      if (Math.random() > 0.5) {
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(rand(0.6, 1.2), rand(0.8, 1.4), rand(18, 42), 8),
          new THREE.MeshStandardMaterial({ color: 0xb9c4d1, roughness: 0.48, metalness: 0.5 })
        );
        antenna.position.set(px + rand(-w * 0.18, w * 0.18), FLOOR_Y + h + roof.geometry.parameters.height + antenna.geometry.parameters.height / 2, pz + rand(-d * 0.18, d * 0.18));
        world.add(antenna);
      }
    }
  }
}

function createFighter(colorOrPalette, isPlayer = false) {
  const g = new THREE.Group();

  function buildSurface(points, thickness = 0.24) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 8 });
    geo.rotateX(Math.PI * 0.5);
    geo.translate(0, -thickness * 0.5, 0);
    return geo;
  }
  function buildVerticalSurface(points, thickness = 0.24) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.translate(0, 0, -thickness * 0.5);
    return geo;
  }
  function mirrorPoints(points) {
    return points.map(([x, z]) => [x, -z]).reverse();
  }
  function taperWingThickness(geo, minScale = 0.48, power = 1.35) {
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const maxSpan = Math.max(Math.abs(box.min.z), Math.abs(box.max.z), 0.001);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const spanT = clamp(Math.abs(z) / maxSpan, 0, 1);
      const taper = 1 - (1 - minScale) * (spanT ** power);
      pos.setY(i, y * taper);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }
  const botBaseColor = new THREE.Color(typeof colorOrPalette === "number" ? colorOrPalette : 0x48d7ff);
  const playerPalette = {
    body: 0x0b0c10,
    wing: 0x1f4f9a,
    accent: 0xffa13a,
    cockpit: 0x0f1117,
  };
  const enemyPalette = {
    body: botBaseColor.clone().offsetHSL(0.02, 0.32, 0.24).getHex(),
    wing: botBaseColor.clone().offsetHSL(0.1, 0.55, 0.3).getHex(),
    accent: botBaseColor.clone().offsetHSL(-0.14, 0.45, 0.2).getHex(),
    cockpit: botBaseColor.clone().offsetHSL(-0.06, 0.2, 0.36).getHex(),
  };
  const palette = isPlayer
    ? playerPalette
    : (typeof colorOrPalette === "object" && colorOrPalette !== null ? colorOrPalette : enemyPalette);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: palette.body,
    map: fighterTextures.bodyColor,
    normalMap: fighterTextures.bodyNormal,
    roughnessMap: fighterTextures.bodyRoughness,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.3,
    metalness: 0.72,
    clearcoat: 0.44,
    clearcoatRoughness: 0.24,
  });
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: palette.wing,
    map: isPlayer ? fighterTextures.trimColor : null,
    normalMap: isPlayer ? fighterTextures.bodyNormal : null,
    roughnessMap: isPlayer ? fighterTextures.bodyRoughness : null,
    metalnessMap: isPlayer ? fighterTextures.bodyMetalness : null,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughness: isPlayer ? 0.3 : 0.22,
    metalness: isPlayer ? 0.76 : 0.68,
    clearcoat: 0.48,
    clearcoatRoughness: 0.24,
    emissive: isPlayer ? 0x000000 : new THREE.Color(palette.wing).multiplyScalar(0.18),
    emissiveIntensity: isPlayer ? 0 : 0.32,
  });
  const nozzleMetalMat = new THREE.MeshPhysicalMaterial({
    color: 0x5a1a22,
    roughnessMap: fighterTextures.bodyRoughness,
    normalMap: fighterTextures.bodyNormal,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughness: 0.3,
    metalness: 0.9,
    clearcoat: 0.24,
    clearcoatRoughness: 0.34,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: palette.accent,
    roughnessMap: fighterTextures.trimRoughness,
    normalMap: fighterTextures.trimNormal,
    normalScale: new THREE.Vector2(0.16, 0.16),
    roughness: 0.22,
    metalness: 0.66,
    emissive: isPlayer ? 0x2b1200 : 0x000000,
    emissiveIntensity: isPlayer ? 0.32 : 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.22,
  });

  // Main axis body: extend only the forward side by +10% while keeping rear/wing-side relationship stable.
  const centerSpineLength = 24.6;
  const centerSpineForwardExtend = centerSpineLength * 0.1;
  const centerSpineGeo = new THREE.CylinderGeometry(2.14, 2.28, centerSpineLength + centerSpineForwardExtend, 30);
  // Keep the mesh position unchanged while shortening only the rear side (no front-side shift).
  centerSpineGeo.translate(0, 1.2, 0);
  const centerSpine = new THREE.Mesh(centerSpineGeo, bodyMat);
  centerSpine.rotation.z = -Math.PI * 0.5;
  centerSpine.position.set(-12.2 + centerSpineForwardExtend * 0.5, 0.72, 0);

  const forwardAxisShiftX = centerSpineForwardExtend;

  // Rebuild the front section from the wing-leading-edge area onward with a shorter reach.
  const forwardSpineTaper = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 2.04, 0.2, 28), bodyMat);
  forwardSpineTaper.rotation.z = -Math.PI * 0.5;
  // Make the front taper cross-section a vertically stretched ellipse.
  forwardSpineTaper.scale.set(1, 1.24, 0.78);
  forwardSpineTaper.position.set(2.6 + forwardAxisShiftX, 0.72, 0);

  // Add a little extra bulge on top of the forward taper.
  const forwardTaperTopBulge = new THREE.Mesh(new THREE.SphereGeometry(0.84, 20, 16), bodyMat);
  forwardTaperTopBulge.scale.set(3.4, 1.08, 1.1);
  forwardTaperTopBulge.position.set(5.3 + forwardAxisShiftX, 1.86, 0);

  // Slightly raised streamlined top profile near the cockpit shoulder.
  const dorsalFlowHump = new THREE.Mesh(new THREE.SphereGeometry(1.14, 22, 16), bodyMat);
  dorsalFlowHump.scale.set(4.15, 0.98, 1.24);
  dorsalFlowHump.position.set(4.1 + forwardAxisShiftX, 1.98, 0);

  const cockpitShoulderBulge = new THREE.Mesh(new THREE.SphereGeometry(0.96, 22, 16), bodyMat);
  cockpitShoulderBulge.scale.set(2.95, 1.14, 1.14);
  cockpitShoulderBulge.position.set(2.7 + forwardAxisShiftX, 2.1, 0);

  const upperSpineBlendBulge = new THREE.Mesh(new THREE.SphereGeometry(1.02, 22, 16), bodyMat);
  upperSpineBlendBulge.scale.set(3.2, 1.0, 1.16);
  upperSpineBlendBulge.position.set(1.2 + forwardAxisShiftX, 2.04, 0);

  // Rebuild cockpit/top/nose area from scratch with a slimmer silhouette.
  const cockpitBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 9.8, 18),
    new THREE.MeshPhysicalMaterial({
      color: palette.cockpit,
      roughnessMap: fighterTextures.bodyRoughness,
      normalMap: fighterTextures.bodyNormal,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.33,
      metalness: 0.7,
      clearcoat: 0.24,
      clearcoatRoughness: 0.26,
    })
  );
  cockpitBody.rotation.z = Math.PI * 0.5;
  cockpitBody.scale.set(1, 0.12, 0.14);
  cockpitBody.position.set(2.9 + forwardAxisShiftX, 1.08, 0);

  const cockpitFairing = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 6.8, 20), bodyMat);
  cockpitFairing.rotation.z = -Math.PI * 0.5;
  cockpitFairing.position.set(4.6 + forwardAxisShiftX, 1.18, 0);

  const cockpitBlend = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 5.4, 20), bodyMat);
  cockpitBlend.rotation.z = -Math.PI * 0.5;
  cockpitBlend.position.set(1.9 + forwardAxisShiftX, 1.05, 0);

  const dorsalDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 5.6, 18), bodyMat);
  dorsalDeck.rotation.z = -Math.PI * 0.5;
  dorsalDeck.position.set(3.2 + forwardAxisShiftX, 1.3, 0);


  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9cb6e9,
    emissive: 0x0e1d3c,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.7,
    roughness: 0.05,
    metalness: 0.01,
    transmission: 0.82,
    thickness: 0.44,
    ior: 1.36,
  });
  const cockpitGlass = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 18), canopyGlassMat);
  cockpitGlass.scale.set(3.81, 1.67, 1.2);
  cockpitGlass.position.set(2.9 + forwardAxisShiftX, 2.18, 0);

  const noseSection = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.52, 5.8, 24), bodyMat);
  noseSection.rotation.z = -Math.PI * 0.5;
  noseSection.position.set(10.25 + forwardAxisShiftX, 1.66, 0);

  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 4.6, 24), wingMat);
  noseCone.rotation.z = -Math.PI * 0.5;
  noseCone.scale.set(1, 0.34, 0.72);
  noseCone.position.set(14.35 + forwardAxisShiftX, 1.52, 0);

  // Main wing: even shorter fore-aft depth and moved further aft
  const mainWingPoints = [
    [8.6, 0.7],
    [-5.2, 18.8],
    [-10.6, 18.8],
    [-8.0, 0.7],
  ];
  const mainWingL = new THREE.Mesh(taperWingThickness(buildSurface(mainWingPoints, 1.92), 0.42, 1.45), wingMat);
  mainWingL.position.set(-10.7, 2.0, 0);
  mainWingL.rotation.x = 0;
  const mainWingR = new THREE.Mesh(taperWingThickness(buildSurface(mirrorPoints(mainWingPoints), 1.92), 0.42, 1.45), wingMat);
  mainWingR.position.copy(mainWingL.position);
  mainWingR.rotation.x = mainWingL.rotation.x;

  const rootStrakeL = new THREE.Mesh(
    taperWingThickness(buildSurface([[7.4, 0.35], [0.8, 5.9], [-2.6, 4.3], [0.4, 0.18]], 0.86), 0.66, 1.25),
    bodyMat
  );
  rootStrakeL.position.set(0.5 + forwardAxisShiftX, 1.28, 2.18);
  rootStrakeL.rotation.set(0.12, 0, -0.06);
  const rootStrakeR = rootStrakeL.clone();
  rootStrakeR.position.z *= -1;
  rootStrakeR.rotation.x *= -1;

  const intakeShellL = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.18, 4.1, 18), bodyMat);
  intakeShellL.rotation.set(0, 0, -Math.PI * 0.5);
  intakeShellL.scale.set(1, 0.66, 1.26);
  intakeShellL.position.set(4.9 + forwardAxisShiftX, 0.7, 2.28);
  const intakeInnerMat = new THREE.MeshStandardMaterial({ color: 0x232a31, roughness: 0.72, metalness: 0.24 });
  const intakeLipL = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.76, 22), nozzleMetalMat);
  intakeLipL.rotation.set(0, Math.PI * 0.5, 0);
  intakeLipL.position.set(7.06 + forwardAxisShiftX, 0.76, 2.28);
  const intakeInnerL = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.55, 16), intakeInnerMat);
  intakeInnerL.rotation.set(0, 0, -Math.PI * 0.5);
  intakeInnerL.position.set(6.06 + forwardAxisShiftX, 0.74, 2.28);

  const intakeShellR = intakeShellL.clone();
  intakeShellR.position.z *= -1;
  const intakeLipR = intakeLipL.clone();
  intakeLipR.position.z *= -1;
  const intakeInnerR = intakeInnerL.clone();
  intakeInnerR.position.z *= -1;

  const wingtipRailL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 0.22), nozzleMetalMat);
  wingtipRailL.position.set(-18.1, 1.1, 18.78);
  wingtipRailL.rotation.set(0, 0.06, 0.02);
  const wingtipRailR = wingtipRailL.clone();
  wingtipRailR.position.z *= -1;
  wingtipRailR.rotation.y *= -1;

  const chineStripeL = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.07, 0.2), accentMat);
  chineStripeL.position.set(8.8 + forwardAxisShiftX, 1.48, 1.72);
  chineStripeL.rotation.set(0.08, 0, -0.3);
  const chineStripeR = chineStripeL.clone();
  chineStripeR.position.z *= -1;
  chineStripeR.rotation.z *= -1;

  const wingPatternMat = accentMat.clone();
  wingPatternMat.polygonOffset = true;
  wingPatternMat.polygonOffsetFactor = -2;
  wingPatternMat.polygonOffsetUnits = -2;

  const wingPatternL = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.006, 0.42), wingPatternMat);
  wingPatternL.position.set(-6.25, -0.04, 11.8);
  wingPatternL.rotation.set(0, 0, -0.012);
  mainWingL.add(wingPatternL);

  const wingPatternR = wingPatternL.clone();
  wingPatternR.position.z *= -1;
  wingPatternR.rotation.y *= -1;
  mainWingR.add(wingPatternR);


  // Tail section rebuilt from scratch (主翼はそのまま): horizontal tailplanes + vertical stabilizers + jet units
  // Horizontal tail is defined independently, but keeps exactly the same shape as the main wing (uniform scale only).
  const tailplaneBaseShape = [
    [8.6, 0.7],
    [-5.2, 18.8],
    [-10.6, 18.8],
    [-8.0, 0.7],
  ];
  const tailplaneScale = 0.44;
  const tailplaneShape = tailplaneBaseShape.map(([x, z]) => [x * tailplaneScale, z * tailplaneScale]);
  const tailplaneLocalMinX = Math.min(...tailplaneShape.map(([x]) => x));
  const jetBodyRearX = -40.7; // rear edge of the physical jet body (nozzle), excluding flame
  const tailJetProtrusion = 3.8; // move horizontal tail further forward while keeping jet-body protrusion
  const tailplaneX = jetBodyRearX - tailplaneLocalMinX + tailJetProtrusion;

  const tailplaneGeo = buildSurface(tailplaneShape, 0.34);
  const tailplaneGeoMirror = buildSurface(mirrorPoints(tailplaneShape), 0.34);
  const tailplaneL = new THREE.Mesh(tailplaneGeo, wingMat);
  tailplaneL.position.set(tailplaneX, 1.15, 2.2);
  tailplaneL.rotation.set(0, 0, 0);
  const tailplaneR = new THREE.Mesh(tailplaneGeoMirror, wingMat);
  tailplaneR.position.set(tailplaneX, 1.15, -2.2);
  tailplaneR.rotation.set(0, 0, 0);

  // Vertical fin: trapezoid planform with a forward-sliding leading edge (前方が前に滑る台形)
  const finShape = [
    [-34.5, 3.4], // moved 1.0 forward; lower edge is horizontal/parallel to upper edge
    [-28.6, 3.4],
    [-31.7, 10.2],
    [-34.5, 10.2],
  ];
  const finCenter = new THREE.Mesh(buildVerticalSurface(finShape, 0.8), wingMat);
  finCenter.position.set(0, 0, 0);
  finCenter.rotation.z = 0;

  // Rebuilt single center jet: smaller and simpler with a clear exhaust hole.
  // Keep engine core from occupying the nozzle opening region so the rear hole remains visually open.
  const engineCore = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.95, 19.8, 24), bodyMat);
  engineCore.rotation.z = -Math.PI * 0.5;
  engineCore.position.set(-23.0, 1.15, 0);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.1, 6.0, 28, 1, true), nozzleMetalMat);
  nozzle.rotation.z = Math.PI * 0.5;
  nozzle.position.set(-32.7, 1.15, 0);

  const nozzleInner = new THREE.Mesh(
    new THREE.CylinderGeometry(2.85, 2.945, 6.0, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xa8b0ba, roughness: 0.24, metalness: 0.95, side: THREE.BackSide })
  );
  nozzleInner.rotation.z = Math.PI * 0.5;
  nozzleInner.position.copy(nozzle.position);

  const nozzleLipLength = 4.0;
  const nozzleLipOuterFrontRadius = 2.85;
  const nozzleLipOuterRearRadius = 2.945;
  const nozzleLipThickness = 1.0;
  const nozzleLipInnerMidRadius = ((nozzleLipOuterFrontRadius + nozzleLipOuterRearRadius) * 0.5) - nozzleLipThickness;
  const nozzleLipInnerFrontRadius = nozzleLipInnerMidRadius * 0.94;
  const nozzleLipInnerRearRadius = nozzleLipInnerMidRadius * 0.8;
  const nozzleLipProfile = [
    new THREE.Vector2(nozzleLipOuterRearRadius, -nozzleLipLength * 0.5),
    new THREE.Vector2(nozzleLipOuterFrontRadius, nozzleLipLength * 0.5),
    new THREE.Vector2(nozzleLipInnerFrontRadius, nozzleLipLength * 0.5),
    new THREE.Vector2(nozzleLipInnerMidRadius, 0),
    new THREE.Vector2(nozzleLipInnerRearRadius, -nozzleLipLength * 0.5),
  ];
  const nozzleLip = new THREE.Mesh(
    new THREE.LatheGeometry(nozzleLipProfile, 36),
    new THREE.MeshStandardMaterial({ color: 0xa8b0ba, roughness: 0.24, metalness: 0.95, side: THREE.DoubleSide })
  );
  nozzleLip.rotation.z = Math.PI * 0.5;
  nozzleLip.position.set(-33.7, 1.15, 0);

  // Afterburner rebuilt from scratch: bright nozzle bloom + dense flame cone + long cool plume + shock-diamond rings.
  const nozzleGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.62, 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0xc5e6ff,
      transparent: true,
      opacity: 0.28,
        depthWrite: false,
    })
  );
  nozzleGlow.position.set(-35.72, 1.15, 0);

  const flameCore = new THREE.Mesh(
    new THREE.CylinderGeometry(1.26, 0.06, 13.4, 30, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x4f8ee8,
      transparent: true,
      opacity: 0.3,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flameCore.rotation.z = -Math.PI * 0.5;
  flameCore.position.set(-39.8, 1.15, 0);

  const flameOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(1.44, 0.22, 16.8, 34, 1, false),
    new THREE.MeshBasicMaterial({
      color: 0x7fb7ff,
      transparent: true,
      opacity: 0.24,
        depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flameOuter.rotation.z = -Math.PI * 0.5;
  flameOuter.position.set(-42.4, 1.15, 0);


  const nozzleHeatCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.22, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff6a3a,
      transparent: true,
      opacity: 0.34,
        depthWrite: false,
    })
  );
  nozzleHeatCore.position.set(-35.05, 1.15, 0);

  const nozzleHeatLines = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const streak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.065, 2.3, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff4328,
        transparent: true,
        opacity: 0.62,
            depthWrite: false,
        depthTest: false,
      })
    );
    streak.rotation.x = (Math.PI * i) / 3;
    streak.rotation.z = ((i % 2) - 0.5) * 0.1;
    streak.position.set(0, 0, 0);
    nozzleHeatLines.add(streak);
  }
  nozzleHeatLines.position.set(-34.45, 1.15, 0);

  const shockRings = [];
  const shockRingRadii = [1.45, 1.7];
  const shockRingBaseX = [-37.2, -39.25];
  for (let i = 0; i < shockRingRadii.length; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(shockRingRadii[i], 0.09, 10, 24),
      new THREE.MeshBasicMaterial({
        color: 0x8fc3ff,
        transparent: true,
        opacity: 0.26,
            depthWrite: false,
      })
    );
    ring.rotation.y = Math.PI * 0.5;
    ring.position.set(shockRingBaseX[i], 1.15, 0);
    ring.userData.offset = i;
    shockRings.push(ring);
  }

  nozzleGlow.userData.baseX = nozzleGlow.position.x;
  flameCore.userData.baseX = flameCore.position.x;
  flameOuter.userData.baseX = flameOuter.position.x;
  nozzleHeatCore.userData.baseX = nozzleHeatCore.position.x;
  nozzleHeatLines.userData.baseX = nozzleHeatLines.position.x;
  shockRings.forEach((ring) => { ring.userData.baseX = ring.position.x; });

  const missileBodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 6.6, 12);
  missileBodyGeo.rotateZ(-Math.PI * 0.5);
  const missileNoseGeo = new THREE.ConeGeometry(0.42, 1.3, 12);
  missileNoseGeo.rotateZ(-Math.PI * 0.5);
  missileNoseGeo.translate(3.95, 0, 0);
  const missileMat = new THREE.MeshStandardMaterial({ color: isPlayer ? 0xd6e4f2 : 0xd4d6cf, emissive: isPlayer ? 0x243749 : 0x1f1f1f, emissiveIntensity: 0.2, roughness: 0.34, metalness: 0.72 });

  function buildWingMissile(side = 1) {
    const missileGroup = new THREE.Group();
    const body = new THREE.Mesh(missileBodyGeo, missileMat);
    const nose = new THREE.Mesh(missileNoseGeo, missileMat);
    const finMat = accentMat.clone();
    finMat.emissiveIntensity = 0.1;
    const finGeo = new THREE.BoxGeometry(1.1, 0.06, 0.7);
    const finTop = new THREE.Mesh(finGeo, finMat);
    finTop.position.set(-1.1, 0.38, 0);
    const finBottom = finTop.clone();
    finBottom.position.y = -0.38;
    const finSide = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.06), finMat);
    finSide.position.set(-1.1, 0, 0.34);
    const finSideOpp = finSide.clone();
    finSideOpp.position.z = -0.34;
    missileGroup.add(body, nose, finTop, finBottom, finSide, finSideOpp);
    missileGroup.position.set(-17.2, 1.2, side * 19.2);
    return missileGroup;
  }

  const wingMissileL = buildWingMissile(1);
  const wingMissileR = buildWingMissile(-1);

  g.add(
    centerSpine, forwardSpineTaper, forwardTaperTopBulge, dorsalFlowHump, cockpitShoulderBulge, upperSpineBlendBulge, cockpitBlend, cockpitBody, cockpitFairing, dorsalDeck, cockpitGlass, noseSection, noseCone,
    mainWingL, mainWingR,
    wingMissileL, wingMissileR,
    tailplaneL, tailplaneR, finCenter,
    engineCore, nozzle, nozzleInner, nozzleLip,
    nozzleGlow, flameCore, flameOuter, nozzleHeatCore, nozzleHeatLines, ...shockRings
  );

  // Keep aircraft visually facing gameplay forward (+X). Model itself is built with nose on +Z.
  g.rotation.y = -Math.PI * 0.5;

  g.scale.setScalar(1.24);
  g.position.set(0, 300, 0);
  g.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.frustumCulled = false;
    }
  });

  const lockOutline = new THREE.Group();
  const lockOutlineMat = new THREE.LineBasicMaterial({
    color: 0xff2c2c,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false,
  });
  g.traverse((node) => {
    if (!node.isMesh) return;
    if (!node.geometry) return;

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry, 30), lockOutlineMat);
    edges.position.copy(node.position);
    edges.quaternion.copy(node.quaternion);
    edges.scale.copy(node.scale).multiplyScalar(1.14);
    edges.renderOrder = 121;
    edges.frustumCulled = false;
    edges.userData.baseScale = edges.scale.clone();
    lockOutline.add(edges);
  });
  lockOutline.visible = false;
  lockOutline.userData = { lineMat: lockOutlineMat };
  g.add(lockOutline);

  world.add(g);

  const plane = {
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
    hpLabel: null,
    lockOutline,
    exhaust: {
      nozzleGlow,
      flameCore,
      flameOuter,
      nozzleHeatCore,
      nozzleHeatLines,
      shockRings,
    },
    missiles: [wingMissileL, wingMissileR],
    missileAmmo: MISSILE_MAX_AMMO,
    missileCooldown: 0,
    missileTarget: null,
  };

  return plane;
}

function updatePlaneExhaust(plane, boostLevel = 0) {
  if (!plane || !plane.exhaust) return;
  const t = performance.now() * 0.001;
  const pulse = 1 + Math.sin(t * 32 + plane.mesh.id * 0.73) * 0.07;
  const shimmer = Math.sin(t * 21 + plane.mesh.id * 0.31) * 0.05;
  const turbulence = Math.sin(t * 17 + plane.mesh.id * 0.42) * 0.12;
  const boostMix = clamp(boostLevel, 0, 1);

  const coreLengthIdle = (0.84 + boostLevel * 0.42) * pulse;
  const coreLengthBoost = (1.22 + boostLevel * 1.18) * (pulse + 0.03);
  const coreLength = THREE.MathUtils.lerp(coreLengthIdle, coreLengthBoost, Math.pow(boostMix, 0.9));

  const outerLengthIdle = (0.92 + boostLevel * 1.1) * (pulse + 0.02);
  const outerLengthBoost = (1.16 + boostLevel * 1.58) * (pulse + 0.03);
  const outerLength = THREE.MathUtils.lerp(outerLengthIdle, outerLengthBoost, boostMix);

  const coreRadiusIdle = 0.92 + boostLevel * 0.14 + shimmer * 0.45;
  const coreRadiusBoost = 1.52 + boostLevel * 0.4 + shimmer * 0.72;
  const coreRadius = THREE.MathUtils.lerp(coreRadiusIdle, coreRadiusBoost, Math.pow(boostMix, 0.66));

  const outerRadiusIdle = 0.8 + boostLevel * 0.2 + shimmer;
  const outerRadiusBoost = 1.12 + boostLevel * 0.4 + shimmer * 1.35;
  const outerRadius = THREE.MathUtils.lerp(outerRadiusIdle, outerRadiusBoost, boostMix);

  const glowScaleIdle = 0.84 + boostLevel * 0.28 + pulse * 0.03;
  const glowScaleBoost = 0.98 + boostLevel * 0.56 + pulse * 0.05;
  plane.exhaust.nozzleGlow.scale.setScalar(THREE.MathUtils.lerp(glowScaleIdle, glowScaleBoost, boostMix));

  const glowOpacityIdle = clamp(0.18 + boostLevel * 0.38 + pulse * 0.03, 0.1, 0.56);
  const glowOpacityBoost = clamp(0.56 + boostLevel * 0.46 + pulse * 0.06, 0.3, 1.0);
  plane.exhaust.nozzleGlow.material.opacity = THREE.MathUtils.lerp(glowOpacityIdle, glowOpacityBoost, boostMix);

  const innerFlameRadiusScale = 1 - boostMix * 0.1;
  plane.exhaust.flameCore.scale.set(coreRadius * innerFlameRadiusScale, coreLength, coreRadius * innerFlameRadiusScale);
  const coreBaseX = plane.exhaust.flameCore.userData.baseX != null ? plane.exhaust.flameCore.userData.baseX : plane.exhaust.flameCore.position.x;
  const coreShiftIdle = (coreLength - 1) * 3.5;
  const coreShiftBoost = (coreLength - 1) * 7.2;
  plane.exhaust.flameCore.position.x = coreBaseX - THREE.MathUtils.lerp(coreShiftIdle, coreShiftBoost, boostMix);
  const coreOpacityIdle = clamp(0.24 + boostLevel * 0.3 + pulse * 0.03, 0.16, 0.62);
  const coreOpacityBoost = clamp(0.62 + boostLevel * 0.58 + pulse * 0.05, 0.46, 1.0);
  plane.exhaust.flameCore.material.opacity = THREE.MathUtils.lerp(coreOpacityIdle, coreOpacityBoost, Math.pow(boostMix, 0.72));

  plane.exhaust.flameOuter.scale.set(outerRadius, outerLength, outerRadius);
  const outerBaseX = plane.exhaust.flameOuter.userData.baseX != null ? plane.exhaust.flameOuter.userData.baseX : plane.exhaust.flameOuter.position.x;
  const outerShiftIdle = (outerLength - 1) * 4.9;
  const outerShiftBoost = (outerLength - 1) * 6.3;
  plane.exhaust.flameOuter.position.x = outerBaseX - THREE.MathUtils.lerp(outerShiftIdle, outerShiftBoost, boostMix);
  plane.exhaust.flameOuter.position.z = THREE.MathUtils.lerp(turbulence * 0.34, turbulence * 0.42, boostMix);
  const outerOpacityIdle = clamp(0.16 + boostLevel * 0.2 + pulse * 0.03, 0.08, 0.5);
  const outerOpacityBoost = clamp(0.34 + boostLevel * 0.2 + pulse * 0.04, 0.22, 0.62);
  plane.exhaust.flameOuter.material.opacity = THREE.MathUtils.lerp(outerOpacityIdle, outerOpacityBoost, Math.pow(boostMix, 0.86));

  const innerBlueDepth = clamp(0.82 + boostMix * 0.06 + pulse * 0.02, 0.8, 1.0 + boostMix * 0.5);
  const innerWarm = clamp(0.34 + boostMix * 0.86 + pulse * 0.03, 0.32, 1.0 + boostMix * 0.5);
  const innerGreen = clamp(0.44 + boostMix * 0.76 + pulse * 0.03, 0.42, 1.0 + boostMix * 0.5);
  plane.exhaust.flameCore.material.color.setRGB(innerWarm, innerGreen, innerBlueDepth);

  const outerBlueGlow = clamp(0.9 + boostMix * 0.08 + pulse * 0.015, 0.86, 1.0);
  plane.exhaust.flameOuter.material.color.setRGB(0.12, 0.34 + boostMix * 0.06, outerBlueGlow);

  const nozzleHeatPulse = 0.86 + Math.sin(t * 24 + plane.mesh.id * 0.57) * 0.14;
  const heatCoreScale = THREE.MathUtils.lerp(0.82, 0.98 + boostMix * 0.2, boostMix) * nozzleHeatPulse;
  plane.exhaust.nozzleHeatCore.scale.setScalar(heatCoreScale);
  const heatCoreBaseX = plane.exhaust.nozzleHeatCore.userData.baseX != null ? plane.exhaust.nozzleHeatCore.userData.baseX : plane.exhaust.nozzleHeatCore.position.x;
  plane.exhaust.nozzleHeatCore.position.x = heatCoreBaseX - THREE.MathUtils.lerp(0.25, 1.6, boostMix);
  plane.exhaust.nozzleHeatCore.material.opacity = clamp(0.2 + boostMix * 0.18 + nozzleHeatPulse * 0.08, 0.14, 0.46);
  plane.exhaust.nozzleHeatCore.material.color.setRGB(
    clamp(0.84 + boostMix * 0.16, 0.72, 1.0),
    clamp(0.2 + boostMix * 0.24, 0.14, 0.56),
    clamp(0.12 + boostMix * 0.06, 0.08, 0.22)
  );

  const heatLinesBaseX = plane.exhaust.nozzleHeatLines.userData.baseX != null ? plane.exhaust.nozzleHeatLines.userData.baseX : plane.exhaust.nozzleHeatLines.position.x;
  plane.exhaust.nozzleHeatLines.position.x = heatLinesBaseX - THREE.MathUtils.lerp(0.2, 1.35, boostMix);
  plane.exhaust.nozzleHeatLines.rotation.x = Math.PI * 0.5 + Math.sin(t * 4.2 + plane.mesh.id * 0.19) * 0.1;
  plane.exhaust.nozzleHeatLines.rotation.z = Math.sin(t * 2.8 + plane.mesh.id * 0.13) * 0.12;
  plane.exhaust.nozzleHeatLines.children.forEach((streak, index) => {
    const streakPulse = 0.9 + Math.sin(t * 7.2 + index * 0.9 + plane.mesh.id * 0.17) * 0.1;
    streak.material.opacity = clamp(0.74 + streakPulse * 0.4, 0.72, 1.0);
    streak.material.color.setRGB(
      2.0,
      0.16,
      0.08
    );
  });

  const shockRingBoostScaleByOffset = {
    0: (2.45 * 0.85 * 1.1) / 1.45,
    1: (2.88 * 0.85) / 1.7,
  };
  const shockRingSizeMultiplier = 1.2;
  plane.exhaust.shockRings.forEach((ring) => {
    const offset = ring.userData.offset != null ? ring.userData.offset : 0;
    const phaseSpeed = THREE.MathUtils.lerp(2.4, 10.0, Math.pow(boostMix, 0.82));
    const phaseSpeed = THREE.MathUtils.lerp(2.4, 12.0, Math.pow(boostMix, 0.82));
    const phase = t * phaseSpeed - offset * 0.72 + plane.mesh.id * 0.05;
    const travel = (Math.sin(phase) + 1) * 0.5;
    const baseX = ring.userData.baseX != null ? ring.userData.baseX : ring.position.x;

    const speedMix = Math.pow(boostMix, 2.6);
    const pulseSpeedA = THREE.MathUtils.lerp(4.1, 10.8, speedMix);
    const pulseSpeedB = THREE.MathUtils.lerp(1.9, 5.6, speedMix);
    const speedMix = Math.pow(boostMix, 2.6);
    const pulseSpeedA = THREE.MathUtils.lerp(4.1, 8.6, speedMix);
    const pulseSpeedB = THREE.MathUtils.lerp(1.9, 4.2, speedMix);
    const ringPulse = 0.94
      + Math.sin(t * pulseSpeedA + offset * 1.2 + plane.mesh.id * 0.11) * 0.08
      + Math.sin(t * pulseSpeedB + offset * 0.7 + plane.mesh.id * 0.03) * 0.03;

    const boostScaleTarget = shockRingBoostScaleByOffset[offset] != null ? shockRingBoostScaleByOffset[offset] : 1.1;
    const boostScale = THREE.MathUtils.lerp(0.9, boostScaleTarget, Math.pow(boostMix, 0.68));
    const boostBackShift = THREE.MathUtils.lerp(0.04, 0.56, boostMix);
    ring.position.x = baseX - travel * THREE.MathUtils.lerp(0.32, 1.7, boostMix) - boostBackShift;
    ring.scale.setScalar(shockRingSizeMultiplier * boostScale * ringPulse);

    const ringOpacityBase = 0.14 + boostMix * 0.22;
    const opacityWaveSpeed = THREE.MathUtils.lerp(2.1, 7.4, speedMix);
    const opacityWaveSpeed = THREE.MathUtils.lerp(2.1, 5.4, speedMix);
    ring.material.opacity = clamp(ringOpacityBase + Math.sin(t * opacityWaveSpeed + offset * 0.9) * 0.04, 0.08, 0.5);
    ring.material.color.setRGB(0.52 + boostMix * 0.2, 0.74 + boostMix * 0.12, 1.0);
  });

  plane.exhaust.nozzleGlow.material.color.setHex(0xbfe7ff);

}

function spawnBullet(owner, color) {
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 })
  );
  const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  b.position.copy(owner.mesh.position).addScaledVector(dir, 28);
  b.userData = {
    vel: dir.multiplyScalar(1350),
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

function spawnMissileExplosion(position) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(5, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd58e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  flash.position.copy(position);
  world.add(flash);
  game.effects.push({ mesh: flash, life: 0.34, scaleRate: 11 });

  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x6d7988, transparent: true, opacity: 0.52, depthWrite: false })
  );
  smoke.position.copy(position);
  world.add(smoke);
  game.effects.push({ mesh: smoke, life: 0.62, scaleRate: 5.4 });
}

function getBestLockTarget(shooter, lockRange = MISSILE_LOCK_RANGE, lockDot = MISSILE_LOCK_DOT) {
  const candidates = shooter.isPlayer
    ? game.bots
    : [game.player, ...game.bots];
  const lockOrigin = shooter.isPlayer ? camera.position : shooter.mesh.position;
  const aimForward = shooter.isPlayer
    ? new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize()
    : new THREE.Vector3(1, 0, 0).applyQuaternion(shooter.mesh.quaternion).normalize();
  let best = null;
  let bestScore = -Infinity;

  for (const target of candidates) {
    if (!target || !target.alive || target === shooter) continue;
    const targetPos = getLockAimPoint(target, tmpVecA);
    const toTarget = targetPos.sub(lockOrigin);
    const dist = toTarget.length();
    if (dist > lockRange) continue;
    const dirToTarget = toTarget.normalize();
    const dot = aimForward.dot(dirToTarget);
    if (dot < lockDot) continue;
    if (!hasLineOfSight(lockOrigin, target)) continue;
    const centerBias = (1 - dot) * 0.9;
    const score = dot * 5.1 - dist / lockRange - centerBias;
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }
  return best;
}

function spawnMissile(owner, target) {
  if (!owner.alive || owner.missileAmmo <= 0 || !target || !target.alive) return false;
  const index = owner.missiles.findIndex((m) => m.visible);
  if (index < 0) return false;
  const attachedMesh = owner.missiles[index];
  attachedMesh.visible = false;

  const missile = attachedMesh.clone(true);
  const launchPos = attachedMesh.getWorldPosition(new THREE.Vector3());
  const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  missile.position.copy(launchPos).addScaledVector(forward, 3.2);
  missile.quaternion.copy(owner.mesh.quaternion);
  const cruiseSpeed = MISSILE_SPEED;
  missile.userData = {
    owner,
    team: owner.isPlayer ? "player" : "bot",
    target,
    velocity: forward.multiplyScalar(cruiseSpeed),
    cruiseSpeed,
    life: 10.5,
    smokeTick: 0,
    motorTick: 0,
  };
  world.add(missile);
  game.missiles.push(missile);
  owner.missileAmmo -= 1;
  owner.missileCooldown = 0.32;
  return true;
}

function updateEffects(dt) {
  game.playerHitTimer = Math.max(0, game.playerHitTimer - dt);
  game.hitConfirmTimer = Math.max(0, game.hitConfirmTimer - dt);
  game.missileIncomingTimer = Math.max(0, game.missileIncomingTimer - dt);
  healthEl.classList.toggle("flash", game.playerHitTimer > 0);
  crosshairEl.classList.toggle("hit", game.hitConfirmTimer > 0);
  if (missileWarningEl) missileWarningEl.hidden = game.missileIncomingTimer <= 0;

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
  p.missileCooldown -= dt;
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

  if (
    game.boostAutoDropAt != null
    && performance.now() >= game.boostAutoDropAt
  ) {
    if (boostLeverState.applyLevel) boostLeverState.applyLevel(0);
    game.boostAutoDropAt = null;
  }

  const boostAllowed = game.boostAutoDropAt == null && game.boostFuel > 0.01;
  const boostLevel = input.boostLevel > 0 && boostAllowed ? input.boostLevel : 0;
  if (boostLevel > 0) {
    const boostFuelBurnRate = BOOST_FUEL_BURN_BASE_PER_SEC * boostLevel * (1 + BOOST_FUEL_BURN_CURVE * boostLevel * boostLevel);
    game.boostFuel = Math.max(0, game.boostFuel - boostFuelBurnRate * dt);
    if (game.boostFuel <= 0.01) {
      game.boostFuel = 0;
      if (keys.has("ShiftLeft") || keys.has("ShiftRight")) game.shiftBoostRelatchRequired = true;
      if (boostLeverState.level > 0 && game.boostAutoDropAt == null) {
        game.boostAutoDropAt = performance.now() + 1000;
      }
    }
  } else if (game.boostAutoDropAt == null) {
    game.boostFuel = Math.min(BOOST_FUEL_MAX, game.boostFuel + 12 * dt);
  } else {
    game.boostFuel = 0;
  }

  const targetSpeed = p.speed + boostLevel * BOOST_SPEED_BONUS_MAX;
  updatePlaneExhaust(p, boostLevel);
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

  if (game.missileLockTarget && game.missileLockTarget.alive) {
    const lockTargetPos = getLockAimPoint(game.missileLockTarget, tmpVecA);
    const toTarget = lockTargetPos.sub(camera.position);
    const dist = toTarget.length();
    const aimForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const dot = aimForward.dot(toTarget.normalize());
    const inRange = dist <= MISSILE_LOCK_DROP_RANGE;
    const inSight = dot >= MISSILE_LOCK_DROP_DOT && hasLineOfSight(camera.position, game.missileLockTarget);

    if (!inRange) {
      game.missileLockTarget = null;
      game.missileLockLostTimer = 0;
    } else if (inSight) {
      game.missileLockLostTimer = 0;
    } else {
      game.missileLockLostTimer += dt;
      if (game.missileLockLostTimer >= 1) {
        game.missileLockTarget = null;
        game.missileLockLostTimer = 0;
      }
    }
  } else {
    game.missileLockLostTimer = 0;
  }

  if (input.lockTogglePressed) {
    if (!game.missileLockTarget) {
      game.missileLockTarget = getBestLockTarget(p);
      game.missileLockLostTimer = 0;
    } else {
      game.missileLockTarget = null;
      game.missileLockLostTimer = 0;
    }
  }

  if (input.missileLaunchPressed && game.missileLockTarget && p.missileAmmo > 0 && p.missileCooldown <= 0) {
    if (spawnMissile(p, game.missileLockTarget)) {
      game.missileLockTarget = null;
      game.missileLockLostTimer = 0;
    }
  }

  if (input.missileLaunchPressed && game.missileLockTarget && p.missileAmmo > 0 && p.missileCooldown <= 0) {
    if (spawnMissile(p, game.missileLockTarget)) game.missileLockTarget = null;
  }
}


function selectBotCombatTarget(bot) {
  const candidates = [];
  if (game.player && game.player.alive) candidates.push(game.player);
  for (const other of game.bots) {
    if (other !== bot && other.alive) candidates.push(other);
  }
  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = Infinity;
  for (const target of candidates) {
    const distSq = bot.mesh.position.distanceToSquared(target.mesh.position);
    const playerBias = target.isPlayer ? 0.94 : 1.0;
    const score = distSq * playerBias;
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  }
  return best;
}

function updateBots(dt) {
  const botMinSpeed = 150;
  const botMaxSpeed = 560;

  for (const b of game.bots) {
    if (!b.alive) continue;

    b.cooldown -= dt;
    b.missileCooldown -= dt;
    b.target = selectBotCombatTarget(b);
    if (!b.target) continue;

    const toTarget = b.target.mesh.position.clone().sub(b.mesh.position);
    const dist = Math.max(1, toTarget.length());
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(b.mesh.quaternion).normalize();
    const lead = b.target.velocity.clone().multiplyScalar(clamp(dist / 760, 0.08, 0.48));
    const desired = toTarget.add(lead).normalize();
    const avoidNear = obstacleAvoidance(b.mesh.position, forward, 140);
    const avoidFar = obstacleAvoidance(b.mesh.position, forward, 230);
    const avoid = avoidNear.multiplyScalar(1.8).addScaledVector(avoidFar, 0.9);
    const threat = obstacleThreat(b.mesh.position, forward);
    const altitudeErr = clamp((b.target.mesh.position.y - b.mesh.position.y) / 260, -1, 1);

    const steer = desired.clone().addScaledVector(avoid, 1.8 + threat * 1.4);
    steer.y += altitudeErr * (0.25 + threat * 0.55);
    if (threat > 0.01) {
      steer.y = Math.max(steer.y, 0.18 + threat * 0.4);
    }
    steer.normalize();

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

    const throttleTargetBase = dist > 650 ? 0.9 : dist > 360 ? 0.45 : 0.1;
    const throttleTarget = throttleTargetBase * (1 - threat * 0.65);
    const pseudoBoost = clamp((throttleTarget - 0.25) / 0.65, 0, 0.55);
    updatePlaneExhaust(b, pseudoBoost);
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

    if (b.missileAmmo > 0 && b.missileCooldown <= 0) {
      if (!b.missileTarget || !b.missileTarget.alive) b.missileTarget = getBestLockTarget(b);

      const noLaunchPhase = game.matchElapsed < 5;
      const missilesFired = MISSILE_MAX_AMMO - b.missileAmmo;
      const launchChanceByShot = missilesFired <= 0 ? dt * 0.2 : dt * 0.1;
      const launchRangeFactor = missilesFired <= 0 ? 0.93 : 0.9;

      if (!noLaunchPhase
        && b.missileTarget
        && dist < MISSILE_LOCK_RANGE * launchRangeFactor
        && aimDot > 0.9
        && Math.random() < launchChanceByShot) {
        spawnMissile(b, b.missileTarget);
        b.missileTarget = null;
      }
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
        hitPlane(t, 1, b.userData.team);
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

function updateMissiles(dt) {
  const playerPos = game.player && game.player.mesh ? game.player.mesh.position : null;

  for (let i = game.missiles.length - 1; i >= 0; i--) {
    const m = game.missiles[i];
    const data = m.userData;
    data.life -= dt;
    const prevPos = m.position.clone();

    const target = data.target;
    if (target && target.alive) {
      const targetCenter = target.mesh.getWorldPosition(new THREE.Vector3());
      const toTarget = targetCenter.clone().sub(m.position);
      const dist = Math.max(1, toTarget.length());
      const leadTime = clamp(dist / Math.max(data.cruiseSpeed, 1), 0.08, 0.8);
      const aimPoint = targetCenter.clone().addScaledVector(target.velocity, leadTime * 0.88);
      const desiredDir = aimPoint.sub(m.position).normalize();
      const currentDir = data.velocity.clone().normalize();
      currentDir.lerp(desiredDir, clamp(MISSILE_TURN_RATE * dt, 0, 0.24)).normalize();
      data.velocity.copy(currentDir.multiplyScalar(data.cruiseSpeed));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), currentDir);
    }

    m.position.addScaledVector(data.velocity, dt);

    data.motorTick += dt;
    if (data.motorTick > 0.03) {
      data.motorTick = 0;
      const jet = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffb86d, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      jet.position.copy(m.position).addScaledVector(data.velocity.clone().normalize(), -2.9);
      world.add(jet);
      game.effects.push({ mesh: jet, life: 0.2, scaleRate: 8.8 });
    }
    data.smokeTick += dt;
    if (data.smokeTick > 0.06) {
      data.smokeTick = 0;
      const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x768190, transparent: true, opacity: 0.56, depthWrite: false })
      );
      smoke.position.copy(m.position).addScaledVector(data.velocity.clone().normalize(), -2.4);
      world.add(smoke);
      game.effects.push({ mesh: smoke, life: 0.52, scaleRate: 4.4 });
    }

    let exploded = false;

    const targets = data.team === "player" ? game.bots : [game.player];
    for (const t of targets) {
      if (!t || !t.alive) continue;
      const seg = tmpVecA.subVectors(m.position, prevPos);
      const segLenSq = Math.max(1e-6, seg.lengthSq());
      const targetCenter = t.mesh.getWorldPosition(new THREE.Vector3());
      const toCenter = tmpVecB.subVectors(targetCenter, prevPos);
      const proj = clamp(toCenter.dot(seg) / segLenSq, 0, 1);
      const closest = tmpVecC.copy(prevPos).addScaledVector(seg, proj);
      if (closest.distanceToSquared(targetCenter) < 40 * 40) {
        hitPlane(t, 30, data.team);
        exploded = true;
        break;
      }
    }

    if (!exploded && intersectsObstacleSegment(prevPos, m.position, 0.45)) {
      if (target && target.alive && m.position.distanceToSquared(target.mesh.getWorldPosition(new THREE.Vector3())) < 95 * 95) {
        hitPlane(target, 30, data.team);
      }
      exploded = true;
    }
    if (!exploded && (Math.abs(m.position.x) > ARENA * 1.02 || Math.abs(m.position.z) > ARENA * 1.02 || m.position.y < FLOOR_Y + 4 || m.position.y > 980)) exploded = true;

    if (!exploded && playerPos && data.team === "bot") {
      const toPlayer = playerPos.clone().sub(m.position).normalize();
      const facingPlayer = data.velocity.clone().normalize().dot(toPlayer);
      const distPlayer = m.position.distanceTo(playerPos);
      if (facingPlayer > 0.66 && distPlayer < 760) game.missileIncomingTimer = 0.24;
    }

    if (exploded || data.life <= 0) {
      spawnMissileExplosion(m.position);
      world.remove(m);
      game.missiles.splice(i, 1);
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
  const lockTarget = game.missileLockTarget;
  game.bots.forEach((bot) => {
    if (!bot.lockOutline) return;
    const visible = bot === lockTarget && bot.alive;
    bot.lockOutline.visible = visible;
    if (!visible) return;

    const playerMeshPos = game.player && game.player.mesh ? game.player.mesh.position : null;
    const dist = playerMeshPos ? playerMeshPos.distanceTo(bot.mesh.position) : 600;
    const emphasis = clamp((dist - 220) / 1500, 0, 1);
    const lineOpacity = clamp((0.58 + emphasis * 0.26) * 1.8, 0, 0.70);
    const scaleMul = 1.08 + emphasis * 0.16;
    const lineMat = bot.lockOutline.userData ? bot.lockOutline.userData.lineMat : null;
    if (lineMat) lineMat.opacity = lineOpacity;

    bot.lockOutline.children.forEach((child) => {
      const base = child.userData.baseScale;
      if (base) child.scale.copy(base).multiplyScalar(scaleMul);
    });
  });

  updateHudHealthPanel();
  const missileAmmo = game.player && game.player.missileAmmo != null ? game.player.missileAmmo : 0;
  ammoEl.textContent = `MSL ${missileAmmo} | AMMO ${Math.round(game.ammo)}`;
  boostStatEl.textContent = `BOOST ${Math.round((game.boostFuel / BOOST_FUEL_MAX) * 100)}%`;
  if (missileBtn) missileBtn.textContent = lockTarget ? "LOCK OFF" : "LOCK ON";
  if (lockOnCueEl) {
    if (lockTarget && lockTarget.alive) {
      lockOnCueEl.hidden = false;
      lockOnCueEl.textContent = `LOCK ON EN${Math.max(1, game.bots.indexOf(lockTarget) + 1)}`;
    } else {
      lockOnCueEl.hidden = true;
    }
  }
  if (lockCancelBtn) {
    lockCancelBtn.textContent = "LAUNCH";
    lockCancelBtn.hidden = !lockTarget;
  }

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


function clearPlaneHpLabel(plane) {
  if (plane && plane.hpLabel) {
    world.remove(plane.hpLabel);
    plane.hpLabel = null;
  }
  if (plane && plane.lockOutline) {
    if (plane.mesh && plane.mesh.remove) plane.mesh.remove(plane.lockOutline);
    plane.lockOutline = null;
  }
}

function resetMatch() {
  for (const b of game.bullets) world.remove(b);
  game.bullets = [];
  for (const m of game.missiles) world.remove(m);
  game.missiles = [];
  if (game.player) {
    clearPlaneHpLabel(game.player);
    world.remove(game.player.mesh);
  }
  for (const b of game.bots) {
    clearPlaneHpLabel(b);
    world.remove(b.mesh);
  }
  for (const fx of game.effects) world.remove(fx.mesh);
  game.effects = [];

  game.score = 0;
  game.ammo = 60;
  game.boostFuel = BOOST_FUEL_MAX;
  game.playerHitTimer = 0;
  game.hitConfirmTimer = 0;
  game.boostAutoDropAt = null;
  game.missileLockTarget = null;
  game.missileIncomingTimer = 0;
  game.missileLockLostTimer = 0;
  game.shiftBoostRelatchRequired = false;
  game.lockToggleButtonLatch = false;
  game.lockToggleTapQueuedCount = 0;
  game.missileLaunchTapQueuedCount = 0;
  game.matchElapsed = 0;
  healthEl.classList.remove("flash");
  crosshairEl.classList.remove("hit");
  game.over = false;
  game.initialBots = 0;
  messageEl.hidden = true;
  messageEl.textContent = "";

  if (boostLeverState.applyLevel) boostLeverState.applyLevel(0);

  game.player = createFighter(0x48d7ff, true);
  game.player.mesh.position.set(0, 320, 0);
  game.player.yaw = -Math.PI * 0.2;
  game.player.pitch = 0;
  game.player.roll = 0;

  const botPalettes = [
    { body: 0xff8a3d, wing: 0x2ff7ff, accent: 0xff2fb3, cockpit: 0x12314c },
    { body: 0x7cff4c, wing: 0xff5de4, accent: 0x3d8bff, cockpit: 0x1a2340 },
    { body: 0xfff04a, wing: 0x32ff9f, accent: 0xff4c4c, cockpit: 0x35214d },
    { body: 0x57d0ff, wing: 0xff8c42, accent: 0xa14dff, cockpit: 0x1c2f45 },
    { body: 0xff62a8, wing: 0x6aff55, accent: 0x32a0ff, cockpit: 0x2b2648 },
    { body: 0x3effd5, wing: 0xff6a3d, accent: 0xd85dff, cockpit: 0x1e3243 },
  ];
  const botCount = selectedBotCount;
  game.bots = Array.from({ length: botCount }, (_, i) => {
    const bot = createFighter(botPalettes[i % botPalettes.length]);
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
  updateHudHealthPanel();
}

function syncInput() {
  const kRoll = (keys.has("KeyA") ? 1 : 0) + (keys.has("KeyD") ? -1 : 0);
  const kPitch = (keys.has("KeyW") ? -1 : 0) + (keys.has("KeyS") ? 1 : 0);
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

  const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight");
  if (!shiftHeld) game.shiftBoostRelatchRequired = false;
  const shiftBoostLevel = shiftHeld && !game.shiftBoostRelatchRequired ? 1 : 0;
  input.boostLevel = clamp(Math.max(boostLeverState.level, shiftBoostLevel), 0, 1);
  input.boost = input.boostLevel > 0.01;
  input.fire = keys.has("Space") || fireBtn.classList.contains("active");
  input.lockToggle = keys.has("KeyM");
  const keyEdgePress = input.lockToggle && !game.lockToggleButtonLatch;
  input.lockTogglePressed = keyEdgePress || game.lockToggleTapQueuedCount > 0;
  if (!keyEdgePress && game.lockToggleTapQueuedCount > 0) {
    game.lockToggleTapQueuedCount = Math.max(0, game.lockToggleTapQueuedCount - 1);
  }
  input.missileLaunchPressed = keys.has("KeyN") || game.missileLaunchTapQueuedCount > 0;
  if (game.missileLaunchTapQueuedCount > 0) {
    game.missileLaunchTapQueuedCount = Math.max(0, game.missileLaunchTapQueuedCount - 1);
  }
  game.lockToggleButtonLatch = input.lockToggle;
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
    state.pointerId = e.pointerId;
    moveFromClient(e.clientX, e.clientY);
  });

  const onPointerMove = (e) => {
    if (state.pointerId !== e.pointerId) return;
    moveFromClient(e.clientX, e.clientY);
  };

  const onPointerRelease = (e) => {
    if (state.pointerId !== e.pointerId) return;
    releaseStick();
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerRelease);
  window.addEventListener("pointercancel", onPointerRelease);

  // Fallback for very old browsers that do not support Pointer Events.
  if (!window.PointerEvent) {
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
    if (game.boostFuel <= 0.01 || game.boostAutoDropAt != null) {
      applyLevel(0);
      return;
    }
    const rect = boostLeverEl.getBoundingClientRect();
    const top = rect.top + 8;
    const bottom = rect.bottom - 8;
    const clampedY = clamp(clientY, top, bottom);
    const level = 1 - (clampedY - top) / Math.max(1, bottom - top);
    applyLevel(level);
  }

  boostLeverEl.addEventListener("pointerdown", (e) => {
    boostLeverState.pointerId = e.pointerId;
    moveFromClient(e.clientY);
  });

  const onPointerMove = (e) => {
    if (boostLeverState.pointerId !== e.pointerId) return;
    moveFromClient(e.clientY);
  };

  const release = (e) => {
    if (boostLeverState.pointerId !== e.pointerId) return;
    boostLeverState.pointerId = null;
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);

  applyLevel(0);
}


function bindActionButton(btn, onPress = null, onRelease = null) {
  if (!btn) return;
  const press = (e) => {
    e.preventDefault();
    btn.classList.add("active");
    if (onPress) onPress();
  };
  const release = (e) => {
    e.preventDefault();
    btn.classList.remove("active");
    if (onRelease) onRelease(e);
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
  } catch (err) {
    // iOS Safari fallback is PWA standalone mode.
  }
}

async function lockLandscape() {
  if (screen.orientation && screen.orientation.lock) {
    try {
      await screen.orientation.lock("landscape");
    } catch (err) {
      // Browsers may require fullscreen or block orientation lock.
    }
  }
}

function updateOrientationHint() {
  rotateHint.hidden = window.innerWidth >= window.innerHeight;
}

function setActiveTapButton(buttons, activeButton) {
  buttons.forEach((btn) => {
    const isActive = btn === activeButton;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function setupTapMenuButtons() {
  const initialBotBtn = botCountButtons.find((btn) => Number(btn.dataset.botCount) === selectedBotCount);
  if (initialBotBtn) setActiveTapButton(botCountButtons, initialBotBtn);

  const initialMapBtn = mapTypeButtons.find((btn) => btn.dataset.mapType === selectedMapType);
  if (initialMapBtn) setActiveTapButton(mapTypeButtons, initialMapBtn);

  botCountButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const next = Number(btn.dataset.botCount);
      if (!Number.isFinite(next) || next === selectedBotCount) return;
      selectedBotCount = next;
      setActiveTapButton(botCountButtons, btn);
      resetMatch();
    });
  });

  mapTypeButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const next = btn.dataset.mapType;
      if (!next || next === selectedMapType) return;
      selectedMapType = next;
      setActiveTapButton(mapTypeButtons, btn);
      buildWorld(selectedMapType);
      resetMatch();
    });
  });
}

if (!rendererReady) {
  drawRendererFallback();
  messageEl.hidden = false;
  messageEl.textContent = "3D表示を開始できませんでした。再試行してください。";
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.textContent = "再試行";
  retryBtn.style.marginTop = "12px";
  retryBtn.style.padding = "10px 16px";
  retryBtn.style.borderRadius = "999px";
  retryBtn.style.border = "1px solid rgba(170, 220, 255, 0.6)";
  retryBtn.style.background = "rgba(17, 36, 62, 0.8)";
  retryBtn.style.color = "#d8efff";
  retryBtn.style.fontWeight = "700";
  retryBtn.addEventListener("click", () => location.reload());
  messageEl.insertAdjacentElement("afterend", retryBtn);
  window.addEventListener("resize", drawRendererFallback);
} else {

canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  messageEl.hidden = false;
  messageEl.textContent = "描画コンテキストが失われました。再読み込みしてください。";
});

setupHudHealthPanel();

const startupState = { phase: "boot" };

function showFatalInitError(err, scope = "init") {
  const phase = startupState.phase || "unknown";
  console.error(`[skyace:${scope}:${phase}]`, err);
  messageEl.hidden = false;
  const text = String((err && err.message) || err || "unknown error");
  messageEl.textContent = `初期化エラー(${scope}:${phase}): ${text}`;
}

function runStartupStep(phase, fn) {
  startupState.phase = phase;
  return fn();
}

window.addEventListener("error", (event) => {
  const locationInfo = `${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`;
  showFatalInitError(event.error || `${event.message} @ ${locationInfo}`, "window.error");
});
window.addEventListener("unhandledrejection", (event) => {
  showFatalInitError(event.reason, "unhandledrejection");
});

updateMenuPanelPosition();
setupJoystick("leftStick", (x, y) => {
  stickInput.yaw = x;
  stickInput.pitch = y;
});
bindActionButton(fireBtn);
bindActionButton(missileBtn, () => { game.lockToggleTapQueuedCount += 1; });
if (lockCancelBtn) bindActionButton(lockCancelBtn, () => { game.missileLaunchTapQueuedCount += 1; });
setupBoostLever();

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["ArrowUp", "ArrowDown", "Space", "KeyM", "KeyN", "Escape", "KeyC"].includes(e.code)) e.preventDefault();
  if (e.code === "Escape" || e.code === "KeyC") {
    game.missileLockTarget = null;
    game.missileLockLostTimer = 0;
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

const restartFromHud = (e) => {
  if (e && e.preventDefault) e.preventDefault();
  resetMatch();
};

restartBtn.addEventListener("click", restartFromHud);
restartBtn.addEventListener("pointerup", restartFromHud);

let lastMenuToggleAt = 0;

function toggleMenuPanel() {
  updateMenuPanelPosition();
  menuPanel.hidden = !menuPanel.hidden;
  menuBtn.setAttribute("aria-expanded", String(!menuPanel.hidden));
  lastMenuToggleAt = performance.now();
}

menuBtn.addEventListener("pointerup", (e) => {
  e.preventDefault();
  toggleMenuPanel();
});

menuBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (performance.now() - lastMenuToggleAt < 350) return;
  toggleMenuPanel();
});

setupTapMenuButtons();

window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("selectstart", (e) => e.preventDefault());
window.addEventListener("dragstart", (e) => e.preventDefault());
window.addEventListener("gesturestart", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  fitViewport();
  updateMenuPanelPosition();
  updateOrientationHint();
});
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => {
  fitViewport();
  updateMenuPanelPosition();
});

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
  try {
    startupState.phase = "tick";
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    game.matchElapsed += dt;
    syncInput();
    updatePlayer(dt);
    updateBots(dt);
    updateBullets(dt);
    updateMissiles(dt);
    updateEffects(dt);
    updateCamera(dt);
    updateState();

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  } catch (err) {
    showFatalInitError(err, "tick");
  }
}

try {
  runStartupStep("fitViewport", () => fitViewport());
  runStartupStep("orientationHint", () => updateOrientationHint());
  runStartupStep("buildWorld", () => buildWorld(selectedMapType));
  runStartupStep("resetMatch", () => resetMatch());
  runStartupStep("startLoop", () => requestAnimationFrame(tick));
} catch (err) {
  showFatalInitError(err, "startup");
}
}
