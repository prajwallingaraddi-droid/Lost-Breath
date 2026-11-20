import {
  BUILDING_FLOORS,
  BUILDING_STAIRCASES,
  CORRIDOR_OUTER,
  COURTYARD_HALF,
  FLOOR_ELEVATIONS,
  FLOOR_HEIGHT,
  getActiveMissionFrame,
  getActivePuzzleFrame,
  MISSION_ROOM_BOUNDS,
  PUZZLE_CHAMBER_BOUNDS,
  registerLayoutChangeListener,
  roomLocalToWorld,
  SPECIAL_ROOMS_CONFIG,
} from '../data/buildingLayout';
import { DoorAnimState, FloorNumber, SpecialDoorKey } from '../types/game';
import {
  FLOOR_HIDING_OCCLUDERS,
  FLOOR_PURE_WALLS,
  PUZZLE_PROTECTION_BARRIER_BOX,
  segmentIntersectsAABB,
  segmentIntersectsClosedDoorOnFloor,
} from './collision';
import { getFloorFromElevation, stairLocalToWorld } from './floorNavigation';

export type NavNodeKind =
  | 'corner'
  | 'door-front'
  | 'room-interior'
  | 'lounge'
  | 'lobby'
  | 'stair-entry'
  | 'stair-landing'
  | 'stair-exit';

export interface NavEdge {
  to: string;
  toIdx: number;
  cost: number;
  requiresDoor?: SpecialDoorKey;
}

export interface NavNode {
  id: string;
  idx: number;
  x: number;
  y: number;
  z: number;
  floor: FloorNumber;
  kind: NavNodeKind;
  roomId?: string;
  neighbors: NavEdge[];
}

export interface NavWaypoint {
  x: number;
  y: number;
  z: number;
  nodeId: string;
  kind: NavNodeKind;
}

const CORRIDOR_MID = (COURTYARD_HALF + CORRIDOR_OUTER) / 2; // 14.8m

const navNodes = new Map<string, NavNode>();
let navNodesArray: NavNode[] = [];
const nodesByFloor: Record<FloorNumber, NavNode[]> = { 1: [], 2: [], 3: [], 4: [] };
let patrolCandidateNodes: NavNode[] = [];

// Pre-allocated A* scratch buffers (zero Map/Set GC per pathfind!)
let astarStamp = 0;
let astarG = new Float64Array(256);
let astarF = new Float64Array(256);
let astarCameFrom = new Int32Array(256);
let astarOpenStamp = new Int32Array(256);
let astarClosedStamp = new Int32Array(256);
const astarOpenList: number[] = [];

// Reusable nearest-node candidate scratch buffer
interface NearestCandidate {
  node: NavNode;
  distSq: number;
}
const nearestScratch: NearestCandidate[] = [];

function ensureAstarCapacity(count: number): void {
  if (astarG.length < count) {
    const cap = Math.max(count, astarG.length * 2);
    astarG = new Float64Array(cap);
    astarF = new Float64Array(cap);
    astarCameFrom = new Int32Array(cap);
    astarOpenStamp = new Int32Array(cap);
    astarClosedStamp = new Int32Array(cap);
  }
}

function nextAstarStamp(): number {
  astarStamp++;
  if (astarStamp >= 0x7ffffff0) {
    astarOpenStamp.fill(0);
    astarClosedStamp.fill(0);
    astarStamp = 1;
  }
  return astarStamp;
}

function addNode(node: Omit<NavNode, 'neighbors' | 'idx'>): NavNode {
  const idx = navNodesArray.length;
  const full: NavNode = { ...node, idx, neighbors: [] };
  navNodes.set(full.id, full);
  navNodesArray.push(full);
  nodesByFloor[full.floor].push(full);
  return full;
}

function connectBidirectional(
  aId: string,
  bId: string,
  requiresDoor?: SpecialDoorKey,
  costScale = 1.0
): void {
  const a = navNodes.get(aId);
  const b = navNodes.get(bId);
  if (!a || !b) return;
  const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * costScale;
  a.neighbors.push({ to: bId, toIdx: b.idx, cost: dist, requiresDoor });
  b.neighbors.push({ to: aId, toIdx: a.idx, cost: dist, requiresDoor });
}

export function rebuildNavigationGraph(): void {
  navNodes.clear();
  navNodesArray = [];
  nodesByFloor[1] = [];
  nodesByFloor[2] = [];
  nodesByFloor[3] = [];
  nodesByFloor[4] = [];

  for (const floorData of BUILDING_FLOORS) {
    const fl = floorData.floor;
    const y = floorData.elevation;

    // 1. Four corridor corners
    const nwId = `f${fl}-corner-nw`;
    const neId = `f${fl}-corner-ne`;
    const seId = `f${fl}-corner-se`;
    const swId = `f${fl}-corner-sw`;

    addNode({ id: nwId, x: -CORRIDOR_MID, y, z: -CORRIDOR_MID, floor: fl, kind: 'corner' });
    addNode({ id: neId, x: CORRIDOR_MID, y, z: -CORRIDOR_MID, floor: fl, kind: 'corner' });
    addNode({ id: seId, x: CORRIDOR_MID, y, z: CORRIDOR_MID, floor: fl, kind: 'corner' });
    addNode({ id: swId, x: -CORRIDOR_MID, y, z: CORRIDOR_MID, floor: fl, kind: 'corner' });

    // 2. 20 apartment door-front nodes around the corridor ring (using buildingLayout door positions)
    const wingNodes: Record<'north' | 'east' | 'south' | 'west', string[]> = {
      north: [],
      east: [],
      south: [],
      west: [],
    };

    for (const door of floorData.doors) {
      if (door.isInteriorEscape) continue;
      const room = floorData.rooms.find((r) => r.id === door.roomId);
      if (!room) continue;

      let nx = door.position[0];
      let nz = door.position[2];
      if (room.wing === 'north') nz = -CORRIDOR_MID;
      else if (room.wing === 'east') nx = CORRIDOR_MID;
      else if (room.wing === 'south') nz = CORRIDOR_MID;
      else if (room.wing === 'west') nx = -CORRIDOR_MID;

      const nodeId = `f${fl}-door-${door.roomNumber}`;
      addNode({
        id: nodeId,
        x: nx,
        y,
        z: nz,
        floor: fl,
        kind: 'door-front',
        roomId: room.id,
      });
      wingNodes[room.wing].push(nodeId);
    }

    // Chain North wing: NW -> N01..N05 -> NE
    const nChain = [nwId, ...wingNodes.north, neId];
    for (let i = 0; i < nChain.length - 1; i++) connectBidirectional(nChain[i], nChain[i + 1]);

    // Chain East wing: NE -> E06..E10 -> SE
    const eChain = [neId, ...wingNodes.east, seId];
    for (let i = 0; i < eChain.length - 1; i++) connectBidirectional(eChain[i], eChain[i + 1]);

    // Chain South wing: SE -> S11..S15 -> SW
    const sChain = [seId, ...wingNodes.south, swId];
    for (let i = 0; i < sChain.length - 1; i++) connectBidirectional(sChain[i], sChain[i + 1]);

    // Chain West wing: SW -> W16..W20 -> NW
    const wChain = [swId, ...wingNodes.west, nwId];
    for (let i = 0; i < wChain.length - 1; i++) connectBidirectional(wChain[i], wChain[i + 1]);

    // 3. Corner lounges (NE & SW) + stairwell lobby hubs (NW & SE)
    const loungeNeId = `f${fl}-lounge-ne`;
    const loungeSwId = `f${fl}-lounge-sw`;
    addNode({ id: loungeNeId, x: 17.8, y, z: -17.8, floor: fl, kind: 'lounge' });
    addNode({ id: loungeSwId, x: -17.8, y, z: 17.8, floor: fl, kind: 'lounge' });
    connectBidirectional(neId, loungeNeId);
    connectBidirectional(swId, loungeSwId);

    const lobbyNwId = `f${fl}-lobby-nw`;
    const lobbySeId = `f${fl}-lobby-se`;
    addNode({ id: lobbyNwId, x: -22.3, y, z: -16.8, floor: fl, kind: 'lobby' });
    addNode({ id: lobbySeId, x: 22.3, y, z: 16.8, floor: fl, kind: 'lobby' });
    connectBidirectional(nwId, lobbyNwId);
    connectBidirectional(seId, lobbySeId);
  }

  // 4. Physical switchback staircase connections between floors (NW & SE shafts)
  for (const stair of BUILDING_STAIRCASES) {
    const isWest = stair.origin[0] < 0;
    const lobbyPrefix = isWest ? 'lobby-nw' : 'lobby-se';
    const lowY = FLOOR_ELEVATIONS[stair.fromFloor];
    const midY = lowY + FLOOR_HEIGHT / 2;
    const highY = FLOOR_ELEVATIONS[stair.toFloor];

    const [enX, enZ] = stairLocalToWorld(-0.94, 3.85, stair);
    const [m1X, m1Z] = stairLocalToWorld(-0.94, -1.75, stair);
    const [m2X, m2Z] = stairLocalToWorld(0.94, -1.75, stair);
    const [exX, exZ] = stairLocalToWorld(0.94, 3.85, stair);

    const enId = `${stair.id}-en`;
    const m1Id = `${stair.id}-m1`;
    const m2Id = `${stair.id}-m2`;
    const exId = `${stair.id}-ex`;

    addNode({ id: enId, x: enX, y: lowY, z: enZ, floor: stair.fromFloor, kind: 'stair-entry' });
    addNode({ id: m1Id, x: m1X, y: midY, z: m1Z, floor: stair.fromFloor, kind: 'stair-landing' });
    addNode({ id: m2Id, x: m2X, y: midY, z: m2Z, floor: stair.toFloor, kind: 'stair-landing' });
    addNode({ id: exId, x: exX, y: highY, z: exZ, floor: stair.toFloor, kind: 'stair-exit' });

    connectBidirectional(`f${stair.fromFloor}-${lobbyPrefix}`, enId);
    connectBidirectional(enId, m1Id, undefined, 1.1);
    connectBidirectional(m1Id, m2Id, undefined, 1.05);
    connectBidirectional(m2Id, exId, undefined, 1.1);
    connectBidirectional(exId, `f${stair.toFloor}-${lobbyPrefix}`);
  }

  // 5. Accessible Special Room Interiors (dynamically positioned for whichever room is assigned!)
  const missionFrame = getActiveMissionFrame();
  const missionDoorNode = `f${SPECIAL_ROOMS_CONFIG.missionFloor}-door-${SPECIAL_ROOMS_CONFIG.missionRoomNumber}`;
  const missionEntryId = `${SPECIAL_ROOMS_CONFIG.missionRoomId}-entry`;
  const missionCenterId = `${SPECIAL_ROOMS_CONFIG.missionRoomId}-center`;
  const [mEntryX, mEntryZ] = roomLocalToWorld(0, 4.3, missionFrame);
  const [mCenterX, mCenterZ] = roomLocalToWorld(0, 0, missionFrame);

  addNode({
    id: missionEntryId,
    x: mEntryX,
    y: MISSION_ROOM_BOUNDS.elevation,
    z: mEntryZ,
    floor: SPECIAL_ROOMS_CONFIG.missionFloor,
    kind: 'room-interior',
    roomId: SPECIAL_ROOMS_CONFIG.missionRoomId,
  });
  addNode({
    id: missionCenterId,
    x: mCenterX,
    y: MISSION_ROOM_BOUNDS.elevation,
    z: mCenterZ,
    floor: SPECIAL_ROOMS_CONFIG.missionFloor,
    kind: 'room-interior',
    roomId: SPECIAL_ROOMS_CONFIG.missionRoomId,
  });
  connectBidirectional(missionDoorNode, missionEntryId, 'mission');
  connectBidirectional(missionEntryId, missionCenterId, 'mission');

  const puzzleFrame = getActivePuzzleFrame();
  const puzzleDoorNode = `f${SPECIAL_ROOMS_CONFIG.puzzleFloor}-door-${SPECIAL_ROOMS_CONFIG.puzzleRoomNumber}`;
  const puzzleEntryId = `${SPECIAL_ROOMS_CONFIG.puzzleRoomId}-entry`;
  const puzzleCenterId = `${SPECIAL_ROOMS_CONFIG.puzzleRoomId}-center`;
  const [pEntryX, pEntryZ] = roomLocalToWorld(0, 4.3, puzzleFrame);
  const [pCenterX, pCenterZ] = roomLocalToWorld(0, -1.3, puzzleFrame);

  addNode({
    id: puzzleEntryId,
    x: pEntryX,
    y: PUZZLE_CHAMBER_BOUNDS.elevation,
    z: pEntryZ,
    floor: SPECIAL_ROOMS_CONFIG.puzzleFloor,
    kind: 'room-interior',
    roomId: SPECIAL_ROOMS_CONFIG.puzzleRoomId,
  });
  addNode({
    id: puzzleCenterId,
    x: pCenterX,
    y: PUZZLE_CHAMBER_BOUNDS.elevation,
    z: pCenterZ,
    floor: SPECIAL_ROOMS_CONFIG.puzzleFloor,
    kind: 'room-interior',
    roomId: SPECIAL_ROOMS_CONFIG.puzzleRoomId,
  });
  connectBidirectional(puzzleDoorNode, puzzleEntryId, 'puzzle');
  connectBidirectional(puzzleEntryId, puzzleCenterId, 'puzzle');

  ensureAstarCapacity(navNodesArray.length);

  patrolCandidateNodes = navNodesArray.filter(
    (n) =>
      n.kind === 'door-front' ||
      n.kind === 'lounge' ||
      n.kind === 'room-interior' ||
      n.kind === 'corner'
  );
}

rebuildNavigationGraph();
registerLayoutChangeListener(rebuildNavigationGraph);

export function getAllNavNodes(): NavNode[] {
  return [...navNodesArray];
}

export function getNavNodeById(id: string): NavNode | undefined {
  return navNodes.get(id);
}

function isEdgeWalkable(
  edge: NavEdge,
  doorStates: Record<SpecialDoorKey, DoorAnimState>,
  puzzleRoomProtected = false
): boolean {
  if (!edge.requiresDoor) return true;
  if (edge.requiresDoor === 'puzzle' && puzzleRoomProtected) return false;
  return doorStates[edge.requiresDoor] === 'open';
}

function checkFloorLineOfSight(
  fl: FloorNumber,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  doorStates: Record<SpecialDoorKey, DoorAnimState>,
  ignoreHidingSpots: boolean,
  puzzleRoomProtected: boolean
): boolean {
  const walls = FLOOR_PURE_WALLS[fl];
  for (let i = 0; i < walls.length; i++) {
    if (segmentIntersectsAABB(fromX, fromZ, toX, toZ, walls[i])) {
      return false;
    }
  }
  if (!ignoreHidingSpots) {
    const hidingOccluders = FLOOR_HIDING_OCCLUDERS[fl];
    for (let i = 0; i < hidingOccluders.length; i++) {
      if (segmentIntersectsAABB(fromX, fromZ, toX, toZ, hidingOccluders[i])) {
        return false;
      }
    }
  }
  if (puzzleRoomProtected && fl === PUZZLE_CHAMBER_BOUNDS.floor) {
    if (segmentIntersectsAABB(fromX, fromZ, toX, toZ, PUZZLE_PROTECTION_BARRIER_BOX)) {
      return false;
    }
  }
  if (segmentIntersectsClosedDoorOnFloor(fromX, fromZ, toX, toZ, fl, doorStates)) {
    return false;
  }
  return true;
}

/**
 * Checks whether a straight 2D/3D sightline between two positions is unobstructed
 * by solid walls, closed doors, hiding structures, Puzzle Room containment barrier, or floor slabs.
 */
export function hasBeastLineOfSight(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  doorStates: Record<SpecialDoorKey, DoorAnimState>,
  options?: { ignoreHidingSpots?: boolean; puzzleRoomProtected?: boolean }
): boolean {
  const fromFloor = getFloorFromElevation(fromY);
  const toFloor = getFloorFromElevation(toY);
  const dy = Math.abs(fromY - toY);

  // If separated vertically by a floor slab, only allow LOS if both are in a shared stairwell opening
  // or looking across the open central courtyard atrium without passing over solid slabs.
  if (dy >= 1.8) {
    const inSameStairwell =
      (fromX < -19.5 && fromZ < -18.5 && toX < -19.5 && toZ < -18.5) ||
      (fromX > 19.5 && fromZ > 18.5 && toX > 19.5 && toZ > 18.5);
    if (!inSameStairwell) {
      const midX = (fromX + toX) * 0.5;
      const midZ = (fromZ + toZ) * 0.5;
      const crossesAtrium =
        Math.abs(midX) < COURTYARD_HALF && Math.abs(midZ) < COURTYARD_HALF && dy <= 5.2;
      if (!crossesAtrium) {
        return false;
      }
    }
  }

  const ignoreHiding = Boolean(options?.ignoreHidingSpots);
  const puzzleProtected = Boolean(options?.puzzleRoomProtected);

  if (
    !checkFloorLineOfSight(
      fromFloor,
      fromX,
      fromZ,
      toX,
      toZ,
      doorStates,
      ignoreHiding,
      puzzleProtected
    )
  ) {
    return false;
  }

  if (toFloor !== fromFloor) {
    if (
      !checkFloorLineOfSight(
        toFloor,
        fromX,
        fromZ,
        toX,
        toZ,
        doorStates,
        ignoreHiding,
        puzzleProtected
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Checks Beast vision cone + range + unobstructed line of sight (respecting player hiding state & barrier).
 */
export function canBeastSeePlayer(params: {
  beastX: number;
  beastY: number;
  beastZ: number;
  beastYaw: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  visionRange: number;
  visionFovDeg: number;
  proximitySenseRadius: number;
  doorStates: Record<SpecialDoorKey, DoorAnimState>;
  playerHidden?: boolean;
  puzzleRoomProtected?: boolean;
}): boolean {
  if (params.playerHidden) return false;
  if (Math.abs(params.playerX) > 27.4 || Math.abs(params.playerZ) > 27.4) return false;

  const dx = params.playerX - params.beastX;
  const dz = params.playerZ - params.beastZ;
  const distSq = dx * dx + dz * dz;
  const rangeSq = params.visionRange * params.visionRange;

  if (distSq > rangeSq) return false;

  // Close-range proximity awareness (360° if unobstructed by wall/door/hiding object/barrier)
  if (
    distSq <= params.proximitySenseRadius * params.proximitySenseRadius &&
    Math.abs(params.playerY - params.beastY) < 1.8
  ) {
    return hasBeastLineOfSight(
      params.beastX,
      params.beastY,
      params.beastZ,
      params.playerX,
      params.playerY,
      params.playerZ,
      params.doorStates,
      { puzzleRoomProtected: params.puzzleRoomProtected }
    );
  }

  const dist2D = Math.sqrt(distSq);
  const fwdX = Math.sin(params.beastYaw);
  const fwdZ = Math.cos(params.beastYaw);
  const invDist = dist2D > 1e-5 ? 1 / dist2D : 1;
  const dot = (dx * invDist) * fwdX + (dz * invDist) * fwdZ;
  const halfFovCos = Math.cos(((params.visionFovDeg * 0.5) * Math.PI) / 180);

  if (dot < halfFovCos) return false;

  return hasBeastLineOfSight(
    params.beastX,
    params.beastY,
    params.beastZ,
    params.playerX,
    params.playerY,
    params.playerZ,
    params.doorStates,
    { puzzleRoomProtected: params.puzzleRoomProtected }
  );
}

/**
 * Finds the nearest reachable nav node to a 3D world position, preferring nodes
 * on the same floor and with clear line-of-sight so the Beast never targets through a wall.
 * Optimized: sorts candidates by squared distance first and early-exits on the first LOS match.
 */
export function findNearestNavNode(
  x: number,
  y: number,
  z: number,
  doorStates: Record<SpecialDoorKey, DoorAnimState>,
  excludeRoomInteriorsIfClosed = true,
  puzzleRoomProtected = false
): NavNode {
  const floor = getFloorFromElevation(y);
  const candidates = nodesByFloor[floor];

  let count = 0;
  for (let i = 0; i < candidates.length; i++) {
    const node = candidates[i];
    if (excludeRoomInteriorsIfClosed && node.kind === 'room-interior') {
      if (node.roomId === SPECIAL_ROOMS_CONFIG.missionRoomId && doorStates.mission !== 'open') {
        continue;
      }
      if (
        node.roomId === SPECIAL_ROOMS_CONFIG.puzzleRoomId &&
        (doorStates.puzzle !== 'open' || puzzleRoomProtected)
      ) {
        continue;
      }
    }

    const dx = node.x - x;
    const dy = node.y - y;
    const dz = node.z - z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (count < nearestScratch.length) {
      nearestScratch[count].node = node;
      nearestScratch[count].distSq = distSq;
    } else {
      nearestScratch.push({ node, distSq });
    }
    count++;
  }

  if (count === 0) {
    return navNodesArray[0];
  }

  // Insertion sort over ~32 floor nodes (faster than Array.sort and zero slice allocation)
  for (let i = 1; i < count; i++) {
    const keyNode = nearestScratch[i].node;
    const keyDist = nearestScratch[i].distSq;
    let j = i - 1;
    while (j >= 0 && nearestScratch[j].distSq > keyDist) {
      nearestScratch[j + 1].node = nearestScratch[j].node;
      nearestScratch[j + 1].distSq = nearestScratch[j].distSq;
      j--;
    }
    nearestScratch[j + 1].node = keyNode;
    nearestScratch[j + 1].distSq = keyDist;
  }

  // First node in distance-sorted order that has clear LOS is guaranteed to be the closest LOS node!
  for (let i = 0; i < count; i++) {
    const node = nearestScratch[i].node;
    if (
      Math.abs(node.y - y) < 2.6 &&
      hasBeastLineOfSight(x, y, z, node.x, node.y, node.z, doorStates, {
        ignoreHidingSpots: true,
        puzzleRoomProtected,
      })
    ) {
      return node;
    }
  }

  return nearestScratch[0].node;
}

/**
 * A* pathfinding across the 4-floor apartment navigation graph (corridors, stairs, open rooms).
 * Optimized with flat typed-array state & integer node indices (zero Map/Set allocations).
 */
export function findNavPath(params: {
  startX: number;
  startY: number;
  startZ: number;
  goalX: number;
  goalY: number;
  goalZ: number;
  doorStates: Record<SpecialDoorKey, DoorAnimState>;
  goalNodeIdOverride?: string;
  puzzleRoomProtected?: boolean;
  avoidNodeIds?: Set<string>;
}): NavWaypoint[] {
  const protectedPuzzle = Boolean(params.puzzleRoomProtected);
  const startNode = findNearestNavNode(
    params.startX,
    params.startY,
    params.startZ,
    params.doorStates,
    true,
    protectedPuzzle
  );

  let goalNode =
    (params.goalNodeIdOverride && navNodes.get(params.goalNodeIdOverride)) ||
    findNearestNavNode(
      params.goalX,
      params.goalY,
      params.goalZ,
      params.doorStates,
      true,
      protectedPuzzle
    );

  // Never allow pathfinding goal inside protected Puzzle Room
  if (
    protectedPuzzle &&
    goalNode.kind === 'room-interior' &&
    goalNode.roomId === SPECIAL_ROOMS_CONFIG.puzzleRoomId
  ) {
    goalNode =
      navNodes.get(`f${SPECIAL_ROOMS_CONFIG.puzzleFloor}-door-${SPECIAL_ROOMS_CONFIG.puzzleRoomNumber}`) ??
      goalNode;
  }

  if (startNode.idx === goalNode.idx) {
    return [
      {
        x: startNode.x,
        y: startNode.y,
        z: startNode.z,
        nodeId: startNode.id,
        kind: startNode.kind,
      },
    ];
  }

  const stamp = nextAstarStamp();
  const startIdx = startNode.idx;
  const goalIdx = goalNode.idx;
  const goalX = goalNode.x;
  const goalY = goalNode.y;
  const goalZ = goalNode.z;
  const avoidIds = params.avoidNodeIds;

  astarOpenList.length = 0;
  astarOpenList.push(startIdx);
  astarOpenStamp[startIdx] = stamp;
  astarG[startIdx] = 0;
  astarF[startIdx] = Math.hypot(goalX - startNode.x, goalY - startNode.y, goalZ - startNode.z);
  astarCameFrom[startIdx] = -1;

  while (astarOpenList.length > 0) {
    // Pick lowest fScore node from compact open list
    let bestPos = 0;
    let currentIdx = astarOpenList[0];
    let bestF = astarF[currentIdx];
    for (let i = 1; i < astarOpenList.length; i++) {
      const idx = astarOpenList[i];
      const f = astarF[idx];
      if (f < bestF) {
        bestF = f;
        bestPos = i;
        currentIdx = idx;
      }
    }

    if (currentIdx === goalIdx) {
      const path: NavWaypoint[] = [];
      let trace = currentIdx;
      while (trace !== -1) {
        const node = navNodesArray[trace];
        path.push({
          x: node.x,
          y: node.y,
          z: node.z,
          nodeId: node.id,
          kind: node.kind,
        });
        trace = astarCameFrom[trace];
      }
      path.reverse();

      // Avoid backtracking to startNode during frequent repathing if path[1] is directly reachable on the same elevation
      if (
        path.length >= 2 &&
        Math.abs(params.startY - path[1].y) < 1.35 &&
        !(path[1].kind === 'stair-entry' || path[1].kind === 'stair-exit') &&
        hasBeastLineOfSight(
          params.startX,
          params.startY,
          params.startZ,
          path[1].x,
          path[1].y,
          path[1].z,
          params.doorStates,
          { ignoreHidingSpots: true, puzzleRoomProtected: protectedPuzzle }
        )
      ) {
        path.shift();
      } else if (
        path.length >= 2 &&
        Math.hypot(path[0].x - params.startX, path[0].z - params.startZ) < 0.75 &&
        Math.abs(path[0].y - params.startY) < 1.35
      ) {
        path.shift();
      }
      return path;
    }

    // Pop bestPos in O(1) via swap-with-last
    const lastIdx = astarOpenList.pop()!;
    if (bestPos < astarOpenList.length) {
      astarOpenList[bestPos] = lastIdx;
    }
    astarClosedStamp[currentIdx] = stamp;

    const current = navNodesArray[currentIdx];
    const currentG = astarG[currentIdx];
    const neighbors = current.neighbors;

    for (let i = 0; i < neighbors.length; i++) {
      const edge = neighbors[i];
      if (!isEdgeWalkable(edge, params.doorStates, protectedPuzzle)) continue;
      const nIdx = edge.toIdx;
      if (astarClosedStamp[nIdx] === stamp) continue;

      const crowdPenalty =
        avoidIds && nIdx !== goalIdx && avoidIds.has(edge.to) ? 7.5 : 0;
      const tentativeG = currentG + edge.cost + crowdPenalty;

      const isInOpen = astarOpenStamp[nIdx] === stamp;
      if (!isInOpen || tentativeG < astarG[nIdx]) {
        const neighbor = navNodesArray[nIdx];
        astarCameFrom[nIdx] = currentIdx;
        astarG[nIdx] = tentativeG;
        const h = Math.hypot(goalX - neighbor.x, goalY - neighbor.y, goalZ - neighbor.z);
        astarF[nIdx] = tentativeG + h;
        if (!isInOpen) {
          astarOpenStamp[nIdx] = stamp;
          astarOpenList.push(nIdx);
        }
      }
    }
  }

  return [
    {
      x: goalNode.x,
      y: goalNode.y,
      z: goalNode.z,
      nodeId: goalNode.id,
      kind: goalNode.kind,
    },
  ];
}

/**
 * Picks a diverse patrol destination across all 4 floors (door-fronts, lounges, open special rooms)
 * while avoiding recently visited nodes & nodes claimed by sibling Beasts.
 */
export function pickPatrolTargetNode(params: {
  currentFloor: FloorNumber;
  recentNodeIds: string[];
  doorStates: Record<SpecialDoorKey, DoorAnimState>;
  biasFloor?: FloorNumber;
  preferredFloors?: FloorNumber[];
  reservedNodeIds?: string[];
  puzzleRoomProtected?: boolean;
}): NavNode {
  const protectedPuzzle = Boolean(params.puzzleRoomProtected);
  const pool: NavNode[] = [];
  for (let i = 0; i < patrolCandidateNodes.length; i++) {
    const n = patrolCandidateNodes[i];
    if (n.kind === 'room-interior') {
      if (n.roomId === SPECIAL_ROOMS_CONFIG.missionRoomId && params.doorStates.mission !== 'open') {
        continue;
      }
      if (
        n.roomId === SPECIAL_ROOMS_CONFIG.puzzleRoomId &&
        (params.doorStates.puzzle !== 'open' || protectedPuzzle)
      ) {
        continue;
      }
    }
    pool.push(n);
  }

  const avoidSet = new Set([...params.recentNodeIds, ...(params.reservedNodeIds ?? [])]);
  let filtered = pool.filter((n) => !avoidSet.has(n.id));
  if (filtered.length === 0) filtered = pool;

  const wantOtherFloor = Math.random() < 0.52;
  if (params.biasFloor && Math.random() < 0.48) {
    const biased = filtered.filter((n) => n.floor === params.biasFloor);
    if (biased.length > 0) filtered = biased;
  } else if (params.preferredFloors && params.preferredFloors.length > 0 && Math.random() < 0.65) {
    const prefSet = new Set(params.preferredFloors);
    const pref = filtered.filter((n) => prefSet.has(n.floor));
    if (pref.length > 0) filtered = pref;
  } else if (wantOtherFloor) {
    const otherFloor = filtered.filter((n) => n.floor !== params.currentFloor);
    if (otherFloor.length > 0) filtered = otherFloor;
  }

  return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Picks nearby corridor / room-front nodes around a last-known position for the SEARCH state.
 */
export function pickSearchTargetNodes(params: {
  x: number;
  y: number;
  z: number;
  doorStates: Record<SpecialDoorKey, DoorAnimState>;
  count?: number;
  puzzleRoomProtected?: boolean;
}): NavNode[] {
  const floor = getFloorFromElevation(params.y);
  const protectedPuzzle = Boolean(params.puzzleRoomProtected);
  const candidates = nodesByFloor[floor].filter((n) => {
    if (n.kind === 'stair-landing') return false;
    if (n.roomId === SPECIAL_ROOMS_CONFIG.missionRoomId && n.kind === 'room-interior') {
      return params.doorStates.mission === 'open';
    }
    if (n.roomId === SPECIAL_ROOMS_CONFIG.puzzleRoomId && n.kind === 'room-interior') {
      return params.doorStates.puzzle === 'open' && !protectedPuzzle;
    }
    return true;
  });

  const sorted = [...candidates].sort(
    (a, b) => Math.hypot(a.x - params.x, a.z - params.z) - Math.hypot(b.x - params.x, b.z - params.z)
  );
  return sorted.slice(0, params.count ?? 4);
}
