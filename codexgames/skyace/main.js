:root {
  --glass: rgba(6, 15, 28, 0.58);
  --line: rgba(173, 232, 255, 0.42);
}

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
}

html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: Inter, "Segoe UI", sans-serif;
  color: #e8f8ff;
  background: #030c18;
  touch-action: none;
}

body {
  position: fixed;
  inset: 0;
  overscroll-behavior: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

#game {
  width: 100vw;
  height: 100dvh;
  display: block;
}

#hud {
  position: fixed;
  top: max(8px, env(safe-area-inset-top));
  left: 10px;
  right: 10px;
  z-index: 30;
  display: grid;
  grid-template-columns: max-content max-content max-content 1fr max-content;
  grid-template-rows: auto auto;
  gap: 6px;
  align-items: start;
  pointer-events: none;
}

#hud > * {
  padding: 5px 8px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--glass);
  backdrop-filter: blur(5px);
  font-size: 12px;
  font-weight: 700;
  pointer-events: auto;
}

#hud button,
#menuPanel select {
  touch-action: auto;
}

#hud,
#menuPanel,
#mobileControls,
#rotateHint,
#message {
  -webkit-touch-callout: none;
}


#menuBtn,
#restartBtn {
  color: #ecf9ff;
  background: rgba(28, 74, 117, 0.8);
  touch-action: manipulation;
}

#restartBtn {
  background: rgba(35, 99, 158, 0.92);
  border-color: rgba(196, 238, 255, 0.8);
}

#menuBtn {
  grid-column: -2 / -1;
  grid-row: 1 / 2;
  justify-self: end;
  min-width: 96px;
  min-height: 40px;
  font-size: 14px;
  font-weight: 800;
}

#menuPanel {
  position: fixed;
  top: calc(var(--menu-bottom, max(54px, calc(env(safe-area-inset-top) + 44px))) + 6px);
  right: 10px;
  z-index: 31;
  display: grid;
  justify-items: stretch;
  grid-template-columns: 1fr;
  gap: 6px;
  min-width: 136px;
  pointer-events: auto;
}

#menuPanel[hidden] {
  display: none;
}

#menuPanel > * {
  padding: 5px 8px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--glass);
  backdrop-filter: blur(5px);
  font-size: 12px;
  font-weight: 700;
}

#menuPanel button {
  width: 100%;
}

#menuPanel select {
  min-width: 72px;
  padding: 3px 6px;
}

#title {
  color: #9fdfff;
  grid-column: 1 / 2;
  grid-row: 1 / 2;
}

#ammo {
  grid-row: 1 / 2;
}

#boostStat {
  grid-row: 1 / 2;
  padding-inline: 6px;
  min-width: 0;
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
    color,
    map: fighterTextures.bodyColor,
    normalMap: fighterTextures.bodyNormal,
    roughnessMap: fighterTextures.bodyRoughness,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.34, 0.34),
    roughness: 0.42,
    metalness: 0.62,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0xdce7f1 : 0xddd4c2,
    map: fighterTextures.bodyColor,
    normalMap: fighterTextures.bodyNormal,
    roughnessMap: fighterTextures.bodyRoughness,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughness: 0.4,
    metalness: 0.58,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x142231,
    roughnessMap: fighterTextures.bodyRoughness,
    normalMap: fighterTextures.bodyNormal,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughness: 0.55,
    metalness: 0.24,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x9ed8ff,
    emissive: 0x0f1f35,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.78,
    roughness: 0.06,
    metalness: 0.28,
  });

  const fuselageProfile = [
    new THREE.Vector2(0.1, -34.0),
    new THREE.Vector2(0.36, -29.0),
    new THREE.Vector2(0.92, -22.4),
    new THREE.Vector2(1.64, -13.8),
    new THREE.Vector2(2.34, -4.4),
    new THREE.Vector2(2.74, 5.1),
    new THREE.Vector2(2.38, 13.6),
    new THREE.Vector2(1.58, 21.4),
    new THREE.Vector2(0.66, 29.4),
  ];
  const fuselage = new THREE.Mesh(new THREE.LatheGeometry(fuselageProfile, 36), bodyMat);
  fuselage.rotation.z = -Math.PI * 0.5;
  fuselage.rotation.x = Math.PI;
  fuselage.scale.set(1, 0.68, 1.12);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.06, 10.2, 22), wingMat);
  nose.rotation.z = -Math.PI * 0.5;
  nose.scale.set(1, 0.72, 1.05);
  nose.position.set(34.3, 0, 0);

  const centerSpine = new THREE.Mesh(new THREE.BoxGeometry(18.2, 1.36, 3.4), bodyMat);
  centerSpine.position.set(0.9, 1.88, 0);

  const canopyBase = new THREE.Mesh(new THREE.BoxGeometry(10.6, 1.38, 3.3), bodyMat);
  canopyBase.position.set(7.1, 1.52, 0);
  const canopy = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.88, 5.9, 7, 16),
    new THREE.MeshStandardMaterial({ color: 0xbcefff, transparent: true, opacity: 0.75, roughness: 0.06, metalness: 0.2 })
  );
  canopy.rotation.z = Math.PI * 0.5;
  canopy.scale.set(2.08, 0.98, 1.08);
  canopy.position.set(6.9, 2.34, 0);

  const foreBlend = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.98, 7.8, 20), bodyMat);
  foreBlend.rotation.z = -Math.PI * 0.5;
  foreBlend.position.set(15.8, 1.26, 0);

  const mainWingPoints = [
    [8.2, 0.7],
    [-1.6, 18.2],
    [-12.6, 18.2],
    [-9.4, 0.7],
  ];
  const mainWingL = new THREE.Mesh(buildSurface(mainWingPoints, 0.46), wingMat);
  mainWingL.position.set(-1.0, -1.28, 0);
  mainWingL.rotation.x = -0.026;
  const mainWingR = new THREE.Mesh(buildSurface(mirrorPoints(mainWingPoints), 0.46), wingMat);
  mainWingR.position.copy(mainWingL.position);
  mainWingR.rotation.x = mainWingL.rotation.x;

  const lerxPoints = [[13.8, 0.2], [9.3, 5.2], [2.3, 5.1], [5.0, 0.26]];
  const lerxL = new THREE.Mesh(buildSurface(lerxPoints, 0.3), bodyMat);
  lerxL.position.set(0.8, -0.28, 0);
  const lerxR = new THREE.Mesh(buildSurface(mirrorPoints(lerxPoints), 0.3), bodyMat);
  lerxR.position.copy(lerxL.position);

  const tailRoot = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.3, 4.6), bodyMat);
  tailRoot.position.set(-20.0, 1.42, 0);

  const stabsShape = [
    [-18.0, 0.2],
    [-23.6, 4.1],
    [-29.2, 4.9],
    [-31.2, 3.6],
    [-29.6, 0.3],
    [-23.2, -0.5],
    [-18.2, -0.1],
  ];
  const stabL = new THREE.Mesh(buildSurface(stabsShape, 0.26), wingMat);
  stabL.position.set(-0.5, 1.08, 2.0);
  stabL.rotation.x = 0.08;
  const stabR = new THREE.Mesh(buildSurface(mirrorPoints(stabsShape), 0.26), wingMat);
  stabR.position.set(-0.5, 1.08, -2.0);
  stabR.rotation.x = -0.08;

  const fin = new THREE.Mesh(buildVerticalSurface([
    [-19.0, 0.0],
    [-21.4, 8.4],
    [-24.8, 14.9],
    [-27.4, 14.0],
    [-25.2, 0.2],
  ], 0.34), wingMat);
  fin.position.set(0, 2.0, 0);
  fin.rotation.x = THREE.MathUtils.degToRad(2);

  const engineBody = new THREE.Mesh(new THREE.CylinderGeometry(1.88, 2.22, 16.2, 22), bodyMat);
  engineBody.rotation.z = -Math.PI * 0.5;
  engineBody.position.set(-16.2, 0.76, 0);
  engineBody.scale.set(1, 0.8, 0.94);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.72, 5.7, 22), darkMat);
  nozzle.rotation.z = Math.PI * 0.5;
  nozzle.position.set(-27.1, 0.72, 0);

  const burnerMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0x82e9ff : 0xffad77,
    emissive: isPlayer ? 0x59ddff : 0xff864b,
    emissiveIntensity: 0.64,
    roughness: 0.14,
    metalness: 0.64,
  });
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.08, 2.4, 18), burnerMat);
  burner.rotation.z = Math.PI * 0.5;
  burner.position.set(-28.8, 0.72, 0);

  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: isPlayer ? 0x5ad5ff : 0xffa368,
    map: exhaustAlphaTex,
    alphaMap: exhaustAlphaTex,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameGlowMat = new THREE.MeshBasicMaterial({
    color: isPlayer ? 0xa8edff : 0xffcf9b,
    map: exhaustAlphaTex,
    alphaMap: exhaustAlphaTex,
    transparent: true,
    opacity: 0.44,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.92, 8.4, 16), flameCoreMat);
  flameInner.rotation.z = Math.PI * 0.5;
  flameInner.position.set(-32.4, 0.72, 0);
  flameInner.userData.baseX = flameInner.position.x;
  const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(1.36, 10.6, 18), flameGlowMat);
  flameOuter.rotation.z = Math.PI * 0.5;
  flameOuter.position.set(-33.2, 0.72, 0);
  flameOuter.userData.baseX = flameOuter.position.x;

  const heatRingMat = new THREE.MeshBasicMaterial({
    color: 0xff9b45,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const heatRing = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.18, 10, 20), heatRingMat);
  heatRing.rotation.y = Math.PI * 0.5;
  heatRing.position.set(-29.2, 0.72, 0);

  const ventL = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.66, 0.36), darkMat);
  ventL.position.set(3.6, -1.2, 1.46);
  const ventR = ventL.clone();
  ventR.position.z = -1.46;

  jet.add(flameInner, flameOuter, heatRing, burner);

  g.add(
    fuselage, nose, centerSpine, canopyBase, canopy, foreBlend,
    mainWingL, mainWingR,
    shoulderL, shoulderR,
    tailRoot, tailplaneL, tailplaneR, finBase, finCenter, finTip,
    engineCore, shroud, nozzle, burner,
    flameCore, flameGlow, flameShock, heatRing,
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
      outerFlames: [flameInner, flameOuter],
      heatRings: [heatRing],
    },
  };

  return plane;
}

function updatePlaneExhaust(plane, boostLevel = 0) {
  if (!plane?.exhaust) return;
  const t = performance.now() * 0.02;
  const pulseA = 0.95 + Math.sin(t + plane.mesh.id * 0.31) * 0.1;
  const radiusGain = 1 + boostLevel * 0.5;
  const lengthGain = 1 + boostLevel * 1.9;
  const pulseZ = 0.9 + Math.cos(t * 1.2 + plane.mesh.id * 0.21) * 0.08;

  plane.exhaust.outerFlames.forEach((flame, i) => {
    const flameLengthScale = pulseA * lengthGain * (1 + i * 0.08);
    flame.scale.set(
      (0.95 + i * 0.16) * radiusGain,
      flameLengthScale,
      pulseZ * (1 + boostLevel * 0.5)
    );
    const baseX = flame.userData.baseX ?? flame.position.x;
    flame.position.x = baseX - (flameLengthScale - 1) * (1.1 + i * 0.28);
    flame.material.opacity = clamp((opacityByLayer[i] ?? 0.56) + boostLevel * (i === 0 ? 0.1 : 0.16), 0.28, 0.99);
  });

  plane.exhaust.burners.forEach((burner) => {
    burner.material.emissiveIntensity = 0.56 + boostLevel * 1.95;
  });

  plane.exhaust.heatRings?.forEach((ring) => {
    ring.scale.set(1 + boostLevel * 0.26, 1 + boostLevel * 0.26, 1 + boostLevel * 0.26);
    ring.material.opacity = clamp(0.32 + boostLevel * 0.34, 0.18, 0.9);
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

#botCount,
#mapType {
  border: 0;
  border-radius: 8px;
  background: #d7f0ff;
  padding: 4px 8px;
  font-weight: 700;
}


#health {
  display: grid;
  gap: 4px;
  min-width: 212px;
  grid-column: 1 / 2;
  grid-row: 2 / 3;
}

.hp-row {
  display: grid;
  grid-template-columns: 30px minmax(78px, 112px) 30px;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}


.hp-name,
.hp-val {
  font-weight: 800;
}

.hp-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(9, 22, 35, 0.9);
  border: 1px solid rgba(160, 230, 255, 0.35);
}

.hp-fill {
  position: absolute;
  inset: 0 auto 0 0;
}

.hp-fill.good {
  background: linear-gradient(90deg, #4eea99, #8cffbf);
}

.hp-fill.warn {
  background: linear-gradient(90deg, #ffc46a, #ffe38e);
}

.hp-fill.danger {
  background: linear-gradient(90deg, #ff6f72, #ff9b91);
}

#health.flash {
  box-shadow: 0 0 18px rgba(255, 110, 110, 0.85);
  border-color: rgba(255, 130, 130, 0.95);
}

#crosshair {
  position: fixed;
  left: 50%;
  top: 50%;
  width: 34px;
  height: 34px;
  margin-left: -17px;
  margin-top: -17px;
  border: 2px solid rgba(186, 235, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 14px rgba(109, 214, 255, 0.5);
  pointer-events: none;
  z-index: 6;
}

#crosshair.hit {
  transform: scale(1.22);
  border-color: rgba(255, 240, 170, 0.95);
  box-shadow: 0 0 20px rgba(255, 240, 150, 0.9);
}

#crosshair::before,
#crosshair::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  background: rgba(186, 235, 255, 0.8);
}

#crosshair::before {
  width: 2px;
  height: 54px;
  margin-left: -1px;
  margin-top: -27px;
}

#crosshair::after {
  height: 2px;
  width: 54px;
  margin-top: -1px;
  margin-left: -27px;
}

#message {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 12;
  pointer-events: none;
  font-size: clamp(28px, 7vw, 64px);
  font-weight: 900;
  background: rgba(0, 8, 16, 0.34);
  text-shadow: 0 0 16px rgba(161, 234, 255, 0.8);
}

#mobileControls {
  position: fixed;
  left: max(8px, env(safe-area-inset-left));
  right: max(8px, env(safe-area-inset-right));
  bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 10;
  display: grid;
  grid-template-columns: auto max-content;
  justify-content: space-between;
  align-items: end;
  gap: 10px;
}

.stick-wrap {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.stick-label {
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 700;
}

.stick {
  width: min(28vw, 150px);
  height: min(28vw, 150px);
  border-radius: 50%;
  border: 2px solid rgba(180, 236, 255, 0.7);
  background: radial-gradient(circle at center, rgba(121, 221, 255, 0.18), rgba(2, 10, 21, 0.55));
  position: relative;
  touch-action: none;
}

.knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 40%;
  height: 40%;
  margin-left: -20%;
  margin-top: -20%;
  border-radius: 50%;
  border: 2px solid rgba(206, 242, 255, 0.86);
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.65), rgba(112, 196, 234, 0.35));
  box-shadow: 0 0 12px rgba(123, 214, 255, 0.45);
  transform: translate(0, 0);
}

.action-wrap {
  display: grid;
  grid-template-columns: max-content max-content;
  align-items: end;
  gap: 8px;
}

#fireBtn {
  align-self: end;
  margin-bottom: 12px;
}

.lever-wrap {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.lever {
  width: 48px;
  height: 140px;
  border-radius: 24px;
  border: 2px solid rgba(180, 236, 255, 0.7);
  background: linear-gradient(180deg, rgba(10, 40, 68, 0.82), rgba(5, 20, 36, 0.88));
  position: relative;
  touch-action: none;
}

.lever-knob {
  position: absolute;
  left: 50%;
  top: 8px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid rgba(206, 242, 255, 0.9);
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.72), rgba(112, 196, 234, 0.4));
  box-shadow: 0 0 10px rgba(123, 214, 255, 0.48);
  transform: translateX(-50%);
}

.action {
  width: min(18vw, 110px);
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 12px;
  font-weight: 800;
  color: #ecf8ff;
  background: rgba(5, 29, 53, 0.7);
  touch-action: manipulation;
}

.action.active {
  background: rgba(156, 229, 255, 0.36);
  transform: translateY(1px);
}

#rotateHint {
  position: fixed;
  left: 50%;
  bottom: calc(max(14px, env(safe-area-inset-bottom)) + 14px);
  transform: translateX(-50%);
  z-index: 20;
  display: grid;
  place-items: center;
  gap: 8px;
  font-size: clamp(18px, 3vw, 28px);
  font-weight: 800;
  text-align: center;
  padding: 12px 16px;
  width: min(92vw, 760px);
  border-radius: 14px;
  border: 1px solid rgba(173, 232, 255, 0.35);
  background: rgba(3, 8, 18, 0.55);
  backdrop-filter: blur(5px);
  pointer-events: none;
}

#rotateHint small {
  font-size: clamp(12px, 2vw, 16px);
  color: #a8d4ef;
  font-weight: 600;
}

#rotateHint[hidden] {
  display: none;
}

@media (max-width: 900px) {
  #hud {
    grid-template-columns: max-content max-content 1fr max-content;
  }
}

@media (orientation: portrait) {
  #mobileControls {
    opacity: 0.35;
  }
}
