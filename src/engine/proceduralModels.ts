import * as THREE from 'three';
import { EmergencyType } from '../types/greenroute';

let cachedShadowTexture: THREE.CanvasTexture | null = null;

/**
 * Generates a soft radial contact shadow CanvasTexture (zero external 404s).
 */
export function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTexture) return cachedShadowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedShadowTexture = tex;
  return tex;
}

/**
 * Creates a procedural asphalt texture with subtle aggregate grain.
 */
export function createAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b2434';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const shade = 22 + (i % 16);
    ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 16})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Creates a procedural building window facade texture.
 */
export function createFacadeTexture(
  baseHex: string,
  windowLitHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  const cols = 6;
  const rows = 8;
  const padX = 10;
  const padY = 10;
  const cellW = (256 - padX * 2) / cols;
  const cellH = (256 - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = (r * 7 + c * 13) % 5 !== 0;
      ctx.fillStyle = lit ? windowLitHex : '#0f172a';
      ctx.fillRect(
        padX + c * cellW + 4,
        padY + r * cellH + 4,
        cellW - 8,
        cellH - 8,
      );
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Helper to create a 4-wheel or 6-wheel set with rubber tires and metallic hubs.
 */
function addVehicleWheels(
  group: THREE.Group,
  positions: Array<[number, number, number]>,
  radius = 0.42,
  width = 0.28,
) {
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
    metalness: 0.1,
  });

  const rimGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.85,
  });

  for (const [wx, wy, wz] of positions) {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(wx, wy, wz);
    tire.castShadow = true;
    group.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(wx, wy, wz);
    group.add(rim);
  }
}

/**
 * Builds a composite 10-part Emergency Vehicle (Ambulance, Fire Brigade, or Police)
 * pivoted at bottom-center (Y = 0) with exposed lightbar meshes for live siren animation.
 */
export function createEmergencyVehicleModel(type: EmergencyType): {
  group: THREE.Group;
  beaconLeft: THREE.Mesh;
  beaconRight: THREE.Mesh;
  groundHalo: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Contact shadow plane on ground
  const shadowGeo = new THREE.PlaneGeometry(4.4, 8.2);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);

  // Subtle emergency halo ring when siren is active
  const haloGeo = new THREE.RingGeometry(2.6, 3.3, 32);
  haloGeo.rotateX(-Math.PI / 2);
  const haloMat = new THREE.MeshBasicMaterial({
    color: type === 'AMBULANCE' ? 0x10b981 : type === 'FIRE_BRIGADE' ? 0xef4444 : 0x3b82f6,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const groundHalo = new THREE.Mesh(haloGeo, haloMat);
  groundHalo.position.y = 0.06;
  group.add(groundHalo);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1.0,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.9,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  if (type === 'AMBULANCE') {
    const whitePaint = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 0.8,
    });
    const redStripeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.35,
      metalness: 0.2,
    });

    // 1. Lower chassis frame
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.65, 5.8), whitePaint);
    chassis.position.set(0, 0.65, 0);
    chassis.castShadow = true;
    group.add(chassis);

    // 2. Rear Medical Box Module
    const medBox = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.65, 3.8), whitePaint);
    medBox.position.set(0, 1.75, -0.85);
    medBox.castShadow = true;
    group.add(medBox);

    // 3. Emergency Red Wrap Band
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.32, 3.84), redStripeMat);
    stripe.position.set(0, 1.35, -0.85);
    group.add(stripe);

    // 4. Front Driver Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.25, 1.9), whitePaint);
    cab.position.set(0, 1.45, 1.85);
    cab.castShadow = true;
    group.add(cab);

    // 5. Windshield & Side Windows
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.65, 0.12), glassMat);
    windshield.position.set(0, 1.65, 2.8);
    windshield.rotation.x = -0.15;
    group.add(windshield);

    // 6. Medical Cross Emblems on sides
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.75, 0.24), redStripeMat);
    crossV.position.set(0, 1.95, -0.85);
    group.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.24, 0.75), redStripeMat);
    crossH.position.set(0, 1.95, -0.85);
    group.add(crossH);

    // 7. Front Bumper & Headlights
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.3, 0.35), chromeMat);
    bumper.position.set(0, 0.5, 2.95);
    group.add(bumper);

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headlightMat);
    hlLeft.position.set(-0.8, 0.85, 2.91);
    const hlRight = hlLeft.clone();
    hlRight.position.x = 0.8;
    group.add(hlLeft, hlRight);

    addVehicleWheels(group, [
      [-1.18, 0.42, 1.8],
      [1.18, 0.42, 1.8],
      [-1.18, 0.42, -1.7],
      [1.18, 0.42, -1.7],
    ]);
  } else if (type === 'FIRE_BRIGADE') {
    const fireRedMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      roughness: 0.25,
      metalness: 0.25,
      clearcoat: 0.9,
    });
    const compartmentSilver = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.8,
    });
    const yellowLadderMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
      metalness: 0.5,
    });

    // 1. Heavy Truck Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.7, 6.8), fireRedMat);
    chassis.position.set(0, 0.72, 0);
    chassis.castShadow = true;
    group.add(chassis);

    // 2. Crew Cab Forward
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.55, 2.3), fireRedMat);
    cab.position.set(0, 1.75, 2.15);
    cab.castShadow = true;
    group.add(cab);

    // 3. Cab Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.7, 0.12), glassMat);
    windshield.position.set(0, 1.95, 3.31);
    group.add(windshield);

    // 4. Pump & Hose Compartment Body
    const pumpBody = new THREE.Mesh(new THREE.BoxGeometry(2.45, 1.4, 4.1), fireRedMat);
    pumpBody.position.set(0, 1.65, -1.15);
    pumpBody.castShadow = true;
    group.add(pumpBody);

    // 5. Roll-up Metallic Equipment Shutters
    const shutters = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.95, 3.2), compartmentSilver);
    shutters.position.set(0, 1.65, -1.15);
    group.add(shutters);

    // 6. Aerial Extension Ladder Assembly on Roof
    const ladderRailL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 5.4), yellowLadderMat);
    ladderRailL.position.set(-0.45, 2.62, -0.3);
    const ladderRailR = ladderRailL.clone();
    ladderRailR.position.x = 0.45;
    group.add(ladderRailL, ladderRailR);

    for (let z = -2.6; z <= 2.0; z += 0.55) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), chromeMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 2.62, z);
      group.add(rung);
    }

    // 7. Chrome Front Bumper & Headlights
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.36, 0.4), chromeMat);
    bumper.position.set(0, 0.52, 3.45);
    group.add(bumper);

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), headlightMat);
    hlLeft.position.set(-0.85, 0.95, 3.4);
    const hlRight = hlLeft.clone();
    hlRight.position.x = 0.85;
    group.add(hlLeft, hlRight);

    addVehicleWheels(
      group,
      [
        [-1.25, 0.45, 2.2],
        [1.25, 0.45, 2.2],
        [-1.25, 0.45, -0.8],
        [1.25, 0.45, -0.8],
        [-1.25, 0.45, -2.3],
        [1.25, 0.45, -2.3],
      ],
      0.45,
      0.32,
    );
  } else {
    // POLICE INTERCEPTOR
    const navyBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.18,
      metalness: 0.45,
      clearcoat: 1.0,
    });
    const whiteDoorMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 0.9,
    });
    const blueStripeMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.3,
      metalness: 0.3,
    });

    // 1. Main Sedan Lower Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 5.1), navyBodyMat);
    hull.position.set(0, 0.68, 0);
    hull.castShadow = true;
    group.add(hull);

    // 2. White Contrast Police Doors
    const doors = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.66, 2.1), whiteDoorMat);
    doors.position.set(0, 0.69, 0.05);
    group.add(doors);

    // 3. Blue Interceptor Accent Stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.14, 4.9), blueStripeMat);
    stripe.position.set(0, 0.75, 0);
    group.add(stripe);

    // 4. Upper Cabin Greenhouse
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.68, 2.4), navyBodyMat);
    cabin.position.set(0, 1.35, -0.15);
    cabin.castShadow = true;
    group.add(cabin);

    const glassWrap = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.52, 2.15), glassMat);
    glassWrap.position.set(0, 1.34, -0.15);
    group.add(glassWrap);

    // 5. Front Bull-Bar Push Bumper
    const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.25), chromeMat);
    bullBar.position.set(0, 0.65, 2.65);
    group.add(bullBar);

    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.1), headlightMat);
    hlLeft.position.set(-0.75, 0.78, 2.56);
    const hlRight = hlLeft.clone();
    hlRight.position.x = 0.75;
    group.add(hlLeft, hlRight);

    addVehicleWheels(
      group,
      [
        [-1.08, 0.38, 1.55],
        [1.08, 0.38, 1.55],
        [-1.08, 0.38, -1.55],
        [1.08, 0.38, -1.55],
      ],
      0.38,
      0.26,
    );
  }

  // Roof Emergency Lightbar Assembly (Left + Right Independent Emissive Beacons)
  const roofY = type === 'AMBULANCE' ? 2.68 : type === 'FIRE_BRIGADE' ? 2.65 : 1.78;
  const roofZ = type === 'AMBULANCE' ? 0.6 : type === 'FIRE_BRIGADE' ? 2.4 : -0.1;

  const barBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.1, 0.36),
    chromeMat,
  );
  barBase.position.set(0, roofY, roofZ);
  group.add(barBase);

  const leftMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.4,
    roughness: 0.15,
  });
  const rightMat = new THREE.MeshStandardMaterial({
    color: type === 'POLICE' ? 0x3b82f6 : type === 'AMBULANCE' ? 0x38bdf8 : 0xf59e0b,
    emissive: type === 'POLICE' ? 0x3b82f6 : type === 'AMBULANCE' ? 0x38bdf8 : 0xf59e0b,
    emissiveIntensity: 0.4,
    roughness: 0.15,
  });

  const beaconGeo = new THREE.BoxGeometry(0.62, 0.22, 0.32);
  const beaconLeft = new THREE.Mesh(beaconGeo, leftMat);
  beaconLeft.position.set(-0.38, roofY + 0.14, roofZ);

  const beaconRight = new THREE.Mesh(beaconGeo, rightMat);
  beaconRight.position.set(0.38, roofY + 0.14, roofZ);

  group.add(beaconLeft, beaconRight);

  return { group, beaconLeft, beaconRight, groundHalo };
}

/**
 * Builds a composite 7-part Civilian Vehicle (Sedan, SUV, or Transit Van)
 * pivoted at bottom-center (Y = 0).
 */
export function createCivilianVehicleModel(
  colorHex: number,
  modelType: 'SEDAN' | 'SUV' | 'TRANSIT',
): THREE.Group {
  const group = new THREE.Group();

  const shadowGeo = new THREE.PlaneGeometry(3.2, 6.0);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.025;
  group.add(shadow);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.28,
    metalness: 0.45,
    clearcoat: 0.7,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.15,
    metalness: 0.2,
  });

  const length = modelType === 'TRANSIT' ? 5.2 : modelType === 'SUV' ? 4.6 : 4.3;
  const hullH = modelType === 'TRANSIT' ? 0.85 : 0.65;
  const cabinH = modelType === 'TRANSIT' ? 0.95 : modelType === 'SUV' ? 0.72 : 0.58;
  const cabinZ = modelType === 'SEDAN' ? -0.15 : -0.25;
  const cabinLen = modelType === 'SEDAN' ? 2.1 : modelType === 'SUV' ? 2.8 : 3.6;

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, hullH, length), bodyMat);
  hull.position.set(0, 0.35 + hullH / 2, 0);
  hull.castShadow = true;
  group.add(hull);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.78, cabinH, cabinLen),
    bodyMat,
  );
  cabin.position.set(0, 0.35 + hullH + cabinH / 2 - 0.04, cabinZ);
  cabin.castShadow = true;
  group.add(cabin);

  const windows = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, cabinH * 0.72, cabinLen * 0.88),
    glassMat,
  );
  windows.position.copy(cabin.position);
  group.add(windows);

  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef9c3,
    emissiveIntensity: 0.9,
  });
  const tlMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.8,
  });

  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.08), hlMat);
  hl.position.set(0, 0.65, length / 2 + 0.01);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.08), tlMat);
  tl.position.set(0, 0.65, -length / 2 - 0.01);
  group.add(hl, tl);

  addVehicleWheels(
    group,
    [
      [-0.98, 0.35, length * 0.32],
      [0.98, 0.35, length * 0.32],
      [-0.98, 0.35, -length * 0.32],
      [0.98, 0.35, -length * 0.32],
    ],
    0.35,
    0.24,
  );

  return group;
}

/**
 * Builds a composite 9-part Traffic Signal Cantilever Gantry with distinct
 * Red, Yellow, and Green emissive lamp lenses that reflect live controller state.
 */
export function createTrafficSignalGantry(): {
  group: THREE.Group;
  redLamp: THREE.Mesh;
  yellowLamp: THREE.Mesh;
  greenLamp: THREE.Mesh;
} {
  const group = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.75,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.3,
  });

  // 1. Octagonal Foundation Plinth
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.8, 8), poleMat);
  plinth.position.y = 0.4;
  group.add(plinth);

  // 2. Vertical Mast Pole
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 7.6, 12), poleMat);
  mast.position.y = 3.8;
  mast.castShadow = true;
  group.add(mast);

  // 3. Horizontal Cantilever Arm extending over the traffic lane
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.2, 10), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(2.5, 7.2, 0);
  group.add(arm);

  // 4. Signal Head Box Housing
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.35, 0.65), housingMat);
  housing.position.set(3.8, 6.75, 0);
  group.add(housing);

  // 5. High-Visibility Backplate Border
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 2.52, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 }),
  );
  border.position.set(3.8, 6.75, -0.28);
  group.add(border);

  // 6, 7, 8. Red, Yellow, Green Lamp Lenses
  const lampGeo = new THREE.SphereGeometry(0.28, 16, 16);
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });

  const redLamp = new THREE.Mesh(lampGeo, redMat);
  redLamp.position.set(3.8, 7.45, 0.25);

  const yellowLamp = new THREE.Mesh(lampGeo, yellowMat);
  yellowLamp.position.set(3.8, 6.75, 0.25);

  const greenLamp = new THREE.Mesh(lampGeo, greenMat);
  greenLamp.position.set(3.8, 6.05, 0.25);

  group.add(redLamp, yellowLamp, greenLamp);

  return { group, redLamp, yellowLamp, greenLamp };
}

/**
 * Updates the emissive intensity of a Traffic Signal Gantry's 3 lamps.
 */
export function setGantryLampColor(
  gantry: {
    redLamp: THREE.Mesh;
    yellowLamp: THREE.Mesh;
    greenLamp: THREE.Mesh;
  },
  activeColor: 'RED' | 'YELLOW' | 'GREEN',
) {
  const rMat = gantry.redLamp.material as THREE.MeshStandardMaterial;
  const yMat = gantry.yellowLamp.material as THREE.MeshStandardMaterial;
  const gMat = gantry.greenLamp.material as THREE.MeshStandardMaterial;

  rMat.emissiveIntensity = activeColor === 'RED' ? 2.8 : 0.08;
  rMat.color.setHex(activeColor === 'RED' ? 0xff4d4d : 0x451a1a);

  yMat.emissiveIntensity = activeColor === 'YELLOW' ? 2.8 : 0.08;
  yMat.color.setHex(activeColor === 'YELLOW' ? 0xfbbf24 : 0x453012);

  gMat.emissiveIntensity = activeColor === 'GREEN' ? 2.8 : 0.08;
  gMat.color.setHex(activeColor === 'GREEN' ? 0x10b981 : 0x0c3b2e);
}
