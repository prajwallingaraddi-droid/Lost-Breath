import {
  getActiveMissionFrame,
  getActivePuzzleFrame,
  roomLocalToWorld,
} from './buildingLayout';
import { BeastDifficultyStage, BeastId, FloorNumber, ProgressionState } from '../types/game';

export interface BeastRosterEntry {
  id: BeastId;
  name: string;
  initialFloor: FloorNumber;
  spawnPos: [number, number];
  initialYaw: number;
  preferredFloors: FloorNumber[];
  voicePitch: number;
  missionTargetPos: [number, number];
  puzzleSiegePos: [number, number];
}

/**
 * Exactly FOUR warrior Beast Hunters distributed across all 4 floors of the facility,
 * each with independent starting coordinates, patrol floor preferences, voice pitch,
 * and coordinated flanking/siege staging coordinates so they never stack on one spot.
 */
export const BEAST_ROSTER: readonly BeastRosterEntry[] = [
  {
    id: 0,
    name: 'Hunter I',
    initialFloor: 4,
    spawnPos: [14.8, -14.8], // Floor 4 NE corner
    initialYaw: Math.PI,
    preferredFloors: [4, 3],
    voicePitch: 0.94,
    missionTargetPos: [19.8, 0.0], // Legacy fallback — runtime uses getDynamicMissionTargetPos()
    puzzleSiegePos: [-14.8, 0.0], // Legacy fallback — runtime uses getDynamicPuzzleSiegePos()
  },
  {
    id: 1,
    name: 'Hunter II',
    initialFloor: 3,
    spawnPos: [14.8, 14.8], // Floor 3 SE corner
    initialYaw: -Math.PI / 2,
    preferredFloors: [3, 4],
    voicePitch: 1.03,
    missionTargetPos: [14.8, -2.6],
    puzzleSiegePos: [-14.8, -3.2],
  },
  {
    id: 2,
    name: 'Hunter III',
    initialFloor: 2,
    spawnPos: [-14.8, 14.8], // Floor 2 SW corner
    initialYaw: 0,
    preferredFloors: [2, 1],
    voicePitch: 0.88,
    missionTargetPos: [14.8, 2.6],
    puzzleSiegePos: [-14.8, 3.2],
  },
  {
    id: 3,
    name: 'Hunter IV',
    initialFloor: 1,
    spawnPos: [14.8, 14.8], // Floor 1 SE corner (far from NW player spawn [-22.3, -15.8])
    initialYaw: Math.PI,
    preferredFloors: [1, 2],
    voicePitch: 1.1,
    missionTargetPos: [17.8, 0.0],
    puzzleSiegePos: [-14.8, -6.8],
  },
] as const;

export const BEAST_COUNT = 4;

/**
 * Computes coordinated Mission Room convergence coordinates for each of the 4 Hunters
 * relative to whichever room is dynamically assigned as the Mission Room.
 * Local +Z points into the corridor (corridor ring centerline is lz = +7.5).
 */
export function getDynamicMissionTargetPos(beastId: BeastId): [number, number] {
  const frame = getActiveMissionFrame();
  // Hunter 0 enters room interior, Hunter 3 covers threshold, Hunters 1 & 2 flank along the corridor
  const localOffsets: Record<BeastId, [number, number]> = {
    0: [0.0, 2.5], // Mission Room interior
    1: [-2.6, 7.5], // Corridor flank A
    2: [2.6, 7.5], // Corridor flank B
    3: [0.0, 4.5], // Mission Room doorway threshold
  };
  const [lx, lz] = localOffsets[beastId] ?? [0, 7.5];
  const [wx, wz] = roomLocalToWorld(lx, lz, frame);
  if (lz >= 7.0) {
    // Keep corridor flank positions cleanly inside the 14.8m corridor ring
    return [Math.max(-14.8, Math.min(14.8, wx)), Math.max(-14.8, Math.min(14.8, wz))];
  }
  return [wx, wz];
}

/**
 * Computes coordinated Puzzle Room exterior siege positions for each of the 4 Hunters
 * along the corridor outside whichever room is dynamically assigned as the Puzzle Room.
 */
export function getDynamicPuzzleSiegePos(beastId: BeastId): [number, number] {
  const frame = getActivePuzzleFrame();
  const localOffsets: Record<BeastId, [number, number]> = {
    0: [0.0, 7.5], // Directly outside Puzzle Room door
    1: [3.2, 7.5], // Corridor flank A
    2: [-3.2, 7.5], // Corridor flank B
    3: [6.4, 7.5], // Extended corridor watchpost
  };
  const [lx, lz] = localOffsets[beastId] ?? [0, 7.5];
  const [wx, wz] = roomLocalToWorld(lx, lz, frame);
  return [Math.max(-14.8, Math.min(14.8, wx)), Math.max(-14.8, Math.min(14.8, wz))];
}

/**
 * After collecting the genuine Puzzle Room Key:
 * - Beasts approach at 65% of normal chase speed for a 25-second escape grace window
 *   (still physically navigating & threatening, without instant capture).
 * - After 25 seconds, speed smoothly ramps back up to 100% normal chase speed over 15 seconds.
 */
export const KEY_ALARM_GRACE_SECONDS = 25;
export const KEY_ALARM_RAMP_SECONDS = 15;
export const KEY_ALARM_INITIAL_SPEED_FACTOR = 0.65;

export function getKeyAlarmSpeedMultiplier(elapsedSeconds: number | null): number {
  if (elapsedSeconds === null || elapsedSeconds < 0) return 1.0;
  if (elapsedSeconds < KEY_ALARM_GRACE_SECONDS) {
    return KEY_ALARM_INITIAL_SPEED_FACTOR;
  }
  const rampProgress = Math.min(
    1,
    (elapsedSeconds - KEY_ALARM_GRACE_SECONDS) / KEY_ALARM_RAMP_SECONDS
  );
  return KEY_ALARM_INITIAL_SPEED_FACTOR + (1 - KEY_ALARM_INITIAL_SPEED_FACTOR) * rampProgress;
}

export interface BeastDifficultyProfile {
  stage: BeastDifficultyStage;
  label: string;
  patrolSpeed: number;
  investigateSpeed: number;
  chaseSpeed: number;
  searchSpeed: number;
  turnSpeedRad: number;
  visionRange: number;
  visionFovDeg: number;
  proximitySenseRadius: number;
  hearingMultiplier: number;
  detectConfirmSeconds: number;
  chaseMemorySeconds: number;
  searchDurationSeconds: number;
  aiUpdateInterval: number;
  patrolPauseSeconds: [number, number];
}

/**
 * Configurable dynamic difficulty profiles across the 4 progression stages.
 * Player walk speed is 5.8 m/s and sprint is 8.6 m/s, so chase speeds remain
 * tense and fair without becoming impossible to outrun.
 */
export const BEAST_DIFFICULTY_PROFILES: Record<BeastDifficultyStage, BeastDifficultyProfile> = {
  early: {
    stage: 'early',
    label: 'Low Threat',
    patrolSpeed: 2.35,
    investigateSpeed: 3.1,
    chaseSpeed: 3.85,
    searchSpeed: 2.65,
    turnSpeedRad: 6.5,
    visionRange: 16.0,
    visionFovDeg: 105,
    proximitySenseRadius: 2.4,
    hearingMultiplier: 0.85,
    detectConfirmSeconds: 0.55,
    chaseMemorySeconds: 4.5,
    searchDurationSeconds: 6.0,
    aiUpdateInterval: 0.14,
    patrolPauseSeconds: [1.1, 2.0],
  },
  mission: {
    stage: 'mission',
    label: 'Security Breach',
    patrolSpeed: 2.75,
    investigateSpeed: 3.7,
    chaseSpeed: 4.4,
    searchSpeed: 3.05,
    turnSpeedRad: 7.8,
    visionRange: 20.0,
    visionFovDeg: 118,
    proximitySenseRadius: 2.9,
    hearingMultiplier: 1.1,
    detectConfirmSeconds: 0.38,
    chaseMemorySeconds: 5.8,
    searchDurationSeconds: 8.0,
    aiUpdateInterval: 0.14,
    patrolPauseSeconds: [0.7, 1.3],
  },
  puzzle: {
    stage: 'puzzle',
    label: 'High Alert',
    patrolSpeed: 2.95,
    investigateSpeed: 3.85,
    chaseSpeed: 4.65,
    searchSpeed: 3.3,
    turnSpeedRad: 8.5,
    visionRange: 22.0,
    visionFovDeg: 125,
    proximitySenseRadius: 3.2,
    hearingMultiplier: 1.2,
    detectConfirmSeconds: 0.3,
    chaseMemorySeconds: 7.0,
    searchDurationSeconds: 9.0,
    aiUpdateInterval: 0.12,
    patrolPauseSeconds: [0.55, 1.1],
  },
  escape: {
    stage: 'escape',
    label: 'Maximum Pursuit',
    patrolSpeed: 3.25,
    investigateSpeed: 4.15,
    chaseSpeed: 5.05,
    searchSpeed: 3.6,
    turnSpeedRad: 9.5,
    visionRange: 25.0,
    visionFovDeg: 135,
    proximitySenseRadius: 3.6,
    hearingMultiplier: 1.35,
    detectConfirmSeconds: 0.2,
    chaseMemorySeconds: 8.5,
    searchDurationSeconds: 10.5,
    aiUpdateInterval: 0.12,
    patrolPauseSeconds: [0.35, 0.75],
  },
};

export function getBeastDifficultyStage(
  progression: ProgressionState,
  missionCompleted: boolean,
  allPuzzlesCompleted: boolean,
  puzzleRoomEntered: boolean,
  keyAlarmTriggered: boolean
): BeastDifficultyStage {
  if (
    allPuzzlesCompleted ||
    progression === 'PUZZLES_COMPLETED' ||
    progression === 'EXIT_UNLOCKED' ||
    progression === 'ESCAPED'
  ) {
    return 'escape';
  }
  if (
    puzzleRoomEntered ||
    progression === 'PUZZLE_ROOM_UNLOCKED' ||
    progression === 'PUZZLE_ACTIVE'
  ) {
    return 'puzzle';
  }
  // Only genuine key pickup / alarm activation escalates Hunters — entering Mission Room alone must NOT!
  if (missionCompleted || keyAlarmTriggered || progression === 'MISSION_COMPLETED') {
    return 'mission';
  }
  return 'early';
}

export function getBeastDifficultyProfile(
  progression: ProgressionState,
  missionCompleted: boolean,
  allPuzzlesCompleted: boolean,
  puzzleRoomEntered: boolean,
  keyAlarmTriggered: boolean
): BeastDifficultyProfile {
  const stage = getBeastDifficultyStage(
    progression,
    missionCompleted,
    allPuzzlesCompleted,
    puzzleRoomEntered,
    keyAlarmTriggered
  );
  return BEAST_DIFFICULTY_PROFILES[stage];
}
