import {
  ApproachAxis,
  DifficultyLevel,
  EmergencyType,
  IntersectionSignalState,
  PriorityPolicyMode,
  PriorityRequest,
} from '../types/greenroute';
import { getProceduralCityWorld } from './roadGraph';

export const DEFAULT_CLASS_WEIGHTS: Record<EmergencyType, number> = {
  AMBULANCE: 300,
  FIRE_BRIGADE: 260,
  POLICE: 220,
};

export function getSignalTimingsForDifficulty(difficulty: DifficultyLevel) {
  if (difficulty === 'EASY') {
    return {
      NORMAL_GREEN_SEC: 9.0,
      YELLOW_CLEARANCE_SEC: 1.8,
      ALL_RED_CLEARANCE_SEC: 1.1,
      ANTICIPATION_DISTANCE_METERS: 210,
      MAX_PRIORITY_WATCHDOG_SEC: 35.0,
    };
  }
  if (difficulty === 'HARD') {
    return {
      NORMAL_GREEN_SEC: 11.0,
      YELLOW_CLEARANCE_SEC: 2.4,
      ALL_RED_CLEARANCE_SEC: 1.6,
      ANTICIPATION_DISTANCE_METERS: 145,
      MAX_PRIORITY_WATCHDOG_SEC: 25.0,
    };
  }
  return {
    NORMAL_GREEN_SEC: 10.0,
    YELLOW_CLEARANCE_SEC: 2.1,
    ALL_RED_CLEARANCE_SEC: 1.4,
    ANTICIPATION_DISTANCE_METERS: 175,
    MAX_PRIORITY_WATCHDOG_SEC: 30.0,
  };
}

export function areMovementsCompatible(
  axisA: ApproachAxis,
  axisB: ApproachAxis,
): boolean {
  return axisA === axisB;
}

export function computePriorityScore(
  req: Pick<PriorityRequest, 'emergencyType' | 'etaSeconds' | 'requestTimestamp'>,
  policy: PriorityPolicyMode,
): number {
  const classScore = DEFAULT_CLASS_WEIGHTS[req.emergencyType] ?? 200;
  const clampedEta = Math.max(0.5, Math.min(40, req.etaSeconds));
  const etaBonus = Math.round((40 - clampedEta) * 4.5);
  const fifoBonus = Math.max(0, 100 - req.requestTimestamp * 0.4);

  if (policy === 'EMERGENCY_CLASS_FIRST') {
    return Math.round(classScore * 1.4 + etaBonus + fifoBonus * 0.2);
  }
  if (policy === 'ETA_FIRST') {
    return Math.round(etaBonus * 3.5 + classScore * 0.35 + fifoBonus * 0.2);
  }
  return Math.round(10000 - req.requestTimestamp * 10 + etaBonus * 0.2);
}

/**
 * Arbitrates all active emergency requests targeting a specific intersection.
 */
export function arbitrateIntersectionRequests(
  requests: PriorityRequest[],
  policy: PriorityPolicyMode,
): {
  winnerIds: string[];
  queuedIds: string[];
  targetAxis: ApproachAxis | null;
  explanation: string;
} {
  if (requests.length === 0) {
    return {
      winnerIds: [],
      queuedIds: [],
      targetAxis: null,
      explanation: 'Normal cyclic signal operation',
    };
  }

  for (const r of requests) {
    r.priorityScore = computePriorityScore(r, policy);
  }

  const sorted = [...requests].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.etaSeconds - b.etaSeconds;
  });

  const primary = sorted[0];
  primary.status = 'ACTIVE';
  const winnerIds = [primary.requestId];
  const queuedIds: string[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const candidate = sorted[i];
    if (areMovementsCompatible(primary.requestedAxis, candidate.requestedAxis)) {
      candidate.status = 'ACTIVE';
      winnerIds.push(candidate.requestId);
      candidate.explanation = `Compatible ${candidate.requestedAxis} corridor shared with ${primary.callSign}.`;
    } else {
      candidate.status = 'QUEUED';
      queuedIds.push(candidate.requestId);
      candidate.explanation = `Conflicting ${candidate.requestedAxis} approach queued behind ${primary.callSign} (${primary.requestedAxis}, ETA ${primary.etaSeconds.toFixed(1)}s).`;
    }
  }

  if (queuedIds.length > 0) {
    const firstQueued = sorted.find((r) => queuedIds.includes(r.requestId))!;
    primary.explanation = `${primary.callSign} (${primary.requestedAxis}, ETA ${primary.etaSeconds.toFixed(1)}s) ranked above conflicting ${firstQueued.callSign} (${firstQueued.requestedAxis}, ETA ${firstQueued.etaSeconds.toFixed(1)}s) under ${policy.replace(/_/g, ' ')}.`;
  } else {
    primary.explanation = `GreenRoute priority active for ${primary.callSign} on ${primary.requestedAxis} approach (ETA ${primary.etaSeconds.toFixed(1)}s).`;
  }

  return {
    winnerIds,
    queuedIds,
    targetAxis: primary.requestedAxis,
    explanation: primary.explanation,
  };
}

/**
 * Initializes all 49 intersections in the procedural city with staggered normal signal phases
 * so the city feels alive with realistic green waves.
 */
export function createAllCityIntersections(): Record<
  string,
  IntersectionSignalState
> {
  const world = getProceduralCityWorld();
  const map: Record<string, IntersectionSignalState> = {};

  let idx = 0;
  for (const node of Object.values(world.nodes)) {
    if (node.type !== 'INTERSECTION') continue;
    const startNs = idx % 2 === 0;
    const offsetTimer = 3 + ((idx * 3.7) % 7);
    map[node.id] = {
      intersectionId: node.id,
      name: node.label,
      x: node.x,
      z: node.z,
      phase: startNs ? 'NORMAL_NS_GREEN' : 'NORMAL_EW_GREEN',
      nsLamp: startNs ? 'GREEN' : 'RED',
      ewLamp: startNs ? 'RED' : 'GREEN',
      phaseTimerSeconds: offsetTimer,
      phaseDurationSeconds: 10.0,
      activeRequestIds: [],
      queuedRequestIds: [],
      targetEmergencyAxis: null,
      watchdogTimerSeconds: 0,
      maxPriorityTimeoutSeconds: 30.0,
      commStatus: 'ONLINE',
      lastTransitionReason: 'Normal traffic cycle',
    };
    idx++;
  }

  return map;
}

/**
 * Advances a single intersection signal state machine by `dt` seconds.
 * Strictly enforces:
 *   NORMAL -> PREEMPT_YELLOW_CLEARANCE -> PREEMPT_ALL_RED_CLEARANCE -> EMERGENCY_GREEN
 *   -> RELEASE_YELLOW -> RELEASE_ALL_RED -> NORMAL
 * Never switches directly from one conflicting green to another.
 */
export function stepIntersectionController(
  ctrl: IntersectionSignalState,
  dt: number,
  desiredEmergencyAxis: ApproachAxis | null,
  activeReqIds: string[],
  queuedReqIds: string[],
  difficulty: DifficultyLevel,
): {
  updated: IntersectionSignalState;
  justGrantedEmergencyGreen: boolean;
  justStartedPreemption: boolean;
} {
  const timings = getSignalTimingsForDifficulty(difficulty);
  const next: IntersectionSignalState = {
    ...ctrl,
    activeRequestIds: activeReqIds,
    queuedRequestIds: queuedReqIds,
  };

  let justGrantedEmergencyGreen = false;
  let justStartedPreemption = false;

  // Watchdog protection
  if (desiredEmergencyAxis !== null) {
    next.watchdogTimerSeconds += dt;
    if (next.watchdogTimerSeconds > timings.MAX_PRIORITY_WATCHDOG_SEC) {
      desiredEmergencyAxis = null;
      next.watchdogTimerSeconds = 0;
    }
  } else {
    next.watchdogTimerSeconds = 0;
  }

  // 1. Emergency Preemption Active
  if (desiredEmergencyAxis !== null) {
    next.targetEmergencyAxis = desiredEmergencyAxis;

    if (next.phase === 'EMERGENCY_GREEN') {
      const currentGreenAxis: ApproachAxis =
        next.nsLamp === 'GREEN' ? 'NS' : 'EW';
      if (currentGreenAxis === desiredEmergencyAxis) {
        next.phaseTimerSeconds = 12.0;
        return {
          updated: next,
          justGrantedEmergencyGreen: false,
          justStartedPreemption: false,
        };
      }
      // Conflicting queued emergency promoted after previous cleared -> must transition via Yellow -> All-Red
      next.phase = 'PREEMPT_YELLOW_CLEARANCE';
      next.nsLamp = currentGreenAxis === 'NS' ? 'YELLOW' : 'RED';
      next.ewLamp = currentGreenAxis === 'EW' ? 'YELLOW' : 'RED';
      next.phaseDurationSeconds = timings.YELLOW_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.YELLOW_CLEARANCE_SEC;
      justStartedPreemption = true;
      return {
        updated: next,
        justGrantedEmergencyGreen: false,
        justStartedPreemption,
      };
    }

    // If already green in the requested direction during normal operation, lock immediately into EMERGENCY_GREEN
    if (
      (next.phase === 'NORMAL_NS_GREEN' && desiredEmergencyAxis === 'NS') ||
      (next.phase === 'NORMAL_EW_GREEN' && desiredEmergencyAxis === 'EW')
    ) {
      next.phase = 'EMERGENCY_GREEN';
      next.nsLamp = desiredEmergencyAxis === 'NS' ? 'GREEN' : 'RED';
      next.ewLamp = desiredEmergencyAxis === 'EW' ? 'GREEN' : 'RED';
      next.phaseDurationSeconds = 14.0;
      next.phaseTimerSeconds = 14.0;
      next.lastTransitionReason = `Maintained ${desiredEmergencyAxis} green for approaching emergency responder`;
      return {
        updated: next,
        justGrantedEmergencyGreen: true,
        justStartedPreemption: false,
      };
    }

    // If currently green in the CONFLICTING direction, immediately start PREEMPT_YELLOW_CLEARANCE
    if (
      (next.phase === 'NORMAL_NS_GREEN' && desiredEmergencyAxis === 'EW') ||
      (next.phase === 'NORMAL_EW_GREEN' && desiredEmergencyAxis === 'NS')
    ) {
      const conflictingAxis: ApproachAxis =
        desiredEmergencyAxis === 'NS' ? 'EW' : 'NS';
      next.phase = 'PREEMPT_YELLOW_CLEARANCE';
      next.nsLamp = conflictingAxis === 'NS' ? 'YELLOW' : 'RED';
      next.ewLamp = conflictingAxis === 'EW' ? 'YELLOW' : 'RED';
      next.phaseDurationSeconds = timings.YELLOW_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.YELLOW_CLEARANCE_SEC;
      next.lastTransitionReason = `Preempting conflicting ${conflictingAxis} green -> Yellow clearance`;
      return {
        updated: next,
        justGrantedEmergencyGreen: false,
        justStartedPreemption: true,
      };
    }

    if (
      next.phase === 'NORMAL_NS_YELLOW' ||
      next.phase === 'NORMAL_EW_YELLOW' ||
      next.phase === 'RELEASE_YELLOW'
    ) {
      next.phase = 'PREEMPT_YELLOW_CLEARANCE';
    } else if (
      next.phase === 'NORMAL_ALL_RED_TO_EW' ||
      next.phase === 'NORMAL_ALL_RED_TO_NS' ||
      next.phase === 'RELEASE_ALL_RED'
    ) {
      next.phase = 'PREEMPT_ALL_RED_CLEARANCE';
    }

    next.phaseTimerSeconds -= dt;
    if (
      next.phase === 'PREEMPT_YELLOW_CLEARANCE' &&
      next.phaseTimerSeconds <= 0
    ) {
      next.phase = 'PREEMPT_ALL_RED_CLEARANCE';
      next.nsLamp = 'RED';
      next.ewLamp = 'RED';
      next.phaseDurationSeconds = timings.ALL_RED_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.ALL_RED_CLEARANCE_SEC;
      next.lastTransitionReason = 'All-Red safety clearance before Emergency Green';
    } else if (
      next.phase === 'PREEMPT_ALL_RED_CLEARANCE' &&
      next.phaseTimerSeconds <= 0
    ) {
      next.phase = 'EMERGENCY_GREEN';
      next.nsLamp = desiredEmergencyAxis === 'NS' ? 'GREEN' : 'RED';
      next.ewLamp = desiredEmergencyAxis === 'EW' ? 'GREEN' : 'RED';
      next.phaseDurationSeconds = 14.0;
      next.phaseTimerSeconds = 14.0;
      next.lastTransitionReason = `Emergency Green granted for ${desiredEmergencyAxis}`;
      justGrantedEmergencyGreen = true;
    }

    return {
      updated: next,
      justGrantedEmergencyGreen,
      justStartedPreemption,
    };
  }

  // 2. Release Priority when no emergency requests remain
  if (next.phase === 'EMERGENCY_GREEN') {
    const activeGreenAxis: ApproachAxis =
      next.nsLamp === 'GREEN' ? 'NS' : 'EW';
    next.targetEmergencyAxis = null;
    next.phase = 'RELEASE_YELLOW';
    next.nsLamp = activeGreenAxis === 'NS' ? 'YELLOW' : 'RED';
    next.ewLamp = activeGreenAxis === 'EW' ? 'YELLOW' : 'RED';
    next.phaseDurationSeconds = timings.YELLOW_CLEARANCE_SEC;
    next.phaseTimerSeconds = timings.YELLOW_CLEARANCE_SEC;
    next.lastTransitionReason = 'Emergency cleared: releasing via Yellow';
    return {
      updated: next,
      justGrantedEmergencyGreen: false,
      justStartedPreemption: false,
    };
  }

  if (next.phase === 'PREEMPT_YELLOW_CLEARANCE') {
    next.phase = 'RELEASE_YELLOW';
  } else if (next.phase === 'PREEMPT_ALL_RED_CLEARANCE') {
    next.phase = 'RELEASE_ALL_RED';
  }

  // 3. Normal Traffic Signal Cycle
  next.phaseTimerSeconds -= dt;
  if (next.phaseTimerSeconds > 0) {
    return {
      updated: next,
      justGrantedEmergencyGreen: false,
      justStartedPreemption: false,
    };
  }

  switch (next.phase) {
    case 'RELEASE_YELLOW': {
      next.phase = 'RELEASE_ALL_RED';
      next.nsLamp = 'RED';
      next.ewLamp = 'RED';
      next.phaseDurationSeconds = timings.ALL_RED_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.ALL_RED_CLEARANCE_SEC;
      break;
    }
    case 'RELEASE_ALL_RED': {
      next.phase = 'NORMAL_NS_GREEN';
      next.nsLamp = 'GREEN';
      next.ewLamp = 'RED';
      next.phaseDurationSeconds = timings.NORMAL_GREEN_SEC;
      next.phaseTimerSeconds = timings.NORMAL_GREEN_SEC;
      break;
    }
    case 'NORMAL_NS_GREEN': {
      next.phase = 'NORMAL_NS_YELLOW';
      next.nsLamp = 'YELLOW';
      next.ewLamp = 'RED';
      next.phaseDurationSeconds = timings.YELLOW_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.YELLOW_CLEARANCE_SEC;
      break;
    }
    case 'NORMAL_NS_YELLOW': {
      next.phase = 'NORMAL_ALL_RED_TO_EW';
      next.nsLamp = 'RED';
      next.ewLamp = 'RED';
      next.phaseDurationSeconds = timings.ALL_RED_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.ALL_RED_CLEARANCE_SEC;
      break;
    }
    case 'NORMAL_ALL_RED_TO_EW': {
      next.phase = 'NORMAL_EW_GREEN';
      next.nsLamp = 'RED';
      next.ewLamp = 'GREEN';
      next.phaseDurationSeconds = timings.NORMAL_GREEN_SEC;
      next.phaseTimerSeconds = timings.NORMAL_GREEN_SEC;
      break;
    }
    case 'NORMAL_EW_GREEN': {
      next.phase = 'NORMAL_EW_YELLOW';
      next.nsLamp = 'RED';
      next.ewLamp = 'YELLOW';
      next.phaseDurationSeconds = timings.YELLOW_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.YELLOW_CLEARANCE_SEC;
      break;
    }
    case 'NORMAL_EW_YELLOW': {
      next.phase = 'NORMAL_ALL_RED_TO_NS';
      next.nsLamp = 'RED';
      next.ewLamp = 'RED';
      next.phaseDurationSeconds = timings.ALL_RED_CLEARANCE_SEC;
      next.phaseTimerSeconds = timings.ALL_RED_CLEARANCE_SEC;
      break;
    }
    case 'NORMAL_ALL_RED_TO_NS':
    default: {
      next.phase = 'NORMAL_NS_GREEN';
      next.nsLamp = 'GREEN';
      next.ewLamp = 'RED';
      next.phaseDurationSeconds = timings.NORMAL_GREEN_SEC;
      next.phaseTimerSeconds = timings.NORMAL_GREEN_SEC;
      break;
    }
  }

  return {
    updated: next,
    justGrantedEmergencyGreen,
    justStartedPreemption,
  };
}
