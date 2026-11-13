import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActiveMissionState,
  BackgroundEmergencyVehicle,
  CivilianVehicleState,
  DrivingCameraMode,
  EmergencyType,
  GameScreenState,
  GameSettings,
  IntersectionSignalState,
  NavigationGuidance,
  PlayMode,
  PlayerVehicleState,
  PriorityRequest,
  RouteResult,
  SignalNotificationBanner,
} from './types/greenroute';
import {
  GRID_COORDS,
  calculateOptimalRoute,
  computeNavigationGuidance,
  findBestStartNodeForVehicle,
  findNearestReachableDestination,
  getProceduralCityWorld,
  getRandomValidRoadSpawn,
} from './engine/roadGraph';
import {
  arbitrateIntersectionRequests,
  createAllCityIntersections,
  getSignalTimingsForDifficulty,
  stepIntersectionController,
} from './engine/priorityEngine';
import {
  DrivingInputState,
  createInitialPlayerVehicle,
  stepPlayerVehiclePhysics,
} from './engine/vehiclePhysics';
import { soundEngine } from './engine/soundEffects';
import {
  CityViewport3D,
  OpenWorldMutableRef,
} from './components/CityViewport3D';
import { TitleScreenOverlay } from './components/TitleScreenOverlay';
import { DrivingGameHUD } from './components/DrivingGameHUD';
import {
  MissionOutcomeModal,
  PauseAndSettingsModal,
} from './components/InfoModals';

const STORAGE_KEY = 'greenroute_openworld_settings_v2';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.5,
  sirenVolume: 0.45,
  isMuted: false,
  graphicsQuality: 'HIGH',
  cameraSensitivity: 1.0,
  drivingSensitivity: 1.0,
  difficulty: 'NORMAL',
  backgroundEmergencyTraffic: true,
  minimapVisible: true,
  minimapRotateWithPlayer: true,
  simplifiedCollisions: false,
  priorityPolicy: 'EMERGENCY_CLASS_FIRST',
};

function loadInitialSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore storage restriction
  }
  return DEFAULT_SETTINGS;
}

function createCityCivilianVehicles(): CivilianVehicleState[] {
  const palette = [
    0x64748b, 0x94a3b8, 0x38bdf8, 0xfbbf24, 0xcbd5e1, 0x475569, 0xf87171,
  ];
  const models: Array<'SEDAN' | 'SUV' | 'TRANSIT'> = [
    'SEDAN',
    'SUV',
    'TRANSIT',
  ];
  const list: CivilianVehicleState[] = [];
  let idx = 0;

  // Populate vehicles across the 7 NS and 7 EW avenues
  for (let i = 0; i < GRID_COORDS.length; i++) {
    const roadCoord = GRID_COORDS[i];
    for (const pos of [-260, -85, 85, 255]) {
      // NS vehicle
      const dirNs: 1 | -1 = idx % 2 === 0 ? 1 : -1;
      list.push({
        id: `CIV-NS-${i}-${pos}`,
        x: roadCoord + (dirNs === 1 ? 3.6 : -3.6),
        z: pos,
        yaw: dirNs === 1 ? 0 : Math.PI,
        speed: 13,
        maxSpeed: 13 + (idx % 4),
        axis: 'NS',
        direction: dirNs,
        roadCoord,
        laneOffset: dirNs === 1 ? 3.6 : -3.6,
        colorHex: palette[idx % palette.length],
        modelType: models[idx % models.length],
      });
      idx++;

      // EW vehicle
      const dirEw: 1 | -1 = idx % 2 === 0 ? 1 : -1;
      list.push({
        id: `CIV-EW-${i}-${pos}`,
        x: pos,
        z: roadCoord + (dirEw === 1 ? 3.6 : -3.6),
        yaw: dirEw === 1 ? Math.PI / 2 : -Math.PI / 2,
        speed: 13,
        maxSpeed: 12 + (idx % 4),
        axis: 'EW',
        direction: dirEw,
        roadCoord,
        laneOffset: dirEw === 1 ? 3.6 : -3.6,
        colorHex: palette[idx % palette.length],
        modelType: models[idx % models.length],
      });
      idx++;
    }
  }
  return list;
}

function createInitialBackgroundEmergency(): BackgroundEmergencyVehicle {
  return {
    id: 'BG-EV-FIRE-02',
    callSign: 'AI-FIRE-02',
    type: 'FIRE_BRIGADE',
    x: -180,
    z: 3.6,
    yaw: Math.PI / 2,
    speed: 21,
    maxSpeed: 22,
    axis: 'EW',
    direction: 1,
    roadCoord: 0,
    sirenActive: true,
    targetIntersectionId: 'I-33',
    etaSeconds: 8.0,
  };
}

export default function App() {
  const cityWorld = useRef(getProceduralCityWorld());
  const [settings, setSettings] = useState<GameSettings>(loadInitialSettings);

  // Primary Game Screen & Play Mode State
  const [screenState, setScreenState] = useState<GameScreenState>('INTRO');
  const [playMode, setPlayMode] = useState<PlayMode>('FREE_ROAM');
  const [selectedVehicleType, setSelectedVehicleType] =
    useState<EmergencyType>('AMBULANCE');
  const [cameraMode, setCameraMode] =
    useState<DrivingCameraMode>('THIRD_PERSON_CHASE');

  // Menus & Modals
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [settingsModalFromTitle, setSettingsModalFromTitle] =
    useState<boolean>(false);
  const [showCancelMissionConfirm, setShowCancelMissionConfirm] =
    useState<boolean>(false);

  // HUD Snapshot States (Updated smoothly at ~10Hz from authoritative game loop)
  const initialSpawn = useRef(getRandomValidRoadSpawn(20261027));
  const [playerHud, setPlayerHud] = useState<PlayerVehicleState>(() =>
    createInitialPlayerVehicle(
      'AMBULANCE',
      initialSpawn.current.x,
      initialSpawn.current.z,
      initialSpawn.current.yaw,
    ),
  );
  const [missionHud, setMissionHud] = useState<ActiveMissionState | null>(null);
  const [navigationHud, setNavigationHud] =
    useState<NavigationGuidance | null>(null);
  const [activeRouteHud, setActiveRouteHud] = useState<RouteResult | null>(
    null,
  );
  const [intersectionsHud, setIntersectionsHud] = useState<
    Record<string, IntersectionSignalState>
  >(() => createAllCityIntersections());
  const [priorityRequestsHud, setPriorityRequestsHud] = useState<
    PriorityRequest[]
  >([]);
  const [bgEmergencyHud, setBgEmergencyHud] =
    useState<BackgroundEmergencyVehicle | null>(null);
  const [notifications, setNotifications] = useState<
    SignalNotificationBanner[]
  >([]);

  // Continuous Keyboard Driving Input Ref
  const inputRef = useRef<DrivingInputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  });

  // Authoritative 60fps Game World State Ref
  const gameRef = useRef({
    simTime: 0,
    screenState: 'INTRO' as GameScreenState,
    playMode: 'FREE_ROAM' as PlayMode,
    isPaused: false,
    settings: loadInitialSettings(),
    selectedVehicleType: 'AMBULANCE' as EmergencyType,
    cameraMode: 'THIRD_PERSON_CHASE' as DrivingCameraMode,
    player: createInitialPlayerVehicle(
      'AMBULANCE',
      initialSpawn.current.x,
      initialSpawn.current.z,
      initialSpawn.current.yaw,
    ),
    mission: null as ActiveMissionState | null,
    activeRoute: null as RouteResult | null,
    navigation: null as NavigationGuidance | null,
    missionStartPose: {
      x: initialSpawn.current.x,
      z: initialSpawn.current.z,
      yaw: initialSpawn.current.yaw,
    },
    intersections: createAllCityIntersections(),
    civilians: createCityCivilianVehicles(),
    bgEmergency: createInitialBackgroundEmergency() as BackgroundEmergencyVehicle | null,
    priorityRequests: [] as PriorityRequest[],
    crossedIntersectionSet: new Set<string>(),
    preemptedIntersectionSet: new Set<string>(),
    announcedPreemptSet: new Set<string>(),
    wasStoppedAtRed: false,
    lastRerouteSimTime: -10,
    lastCollisionSoundTime: -10,
    hudSyncTimer: 0,
    spawnSeedCounter: 1,
  });

  // Push a contextual HUD banner notification
  const pushNotification = useCallback(
    (
      title: string,
      subtitle: string,
      tone: 'EMERALD' | 'AMBER' | 'RED' | 'BLUE' = 'EMERALD',
    ) => {
      const id = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setNotifications((prev) => [
        { id, title, subtitle, tone, timestamp: Date.now() },
        ...prev.slice(0, 2),
      ]);
      window.setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 4200);
    },
    [],
  );

  // Update & Persist Settings
  const handleUpdateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      gameRef.current.settings = next;
      soundEngine.configureAudio(
        next.masterVolume,
        next.sirenVolume,
        next.isMuted,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  }, []);

  // Spawn Selected Vehicle at a Random Valid Road Position and Enter Free Roam
  const handleStartFreeRoamWithVehicle = useCallback(
    (type: EmergencyType) => {
      soundEngine.markUserInteraction();
      const g = gameRef.current;
      g.spawnSeedCounter += 137;
      const validSpawn = getRandomValidRoadSpawn(
        Date.now() + g.spawnSeedCounter,
      );

      const newPlayer = createInitialPlayerVehicle(
        type,
        validSpawn.x,
        validSpawn.z,
        validSpawn.yaw,
      );

      g.selectedVehicleType = type;
      g.player = newPlayer;
      g.screenState = 'PLAYING';
      g.playMode = 'FREE_ROAM';
      g.isPaused = false;
      g.mission = null;
      g.activeRoute = null;
      g.navigation = null;
      g.priorityRequests = [];
      g.crossedIntersectionSet.clear();
      g.preemptedIntersectionSet.clear();
      g.announcedPreemptSet.clear();

      setSelectedVehicleType(type);
      setScreenState('PLAYING');
      setPlayMode('FREE_ROAM');
      setIsPaused(false);
      setShowCancelMissionConfirm(false);
      setPlayerHud({ ...newPlayer });
      setMissionHud(null);
      setActiveRouteHud(null);
      setNavigationHud(null);
      setPriorityRequestsHud([]);

      pushNotification(
        `${newPlayer.name} Deployed on ${validSpawn.roadName}`,
        'Free Roam active. Drive with WASD/Arrows or press CAPS LOCK to start an emergency mission.',
        'BLUE',
      );
    },
    [pushNotification],
  );

  // Start an Emergency Mission from the Player's Current Position (Triggered by CAPS LOCK)
  const startMissionFromCurrentPosition = useCallback(
    (restoreToSavedStart = false) => {
      soundEngine.markUserInteraction();
      const g = gameRef.current;
      const p = g.player;

      if (restoreToSavedStart) {
        p.x = g.missionStartPose.x;
        p.z = g.missionStartPose.z;
        p.yaw = g.missionStartPose.yaw;
        p.speed = 0;
      } else {
        g.missionStartPose = { x: p.x, z: p.z, yaw: p.yaw };
      }

      const nearest = findNearestReachableDestination(p.x, p.z, p.yaw, p.type);
      if (!nearest) return;

      const { destinationNode, route } = nearest;

      // Calculate Mission Deadline based on Route Distance and Configurable Difficulty
      const diff = g.settings.difficulty;
      const targetSpeedMps =
        diff === 'EASY' ? 16.5 : diff === 'NORMAL' ? 21.5 : 25.5;
      const baseBufferSec = diff === 'EASY' ? 26 : diff === 'NORMAL' ? 18 : 12;
      const intersectionBufferSec = route.upcomingIntersections.length * 2.2;
      const deadlineSeconds = Math.max(
        28,
        Math.round(
          route.totalDistanceMeters / targetSpeedMps +
            baseBufferSec +
            intersectionBufferSec,
        ),
      );

      const incidentTitles: Record<EmergencyType, string> = {
        AMBULANCE: 'Priority-1 Cardiac & Trauma Transport',
        FIRE_BRIGADE: 'Multi-Alarm Structure Fire Mobilization',
        POLICE: 'Code-3 Tactical Precinct Response',
      };

      const newMission: ActiveMissionState = {
        missionId: `MSN-${Date.now()}`,
        incidentTitle: incidentTitles[p.type],
        emergencyType: p.type,
        destinationNodeId: destinationNode.id,
        destinationName: destinationNode.label,
        destinationDistrict: destinationNode.districtName || 'City Sector',
        destinationPos: { x: destinationNode.x, z: destinationNode.z },
        initialRouteDistanceMeters: route.totalDistanceMeters,
        remainingDistanceMeters: route.totalDistanceMeters,
        deadlineTotalSeconds: deadlineSeconds,
        remainingTimeSeconds: deadlineSeconds,
        elapsedTimeSeconds: 0,
        intersectionsCrossed: 0,
        signalsGrantedPriority: 0,
        redSignalStopsCount: 0,
        rerouteCount: 0,
        score: 0,
      };

      p.sirenActive = true;
      p.condition = 100;
      g.playMode = 'EMERGENCY_MISSION';
      g.mission = newMission;
      g.activeRoute = route;
      g.crossedIntersectionSet.clear();
      g.preemptedIntersectionSet.clear();
      g.announcedPreemptSet.clear();
      g.wasStoppedAtRed = false;

      const navRes = computeNavigationGuidance(p, route, g.intersections);
      g.navigation = navRes.guidance;

      setPlayMode('EMERGENCY_MISSION');
      setShowCancelMissionConfirm(false);
      setMissionHud({ ...newMission });
      setActiveRouteHud({ ...route });
      setNavigationHud({ ...navRes.guidance });
      setPlayerHud({ ...p });

      soundEngine.playChime('MISSION_START');
      pushNotification(
        `EMERGENCY MISSION STARTED · ${destinationNode.label}`,
        `Distance: ${route.totalDistanceMeters} m · Deadline: ${deadlineSeconds}s · GreenRoute Signal Priority Active`,
        'EMERALD',
      );
    },
    [pushNotification],
  );

  // Cancel Active Mission or Return to Free Roam Safely
  const handleReturnToFreeRoam = useCallback(() => {
    const g = gameRef.current;
    g.player.sirenActive = false;
    g.playMode = 'FREE_ROAM';
    g.isPaused = false;
    g.mission = null;
    g.activeRoute = null;
    g.navigation = null;
    g.priorityRequests = [];
    g.crossedIntersectionSet.clear();
    g.preemptedIntersectionSet.clear();
    g.announcedPreemptSet.clear();

    soundEngine.stopSirenLoop();
    setPlayMode('FREE_ROAM');
    setIsPaused(false);
    setShowCancelMissionConfirm(false);
    setMissionHud(null);
    setActiveRouteHud(null);
    setNavigationHud(null);
    setPriorityRequestsHud([]);
    setPlayerHud({ ...g.player });

    pushNotification(
      'Returned to Free Roam',
      'Siren deactivated and GreenRoute signal priority safely released.',
      'BLUE',
    );
  }, [pushNotification]);

  // Handle CAPS LOCK Toggle Action
  const handleCapsLockTrigger = useCallback(() => {
    const g = gameRef.current;
    if (g.screenState !== 'PLAYING' || g.isPaused) return;

    if (g.playMode === 'FREE_ROAM') {
      startMissionFromCurrentPosition(false);
    } else if (g.playMode === 'EMERGENCY_MISSION') {
      // Do NOT silently reset the mission timer; toggle the cancel confirmation prompt
      setShowCancelMissionConfirm((prev) => !prev);
    }
  }, [startMissionFromCurrentPosition]);

  // Reset Vehicle to Nearest Safe Road Position (`R` Key)
  const handleResetVehicleToSafeRoad = useCallback(() => {
    const g = gameRef.current;
    const p = g.player;
    const nodeId = findBestStartNodeForVehicle(p.x, p.z, p.yaw);
    const node = cityWorld.current.nodes[nodeId];
    if (node) {
      // Place slightly offset along the road from the node so not sitting inside an intersection box
      p.x = node.x;
      p.z = node.z + 24;
      p.yaw = Math.PI;
      p.speed = 0;
      setPlayerHud({ ...p });
      pushNotification(
        'Vehicle Reset to Safe Road Position',
        `Positioned near ${node.label}.`,
        'BLUE',
      );
    }
  }, [pushNotification]);

  // Cycle Camera Views (`C` Key)
  const handleCycleCameraMode = useCallback(() => {
    const modes: DrivingCameraMode[] = [
      'THIRD_PERSON_CHASE',
      'ELEVATED_FOLLOW',
      'TOP_DOWN',
    ];
    setCameraMode((prev) => {
      const next = modes[(modes.indexOf(prev) + 1) % modes.length];
      gameRef.current.cameraMode = next;
      return next;
    });
  }, []);

  // Keyboard Listeners (WASD, Arrows, Caps Lock rising-edge, Space, R, C, M, ESC)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.markUserInteraction();
      const code = e.code;
      const key = e.key;

      // Prevent browser page scrolling when driving with Arrow keys or Spacebar
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
        ].includes(code)
      ) {
        if (gameRef.current.screenState === 'PLAYING') {
          e.preventDefault();
        }
      }

      // Continuous Driving Inputs
      if (code === 'KeyW' || code === 'ArrowUp') inputRef.current.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown')
        inputRef.current.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight')
        inputRef.current.right = true;
      if (code === 'Space') inputRef.current.handbrake = true;

      // Rising-Edge Only Actions (!e.repeat)
      if (e.repeat) return;

      if (code === 'CapsLock' || key === 'CapsLock') {
        e.preventDefault();
        handleCapsLockTrigger();
        return;
      }

      if (code === 'Escape') {
        if (gameRef.current.screenState === 'PLAYING') {
          e.preventDefault();
          setIsPaused((prev) => {
            const next = !prev;
            gameRef.current.isPaused = next;
            return next;
          });
          setSettingsModalFromTitle(false);
        }
        return;
      }

      if (gameRef.current.screenState !== 'PLAYING' || gameRef.current.isPaused)
        return;

      if (code === 'KeyR') {
        e.preventDefault();
        handleResetVehicleToSafeRoad();
      } else if (code === 'KeyC') {
        e.preventDefault();
        handleCycleCameraMode();
      } else if (code === 'KeyM') {
        e.preventDefault();
        handleUpdateSettings({
          minimapVisible: !gameRef.current.settings.minimapVisible,
        });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp')
        inputRef.current.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown')
        inputRef.current.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft')
        inputRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight')
        inputRef.current.right = false;
      if (code === 'Space') inputRef.current.handbrake = false;
    };

    const onWindowBlur = () => {
      inputRef.current.forward = false;
      inputRef.current.backward = false;
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.handbrake = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    handleCapsLockTrigger,
    handleCycleCameraMode,
    handleResetVehicleToSafeRoad,
    handleUpdateSettings,
  ]);

  // Authoritative 60fps Game Loop Callback invoked by CityViewport3D
  const onTickGame = useCallback(
    (dt: number) => {
      const g = gameRef.current;

      // Update Audio (Engine Hum & Siren)
      const isActivelyDriving =
        g.screenState === 'PLAYING' &&
        !g.isPaused &&
        (g.playMode === 'FREE_ROAM' || g.playMode === 'EMERGENCY_MISSION');

      soundEngine.updateEngineHum(g.player.speed, isActivelyDriving);
      soundEngine.updateSiren(
        isActivelyDriving && g.player.sirenActive ? g.player.type : null,
        g.isPaused,
      );

      if (g.isPaused) return;
      g.simTime += dt;

      // 1. If in PLAYING state (Free Roam or Active Mission), step player vehicle physics
      if (isActivelyDriving) {
        const { collided } = stepPlayerVehiclePhysics(
          g.player,
          inputRef.current,
          dt,
          g.settings.drivingSensitivity,
          cityWorld.current.buildings,
          g.civilians,
          g.settings.simplifiedCollisions,
        );

        if (collided && g.simTime - g.lastCollisionSoundTime > 0.35) {
          g.lastCollisionSoundTime = g.simTime;
          soundEngine.playChime('COLLISION');
        }
      }

      // 2. Step Background AI Emergency Vehicle (when enabled in settings)
      if (g.settings.backgroundEmergencyTraffic) {
        if (!g.bgEmergency) {
          g.bgEmergency = createInitialBackgroundEmergency();
        }
        const bg = g.bgEmergency;
        bg.x += bg.direction * bg.speed * dt;
        if (bg.x > 340) bg.x = -340;
        if (bg.x < -340) bg.x = 340;

        // Identify closest intersection ahead of bgEmergency along Z = 0 (Row 3)
        let nextBgJunc: string | null = null;
        let minBgDist = Infinity;
        for (let c = 0; c < GRID_COORDS.length; c++) {
          const jx = GRID_COORDS[c];
          const ahead = (jx - bg.x) * bg.direction;
          if (ahead > 5 && ahead < 165 && ahead < minBgDist) {
            minBgDist = ahead;
            nextBgJunc = `I-3${c}`;
          }
        }
        bg.targetIntersectionId = nextBgJunc;
        bg.etaSeconds = nextBgJunc ? minBgDist / Math.max(12, bg.speed) : 99;
      } else {
        g.bgEmergency = null;
      }

      // 3. Active Emergency Mission Logic: Countdown, Navigation, Wrong-Turn Rerouting & Early Signal Priority
      const currentFrameRequests: PriorityRequest[] = [];

      if (
        g.screenState === 'PLAYING' &&
        g.playMode === 'EMERGENCY_MISSION' &&
        g.mission &&
        g.activeRoute
      ) {
        const m = g.mission;
        const p = g.player;

        // Advance Mission Countdown Timer
        m.elapsedTimeSeconds += dt;
        m.remainingTimeSeconds = Math.max(
          0,
          m.deadlineTotalSeconds - m.elapsedTimeSeconds,
        );

        // Check for Mission Failure (Deadline Expired)
        if (m.remainingTimeSeconds <= 0) {
          p.sirenActive = false;
          p.speed = 0;
          g.playMode = 'MISSION_FAILED';
          m.failureReason =
            'The emergency response countdown reached 00:00.0 before arriving at the destination.';
          g.priorityRequests = [];
          soundEngine.stopSirenLoop();
          soundEngine.playChime('MISSION_FAILED');
          setPlayMode('MISSION_FAILED');
          setMissionHud({ ...m });
          setPlayerHud({ ...p });
          return;
        }

        // Check for Mission Completion (Reached Destination Bay within 19m)
        const distToDest = Math.hypot(
          m.destinationPos.x - p.x,
          m.destinationPos.z - p.z,
        );
        if (distToDest <= 19) {
          p.sirenActive = false;
          p.speed = 0;
          g.playMode = 'MISSION_SUCCESS';
          g.priorityRequests = [];

          // Calculate Score based on remaining time, route distance, signals preempted, and vehicle condition
          const timeBonus = Math.round(m.remainingTimeSeconds * 35);
          const distBonus = Math.round(m.initialRouteDistanceMeters * 1.2);
          const priorityBonus = m.signalsGrantedPriority * 120;
          const conditionFactor = Math.round(p.condition * 5);
          m.score = timeBonus + distBonus + priorityBonus + conditionFactor;

          soundEngine.stopSirenLoop();
          soundEngine.playChime('MISSION_SUCCESS');
          setPlayMode('MISSION_SUCCESS');
          setMissionHud({ ...m });
          setPlayerHud({ ...p });
          return;
        }

        // Compute Turn-by-Turn Navigation & Wrong-Turn Off-Route Detection
        const navCheck = computeNavigationGuidance(
          p,
          g.activeRoute,
          g.intersections,
        );
        g.navigation = navCheck.guidance;
        m.remainingDistanceMeters = navCheck.guidance.remainingDistanceMeters;

        // If player took a wrong turn (> 32m off the planned route corridor), automatically recalculate route!
        if (
          navCheck.offRouteDistance > 32 &&
          g.simTime - g.lastRerouteSimTime > 2.5
        ) {
          g.lastRerouteSimTime = g.simTime;
          const newStartNode = findBestStartNodeForVehicle(p.x, p.z, p.yaw);
          const recalc = calculateOptimalRoute(
            newStartNode,
            m.destinationNodeId,
          );
          if (recalc) {
            g.activeRoute = recalc;
            m.rerouteCount += 1;
            soundEngine.playChime('REROUTE');
            pushNotification(
              'REROUTING...',
              `Recalculated shortest road path to ${m.destinationName} (${recalc.totalDistanceMeters} m).`,
              'AMBER',
            );
          }
        }

        // Track intersections crossed & red-signal stops
        for (const [jId, jState] of Object.entries(g.intersections)) {
          const dJunc = Math.hypot(jState.x - p.x, jState.z - p.z);
          if (dJunc < 12 && !g.crossedIntersectionSet.has(jId)) {
            g.crossedIntersectionSet.add(jId);
            m.intersectionsCrossed += 1;
          }
          if (dJunc > 9 && dJunc < 22 && Math.abs(p.speed) < 1.2) {
            const lamp =
              p.currentAxis === 'NS' ? jState.nsLamp : jState.ewLamp;
            if (lamp === 'RED' && !g.wasStoppedAtRed) {
              g.wasStoppedAtRed = true;
              m.redSignalStopsCount += 1;
            }
          } else if (Math.abs(p.speed) > 4) {
            g.wasStoppedAtRed = false;
          }
        }

        // Early GreenRoute Signal Priority Request Generation for Upcoming Intersections on Route
        const timings = getSignalTimingsForDifficulty(g.settings.difficulty);
        const wps = g.activeRoute.waypoints;

        for (let i = navCheck.closestWaypointIdx; i < wps.length; i++) {
          const wp = wps[i];
          const node = cityWorld.current.nodes[wp.nodeId];
          if (!node || node.type !== 'INTERSECTION') continue;

          const distToJunction = Math.hypot(node.x - p.x, node.z - p.z);
          // Only request priority for intersections ahead within the anticipation threshold (e.g. 175m)
          if (
            distToJunction <= timings.ANTICIPATION_DISTANCE_METERS &&
            !g.crossedIntersectionSet.has(node.id)
          ) {
            // Determine the approach axis of the road segment leading into this intersection
            const prevPt = i > 0 ? wps[i - 1] : { x: p.x, z: p.z };
            const segDx = wp.x - prevPt.x;
            const segDz = wp.z - prevPt.z;
            const reqAxis =
              Math.abs(segDz) >= Math.abs(segDx) ? 'NS' : 'EW';
            const reqCardinal =
              reqAxis === 'NS'
                ? segDz < 0
                  ? 'NORTH'
                  : 'SOUTH'
                : segDx > 0
                  ? 'EAST'
                  : 'WEST';

            const etaSec = Math.max(
              0.5,
              distToJunction / Math.max(16, Math.abs(p.speed)),
            );

            currentFrameRequests.push({
              requestId: `REQ-PLAYER-${node.id}`,
              vehicleId: p.callSign,
              callSign: p.callSign,
              isPlayer: true,
              emergencyType: p.type,
              intersectionId: node.id,
              requestedAxis: reqAxis,
              requestedCardinal: reqCardinal,
              etaSeconds: etaSec,
              distanceMeters: Math.round(distToJunction),
              requestTimestamp: g.simTime - 5,
              authenticated: true,
              status: 'ACTIVE',
              priorityScore: 0,
              explanation: '',
            });

            if (!g.announcedPreemptSet.has(node.id)) {
              g.announcedPreemptSet.add(node.id);
              pushNotification(
                `EMERGENCY PRIORITY REQUESTED · ${node.id}`,
                `Approaching ${node.label} (${Math.round(distToJunction)} m, ETA ${etaSec.toFixed(1)}s). Preparing ${reqAxis} Green corridor.`,
                'BLUE',
              );
            }
          }
        }
      }

      // Add Background Emergency Vehicle Priority Request if approaching an intersection
      const bg = g.bgEmergency;
      if (bg && bg.targetIntersectionId) {
        const bgIntersectionId: string = bg.targetIntersectionId;
        currentFrameRequests.push({
          requestId: `REQ-BG-${bgIntersectionId}`,
          vehicleId: bg.id,
          callSign: bg.callSign,
          isPlayer: false,
          emergencyType: bg.type,
          intersectionId: bgIntersectionId,
          requestedAxis: bg.axis,
          requestedCardinal: bg.direction === 1 ? 'EAST' : 'WEST',
          etaSeconds: bg.etaSeconds,
          distanceMeters: Math.round(bg.etaSeconds * bg.speed),
          requestTimestamp: g.simTime,
          authenticated: true,
          status: 'ACTIVE',
          priorityScore: 0,
          explanation: '',
        });
      }

      // 4. Arbitrate & Step All 49 Intersection Signal Controllers
      for (const [jId, ctrlState] of Object.entries(g.intersections)) {
        const jReqs = currentFrameRequests.filter(
          (r) => r.intersectionId === jId,
        );
        const arb = arbitrateIntersectionRequests(
          jReqs,
          g.settings.priorityPolicy,
        );

        const stepRes = stepIntersectionController(
          ctrlState,
          dt,
          arb.targetAxis,
          arb.winnerIds,
          arb.queuedIds,
          g.settings.difficulty,
        );
        g.intersections[jId] = stepRes.updated;

        // If player request just received Emergency Green at this intersection, count it & notify!
        const playerWonHere = jReqs.some(
          (r) => r.isPlayer && arb.winnerIds.includes(r.requestId),
        );
        if (
          playerWonHere &&
          stepRes.updated.phase === 'EMERGENCY_GREEN' &&
          !g.preemptedIntersectionSet.has(jId)
        ) {
          g.preemptedIntersectionSet.add(jId);
          if (g.mission) {
            g.mission.signalsGrantedPriority += 1;
          }
          soundEngine.playChime('PRIORITY_GRANTED');
          pushNotification(
            `GREENROUTE PRIORITY GRANTED · ${jId}`,
            `${stepRes.updated.name} locked to ${arb.targetAxis} GREEN ahead of arrival.`,
            'EMERALD',
          );
        }
      }

      g.priorityRequests = currentFrameRequests;

      // 5. Step Civilian Traffic (obeying red/yellow lights and never running red signals)
      const trafficSpeedMult =
        g.settings.difficulty === 'EASY'
          ? 0.85
          : g.settings.difficulty === 'HARD'
            ? 1.15
            : 1.0;

      for (const cv of g.civilians) {
        let stopForSignal = false;

        // Check nearest intersection ahead on cv's road line
        for (const cCoord of GRID_COORDS) {
          if (cv.axis === 'NS') {
            const dz = (cCoord - cv.z) * cv.direction;
            if (dz > 9 && dz < 19) {
              const rIdx = GRID_COORDS.indexOf(cCoord);
              const cIdx = GRID_COORDS.indexOf(cv.roadCoord);
              const jState = g.intersections[`I-${rIdx}${cIdx}`];
              if (jState && jState.nsLamp !== 'GREEN') {
                stopForSignal = true;
                break;
              }
            }
          } else {
            const dx = (cCoord - cv.x) * cv.direction;
            if (dx > 9 && dx < 19) {
              const rIdx = GRID_COORDS.indexOf(cv.roadCoord);
              const cIdx = GRID_COORDS.indexOf(cCoord);
              const jState = g.intersections[`I-${rIdx}${cIdx}`];
              if (jState && jState.ewLamp !== 'GREEN') {
                stopForSignal = true;
                break;
              }
            }
          }
        }

        if (stopForSignal) {
          cv.speed = Math.max(0, cv.speed - 32 * dt);
        } else {
          cv.speed = Math.min(
            cv.maxSpeed * trafficSpeedMult,
            cv.speed + 16 * dt,
          );
        }

        if (cv.axis === 'NS') {
          cv.z += cv.direction * cv.speed * dt;
          if (cv.z > 348) cv.z = -348;
          if (cv.z < -348) cv.z = 348;
        } else {
          cv.x += cv.direction * cv.speed * dt;
          if (cv.x > 348) cv.x = -348;
          if (cv.x < -348) cv.x = 348;
        }
      }

      // 6. Sync HUD State at ~10Hz
      g.hudSyncTimer += dt;
      if (g.hudSyncTimer >= 0.1) {
        g.hudSyncTimer = 0;
        setPlayerHud({ ...g.player });
        if (g.mission) setMissionHud({ ...g.mission });
        if (g.navigation) setNavigationHud({ ...g.navigation });
        setIntersectionsHud({ ...g.intersections });
        setPriorityRequestsHud([...g.priorityRequests]);
        setBgEmergencyHud(g.bgEmergency ? { ...g.bgEmergency } : null);
      }
    },
    [pushNotification],
  );

  // Mutable Ref passed to CityViewport3D
  const worldRef = useRef<OpenWorldMutableRef>({
    screenState: 'INTRO',
    previewVehicleType: 'AMBULANCE',
    player: gameRef.current.player,
    activeRoute: null,
    activeDestinationId: null,
    intersections: gameRef.current.intersections,
    civilians: gameRef.current.civilians,
    backgroundEmergency: gameRef.current.bgEmergency,
    cameraMode: 'THIRD_PERSON_CHASE',
    cameraSensitivity: 1.0,
    onTickGame,
  });

  // Keep worldRef synchronized with latest references
  worldRef.current.screenState = screenState;
  worldRef.current.previewVehicleType = selectedVehicleType;
  worldRef.current.player = gameRef.current.player;
  worldRef.current.activeRoute = gameRef.current.activeRoute;
  worldRef.current.activeDestinationId =
    gameRef.current.mission?.destinationNodeId || null;
  worldRef.current.intersections = gameRef.current.intersections;
  worldRef.current.civilians = gameRef.current.civilians;
  worldRef.current.backgroundEmergency = gameRef.current.bgEmergency;
  worldRef.current.cameraMode = cameraMode;
  worldRef.current.cameraSensitivity = settings.cameraSensitivity;
  worldRef.current.onTickGame = onTickGame;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070e1b] select-none">
      {/* 1. Full-Viewport 3D Open-World City Canvas */}
      <CityViewport3D worldRef={worldRef} />

      {/* 2. Intro Screen & 3D Vehicle Selection Screen */}
      <TitleScreenOverlay
        screenState={screenState}
        selectedVehicleType={selectedVehicleType}
        onHighlightVehicle={(type) => {
          soundEngine.markUserInteraction();
          setSelectedVehicleType(type);
          gameRef.current.selectedVehicleType = type;
        }}
        onClickPlayGame={() => {
          soundEngine.markUserInteraction();
          setScreenState('VEHICLE_SELECT');
          gameRef.current.screenState = 'VEHICLE_SELECT';
        }}
        onConfirmSelectVehicle={(type) => {
          handleStartFreeRoamWithVehicle(type);
        }}
        onBackToIntro={() => {
          setScreenState('INTRO');
          gameRef.current.screenState = 'INTRO';
        }}
        onOpenSettings={() => {
          soundEngine.markUserInteraction();
          setSettingsModalFromTitle(true);
          setIsPaused(true);
          gameRef.current.isPaused = true;
        }}
      />

      {/* 3. In-Game Driving HUD (Visible during Free Roam and Emergency Missions) */}
      {screenState === 'PLAYING' && (
        <DrivingGameHUD
          playMode={playMode}
          player={playerHud}
          mission={missionHud}
          navigation={navigationHud}
          activeRoute={activeRouteHud}
          intersections={intersectionsHud}
          priorityRequests={priorityRequestsHud}
          backgroundEmergency={bgEmergencyHud}
          settings={settings}
          cameraMode={cameraMode}
          notifications={notifications}
          showCancelMissionConfirm={showCancelMissionConfirm}
          onTriggerCapsLockSiren={handleCapsLockTrigger}
          onConfirmCancelMission={handleReturnToFreeRoam}
          onDismissCancelMission={() => setShowCancelMissionConfirm(false)}
          onCycleCamera={handleCycleCameraMode}
          onResetCarPosition={handleResetVehicleToSafeRoad}
          onOpenPauseMenu={() => {
            setSettingsModalFromTitle(false);
            setIsPaused(true);
            gameRef.current.isPaused = true;
          }}
          onToggleMinimapRotate={() =>
            handleUpdateSettings({
              minimapRotateWithPlayer: !settings.minimapRotateWithPlayer,
            })
          }
        />
      )}

      {/* 4. Pause Menu & Settings Modal (ESC) */}
      <PauseAndSettingsModal
        isOpen={isPaused}
        settingsOnlyMode={settingsModalFromTitle}
        playMode={playMode}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResume={() => {
          setIsPaused(false);
          setSettingsModalFromTitle(false);
          gameRef.current.isPaused = false;
        }}
        onRestartMission={() => {
          setIsPaused(false);
          gameRef.current.isPaused = false;
          startMissionFromCurrentPosition(
            playMode === 'EMERGENCY_MISSION',
          );
        }}
        onReturnToFreeRoam={handleReturnToFreeRoam}
        onGoToMainMenu={() => {
          handleReturnToFreeRoam();
          setScreenState('INTRO');
          gameRef.current.screenState = 'INTRO';
        }}
      />

      {/* 5. Mission Completed & Mission Failed Outcome Modal */}
      <MissionOutcomeModal
        playMode={playMode}
        mission={missionHud}
        vehicleCondition={playerHud.condition}
        onRetryOrPlayAgain={() => {
          startMissionFromCurrentPosition(playMode === 'MISSION_FAILED');
        }}
        onReturnToFreeRoam={handleReturnToFreeRoam}
      />
    </div>
  );
}
