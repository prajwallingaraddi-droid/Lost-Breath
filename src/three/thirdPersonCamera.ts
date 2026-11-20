import * as THREE from 'three';
import {
  BUILDING_FLOORS,
  FLOOR_ELEVATIONS,
  FLOOR_HEIGHT,
  getActivePuzzleEscapeFrame,
  MAIN_ENTRANCE_POS,
  SLAB_THICKNESS,
  worldToEscapeLocal,
} from '../data/buildingLayout';
import { DoorAnimState, FloorNumber, SpecialDoorKey } from '../types/game';
import {
  raycastCameraObstructionsOnFloor,
  raycastExteriorCameraObstructions,
} from './collision';
import { getFloorFromElevation } from './floorNavigation';

export const DEFAULT_CAMERA_DISTANCE = 3.0;
export const MIN_CAMERA_DISTANCE = 1.8;
export const MAX_CAMERA_DISTANCE = 5.0;

/** Pivot height centered near the human survivor's upper shoulders */
export const CAMERA_PIVOT_HEIGHT = 1.52;
/** Slight right-shoulder offset so the player silhouette sits cleanly on screen while keeping corridors ahead visible */
export const CAMERA_SHOULDER_OFFSET = 0.4;
/** Minimum pulled-in distance in ultra-narrow doorways/corners so the camera never clips into the player's head */
export const CAMERA_MIN_OCCLUDED_DIST = 0.72;
/** Clearance kept in front of walls, closed doors, and furniture */
export const CAMERA_WALL_MARGIN = 0.28;
/** Vertical look pitch limits (radians: negative = looking up, positive = looking down from behind) */
export const CAMERA_MIN_PITCH = -0.58;
export const CAMERA_MAX_PITCH = 0.92;

const WHISKER_SPREAD = 0.16;
const RAY_OFFSETS = [0, -WHISKER_SPREAD, WHISKER_SPREAD] as const;

export function clampCameraDistance(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CAMERA_DISTANCE;
  const clamped = Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, value));
  return Math.round(clamped * 10) / 10;
}

export interface ThirdPersonCameraInput {
  playerX: number;
  playerFeetY: number;
  playerZ: number;
  yaw: number;
  pitch: number;
  desiredDistance: number;
  doorStates: Record<SpecialDoorKey, DoorAnimState>;
  compoundGateOpen?: boolean;
  mainEntranceOpen?: boolean;
}

export interface ThirdPersonCameraSolution {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  effectiveDistance: number;
  isOccluded: boolean;
}

function isInsideStairwellCutout(x: number, z: number, floor: FloorNumber): boolean {
  const floorData = BUILDING_FLOORS[floor - 1];
  if (!floorData) return false;
  const cutouts = floorData.cutouts;
  for (let i = 0; i < cutouts.length; i++) {
    const cut = cutouts[i];
    if (cut.kind !== 'stairwell') continue;
    if (x >= cut.minX - 0.3 && x <= cut.maxX + 0.3 && z >= cut.minZ - 0.3 && z <= cut.maxZ + 0.3) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves a collision-safe third-person over-the-shoulder camera transform behind the player.
 *
 * - Sweeps center + left/right whisker rays against walls, closed doors, stairwell shafts,
 *   furniture, and hiding structures via the floor 2D spatial hash grid (zero per-frame GC).
 * - Automatically shrinks shoulder lateral offset when pulled close inside narrow rooms or corridors.
 * - Clamps camera Y cleanly below each floor's concrete ceiling slab (except inside stairwell openings).
 */
export function resolveThirdPersonCameraPosition(
  input: ThirdPersonCameraInput
): ThirdPersonCameraSolution {
  const { playerX, playerFeetY, playerZ, yaw, doorStates } = input;
  const pitch = THREE.MathUtils.clamp(input.pitch, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);
  const desiredDist = clampCameraDistance(input.desiredDistance);

  // Camera look direction (matches existing PlayerController convention: yaw=0 looks along -Z)
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const fwdX = -Math.sin(yaw) * cosPitch;
  const fwdY = -sinPitch;
  const fwdZ = -Math.cos(yaw) * cosPitch;

  // Horizontal right vector relative to camera yaw
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);

  // Base pivot at player upper back / shoulders
  const basePivotX = playerX;
  const basePivotY = playerFeetY + CAMERA_PIVOT_HEIGHT;
  const basePivotZ = playerZ;

  const floor = getFloorFromElevation(playerFeetY);
  const escapeFrame = getActivePuzzleEscapeFrame();
  const { lx: ex, lz: ez } = worldToEscapeLocal(playerX, playerZ, escapeFrame);
  const inEscapeFootprint =
    ex < -4.8 &&
    ex > -16.6 &&
    (escapeFrame.floor === 1 ? ez >= -2.9 && ez <= 4.8 : ez >= -6.9 && ez <= 4.8);
  const outsideBuilding = Math.abs(playerX) > 27.45 || Math.abs(playerZ) > 27.45;
  const inExteriorEscapeZone = outsideBuilding && doorStates.exit === 'open' && inEscapeFootprint;
  const compoundGateOpen = Boolean(input.compoundGateOpen);
  const mainEntranceOpen = Boolean(input.mainEntranceOpen);
  const isOutsideOrInMainDoorway =
    !inExteriorEscapeZone &&
    (Math.abs(playerX) > 27.95 ||
      Math.abs(playerZ) > 27.95 ||
      (mainEntranceOpen &&
        floor === 1 &&
        Math.abs(playerX - MAIN_ENTRANCE_POS[0]) < 2.25 &&
        playerZ > 24.5));

  // 1. Validate lateral shoulder shift so pivoting off-center never pushes the pivot into an adjacent wall
  let safeShoulderOffset = CAMERA_SHOULDER_OFFSET;
  const shoulderTargetX = basePivotX + rightX * safeShoulderOffset;
  const shoulderTargetZ = basePivotZ + rightZ * safeShoulderOffset;
  let shoulderHitT = 1.0;
  if (!isOutsideOrInMainDoorway || (Math.abs(playerX) <= 32.5 && Math.abs(playerZ) <= 32.5)) {
    shoulderHitT = raycastCameraObstructionsOnFloor(
      floor,
      playerFeetY,
      doorStates,
      inExteriorEscapeZone,
      basePivotX,
      basePivotZ,
      shoulderTargetX,
      shoulderTargetZ,
      shoulderHitT
    );
  }
  if (isOutsideOrInMainDoorway || (mainEntranceOpen && floor === 1 && playerZ > 24.5)) {
    shoulderHitT = raycastExteriorCameraObstructions(
      basePivotX,
      basePivotZ,
      shoulderTargetX,
      shoulderTargetZ,
      shoulderHitT,
      compoundGateOpen,
      mainEntranceOpen
    );
  }
  if (shoulderHitT < 1.0) {
    safeShoulderOffset = Math.max(0, safeShoulderOffset * shoulderHitT - 0.14);
  }

  const pivotX = basePivotX + rightX * safeShoulderOffset;
  const pivotY = basePivotY;
  const pivotZ = basePivotZ + rightZ * safeShoulderOffset;

  // 2. Compute ideal camera coordinates behind the shoulder pivot
  const dirToCamX = -fwdX;
  const dirToCamY = -fwdY + 0.14;
  const dirToCamZ = -fwdZ;
  const dirLen = Math.hypot(dirToCamX, dirToCamY, dirToCamZ) || 1;
  const normCamX = dirToCamX / dirLen;
  const normCamY = dirToCamY / dirLen;
  const normCamZ = dirToCamZ / dirLen;

  const idealX = pivotX + normCamX * desiredDist;
  const idealZ = pivotZ + normCamZ * desiredDist;

  // 3. Sweep center ray + two ±0.16m lateral whisker rays via spatial hash grid + exterior colliders
  let minHitT = 1.0;
  for (let i = 0; i < RAY_OFFSETS.length; i++) {
    const off = RAY_OFFSETS[i];
    const ox = pivotX + rightX * off;
    const oz = pivotZ + rightZ * off;
    const exRay = idealX + rightX * off;
    const ezRay = idealZ + rightZ * off;
    if (!isOutsideOrInMainDoorway || (Math.abs(playerX) <= 32.5 && Math.abs(playerZ) <= 32.5)) {
      minHitT = raycastCameraObstructionsOnFloor(
        floor,
        playerFeetY,
        doorStates,
        inExteriorEscapeZone,
        ox,
        oz,
        exRay,
        ezRay,
        minHitT
      );
    }
    if (isOutsideOrInMainDoorway || (mainEntranceOpen && floor === 1 && playerZ > 24.5)) {
      minHitT = raycastExteriorCameraObstructions(
        ox,
        oz,
        exRay,
        ezRay,
        minHitT,
        compoundGateOpen,
        mainEntranceOpen
      );
    }
  }

  // Prevent camera from slipping outside building perimeter walls when strictly inside building
  if (!inExteriorEscapeZone && !isOutsideOrInMainDoorway) {
    const outerLimit = 27.55;
    if (Math.abs(idealX) > outerLimit && Math.abs(idealX - pivotX) > 1e-4) {
      const targetEdge = idealX > 0 ? outerLimit : -outerLimit;
      const tEdge = (targetEdge - pivotX) / (idealX - pivotX);
      if (tEdge >= 0 && tEdge < minHitT) minHitT = tEdge;
    }
    if (Math.abs(idealZ) > outerLimit && Math.abs(idealZ - pivotZ) > 1e-4) {
      const targetEdge = idealZ > 0 ? outerLimit : -outerLimit;
      const tEdge = (targetEdge - pivotZ) / (idealZ - pivotZ);
      if (tEdge >= 0 && tEdge < minHitT) minHitT = tEdge;
    }
  }

  const isOccluded = minHitT < 0.999;
  let effectiveDist = desiredDist;
  let tightCornerLift = 0;
  if (isOccluded) {
    const hitDist = minHitT * desiredDist;
    const safeClearDist = Math.max(0.16, hitDist - CAMERA_WALL_MARGIN);
    effectiveDist = Math.min(desiredDist, safeClearDist);
    if (effectiveDist < CAMERA_MIN_OCCLUDED_DIST) {
      const squeeze = 1 - effectiveDist / CAMERA_MIN_OCCLUDED_DIST;
      tightCornerLift = squeeze * 0.24;
    }
  }

  // Smoothly reduce shoulder offset when pulled very close in narrow hallways so player remains framed cleanly
  const closeBlend = THREE.MathUtils.clamp(
    (effectiveDist - 0.2) / Math.max(0.4, desiredDist - 0.2),
    0.25,
    1.0
  );
  const finalPivotX = basePivotX + rightX * safeShoulderOffset * closeBlend;
  const finalPivotZ = basePivotZ + rightZ * safeShoulderOffset * closeBlend;

  const camX = finalPivotX + normCamX * effectiveDist;
  let camY = pivotY + tightCornerLift + normCamY * effectiveDist;
  const camZ = finalPivotZ + normCamZ * effectiveDist;

  // 4. Vertical ceiling & floor clearance clamp
  const floorElev = FLOOR_ELEVATIONS[floor];
  const minCamY = playerFeetY + 0.52;
  const inStairwell = inExteriorEscapeZone || isInsideStairwellCutout(camX, camZ, floor);
  const camOutdoors = Math.abs(camX) > 28.05 || Math.abs(camZ) > 28.05;
  const maxCamY = camOutdoors
    ? playerFeetY + 4.8
    : inStairwell
    ? playerFeetY + 3.85
    : floorElev + FLOOR_HEIGHT - SLAB_THICKNESS - 0.32;
  camY = THREE.MathUtils.clamp(camY, minCamY, Math.max(minCamY + 0.4, maxCamY));

  // 5. Look target slightly ahead of the shoulder pivot along camera gaze
  const lookAhead = 4.2;
  const lookX = finalPivotX + fwdX * lookAhead;
  const lookY = pivotY - 0.06 + fwdY * lookAhead;
  const lookZ = finalPivotZ + fwdZ * lookAhead;

  return {
    camX,
    camY,
    camZ,
    lookX,
    lookY,
    lookZ,
    effectiveDistance: effectiveDist,
    isOccluded,
  };
}
