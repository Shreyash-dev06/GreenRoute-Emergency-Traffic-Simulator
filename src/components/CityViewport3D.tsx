import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BackgroundEmergencyVehicle,
  CivilianVehicleState,
  DrivingCameraMode,
  EmergencyType,
  GameScreenState,
  IntersectionSignalState,
  PlayerVehicleState,
  RouteResult,
} from '../types/greenroute';
import {
  buildUrbanCityEnvironment,
  syncIntersectionGantries3D,
} from '../engine/cityEnvironmentBuilder';
import {
  createCivilianVehicleModel,
  createEmergencyVehicleModel,
  setGantryLampColor,
} from '../engine/proceduralModels';

export interface OpenWorldMutableRef {
  screenState: GameScreenState;
  previewVehicleType: EmergencyType;
  player: PlayerVehicleState;
  activeRoute: RouteResult | null;
  activeDestinationId: string | null;
  intersections: Record<string, IntersectionSignalState>;
  civilians: CivilianVehicleState[];
  backgroundEmergency: BackgroundEmergencyVehicle | null;
  cameraMode: DrivingCameraMode;
  cameraSensitivity: number;
  onTickGame: (dt: number) => void;
}

interface CityViewport3DProps {
  worldRef: React.MutableRefObject<OpenWorldMutableRef>;
}

const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _smoothLookAt = new THREE.Vector3();

export const CityViewport3D: React.FC<CityViewport3DProps> = ({ worldRef }) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070e1b);
    scene.fog = new THREE.FogExp2(0x070e1b, 0.0022);

    // 2. Studio PBR Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    // 3. Urban Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.9);
    hemiLight.position.set(0, 160, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4d6, 1.9);
    sunLight.position.set(120, 210, 110);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 220;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 20;
    sunLight.shadow.camera.far = 520;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.6,
      700,
    );
    camera.position.set(0, 14, 150);

    // 4. Build Full 7x7 Open-World Procedural City
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { intersections3D, destinationBeacons } = buildUrbanCityEnvironment(
      scene,
      maxAniso,
    );

    // 5. Create All 3 Emergency Vehicle Models (so switching in Vehicle Select or Gameplay is instant)
    const playerModels: Record<
      EmergencyType,
      ReturnType<typeof createEmergencyVehicleModel>
    > = {
      AMBULANCE: createEmergencyVehicleModel('AMBULANCE'),
      FIRE_BRIGADE: createEmergencyVehicleModel('FIRE_BRIGADE'),
      POLICE: createEmergencyVehicleModel('POLICE'),
    };

    // Add forward headlight beam cones to each player model
    for (const type of ['AMBULANCE', 'FIRE_BRIGADE', 'POLICE'] as EmergencyType[]) {
      const m = playerModels[type];
      const beamGeo = new THREE.ConeGeometry(2.8, 14, 16, 1, true);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(0, 0.7, 9.5);
      m.group.add(beamMesh);
      scene.add(m.group);
    }

    // Background AI Emergency Vehicle Model
    const bgEmergModel = createEmergencyVehicleModel('FIRE_BRIGADE');
    bgEmergModel.group.visible = false;
    scene.add(bgEmergModel.group);

    // 6. Civilian Vehicle Meshes
    const civMeshes = new Map<string, THREE.Group>();
    for (const cv of worldRef.current.civilians) {
      const m = createCivilianVehicleModel(cv.colorHex, cv.modelType);
      m.position.set(cv.x, 0, cv.z);
      m.rotation.y = cv.yaw;
      scene.add(m);
      civMeshes.set(cv.id, m);
    }

    // 7. Dynamic GreenRoute Road Overlay Ribbon
    const routeRibbonGroup = new THREE.Group();
    scene.add(routeRibbonGroup);
    const routeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      transparent: true,
      opacity: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    let lastRouteKey = '';

    const syncRouteRibbon = () => {
      const w = worldRef.current;
      const route = w.activeRoute;
      if (w.screenState !== 'PLAYING' || !route || route.waypoints.length === 0) {
        if (lastRouteKey !== 'NONE') {
          lastRouteKey = 'NONE';
          while (routeRibbonGroup.children.length > 0) {
            const c = routeRibbonGroup.children[0] as THREE.Mesh;
            routeRibbonGroup.remove(c);
            c.geometry?.dispose();
          }
        }
        return;
      }

      const routeKey = `${route.nodeIds.join('-')}`;
      if (routeKey === lastRouteKey) return;
      lastRouteKey = routeKey;

      while (routeRibbonGroup.children.length > 0) {
        const c = routeRibbonGroup.children[0] as THREE.Mesh;
        routeRibbonGroup.remove(c);
        c.geometry?.dispose();
      }

      const wps = route.waypoints;
      for (let i = 0; i < wps.length - 1; i++) {
        const a = wps[i];
        const b = wps[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.1) continue;

        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 0.16, len),
          routeMat,
        );
        seg.position.set((a.x + b.x) / 2, 0.14, (a.z + b.z) / 2);
        seg.rotation.y = Math.atan2(dx, dz);
        routeRibbonGroup.add(seg);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 8. Animation Loop with Software-WebGL Pacing Guard (`afterDraw`)
    let frameId = 0;
    let isUnmounted = false;
    let prevTime = performance.now();
    let cameraInitialized = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isUnmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isUnmounted) return;
      const now = performance.now();
      const rawDt = (now - prevTime) / 1000;
      prevTime = now;
      const dt = Math.min(rawDt, 0.05);
      const elapsedSec = now * 0.001;

      const w = worldRef.current;
      w.onTickGame(dt);

      // Sync Traffic Light Gantries across the city
      syncIntersectionGantries3D(
        intersections3D,
        w.intersections,
        setGantryLampColor,
      );

      // Sync Civilian Vehicles
      for (const cv of w.civilians) {
        const m = civMeshes.get(cv.id);
        if (m) {
          m.position.set(cv.x, 0, cv.z);
          m.rotation.y = cv.yaw;
        }
      }

      // Sync Background Emergency Vehicle
      if (w.backgroundEmergency) {
        bgEmergModel.group.visible = true;
        bgEmergModel.group.position.set(
          w.backgroundEmergency.x,
          0,
          w.backgroundEmergency.z,
        );
        bgEmergModel.group.rotation.y = w.backgroundEmergency.yaw;
        const flash = Math.sin(elapsedSec * 19) > 0;
        (
          bgEmergModel.beaconLeft.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = flash ? 3.4 : 0.2;
        (
          bgEmergModel.beaconRight.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = flash ? 0.2 : 3.4;
      } else {
        bgEmergModel.group.visible = false;
      }

      // Sync Active Destination Beacon Ring & Pillar
      for (const [id, beacon] of Object.entries(destinationBeacons)) {
        const isTarget = w.activeDestinationId === id && w.screenState === 'PLAYING';
        beacon.ring.visible = isTarget;
        beacon.pillar.visible = isTarget;
        if (isTarget) {
          beacon.ring.rotation.z = elapsedSec * 2.5;
          beacon.ring.position.y = 0.9 + Math.sin(elapsedSec * 4.5) * 0.35;
        }
      }

      // Sync GreenRoute Road Overlay
      syncRouteRibbon();

      // Handle 3 Screen States: INTRO, VEHICLE_SELECT, PLAYING
      const activeType =
        w.screenState === 'VEHICLE_SELECT'
          ? w.previewVehicleType
          : w.player.type;

      for (const t of ['AMBULANCE', 'FIRE_BRIGADE', 'POLICE'] as EmergencyType[]) {
        playerModels[t].group.visible = t === activeType;
      }
      const activeModel = playerModels[activeType];

      if (w.screenState === 'INTRO') {
        // Cinematic ambulance driving along Central Emergency Parkway (X = 0)
        const introZ = 95 - ((elapsedSec * 22) % 190);
        activeModel.group.position.set(-3.8, 0, introZ);
        activeModel.group.rotation.set(0, Math.PI, 0);

        const flash = Math.sin(elapsedSec * 18) > 0;
        (
          activeModel.beaconLeft.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = flash ? 3.5 : 0.3;
        (
          activeModel.beaconRight.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = flash ? 0.3 : 3.5;
        (
          activeModel.groundHalo.material as THREE.MeshBasicMaterial
        ).opacity = 0.45;

        // Cinematic low-angle tracking camera
        camera.position.set(
          9.5 + Math.sin(elapsedSec * 0.6) * 2.5,
          6.8,
          introZ - 16,
        );
        camera.lookAt(-2, 1.8, introZ + 4);
      } else if (w.screenState === 'VEHICLE_SELECT') {
        // Rotating 3D vehicle showcase on Midtown Plaza (0, 35)
        activeModel.group.position.set(0, 0, 35);
        activeModel.group.rotation.set(0, elapsedSec * 0.85, 0);

        const flash = Math.sin(elapsedSec * 16) > 0;
        (
          activeModel.beaconLeft.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = flash ? 3.5 : 0.3;
        (
          activeModel.beaconRight.material as THREE.MeshStandardMaterial
        ).emissiveIntensity = flash ? 0.3 : 3.5;
        (
          activeModel.groundHalo.material as THREE.MeshBasicMaterial
        ).opacity = 0.45;

        camera.position.set(8.5, 4.6, 44.5);
        camera.lookAt(0, 1.35, 35);
        cameraInitialized = false;
      } else {
        // PLAYING: Full Open-World Player Vehicle Control & Smooth Chase Camera
        const p = w.player;
        activeModel.group.position.set(p.x, 0, p.z);
        activeModel.group.rotation.order = 'YXZ';
        activeModel.group.rotation.set(p.pitch, p.yaw, p.roll);

        const lMat = activeModel.beaconLeft
          .material as THREE.MeshStandardMaterial;
        const rMat = activeModel.beaconRight
          .material as THREE.MeshStandardMaterial;
        const hMat = activeModel.groundHalo.material as THREE.MeshBasicMaterial;

        if (p.sirenActive) {
          const flash = Math.sin(elapsedSec * 19) > 0;
          lMat.emissiveIntensity = flash ? 3.8 : 0.25;
          rMat.emissiveIntensity = flash ? 0.25 : 3.8;
          hMat.opacity = 0.42 + 0.2 * Math.sin(elapsedSec * 9);
        } else {
          lMat.emissiveIntensity = 0.2;
          rMat.emissiveIntensity = 0.2;
          hMat.opacity = 0;
        }

        // Compute desired camera position behind & above the vehicle
        const hx = Math.sin(p.yaw);
        const hz = Math.cos(p.yaw);

        if (w.cameraMode === 'THIRD_PERSON_CHASE') {
          const backDist = 14.5 + Math.max(0, p.speed) * 0.08;
          const upHeight = 6.2;
          _desiredCamPos.set(
            p.x - hx * backDist,
            upHeight,
            p.z - hz * backDist,
          );
          _desiredLookAt.set(
            p.x + hx * 12,
            1.8,
            p.z + hz * 12,
          );
        } else if (w.cameraMode === 'ELEVATED_FOLLOW') {
          const backDist = 26;
          const upHeight = 18.5;
          _desiredCamPos.set(
            p.x - hx * backDist,
            upHeight,
            p.z - hz * backDist,
          );
          _desiredLookAt.set(
            p.x + hx * 14,
            1.5,
            p.z + hz * 14,
          );
        } else {
          // TOP_DOWN tactical view
          _desiredCamPos.set(p.x - hx * 4, 88, p.z - hz * 4);
          _desiredLookAt.set(p.x + hx * 8, 0, p.z + hz * 8);
        }

        if (!cameraInitialized) {
          camera.position.copy(_desiredCamPos);
          _smoothLookAt.copy(_desiredLookAt);
          cameraInitialized = true;
        } else {
          const dampSpeed = 7.5 * w.cameraSensitivity;
          const alpha = 1 - Math.exp(-dampSpeed * dt);
          camera.position.lerp(_desiredCamPos, alpha);
          _smoothLookAt.lerp(_desiredLookAt, alpha * 1.25);
        }

        camera.lookAt(_smoothLookAt);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isUnmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [worldRef]);

  return (
    <div
      ref={canvasMountRef}
      className="w-full h-full relative overflow-hidden bg-[#070e1b]"
      aria-label="GreenRoute 3D Open-World Driving Viewport"
    />
  );
};
