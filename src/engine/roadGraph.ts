import {
  ApproachAxis,
  BuildingCollider,
  CardinalDirection,
  EmergencyType,
  GraphEdge,
  GraphNode,
  IntersectionSignalState,
  NavigationGuidance,
  PlayerVehicleState,
  RouteResult,
  SignalLampColor,
} from '../types/greenroute';

/**
 * Open-World Procedural City Layout:
 * - 7 x 7 grid of major & minor road intersections spaced every 110 meters:
 *   Coordinates: [-330, -220, -110, 0, +110, +220, +330] along X and Z.
 * - Main avenues run along X = -110, 0, +110 and Z = -110, 0, +110 (width = 16m).
 * - Secondary streets run along the remaining grid lines (width = 13m).
 * - Selected perimeter junctions are 3-way T-intersections to create varied urban road geometry.
 * - 12 Service Destinations (4 Hospitals, 4 Fire Stations, 4 Police Stations) are placed
 *   on dedicated mid-block service bays connected directly to the road graph.
 */

export const GRID_COORDS = [-330, -220, -110, 0, 110, 220, 330];
export const BLOCK_SPAN = 110;

const AVENUE_NAMES_NS = [
  'Westshore Pkwy',
  'Harbor Ave',
  'Lincoln Blvd',
  'Central Emergency Pkwy',
  'Lexington Ave',
  'Tech Corridor Dr',
  'Eastside Hwy',
];

const STREET_NAMES_EW = [
  'Northgate Blvd',
  '1st Street North',
  '2nd Avenue North',
  'Midtown Civic Way',
  '3rd Avenue South',
  '4th Street South',
  'Southport Pkwy',
];

//Deterministic seeded PRNG (Mulberry32)
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ProceduralCityWorld {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  buildings: BuildingCollider[];
  destinationIdsByType: Record<EmergencyType, string[]>;
}

interface ServiceLandmarkSpec {
  id: string;
  category: EmergencyType;
  label: string;
  buildingTitle: string;
  districtName: string;
  // Connected between intersection (r1,c1) and (r2,c2)
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  // Which side of the road the building sits on (-1 or +1)
  lotSide: -1 | 1;
}

const SERVICE_LANDMARKS: ServiceLandmarkSpec[] = [
  // 4 HOSPITALS
  {
    id: 'HOSP-1',
    category: 'AMBULANCE',
    label: 'Metro General Hospital',
    buildingTitle: 'HOSPITAL · Metro General Trauma',
    districtName: 'Northwest Medical District',
    r1: 1,
    c1: 1,
    r2: 1,
    c2: 2,
    lotSide: -1,
  },
  {
    id: 'HOSP-2',
    category: 'AMBULANCE',
    label: 'St. Jude Medical Center',
    buildingTitle: 'HOSPITAL · St. Jude Emergency',
    districtName: 'Northeast Uptown District',
    r1: 1,
    c1: 4,
    r2: 1,
    c2: 5,
    lotSide: -1,
  },
  {
    id: 'HOSP-3',
    category: 'AMBULANCE',
    label: 'Westside Cardiac Hospital',
    buildingTitle: 'HOSPITAL · Westside Cardiac',
    districtName: 'Southwest Harbor District',
    r1: 4,
    c1: 1,
    r2: 4,
    c2: 2,
    lotSide: 1,
  },
  {
    id: 'HOSP-4',
    category: 'AMBULANCE',
    label: 'Southgate Mercy Hospital',
    buildingTitle: 'HOSPITAL · Southgate Mercy',
    districtName: 'Southeast Civic District',
    r1: 5,
    c1: 4,
    r2: 5,
    c2: 5,
    lotSide: 1,
  },

  // 4 FIRE STATIONS
  {
    id: 'FIRE-1',
    category: 'FIRE_BRIGADE',
    label: 'Central Fire Station #1',
    buildingTitle: 'FIRE STATION #1 · Central Command',
    districtName: 'Midtown Core',
    r1: 3,
    c1: 2,
    r2: 3,
    c2: 3,
    lotSide: -1,
  },
  {
    id: 'FIRE-2',
    category: 'FIRE_BRIGADE',
    label: 'Harborview Fire Station #2',
    buildingTitle: 'FIRE STATION #2 · Harbor Rescue',
    districtName: 'West Industrial Sector',
    r1: 2,
    c1: 0,
    r2: 2,
    c2: 1,
    lotSide: 1,
  },
  {
    id: 'FIRE-3',
    category: 'FIRE_BRIGADE',
    label: 'Northgate Fire Brigade #3',
    buildingTitle: 'FIRE STATION #3 · North Brigade',
    districtName: 'North Tech Corridor',
    r1: 0,
    c1: 3,
    r2: 0,
    c2: 4,
    lotSide: 1,
  },
  {
    id: 'FIRE-4',
    category: 'FIRE_BRIGADE',
    label: 'Eastside Fire & Rescue #4',
    buildingTitle: 'FIRE STATION #4 · Eastside HQ',
    districtName: 'East Financial District',
    r1: 4,
    c1: 5,
    r2: 4,
    c2: 6,
    lotSide: -1,
  },

  // 4 POLICE STATIONS
  {
    id: 'POL-1',
    category: 'POLICE',
    label: 'Central Police Precinct #1',
    buildingTitle: 'POLICE STATION #1 · Downtown HQ',
    districtName: 'Downtown Civic Plaza',
    r1: 3,
    c1: 3,
    r2: 3,
    c2: 4,
    lotSide: 1,
  },
  {
    id: 'POL-2',
    category: 'POLICE',
    label: 'North Metro Police HQ #2',
    buildingTitle: 'POLICE STATION #2 · North Metro',
    districtName: 'North Commons',
    r1: 1,
    c1: 2,
    r2: 1,
    c2: 3,
    lotSide: 1,
  },
  {
    id: 'POL-3',
    category: 'POLICE',
    label: 'Westbay Tactical Precinct #3',
    buildingTitle: 'POLICE STATION #3 · Westbay Tactical',
    districtName: 'Westbay District',
    r1: 5,
    c1: 1,
    r2: 5,
    c2: 2,
    lotSide: -1,
  },
  {
    id: 'POL-4',
    category: 'POLICE',
    label: 'Southport Police Command #4',
    buildingTitle: 'POLICE STATION #4 · Southport',
    districtName: 'Southport Parkway',
    r1: 5,
    c1: 3,
    r2: 5,
    c2: 4,
    lotSide: -1,
  },
];

let cachedCityWorld: ProceduralCityWorld | null = null;

export function getProceduralCityWorld(): ProceduralCityWorld {
  if (cachedCityWorld) return cachedCityWorld;

  const nodes: Record<string, GraphNode> = {};
  const edges: GraphEdge[] = [];
  const buildings: BuildingCollider[] = [];
  const destinationIdsByType: Record<EmergencyType, string[]> = {
    AMBULANCE: [],
    FIRE_BRIGADE: [],
    POLICE: [],
  };

  // 1. Create 7x7 = 49 Intersection Nodes
  for (let r = 0; r < GRID_COORDS.length; r++) {
    for (let c = 0; c < GRID_COORDS.length; c++) {
      const id = `I-${r}${c}`;
      const x = GRID_COORDS[c];
      const z = GRID_COORDS[r];
      const isEdgeJunction =
        r === 0 ||
        r === GRID_COORDS.length - 1 ||
        c === 0 ||
        c === GRID_COORDS.length - 1;
      nodes[id] = {
        id,
        label: `${AVENUE_NAMES_NS[c]} & ${STREET_NAMES_EW[r]}`,
        type: 'INTERSECTION',
        x,
        z,
        gridRow: r,
        gridCol: c,
        isThreeWay: isEdgeJunction,
      };
    }
  }

  // Helper to add bidirectional road edge
  const addBidirectionalEdge = (
    idBase: string,
    nodeAId: string,
    nodeBId: string,
    roadName: string,
    axis: ApproachAxis,
    isMainAvenue: boolean,
  ) => {
    const a = nodes[nodeAId];
    const b = nodes[nodeBId];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.round(Math.hypot(dx, dz));
    const speedLimit = isMainAvenue ? 32 : 26;
    const roadWidth = isMainAvenue ? 16 : 13;

    const getCardinal = (vx: number, vz: number): CardinalDirection => {
      if (Math.abs(vz) >= Math.abs(vx)) {
        return vz < 0 ? 'NORTH' : 'SOUTH';
      }
      return vx > 0 ? 'EAST' : 'WEST';
    };

    edges.push(
      {
        id: `${idBase}_FWD`,
        from: nodeAId,
        to: nodeBId,
        roadName,
        axis,
        cardinal: getCardinal(dx, dz),
        distanceMeters: dist,
        speedLimitMps: speedLimit,
        roadWidth,
        isMainAvenue,
      },
      {
        id: `${idBase}_REV`,
        from: nodeBId,
        to: nodeAId,
        roadName,
        axis,
        cardinal: getCardinal(-dx, -dz),
        distanceMeters: dist,
        speedLimitMps: speedLimit,
        roadWidth,
        isMainAvenue,
      },
    );
  };

  // Map which horizontal segments contain a mid-block service destination node
  const landmarkBySegmentKey = new Map<string, ServiceLandmarkSpec>();
  for (const spec of SERVICE_LANDMARKS) {
    const key = `${spec.r1}_${spec.c1}_${spec.r2}_${spec.c2}`;
    landmarkBySegmentKey.set(key, spec);
  }

  // 2. Connect East-West Road Segments ( splitting segment if a Service Destination sits on it )
  for (let r = 0; r < GRID_COORDS.length; r++) {
    const isMain = r === 2 || r === 3 || r === 4;
    const roadName = STREET_NAMES_EW[r];
    for (let c = 0; c < GRID_COORDS.length - 1; c++) {
      const nA = `I-${r}${c}`;
      const nB = `I-${r}${c + 1}`;
      const segKey = `${r}_${c}_${r}_${c + 1}`;
      const spec = landmarkBySegmentKey.get(segKey);

      if (spec) {
        const midX = (nodes[nA].x + nodes[nB].x) / 2;
        const midZ = nodes[nA].z;
        nodes[spec.id] = {
          id: spec.id,
          label: spec.label,
          type: 'DESTINATION',
          x: midX,
          z: midZ,
          emergencyCategory: spec.category,
          buildingTitle: spec.buildingTitle,
          districtName: spec.districtName,
        };
        destinationIdsByType[spec.category].push(spec.id);

        addBidirectionalEdge(
          `E_${nA}_${spec.id}`,
          nA,
          spec.id,
          roadName,
          'EW',
          isMain,
        );
        addBidirectionalEdge(
          `E_${spec.id}_${nB}`,
          spec.id,
          nB,
          roadName,
          'EW',
          isMain,
        );
      } else {
        addBidirectionalEdge(`E_${nA}_${nB}`, nA, nB, roadName, 'EW', isMain);
      }
    }
  }

  // 3. Connect North-South Road Segments
  for (let c = 0; c < GRID_COORDS.length; c++) {
    const isMain = c === 2 || c === 3 || c === 4;
    const roadName = AVENUE_NAMES_NS[c];
    for (let r = 0; r < GRID_COORDS.length - 1; r++) {
      const nA = `I-${r}${c}`;
      const nB = `I-${r + 1}${c}`;
      addBidirectionalEdge(`E_${nA}_${nB}`, nA, nB, roadName, 'NS', isMain);
    }
  }

  // 4. Populate City Blocks with Service Landmark Buildings + Urban Buildings + Parks
  // Each city block sits between X in [GRID_COORDS[c] + 14, GRID_COORDS[c+1] - 14]
  // and Z in [GRID_COORDS[r] + 14, GRID_COORDS[r+1] - 14] -> 82m x 82m safe buildable block!
  const rng = createSeededRandom(20261027);

  // First place the 12 Service Destination Landmark Buildings adjacent to their road node
  const occupiedQuadrants = new Set<string>();
  for (const spec of SERVICE_LANDMARKS) {
    const destNode = nodes[spec.id];
    // If lotSide === -1, place building North of road (in block r1-1); if +1, place South of road (in block r1)
    const blockR = spec.lotSide === -1 ? spec.r1 - 1 : spec.r1;
    const blockC = spec.c1;
    const bz = destNode.z + spec.lotSide * 28;
    const bx = destNode.x;
    const width = 34;
    const depth = 24;
    const height =
      spec.category === 'AMBULANCE'
        ? 24
        : spec.category === 'FIRE_BRIGADE'
          ? 16
          : 20;

    buildings.push({
      id: `BLDG_${spec.id}`,
      minX: bx - width / 2,
      maxX: bx + width / 2,
      minZ: bz - depth / 2,
      maxZ: bz + depth / 2,
      centerX: bx,
      centerZ: bz,
      width,
      depth,
      height,
      kind:
        spec.category === 'AMBULANCE'
          ? 'HOSPITAL'
          : spec.category === 'FIRE_BRIGADE'
            ? 'FIRE_STATION'
            : 'POLICE_STATION',
      title: spec.buildingTitle,
      destinationNodeId: spec.id,
    });

    occupiedQuadrants.add(`${blockR}_${blockC}_${spec.lotSide === -1 ? 'S' : 'N'}`);
  }

  // Fill remaining 6 x 6 = 36 City Blocks with Skyscrapers, Commercial, Residential, and Parks
  for (let r = 0; r < GRID_COORDS.length - 1; r++) {
    for (let c = 0; c < GRID_COORDS.length - 1; c++) {
      const blockCenterX = (GRID_COORDS[c] + GRID_COORDS[c + 1]) / 2;
      const blockCenterZ = (GRID_COORDS[r] + GRID_COORDS[r + 1]) / 2;

      const hasNorthReserve = occupiedQuadrants.has(`${r}_${c}_N`);
      const hasSouthReserve = occupiedQuadrants.has(`${r}_${c}_S`);

      // Make a few scenic green city parks
      if (
        !hasNorthReserve &&
        !hasSouthReserve &&
        ((r === 2 && c === 2) || (r === 4 && c === 3) || (r === 1 && c === 5))
      ) {
        buildings.push({
          id: `PARK_${r}_${c}`,
          minX: blockCenterX - 32,
          maxX: blockCenterX + 32,
          minZ: blockCenterZ - 32,
          maxZ: blockCenterZ + 32,
          centerX: blockCenterX,
          centerZ: blockCenterZ,
          width: 64,
          depth: 64,
          height: 0.4,
          kind: 'PARK',
          title: 'City Green Park',
        });
        continue;
      }

      // Otherwise place up to 4 sub-buildings in the 4 corners of the block
      const subOffsets: Array<{ dx: number; dz: number; half: 'N' | 'S' }> = [
        { dx: -20, dz: -20, half: 'N' },
        { dx: 20, dz: -20, half: 'N' },
        { dx: -20, dz: 20, half: 'S' },
        { dx: 20, dz: 20, half: 'S' },
      ];

      for (let i = 0; i < subOffsets.length; i++) {
        const sub = subOffsets[i];
        if (sub.half === 'N' && hasNorthReserve) continue;
        if (sub.half === 'S' && hasSouthReserve) continue;

        const bx = blockCenterX + sub.dx;
        const bz = blockCenterZ + sub.dz;
        const bw = 22 + Math.floor(rng() * 8);
        const bd = 22 + Math.floor(rng() * 8);

        const distFromDowntown = Math.hypot(r - 2.5, c - 2.5);
        let kind: BuildingCollider['kind'] = 'RESIDENTIAL';
        let bh = 14 + Math.floor(rng() * 14);

        if (distFromDowntown < 1.8) {
          kind = rng() > 0.35 ? 'SKYSCRAPER' : 'COMMERCIAL';
          bh = kind === 'SKYSCRAPER' ? 34 + Math.floor(rng() * 28) : 22 + Math.floor(rng() * 14);
        } else if (distFromDowntown < 3.0) {
          kind = rng() > 0.45 ? 'COMMERCIAL' : 'RESIDENTIAL';
          bh = 16 + Math.floor(rng() * 18);
        }

        buildings.push({
          id: `BLDG_${r}_${c}_${i}`,
          minX: bx - bw / 2,
          maxX: bx + bw / 2,
          minZ: bz - bd / 2,
          maxZ: bz + bd / 2,
          centerX: bx,
          centerZ: bz,
          width: bw,
          depth: bd,
          height: bh,
          kind,
        });
      }
    }
  }

  cachedCityWorld = {
    nodes,
    edges,
    buildings,
    destinationIdsByType,
  };
  return cachedCityWorld;
}

/**
 * Picks a valid random road spawn position aligned on a drivable road segment,
 * never inside a building, intersection, or service destination.
 */
export function getRandomValidRoadSpawn(seed = Date.now()): {
  x: number;
  z: number;
  yaw: number;
  roadName: string;
} {
  const world = getProceduralCityWorld();
  const rng = createSeededRandom(seed);

  // Filter edges that connect two intersections (not immediately on a destination bay)
  const validEdges = world.edges.filter(
    (e) =>
      world.nodes[e.from]?.type === 'INTERSECTION' &&
      world.nodes[e.to]?.type === 'INTERSECTION',
  );

  const chosen =
    validEdges[Math.floor(rng() * validEdges.length)] || validEdges[0];
  const nA = world.nodes[chosen.from];
  const nB = world.nodes[chosen.to];

  // Spawn at 45%–55% along the segment so it's safely mid-block away from intersections
  const t = 0.42 + rng() * 0.16;
  const x = nA.x + (nB.x - nA.x) * t;
  const z = nA.z + (nB.z - nA.z) * t;
  const yaw = Math.atan2(nB.x - nA.x, nB.z - nA.z);

  return {
    x,
    z,
    yaw,
    roadName: chosen.roadName,
  };
}

/**
 * Finds the closest graph node to an arbitrary (x, z) position.
 */
export function findClosestGraphNode(x: number, z: number): string {
  const world = getProceduralCityWorld();
  let bestId = 'I-33';
  let bestDistSq = Infinity;
  for (const node of Object.values(world.nodes)) {
    const dSq = (node.x - x) ** 2 + (node.z - z) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestId = node.id;
    }
  }
  return bestId;
}

/**
 * Finds the best starting graph node ahead of (or closest to) the player's current position
 * so route lines start cleanly from the road segment the player is currently on.
 */
export function findBestStartNodeForVehicle(
  x: number,
  z: number,
  yaw: number,
): string {
  const world = getProceduralCityWorld();
  const hx = Math.sin(yaw);
  const hz = Math.cos(yaw);

  let bestId = findClosestGraphNode(x, z);
  let bestScore = Infinity;

  for (const node of Object.values(world.nodes)) {
    const dx = node.x - x;
    const dz = node.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > 135) continue;
    const dot = (dx * hx + dz * hz) / Math.max(1, dist);
    // Prefer nodes in front of the vehicle along its current road
    const penalty = dot > 0.25 ? 0.75 : 1.35;
    const score = dist * penalty;
    if (score < bestScore) {
      bestScore = score;
      bestId = node.id;
    }
  }
  return bestId;
}

/**
 * Dijkstra's algorithm on the connected road graph.
 */
export function calculateOptimalRoute(
  startNodeId: string,
  targetNodeId: string,
): RouteResult | null {
  const world = getProceduralCityWorld();
  if (!world.nodes[startNodeId] || !world.nodes[targetNodeId]) {
    return null;
  }

  const distCost: Record<string, number> = {};
  const prevNode: Record<string, string | null> = {};
  const prevEdge: Record<string, string | null> = {};
  const unvisited = new Set<string>(Object.keys(world.nodes));

  for (const id of unvisited) {
    distCost[id] = Infinity;
    prevNode[id] = null;
    prevEdge[id] = null;
  }
  distCost[startNodeId] = 0;

  // Build adjacency list for fast lookup
  const adj: Record<string, GraphEdge[]> = {};
  for (const e of world.edges) {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push(e);
  }

  while (unvisited.size > 0) {
    let u: string | null = null;
    let smallest = Infinity;
    for (const candidate of unvisited) {
      if (distCost[candidate] < smallest) {
        smallest = distCost[candidate];
        u = candidate;
      }
    }

    if (u === null || smallest === Infinity) break;
    if (u === targetNodeId) break;
    unvisited.delete(u);

    const outgoing = adj[u] || [];
    for (const edge of outgoing) {
      if (!unvisited.has(edge.to)) continue;
      const alt = distCost[u] + edge.distanceMeters;
      if (alt < distCost[edge.to]) {
        distCost[edge.to] = alt;
        prevNode[edge.to] = u;
        prevEdge[edge.to] = edge.id;
      }
    }
  }

  if (distCost[targetNodeId] === Infinity) {
    return null;
  }

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let curr: string | null = targetNodeId;
  while (curr !== null) {
    nodeIds.unshift(curr);
    const eId = prevEdge[curr];
    if (eId) edgeIds.unshift(eId);
    curr = prevNode[curr];
  }

  const waypoints = nodeIds.map((id) => ({
    x: world.nodes[id].x,
    z: world.nodes[id].z,
    nodeId: id,
  }));

  const upcomingIntersections = nodeIds.filter(
    (id) => world.nodes[id]?.type === 'INTERSECTION',
  );

  const totalDist = Math.round(distCost[targetNodeId]);
  const estimatedTimeSeconds = Number((totalDist / 26).toFixed(1));

  return {
    nodeIds,
    edgeIds,
    waypoints,
    totalDistanceMeters: totalDist,
    estimatedTimeSeconds,
    upcomingIntersections,
  };
}

/**
 * Finds the nearest reachable destination of the matching emergency type using
 * connected road-network travel distance (never straight-line Euclidean distance!).
 * Also ensures the destination is at least a meaningful drive away (> 140m) if the player
 * happens to be parked right on top of a station, or picks the closest reachable one.
 */
export function findNearestReachableDestination(
  playerX: number,
  playerZ: number,
  playerYaw: number,
  emergencyType: EmergencyType,
): { destinationNode: GraphNode; route: RouteResult } | null {
  const world = getProceduralCityWorld();
  const startNodeId = findBestStartNodeForVehicle(playerX, playerZ, playerYaw);
  const startNode = world.nodes[startNodeId];
  const distToStartNode = Math.hypot(
    startNode.x - playerX,
    startNode.z - playerZ,
  );

  const candidateIds = world.destinationIdsByType[emergencyType] || [];
  const evaluated: Array<{
    node: GraphNode;
    route: RouteResult;
    totalRoadMeters: number;
  }> = [];

  for (const destId of candidateIds) {
    const route = calculateOptimalRoute(startNodeId, destId);
    if (!route) continue;
    const totalRoadMeters = Math.round(
      distToStartNode + route.totalDistanceMeters,
    );
    evaluated.push({
      node: world.nodes[destId],
      route: {
        ...route,
        totalDistanceMeters: Math.max(80, totalRoadMeters),
        estimatedTimeSeconds: Number((totalRoadMeters / 25).toFixed(1)),
      },
      totalRoadMeters,
    });
  }

  if (evaluated.length === 0) return null;

  // Sort strictly by shortest connected road-network distance
  evaluated.sort((a, b) => a.totalRoadMeters - b.totalRoadMeters);

  // If the very closest destination is < 45m away (player already sitting at its entrance),
  // pick the next nearest reachable destination so the mission is actually playable; otherwise pick [0].
  const chosen =
    evaluated[0].totalRoadMeters < 45 && evaluated.length > 1
      ? evaluated[1]
      : evaluated[0];

  return {
    destinationNode: chosen.node,
    route: chosen.route,
  };
}

/**
 * Computes real-time turn-by-turn navigation guidance, remaining route distance,
 * next intersection signal status, and wrong-turn off-route detection.
 */
export function computeNavigationGuidance(
  player: PlayerVehicleState,
  route: RouteResult,
  intersections: Record<string, IntersectionSignalState>,
): {
  guidance: NavigationGuidance;
  closestWaypointIdx: number;
  offRouteDistance: number;
} {
  const world = getProceduralCityWorld();
  const wps = route.waypoints;

  if (wps.length === 0) {
    return {
      guidance: {
        instructionText: 'You have reached the destination.',
        subInstructionText: 'Bring vehicle to a stop in the green response zone.',
        turnType: 'ARRIVED',
        distanceToTurnMeters: 0,
        nextIntersectionId: null,
        nextIntersectionLamp: null,
        remainingDistanceMeters: 0,
        etaSeconds: 0,
        isRerouting: false,
      },
      closestWaypointIdx: 0,
      offRouteDistance: 0,
    };
  }

  // Find closest segment on the route to the player
  let minSegDist = Infinity;
  let activeSegIdx = 0;

  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const lenSq = vx * vx + vz * vz;
    let t = 0;
    if (lenSq > 0.01) {
      t = ((player.x - a.x) * vx + (player.z - a.z) * vz) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const projX = a.x + t * vx;
    const projZ = a.z + t * vz;
    const d = Math.hypot(player.x - projX, player.z - projZ);
    if (d < minSegDist) {
      minSegDist = d;
      activeSegIdx = i;
    }
  }

  // Target waypoint is the end of the current segment (or the first waypoint if before it)
  let nextWpIdx = Math.min(wps.length - 1, activeSegIdx + 1);
  const distToNextWp = Math.hypot(
    wps[nextWpIdx].x - player.x,
    wps[nextWpIdx].z - player.z,
  );
  if (distToNextWp < 14 && nextWpIdx < wps.length - 1) {
    nextWpIdx += 1;
  }

  // Compute total remaining road distance from player -> wps[nextWpIdx] -> ... -> destination
  let remainingMeters = Math.hypot(
    wps[nextWpIdx].x - player.x,
    wps[nextWpIdx].z - player.z,
  );
  for (let i = nextWpIdx; i < wps.length - 1; i++) {
    remainingMeters += Math.hypot(
      wps[i + 1].x - wps[i].x,
      wps[i + 1].z - wps[i].z,
    );
  }
  remainingMeters = Math.round(remainingMeters);

  // Identify upcoming turn (where route changes direction at a waypoint)
  let turnType: NavigationGuidance['turnType'] = 'STRAIGHT';
  let turnNodeId = wps[wps.length - 1].nodeId;
  let distToAction = remainingMeters;

  let accumDist = Math.hypot(
    wps[nextWpIdx].x - player.x,
    wps[nextWpIdx].z - player.z,
  );

  for (let i = nextWpIdx; i < wps.length - 1; i++) {
    const prevPt = i === nextWpIdx ? { x: player.x, z: player.z } : wps[i - 1];
    const currPt = wps[i];
    const nextPt = wps[i + 1];

    const v1x = currPt.x - prevPt.x;
    const v1z = currPt.z - prevPt.z;
    const v2x = nextPt.x - currPt.x;
    const v2z = nextPt.z - currPt.z;
    const len1 = Math.hypot(v1x, v1z);
    const len2 = Math.hypot(v2x, v2z);

    if (len1 > 1 && len2 > 1) {
      // Cross product in XZ plane (where +X is right/East and +Z is down/South):
      // cross = v1x * v2z - v1z * v2x
      // If cross > 0 -> Right turn; if cross < 0 -> Left turn
      const cross = (v1x * v2z - v1z * v2x) / (len1 * len2);
      if (Math.abs(cross) > 0.45) {
        turnType = cross > 0 ? 'RIGHT' : 'LEFT';
        turnNodeId = currPt.nodeId;
        distToAction = Math.round(accumDist);
        break;
      }
    }
    accumDist += len2;
  }

  // Next upcoming signalized intersection along the route
  let nextIntersectionId: string | null = null;
  for (let i = nextWpIdx; i < wps.length; i++) {
    const nId = wps[i].nodeId;
    if (world.nodes[nId]?.type === 'INTERSECTION') {
      nextIntersectionId = nId;
      break;
    }
  }

  let nextIntersectionLamp: SignalLampColor | null = null;
  if (nextIntersectionId && intersections[nextIntersectionId]) {
    const ctrl = intersections[nextIntersectionId];
    nextIntersectionLamp =
      player.currentAxis === 'NS' ? ctrl.nsLamp : ctrl.ewLamp;
  }

  const turnNodeLabel =
    world.nodes[turnNodeId]?.label || turnNodeId;

  let instructionText = `Continue straight for ${distToAction} m`;
  let subInstructionText = `Follow highlighted GreenRoute corridor`;

  if (remainingMeters <= 24) {
    turnType = 'ARRIVED';
    instructionText = 'You have reached the destination.';
    subInstructionText = 'Pull into the glowing emergency bay.';
  } else if (turnType === 'LEFT') {
    instructionText =
      distToAction > 120
        ? `Continue straight for ${distToAction} m, then turn left`
        : `Turn left at ${turnNodeLabel} (${distToAction} m)`;
    subInstructionText = `Next junction: ${nextIntersectionId || 'Ahead'}`;
  } else if (turnType === 'RIGHT') {
    instructionText =
      distToAction > 120
        ? `Continue straight for ${distToAction} m, then turn right`
        : `Turn right at ${turnNodeLabel} (${distToAction} m)`;
    subInstructionText = `Next junction: ${nextIntersectionId || 'Ahead'}`;
  } else {
    instructionText = `Continue straight for ${remainingMeters} m`;
    subInstructionText = `Approaching ${turnNodeLabel}`;
  }

  const speedForEta = Math.max(18, Math.abs(player.speed));
  const etaSeconds = Number((remainingMeters / speedForEta).toFixed(1));

  return {
    guidance: {
      instructionText,
      subInstructionText,
      turnType,
      distanceToTurnMeters: distToAction,
      nextIntersectionId,
      nextIntersectionLamp,
      remainingDistanceMeters: remainingMeters,
      etaSeconds,
      isRerouting: minSegDist > 28,
    },
    closestWaypointIdx: nextWpIdx,
    offRouteDistance: minSegDist,
  };
}
