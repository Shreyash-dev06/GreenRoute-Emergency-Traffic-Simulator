import {
  BuildingCollider,
  CivilianVehicleState,
  EmergencyType,
  PlayerVehicleState,
} from '../types/greenroute';

export interface DrivingInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export function createInitialPlayerVehicle(
  type: EmergencyType,
  spawnX: number,
  spawnZ: number,
  spawnYaw: number,
): PlayerVehicleState {
  const specs: Record<
    EmergencyType,
    { name: string; callSign: string; maxSpeed: number; accel: number }
  > = {
    AMBULANCE: {
      name: 'Rescue Ambulance Unit',
      callSign: 'AMB-01',
      maxSpeed: 38,
      accel: 26,
    },
    FIRE_BRIGADE: {
      name: 'Heavy Fire Engine',
      callSign: 'FIRE-01',
      maxSpeed: 34,
      accel: 22,
    },
    POLICE: {
      name: 'Police Pursuit Cruiser',
      callSign: 'POL-01',
      maxSpeed: 42,
      accel: 31,
    },
  };

  const s = specs[type];
  return {
    type,
    name: s.name,
    callSign: s.callSign,
    x: spawnX,
    z: spawnZ,
    yaw: spawnYaw,
    speed: 0,
    maxSpeed: s.maxSpeed,
    acceleration: s.accel,
    steeringAngle: 0,
    pitch: 0,
    roll: 0,
    wheelRotation: 0,
    sirenActive: false,
    headlightsOn: true,
    condition: 100,
    gear: 'N',
    currentAxis:
      Math.abs(Math.cos(spawnYaw)) >= Math.abs(Math.sin(spawnYaw))
        ? 'NS'
        : 'EW',
    currentCardinal: 'NORTH',
  };
}

/**
 * Advances the player's emergency vehicle physics by `dt` seconds.
 * Returns whether a noticeable collision occurred so audio/visual feedback can trigger.
 */
export function stepPlayerVehiclePhysics(
  player: PlayerVehicleState,
  input: DrivingInputState,
  dt: number,
  drivingSensitivity: number,
  buildings: BuildingCollider[],
  civilians: CivilianVehicleState[],
  simplifiedCollisions: boolean,
): { collided: boolean } {
  let collided = false;
  const prevSpeed = player.speed;

  // 1. Longitudinal Acceleration / Braking / Reverse / Handbrake
  if (input.handbrake) {
    const brakeDecel = 46 * dt;
    if (Math.abs(player.speed) <= brakeDecel) {
      player.speed = 0;
    } else {
      player.speed -= Math.sign(player.speed) * brakeDecel;
    }
  } else if (input.forward && !input.backward) {
    if (player.speed < -0.5) {
      // Braking from reverse
      player.speed = Math.min(0, player.speed + 42 * dt);
    } else {
      // Accelerate forward with smooth top-speed curve
      const speedRatio = Math.max(0, player.speed) / player.maxSpeed;
      const effectiveAccel = player.acceleration * (1 - speedRatio * 0.45);
      player.speed = Math.min(
        player.maxSpeed,
        player.speed + effectiveAccel * dt,
      );
    }
  } else if (input.backward && !input.forward) {
    if (player.speed > 0.8) {
      // Foot brake while moving forward
      player.speed = Math.max(0, player.speed - 44 * dt);
    } else {
      // Reverse gear
      const maxReverse = -14;
      player.speed = Math.max(
        maxReverse,
        player.speed - player.acceleration * 0.72 * dt,
      );
    }
  } else {
    // Natural rolling friction & aerodynamic drag
    const drag = (6.8 + Math.abs(player.speed) * 0.18) * dt;
    if (Math.abs(player.speed) <= drag) {
      player.speed = 0;
    } else {
      player.speed -= Math.sign(player.speed) * drag;
    }
  }

  // Update gear indicator
  if (player.speed > 0.4) player.gear = 'D';
  else if (player.speed < -0.4) player.gear = 'R';
  else player.gear = 'N';

  // 2. Steering (less aggressive at very high speeds, responsive at low/medium speeds)
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const targetSteerAngle = steerInput * 0.55;
  player.steeringAngle +=
    (targetSteerAngle - player.steeringAngle) * Math.min(1, dt * 12);

  const absSpeed = Math.abs(player.speed);
  if (absSpeed > 0.35) {
    const speedNormalized = Math.min(1, absSpeed / player.maxSpeed);
    // Low-speed ramp up so car doesn't pivot on a dime when stationary, then high-speed stability taper
    const lowSpeedFactor = Math.min(1, absSpeed / 4.5);
    const highSpeedDamp = 1 - speedNormalized * 0.36;
    const turnRate =
      2.35 *
      drivingSensitivity *
      lowSpeedFactor *
      highSpeedDamp *
      (input.handbrake ? 1.25 : 1.0);
    const directionSign = player.speed >= 0 ? 1 : -1;
    player.yaw += steerInput * turnRate * directionSign * dt;
  }

  // Normalize yaw to [-PI, PI]
  while (player.yaw > Math.PI) player.yaw -= Math.PI * 2;
  while (player.yaw < -Math.PI) player.yaw += Math.PI * 2;

  // 3. Body Pitch, Roll & Wheel Spin Animation
  const longitudinalG = (player.speed - prevSpeed) / Math.max(0.001, dt);
  const targetPitch = Math.max(-0.04, Math.min(0.04, -longitudinalG * 0.0012));
  const targetRoll = Math.max(
    -0.06,
    Math.min(0.06, -steerInput * (absSpeed / player.maxSpeed) * 0.055),
  );
  player.pitch += (targetPitch - player.pitch) * Math.min(1, dt * 10);
  player.roll += (targetRoll - player.roll) * Math.min(1, dt * 10);
  player.wheelRotation += player.speed * dt * 1.8;

  // 4. Advance Position
  const hx = Math.sin(player.yaw);
  const hz = Math.cos(player.yaw);
  player.x += hx * player.speed * dt;
  player.z += hz * player.speed * dt;

  // Update axis and cardinal heading
  if (Math.abs(hz) >= Math.abs(hx)) {
    player.currentAxis = 'NS';
    player.currentCardinal = hz < 0 ? 'NORTH' : 'SOUTH';
  } else {
    player.currentAxis = 'EW';
    player.currentCardinal = hx > 0 ? 'EAST' : 'WEST';
  }

  // 5. World Perimeter Containment
  const BOUND = 358;
  if (player.x < -BOUND) {
    player.x = -BOUND;
    player.speed *= 0.4;
  } else if (player.x > BOUND) {
    player.x = BOUND;
    player.speed *= 0.4;
  }
  if (player.z < -BOUND) {
    player.z = -BOUND;
    player.speed *= 0.4;
  } else if (player.z > BOUND) {
    player.z = BOUND;
    player.speed *= 0.4;
  }

  // 6. Building & Park Curb Collision Resolution (Circle vs AABB)
  const vehicleRadius = 2.15;
  for (const b of buildings) {
    // Quick broadphase check
    if (
      player.x + vehicleRadius < b.minX ||
      player.x - vehicleRadius > b.maxX ||
      player.z + vehicleRadius < b.minZ ||
      player.z - vehicleRadius > b.maxZ
    ) {
      continue;
    }

    const closestX = Math.max(b.minX, Math.min(player.x, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(player.z, b.maxZ));
    const dx = player.x - closestX;
    const dz = player.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < vehicleRadius * vehicleRadius) {
      const dist = Math.sqrt(distSq);
      let nx = 0;
      let nz = 0;
      if (dist > 0.0001) {
        nx = dx / dist;
        nz = dz / dist;
      } else {
        // Inside box fallback: push out toward nearest face
        const dLeft = Math.abs(player.x - b.minX);
        const dRight = Math.abs(b.maxX - player.x);
        const dTop = Math.abs(player.z - b.minZ);
        const dBottom = Math.abs(b.maxZ - player.z);
        const minEdge = Math.min(dLeft, dRight, dTop, dBottom);
        if (minEdge === dLeft) nx = -1;
        else if (minEdge === dRight) nx = 1;
        else if (minEdge === dTop) nz = -1;
        else nz = 1;
      }

      const overlap = vehicleRadius - dist + 0.08;
      player.x += nx * overlap;
      player.z += nz * overlap;

      if (Math.abs(player.speed) > 6) {
        collided = true;
        player.condition = Math.max(25, player.condition - 1.5);
      }
      // Dampen speed smoothly without locking the car
      player.speed *= 0.55;
    }
  }

  // 7. Civilian Vehicle Collision Detection
  if (!simplifiedCollisions) {
    const minSep = 3.6;
    for (const cv of civilians) {
      const dx = player.x - cv.x;
      const dz = player.z - cv.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minSep * minSep && dSq > 0.001) {
        const d = Math.sqrt(dSq);
        const nx = dx / d;
        const nz = dz / d;
        const push = (minSep - d) * 0.65;
        player.x += nx * push;
        player.z += nz * push;
        // Also nudge civilian slightly out of the way
        cv.x -= nx * push * 0.35;
        cv.z -= nz * push * 0.35;

        if (Math.abs(player.speed) > 7) {
          collided = true;
          player.condition = Math.max(25, player.condition - 1.0);
        }
        player.speed *= 0.62;
      }
    }
  }

  return { collided };
}
