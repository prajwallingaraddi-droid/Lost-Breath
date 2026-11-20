import {
  BUILDING_FLOORS,
  BUILDING_STAIRCASES,
  COMPOUND_GATE_POS,
  COMPOUND_GATE_WIDTH,
  COURTYARD_HALF,
  EMERGENCY_DESCENT_STAIRCASES,
  escapeLocalBoxToWorldAABB,
  escapeLocalToWorld,
  EXTERIOR_STATIC_COLLIDERS,
  FLOOR_ELEVATIONS,
  getActiveMissionFrame,
  getActivePuzzleEscapeFrame,
  getActivePuzzleFrame,
  localBoxToWorldAABB,
  MAIN_ENTRANCE_POS,
  MAIN_ENTRANCE_WIDTH,
  MISSION_ROOM_BOUNDS,
  PUZZLE_CHAMBER_BOUNDS,
  registerLayoutChangeListener,
  roomLocalToWorld,
  SPECIAL_ROOMS_CONFIG,
  worldToEscapeLocal,
  worldToRoomLocal,
} from '../data/buildingLayout';
import { HIDING_SPOTS_BY_FLOOR } from '../data/hidingSpots';
import { DoorAnimState, FloorNumber, SpecialDoorKey } from '../types/game';
import {
  getFloorFromElevation,
  resolveSurfaceElevation,
  stairLocalToWorld,
} from './floorNavigation';

export const PLAYER_RADIUS = 0.4;
export const PLAYER_EYE_HEIGHT = 1.72;

export interface AABB2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface PrebakedDoorCollider {
  id: string;
  specialKey: SpecialDoorKey | null;
  box: AABB2D;
}

// 2D Spatial Hash Grid covering the 56x56m building footprint [-28, 28] in 4m cells (14x14 = 196 cells)
const GRID_MIN = -28.0;
const GRID_CELL_SIZE = 4.0;
const GRID_DIM = 14;
const GRID_TOTAL_CELLS = GRID_DIM * GRID_DIM;

interface FloorSpatialGrid {
  boxes: AABB2D[];
  cells: number[][];
}

function makeLocalBox(
  stair: (typeof BUILDING_STAIRCASES)[number],
  lx1: number,
  lz1: number,
  lx2: number,
  lz2: number
): AABB2D {
  const [wx1, wz1] = stairLocalToWorld(lx1, lz1, stair);
  const [wx2, wz2] = stairLocalToWorld(lx2, lz2, stair);
  return {
    minX: Math.min(wx1, wx2),
    maxX: Math.max(wx1, wx2),
    minZ: Math.min(wz1, wz2),
    maxZ: Math.max(wz1, wz2),
  };
}

function createEmptySpatialGrid(): FloorSpatialGrid {
  const cells: number[][] = new Array(GRID_TOTAL_CELLS);
  for (let i = 0; i < GRID_TOTAL_CELLS; i++) cells[i] = [];
  return { boxes: [], cells };
}

function clampGridCoord(val: number): number {
  const idx = Math.floor((val - GRID_MIN) / GRID_CELL_SIZE);
  if (idx < 0) return 0;
  if (idx >= GRID_DIM) return GRID_DIM - 1;
  return idx;
}

function insertBoxIntoGrid(grid: FloorSpatialGrid, box: AABB2D): void {
  const boxIndex = grid.boxes.length;
  grid.boxes.push(box);
  const minCx = clampGridCoord(box.minX);
  const maxCx = clampGridCoord(box.maxX);
  const minCz = clampGridCoord(box.minZ);
  const maxCz = clampGridCoord(box.maxZ);
  for (let cz = minCz; cz <= maxCz; cz++) {
    const rowOffset = cz * GRID_DIM;
    for (let cx = minCx; cx <= maxCx; cx++) {
      grid.cells[rowOffset + cx].push(boxIndex);
    }
  }
}

// Precompute static wall, apartment furniture & hiding structure AABBs per floor across all 80 rooms
const FLOOR_WALL_COLLIDERS: Record<FloorNumber, AABB2D[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
};

// Pure structural wall AABBs per floor (used for line-of-sight interaction & Beast vision checks)
export const FLOOR_PURE_WALLS: Record<FloorNumber, AABB2D[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
};

// Solid hiding structures per floor (also block Beast line of sight so Beasts cannot see through hiding spots)
export const FLOOR_HIDING_OCCLUDERS: Record<FloorNumber, AABB2D[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
};

// Pre-baked door AABBs per floor (eliminates per-frame Math.sin + object allocations)
const FLOOR_PREBAKED_DOORS: Record<FloorNumber, PrebakedDoorCollider[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
};

const FLOOR_SPECIAL_DOORS: Record<FloorNumber, PrebakedDoorCollider[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
};

// Spatial hash grid for movement (includes courtyard barrier + static walls + furniture + hiding spots + stair shafts + permanent closed doors + mission/puzzle obstacles)
const FLOOR_MOVE_GRID: Record<FloorNumber, FloorSpatialGrid> = {
  1: createEmptySpatialGrid(),
  2: createEmptySpatialGrid(),
  3: createEmptySpatialGrid(),
  4: createEmptySpatialGrid(),
};

// Spatial hash grid for camera obstructions (same as movement EXCEPT without COURTYARD_BARRIER so camera can look across atrium)
const FLOOR_CAMERA_GRID: Record<FloorNumber, FloorSpatialGrid> = {
  1: createEmptySpatialGrid(),
  2: createEmptySpatialGrid(),
  3: createEmptySpatialGrid(),
  4: createEmptySpatialGrid(),
};

// Hollow Central Courtyard safety railing barrier (prevents player & Beast from falling into [-13, 13])
const COURTYARD_BARRIER: AABB2D = {
  minX: -COURTYARD_HALF - 0.08,
  maxX: COURTYARD_HALF + 0.08,
  minZ: -COURTYARD_HALF - 0.08,
  maxZ: COURTYARD_HALF + 0.08,
};

// Static building stairwell shaft colliders (NW & SE shafts never move)
const STAIR_SHAFT_COLLIDERS: AABB2D[] = [];
const FLOOR4_SHAFT_DROP_GUARDS: AABB2D[] = [];

for (const stair of BUILDING_STAIRCASES) {
  if (stair.fromFloor !== 1) continue;
  STAIR_SHAFT_COLLIDERS.push(
    makeLocalBox(stair, -0.08, -0.85, 0.08, 2.2),
    makeLocalBox(stair, -2.2, -3.3, 2.2, -2.35),
    makeLocalBox(stair, -2.25, -3.3, -1.82, 3.3),
    makeLocalBox(stair, 1.82, -3.3, 2.25, 3.3)
  );
  FLOOR4_SHAFT_DROP_GUARDS.push(makeLocalBox(stair, -2.2, 3.15, 0.0, 3.45));
}

// Dynamic colliders rebuilt automatically whenever Mission Room / Puzzle Room assignment changes
let ESCAPE_STAIR_SHAFT_COLLIDERS: AABB2D[] = [];
let SAFE_ROOM_TOP_COLLIDERS: AABB2D[] = [];
let ESCAPE_TOWER_MID_COLLIDERS: AABB2D[] = [];
let ESCAPE_TOWER_FLOOR1_COLLIDERS: AABB2D[] = [];
let ESCAPE_TOWER_BACK_WALL: AABB2D = { minX: -38.65, maxX: -38.25, minZ: -6.8, maxZ: 4.75 };
let ESCAPE_TOWER_EXTERIOR_OBSTACLE: AABB2D = { minX: -44.3, maxX: -33.6, minZ: -6.8, maxZ: 4.7 };
let MISSION_ROOM_OBSTACLES: AABB2D[] = [];
let PUZZLE_CHAMBER_OBSTACLES: AABB2D[] = [];

export const COMPOUND_GATE_DOOR_BOX: AABB2D = {
  minX: COMPOUND_GATE_POS[0] - COMPOUND_GATE_WIDTH / 2 - 0.1,
  maxX: COMPOUND_GATE_POS[0] + COMPOUND_GATE_WIDTH / 2 + 0.1,
  minZ: COMPOUND_GATE_POS[2] - 0.28,
  maxZ: COMPOUND_GATE_POS[2] + 0.28,
};

export const MAIN_ENTRANCE_DOOR_BOX: AABB2D = {
  minX: MAIN_ENTRANCE_POS[0] - MAIN_ENTRANCE_WIDTH / 2 - 0.08,
  maxX: MAIN_ENTRANCE_POS[0] + MAIN_ENTRANCE_WIDTH / 2 + 0.08,
  minZ: MAIN_ENTRANCE_POS[2] - 0.26,
  maxZ: MAIN_ENTRANCE_POS[2] + 0.26,
};

// Mutated in-place so existing imports stay live across dynamic room reassignments
export const PUZZLE_PROTECTION_BARRIER_BOX: AABB2D = {
  minX: -17.0,
  maxX: -16.15,
  minZ: -2.7,
  maxZ: 2.7,
};

// Reusable zero-GC scratch buffers for spatial queries
let queryStamp = 0;
let visitedStamp = new Int32Array(512);
const scratchCandidates: AABB2D[] = [];

function ensureStampCapacity(size: number): void {
  if (visitedStamp.length < size) {
    visitedStamp = new Int32Array(Math.max(size, visitedStamp.length * 2));
  }
}

function nextQueryStamp(): number {
  queryStamp++;
  if (queryStamp >= 0x7ffffff0) {
    visitedStamp.fill(0);
    queryStamp = 1;
  }
  return queryStamp;
}

export function rebuildCollisionCache(): void {
  const missionFrame = getActiveMissionFrame();
  const escapeFrame = getActivePuzzleEscapeFrame();

  // Dynamic Mission Room key cell locker colliders
  MISSION_ROOM_OBSTACLES = [
    localBoxToWorldAABB(-1.89, -5.22, -0.61, -4.28, missionFrame), // Key Cell A locker
    localBoxToWorldAABB(0.61, -5.22, 1.89, -4.28, missionFrame), // Key Cell B locker
  ];

  // Dynamic Puzzle Room console & terminal colliders (in escapeFrame local space)
  PUZZLE_CHAMBER_OBSTACLES = [
    escapeLocalBoxToWorldAABB(-3.1, -2.35, -1.5, -1.15, escapeFrame), // term-circuits
    escapeLocalBoxToWorldAABB(0.2, -2.35, 3.2, -1.15, escapeFrame), // term-diagnostic
    escapeLocalBoxToWorldAABB(-1.05, 1.15, 0.45, 2.35, escapeFrame), // term-keypad
  ];

  // Dynamic Puzzle Room protection barrier across the assigned Puzzle Room's corridor doorway
  const barrierBox = escapeLocalBoxToWorldAABB(5.3, -2.7, 6.15, 2.7, escapeFrame);
  PUZZLE_PROTECTION_BARRIER_BOX.minX = barrierBox.minX;
  PUZZLE_PROTECTION_BARRIER_BOX.maxX = barrierBox.maxX;
  PUZZLE_PROTECTION_BARRIER_BOX.minZ = barrierBox.minZ;
  PUZZLE_PROTECTION_BARRIER_BOX.maxZ = barrierBox.maxZ;

  // Dynamic Emergency Descent shaft colliders (empty if Puzzle Room is on Floor 1)
  ESCAPE_STAIR_SHAFT_COLLIDERS = [];
  const escapeLowerStair = EMERGENCY_DESCENT_STAIRCASES.find((s) => s.fromFloor === 1);
  if (escapeLowerStair) {
    ESCAPE_STAIR_SHAFT_COLLIDERS.push(
      makeLocalBox(escapeLowerStair, -0.08, -0.85, 0.08, 2.2),
      makeLocalBox(escapeLowerStair, -2.25, -3.3, 2.25, -2.35),
      makeLocalBox(escapeLowerStair, -2.35, -3.3, -1.9, 3.3),
      makeLocalBox(escapeLowerStair, 1.9, -3.3, 2.35, 2.15)
    );
  }

  // Dynamic Safe Room & Emergency Descent enclosure walls
  if (escapeFrame.floor === 1) {
    ESCAPE_TOWER_BACK_WALL = escapeLocalBoxToWorldAABB(-16.35, -2.75, -15.95, 4.75, escapeFrame);
    SAFE_ROOM_TOP_COLLIDERS = [];
    ESCAPE_TOWER_MID_COLLIDERS = [];
    ESCAPE_TOWER_FLOOR1_COLLIDERS = [
      escapeLocalBoxToWorldAABB(-16.35, -2.75, -5.6, -2.35, escapeFrame),
      escapeLocalBoxToWorldAABB(-8.4, 2.35, -5.6, 2.75, escapeFrame),
      escapeLocalBoxToWorldAABB(-8.4, 2.35, -8.0, 4.75, escapeFrame),
      escapeLocalBoxToWorldAABB(-16.35, 4.35, -8.0, 4.75, escapeFrame),
      ESCAPE_TOWER_BACK_WALL,
    ];
  } else {
    ESCAPE_TOWER_BACK_WALL = escapeLocalBoxToWorldAABB(-16.35, -6.8, -15.95, 4.75, escapeFrame);
    SAFE_ROOM_TOP_COLLIDERS = [
      escapeLocalBoxToWorldAABB(-11.9, -2.75, -5.6, -2.35, escapeFrame),
      escapeLocalBoxToWorldAABB(-16.3, 2.35, -5.6, 2.75, escapeFrame),
      escapeLocalBoxToWorldAABB(-16.1, -1.4, -13.85, -1.0, escapeFrame),
    ];
    ESCAPE_TOWER_MID_COLLIDERS = [
      escapeLocalBoxToWorldAABB(-11.85, -1.4, -11.45, 2.75, escapeFrame),
      escapeLocalBoxToWorldAABB(-16.3, 2.35, -11.45, 2.75, escapeFrame),
    ];
    ESCAPE_TOWER_FLOOR1_COLLIDERS = [
      escapeLocalBoxToWorldAABB(-11.85, -1.4, -11.45, 1.2, escapeFrame),
      escapeLocalBoxToWorldAABB(-8.4, 1.0, -8.0, 4.7, escapeFrame),
      escapeLocalBoxToWorldAABB(-11.85, 1.0, -8.0, 1.35, escapeFrame),
      escapeLocalBoxToWorldAABB(-16.3, 4.35, -8.0, 4.75, escapeFrame),
      ESCAPE_TOWER_BACK_WALL,
    ];
  }

  ESCAPE_TOWER_EXTERIOR_OBSTACLE =
    escapeFrame.floor === 1
      ? escapeLocalBoxToWorldAABB(-16.3, -2.7, -5.6, 4.7, escapeFrame)
      : escapeLocalBoxToWorldAABB(-16.3, -6.7, -5.6, 4.7, escapeFrame);

  for (const floorData of BUILDING_FLOORS) {
    const fl = floorData.floor;
    const boxes: AABB2D[] = [];
    const wallBoxes: AABB2D[] = [];
    const moveGrid = createEmptySpatialGrid();
    const camGrid = createEmptySpatialGrid();

    for (const w of floorData.walls) {
      const halfThick = (w.thickness ?? 0.26) / 2;
      const box: AABB2D = {
        minX: Math.min(w.x1, w.x2) - halfThick,
        maxX: Math.max(w.x1, w.x2) + halfThick,
        minZ: Math.min(w.z1, w.z2) - halfThick,
        maxZ: Math.max(w.z1, w.z2) + halfThick,
      };
      boxes.push(box);
      wallBoxes.push(box);
      insertBoxIntoGrid(moveGrid, box);
      insertBoxIntoGrid(camGrid, box);
    }

    for (const prop of floorData.props) {
      const [px, , pz] = prop.position;
      let halfW = 0.7;
      let halfD = 0.6;
      if (prop.type === 'sofa' || prop.type === 'bed') {
        halfW = 0.95;
        halfD = 0.75;
      } else if (prop.type === 'kitchen' || prop.type === 'wardrobe') {
        halfW = 0.85;
        halfD = 0.45;
      } else if (prop.type === 'bench') {
        halfW = 0.75;
        halfD = 0.35;
      } else if (prop.type === 'elec-box') {
        halfW = 0.28;
        halfD = 0.28;
      }
      const pBox: AABB2D = {
        minX: px - halfW,
        maxX: px + halfW,
        minZ: pz - halfD,
        maxZ: pz + halfD,
      };
      boxes.push(pBox);
      insertBoxIntoGrid(moveGrid, pBox);
      insertBoxIntoGrid(camGrid, pBox);
    }

    const hidingBoxes: AABB2D[] = [];
    for (const spot of HIDING_SPOTS_BY_FLOOR[fl]) {
      const hBox: AABB2D = {
        minX: spot.colliderBox.minX,
        maxX: spot.colliderBox.maxX,
        minZ: spot.colliderBox.minZ,
        maxZ: spot.colliderBox.maxZ,
      };
      boxes.push(hBox);
      hidingBoxes.push(hBox);
      insertBoxIntoGrid(moveGrid, hBox);
      insertBoxIntoGrid(camGrid, hBox);
    }

    // Courtyard railing barrier goes into movement grid (not camera grid)
    insertBoxIntoGrid(moveGrid, COURTYARD_BARRIER);

    // Stairwell shafts go into both grids
    for (const sBox of STAIR_SHAFT_COLLIDERS) {
      insertBoxIntoGrid(moveGrid, sBox);
      insertBoxIntoGrid(camGrid, sBox);
    }

    if (fl === MISSION_ROOM_BOUNDS.floor) {
      for (const mBox of MISSION_ROOM_OBSTACLES) {
        insertBoxIntoGrid(moveGrid, mBox);
        insertBoxIntoGrid(camGrid, mBox);
      }
    }
    if (fl === PUZZLE_CHAMBER_BOUNDS.floor) {
      for (const pBox of PUZZLE_CHAMBER_OBSTACLES) {
        insertBoxIntoGrid(moveGrid, pBox);
        insertBoxIntoGrid(camGrid, pBox);
      }
    }

    // Pre-bake all door AABBs; permanently locked apartment doors are inserted directly into the spatial grids!
    const prebakedDoors: PrebakedDoorCollider[] = [];
    const specialDoors: PrebakedDoorCollider[] = [];
    for (const door of floorData.doors) {
      let specialKey: SpecialDoorKey | null = null;
      if (door.id === SPECIAL_ROOMS_CONFIG.missionDoorId) {
        specialKey = 'mission';
      } else if (door.id === SPECIAL_ROOMS_CONFIG.puzzleDoorId) {
        specialKey = 'puzzle';
      } else if (door.id === SPECIAL_ROOMS_CONFIG.finalExitDoorId) {
        specialKey = 'exit';
      }
      const halfW = door.width / 2 + 0.05;
      const halfD = 0.24;
      const [dx, , dz] = door.position;
      const isRotated90 = Math.abs(Math.sin(door.rotationY)) > 0.7;
      const dBox: AABB2D = {
        minX: dx - (isRotated90 ? halfD : halfW),
        maxX: dx + (isRotated90 ? halfD : halfW),
        minZ: dz - (isRotated90 ? halfW : halfD),
        maxZ: dz + (isRotated90 ? halfW : halfD),
      };
      const entry: PrebakedDoorCollider = { id: door.id, specialKey, box: dBox };
      prebakedDoors.push(entry);
      if (specialKey !== null) {
        specialDoors.push(entry);
      } else {
        insertBoxIntoGrid(moveGrid, dBox);
        insertBoxIntoGrid(camGrid, dBox);
      }
    }

    FLOOR_WALL_COLLIDERS[fl] = boxes;
    FLOOR_PURE_WALLS[fl] = wallBoxes;
    FLOOR_HIDING_OCCLUDERS[fl] = hidingBoxes;
    FLOOR_PREBAKED_DOORS[fl] = prebakedDoors;
    FLOOR_SPECIAL_DOORS[fl] = specialDoors;
    FLOOR_MOVE_GRID[fl] = moveGrid;
    FLOOR_CAMERA_GRID[fl] = camGrid;
    ensureStampCapacity(Math.max(moveGrid.boxes.length, camGrid.boxes.length));
  }
}

rebuildCollisionCache();
registerLayoutChangeListener(rebuildCollisionCache);

// Zero-GC circle-vs-AABB push-out into scratch point
const pushOutResult = { x: 0, z: 0 };

function pushOutCircleAABBInPlace(
  x: number,
  z: number,
  radius: number,
  radiusSq: number,
  box: AABB2D
): void {
  const closestX = x < box.minX ? box.minX : x > box.maxX ? box.maxX : x;
  const closestZ = z < box.minZ ? box.minZ : z > box.maxZ ? box.maxZ : z;
  const dx = x - closestX;
  const dz = z - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radiusSq) {
    pushOutResult.x = x;
    pushOutResult.z = z;
    return;
  }

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    pushOutResult.x = x + (dx / dist) * push;
    pushOutResult.z = z + (dz / dist) * push;
    return;
  }

  const leftPen = x - box.minX;
  const rightPen = box.maxX - x;
  const topPen = z - box.minZ;
  const bottomPen = box.maxZ - z;
  let minPen = leftPen;
  if (rightPen < minPen) minPen = rightPen;
  if (topPen < minPen) minPen = topPen;
  if (bottomPen < minPen) minPen = bottomPen;

  if (minPen === leftPen) {
    pushOutResult.x = box.minX - radius;
    pushOutResult.z = z;
  } else if (minPen === rightPen) {
    pushOutResult.x = box.maxX + radius;
    pushOutResult.z = z;
  } else if (minPen === topPen) {
    pushOutResult.x = x;
    pushOutResult.z = box.minZ - radius;
  } else {
    pushOutResult.x = x;
    pushOutResult.z = box.maxZ + radius;
  }
}

/**
 * Zero-allocation Liang-Barsky 2D segment-vs-AABB intersection with fast bounding-box reject.
 */
export function segmentIntersectsAABB(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  box: AABB2D
): boolean {
  // Fast AABB-vs-AABB early rejection (eliminates ~95% of tests with 4 float compares)
  if (x1 < x2) {
    if (x2 < box.minX || x1 > box.maxX) return false;
  } else {
    if (x1 < box.minX || x2 > box.maxX) return false;
  }
  if (z1 < z2) {
    if (z2 < box.minZ || z1 > box.maxZ) return false;
  } else {
    if (z1 < box.minZ || z2 > box.maxZ) return false;
  }

  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  // X slab
  if (dx > -1e-8 && dx < 1e-8) {
    if (x1 < box.minX || x1 > box.maxX) return false;
  } else {
    const invDx = 1 / dx;
    let tx1 = (box.minX - x1) * invDx;
    let tx2 = (box.maxX - x1) * invDx;
    if (tx1 > tx2) {
      const tmp = tx1;
      tx1 = tx2;
      tx2 = tmp;
    }
    if (tx1 > t0) t0 = tx1;
    if (tx2 < t1) t1 = tx2;
    if (t0 > t1) return false;
  }

  // Z slab
  if (dz > -1e-8 && dz < 1e-8) {
    if (z1 < box.minZ || z1 > box.maxZ) return false;
  } else {
    const invDz = 1 / dz;
    let tz1 = (box.minZ - z1) * invDz;
    let tz2 = (box.maxZ - z1) * invDz;
    if (tz1 > tz2) {
      const tmp = tz1;
      tz1 = tz2;
      tz2 = tmp;
    }
    if (tz1 > t0) t0 = tz1;
    if (tz2 < t1) t1 = tz2;
    if (t0 > t1) return false;
  }

  return t0 <= t1;
}

/**
 * Zero-allocation exact 2D ray-vs-AABB entry parameter t in [0, 1] along segment (x1,z1)->(x2,z2).
 * Returns null if the segment does not intersect the box.
 */
export function raycastAABB2D(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  box: AABB2D
): number | null {
  if (x1 < x2) {
    if (x2 < box.minX || x1 > box.maxX) return null;
  } else {
    if (x1 < box.minX || x2 > box.maxX) return null;
  }
  if (z1 < z2) {
    if (z2 < box.minZ || z1 > box.maxZ) return null;
  } else {
    if (z1 < box.minZ || z2 > box.maxZ) return null;
  }

  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dz = z2 - z1;

  if (dx > -1e-8 && dx < 1e-8) {
    if (x1 < box.minX || x1 > box.maxX) return null;
  } else {
    const invDx = 1 / dx;
    let tx1 = (box.minX - x1) * invDx;
    let tx2 = (box.maxX - x1) * invDx;
    if (tx1 > tx2) {
      const tmp = tx1;
      tx1 = tx2;
      tx2 = tmp;
    }
    if (tx1 > t0) t0 = tx1;
    if (tx2 < t1) t1 = tx2;
    if (t0 > t1) return null;
  }

  if (dz > -1e-8 && dz < 1e-8) {
    if (z1 < box.minZ || z1 > box.maxZ) return null;
  } else {
    const invDz = 1 / dz;
    let tz1 = (box.minZ - z1) * invDz;
    let tz2 = (box.maxZ - z1) * invDz;
    if (tz1 > tz2) {
      const tmp = tz1;
      tz1 = tz2;
      tz2 = tmp;
    }
    if (tz1 > t0) t0 = tz1;
    if (tz2 < t1) t1 = tz2;
    if (t0 > t1) return null;
  }

  return t0 <= t1 ? t0 : null;
}

/**
 * Zero-GC check whether a 2D segment intersects any closed door on a floor.
 */
export function segmentIntersectsClosedDoorOnFloor(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  floor: FloorNumber,
  doorStates: Record<SpecialDoorKey, DoorAnimState>
): boolean {
  const doors = FLOOR_PREBAKED_DOORS[floor];
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.specialKey !== null && doorStates[d.specialKey] === 'open') continue;
    if (segmentIntersectsAABB(x1, z1, x2, z2, d.box)) return true;
  }
  return false;
}

/**
 * Zero-GC spatial-grid raycast against all camera obstructions on the active floor.
 * Returns the closest hit parameter t in [0, maxT], or maxT if unobstructed.
 */
export function raycastCameraObstructionsOnFloor(
  floor: FloorNumber,
  feetY: number,
  doorStates: Record<SpecialDoorKey, DoorAnimState>,
  inExteriorEscapeZone: boolean,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  maxT: number
): number {
  let bestT = maxT;

  if (inExteriorEscapeZone) {
    const escapeFrame = getActivePuzzleEscapeFrame();
    for (let i = 0; i < ESCAPE_STAIR_SHAFT_COLLIDERS.length; i++) {
      const hit = raycastAABB2D(x1, z1, x2, z2, ESCAPE_STAIR_SHAFT_COLLIDERS[i]);
      if (hit !== null && hit < bestT) bestT = hit;
    }
    if (escapeFrame.floor === 1) {
      for (let i = 0; i < ESCAPE_TOWER_FLOOR1_COLLIDERS.length; i++) {
        const hit = raycastAABB2D(x1, z1, x2, z2, ESCAPE_TOWER_FLOOR1_COLLIDERS[i]);
        if (hit !== null && hit < bestT) bestT = hit;
      }
    } else {
      const topElev = FLOOR_ELEVATIONS[escapeFrame.floor];
      const extra =
        feetY >= topElev - 1.2
          ? SAFE_ROOM_TOP_COLLIDERS
          : feetY < 1.6
            ? ESCAPE_TOWER_FLOOR1_COLLIDERS
            : Math.abs(feetY - FLOOR_ELEVATIONS[floor]) <= 1.25
              ? ESCAPE_TOWER_MID_COLLIDERS
              : null;
      if (extra) {
        for (let i = 0; i < extra.length; i++) {
          const hit = raycastAABB2D(x1, z1, x2, z2, extra[i]);
          if (hit !== null && hit < bestT) bestT = hit;
        }
      }
      const backHit = raycastAABB2D(x1, z1, x2, z2, ESCAPE_TOWER_BACK_WALL);
      if (backHit !== null && backHit < bestT) bestT = backHit;
    }
    return bestT;
  }

  const grid = FLOOR_CAMERA_GRID[floor];
  const minX = x1 < x2 ? x1 : x2;
  const maxX = x1 > x2 ? x1 : x2;
  const minZ = z1 < z2 ? z1 : z2;
  const maxZ = z1 > z2 ? z1 : z2;

  const minCx = clampGridCoord(minX);
  const maxCx = clampGridCoord(maxX);
  const minCz = clampGridCoord(minZ);
  const maxCz = clampGridCoord(maxZ);

  const stamp = nextQueryStamp();
  const boxes = grid.boxes;
  const cells = grid.cells;

  for (let cz = minCz; cz <= maxCz; cz++) {
    const rowOffset = cz * GRID_DIM;
    for (let cx = minCx; cx <= maxCx; cx++) {
      const bucket = cells[rowOffset + cx];
      for (let i = 0; i < bucket.length; i++) {
        const idx = bucket[i];
        if (visitedStamp[idx] === stamp) continue;
        visitedStamp[idx] = stamp;
        const hit = raycastAABB2D(x1, z1, x2, z2, boxes[idx]);
        if (hit !== null && hit < bestT) bestT = hit;
      }
    }
  }

  // Check the 0–2 special doors on this floor
  const specialDoors = FLOOR_SPECIAL_DOORS[floor];
  for (let i = 0; i < specialDoors.length; i++) {
    const d = specialDoors[i];
    if (d.specialKey !== null && doorStates[d.specialKey] === 'open') continue;
    const hit = raycastAABB2D(x1, z1, x2, z2, d.box);
    if (hit !== null && hit < bestT) bestT = hit;
  }

  return bestT;
}

/**
 * Zero-GC camera raycast against compound perimeter walls, gate, main building entrance,
 * and exterior city street obstructions.
 */
export function raycastExteriorCameraObstructions(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  maxT: number,
  compoundGateOpen: boolean,
  mainEntranceOpen: boolean
): number {
  let bestT = maxT;
  for (let i = 0; i < EXTERIOR_STATIC_COLLIDERS.length; i++) {
    const hit = raycastAABB2D(x1, z1, x2, z2, EXTERIOR_STATIC_COLLIDERS[i]);
    if (hit !== null && hit < bestT) bestT = hit;
  }
  const escapeHit = raycastAABB2D(x1, z1, x2, z2, ESCAPE_TOWER_EXTERIOR_OBSTACLE);
  if (escapeHit !== null && escapeHit < bestT) bestT = escapeHit;

  if (!compoundGateOpen) {
    const gateHit = raycastAABB2D(x1, z1, x2, z2, COMPOUND_GATE_DOOR_BOX);
    if (gateHit !== null && gateHit < bestT) bestT = gateHit;
  }
  if (!mainEntranceOpen) {
    const doorHit = raycastAABB2D(x1, z1, x2, z2, MAIN_ENTRANCE_DOOR_BOX);
    if (doorHit !== null && doorHit < bestT) bestT = doorHit;
  }
  return bestT;
}

/**
 * Returns all solid walls, closed doors, furniture, hiding structures, stairwell shafts,
 * and Mission/Puzzle room obstacles on the active floor for third-person camera collision.
 */
export function getCameraObstructionBoxesOnFloor(
  floor: FloorNumber,
  feetY: number,
  doorStates: Record<SpecialDoorKey, DoorAnimState>,
  inExteriorEscapeZone: boolean
): AABB2D[] {
  const escapeFrame = getActivePuzzleEscapeFrame();
  const boxes: AABB2D[] = [];

  if (inExteriorEscapeZone) {
    boxes.push(...ESCAPE_STAIR_SHAFT_COLLIDERS);
    if (escapeFrame.floor === 1) {
      boxes.push(...ESCAPE_TOWER_FLOOR1_COLLIDERS);
    } else {
      const topElev = FLOOR_ELEVATIONS[escapeFrame.floor];
      if (feetY >= topElev - 1.2) {
        boxes.push(...SAFE_ROOM_TOP_COLLIDERS);
      } else if (feetY < 1.6) {
        boxes.push(...ESCAPE_TOWER_FLOOR1_COLLIDERS);
      } else if (Math.abs(feetY - FLOOR_ELEVATIONS[floor]) <= 1.25) {
        boxes.push(...ESCAPE_TOWER_MID_COLLIDERS);
      }
      boxes.push(ESCAPE_TOWER_BACK_WALL);
    }
    return boxes;
  }

  boxes.push(...FLOOR_WALL_COLLIDERS[floor]);
  boxes.push(...STAIR_SHAFT_COLLIDERS);

  if (floor === MISSION_ROOM_BOUNDS.floor) {
    boxes.push(...MISSION_ROOM_OBSTACLES);
  }
  if (floor === PUZZLE_CHAMBER_BOUNDS.floor) {
    boxes.push(...PUZZLE_CHAMBER_OBSTACLES);
  }

  boxes.push(...getClosedDoorCollidersOnFloor(floor, doorStates));
  return boxes;
}

export function getClosedDoorCollidersOnFloor(
  floor: FloorNumber,
  doorStates: Record<SpecialDoorKey, DoorAnimState>
): AABB2D[] {
  const doors = FLOOR_PREBAKED_DOORS[floor];
  const out: AABB2D[] = [];
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.specialKey !== null && doorStates[d.specialKey] === 'open') continue;
    out.push(d.box);
  }
  return out;
}

/**
 * Verifies clear line of sight on a floor so players cannot interact with doors or terminals through walls.
 */
export function hasLineOfSightOnFloor(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  floor: FloorNumber
): boolean {
  const walls = FLOOR_PURE_WALLS[floor];
  // Nudge target slightly short of wall plane (90% along segment) so door-plane intersection doesn't self-clip
  const endX = fromX + (toX - fromX) * 0.9;
  const endZ = fromZ + (toZ - fromZ) * 0.9;
  for (let i = 0; i < walls.length; i++) {
    if (segmentIntersectsAABB(fromX, fromZ, endX, endZ, walls[i])) {
      return false;
    }
  }
  return true;
}

export interface CollisionInput {
  x: number;
  z: number;
  feetY: number;
  radius?: number;
  doorStates: Record<SpecialDoorKey, DoorAnimState>;
  isBeast?: boolean;
  puzzleRoomProtected?: boolean;
  compoundGateOpen?: boolean;
  mainEntranceOpen?: boolean;
}

export function resolvePlayerMovement(input: CollisionInput): {
  x: number;
  z: number;
  feetY: number;
  floor: FloorNumber;
} {
  let x = input.x;
  let z = input.z;
  const radius = input.radius ?? PLAYER_RADIUS;
  const radiusSq = radius * radius;
  const nextFeetY = resolveSurfaceElevation(x, z, input.feetY);
  const floor = getFloorFromElevation(nextFeetY);

  const escapeFrame = getActivePuzzleEscapeFrame();
  const { lx: preEx, lz: preEz } = worldToEscapeLocal(x, z, escapeFrame);
  const inEscapeFootprint =
    preEx < -4.8 &&
    preEx > -16.6 &&
    (escapeFrame.floor === 1 ? preEz >= -2.9 && preEz <= 4.8 : preEz >= -6.9 && preEz <= 4.8);
  const outsideBuilding = Math.abs(x) > 27.45 || Math.abs(z) > 27.45;
  const inExteriorEscapeZone =
    !input.isBeast && outsideBuilding && input.doorStates.exit === 'open' && inEscapeFootprint;

  let candidateCount = 0;

  if (inExteriorEscapeZone) {
    for (let i = 0; i < ESCAPE_STAIR_SHAFT_COLLIDERS.length; i++) {
      scratchCandidates[candidateCount++] = ESCAPE_STAIR_SHAFT_COLLIDERS[i];
    }
    if (escapeFrame.floor === 1) {
      for (let i = 0; i < ESCAPE_TOWER_FLOOR1_COLLIDERS.length; i++) {
        scratchCandidates[candidateCount++] = ESCAPE_TOWER_FLOOR1_COLLIDERS[i];
      }
    } else {
      const topElev = FLOOR_ELEVATIONS[escapeFrame.floor];
      const extra =
        nextFeetY >= topElev - 1.2
          ? SAFE_ROOM_TOP_COLLIDERS
          : nextFeetY < 1.6
            ? ESCAPE_TOWER_FLOOR1_COLLIDERS
            : Math.abs(nextFeetY - FLOOR_ELEVATIONS[floor]) <= 1.25
              ? ESCAPE_TOWER_MID_COLLIDERS
              : null;
      if (extra) {
        for (let i = 0; i < extra.length; i++) {
          scratchCandidates[candidateCount++] = extra[i];
        }
      }
      scratchCandidates[candidateCount++] = ESCAPE_TOWER_BACK_WALL;
    }
  } else {
    const nearBuildingFootprint = Math.abs(x) <= 28.8 && Math.abs(z) <= 28.8;
    if (input.isBeast || nearBuildingFootprint) {
      // Spatial hash query: inspect colliders in the cells immediately surrounding (x, z)
      const grid = FLOOR_MOVE_GRID[floor];
      const queryR = radius + 0.65;
      const minCx = clampGridCoord(x - queryR);
      const maxCx = clampGridCoord(x + queryR);
      const minCz = clampGridCoord(z - queryR);
      const maxCz = clampGridCoord(z + queryR);

      const stamp = nextQueryStamp();
      const boxes = grid.boxes;
      const cells = grid.cells;

      for (let cz = minCz; cz <= maxCz; cz++) {
        const rowOffset = cz * GRID_DIM;
        for (let cx = minCx; cx <= maxCx; cx++) {
          const bucket = cells[rowOffset + cx];
          for (let i = 0; i < bucket.length; i++) {
            const idx = bucket[i];
            if (visitedStamp[idx] === stamp) continue;
            visitedStamp[idx] = stamp;
            scratchCandidates[candidateCount++] = boxes[idx];
          }
        }
      }

      if (floor === 4 && nextFeetY > 12.6) {
        for (let i = 0; i < FLOOR4_SHAFT_DROP_GUARDS.length; i++) {
          scratchCandidates[candidateCount++] = FLOOR4_SHAFT_DROP_GUARDS[i];
        }
      }

      // Hard gameplay barrier blocking all 4 Beasts from entering the Puzzle Room while protection is active
      if (input.isBeast && input.puzzleRoomProtected && floor === PUZZLE_CHAMBER_BOUNDS.floor) {
        scratchCandidates[candidateCount++] = PUZZLE_PROTECTION_BARRIER_BOX;
      }

      // Dynamic special doors on this floor (0–2 doors)
      const specialDoors = FLOOR_SPECIAL_DOORS[floor];
      for (let i = 0; i < specialDoors.length; i++) {
        const door = specialDoors[i];
        let isDoorOpen = false;
        if (door.specialKey === 'mission') {
          isDoorOpen = input.doorStates.mission === 'open';
        } else if (door.specialKey === 'puzzle') {
          isDoorOpen =
            input.doorStates.puzzle === 'open' &&
            !(input.isBeast && input.puzzleRoomProtected);
        } else if (door.specialKey === 'exit') {
          // Beasts can NEVER pass into the Safe Room / Emergency Descent
          isDoorOpen = !input.isBeast && input.doorStates.exit === 'open';
        }

        if (!isDoorOpen) {
          scratchCandidates[candidateCount++] = door.box;
        }
      }
    }

    // Main apartment building entrance door (closed blocks player; ALWAYS blocks Beasts inside!)
    if (floor === 1 && (input.isBeast || !input.mainEntranceOpen)) {
      scratchCandidates[candidateCount++] = MAIN_ENTRANCE_DOOR_BOX;
    }

    // Exterior compound walls, gate, city street facades, statues & tree trunks (Player outdoors/ground)
    if (!input.isBeast && floor === 1 && (outsideBuilding || z > 25.5)) {
      for (let i = 0; i < EXTERIOR_STATIC_COLLIDERS.length; i++) {
        scratchCandidates[candidateCount++] = EXTERIOR_STATIC_COLLIDERS[i];
      }
      scratchCandidates[candidateCount++] = ESCAPE_TOWER_EXTERIOR_OBSTACLE;
      if (!input.compoundGateOpen) {
        scratchCandidates[candidateCount++] = COMPOUND_GATE_DOOR_BOX;
      }
    }
  }

  // Smooth sliding resolution across walls, courtyard railing, props, hiding spots, exterior walls & gates
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < candidateCount; i++) {
      pushOutCircleAABBInPlace(x, z, radius, radiusSq, scratchCandidates[i]);
      x = pushOutResult.x;
      z = pushOutResult.z;
    }
  }

  // Absolute failsafe: while Puzzle Room protection is active, Beasts are strictly ejected out of the assigned Puzzle Room
  if (input.isBeast && input.puzzleRoomProtected && floor === PUZZLE_CHAMBER_BOUNDS.floor) {
    const puzzleFrame = getActivePuzzleFrame();
    const { lx, lz } = worldToRoomLocal(x, z, puzzleFrame);
    if (Math.abs(lx) <= 3.0 && lz < 6.2) {
      [x, z] = roomLocalToWorld(lx, 6.65, puzzleFrame);
    }
  }

  // Clamp inside 56x56m building footprint (Beasts & floors 2-4), Safe Room Escape Tower, OR Floor 1 compound/street bounds
  const { lx: ex, lz: ez } = worldToEscapeLocal(x, z, escapeFrame);
  const allowSafeRoomAndDescent =
    !input.isBeast &&
    input.doorStates.exit === 'open' &&
    ((ex < -4.2 && floor === escapeFrame.floor && ez >= -2.4 && ez <= 2.4) ||
      (ex < -5.15 && ez >= -6.5 && ez <= 4.4));

  if (allowSafeRoomAndDescent) {
    const minEz = escapeFrame.floor === 1 ? -2.25 : -6.35;
    const clampedEx = Math.max(-15.9, ex);
    const clampedEz = Math.max(minEz, Math.min(4.25, ez));
    [x, z] = escapeLocalToWorld(clampedEx, clampedEz, escapeFrame);
  } else if (input.isBeast || floor > 1) {
    x = Math.max(-27.4, Math.min(27.4, x));
    z = Math.max(-27.4, Math.min(27.4, z));
  } else {
    // Player on Floor 1: enclosed inside building (56x56) -> compound ([-45.6, 45.6]) -> South city boulevard
    if (z <= 46.0) {
      x = Math.max(-45.55, Math.min(45.55, x));
      z = Math.max(-45.55, z);
    } else {
      x = Math.max(-35.9, Math.min(2.9, x));
      z = Math.min(89.0, z);
    }
  }

  const groundedFeetY = resolveSurfaceElevation(x, z, input.feetY);
  const groundedFloor = getFloorFromElevation(groundedFeetY);

  return { x, z, feetY: groundedFeetY, floor: groundedFloor };
}
