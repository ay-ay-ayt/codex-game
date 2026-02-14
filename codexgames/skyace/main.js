import * as THREE from "../../vendor/three.module.min.js";

const canvas = document.getElementById("game");
const healthEl = document.getElementById("health");
const ammoEl = document.getElementById("ammo");
const boostStatEl = document.getElementById("boostStat");
const botCountEl = document.getElementById("botCount");
const mapTypeEl = document.getElementById("mapType");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
menuPanel.hidden = true;
menuBtn.setAttribute("aria-expanded", "false");
const messageEl = document.getElementById("message");
const rotateHint = document.getElementById("rotateHint");
const fireBtn = document.getElementById("fireBtn");
const boostLeverEl = document.getElementById("boostLever");
const crosshairEl = document.getElementById("crosshair");
let hpPanelReady = false;

const isMobile = window.matchMedia?.("(pointer: coarse)")?.matches
  || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function setupHudHealthPanel() {
  healthEl.innerHTML = "";
  hpPanelReady = true;
}

function hpBarClass(ratio) {
  if (ratio > 0.6) return "good";
  if (ratio > 0.3) return "warn";
  return "danger";
}

function hpRowMarkup(label, hp) {
  const hpInt = Math.max(0, Math.round(hp));
  const ratio = clamp(hpInt / 100, 0, 1);
  const sizeClass = "hp-row";
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

  const rows = [hpRowMarkup("YOU", game.player.hp)];
  game.bots.forEach((b, i) => {
    rows.push(hpRowMarkup(`EN${i + 1}`, b.hp));
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
    } catch {
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

const exhaustAlphaTex = textureLoader.load("../../assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_rough_2k.jpg");
exhaustAlphaTex.wrapS = THREE.ClampToEdgeWrapping;
exhaustAlphaTex.wrapT = THREE.ClampToEdgeWrapping;
exhaustAlphaTex.anisotropy = textureAnisotropy;

const fighterTextures = {
  bodyColor: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_diff_2k.jpg", [3.2, 1.1], THREE.SRGBColorSpace),
  bodyNormal: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_nor_gl_2k.jpg", [3.2, 1.1]),
  bodyRoughness: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_rough_2k.jpg", [3.2, 1.1]),
  bodyMetalness: loadTiledTexture("../../assets/polyhaven/textures/metal_plate/metal_plate_metal_2k.jpg", [3.2, 1.1]),
  trimColor: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_diff_2k.jpg", [1.8, 1], THREE.SRGBColorSpace),
  trimNormal: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_nor_gl_2k.jpg", [1.8, 1]),
  trimRoughness: loadTiledTexture("../../assets/polyhaven/textures/corrugated_iron/corrugated_iron_rough_2k.jpg", [1.8, 1]),
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
const tmpBox = new THREE.Box3();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();

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
  boostAutoDropAt: null,
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
  const width = Math.max(1, window.visualViewport?.width || window.innerWidth);
  const height = Math.max(1, window.visualViewport?.height || window.innerHeight);
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
      new THREE.MeshStandardMaterial({ color: 0x49643f, roughness: 0.98, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y;
    ground.receiveShadow = true;
    world.add(ground);

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5d7f57, roughness: 0.95 });
    for (let i = 0; i < worldDetail.hills; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(rand(90, 260), 16, 12), hillMat);
      hill.scale.y = rand(0.24, 0.55);
      hill.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(8, 32), rand(-ARENA * 1.2, ARENA * 1.2));
      hill.receiveShadow = true;
      world.add(hill);
    }

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f7668, roughness: 0.96, metalness: 0.03 });
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

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.9 });
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
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.78, metalness: 0.1 })
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

function createFighter(color, isPlayer = false) {
  const g = new THREE.Group();
  const jet = new THREE.Group();

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

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xa7afb8,
    map: null,
    normalMap: fighterTextures.bodyNormal,
    roughnessMap: fighterTextures.bodyRoughness,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.34, 0.34),
    roughness: 0.34,
    metalness: 0.7,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0xc0c8d1 : 0xaeb6c0,
    map: null,
    normalMap: fighterTextures.bodyNormal,
    roughnessMap: fighterTextures.bodyRoughness,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughness: 0.32,
    metalness: 0.66,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x142231,
    roughnessMap: fighterTextures.bodyRoughness,
    normalMap: fighterTextures.bodyNormal,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughness: 0.55,
    metalness: 0.24,
  });
  const nozzleMetalMat = new THREE.MeshStandardMaterial({
    color: 0xd8e1ea,
    roughnessMap: fighterTextures.bodyRoughness,
    normalMap: fighterTextures.bodyNormal,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.26, 0.26),
    roughness: 0.18,
    metalness: 0.94,
  });

  const fuselageProfile = [
    new THREE.Vector2(0.16, -33.2),
    new THREE.Vector2(0.46, -29.6),
    new THREE.Vector2(0.82, -23.8),
    new THREE.Vector2(1.28, -17.1),
    new THREE.Vector2(1.78, -9.2),
    new THREE.Vector2(2.18, -1.0),
    new THREE.Vector2(2.22, 6.8),
    new THREE.Vector2(2.02, 14.8),
    new THREE.Vector2(1.34, 21.4),
    new THREE.Vector2(0.3, 26.0),
  ];
  const fuselage = new THREE.Mesh(new THREE.LatheGeometry(fuselageProfile, 34), bodyMat);
  fuselage.rotation.z = -Math.PI * 0.5;
  fuselage.rotation.x = Math.PI;
  fuselage.scale.set(1, 0.42, 1.46);

  const centerSpine = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.08, 21.8, 24), bodyMat);
  centerSpine.rotation.z = -Math.PI * 0.5;
  centerSpine.position.set(1.4, 0.7, 0);

  // Rebuild cockpit/top/nose area from scratch with a slimmer silhouette.
  const cockpitBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.64, 5.8, 10, 20),
    new THREE.MeshStandardMaterial({
      color: 0x98a7b8,
      roughnessMap: fighterTextures.bodyRoughness,
      normalMap: fighterTextures.bodyNormal,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.44,
      metalness: 0.52,
    })
  );
  cockpitBody.rotation.z = Math.PI * 0.5;
  cockpitBody.scale.set(0.58, 0.14, 0.16);
  cockpitBody.position.set(7.0, 1.28, 0);

  const cockpitFairing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 6.8, 22), bodyMat);
  cockpitFairing.rotation.z = -Math.PI * 0.5;
  cockpitFairing.position.set(9.2, 1.02, 0);

  const cockpitBlend = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.9, 5.4, 24), bodyMat);
  cockpitBlend.rotation.z = -Math.PI * 0.5;
  cockpitBlend.position.set(4.9, 0.86, 0);

  const dorsalDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 5.6, 20), bodyMat);
  dorsalDeck.rotation.z = -Math.PI * 0.5;
  dorsalDeck.position.set(7.2, 1.24, 0);

  const canopyGlassMat = new THREE.MeshStandardMaterial({
    color: 0xd6f6ff,
    emissive: 0x1c3a4f,
    emissiveIntensity: 0.34,
    transparent: true,
    opacity: 0.82,
    roughness: 0.04,
    metalness: 0.1,
  });
  const cockpitGlass = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 18), canopyGlassMat);
  cockpitGlass.scale.set(1.16, 0.6, 0.46);
  cockpitGlass.position.set(7.2, 2.02, 0);

  const noseSection = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.54, 8.4, 24), bodyMat);
  noseSection.rotation.z = -Math.PI * 0.5;
  noseSection.position.set(16.8, 0.24, 0);

  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 7.2, 24), wingMat);
  noseCone.rotation.z = -Math.PI * 0.5;
  noseCone.scale.set(1, 0.34, 0.72);
  noseCone.position.set(24.8, 0.08, 0);

  // Main wing: even shorter fore-aft depth and moved further aft
  const mainWingPoints = [
    [8.6, 0.7],
    [-5.2, 18.8],
    [-10.6, 18.8],
    [-8.0, 0.7],
  ];
  const mainWingL = new THREE.Mesh(taperWingThickness(buildSurface(mainWingPoints, 1.92), 0.42, 1.45), wingMat);
  mainWingL.position.set(-10.7, -0.28, 0);
  mainWingL.rotation.x = 0;
  const mainWingR = new THREE.Mesh(taperWingThickness(buildSurface(mirrorPoints(mainWingPoints), 1.92), 0.42, 1.45), wingMat);
  mainWingR.position.copy(mainWingL.position);
  mainWingR.rotation.x = mainWingL.rotation.x;

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

  const finBase = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.2, 1.9), bodyMat);
  finBase.position.set(-34.3, -1.2, 0);

  // Vertical fin: trapezoid planform with a forward-sliding leading edge (前方が前に滑る台形)
  const finShape = [
    [-37.8, -1.2], // rear-lower
    [-33.6, -1.2], // front-lower (more forward near the bottom)
    [-35.0, 10.2], // front-upper (less forward toward the top)
    [-36.8, 10.2], // rear-upper
  ];
  const finCenter = new THREE.Mesh(buildVerticalSurface(finShape, 0.8), wingMat);
  finCenter.position.set(0, 0, 0);
  finCenter.rotation.z = 0;

  // Single center engine (写真イメージ寄せ): larger nozzle and center-mounted exhaust
  const engineCore = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 23.2, 24), bodyMat);
  engineCore.rotation.z = -Math.PI * 0.5;
  engineCore.position.set(-24.6, 1.15, 0);

  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 1.55, 8.4, 30), nozzleMetalMat);
  shroud.rotation.z = -Math.PI * 0.5;
  shroud.position.set(-36.8, 1.15, 0);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.25, 6.2, 30), nozzleMetalMat);
  nozzle.rotation.z = Math.PI * 0.5;
  nozzle.position.set(-37.6, 1.15, 0);

  const nozzleLip = new THREE.Mesh(new THREE.TorusGeometry(3.18, 0.16, 14, 32), nozzleMetalMat);
  nozzleLip.rotation.y = Math.PI * 0.5;
  nozzleLip.position.set(-40.1, 1.15, 0);

  const burnerMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0x82e9ff : 0xffad77,
    emissive: isPlayer ? 0x59ddff : 0xff864b,
    emissiveIntensity: 0.64,
    roughness: 0.14,
    metalness: 0.64,
  });
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.86, 4.8, 28), burnerMat);
  burner.rotation.z = Math.PI * 0.5;
  burner.position.set(-39.0, 1.15, 0);

  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: isPlayer ? 0xbef3ff : 0xffd8bb,
    map: exhaustAlphaTex,
    alphaMap: exhaustAlphaTex,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flamePlumeMat = new THREE.MeshBasicMaterial({
    color: isPlayer ? 0x6ecfff : 0xffab6b,
    map: exhaustAlphaTex,
    alphaMap: exhaustAlphaTex,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameTrailMat = new THREE.MeshBasicMaterial({
    color: isPlayer ? 0x5ea6ff : 0xff8d59,
    map: exhaustAlphaTex,
    alphaMap: exhaustAlphaTex,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const flameCore = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.56, 8.6, 26, 1, true), flameCoreMat);
  flameCore.rotation.z = -Math.PI * 0.5;
  flameCore.position.set(-42.1, 1.15, 0);

  const flamePlume = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 0.28, 13.8, 28, 1, true), flamePlumeMat);
  flamePlume.rotation.z = -Math.PI * 0.5;
  flamePlume.position.set(-45.8, 1.15, 0);

  const flameTrail = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.08, 20.0, 24, 1, true), flameTrailMat);
  flameTrail.rotation.z = -Math.PI * 0.5;
  flameTrail.position.set(-50.7, 1.15, 0);

  const flameNeedle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.24, 6.0, 16),
    new THREE.MeshBasicMaterial({
      color: isPlayer ? 0xf4fdff : 0xfff1de,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flameNeedle.rotation.z = -Math.PI * 0.5;
  flameNeedle.position.set(-40.7, 1.15, 0);

  flameCore.userData.baseX = flameCore.position.x;
  flamePlume.userData.baseX = flamePlume.position.x;
  flameTrail.userData.baseX = flameTrail.position.x;
  flameNeedle.userData.baseX = flameNeedle.position.x;

  const intake = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.1, 2.0), darkMat);
  intake.position.set(10.4, 0.32, 0);

  g.add(
    fuselage, centerSpine, cockpitBlend, cockpitBody, cockpitFairing, dorsalDeck, cockpitGlass, noseSection, noseCone,
    mainWingL, mainWingR,
    tailplaneL, tailplaneR, finBase, finCenter,
    engineCore, shroud, nozzle, nozzleLip, burner,
    flameCore, flamePlume, flameTrail, flameNeedle,
    intake
  );

  // Keep aircraft visually facing gameplay forward (+X). Model itself is built with nose on +Z.
  g.add(jet);
  g.rotation.y = -Math.PI * 0.5;

  if (!isPlayer) {
    const navMat = new THREE.MeshBasicMaterial({ color: 0xe7ecf5 });
    const navL = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), navMat);
    navL.position.set(13.6, 1.26, -2.6);
    const navR = navL.clone();
    navR.position.x *= -1;
    g.add(navL, navR);
  }

  g.scale.setScalar(1.24);
  g.position.set(0, 300, 0);
  g.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.frustumCulled = false;
    }
  });
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
    exhaust: {
      burners: [burner],
      outerFlames: [flameCore, flamePlume, flameTrail, flameNeedle],
      heatRings: [],
    },
  };

  return plane;
}

function updatePlaneExhaust(plane, boostLevel = 0) {
  if (!plane?.exhaust) return;
  const t = performance.now() * 0.02;
  const pulseA = 0.95 + Math.sin(t + plane.mesh.id * 0.31) * 0.1;
  const radiusGain = 1 + boostLevel * 0.28;
  const lengthGain = 1 + boostLevel * 1.5;
  const radiusByLayer = [0.92, 0.68, 0.46, 0.28];
  const depthByLayer = [1.0, 1.08, 1.2, 0.9];
  const opacityByLayer = [0.52, 0.28, 0.12, 0.36];

  plane.exhaust.outerFlames.forEach((flame, i) => {
    const flameLengthScale = pulseA * lengthGain * depthByLayer[i];
    const radiusLayer = (radiusByLayer[i] ?? 0.7) * radiusGain;
    flame.scale.set(
      radiusLayer,
      flameLengthScale,
      radiusLayer
    );
    const baseX = flame.userData.baseX ?? flame.position.x;
    flame.position.x = baseX - (flameLengthScale - 1) * (1.2 + i * 0.35);
    flame.material.opacity = clamp((opacityByLayer[i] ?? 0.3) + boostLevel * (i === 2 ? 0.08 : 0.06), 0.08, 0.72);
  });

  plane.exhaust.burners.forEach((burner) => {
    burner.material.emissiveIntensity = 0.66 + boostLevel * 2.1;
  });

}

function spawnBullet(owner, color) {
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 })
  );
  const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  b.position.copy(owner.mesh.position).addScaledVector(dir, 28);
  b.userData = {
    vel: dir.multiplyScalar(900).add(owner.velocity.clone().multiplyScalar(0.4)),
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

  if (
    game.boostAutoDropAt != null
    && performance.now() >= game.boostAutoDropAt
  ) {
    boostLeverState.applyLevel?.(0);
    game.boostAutoDropAt = null;
  }

  const boostAllowed = game.boostAutoDropAt == null && game.boostFuel > 0.01;
  const boostLevel = input.boostLevel > 0 && boostAllowed ? input.boostLevel : 0;
  if (boostLevel > 0) {
    game.boostFuel = Math.max(0, game.boostFuel - 22 * boostLevel * dt);
    if (game.boostFuel <= 0.01) {
      game.boostFuel = 0;
      if (boostLeverState.level > 0 && game.boostAutoDropAt == null) {
        game.boostAutoDropAt = performance.now() + 1000;
      }
    }
  } else if (game.boostAutoDropAt == null) {
    game.boostFuel = Math.min(100, game.boostFuel + 12 * dt);
  } else {
    game.boostFuel = 0;
  }

  const targetSpeed = p.speed + boostLevel * 220;
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
  updateHudHealthPanel();
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


function clearPlaneHpLabel(plane) {
  if (!plane?.hpLabel) return;
  world.remove(plane.hpLabel);
  plane.hpLabel = null;
}

function resetMatch() {
  for (const b of game.bullets) world.remove(b);
  game.bullets = [];
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
  game.boostFuel = 100;
  game.playerHitTimer = 0;
  game.hitConfirmTimer = 0;
  game.boostAutoDropAt = null;
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

  const colors = [0xff615d, 0xffc065, 0xc993ff, 0x62e7b3, 0xff7eb9];
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
  updateHudHealthPanel();
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
  const text = String(err?.message || err || "unknown error");
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

botCountEl.addEventListener("change", resetMatch);
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
  if (e.touches.length <= 1) return;
  const target = e.target;
  const menuTouch = target instanceof Element
    && (menuBtn.contains(target) || menuPanel.contains(target));
  if (!menuTouch) e.preventDefault();
}, { passive: false });

window.addEventListener("resize", () => {
  fitViewport();
  updateMenuPanelPosition();
  updateOrientationHint();
});
window.visualViewport?.addEventListener("resize", () => {
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

    syncInput();
    updatePlayer(dt);
    updateBots(dt);
    updateBullets(dt);
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
  runStartupStep("buildWorld", () => buildWorld(mapTypeEl.value));
  runStartupStep("resetMatch", () => resetMatch());
  runStartupStep("startLoop", () => requestAnimationFrame(tick));
} catch (err) {
  showFatalInitError(err, "startup");
}
}
