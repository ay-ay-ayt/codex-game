import * as THREE from "../../vendor/three.module.min.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x10162a, 10, 24);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.3, 7.6);

scene.add(new THREE.HemisphereLight(0xc2ddff, 0x1a1f35, 0.75));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(5, 8, 7);
scene.add(keyLight);

const rim = new THREE.PointLight(0x8dc7ff, 4.2, 26, 2);
rim.position.set(-3, 2, -4);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(11, 64),
  new THREE.MeshStandardMaterial({ color: 0x1d2644, metalness: 0.2, roughness: 0.72 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.1;
scene.add(floor);

function createScreenTexture(title, subtitle, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#0f172e");
  bg.addColorStop(1, "#17234a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 12; i += 1) {
    ctx.fillRect(70, 60 + i * 46, 620 - i * 10, 16);
  }

  ctx.fillStyle = accent;
  ctx.fillRect(70, 440, 240, 40);
  ctx.fillStyle = "rgba(168, 235, 255, 0.9)";
  ctx.fillRect(330, 440, 130, 40);

  ctx.font = "700 72px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, 70, 220);

  ctx.font = "500 38px sans-serif";
  ctx.fillStyle = "rgba(235,242,255,0.9)";
  ctx.fillText(subtitle, 70, 296);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return tex;
}

function createDevice({ bodySize, bodyRadius, screenSize, depth, color, screenTexture }) {
  const device = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodySize.x, bodySize.y, depth),
    new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 })
  );
  device.add(body);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(bodySize.x * 1.02, bodySize.y * 1.02, depth * 0.7),
    new THREE.MeshStandardMaterial({ color: 0x07080e, metalness: 0.2, roughness: 0.6 })
  );
  edge.position.z = depth * 0.02;
  edge.scale.set(1, 1, 0.95);
  device.add(edge);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenSize.x, screenSize.y, 1, 1),
    new THREE.MeshStandardMaterial({
      map: screenTexture,
      emissive: new THREE.Color(0x203570),
      emissiveIntensity: 0.65,
      roughness: 0.35,
      metalness: 0.05,
    })
  );
  screen.position.z = depth * 0.52;
  device.add(screen);

  if (bodyRadius > 0) {
    const corner = new THREE.Mesh(
      new THREE.TorusGeometry(bodyRadius, depth * 0.1, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0x9aa4c4, metalness: 0.7, roughness: 0.2 })
    );
    corner.rotation.x = Math.PI / 2;
    corner.position.set(bodySize.x * 0.41, bodySize.y * 0.38, 0.01);
    device.add(corner);
  }

  return device;
}

const phone = createDevice({
  bodySize: new THREE.Vector2(1.68, 3.24),
  bodyRadius: 0.12,
  screenSize: new THREE.Vector2(1.44, 2.84),
  depth: 0.11,
  color: 0x181d2f,
  screenTexture: createScreenTexture("SMARTPHONE", "立体UI プレビュー", "#4f8fff"),
});
phone.position.set(-1.7, 0.6, 0.2);
phone.rotation.y = 0.45;
scene.add(phone);

const desktop = createDevice({
  bodySize: new THREE.Vector2(3.8, 2.35),
  bodyRadius: 0,
  screenSize: new THREE.Vector2(3.38, 1.94),
  depth: 0.14,
  color: 0x222938,
  screenTexture: createScreenTexture("DESKTOP", "奥行きのある画面演出", "#62c8ff"),
});
desktop.position.set(1.7, 1.05, -0.2);
desktop.rotation.y = -0.28;
scene.add(desktop);

const stand = new THREE.Mesh(
  new THREE.CylinderGeometry(0.08, 0.14, 0.9, 20),
  new THREE.MeshStandardMaterial({ color: 0x616f92, metalness: 0.65, roughness: 0.26 })
);
stand.position.set(1.7, -0.2, -0.2);
scene.add(stand);

const base = new THREE.Mesh(
  new THREE.CylinderGeometry(0.62, 0.74, 0.08, 28),
  new THREE.MeshStandardMaterial({ color: 0x3a435f, metalness: 0.45, roughness: 0.34 })
);
base.position.set(1.7, -0.64, -0.2);
scene.add(base);

const targetTilt = { x: 0, y: 0 };
const currentTilt = { x: 0, y: 0 };

function onPointerMove(event) {
  const nx = (event.clientX / window.innerWidth) * 2 - 1;
  const ny = (event.clientY / window.innerHeight) * 2 - 1;
  targetTilt.y = nx * 0.22;
  targetTilt.x = ny * 0.12;
}

window.addEventListener("pointermove", onPointerMove, { passive: true });
window.addEventListener("touchmove", (event) => {
  const touch = event.touches?.[0];
  if (touch) onPointerMove(touch);
}, { passive: true });

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();
  currentTilt.x += (targetTilt.x - currentTilt.x) * 0.07;
  currentTilt.y += (targetTilt.y - currentTilt.y) * 0.07;

  phone.rotation.x = 0.04 + currentTilt.x * 0.7 + Math.sin(t * 0.8) * 0.05;
  phone.rotation.y = 0.45 + currentTilt.y;
  phone.position.y = 0.6 + Math.sin(t * 1.2) * 0.08;

  desktop.rotation.x = -0.03 + currentTilt.x * 0.5 + Math.sin(t * 0.5 + 1.2) * 0.02;
  desktop.rotation.y = -0.28 + currentTilt.y * 0.55;
  desktop.position.y = 1.05 + Math.sin(t * 0.75 + 0.7) * 0.05;

  camera.position.x = currentTilt.y * 1.5;
  camera.position.y = 2.3 + currentTilt.x * 1.1;
  camera.lookAt(0, 0.7, -0.1);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
