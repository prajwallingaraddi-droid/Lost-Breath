import {
  BUILDING_FLOORS,
  BUILDING_STAIRCASES,
  CORRIDOR_OUTER,
  COURTYARD_HALF,
  EMERGENCY_DESCENT_STAIRCASES,
  FLOOR_ELEVATIONS,
  FLOOR_HEIGHT,
  getActivePuzzleEscapeFrame,
  worldToEscapeLocal,
} from '../data/buildingLayout';
import { FloorNumber, StaircaseDefinition } from '../types/game';

export interface FloorNavNode {
  floor: FloorNumber;
  stairId: string;
  waypoints: [number, number, number][];
}

const STEP_TOLERANCE = 1.35;
const CORRIDOR_MID = (COURTYARD_HALF + CORRIDOR_OUTER) / 2; // 14.8m ring centerline

function getAllStaircases(): StaircaseDefinition[] {
  return [...BUILDING_STAIRCASES, ...EMERGENCY_DESCENT_STAIRCASES];
}

const CORRIDOR_RING_CORNERS: [number, number][] = [
  [-CORRIDOR_MID, -CORRIDOR_MID], // 0: NW corner
  [CORRIDOR_MID, -CORRIDOR_MID], // 1: NE corner
  [CORRIDOR_MID, CORRIDOR_MID], // 2: SE corner
  [-CORRIDOR_MID, CORRIDOR_MID], // 3: SW corner
];

function getWingZone(x: number, z: number): number {
  if (Math.abs(z) >= Math.abs(x)) {
    return z < 0 ? 0 : 2; // 0 = North, 2 = South
  }
  return x > 0 ? 1 : 3; // 1 = East, 3 = West
}

/**
 * Computes courtyard-safe waypoints around the 14.8m corridor ring on a single floor
 * so the Beast AI never attempts to cut diagonally across the hollow central atrium.
 */
export function getCorridorPathOnFloor(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  floor: FloorNumber
): [number, number, number][] {
  const y = FLOOR_ELEVATIONS[floor];
  const clampX = Math.max(-24, Math.min(24, toX));
  const clampZ = Math.max(-24, Math.min(24, toZ));

  // Same wing or adjacent corner without crossing courtyard void: check midpoint safety
  const midX = (fromX + clampX) * 0.5;
  const midZ = (fromZ + clampZ) * 0.5;
  const crossesCourtyard =
    Math.abs(midX) < COURTYARD_HALF + 0.6 && Math.abs(midZ) < COURTYARD_HALF + 0.6;

  if (!crossesCourtyard) {
    return [[clampX, y, clampZ]];
  }

  // Pick shortest loop direction around the 4 corridor corners
  const startZone = getWingZone(fromX, fromZ);
  const endZone = getWingZone(clampX, clampZ);

  const cwCorners: [number, number, number][] = [];
  let idx = startZone;
  for (let step = 0; step < 4; step++) {
    const cornerIdx = (idx + 1) % 4;
    const [cx, cz] = CORRIDOR_RING_CORNERS[cornerIdx];
    cwCorners.push([cx, y, cz]);
    idx = cornerIdx;
    if (idx === endZone) break;
  }

  const ccwCorners: [number, number, number][] = [];
  idx = startZone;
  for (let step = 0; step < 4; step++) {
    const [cx, cz] = CORRIDOR_RING_CORNERS[idx];
    ccwCorners.push([cx, y, cz]);
    idx = (idx + 3) % 4;
    if (idx === endZone) {
      const [ex, ez] = CORRIDOR_RING_CORNERS[idx];
      ccwCorners.push([ex, y, ez]);
      break;
    }
  }

  const chosen = cwCorners.length <= ccwCorners.length ? cwCorners : ccwCorners;
  return [...chosen, [clampX, y, clampZ]];
}

/**
 * Checks whether (x, z) lies inside a courtyard or stairwell slab cutout on the given floor.
 */
export function isInsideFloorCutout(x: number, z: number, floor: FloorNumber): boolean {
  const floorData = BUILDING_FLOORS[floor - 1];
  for (const hole of floorData.cutouts) {
    if (x >= hole.minX && x <= hole.maxX && z >= hole.minZ && z <= hole.maxZ) {
      return true;
    }
  }
  return false;
}

/**
 * Converts world (x, z) into a staircase's local coordinates (matching Three.js right-handed rotationY).
 */
export function worldToStairLocal(
  x: number,
  z: number,
  stair: StaircaseDefinition
): { lx: number; lz: number } {
  const dx = x - stair.origin[0];
  const dz = z - stair.origin[2];
  const cos = Math.cos(stair.rotationY);
  const sin = Math.sin(stair.rotationY);
  return {
    lx: dx * cos - dz * sin,
    lz: dx * sin + dz * cos,
  };
}

/**
 * Converts staircase local (lx, lz) back to world (x, z) (matching Three.js right-handed rotationY).
 */
export function stairLocalToWorld(
  lx: number,
  lz: number,
  stair: StaircaseDefinition
): [number, number] {
  const cos = Math.cos(stair.rotationY);
  const sin = Math.sin(stair.rotationY);
  return [
    stair.origin[0] + lx * cos + lz * sin,
    stair.origin[2] - lx * sin + lz * cos,
  ];
}

/**
 * Computes exact surface elevation on a specific staircase at (x, z), or null if outside shaft.
 */
export function getStaircaseElevationAt(
  x: number,
  z: number,
  stair: StaircaseDefinition
): number | null {
  const { lx, lz } = worldToStairLocal(x, z, stair);

  if (lx < -2.1 || lx > 2.1 || lz < -3.1 || lz > 3.35) {
    return null;
  }

  const baseY = FLOOR_ELEVATIONS[stair.fromFloor];
  const halfRise = FLOOR_HEIGHT / 2;

  if (lz <= -1.0) {
    return baseY + halfRise;
  }

  if (lx < 0) {
    if (lz >= 2.2) return baseY;
    const t = Math.max(0, Math.min(1, (2.2 - lz) / 3.2));
    return baseY + t * halfRise;
  }

  if (lz >= 2.2) return baseY + FLOOR_HEIGHT;
  const t = Math.max(0, Math.min(1, (lz + 1.0) / 3.2));
  return baseY + halfRise + t * halfRise;
}

function isUnderLowerStairFlightOrLanding(
  x: number,
  z: number,
  currentFeetY: number
): boolean {
  for (const stair of getAllStaircases()) {
    if (stair.fromFloor !== 1) continue;
    const { lx, lz } = worldToStairLocal(x, z, stair);
    if (lx >= -2.1 && lx <= 2.1 && lz >= -2.7 && lz < 2.2) {
      if (lx < 0 || (lz <= -1.0 && currentFeetY >= 0.8)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Reusable 4-floor + Dynamic Safe Room Emergency Descent surface elevation solver for Player & Beasts.
 */
export function resolveSurfaceElevation(
  x: number,
  z: number,
  currentFeetY: number
): number {
  const candidates: number[] = [];
  const blockFloor1Base = isUnderLowerStairFlightOrLanding(x, z, currentFeetY);
  const outsideBuilding = Math.abs(x) > 27.95 || Math.abs(z) > 27.95;

  // Exterior Safe Room + Continuous Emergency Descent Stairwell Tower (attached to whichever room/wing/floor is Puzzle Room)
  if (outsideBuilding) {
    const escapeFrame = getActivePuzzleEscapeFrame();
    const { lx: ex, lz: ez } = worldToEscapeLocal(x, z, escapeFrame);

    // Safe Room deck at Puzzle Room's floor elevation (ex: -11.7..-5.7, ez: -2.4..+2.4)
    if (ex >= -11.85 && ex <= -5.55 && ez >= -2.55 && ez <= 2.55) {
      candidates.push(FLOOR_ELEVATIONS[escapeFrame.floor]);
    }

    // Emergency Escape Stairwell Landings for Floors 2..puzzleFloor (ex: -16.05..-11.7, ez: -1.2..+2.4)
    if (escapeFrame.floor >= 2 && ex >= -16.2 && ex <= -11.55 && ez >= -1.3 && ez <= 2.55) {
      for (let fl = 2; fl <= escapeFrame.floor; fl++) {
        candidates.push(FLOOR_ELEVATIONS[fl as FloorNumber]);
      }
    }

    // Ground-Floor Extraction Bay (Floor 1, Y=0)
    // On Floor 1 Puzzle Rooms, Safe Room connects straight into the Ground Extraction Bay across ez in [-2.55, +4.55].
    const groundMinEz = escapeFrame.floor === 1 ? -2.55 : -1.3;
    if (
      !blockFloor1Base &&
      ex >= -16.2 &&
      ex <= -8.15 &&
      ez >= groundMinEz &&
      ez <= 4.55
    ) {
      candidates.push(FLOOR_ELEVATIONS[1]);
    } else if (currentFeetY < 1.8) {
      // Continuous exterior ground (compound yard, stone walkways, sidewalks, city avenue) at Y = 0
      candidates.push(FLOOR_ELEVATIONS[1]);
    }
  } else {
    for (const fl of [1, 2, 3, 4] as FloorNumber[]) {
      if (fl === 1 && blockFloor1Base) continue;
      if (!isInsideFloorCutout(x, z, fl)) {
        candidates.push(FLOOR_ELEVATIONS[fl]);
      }
    }
  }

  for (const stair of getAllStaircases()) {
    const stairY = getStaircaseElevationAt(x, z, stair);
    if (stairY !== null) {
      candidates.push(stairY);
    }
  }

  if (candidates.length === 0) {
    return currentFeetY;
  }

  const reachable = candidates.filter((h) => Math.abs(h - currentFeetY) <= STEP_TOLERANCE);
  const pool = reachable.length > 0 ? reachable : candidates;

  let best = pool[0];
  let bestDiff = Math.abs(best - currentFeetY);
  for (let i = 1; i < pool.length; i++) {
    const diff = Math.abs(pool[i] - currentFeetY);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = pool[i];
    }
  }
  return best;
}

/**
 * Derives the player or AI's current floor strictly from actual world Y elevation.
 */
export function getFloorFromElevation(feetY: number): FloorNumber {
  let closestFloor: FloorNumber = 1;
  let minDiff = Infinity;
  for (const fl of [1, 2, 3, 4] as FloorNumber[]) {
    const diff = Math.abs(feetY - FLOOR_ELEVATIONS[fl]);
    if (diff < minDiff) {
      minDiff = diff;
      closestFloor = fl;
    }
  }
  return closestFloor;
}

export function getFloorDisplayName(floor: FloorNumber): string {
  return BUILDING_FLOORS.find((f) => f.floor === floor)?.name ?? `Floor ${floor}`;
}

/**
 * Computes exact switchback U-turn staircase waypoints for Beast AI between any two floors.
 */
export function getStaircasePathBetweenFloors(
  fromFloor: FloorNumber,
  toFloor: FloorNumber,
  shaft: 'west' | 'east' = 'west'
): FloorNavNode[] {
  if (fromFloor === toFloor) return [];
  const step = toFloor > fromFloor ? 1 : -1;
  const nodes: FloorNavNode[] = [];
  let cur = fromFloor;

  while (cur !== toFloor) {
    const next = (cur + step) as FloorNumber;
    const lowFloor = Math.min(cur, next) as FloorNumber;
    const stair = BUILDING_STAIRCASES.find(
      (s) =>
        s.fromFloor === lowFloor &&
        (shaft === 'west' ? s.origin[0] < 0 : s.origin[0] > 0)
    );
    if (stair) {
      const startLx = step > 0 ? -0.94 : 0.94;
      const endLx = -startLx;
      const midY = FLOOR_ELEVATIONS[lowFloor] + FLOOR_HEIGHT / 2;

      const [enX, enZ] = stairLocalToWorld(startLx, 3.6, stair);
      const [m1X, m1Z] = stairLocalToWorld(startLx, -1.75, stair);
      const [m2X, m2Z] = stairLocalToWorld(endLx, -1.75, stair);
      const [exX, exZ] = stairLocalToWorld(endLx, 3.6, stair);

      nodes.push({
        floor: next,
        stairId: stair.id,
        waypoints: [
          [enX, FLOOR_ELEVATIONS[cur], enZ],
          [m1X, midY, m1Z],
          [m2X, midY, m2Z],
          [exX, FLOOR_ELEVATIONS[next], exZ],
        ],
      });
    }
    cur = next;
  }

  return nodes;
}
