import { BEAST_ROSTER } from '../data/beastConfig';
import { FLOOR_ELEVATIONS } from '../data/buildingLayout';
import { BeastId, PlayerActionAnim } from '../types/game';

export interface BeastWorldPosEntry {
  id: BeastId;
  x: number;
  feetY: number;
  z: number;
  yaw: number;
  mode: string;
}

/**
 * Converts a horizontal world movement vector (dx, dz) into the 3D character's Y-rotation
 * where local +Z is the character's forward facing direction.
 */
export function worldDirToCharacterYaw(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/**
 * Shared mutable world coordinates for zero-GC per-frame communication
 * between PlayerController, PlayerCharacter, BeastSquad (4 Beasts), and 3D spatial audio.
 *
 * CRITICAL: x, feetY, z ALWAYS represent the actual 3D player character's world feet position
 * (never the offset third-person camera position), so Beast AI vision, chase, capture, collision,
 * door/key interaction distances, and hiding mechanics operate strictly on the real player body.
 */
export const playerWorldPos = {
  x: -22.3,
  feetY: FLOOR_ELEVATIONS[1],
  z: -15.8,
  /** Smoothed horizontal world velocity (m/s) */
  vx: 0,
  vz: 0,
  /** Camera horizontal look yaw (radians; camera forward is (-sin(yaw), 0, -cos(yaw))) */
  yaw: -Math.PI / 2,
  /** Camera vertical look pitch (radians) */
  pitch: 0.14,
  /** 3D character facing yaw (radians; character forward is (+sin(characterYaw), 0, +cos(characterYaw))) */
  characterYaw: Math.PI / 2,
  targetCharacterYaw: Math.PI / 2,
  isMoving: false,
  isSprinting: false,
  /** Continuous walk (0) -> run/sprint (1) blend for smooth gait & posture transitions */
  sprintBlend: 0,
  isTurning: false,
  turnRate: 0,
  speed: 0,
  /** Normalized locomotion blend: 0 = idle, ~0.67 = walk/jog, 1.0 = sprint */
  moveRatio: 0,
  /** Distance-coupled gait cycle phase (radians) — prevents foot sliding */
  walkPhase: 0,
  verticalVelocity: 0,
  isGrounded: true,
  isCrouching: false,
  crouchBlend: 0,
  jumpOffsetY: 0,
  jumpVelocity: 0,
  isHidden: false,
  hiddenSpotId: null as string | null,
  /** Active one-shot or stateful character action animation */
  actionAnim: 'none' as PlayerActionAnim,
  actionAnimClock: 0,
  actionAnimDuration: 0,
  /** Actual resolved third-person camera world coordinates (separate from player body) */
  cameraPos: {
    x: -25.1,
    y: FLOOR_ELEVATIONS[1] + 2.15,
    z: -15.4,
  },
  cameraEffectiveDist: 3.0,
};

/**
 * Shared mutable virtual/touch control state read at 60fps by PlayerController
 * without causing React re-renders.
 */
export const virtualInput = {
  /** Strafe X (-1 left .. +1 right) */
  moveX: 0,
  /** Forward Y (+1 forward .. -1 backward) */
  moveY: 0,
  sprinting: false,
  jumpQueued: false,
  interactQueued: false,
  hideQueued: false,
  /** Interactive Lobby 3D character showcase yaw angle (radians) */
  lobbyCharacterYaw: 0.24,
};

/**
 * Triggers a procedural action animation clip on the 3D player character without React re-renders.
 */
export function triggerPlayerActionAnim(kind: PlayerActionAnim, duration = 0.6): void {
  playerWorldPos.actionAnim = kind;
  playerWorldPos.actionAnimClock = 0;
  playerWorldPos.actionAnimDuration = duration;
}

export const beastWorldPositions: BeastWorldPosEntry[] = BEAST_ROSTER.map((entry) => ({
  id: entry.id,
  x: entry.spawnPos[0],
  feetY: FLOOR_ELEVATIONS[entry.initialFloor],
  z: entry.spawnPos[1],
  yaw: entry.initialYaw,
  mode: 'patrol',
}));

/**
 * Tracks the closest / capturing Beast for camera look-at and backward compatibility.
 */
export const beastWorldPos = {
  x: BEAST_ROSTER[0].spawnPos[0],
  feetY: FLOOR_ELEVATIONS[BEAST_ROSTER[0].initialFloor],
  z: BEAST_ROSTER[0].spawnPos[1],
  yaw: BEAST_ROSTER[0].initialYaw,
  capturingBeastId: null as BeastId | null,
};

/**
 * Timestamp (performance.now()) of last Beast sword strike on the Puzzle Room barrier
 * for synchronized electromagnetic flash feedback without React re-renders.
 */
export const barrierFeedbackState = {
  lastImpactMs: 0,
};
