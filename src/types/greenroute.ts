export type EmergencyType = 'AMBULANCE' | 'FIRE_BRIGADE' | 'POLICE';

export type ApproachAxis = 'NS' | 'EW';

export type CardinalDirection = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export type SignalLampColor = 'RED' | 'YELLOW' | 'GREEN';

export type ControllerPhase =
  | 'NORMAL_NS_GREEN'
  | 'NORMAL_NS_YELLOW'
  | 'NORMAL_ALL_RED_TO_EW'
  | 'NORMAL_EW_GREEN'
  | 'NORMAL_EW_YELLOW'
  | 'NORMAL_ALL_RED_TO_NS'
  | 'PREEMPT_YELLOW_CLEARANCE'
  | 'PREEMPT_ALL_RED_CLEARANCE'
  | 'EMERGENCY_GREEN'
  | 'RELEASE_YELLOW'
  | 'RELEASE_ALL_RED'
  | 'FAIL_SAFE_ALL_RED';

export type PriorityRequestStatus =
  | 'ACTIVE'
  | 'QUEUED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'EXPIRED';

export type PriorityPolicyMode =
  | 'EMERGENCY_CLASS_FIRST'
  | 'ETA_FIRST'
  | 'FIFO_FIRST';

export type GameScreenState =
  | 'INTRO'
  | 'VEHICLE_SELECT'
  | 'PLAYING';

export type PlayMode =
  | 'FREE_ROAM'
  | 'EMERGENCY_MISSION'
  | 'MISSION_SUCCESS'
  | 'MISSION_FAILED';

export type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD';

export type DrivingCameraMode =
  | 'THIRD_PERSON_CHASE'
  | 'ELEVATED_FOLLOW'
  | 'TOP_DOWN';

export type GraphicsQuality = 'HIGH' | 'BALANCED';

export interface GameSettings {
  masterVolume: number;
  sirenVolume: number;
  isMuted: boolean;
  graphicsQuality: GraphicsQuality;
  cameraSensitivity: number;
  drivingSensitivity: number;
  difficulty: DifficultyLevel;
  backgroundEmergencyTraffic: boolean;
  minimapVisible: boolean;
  minimapRotateWithPlayer: boolean;
  simplifiedCollisions: boolean;
  priorityPolicy: PriorityPolicyMode;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'INTERSECTION' | 'DESTINATION';
  x: number;
  z: number;
  gridRow?: number;
  gridCol?: number;
  isThreeWay?: boolean;
  emergencyCategory?: EmergencyType;
  buildingTitle?: string;
  districtName?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  roadName: string;
  axis: ApproachAxis;
  cardinal: CardinalDirection;
  distanceMeters: number;
  speedLimitMps: number;
  roadWidth: number;
  isMainAvenue: boolean;
}

export interface BuildingCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
  kind:
    | 'RESIDENTIAL'
    | 'COMMERCIAL'
    | 'SKYSCRAPER'
    | 'HOSPITAL'
    | 'FIRE_STATION'
    | 'POLICE_STATION'
    | 'PARK';
  title?: string;
  destinationNodeId?: string;
}

export interface RouteResult {
  nodeIds: string[];
  edgeIds: string[];
  waypoints: Array<{ x: number; z: number; nodeId: string }>;
  totalDistanceMeters: number;
  estimatedTimeSeconds: number;
  upcomingIntersections: string[];
}

export interface NavigationGuidance {
  instructionText: string;
  subInstructionText: string;
  turnType: 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'UTURN' | 'ARRIVED';
  distanceToTurnMeters: number;
  nextIntersectionId: string | null;
  nextIntersectionLamp: SignalLampColor | null;
  remainingDistanceMeters: number;
  etaSeconds: number;
  isRerouting: boolean;
}

export interface PlayerVehicleState {
  type: EmergencyType;
  name: string;
  callSign: string;
  x: number;
  z: number;
  yaw: number; // radians, 0 = +Z (South), Math.PI = -Z (North), Math.PI/2 = +X (East), -Math.PI/2 = -X (West)
  speed: number; // world units/sec (1 unit = 1 meter)
  maxSpeed: number;
  acceleration: number;
  steeringAngle: number; // front wheel angle
  pitch: number;
  roll: number;
  wheelRotation: number;
  sirenActive: boolean;
  headlightsOn: boolean;
  condition: number; // 0..100 vehicle integrity
  gear: 'D' | 'N' | 'R';
  currentAxis: ApproachAxis;
  currentCardinal: CardinalDirection;
}

export interface BackgroundEmergencyVehicle {
  id: string;
  callSign: string;
  type: EmergencyType;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  axis: ApproachAxis;
  direction: 1 | -1;
  roadCoord: number;
  sirenActive: boolean;
  targetIntersectionId: string | null;
  etaSeconds: number;
}

export interface CivilianVehicleState {
  id: string;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  axis: ApproachAxis;
  direction: 1 | -1;
  roadCoord: number;
  laneOffset: number;
  colorHex: number;
  modelType: 'SEDAN' | 'SUV' | 'TRANSIT';
}

export interface PriorityRequest {
  requestId: string;
  vehicleId: string;
  callSign: string;
  isPlayer: boolean;
  emergencyType: EmergencyType;
  intersectionId: string;
  requestedAxis: ApproachAxis;
  requestedCardinal: CardinalDirection;
  etaSeconds: number;
  distanceMeters: number;
  requestTimestamp: number;
  authenticated: boolean;
  status: PriorityRequestStatus;
  priorityScore: number;
  explanation: string;
}

export interface IntersectionSignalState {
  intersectionId: string;
  name: string;
  x: number;
  z: number;
  phase: ControllerPhase;
  nsLamp: SignalLampColor;
  ewLamp: SignalLampColor;
  phaseTimerSeconds: number;
  phaseDurationSeconds: number;
  activeRequestIds: string[];
  queuedRequestIds: string[];
  targetEmergencyAxis: ApproachAxis | null;
  watchdogTimerSeconds: number;
  maxPriorityTimeoutSeconds: number;
  commStatus: 'ONLINE' | 'TIMEOUT_FAILSAFE';
  lastTransitionReason: string;
}

export interface ActiveMissionState {
  missionId: string;
  incidentTitle: string;
  emergencyType: EmergencyType;
  destinationNodeId: string;
  destinationName: string;
  destinationDistrict: string;
  destinationPos: { x: number; z: number };
  initialRouteDistanceMeters: number;
  remainingDistanceMeters: number;
  deadlineTotalSeconds: number;
  remainingTimeSeconds: number;
  elapsedTimeSeconds: number;
  intersectionsCrossed: number;
  signalsGrantedPriority: number;
  redSignalStopsCount: number;
  rerouteCount: number;
  score: number;
  failureReason?: string;
}

export interface SignalNotificationBanner {
  id: string;
  title: string;
  subtitle: string;
  tone: 'EMERALD' | 'AMBER' | 'RED' | 'BLUE';
  timestamp: number;
}
