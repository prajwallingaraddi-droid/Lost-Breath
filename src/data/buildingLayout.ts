import {
  ApartmentUnitStyle,
  DoorDefinition,
  DoorDesignation,
  FloorDefinition,
  FloorNumber,
  KeyCellDefinition,
  PipeRun,
  PropPlacement,
  PuzzleTerminalDefinition,
  RoomDefinition,
  SlabCutout,
  SpecialRoomConfig,
  StaircaseDefinition,
  WallSegment,
} from '../types/game';

// ============================================================================
// SQUARE COURTYARD APARTMENT COMPLEX DIMENSIONS (56m x 56m OUTER, 26m x 26m ATRIUM)
// ============================================================================
export const BUILDING_WIDTH = 56; // X: -28 to +28
export const BUILDING_DEPTH = 56; // Z: -28 to +28
export const COURTYARD_HALF = 13.0; // Hollow central atrium: X, Z in [-13.0, +13.0]
export const CORRIDOR_OUTER = 16.6; // Wrap-around corridor: 3.6m wide between 13.0 and 16.6
export const WING_SPAN_HALF = 13.5; // 5 apartments per wing across [-13.5, +13.5] (5.4m wide each), leaving open corner stairwell lobbies
export const FLOOR_HEIGHT = 4.5;
export const SLAB_THICKNESS = 0.24;
export const WALL_HEIGHT = FLOOR_HEIGHT - SLAB_THICKNESS; // 4.26m

export const FLOOR_ELEVATIONS: Record<FloorNumber, number> = {
  1: 0,
  2: FLOOR_HEIGHT,
  3: FLOOR_HEIGHT * 2,
  4: FLOOR_HEIGHT * 3,
};

// ============================================================================
// CANONICAL ROOM & ESCAPE LOCAL-FRAME TRANSFORM HELPERS (THREE.JS RIGHT-HANDED)
// ============================================================================
export interface RoomFrame {
  roomId: string;
  roomNumber: string;
  floor: FloorNumber;
  elevation: number;
  wing: RoomDefinition['wing'];
  centerX: number;
  centerZ: number;
  /** Y-rotation matching the room's corridor door: local +Z faces corridor, local -Z faces exterior wall. */
  rotY: number;
}

export interface EscapeFrame {
  floor: FloorNumber;
  elevation: number;
  wing: RoomDefinition['wing'];
  centerX: number;
  centerZ: number;
  /** Y-rotation matching the West-wing canonical escape frame (0 for West wing). */
  rotY: number;
}

export interface WorldBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// ============================================================================
// EXTERIOR CITY STREET, COMPOUND PERIMETER & MAIN BUILDING ENTRANCE CONSTANTS
// ============================================================================
export const MAIN_ENTRANCE_POS: [number, number, number] = [-20.5, 0, 28.0];
export const MAIN_ENTRANCE_WIDTH = 3.2;
export const COMPOUND_GATE_POS: [number, number, number] = [-20.5, 0, 46.0];
export const COMPOUND_GATE_WIDTH = 4.4;
export const COMPOUND_BOUNDS = {
  minX: -46.0,
  maxX: 46.0,
  minZ: -46.0,
  maxZ: 46.0,
} as const;
export const EXTERIOR_PLAYER_SPAWN: [number, number, number] = [-20.5, 0, 74.0];
export const LOBBY_RESPAWN_POS: [number, number, number] = [-20.5, 0, 23.2];

export const EXTERIOR_STATUE_POSITIONS: ReadonlyArray<{
  x: number;
  z: number;
  rotY: number;
  scale: number;
  pose: 'robed' | 'scholar' | 'sentinel';
}> = [
  { x: -13.2, z: 56.8, rotY: -Math.PI * 0.65, scale: 1.05, pose: 'robed' },
  { x: -13.2, z: 71.2, rotY: -Math.PI * 0.55, scale: 1.0, pose: 'sentinel' },
  { x: -28.6, z: 61.5, rotY: Math.PI * 0.58, scale: 1.08, pose: 'scholar' },
  { x: -28.6, z: 79.4, rotY: Math.PI * 0.45, scale: 0.96, pose: 'robed' },
];

export const EXTERIOR_HERO_TREES: ReadonlyArray<{
  x: number;
  z: number;
  scale: number;
  rotY: number;
  trunkRadius: number;
}> = [
  // Street sidewalk & median mature overgrown trees (kept clear of [-24, -17] driving/walking path)
  { x: -33.2, z: 52.5, scale: 1.25, rotY: 0.4, trunkRadius: 0.55 },
  { x: -33.8, z: 68.0, scale: 1.35, rotY: 1.8, trunkRadius: 0.6 },
  { x: -32.6, z: 83.2, scale: 1.18, rotY: 2.9, trunkRadius: 0.52 },
  { x: -5.8, z: 52.0, scale: 1.38, rotY: 0.9, trunkRadius: 0.6 },
  { x: -3.2, z: 65.5, scale: 1.28, rotY: 2.2, trunkRadius: 0.55 },
  { x: -6.4, z: 78.5, scale: 1.32, rotY: 4.1, trunkRadius: 0.58 },
  { x: -11.8, z: 84.5, scale: 1.12, rotY: 5.0, trunkRadius: 0.48 },
  // Inside compound yard trees (kept clear of SW entry walkway [-24..-17, 28..46] and Safe Room clearances)
  { x: -38.5, z: 38.5, scale: 1.18, rotY: 1.1, trunkRadius: 0.5 },
  { x: -39.2, z: 22.0, scale: 1.22, rotY: 3.4, trunkRadius: 0.52 },
  { x: -39.0, z: -26.5, scale: 1.26, rotY: 2.1, trunkRadius: 0.54 },
  { x: -28.5, z: -39.0, scale: 1.15, rotY: 0.7, trunkRadius: 0.48 },
  { x: 28.0, z: -38.8, scale: 1.24, rotY: 4.4, trunkRadius: 0.52 },
  { x: 39.2, z: -24.0, scale: 1.3, rotY: 1.7, trunkRadius: 0.55 },
  { x: 38.6, z: 26.0, scale: 1.2, rotY: 2.8, trunkRadius: 0.5 },
  { x: 34.5, z: 39.2, scale: 1.16, rotY: 5.2, trunkRadius: 0.48 },
  { x: -4.2, z: 38.8, scale: 1.14, rotY: 3.9, trunkRadius: 0.48 },
];

export const EXTERIOR_STATIC_COLLIDERS: WorldBox2D[] = [
  // Compound perimeter concrete walls (92m x 92m) with ONLY ONE opening at [-20.5, 46.0]
  { minX: -46.35, maxX: -45.65, minZ: -46.35, maxZ: 46.35 }, // West compound wall
  { minX: 45.65, maxX: 46.35, minZ: -46.35, maxZ: 46.35 },   // East compound wall
  { minX: -46.35, maxX: 46.35, minZ: -46.35, maxZ: -45.65 }, // North compound wall
  { minX: -46.35, maxX: -22.7, minZ: 45.65, maxZ: 46.35 },   // South-West compound wall (left of single gate)
  { minX: -18.3, maxX: 46.35, minZ: 45.65, maxZ: 46.35 },    // South-East compound wall (right of single gate)
  // Gate pillars
  { minX: -23.5, maxX: -22.55, minZ: 45.35, maxZ: 46.65 },
  { minX: -18.45, maxX: -17.5, minZ: 45.35, maxZ: 46.65 },
  // Explorable City Boulevard outer building facades & street end barricade
  { minX: -68.0, maxX: -36.4, minZ: 46.0, maxZ: 96.0 }, // West urban block
  { minX: 3.4, maxX: 52.0, minZ: 46.0, maxZ: 96.0 },    // East urban block
  { minX: -38.0, maxX: 5.0, minZ: 89.5, maxZ: 96.0 },   // South street rubble barricade
  // Statue pedestals
  ...EXTERIOR_STATUE_POSITIONS.map((s) => ({
    minX: s.x - 0.72,
    maxX: s.x + 0.72,
    minZ: s.z - 0.72,
    maxZ: s.z + 0.72,
  })),
  // Mature exterior tree trunks
  ...EXTERIOR_HERO_TREES.map((t) => ({
    minX: t.x - t.trunkRadius,
    maxX: t.x + t.trunkRadius,
    minZ: t.z - t.trunkRadius,
    maxZ: t.z + t.trunkRadius,
  })),
];

export interface ActiveRoomAssignment {
  missionRoomId: string;
  missionFloor: FloorNumber;
  missionDoorId: string;
  missionRoomNumber: string;
  puzzleRoomId: string;
  puzzleFloor: FloorNumber;
  puzzleDoorId: string;
  puzzleRoomNumber: string;
  finalExitRoomId: string;
  finalExitFloor: FloorNumber;
  finalExitDoorId: string;
  finalExitRoomNumber: string;
}

export function getWingDoorRotationY(wing: RoomDefinition['wing']): number {
  switch (wing) {
    case 'north':
      return 0;
    case 'east':
      return -Math.PI / 2;
    case 'south':
      return Math.PI;
    case 'west':
      return Math.PI / 2;
  }
}

/**
 * Three.js right-handed Y-rotation local->world transform:
 * x' = cx + lx * cos(rotY) + lz * sin(rotY)
 * z' = cz - lx * sin(rotY) + lz * cos(rotY)
 */
export function frameLocalToWorld(
  lx: number,
  lz: number,
  frame: { centerX: number; centerZ: number; rotY: number }
): [number, number] {
  const cos = Math.cos(frame.rotY);
  const sin = Math.sin(frame.rotY);
  return [
    Number((frame.centerX + lx * cos + lz * sin).toFixed(4)),
    Number((frame.centerZ - lx * sin + lz * cos).toFixed(4)),
  ];
}

/**
 * Exact inverse world->local transform for Three.js right-handed Y-rotation.
 */
export function worldToFrameLocal(
  wx: number,
  wz: number,
  frame: { centerX: number; centerZ: number; rotY: number }
): { lx: number; lz: number } {
  const dx = wx - frame.centerX;
  const dz = wz - frame.centerZ;
  const cos = Math.cos(frame.rotY);
  const sin = Math.sin(frame.rotY);
  return {
    lx: dx * cos - dz * sin,
    lz: dx * sin + dz * cos,
  };
}

export function frameLocalBoxToWorldAABB(
  lx1: number,
  lz1: number,
  lx2: number,
  lz2: number,
  frame: { centerX: number; centerZ: number; rotY: number }
): WorldBox2D {
  const [x1, z1] = frameLocalToWorld(lx1, lz1, frame);
  const [x2, z2] = frameLocalToWorld(lx2, lz2, frame);
  return {
    minX: Math.min(x1, x2),
    maxX: Math.max(x1, x2),
    minZ: Math.min(z1, z2),
    maxZ: Math.max(z1, z2),
  };
}

export const roomLocalToWorld = frameLocalToWorld;
export const worldToRoomLocal = worldToFrameLocal;
export const localBoxToWorldAABB = frameLocalBoxToWorldAABB;

export const escapeLocalToWorld = frameLocalToWorld;
export const worldToEscapeLocal = worldToFrameLocal;
export const escapeLocalBoxToWorldAABB = frameLocalBoxToWorldAABB;

// ============================================================================
// STATIC STRUCTURAL GEOMETRY (COURTYARD & CORNER STAIRWELLS — NEVER OVERLAPPED)
// ============================================================================
const COURTYARD_CUTOUT: SlabCutout = {
  minX: -COURTYARD_HALF,
  maxX: COURTYARD_HALF,
  minZ: -COURTYARD_HALF,
  maxZ: COURTYARD_HALF,
  kind: 'courtyard',
};

const STAIRWELL_CUTOUTS: SlabCutout[] = [
  // NW corner stairwell shaft (origin [-22.3, y, -22.3])
  { minX: -24.5, maxX: -20.1, minZ: -25.6, maxZ: -20.1, kind: 'stairwell' },
  // SE corner stairwell shaft (origin [22.3, y, 22.3])
  { minX: 20.1, maxX: 24.5, minZ: 20.1, maxZ: 25.6, kind: 'stairwell' },
];

export const BUILDING_STAIRCASES: StaircaseDefinition[] = [
  { id: 'stair-nw-1-2', label: 'North-West Stairwell 1→2', fromFloor: 1, toFloor: 2, origin: [-22.3, 0, -22.3], rotationY: 0, width: 3.6, runLength: 4.8 },
  { id: 'stair-nw-2-3', label: 'North-West Stairwell 2→3', fromFloor: 2, toFloor: 3, origin: [-22.3, FLOOR_HEIGHT, -22.3], rotationY: 0, width: 3.6, runLength: 4.8 },
  { id: 'stair-nw-3-4', label: 'North-West Stairwell 3→4', fromFloor: 3, toFloor: 4, origin: [-22.3, FLOOR_HEIGHT * 2, -22.3], rotationY: 0, width: 3.6, runLength: 4.8 },

  { id: 'stair-se-1-2', label: 'South-East Stairwell 1→2', fromFloor: 1, toFloor: 2, origin: [22.3, 0, 22.3], rotationY: Math.PI, width: 3.6, runLength: 4.8 },
  { id: 'stair-se-2-3', label: 'South-East Stairwell 2→3', fromFloor: 2, toFloor: 3, origin: [22.3, FLOOR_HEIGHT, 22.3], rotationY: Math.PI, width: 3.6, runLength: 4.8 },
  { id: 'stair-se-3-4', label: 'South-East Stairwell 3→4', fromFloor: 3, toFloor: 4, origin: [22.3, FLOOR_HEIGHT * 2, 22.3], rotationY: Math.PI, width: 3.6, runLength: 4.8 },
];

// ============================================================================
// DYNAMIC SPECIAL ROOM CONFIGURATION (MUTATED IN-PLACE ON NEW GAME ASSIGNMENT)
// ============================================================================
export const SPECIAL_ROOMS_CONFIG: SpecialRoomConfig = {
  missionRoomId: 'f2-208',
  missionFloor: 2,
  missionDoorId: 'door-208',
  missionRoomNumber: '208',
  puzzleRoomId: 'f3-318',
  puzzleFloor: 3,
  puzzleDoorId: 'door-318',
  puzzleRoomNumber: '318',
  finalExitRoomId: 'f3-318',
  finalExitFloor: 3,
  finalExitDoorId: 'door-final-exit',
  finalExitRoomNumber: 'EXIT',
};

export const MISSION_ROOM_BOUNDS = {
  floor: 2 as FloorNumber,
  elevation: FLOOR_ELEVATIONS[2],
  minX: 16.9,
  maxX: 27.7,
  minZ: -2.55,
  maxZ: 2.55,
  centerX: 22.3,
  centerZ: 0.0,
};

export const MISSION_KEY_CELLS: KeyCellDefinition[] = [];

export const PUZZLE_CHAMBER_BOUNDS = {
  floor: 3 as FloorNumber,
  elevation: FLOOR_ELEVATIONS[3],
  minX: -27.7,
  maxX: -16.9,
  minZ: -2.55,
  maxZ: 2.55,
  centerX: -22.3,
  centerZ: 0.0,
};

export const PUZZLE_TERMINALS: PuzzleTerminalDefinition[] = [];

export const FINAL_EXIT_PASSAGE = {
  floor: 3 as FloorNumber,
  elevation: FLOOR_ELEVATIONS[3],
  doorX: -28.0,
  doorZ: 0.0,
  passageEndX: -38.1,
  passageEndZ: 0.0,
  minZ: -2.4,
  maxZ: 2.4,
  centerZ: 0.0,
};

export const SAFE_ROOM_BOUNDS = {
  floor: 3 as FloorNumber,
  elevation: FLOOR_ELEVATIONS[3],
  minX: -34.0,
  maxX: -28.0,
  minZ: -2.4,
  maxZ: 2.4,
  centerX: -31.0,
  centerZ: 0.0,
};

export const EMERGENCY_DESCENT_STAIRCASES: StaircaseDefinition[] = [];

export const ESCAPE_TOWER_BOUNDS = {
  minX: -38.35,
  maxX: -34.0,
  minZ: -6.5,
  maxZ: 4.4,
  landingMinZ: -1.2,
  landingMaxZ: 2.4,
  groundMaxZ: 4.4,
  groundMaxX: -30.6,
};

export const GROUND_ESCAPE_ZONE = {
  floor: 1 as FloorNumber,
  elevation: FLOOR_ELEVATIONS[1],
  minX: -38.3,
  maxX: -30.6,
  minZ: 1.6,
  maxZ: 4.4,
  exitDoorX: -34.4,
  exitDoorZ: 4.35,
};

// ============================================================================
// 80-ROOM SQUARE APARTMENT COMPLEX CATALOG & LAYOUT GENERATOR
// ============================================================================
const WING_NAMES = [
  ['Residence', 'Residential suite with living area and kitchenette.'],
  ['Corner Flat', 'Lived-in apartment unit overlooking the exterior perimeter.'],
  ['Studio Suite', 'Compact studio apartment with utility riser access.'],
  ['Tenant Unit', 'Occupied residential flat with bedroom and desk.'],
  ['Maintenance Flat', 'Converted apartment containing building junction hardware.'],
] as const;

const FLOOR_META: Record<FloorNumber, { name: string; subtitle: string }> = {
  1: {
    name: 'Ground Courtyard & Lobby Level',
    subtitle: 'Floor 01 · Apts 101–120 · Hollow Atrium',
  },
  2: {
    name: 'Second Residence Gallery',
    subtitle: 'Floor 02 · Apts 201–220 · Courtyard Balconies',
  },
  3: {
    name: 'Third Residence Gallery',
    subtitle: 'Floor 03 · Apts 301–320 · Upper Atrium',
  },
  4: {
    name: 'Penthouse Residence Gallery',
    subtitle: 'Floor 04 · Apts 401–420 · Upper Deck',
  },
};

export interface BaseRoomDescriptor {
  id: string;
  code: string;
  doorId: string;
  floor: FloorNumber;
  elevation: number;
  idxInFloor: number;
  wing: RoomDefinition['wing'];
  bounds: RoomDefinition['bounds'];
  centerX: number;
  centerZ: number;
  doorPosition: [number, number, number];
  doorRotY: number;
}

function computeEdges(start: number, end: number, count: number): number[] {
  const step = (end - start) / count;
  const out: number[] = [];
  for (let i = 0; i <= count; i++) {
    out.push(Number((start + i * step).toFixed(3)));
  }
  return out;
}

function buildCanonicalRoomCatalog(): BaseRoomDescriptor[] {
  const catalog: BaseRoomDescriptor[] = [];
  const edgesPos = computeEdges(-WING_SPAN_HALF, WING_SPAN_HALF, 5);
  const edgesNeg = computeEdges(WING_SPAN_HALF, -WING_SPAN_HALF, 5);

  for (const floor of [1, 2, 3, 4] as FloorNumber[]) {
    const elevation = FLOOR_ELEVATIONS[floor];

    const pushDesc = (
      idxInFloor: number,
      wing: RoomDefinition['wing'],
      bounds: RoomDefinition['bounds'],
      doorPosition: [number, number, number]
    ) => {
      const code = `${floor}${String(idxInFloor).padStart(2, '0')}`;
      catalog.push({
        id: `f${floor}-${code}`,
        code,
        doorId: `door-${code}`,
        floor,
        elevation,
        idxInFloor,
        wing,
        bounds,
        centerX: Number(((bounds.minX + bounds.maxX) / 2).toFixed(3)),
        centerZ: Number(((bounds.minZ + bounds.maxZ) / 2).toFixed(3)),
        doorPosition,
        doorRotY: getWingDoorRotationY(wing),
      });
    };

    // North wing: X01..X05
    for (let i = 0; i < 5; i++) {
      const minX = edgesPos[i];
      const maxX = edgesPos[i + 1];
      const cx = Number(((minX + maxX) / 2).toFixed(3));
      pushDesc(i + 1, 'north', { minX, maxX, minZ: -28, maxZ: -CORRIDOR_OUTER }, [cx, elevation, -CORRIDOR_OUTER]);
    }
    // East wing: X06..X10
    for (let i = 0; i < 5; i++) {
      const minZ = edgesPos[i];
      const maxZ = edgesPos[i + 1];
      const cz = Number(((minZ + maxZ) / 2).toFixed(3));
      pushDesc(6 + i, 'east', { minX: CORRIDOR_OUTER, maxX: 28, minZ, maxZ }, [CORRIDOR_OUTER, elevation, cz]);
    }
    // South wing: X11..X15
    for (let i = 0; i < 5; i++) {
      const maxX = edgesNeg[i];
      const minX = edgesNeg[i + 1];
      const cx = Number(((minX + maxX) / 2).toFixed(3));
      pushDesc(11 + i, 'south', { minX, maxX, minZ: CORRIDOR_OUTER, maxZ: 28 }, [cx, elevation, CORRIDOR_OUTER]);
    }
    // West wing: X16..X20
    for (let i = 0; i < 5; i++) {
      const maxZ = edgesNeg[i];
      const minZ = edgesNeg[i + 1];
      const cz = Number(((minZ + maxZ) / 2).toFixed(3));
      pushDesc(16 + i, 'west', { minX: -28, maxX: -CORRIDOR_OUTER, minZ, maxZ }, [-CORRIDOR_OUTER, elevation, cz]);
    }
  }

  return catalog;
}

/**
 * All 80 numbered apartment rooms across Floors 1–4.
 * Stairwells, corridors, courtyard atrium, and exterior utility zones are strictly excluded.
 */
export const CANONICAL_ROOM_CATALOG: readonly BaseRoomDescriptor[] = buildCanonicalRoomCatalog();

const ROOM_DESC_BY_ID = new Map<string, BaseRoomDescriptor>(
  CANONICAL_ROOM_CATALOG.map((d) => [d.id, d])
);

/**
 * Returns all eligible numbered apartment rooms that can host the Mission Room or Puzzle Room.
 * Strictly excludes stairwells, corridors, Safe Rooms, and utility spaces.
 */
export function getEligibleSpecialRooms(): readonly BaseRoomDescriptor[] {
  return CANONICAL_ROOM_CATALOG;
}

function buildWallWithDoorAlongX(
  baseId: string,
  minX: number,
  maxX: number,
  z: number,
  doorCenterX: number,
  doorWidth: number,
  thickness = 0.26,
  isCorridorWall = true,
  isExterior = false,
  isFrontFacade = false
): WallSegment[] {
  const gapStart = doorCenterX - doorWidth / 2;
  const gapEnd = doorCenterX + doorWidth / 2;
  const segs: WallSegment[] = [];
  if (gapStart - minX > 0.08) {
    segs.push({
      id: `${baseId}-a`,
      x1: minX,
      z1: z,
      x2: gapStart,
      z2: z,
      thickness,
      isCorridorWall,
      isExterior,
      isFrontFacade,
    });
  }
  if (maxX - gapEnd > 0.08) {
    segs.push({
      id: `${baseId}-b`,
      x1: gapEnd,
      z1: z,
      x2: maxX,
      z2: z,
      thickness,
      isCorridorWall,
      isExterior,
      isFrontFacade,
    });
  }
  return segs;
}

function buildWallWithDoorAlongZ(
  baseId: string,
  x: number,
  minZ: number,
  maxZ: number,
  doorCenterZ: number,
  doorWidth: number,
  thickness = 0.26,
  isCorridorWall = true,
  isExterior = false
): WallSegment[] {
  const gapStart = doorCenterZ - doorWidth / 2;
  const gapEnd = doorCenterZ + doorWidth / 2;
  const segs: WallSegment[] = [];
  if (gapStart - minZ > 0.08) {
    segs.push({
      id: `${baseId}-a`,
      x1: x,
      z1: minZ,
      x2: x,
      z2: gapStart,
      thickness,
      isCorridorWall,
      isExterior,
    });
  }
  if (maxZ - gapEnd > 0.08) {
    segs.push({
      id: `${baseId}-b`,
      x1: x,
      z1: gapEnd,
      x2: x,
      z2: maxZ,
      thickness,
      isCorridorWall,
      isExterior,
    });
  }
  return segs;
}

function buildApartmentProps(
  roomId: string,
  wing: RoomDefinition['wing'],
  bounds: RoomDefinition['bounds'],
  elevation: number,
  styleIdx: number
): PropPlacement[] {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;

  let inX = 0;
  let inZ = 0;
  let sideX = 0;
  let sideZ = 0;
  let rotBase = 0;

  if (wing === 'north') {
    inZ = -1;
    sideX = 1;
    rotBase = 0;
  } else if (wing === 'east') {
    inX = 1;
    sideZ = 1;
    rotBase = -Math.PI / 2;
  } else if (wing === 'south') {
    inZ = 1;
    sideX = -1;
    rotBase = Math.PI;
  } else {
    inX = -1;
    sideZ = -1;
    rotBase = Math.PI / 2;
  }

  const place = (inOffset: number, sideOffset: number): [number, number, number] => [
    Number((cx + inX * inOffset + sideX * sideOffset).toFixed(2)),
    elevation,
    Number((cz + inZ * inOffset + sideZ * sideOffset).toFixed(2)),
  ];

  return [
    {
      id: `prop-${roomId}-main`,
      type: styleIdx % 2 === 0 ? 'sofa' : 'bed',
      position: place(2.5, -1.3),
      rotationY: rotBase,
    },
    {
      id: `prop-${roomId}-side`,
      type: styleIdx % 3 === 0 ? 'kitchen' : 'wardrobe',
      position: place(3.4, 1.45),
      rotationY: rotBase + Math.PI,
    },
    {
      id: `prop-${roomId}-table`,
      type: 'table',
      position: place(0.4, 1.45),
      rotationY: rotBase + Math.PI / 2,
    },
  ];
}

function buildFloorLayout(
  floor: FloorNumber,
  missionDesc: BaseRoomDescriptor,
  puzzleDesc: BaseRoomDescriptor
): FloorDefinition {
  const elevation = FLOOR_ELEVATIONS[floor];
  const meta = FLOOR_META[floor];
  const rooms: RoomDefinition[] = [];
  const doors: DoorDefinition[] = [];
  const props: PropPlacement[] = [];
  const walls: WallSegment[] = [];

  const isPuzzleFloor = floor === puzzleDesc.floor;
  const exitCutWidth = 2.5;

  // Exterior perimeter walls (56m x 56m). The Puzzle Room's exterior wall leaves a 2.5m doorway cutout for the Interior Safe Room Door.
  // North exterior wall (Z = -28)
  if (isPuzzleFloor && puzzleDesc.wing === 'north') {
    walls.push(
      ...buildWallWithDoorAlongX(
        `f${floor}-ext-n`,
        -28,
        28,
        -28,
        puzzleDesc.centerX,
        exitCutWidth,
        0.34,
        false,
        true,
        false
      )
    );
  } else {
    walls.push({ id: `f${floor}-ext-n`, x1: -28, z1: -28, x2: 28, z2: -28, thickness: 0.34, isExterior: true });
  }

  // East exterior wall (X = +28)
  if (isPuzzleFloor && puzzleDesc.wing === 'east') {
    walls.push(
      ...buildWallWithDoorAlongZ(
        `f${floor}-ext-e`,
        28,
        -28,
        28,
        puzzleDesc.centerZ,
        exitCutWidth,
        0.34,
        false,
        true
      )
    );
  } else {
    walls.push({ id: `f${floor}-ext-e`, x1: 28, z1: -28, x2: 28, z2: 28, thickness: 0.34, isExterior: true });
  }

  // South exterior wall (Z = +28, front cutaway facade; Floor 1 ALWAYS includes Main Industrial Entrance at X = -20.5)
  if (floor === 1) {
    walls.push(
      ...buildWallWithDoorAlongX(
        `f${floor}-ext-s-entry`,
        -28,
        -WING_SPAN_HALF,
        28,
        MAIN_ENTRANCE_POS[0],
        MAIN_ENTRANCE_WIDTH,
        0.34,
        false,
        true,
        true
      )
    );
    if (isPuzzleFloor && puzzleDesc.wing === 'south') {
      walls.push(
        ...buildWallWithDoorAlongX(
          `f${floor}-ext-s`,
          -WING_SPAN_HALF,
          28,
          28,
          puzzleDesc.centerX,
          exitCutWidth,
          0.34,
          false,
          true,
          true
        )
      );
    } else {
      walls.push({
        id: `f${floor}-ext-s`,
        x1: -WING_SPAN_HALF,
        z1: 28,
        x2: 28,
        z2: 28,
        thickness: 0.34,
        isExterior: true,
        isFrontFacade: true,
      });
    }
  } else if (isPuzzleFloor && puzzleDesc.wing === 'south') {
    walls.push(
      ...buildWallWithDoorAlongX(
        `f${floor}-ext-s`,
        -28,
        28,
        28,
        puzzleDesc.centerX,
        exitCutWidth,
        0.34,
        false,
        true,
        true
      )
    );
  } else {
    walls.push({
      id: `f${floor}-ext-s`,
      x1: -28,
      z1: 28,
      x2: 28,
      z2: 28,
      thickness: 0.34,
      isExterior: true,
      isFrontFacade: true,
    });
  }

  // West exterior wall (X = -28)
  if (isPuzzleFloor && puzzleDesc.wing === 'west') {
    walls.push(
      ...buildWallWithDoorAlongZ(
        `f${floor}-ext-w`,
        -28,
        -28,
        28,
        puzzleDesc.centerZ,
        exitCutWidth,
        0.34,
        false,
        true
      )
    );
  } else {
    walls.push({ id: `f${floor}-ext-w`, x1: -28, z1: -28, x2: -28, z2: 28, thickness: 0.34, isExterior: true });
  }

  // Wing end-cap walls enclosing the 4 apartment strips while keeping all 4 corner lobbies wide open
  walls.push(
    { id: `f${floor}-n-cap-w`, x1: -WING_SPAN_HALF, z1: -28, x2: -WING_SPAN_HALF, z2: -CORRIDOR_OUTER, thickness: 0.26 },
    { id: `f${floor}-n-cap-e`, x1: WING_SPAN_HALF, z1: -28, x2: WING_SPAN_HALF, z2: -CORRIDOR_OUTER, thickness: 0.26 },
    { id: `f${floor}-e-cap-n`, x1: CORRIDOR_OUTER, z1: -WING_SPAN_HALF, x2: 28, z2: -WING_SPAN_HALF, thickness: 0.26 },
    { id: `f${floor}-e-cap-s`, x1: CORRIDOR_OUTER, z1: WING_SPAN_HALF, x2: 28, z2: WING_SPAN_HALF, thickness: 0.26 },
    { id: `f${floor}-s-cap-e`, x1: WING_SPAN_HALF, z1: CORRIDOR_OUTER, x2: WING_SPAN_HALF, z2: 28, thickness: 0.26 },
    { id: `f${floor}-s-cap-w`, x1: -WING_SPAN_HALF, z1: CORRIDOR_OUTER, x2: -WING_SPAN_HALF, z2: 28, thickness: 0.26 },
    { id: `f${floor}-w-cap-s`, x1: -28, z1: WING_SPAN_HALF, x2: -CORRIDOR_OUTER, z2: WING_SPAN_HALF, thickness: 0.26 },
    { id: `f${floor}-w-cap-n`, x1: -28, z1: -WING_SPAN_HALF, x2: -CORRIDOR_OUTER, z2: -WING_SPAN_HALF, thickness: 0.26 }
  );

  const floorCatalog = CANONICAL_ROOM_CATALOG.filter((r) => r.floor === floor);
  const doorWidth = 1.9;

  for (const desc of floorCatalog) {
    const isMission = desc.id === missionDesc.id;
    const isPuzzle = desc.id === puzzleDesc.id;

    const designation: DoorDesignation = isMission
      ? 'mission-room'
      : isPuzzle
      ? 'puzzle-room'
      : 'apartment-unit';

    const tpl = WING_NAMES[(desc.idxInFloor - 1) % WING_NAMES.length];
    const unitStyle: ApartmentUnitStyle = isMission
      ? 'mission'
      : isPuzzle
      ? 'puzzle'
      : desc.idxInFloor % 3 === 0
      ? 'studio'
      : desc.idxInFloor % 2 === 0
      ? 'bedroom'
      : 'living';

    const category: RoomDefinition['category'] = isMission
      ? 'mission'
      : isPuzzle
      ? 'puzzle'
      : 'apartment';

    rooms.push({
      id: desc.id,
      name: isMission || isPuzzle ? `Apartment ${desc.code}` : `Apt ${desc.code} · ${tpl[0]}`,
      code: desc.code,
      floor,
      category,
      unitStyle,
      wing: desc.wing,
      bounds: desc.bounds,
      description: isMission
        ? 'Auxiliary building power & security control suite.'
        : isPuzzle
        ? 'Reinforced mainframe security puzzle suite with interior escape exit.'
        : tpl[1],
      accentColor: isMission ? '#f59e0b' : isPuzzle ? '#38bdf8' : '#94a3b8',
    });

    doors.push({
      id: desc.doorId,
      floor,
      roomNumber: desc.code,
      label: `Apt ${desc.code}`,
      doorType: isMission || isPuzzle ? 'locked' : 'standard',
      designation,
      position: desc.doorPosition,
      rotationY: desc.doorRotY,
      width: doorWidth,
      roomId: desc.id,
    });

    if (!isMission && !isPuzzle) {
      props.push(...buildApartmentProps(desc.id, desc.wing, desc.bounds, elevation, desc.idxInFloor));
    }

    // Partition and corridor doorway walls for each wing
    const idxInWing = (desc.idxInFloor - 1) % 5;
    if (desc.wing === 'north') {
      if (idxInWing < 4) {
        walls.push({ id: `f${floor}-n-part-${idxInWing}`, x1: desc.bounds.maxX, z1: -28, x2: desc.bounds.maxX, z2: -CORRIDOR_OUTER, thickness: 0.22 });
      }
      walls.push(...buildWallWithDoorAlongX(`f${floor}-n-cor-${idxInWing}`, desc.bounds.minX, desc.bounds.maxX, -CORRIDOR_OUTER, desc.centerX, doorWidth));
    } else if (desc.wing === 'east') {
      if (idxInWing < 4) {
        walls.push({ id: `f${floor}-e-part-${idxInWing}`, x1: CORRIDOR_OUTER, z1: desc.bounds.maxZ, x2: 28, z2: desc.bounds.maxZ, thickness: 0.22 });
      }
      walls.push(...buildWallWithDoorAlongZ(`f${floor}-e-cor-${idxInWing}`, CORRIDOR_OUTER, desc.bounds.minZ, desc.bounds.maxZ, desc.centerZ, doorWidth));
    } else if (desc.wing === 'south') {
      if (idxInWing < 4) {
        walls.push({ id: `f${floor}-s-part-${idxInWing}`, x1: desc.bounds.minX, z1: CORRIDOR_OUTER, x2: desc.bounds.minX, z2: 28, thickness: 0.22 });
      }
      walls.push(...buildWallWithDoorAlongX(`f${floor}-s-cor-${idxInWing}`, desc.bounds.minX, desc.bounds.maxX, CORRIDOR_OUTER, desc.centerX, doorWidth));
    } else {
      if (idxInWing < 4) {
        walls.push({ id: `f${floor}-w-part-${idxInWing}`, x1: -28, z1: desc.bounds.minZ, x2: -CORRIDOR_OUTER, z2: desc.bounds.minZ, thickness: 0.22 });
      }
      walls.push(...buildWallWithDoorAlongZ(`f${floor}-w-cor-${idxInWing}`, -CORRIDOR_OUTER, desc.bounds.minZ, desc.bounds.maxZ, desc.centerZ, doorWidth));
    }
  }

  // NE & SW corner utility benches + electrical distribution boxes
  props.push(
    { id: `prop-f${floor}-bench-ne`, type: 'bench', position: [19.8, elevation, -19.8], rotationY: Math.PI / 4 },
    { id: `prop-f${floor}-bench-sw`, type: 'bench', position: [-19.8, elevation, 19.8], rotationY: -Math.PI * 0.75 },
    { id: `prop-f${floor}-elec-ne`, type: 'elec-box', position: [27.55, elevation, -22.5], rotationY: -Math.PI / 2 },
    { id: `prop-f${floor}-elec-sw`, type: 'elec-box', position: [-27.55, elevation, 22.5], rotationY: Math.PI / 2 },
    { id: `prop-f${floor}-elec-nw`, type: 'elec-box', position: [-27.55, elevation, -18.5], rotationY: Math.PI / 2 },
    { id: `prop-f${floor}-elec-se`, type: 'elec-box', position: [27.55, elevation, 18.5], rotationY: -Math.PI / 2 }
  );

  // Add the distinct Interior Safe Room Door INSIDE the assigned Puzzle Room's exterior wall
  if (isPuzzleFloor) {
    const puzzleFrame = descriptorToRoomFrame(puzzleDesc);
    const [exitDoorX, exitDoorZ] = roomLocalToWorld(0, -5.7, puzzleFrame);
    doors.push({
      id: SPECIAL_ROOMS_CONFIG.finalExitDoorId,
      floor: puzzleDesc.floor,
      roomNumber: 'EXIT',
      label: 'Final Escape Door',
      doorType: 'exit',
      designation: 'final-exit',
      position: [exitDoorX, elevation, exitDoorZ],
      rotationY: puzzleFrame.rotY,
      width: 2.4,
      roomId: puzzleDesc.id,
      isInteriorEscape: true,
    });
  }

  // Overhead residential ceiling utility conduit loop
  const pipes: PipeRun[] = [
    {
      id: `pipe-f${floor}-loop-n`,
      variant: 'steam',
      radius: 0.08,
      points: [
        [-15.7, elevation + 3.85, -15.7],
        [15.7, elevation + 3.85, -15.7],
        [15.7, elevation + 3.85, 15.7],
        [-15.7, elevation + 3.85, 15.7],
        [-15.7, elevation + 3.85, -15.7],
      ],
    },
  ];

  return {
    floor,
    name: meta.name,
    subtitle: meta.subtitle,
    elevation,
    rooms,
    walls,
    doors,
    props,
    pipes,
    cutouts: floor === 1 ? [COURTYARD_CUTOUT] : [COURTYARD_CUTOUT, ...STAIRWELL_CUTOUTS],
  };
}

function descriptorToRoomFrame(desc: BaseRoomDescriptor): RoomFrame {
  return {
    roomId: desc.id,
    roomNumber: desc.code,
    floor: desc.floor,
    elevation: desc.elevation,
    wing: desc.wing,
    centerX: desc.centerX,
    centerZ: desc.centerZ,
    rotY: desc.doorRotY,
  };
}

function descriptorToEscapeFrame(desc: BaseRoomDescriptor): EscapeFrame {
  return {
    floor: desc.floor,
    elevation: desc.elevation,
    wing: desc.wing,
    centerX: desc.centerX,
    centerZ: desc.centerZ,
    rotY: desc.doorRotY - Math.PI / 2,
  };
}

export const BUILDING_FLOORS: FloorDefinition[] = [];
export const ALL_ROOMS: RoomDefinition[] = [];
export const ALL_DOORS: DoorDefinition[] = [];

let activeMissionFrame: RoomFrame = descriptorToRoomFrame(ROOM_DESC_BY_ID.get('f2-208')!);
let activePuzzleFrame: RoomFrame = descriptorToRoomFrame(ROOM_DESC_BY_ID.get('f3-318')!);
let activePuzzleEscapeFrame: EscapeFrame = descriptorToEscapeFrame(ROOM_DESC_BY_ID.get('f3-318')!);

type LayoutChangeListener = () => void;
const layoutListeners = new Set<LayoutChangeListener>();

/**
 * Registers a synchronous listener invoked whenever Mission/Puzzle room assignments change
 * (used by collision, navigation graph, and AI modules so caches never go stale).
 */
export function registerLayoutChangeListener(listener: LayoutChangeListener): () => void {
  layoutListeners.add(listener);
  return () => {
    layoutListeners.delete(listener);
  };
}

export function getActiveMissionFrame(): RoomFrame {
  return activeMissionFrame;
}

export function getActivePuzzleFrame(): RoomFrame {
  return activePuzzleFrame;
}

export function getActivePuzzleEscapeFrame(): EscapeFrame {
  return activePuzzleEscapeFrame;
}

export function getActiveRoomAssignment(): ActiveRoomAssignment {
  return { ...SPECIAL_ROOMS_CONFIG };
}

/**
 * Assigns specific eligible rooms as the Mission Room and Puzzle Room,
 * updates ALL bounds, key cells, puzzle terminals, Safe Room & Emergency Descent staircases,
 * rebuilds the 4-floor building geometry arrays in-place, and notifies collision/navigation listeners.
 */
export function assignSpecialRooms(
  missionRoomId: string,
  puzzleRoomId: string
): ActiveRoomAssignment {
  const missionDesc = ROOM_DESC_BY_ID.get(missionRoomId);
  const puzzleDesc = ROOM_DESC_BY_ID.get(puzzleRoomId);
  if (!missionDesc) {
    throw new Error(`Invalid Mission Room ID: ${missionRoomId}`);
  }
  if (!puzzleDesc) {
    throw new Error(`Invalid Puzzle Room ID: ${puzzleRoomId}`);
  }
  if (missionDesc.id === puzzleDesc.id) {
    throw new Error(`Mission Room and Puzzle Room must be different (${missionDesc.id})`);
  }

  activeMissionFrame = descriptorToRoomFrame(missionDesc);
  activePuzzleFrame = descriptorToRoomFrame(puzzleDesc);
  activePuzzleEscapeFrame = descriptorToEscapeFrame(puzzleDesc);

  // 1. Update SPECIAL_ROOMS_CONFIG in-place
  SPECIAL_ROOMS_CONFIG.missionRoomId = missionDesc.id;
  SPECIAL_ROOMS_CONFIG.missionFloor = missionDesc.floor;
  SPECIAL_ROOMS_CONFIG.missionDoorId = missionDesc.doorId;
  SPECIAL_ROOMS_CONFIG.missionRoomNumber = missionDesc.code;
  SPECIAL_ROOMS_CONFIG.puzzleRoomId = puzzleDesc.id;
  SPECIAL_ROOMS_CONFIG.puzzleFloor = puzzleDesc.floor;
  SPECIAL_ROOMS_CONFIG.puzzleDoorId = puzzleDesc.doorId;
  SPECIAL_ROOMS_CONFIG.puzzleRoomNumber = puzzleDesc.code;
  SPECIAL_ROOMS_CONFIG.finalExitRoomId = puzzleDesc.id;
  SPECIAL_ROOMS_CONFIG.finalExitFloor = puzzleDesc.floor;
  SPECIAL_ROOMS_CONFIG.finalExitDoorId = 'door-final-exit';
  SPECIAL_ROOMS_CONFIG.finalExitRoomNumber = 'EXIT';

  // 2. Update MISSION_ROOM_BOUNDS & MISSION_KEY_CELLS in-place
  const missionInnerBox = localBoxToWorldAABB(-2.55, -5.4, 2.55, 5.4, activeMissionFrame);
  MISSION_ROOM_BOUNDS.floor = missionDesc.floor;
  MISSION_ROOM_BOUNDS.elevation = missionDesc.elevation;
  MISSION_ROOM_BOUNDS.minX = missionInnerBox.minX;
  MISSION_ROOM_BOUNDS.maxX = missionInnerBox.maxX;
  MISSION_ROOM_BOUNDS.minZ = missionInnerBox.minZ;
  MISSION_ROOM_BOUNDS.maxZ = missionInnerBox.maxZ;
  MISSION_ROOM_BOUNDS.centerX = missionDesc.centerX;
  MISSION_ROOM_BOUNDS.centerZ = missionDesc.centerZ;

  const [cellAX, cellAZ] = roomLocalToWorld(-1.25, -4.75, activeMissionFrame);
  const [cellAKpX, cellAKpZ] = roomLocalToWorld(-1.25 + 0.48, -4.75 + 0.45, activeMissionFrame);
  const [cellAKeyX, cellAKeyZ] = roomLocalToWorld(-1.25, -4.73, activeMissionFrame);

  const [cellBX, cellBZ] = roomLocalToWorld(1.25, -4.75, activeMissionFrame);
  const [cellBKpX, cellBKpZ] = roomLocalToWorld(1.25 + 0.48, -4.75 + 0.45, activeMissionFrame);
  const [cellBKeyX, cellBKeyZ] = roomLocalToWorld(1.25, -4.73, activeMissionFrame);

  MISSION_KEY_CELLS.splice(
    0,
    MISSION_KEY_CELLS.length,
    {
      id: 'cell-a',
      label: 'Key Cell A',
      shortCode: 'CELL A',
      variant: 'real',
      position: [cellAX, missionDesc.elevation, cellAZ],
      keypadPosition: [cellAKpX, missionDesc.elevation + 1.25, cellAKpZ],
      keyPosition: [cellAKeyX, missionDesc.elevation + 1.08, cellAKeyZ],
      rotationY: activeMissionFrame.rotY,
    },
    {
      id: 'cell-b',
      label: 'Key Cell B',
      shortCode: 'CELL B',
      variant: 'false',
      position: [cellBX, missionDesc.elevation, cellBZ],
      keypadPosition: [cellBKpX, missionDesc.elevation + 1.25, cellBKpZ],
      keyPosition: [cellBKeyX, missionDesc.elevation + 1.08, cellBKeyZ],
      rotationY: activeMissionFrame.rotY,
    }
  );

  // 3. Update PUZZLE_CHAMBER_BOUNDS & PUZZLE_TERMINALS in-place
  const puzzleInnerBox = localBoxToWorldAABB(-2.55, -5.4, 2.55, 5.4, activePuzzleFrame);
  PUZZLE_CHAMBER_BOUNDS.floor = puzzleDesc.floor;
  PUZZLE_CHAMBER_BOUNDS.elevation = puzzleDesc.elevation;
  PUZZLE_CHAMBER_BOUNDS.minX = puzzleInnerBox.minX;
  PUZZLE_CHAMBER_BOUNDS.maxX = puzzleInnerBox.maxX;
  PUZZLE_CHAMBER_BOUNDS.minZ = puzzleInnerBox.minZ;
  PUZZLE_CHAMBER_BOUNDS.maxZ = puzzleInnerBox.maxZ;
  PUZZLE_CHAMBER_BOUNDS.centerX = puzzleDesc.centerX;
  PUZZLE_CHAMBER_BOUNDS.centerZ = puzzleDesc.centerZ;

  const [tCircX, tCircZ] = roomLocalToWorld(1.75, -2.3, activePuzzleFrame);
  const [tDiagX, tDiagZ] = roomLocalToWorld(1.75, 1.7, activePuzzleFrame);
  const [tKeyX, tKeyZ] = roomLocalToWorld(-1.75, -0.3, activePuzzleFrame);

  PUZZLE_TERMINALS.splice(
    0,
    PUZZLE_TERMINALS.length,
    {
      id: 'term-circuits',
      label: 'Electrical Circuit Breaker Panel',
      kind: 'circuits',
      position: [tCircX, puzzleDesc.elevation, tCircZ],
    },
    {
      id: 'term-diagnostic',
      label: 'Mainframe Telemetry Station',
      kind: 'diagnostic',
      position: [tDiagX, puzzleDesc.elevation, tDiagZ],
    },
    {
      id: 'term-keypad',
      label: 'Numeric Override Keypad',
      kind: 'keypad',
      position: [tKeyX, puzzleDesc.elevation, tKeyZ],
    }
  );

  // 4. Update Safe Room, Final Exit Passage, Emergency Descent Staircases, Tower & Ground Escape Zone
  const [exitDoorX, exitDoorZ] = escapeLocalToWorld(-5.7, 0.0, activePuzzleEscapeFrame);
  const [passageEndX, passageEndZ] = escapeLocalToWorld(-15.8, 0.0, activePuzzleEscapeFrame);
  const safeBox = escapeLocalBoxToWorldAABB(-11.7, -2.4, -5.7, 2.4, activePuzzleEscapeFrame);
  const [safeCenterX, safeCenterZ] = escapeLocalToWorld(-8.7, 0.0, activePuzzleEscapeFrame);
  const towerBox = escapeLocalBoxToWorldAABB(-16.05, -6.5, -11.7, 4.4, activePuzzleEscapeFrame);
  const groundZoneBox = escapeLocalBoxToWorldAABB(-16.0, 1.6, -8.3, 4.4, activePuzzleEscapeFrame);
  const [gExitX, gExitZ] = escapeLocalToWorld(-12.1, 4.35, activePuzzleEscapeFrame);

  FINAL_EXIT_PASSAGE.floor = puzzleDesc.floor;
  FINAL_EXIT_PASSAGE.elevation = puzzleDesc.elevation;
  FINAL_EXIT_PASSAGE.doorX = exitDoorX;
  FINAL_EXIT_PASSAGE.doorZ = exitDoorZ;
  FINAL_EXIT_PASSAGE.passageEndX = passageEndX;
  FINAL_EXIT_PASSAGE.passageEndZ = passageEndZ;
  FINAL_EXIT_PASSAGE.minZ = safeBox.minZ;
  FINAL_EXIT_PASSAGE.maxZ = safeBox.maxZ;
  FINAL_EXIT_PASSAGE.centerZ = exitDoorZ;

  SAFE_ROOM_BOUNDS.floor = puzzleDesc.floor;
  SAFE_ROOM_BOUNDS.elevation = puzzleDesc.elevation;
  SAFE_ROOM_BOUNDS.minX = safeBox.minX;
  SAFE_ROOM_BOUNDS.maxX = safeBox.maxX;
  SAFE_ROOM_BOUNDS.minZ = safeBox.minZ;
  SAFE_ROOM_BOUNDS.maxZ = safeBox.maxZ;
  SAFE_ROOM_BOUNDS.centerX = safeCenterX;
  SAFE_ROOM_BOUNDS.centerZ = safeCenterZ;

  // Generate physical descent flights from puzzleFloor down to Floor 1 (3 flights on F4, 2 on F3, 1 on F2, 0 on F1)
  const nextEscapeStairs: StaircaseDefinition[] = [];
  const [stairOriginX, stairOriginZ] = escapeLocalToWorld(-13.9, -3.4, activePuzzleEscapeFrame);
  for (let fromFl = puzzleDesc.floor - 1; fromFl >= 1; fromFl--) {
    const f = fromFl as FloorNumber;
    const toFl = (fromFl + 1) as FloorNumber;
    nextEscapeStairs.push({
      id: `stair-escape-${f}-${toFl}`,
      label: `Safe Room Emergency Descent ${toFl}→${f}`,
      fromFloor: f,
      toFloor: toFl,
      origin: [stairOriginX, FLOOR_ELEVATIONS[f], stairOriginZ],
      rotationY: activePuzzleEscapeFrame.rotY,
      width: 3.6,
      runLength: 4.8,
    });
  }
  EMERGENCY_DESCENT_STAIRCASES.splice(0, EMERGENCY_DESCENT_STAIRCASES.length, ...nextEscapeStairs);

  ESCAPE_TOWER_BOUNDS.minX = towerBox.minX;
  ESCAPE_TOWER_BOUNDS.maxX = towerBox.maxX;
  ESCAPE_TOWER_BOUNDS.minZ = towerBox.minZ;
  ESCAPE_TOWER_BOUNDS.maxZ = towerBox.maxZ;

  GROUND_ESCAPE_ZONE.floor = 1;
  GROUND_ESCAPE_ZONE.elevation = FLOOR_ELEVATIONS[1];
  GROUND_ESCAPE_ZONE.minX = groundZoneBox.minX;
  GROUND_ESCAPE_ZONE.maxX = groundZoneBox.maxX;
  GROUND_ESCAPE_ZONE.minZ = groundZoneBox.minZ;
  GROUND_ESCAPE_ZONE.maxZ = groundZoneBox.maxZ;
  GROUND_ESCAPE_ZONE.exitDoorX = gExitX;
  GROUND_ESCAPE_ZONE.exitDoorZ = gExitZ;

  // 5. Rebuild BUILDING_FLOORS, ALL_ROOMS, ALL_DOORS in-place (preserving exact 80-room count!)
  const nextFloors: FloorDefinition[] = ([1, 2, 3, 4] as FloorNumber[]).map((fl) =>
    buildFloorLayout(fl, missionDesc, puzzleDesc)
  );
  BUILDING_FLOORS.splice(0, BUILDING_FLOORS.length, ...nextFloors);

  const nextRooms = nextFloors.flatMap((f) => f.rooms);
  const nextDoors = nextFloors.flatMap((f) => f.doors);
  ALL_ROOMS.splice(0, ALL_ROOMS.length, ...nextRooms);
  ALL_DOORS.splice(0, ALL_DOORS.length, ...nextDoors);

  // 6. Synchronously notify collision & navigation listeners so all spatial graphs refresh immediately
  for (const listener of layoutListeners) {
    listener();
  }

  return getActiveRoomAssignment();
}

let lastRandomizedPair: { missionRoomId: string; puzzleRoomId: string } | null = null;

/**
 * Randomly selects two distinct eligible rooms across all 4 floors (80 rooms) to become
 * the Mission Room and Puzzle Room for a new game session.
 * Never picks the same room for both roles and avoids immediately repeating the previous session's
 * Mission Room / Puzzle Room combination when alternatives exist.
 */
export function randomizeSpecialRooms(
  previousPair?: { missionRoomId: string; puzzleRoomId: string } | null
): ActiveRoomAssignment {
  const eligible = getEligibleSpecialRooms();
  const avoid = previousPair ?? lastRandomizedPair;

  // Prefer picking fresh Mission & Puzzle rooms different from the immediately previous session
  let missionPool = avoid
    ? eligible.filter((r) => r.id !== avoid.missionRoomId)
    : [...eligible];
  if (missionPool.length === 0) missionPool = [...eligible];

  const chosenMission = missionPool[Math.floor(Math.random() * missionPool.length)];

  let puzzlePool = eligible.filter(
    (r) =>
      r.id !== chosenMission.id &&
      (!avoid || r.id !== avoid.puzzleRoomId)
  );
  if (puzzlePool.length === 0) {
    puzzlePool = eligible.filter((r) => r.id !== chosenMission.id);
  }

  const chosenPuzzle = puzzlePool[Math.floor(Math.random() * puzzlePool.length)];

  lastRandomizedPair = {
    missionRoomId: chosenMission.id,
    puzzleRoomId: chosenPuzzle.id,
  };

  return assignSpecialRooms(chosenMission.id, chosenPuzzle.id);
}

// Initialize default layout once at module load (f2-208 / f3-318); New Game & Restart randomize immediately.
assignSpecialRooms('f2-208', 'f3-318');

export function getRoomById(id: string | null): RoomDefinition | undefined {
  if (!id) return undefined;
  return ALL_ROOMS.find((r) => r.id === id);
}

/**
 * Reads the active Mission Room's number dynamically from room layout data (never hardcoded).
 */
export function getMissionRoomNumber(): string {
  const missionRoom = getRoomById(SPECIAL_ROOMS_CONFIG.missionRoomId);
  if (missionRoom?.code) return missionRoom.code;
  const missionDoor = ALL_DOORS.find((d) => d.id === SPECIAL_ROOMS_CONFIG.missionDoorId);
  return missionDoor?.roomNumber ?? SPECIAL_ROOMS_CONFIG.missionRoomNumber;
}

/**
 * Reads the active Puzzle Room's number dynamically from room layout data (never hardcoded).
 */
export function getPuzzleRoomNumber(): string {
  const puzzleRoom = getRoomById(SPECIAL_ROOMS_CONFIG.puzzleRoomId);
  if (puzzleRoom?.code) return puzzleRoom.code;
  const puzzleDoor = ALL_DOORS.find((d) => d.id === SPECIAL_ROOMS_CONFIG.puzzleDoorId);
  return puzzleDoor?.roomNumber ?? SPECIAL_ROOMS_CONFIG.puzzleRoomNumber;
}
