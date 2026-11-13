import * as THREE from 'three';
import {
  GRID_COORDS,
  getProceduralCityWorld,
} from './roadGraph';
import {
  createAsphaltTexture,
  createFacadeTexture,
  createTrafficSignalGantry,
} from './proceduralModels';
import { IntersectionSignalState } from '../types/greenroute';

export interface Intersection3DRefs {
  intersectionId: string;
  nsGantryNorth: ReturnType<typeof createTrafficSignalGantry>;
  nsGantrySouth: ReturnType<typeof createTrafficSignalGantry>;
  ewGantryEast: ReturnType<typeof createTrafficSignalGantry>;
  ewGantryWest: ReturnType<typeof createTrafficSignalGantry>;
}

export interface DestinationBeacon3D {
  nodeId: string;
  group: THREE.Group;
  ring: THREE.Mesh;
  pillar: THREE.Mesh;
}

export function buildUrbanCityEnvironment(
  scene: THREE.Scene,
  maxAnisotropy: number,
): {
  intersections3D: Record<string, Intersection3DRefs>;
  destinationBeacons: Record<string, DestinationBeacon3D>;
} {
  const world = getProceduralCityWorld();
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // 1. Expansive Ground Terrain Plane
  const groundGeo = new THREE.PlaneGeometry(1800, 1800);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0b1322,
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  worldGroup.add(ground);

  // 2. City Block Sidewalk Curbs (36 blocks between grid lines)
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.82,
    metalness: 0.1,
  });
  const sidewalkGeo = new THREE.BoxGeometry(86, 0.28, 86);
  const sidewalkInst = new THREE.InstancedMesh(
    sidewalkGeo,
    sidewalkMat,
    (GRID_COORDS.length - 1) * (GRID_COORDS.length - 1),
  );
  sidewalkInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let swIdx = 0;
  for (let r = 0; r < GRID_COORDS.length - 1; r++) {
    for (let c = 0; c < GRID_COORDS.length - 1; c++) {
      const cx = (GRID_COORDS[c] + GRID_COORDS[c + 1]) / 2;
      const cz = (GRID_COORDS[r] + GRID_COORDS[r + 1]) / 2;
      dummy.position.set(cx, 0.14, cz);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      sidewalkInst.setMatrixAt(swIdx++, dummy.matrix);
    }
  }
  sidewalkInst.instanceMatrix.needsUpdate = true;
  sidewalkInst.computeBoundingSphere();
  worldGroup.add(sidewalkInst);

  // 3. Multilane Connected Road Network (7 NS Avenues + 7 EW Streets)
  const asphaltTex = createAsphaltTexture(maxAnisotropy);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    color: 0x263246,
    roughness: 0.78,
    metalness: 0.1,
  });

  const roadSpan = 720;
  for (let i = 0; i < GRID_COORDS.length; i++) {
    const coord = GRID_COORDS[i];
    const isMain = i === 2 || i === 3 || i === 4;
    const width = isMain ? 16 : 14;

    // North-South Avenue at X = coord
    const nsRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(width, roadSpan),
      roadMat,
    );
    nsRoad.rotation.x = -Math.PI / 2;
    nsRoad.position.set(coord, 0.02, 0);
    nsRoad.receiveShadow = true;
    worldGroup.add(nsRoad);

    // East-West Street at Z = coord
    const ewRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(roadSpan, width),
      roadMat,
    );
    ewRoad.rotation.x = -Math.PI / 2;
    ewRoad.position.set(0, 0.025, coord);
    ewRoad.receiveShadow = true;
    worldGroup.add(ewRoad);
  }

  // 4. Road Centerlines & Zebra Crossings
  const yellowLineMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const whiteLineMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  for (let i = 0; i < GRID_COORDS.length; i++) {
    const coord = GRID_COORDS[i];
    for (let s = 0; s < GRID_COORDS.length - 1; s++) {
      const start = GRID_COORDS[s] + 10;
      const end = GRID_COORDS[s + 1] - 10;
      const len = end - start;
      const mid = (start + end) / 2;

      const nsLine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, len),
        yellowLineMat,
      );
      nsLine.rotation.x = -Math.PI / 2;
      nsLine.position.set(coord, 0.04, mid);
      worldGroup.add(nsLine);

      const ewLine = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 0.32),
        yellowLineMat,
      );
      ewLine.rotation.x = -Math.PI / 2;
      ewLine.position.set(mid, 0.04, coord);
      worldGroup.add(ewLine);
    }
  }

  // Instanced Zebra Crossings at all 49 Intersections
  const stripeGeo = new THREE.PlaneGeometry(0.9, 2.6);
  stripeGeo.rotateX(-Math.PI / 2);
  const zebraCount = 49 * 4 * 5;
  const zebraInst = new THREE.InstancedMesh(stripeGeo, whiteLineMat, zebraCount);
  let zIdx = 0;
  for (const rx of GRID_COORDS) {
    for (const rz of GRID_COORDS) {
      // North & South crosswalks
      for (const zOff of [-9.5, 9.5]) {
        for (let k = -2; k <= 2; k++) {
          dummy.position.set(rx + k * 2.1, 0.045, rz + zOff);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          zebraInst.setMatrixAt(zIdx++, dummy.matrix);
        }
      }
      // East & West crosswalks
      for (const xOff of [-9.5, 9.5]) {
        for (let k = -2; k <= 2; k++) {
          dummy.position.set(rx + xOff, 0.045, rz + k * 2.1);
          dummy.rotation.set(0, Math.PI / 2, 0);
          dummy.updateMatrix();
          zebraInst.setMatrixAt(zIdx++, dummy.matrix);
        }
      }
    }
  }
  zebraInst.instanceMatrix.needsUpdate = true;
  zebraInst.computeBoundingSphere();
  worldGroup.add(zebraInst);

  // 5. Traffic Signal Gantries at Intersections
  const intersections3D: Record<string, Intersection3DRefs> = {};
  for (const node of Object.values(world.nodes)) {
    if (node.type !== 'INTERSECTION') continue;

    const nsGantryNorth = createTrafficSignalGantry();
    nsGantryNorth.group.position.set(node.x - 8.8, 0, node.z - 8.8);
    nsGantryNorth.group.rotation.y = 0;

    const nsGantrySouth = createTrafficSignalGantry();
    nsGantrySouth.group.position.set(node.x + 8.8, 0, node.z + 8.8);
    nsGantrySouth.group.rotation.y = Math.PI;

    const ewGantryEast = createTrafficSignalGantry();
    ewGantryEast.group.position.set(node.x + 8.8, 0, node.z - 8.8);
    ewGantryEast.group.rotation.y = -Math.PI / 2;

    const ewGantryWest = createTrafficSignalGantry();
    ewGantryWest.group.position.set(node.x - 8.8, 0, node.z + 8.8);
    ewGantryWest.group.rotation.y = Math.PI / 2;

    worldGroup.add(
      nsGantryNorth.group,
      nsGantrySouth.group,
      ewGantryEast.group,
      ewGantryWest.group,
    );

    intersections3D[node.id] = {
      intersectionId: node.id,
      nsGantryNorth,
      nsGantrySouth,
      ewGantryEast,
      ewGantryWest,
    };
  }

  // 6. Helper to add 3D Landmark Identification Sign Sprite
  const addLandmarkSignSprite = (
    x: number,
    y: number,
    z: number,
    badge: string,
    title: string,
    accentHex: string,
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(7, 13, 25, 0.92)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 112, 16);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accentHex;
    ctx.stroke();

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillText(badge, 26, 46);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px "Outfit", sans-serif';
    ctx.fillText(title, 26, 92);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(22, 5.5, 1);
    worldGroup.add(sprite);
  };

  // 7. Build All City Block Buildings, Parks & 12 Service Landmarks
  const hospTex = createFacadeTexture('#e2e8f0', '#38bdf8', maxAnisotropy);
  const fireTex = createFacadeTexture('#451a1a', '#f97316', maxAnisotropy);
  const polTex = createFacadeTexture('#1e293b', '#60a5fa', maxAnisotropy);
  const skyTex = createFacadeTexture('#0f172a', '#93c5fd', maxAnisotropy);
  const commTex = createFacadeTexture('#1e293b', '#fde047', maxAnisotropy);
  const resTex = createFacadeTexture('#273549', '#fed7aa', maxAnisotropy);

  const hospMat = new THREE.MeshStandardMaterial({ map: hospTex, roughness: 0.35 });
  const fireMat = new THREE.MeshStandardMaterial({ map: fireTex, roughness: 0.45 });
  const polMat = new THREE.MeshStandardMaterial({ map: polTex, roughness: 0.38 });
  const skyMat = new THREE.MeshStandardMaterial({
    map: skyTex,
    roughness: 0.25,
    metalness: 0.4,
  });
  const commMat = new THREE.MeshStandardMaterial({ map: commTex, roughness: 0.45 });
  const resMat = new THREE.MeshStandardMaterial({ map: resTex, roughness: 0.55 });
  const parkLawnMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    roughness: 0.9,
  });

  const blueGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
  });
  const redGlowMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.5,
  });
  const polGlowMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x3b82f6,
    emissiveIntensity: 1.5,
  });

  for (const b of world.buildings) {
    if (b.kind === 'PARK') {
      const parkMesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.width, 0.35, b.depth),
        parkLawnMat,
      );
      parkMesh.position.set(b.centerX, 0.32, b.centerZ);
      parkMesh.receiveShadow = true;
      worldGroup.add(parkMesh);
      continue;
    }

    const mat =
      b.kind === 'HOSPITAL'
        ? hospMat
        : b.kind === 'FIRE_STATION'
          ? fireMat
          : b.kind === 'POLICE_STATION'
            ? polMat
            : b.kind === 'SKYSCRAPER'
              ? skyMat
              : b.kind === 'COMMERCIAL'
                ? commMat
                : resMat;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.width, b.height, b.depth),
      mat,
    );
    mesh.position.set(b.centerX, b.height / 2, b.centerZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    worldGroup.add(mesh);

    // Rooftop crown detail
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.65, 1.8, b.depth * 0.65),
      sidewalkMat,
    );
    crown.position.set(b.centerX, b.height + 0.9, b.centerZ);
    worldGroup.add(crown);

    // Special Emblem & Sign for the 12 Service Destinations
    if (b.kind === 'HOSPITAL') {
      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 7.5, b.depth + 0.8),
        blueGlowMat,
      );
      crossV.position.set(b.centerX, b.height * 0.68, b.centerZ);
      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 2.2, b.depth + 0.8),
        blueGlowMat,
      );
      crossH.position.set(b.centerX, b.height * 0.68, b.centerZ);
      worldGroup.add(crossV, crossH);

      addLandmarkSignSprite(
        b.centerX,
        b.height + 6.5,
        b.centerZ,
        'MEDICAL HOSPITAL · EMERGENCY BAY',
        b.title?.replace('HOSPITAL · ', '') || 'Hospital',
        '#38bdf8',
      );
    } else if (b.kind === 'FIRE_STATION') {
      const fireBand = new THREE.Mesh(
        new THREE.BoxGeometry(b.width + 0.6, 1.8, b.depth + 0.6),
        redGlowMat,
      );
      fireBand.position.set(b.centerX, b.height - 2, b.centerZ);
      worldGroup.add(fireBand);

      addLandmarkSignSprite(
        b.centerX,
        b.height + 6.5,
        b.centerZ,
        'FIRE & RESCUE STATION',
        b.title?.replace(/FIRE STATION #\d · /, '') || 'Fire Station',
        '#ef4444',
      );
    } else if (b.kind === 'POLICE_STATION') {
      const polBand = new THREE.Mesh(
        new THREE.BoxGeometry(b.width + 0.6, 1.6, b.depth + 0.6),
        polGlowMat,
      );
      polBand.position.set(b.centerX, b.height - 1.8, b.centerZ);
      worldGroup.add(polBand);

      addLandmarkSignSprite(
        b.centerX,
        b.height + 6.5,
        b.centerZ,
        'POLICE PRECINCT HEADQUARTERS',
        b.title?.replace(/POLICE STATION #\d · /, '') || 'Police Station',
        '#3b82f6',
      );
    }
  }

  // 8. Build Glowing Road Bay Markers for All 12 Service Destinations
  const destinationBeacons: Record<string, DestinationBeacon3D> = {};
  for (const node of Object.values(world.nodes)) {
    if (node.type !== 'DESTINATION') continue;

    const colorHex =
      node.emergencyCategory === 'AMBULANCE'
        ? 0x38bdf8
        : node.emergencyCategory === 'FIRE_BRIGADE'
          ? 0xef4444
          : 0x3b82f6;

    const group = new THREE.Group();
    group.position.set(node.x, 0, node.z);

    // Subtle permanent road bay pad
    const bayPad = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 5.4, 28),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    bayPad.rotation.x = -Math.PI / 2;
    bayPad.position.y = 0.06;
    group.add(bayPad);

    // Active Mission High-Visibility Beacon Ring + Vertical Pillar
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.45, 12, 36),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 2.5,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.8;
    ring.visible = false;

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.2, 26, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    pillar.position.y = 13.0;
    pillar.visible = false;

    group.add(ring, pillar);
    worldGroup.add(group);

    destinationBeacons[node.id] = {
      nodeId: node.id,
      group,
      ring,
      pillar,
    };
  }

  // 9. Instanced Urban Trees & Streetlights along Sidewalks
  const treeCoords: Array<[number, number]> = [];
  for (let r = 0; r < GRID_COORDS.length - 1; r++) {
    for (let c = 0; c < GRID_COORDS.length - 1; c++) {
      const cx = (GRID_COORDS[c] + GRID_COORDS[c + 1]) / 2;
      const cz = (GRID_COORDS[r] + GRID_COORDS[r + 1]) / 2;
      treeCoords.push(
        [cx - 38, cz - 38],
        [cx + 38, cz - 38],
        [cx - 38, cz + 38],
        [cx + 38, cz + 38],
        [cx, cz - 39],
        [cx, cz + 39],
      );
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 2.2, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.9,
  });
  const canopyGeo = new THREE.ConeGeometry(1.9, 4.5, 8);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.75,
  });

  const trunkInst = new THREE.InstancedMesh(
    trunkGeo,
    trunkMat,
    treeCoords.length,
  );
  const canopyInst = new THREE.InstancedMesh(
    canopyGeo,
    canopyMat,
    treeCoords.length,
  );
  const tint = new THREE.Color();

  treeCoords.forEach(([tx, tz], idx) => {
    const sc = 0.85 + ((idx * 19) % 30) / 100;
    dummy.position.set(tx, 1.1 * sc, tz);
    dummy.scale.setScalar(sc);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tx, 3.8 * sc, tz);
    dummy.updateMatrix();
    canopyInst.setMatrixAt(idx, dummy.matrix);

    tint.setHSL(0.41 + (idx % 5) * 0.015, 0.65, 0.26 + (idx % 3) * 0.04);
    canopyInst.setColorAt(idx, tint);
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  worldGroup.add(trunkInst, canopyInst);

  return { intersections3D, destinationBeacons };
}

export function syncIntersectionGantries3D(
  intersections3D: Record<string, Intersection3DRefs>,
  intersectionsState: Record<string, IntersectionSignalState>,
  setGantryLampColorFn: (
    gantry: ReturnType<typeof createTrafficSignalGantry>,
    color: 'RED' | 'YELLOW' | 'GREEN',
  ) => void,
) {
  for (const [id, ctrlState] of Object.entries(intersectionsState)) {
    const ref3D = intersections3D[id];
    if (!ref3D) continue;
    setGantryLampColorFn(ref3D.nsGantryNorth, ctrlState.nsLamp);
    setGantryLampColorFn(ref3D.nsGantrySouth, ctrlState.nsLamp);
    setGantryLampColorFn(ref3D.ewGantryEast, ctrlState.ewLamp);
    setGantryLampColorFn(ref3D.ewGantryWest, ctrlState.ewLamp);
  }
}
