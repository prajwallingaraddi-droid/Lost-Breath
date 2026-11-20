import {
  BEAST_DIFFICULTY_PROFILES,
  BEAST_ROSTER,
  BeastDifficultyProfile,
  getDynamicMissionTargetPos,
  getDynamicPuzzleSiegePos,
  getKeyAlarmSpeedMultiplier,
  KEY_ALARM_GRACE_SECONDS,
} from '../data/beastConfig';
import {
  CORRIDOR_OUTER,
  COURTYARD_HALF,
  FLOOR_ELEVATIONS,
  getActivePuzzleFrame,
  MISSION_ROOM_BOUNDS,
  PUZZLE_CHAMBER_BOUNDS,
  roomLocalToWorld,
  worldToRoomLocal,
} from '../data/buildingLayout';
import { getHidingSpotById } from '../data/hidingSpots';
import {
  BeastAiMode,
  BeastId,
  ControlMode,
  DoorAnimState,
  FloorNumber,
  SpecialDoorKey,
} from '../types/game';
import {
  canBeastSeePlayer,
  findNavPath,
  hasBeastLineOfSight,
  NavNode,
  NavWaypoint,
  pickPatrolTargetNode,
  pickSearchTargetNodes,
} from './beastNavigation';
import { resolvePlayerMovement } from './collision';
import { getFloorFromElevation, resolveSurfaceElevation } from './floorNavigation';
import { getAudibleSoundForBeast } from './soundBus';

export const BEAST_CATCH_RADIUS = 1.35;
export const BEAST_CAPTURE_DURATION = 1.05;
const CORRIDOR_MID = (COURTYARD_HALF + CORRIDOR_OUTER) / 2;

export type BeastBrainEvent =
  | 'detect-warning'
  | 'chase-started'
  | 'investigate-started'
  | 'search-started'
  | 'capture-started'
  | 'capture-completed'
  | 'servo-scan'
  | 'alarm-reaction'
  | 'barrier-strike'
  | 'siege-shout';

export interface BeastBrainState {
  id: BeastId;
  name: string;
  preferredFloors: FloorNumber[];
  x: number;
  feetY: number;
  z: number;
  yaw: number;
  mode: BeastAiMode;
  waypoints: NavWaypoint[];
  recentNodeIds: string[];
  patrolPauseTimer: number;
  investigateTarget: { x: number; y: number; z: number; floor: FloorNumber } | null;
  investigateTimeout: number;
  lastProcessedSoundId: number;
  detectTimer: number;
  chaseMemoryTimer: number;
  lastKnownPlayerPos: { x: number; y: number; z: number; floor: FloorNumber } | null;
  searchTimer: number;
  searchQueue: NavNode[];
  searchPauseTimer: number;
  captureTimer: number;
  aiTickAccum: number;
  repathAccum: number;
  stuckCheckAccum: number;
  lastCheckX: number;
  lastCheckZ: number;
  lastObservedPlayerFloor: FloorNumber;
  lastMissionAlert: boolean;
  lastKeyAlarm: boolean;
  keyAlarmElapsedSeconds: number | null;
  lastPuzzleAlert: boolean;
  lastPuzzleBreach: boolean;
  witnessedHidingSpotId: string | null;
  siegeAttackTimer: number;
  barrierStrikeAnimClock: number;
  assignedTargetNodeId: string | null;
  currentSpeed: number;
  isMoving: boolean;
  isTurning: boolean;
  walkPhase: number;
  // Smooth locomotion & perception caching fields
  velX: number;
  velZ: number;
  smoothedSpeed: number;
  lastChaseGoalX: number;
  lastChaseGoalZ: number;
  lastChaseGoalFloor: FloorNumber;
  cachedDirectLos: boolean;
  cachedCanSee: boolean;
  directLosAccum: number;
  wallSlideSign: number;
}

export function getInitialBeastSpawn(floor: FloorNumber): [number, number] {
  return floor % 2 === 0 ? [CORRIDOR_MID, -CORRIDOR_MID] : [-CORRIDOR_MID, CORRIDOR_MID];
}

export function createBeastBrainStateForRoster(beastId: BeastId): BeastBrainState {
  const roster = BEAST_ROSTER[beastId] ?? BEAST_ROSTER[0];
  const [spawnX, spawnZ] = roster.spawnPos;
  return {
    id: roster.id,
    name: roster.name,
    preferredFloors: [...roster.preferredFloors],
    x: spawnX,
    feetY: FLOOR_ELEVATIONS[roster.initialFloor],
    z: spawnZ,
    yaw: roster.initialYaw,
    mode: 'patrol',
    waypoints: [],
    recentNodeIds: [],
    patrolPauseTimer: 0.25 + beastId * 0.22,
    investigateTarget: null,
    investigateTimeout: 0,
    lastProcessedSoundId: 0,
    detectTimer: 0,
    chaseMemoryTimer: 0,
    lastKnownPlayerPos: null,
    searchTimer: 0,
    searchQueue: [],
    searchPauseTimer: 0,
    captureTimer: 0,
    aiTickAccum: beastId * 0.035, // Stagger perception ticks across frames
    repathAccum: 0,
    stuckCheckAccum: 0,
    lastCheckX: spawnX,
    lastCheckZ: spawnZ,
    lastObservedPlayerFloor: 1,
    lastMissionAlert: false,
    lastKeyAlarm: false,
    keyAlarmElapsedSeconds: null,
    lastPuzzleAlert: false,
    lastPuzzleBreach: false,
    witnessedHidingSpotId: null,
    siegeAttackTimer: 1.4 + beastId * 0.75,
    barrierStrikeAnimClock: 0,
    assignedTargetNodeId: null,
    currentSpeed: 0,
    isMoving: false,
    isTurning: false,
    walkPhase: beastId * 1.1,
    velX: 0,
    velZ: 0,
    smoothedSpeed: 0,
    lastChaseGoalX: 9999,
    lastChaseGoalZ: 9999,
    lastChaseGoalFloor: 1,
    cachedDirectLos: false,
    cachedCanSee: false,
    directLosAccum: beastId * 0.02,
    wallSlideSign: beastId % 2 === 0 ? 1 : -1,
  };
}

export function createBeastBrainState(startFloor: FloorNumber = 4): BeastBrainState {
  const [spawnX, spawnZ] = getInitialBeastSpawn(startFloor);
  return {
    id: 0,
    name: 'Hunter I',
    preferredFloors: [startFloor],
    x: spawnX,
    feetY: FLOOR_ELEVATIONS[startFloor],
    z: spawnZ,
    yaw: startFloor % 2 === 0 ? Math.PI : 0,
    mode: 'patrol',
    waypoints: [],
    recentNodeIds: [],
    patrolPauseTimer: 0.4,
    investigateTarget: null,
    investigateTimeout: 0,
    lastProcessedSoundId: 0,
    detectTimer: 0,
    chaseMemoryTimer: 0,
    lastKnownPlayerPos: null,
    searchTimer: 0,
    searchQueue: [],
    searchPauseTimer: 0,
    captureTimer: 0,
    aiTickAccum: 0,
    repathAccum: 0,
    stuckCheckAccum: 0,
    lastCheckX: spawnX,
    lastCheckZ: spawnZ,
    lastObservedPlayerFloor: 1,
    lastMissionAlert: false,
    lastKeyAlarm: false,
    keyAlarmElapsedSeconds: null,
    lastPuzzleAlert: false,
    lastPuzzleBreach: false,
    witnessedHidingSpotId: null,
    siegeAttackTimer: 2.0,
    barrierStrikeAnimClock: 0,
    assignedTargetNodeId: null,
    currentSpeed: 0,
    isMoving: false,
    isTurning: false,
    walkPhase: 0,
    velX: 0,
    velZ: 0,
    smoothedSpeed: 0,
    lastChaseGoalX: 9999,
    lastChaseGoalZ: 9999,
    lastChaseGoalFloor: 1,
    cachedDirectLos: false,
    cachedCanSee: false,
    directLosAccum: 0,
    wallSlideSign: 1,
  };
}

export interface SiblingBeastPosition {
  id: BeastId;
  x: number;
  feetY: number;
  z: number;
}

export interface StepBeastBrainInput {
  state: BeastBrainState;
  delta: number;
  playerX: number;
  playerFeetY: number;
  playerZ: number;
  controlMode: ControlMode;
  doorStates: Record<SpecialDoorKey, DoorAnimState>;
  /** Legacy flag kept for type compatibility — entering Mission Room must NOT alert Beasts! */
  missionAlerted?: boolean;
  /** True once the genuine Puzzle Room Key has been physically collected (triggers alarm ONCE). */
  keyAlarmTriggered?: boolean;
  /** True once the player enters the Puzzle Room. */
  beastAlerted: boolean;
  /** True while Puzzle Room containment protection is active (no Beast may enter or attack inside). */
  puzzleRoomProtected?: boolean;
  /** True once the 5-minute Puzzle Room timer reaches 0 (removes protection -> breach & attack). */
  puzzleTimerExpired?: boolean;
  /** True while the player is concealed inside a hiding spot. */
  playerHidden?: boolean;
  /** ID of the hiding spot the player is currently inside, if any. */
  playerHiddenSpotId?: string | null;
  /** Non-null if THIS specific Beast directly witnessed the player enter that hiding spot. */
  witnessedHidingSpotId?: string | null;
  /** Other active Beasts for smooth anti-overlap separation. */
  otherBeasts?: ReadonlyArray<SiblingBeastPosition>;
  /** Patrol/target node IDs already claimed by other Beasts so routes diverge naturally. */
  reservedPatrolNodeIds?: string[];
  profile?: BeastDifficultyProfile;
  nowMs?: number;
}

function normalizeAngleDelta(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function isOutsideBuildingFootprint(x: number, z: number): boolean {
  return Math.abs(x) > 27.4 || Math.abs(z) > 27.4;
}

function isPointInsidePuzzleRoom(x: number, feetY: number, z: number): boolean {
  if (Math.abs(feetY - PUZZLE_CHAMBER_BOUNDS.elevation) >= 1.8) return false;
  const puzzleFrame = getActivePuzzleFrame();
  const { lx, lz } = worldToRoomLocal(x, z, puzzleFrame);
  return Math.abs(lx) <= 2.95 && lz <= 5.8 && lz >= -5.9;
}

function isPlayerInsideProtectedZone(
  playerX: number,
  playerFeetY: number,
  playerZ: number,
  puzzleRoomProtected: boolean
): boolean {
  if (isOutsideBuildingFootprint(playerX, playerZ)) return true;
  if (puzzleRoomProtected && isPointInsidePuzzleRoom(playerX, playerFeetY, playerZ)) {
    return true;
  }
  return false;
}

export function stepBeastBrain(input: StepBeastBrainInput): BeastBrainEvent[] {
  const events: BeastBrainEvent[] = [];
  const st = input.state;
  const delta = Math.min(input.delta, 0.05);
  const profile = input.profile ?? BEAST_DIFFICULTY_PROFILES.early;
  const beastFloor = getFloorFromElevation(st.feetY);
  const playerFloor = getFloorFromElevation(input.playerFeetY);
  const puzzleRoomProtected = Boolean(input.puzzleRoomProtected);
  const playerHidden = Boolean(input.playerHidden);
  const playerInSafeOrProtected = isPlayerInsideProtectedZone(
    input.playerX,
    input.playerFeetY,
    input.playerZ,
    puzzleRoomProtected
  );

  // Decay barrier strike sword slash animation timer
  if (st.barrierStrikeAnimClock > 0) {
    st.barrierStrikeAnimClock = Math.max(0, st.barrierStrikeAnimClock - delta);
  }

  // Sync key-pickup alarm reset (e.g. if genuine key was returned after capture) & advance grace clock
  if (!input.keyAlarmTriggered && st.lastKeyAlarm) {
    st.lastKeyAlarm = false;
    st.keyAlarmElapsedSeconds = null;
  } else if (st.lastKeyAlarm && st.keyAlarmElapsedSeconds !== null) {
    st.keyAlarmElapsedSeconds += delta;
  }

  // Determine whether we are currently inside the 25s post-key-pickup escape window
  const willTriggerKeyAlarmNow = Boolean(input.keyAlarmTriggered) && !st.lastKeyAlarm;
  const effectiveAlarmElapsed = willTriggerKeyAlarmNow ? 0 : st.keyAlarmElapsedSeconds;
  const keyGraceApplicable = !input.beastAlerted && !input.puzzleTimerExpired;
  const alarmSpeedMult = keyGraceApplicable
    ? getKeyAlarmSpeedMultiplier(effectiveAlarmElapsed)
    : 1.0;
  const inKeyAlarmGrace =
    keyGraceApplicable &&
    effectiveAlarmElapsed !== null &&
    effectiveAlarmElapsed < KEY_ALARM_GRACE_SECONDS;

  // Sync hiding spot witness state
  if (!playerHidden) {
    st.witnessedHidingSpotId = null;
  } else if (input.witnessedHidingSpotId && st.witnessedHidingSpotId !== input.witnessedHidingSpotId) {
    st.witnessedHidingSpotId = input.witnessedHidingSpotId;
    const spot = getHidingSpotById(input.witnessedHidingSpotId);
    if (spot) {
      st.mode = 'investigate';
      st.patrolPauseTimer = 0;
      st.searchPauseTimer = 0;
      st.investigateTarget = {
        x: spot.exitPos[0],
        y: spot.exitPos[1],
        z: spot.exitPos[2],
        floor: spot.floor,
      };
      st.investigateTimeout = 24;
      st.waypoints = findNavPath({
        startX: st.x,
        startY: st.feetY,
        startZ: st.z,
        goalX: spot.exitPos[0],
        goalY: spot.exitPos[1],
        goalZ: spot.exitPos[2],
        doorStates: input.doorStates,
        puzzleRoomProtected,
      });
      events.push('investigate-started');
    }
  }

  // 0. Capture State (locks movement & plays capture animation before Game Over)
  if (st.mode === 'capture') {
    st.isMoving = false;
    st.currentSpeed = 0;
    st.smoothedSpeed = 0;
    st.velX = 0;
    st.velZ = 0;
    const dx = input.playerX - st.x;
    const dz = input.playerZ - st.z;
    if (dx * dx + dz * dz > 1e-4) {
      const desiredYaw = Math.atan2(dx, dz);
      const diff = normalizeAngleDelta(desiredYaw, st.yaw);
      const turnAlpha = 1 - Math.exp(-14 * delta);
      st.yaw += diff * turnAlpha;
      st.isTurning = Math.abs(diff) > 0.08;
    }
    st.captureTimer -= delta;
    if (st.captureTimer <= 0) {
      events.push('capture-completed');
    }
    return events;
  }

  // 1. Immediate Capture Proximity Check
  const distToPlayer2D = Math.hypot(input.playerX - st.x, input.playerZ - st.z);
  const verticalDiff = Math.abs(input.playerFeetY - st.feetY);

  if (input.controlMode !== 'orbit' && !playerInSafeOrProtected && !inKeyAlarmGrace) {
    if (playerHidden) {
      if (
        st.witnessedHidingSpotId &&
        st.witnessedHidingSpotId === input.playerHiddenSpotId
      ) {
        const spot = getHidingSpotById(st.witnessedHidingSpotId);
        if (spot) {
          const distToSpotExit = Math.hypot(spot.exitPos[0] - st.x, spot.exitPos[2] - st.z);
          if (Math.abs(spot.exitPos[1] - st.feetY) < 1.3 && distToSpotExit < 1.85) {
            st.mode = 'capture';
            st.captureTimer = BEAST_CAPTURE_DURATION;
            st.waypoints = [];
            st.isMoving = false;
            st.currentSpeed = 0;
            st.smoothedSpeed = 0;
            st.velX = 0;
            st.velZ = 0;
            events.push('capture-started');
            return events;
          }
        }
      }
    } else if (
      verticalDiff < 1.3 &&
      distToPlayer2D < BEAST_CATCH_RADIUS &&
      hasBeastLineOfSight(
        st.x,
        st.feetY,
        st.z,
        input.playerX,
        input.playerFeetY,
        input.playerZ,
        input.doorStates,
        { puzzleRoomProtected }
      )
    ) {
      st.mode = 'capture';
      st.captureTimer = BEAST_CAPTURE_DURATION;
      st.waypoints = [];
      st.isMoving = false;
      st.currentSpeed = 0;
      st.smoothedSpeed = 0;
      st.velX = 0;
      st.velZ = 0;
      events.push('capture-started');
      return events;
    }
  }

  // Build soft avoid set only when needed by pathfinding
  let avoidNodes: Set<string> | undefined;
  const getAvoidNodes = (): Set<string> | undefined => {
    if (avoidNodes !== undefined) return avoidNodes;
    if (input.reservedPatrolNodeIds && input.reservedPatrolNodeIds.length > 0) {
      avoidNodes = new Set(input.reservedPatrolNodeIds);
    }
    return avoidNodes;
  };

  // 2A. GENUINE KEY PICKUP ALARM (Happens ONCE — entering Mission Room alone NEVER triggers this!)
  if (input.keyAlarmTriggered && !st.lastKeyAlarm) {
    st.lastKeyAlarm = true;
    st.keyAlarmElapsedSeconds = 0;
    events.push('alarm-reaction');
    if (st.mode !== 'chase') {
      const [mx, mz] = getDynamicMissionTargetPos(st.id);
      st.mode = 'investigate';
      st.patrolPauseTimer = 0;
      st.searchPauseTimer = 0;
      st.investigateTarget = {
        x: mx,
        y: MISSION_ROOM_BOUNDS.elevation,
        z: mz,
        floor: MISSION_ROOM_BOUNDS.floor,
      };
      st.investigateTimeout = 36;
      st.waypoints = findNavPath({
        startX: st.x,
        startY: st.feetY,
        startZ: st.z,
        goalX: mx,
        goalY: MISSION_ROOM_BOUNDS.elevation,
        goalZ: mz,
        doorStates: input.doorStates,
        puzzleRoomProtected,
        avoidNodeIds: getAvoidNodes(),
      });
      events.push('investigate-started');
    }
  }

  // 2B. PUZZLE ROOM ENTERED — All four Beasts pursue toward the assigned Puzzle Room and gather outside the protected barrier
  if (input.beastAlerted && !st.lastPuzzleAlert) {
    st.lastPuzzleAlert = true;
    const [sx, sz] = getDynamicPuzzleSiegePos(st.id);
    st.mode = 'investigate';
    st.patrolPauseTimer = 0;
    st.searchPauseTimer = 0;
    st.investigateTarget = {
      x: sx,
      y: PUZZLE_CHAMBER_BOUNDS.elevation,
      z: sz,
      floor: PUZZLE_CHAMBER_BOUNDS.floor,
    };
    st.investigateTimeout = 40;
    st.waypoints = findNavPath({
      startX: st.x,
      startY: st.feetY,
      startZ: st.z,
      goalX: sx,
      goalY: PUZZLE_CHAMBER_BOUNDS.elevation,
      goalZ: sz,
      doorStates: input.doorStates,
      puzzleRoomProtected,
      avoidNodeIds: getAvoidNodes(),
    });
    events.push('investigate-started');
  }

  // 2C. PUZZLE TIMER EXPIRED — Protection dropped! All 4 Beasts immediately breach Puzzle Room to attack
  if (input.puzzleTimerExpired && !st.lastPuzzleBreach && !puzzleRoomProtected) {
    st.lastPuzzleBreach = true;
    st.mode = 'chase';
    st.chaseMemoryTimer = Math.max(profile.chaseMemorySeconds, 18);
    st.patrolPauseTimer = 0;
    st.searchPauseTimer = 0;
    st.lastKnownPlayerPos = {
      x: input.playerX,
      y: input.playerFeetY,
      z: input.playerZ,
      floor: playerFloor,
    };
    st.lastChaseGoalX = input.playerX;
    st.lastChaseGoalZ = input.playerZ;
    st.lastChaseGoalFloor = playerFloor;
    st.waypoints = findNavPath({
      startX: st.x,
      startY: st.feetY,
      startZ: st.z,
      goalX: input.playerX,
      goalY: input.playerFeetY,
      goalZ: input.playerZ,
      doorStates: input.doorStates,
      puzzleRoomProtected: false,
    });
    events.push('chase-started');
  }

  // 2D. Active Puzzle Room Siege Pressure
  const activePuzzleFrame = getActivePuzzleFrame();
  const [barrierDoorX, barrierDoorZ] = roomLocalToWorld(0, 5.7, activePuzzleFrame);
  const beastInPuzzleLocal = worldToRoomLocal(st.x, st.z, activePuzzleFrame);
  const isAtPuzzleSiegeZone =
    input.beastAlerted &&
    puzzleRoomProtected &&
    beastFloor === PUZZLE_CHAMBER_BOUNDS.floor &&
    beastInPuzzleLocal.lz >= 5.2 &&
    beastInPuzzleLocal.lz <= 10.8 &&
    Math.abs(beastInPuzzleLocal.lx) < 9.5;

  if (isAtPuzzleSiegeZone && playerInSafeOrProtected) {
    st.siegeAttackTimer -= delta;
    if (st.siegeAttackTimer <= 0) {
      st.siegeAttackTimer = 2.6 + Math.random() * 2.8;
      const distToBarrier = Math.hypot(st.x - barrierDoorX, st.z - barrierDoorZ);
      if (distToBarrier < 3.6) {
        st.barrierStrikeAnimClock = 0.72;
        events.push('barrier-strike');
      } else {
        events.push('siege-shout');
      }
    }
  }

  // 3. Distance & Floor-Aware Throttled AI Perception & Smart Chase Repathing
  st.aiTickAccum += delta;
  st.repathAccum += delta;
  st.directLosAccum += delta;

  const isFarOffFloor =
    beastFloor !== playerFloor &&
    distToPlayer2D > 18 &&
    st.mode !== 'chase' &&
    st.mode !== 'detect' &&
    !input.puzzleTimerExpired;
  const effectiveAiInterval = isFarOffFloor
    ? Math.max(profile.aiUpdateInterval, 0.34)
    : profile.aiUpdateInterval;

  if (st.aiTickAccum >= effectiveAiInterval) {
    st.aiTickAccum = 0;

    // 3A. Vision + Line-of-Sight Detection
    const canSeePlayer =
      input.controlMode !== 'orbit' &&
      !playerHidden &&
      !playerInSafeOrProtected &&
      canBeastSeePlayer({
        beastX: st.x,
        beastY: st.feetY,
        beastZ: st.z,
        beastYaw: st.yaw,
        playerX: input.playerX,
        playerY: input.playerFeetY,
        playerZ: input.playerZ,
        visionRange: profile.visionRange,
        visionFovDeg: profile.visionFovDeg,
        proximitySenseRadius: profile.proximitySenseRadius,
        doorStates: input.doorStates,
        playerHidden,
        puzzleRoomProtected,
      });

    st.cachedCanSee = canSeePlayer;

    if (canSeePlayer) {
      st.lastKnownPlayerPos = {
        x: input.playerX,
        y: input.playerFeetY,
        z: input.playerZ,
        floor: playerFloor,
      };
      st.chaseMemoryTimer = profile.chaseMemorySeconds;

      if (st.mode !== 'chase' && st.mode !== 'detect') {
        st.mode = 'detect';
        st.detectTimer = distToPlayer2D < 5.5 ? 0.14 : profile.detectConfirmSeconds;
        st.waypoints = [];
        events.push('detect-warning');
      }
    }

    // 3B. Sound Detection (when not actively chasing or locked onto a witnessed hiding spot)
    if (st.mode !== 'chase' && st.mode !== 'detect' && !st.witnessedHidingSpotId) {
      const heard = getAudibleSoundForBeast({
        beastX: st.x,
        beastY: st.feetY,
        beastZ: st.z,
        beastFloor,
        hearingMultiplier: profile.hearingMultiplier,
        lastProcessedId: st.lastProcessedSoundId,
        nowMs: input.nowMs,
      });

      if (heard) {
        st.lastProcessedSoundId = heard.event.id;
        if (!isOutsideBuildingFootprint(heard.event.x, heard.event.z)) {
          const wasIdleOrPatrol = st.mode === 'patrol' || st.mode === 'search';
          st.mode = 'investigate';
          st.patrolPauseTimer = 0;
          st.searchPauseTimer = 0;

          const insideProtectedPuzzle =
            puzzleRoomProtected &&
            isPointInsidePuzzleRoom(heard.event.x, heard.event.y, heard.event.z);

          const [siegeX, siegeZ] = getDynamicPuzzleSiegePos(st.id);
          const goalX = insideProtectedPuzzle ? siegeX : heard.event.x;
          const goalY = heard.event.y;
          const goalZ = insideProtectedPuzzle ? siegeZ : heard.event.z;

          st.investigateTarget = {
            x: goalX,
            y: goalY,
            z: goalZ,
            floor: heard.event.floor,
          };
          st.investigateTimeout = 18.0;
          st.waypoints = findNavPath({
            startX: st.x,
            startY: st.feetY,
            startZ: st.z,
            goalX,
            goalY,
            goalZ,
            doorStates: input.doorStates,
            puzzleRoomProtected,
            avoidNodeIds: getAvoidNodes(),
          });
          if (wasIdleOrPatrol) {
            events.push('investigate-started');
          }
        }
      }
    }

    // 3C. Smart Chase Repathing: avoid recalculating A* when the goal hasn't meaningfully moved
    const onStairFlight = st.waypoints[0]?.kind.startsWith('stair-') ?? false;
    if (st.mode === 'chase' && !onStairFlight) {
      const goal = canSeePlayer
        ? { x: input.playerX, y: input.playerFeetY, z: input.playerZ, floor: playerFloor }
        : input.puzzleTimerExpired &&
            !puzzleRoomProtected &&
            !playerHidden &&
            !isOutsideBuildingFootprint(input.playerX, input.playerZ)
          ? { x: input.playerX, y: input.playerFeetY, z: input.playerZ, floor: playerFloor }
          : st.lastKnownPlayerPos ?? {
              x: input.playerX,
              y: input.playerFeetY,
              z: input.playerZ,
              floor: playerFloor,
            };

      const goalShiftSq =
        (goal.x - st.lastChaseGoalX) * (goal.x - st.lastChaseGoalX) +
        (goal.z - st.lastChaseGoalZ) * (goal.z - st.lastChaseGoalZ);
      const goalFloorChanged =
        st.lastObservedPlayerFloor !== playerFloor || st.lastChaseGoalFloor !== goal.floor;
      const needsRepath =
        st.waypoints.length === 0 ||
        goalFloorChanged ||
        (st.repathAccum >= 0.35 && goalShiftSq >= 1.56) ||
        st.repathAccum >= 1.15;

      if (needsRepath) {
        st.repathAccum = 0;
        st.lastObservedPlayerFloor = playerFloor;
        st.lastChaseGoalX = goal.x;
        st.lastChaseGoalZ = goal.z;
        st.lastChaseGoalFloor = goal.floor;

        st.waypoints = findNavPath({
          startX: st.x,
          startY: st.feetY,
          startZ: st.z,
          goalX: goal.x,
          goalY: goal.y,
          goalZ: goal.z,
          doorStates: input.doorStates,
          puzzleRoomProtected,
        });
      }
    }
  }

  // 4. FSM State Transitions & Movement Target Selection
  let moveTargetX: number | null = null;
  let moveTargetZ: number | null = null;
  let activeSpeed = 0;
  let isFinalWaypoint = false;

  if (st.mode === 'detect') {
    activeSpeed = 0;
    const lookTarget = st.lastKnownPlayerPos ?? {
      x: input.playerX,
      y: input.playerFeetY,
      z: input.playerZ,
    };
    const dx = lookTarget.x - st.x;
    const dz = lookTarget.z - st.z;
    if (dx * dx + dz * dz > 1e-4) {
      const desiredYaw = Math.atan2(dx, dz);
      const diff = normalizeAngleDelta(desiredYaw, st.yaw);
      const turnAlpha = 1 - Math.exp(-profile.turnSpeedRad * 1.35 * delta);
      st.yaw += diff * turnAlpha;
      st.isTurning = Math.abs(diff) > 0.08;
    }

    st.detectTimer -= delta;
    if (st.detectTimer <= 0) {
      const stillVisible =
        input.controlMode !== 'orbit' &&
        !playerHidden &&
        !playerInSafeOrProtected &&
        canBeastSeePlayer({
          beastX: st.x,
          beastY: st.feetY,
          beastZ: st.z,
          beastYaw: st.yaw,
          playerX: input.playerX,
          playerY: input.playerFeetY,
          playerZ: input.playerZ,
          visionRange: profile.visionRange * 1.1,
          visionFovDeg: profile.visionFovDeg + 20,
          proximitySenseRadius: profile.proximitySenseRadius * 1.3,
          doorStates: input.doorStates,
          playerHidden,
          puzzleRoomProtected,
        });

      if (stillVisible || (!playerHidden && !playerInSafeOrProtected && distToPlayer2D < 5.5)) {
        st.mode = 'chase';
        st.chaseMemoryTimer = profile.chaseMemorySeconds;
        st.repathAccum = 0;
        st.directLosAccum = 1; // Refresh LOS immediately on chase start
        st.lastObservedPlayerFloor = playerFloor;
        st.lastChaseGoalX = input.playerX;
        st.lastChaseGoalZ = input.playerZ;
        st.lastChaseGoalFloor = playerFloor;
        st.waypoints = findNavPath({
          startX: st.x,
          startY: st.feetY,
          startZ: st.z,
          goalX: input.playerX,
          goalY: input.playerFeetY,
          goalZ: input.playerZ,
          doorStates: input.doorStates,
          puzzleRoomProtected,
        });
        events.push('chase-started');
      } else if (st.lastKnownPlayerPos) {
        st.mode = 'investigate';
        st.investigateTarget = { ...st.lastKnownPlayerPos };
        st.investigateTimeout = 12;
        st.waypoints = findNavPath({
          startX: st.x,
          startY: st.feetY,
          startZ: st.z,
          goalX: st.lastKnownPlayerPos.x,
          goalY: st.lastKnownPlayerPos.y,
          goalZ: st.lastKnownPlayerPos.z,
          doorStates: input.doorStates,
          puzzleRoomProtected,
        });
        events.push('investigate-started');
      } else {
        st.mode = 'patrol';
      }
    }
  } else if (st.mode === 'chase') {
    activeSpeed = profile.chaseSpeed * alarmSpeedMult;

    // Refresh direct chase LOS at ~12.5 Hz (every 0.08s) instead of redundant double-LOS every 60Hz frame
    if (
      input.controlMode === 'orbit' ||
      playerHidden ||
      playerInSafeOrProtected ||
      verticalDiff >= 1.2 ||
      distToPlayer2D >= 10.5
    ) {
      st.cachedDirectLos = false;
    } else if (st.directLosAccum >= 0.08) {
      st.directLosAccum = 0;
      st.cachedDirectLos = hasBeastLineOfSight(
        st.x,
        st.feetY,
        st.z,
        input.playerX,
        input.playerFeetY,
        input.playerZ,
        input.doorStates,
        { puzzleRoomProtected }
      );
    }

    if (st.cachedDirectLos) {
      moveTargetX = input.playerX;
      moveTargetZ = input.playerZ;
      st.lastKnownPlayerPos = {
        x: input.playerX,
        y: input.playerFeetY,
        z: input.playerZ,
        floor: playerFloor,
      };
      st.chaseMemoryTimer = profile.chaseMemorySeconds;
    } else {
      if (st.cachedCanSee && !playerHidden && !playerInSafeOrProtected && input.controlMode !== 'orbit') {
        st.lastKnownPlayerPos = {
          x: input.playerX,
          y: input.playerFeetY,
          z: input.playerZ,
          floor: playerFloor,
        };
        st.chaseMemoryTimer = profile.chaseMemorySeconds;
      } else if (
        input.puzzleTimerExpired &&
        !puzzleRoomProtected &&
        !playerHidden &&
        !isOutsideBuildingFootprint(input.playerX, input.playerZ)
      ) {
        st.lastKnownPlayerPos = {
          x: input.playerX,
          y: input.playerFeetY,
          z: input.playerZ,
          floor: playerFloor,
        };
        st.chaseMemoryTimer = Math.max(st.chaseMemoryTimer, 4.0);
      } else {
        st.chaseMemoryTimer -= delta;
      }

      if (st.chaseMemoryTimer <= 0) {
        st.mode = 'search';
        st.searchTimer = profile.searchDurationSeconds;
        st.searchPauseTimer = 0.6;
        const center = st.lastKnownPlayerPos ?? {
          x: st.x,
          y: st.feetY,
          z: st.z,
          floor: beastFloor,
        };
        st.searchQueue = pickSearchTargetNodes({
          x: center.x,
          y: center.y,
          z: center.z,
          doorStates: input.doorStates,
          count: 4,
          puzzleRoomProtected,
        });
        st.waypoints = findNavPath({
          startX: st.x,
          startY: st.feetY,
          startZ: st.z,
          goalX: center.x,
          goalY: center.y,
          goalZ: center.z,
          doorStates: input.doorStates,
          puzzleRoomProtected,
        });
        events.push('search-started');
      } else if (st.waypoints.length > 0) {
        const wp = st.waypoints[0];
        const isStairWp = wp.kind.startsWith('stair-');
        const nextIsSameFloor =
          st.waypoints.length > 1 &&
          !isStairWp &&
          !st.waypoints[1].kind.startsWith('stair-') &&
          Math.abs(st.waypoints[1].y - wp.y) < 0.5;
        const reachRadius = nextIsSameFloor ? 0.85 : isStairWp ? 0.55 : 0.65;
        if (Math.hypot(wp.x - st.x, wp.z - st.z) < reachRadius && Math.abs(wp.y - st.feetY) < 1.35) {
          st.waypoints.shift();
        }
        if (st.waypoints.length > 0) {
          moveTargetX = st.waypoints[0].x;
          moveTargetZ = st.waypoints[0].z;
        }
      } else if (st.lastKnownPlayerPos && !playerInSafeOrProtected) {
        moveTargetX = st.lastKnownPlayerPos.x;
        moveTargetZ = st.lastKnownPlayerPos.z;
      }
    }
  } else if (st.mode === 'investigate') {
    activeSpeed =
      alarmSpeedMult < 1
        ? Math.min(profile.investigateSpeed, profile.chaseSpeed * alarmSpeedMult)
        : profile.investigateSpeed;
    st.investigateTimeout -= delta;

    if (st.waypoints.length > 0) {
      const wp = st.waypoints[0];
      const isStairWp = wp.kind.startsWith('stair-');
      const nextIsSameFloor =
        st.waypoints.length > 1 &&
        !isStairWp &&
        !st.waypoints[1].kind.startsWith('stair-') &&
        Math.abs(st.waypoints[1].y - wp.y) < 0.5;
      const reachRadius = nextIsSameFloor ? 0.82 : isStairWp ? 0.55 : 0.62;
      if (Math.hypot(wp.x - st.x, wp.z - st.z) < reachRadius && Math.abs(wp.y - st.feetY) < 1.35) {
        st.waypoints.shift();
      }
      if (st.waypoints.length > 0) {
        moveTargetX = st.waypoints[0].x;
        moveTargetZ = st.waypoints[0].z;
        isFinalWaypoint = st.waypoints.length === 1 && !st.investigateTarget;
      }
    }

    if (moveTargetX === null && st.waypoints.length === 0 && st.investigateTarget) {
      const distGoal = Math.hypot(st.investigateTarget.x - st.x, st.investigateTarget.z - st.z);
      if (
        Math.abs(st.investigateTarget.y - st.feetY) < 1.3 &&
        distGoal > 0.7 &&
        distGoal < 4.5 &&
        hasBeastLineOfSight(
          st.x,
          st.feetY,
          st.z,
          st.investigateTarget.x,
          st.investigateTarget.y,
          st.investigateTarget.z,
          input.doorStates,
          { ignoreHidingSpots: true, puzzleRoomProtected }
        )
      ) {
        moveTargetX = st.investigateTarget.x;
        moveTargetZ = st.investigateTarget.z;
        isFinalWaypoint = true;
      }
    }

    const reachedExactTarget =
      moveTargetX === null && (st.waypoints.length === 0 || st.investigateTimeout <= 0);

    if (reachedExactTarget) {
      const center = st.investigateTarget ?? {
        x: st.x,
        y: st.feetY,
        z: st.z,
        floor: beastFloor,
      };
      st.mode = 'search';
      st.searchTimer = profile.searchDurationSeconds * 0.9;
      st.searchPauseTimer = 0.65;
      st.lastKnownPlayerPos = { ...center };
      st.searchQueue = pickSearchTargetNodes({
        x: center.x,
        y: center.y,
        z: center.z,
        doorStates: input.doorStates,
        count: 3,
        puzzleRoomProtected,
      });
      st.waypoints = [];
      events.push('search-started');
      events.push('servo-scan');
    }
  } else if (st.mode === 'search') {
    activeSpeed =
      alarmSpeedMult < 1
        ? Math.min(profile.searchSpeed, profile.chaseSpeed * alarmSpeedMult)
        : profile.searchSpeed;
    st.searchTimer -= delta;

    if (st.searchPauseTimer > 0) {
      st.searchPauseTimer -= delta;
      activeSpeed = 0;
      if (isAtPuzzleSiegeZone) {
        const desiredYaw = Math.atan2(barrierDoorX - st.x, barrierDoorZ - st.z);
        const diff = normalizeAngleDelta(desiredYaw, st.yaw);
        st.yaw += diff * (1 - Math.exp(-profile.turnSpeedRad * delta));
      }
    } else if (st.waypoints.length > 0) {
      const wp = st.waypoints[0];
      const isStairWp = wp.kind.startsWith('stair-');
      const nextIsSameFloor =
        st.waypoints.length > 1 &&
        !isStairWp &&
        !st.waypoints[1].kind.startsWith('stair-') &&
        Math.abs(st.waypoints[1].y - wp.y) < 0.5;
      const reachRadius = nextIsSameFloor ? 0.8 : isStairWp ? 0.55 : 0.6;
      if (Math.hypot(wp.x - st.x, wp.z - st.z) < reachRadius && Math.abs(wp.y - st.feetY) < 1.35) {
        st.waypoints.shift();
        if (st.waypoints.length === 0) {
          st.searchPauseTimer = 0.9;
          events.push('servo-scan');
        }
      }
      if (st.waypoints.length > 0) {
        moveTargetX = st.waypoints[0].x;
        moveTargetZ = st.waypoints[0].z;
        isFinalWaypoint = st.waypoints.length === 1;
      }
    } else if (st.searchQueue.length > 0) {
      const nextNode = st.searchQueue.shift()!;
      st.waypoints = findNavPath({
        startX: st.x,
        startY: st.feetY,
        startZ: st.z,
        goalX: nextNode.x,
        goalY: nextNode.y,
        goalZ: nextNode.z,
        doorStates: input.doorStates,
        goalNodeIdOverride: nextNode.id,
        puzzleRoomProtected,
        avoidNodeIds: getAvoidNodes(),
      });
    }

    if (
      st.searchTimer <= 0 ||
      (st.waypoints.length === 0 && st.searchQueue.length === 0 && st.searchPauseTimer <= 0)
    ) {
      if (input.beastAlerted && puzzleRoomProtected) {
        const [sx, sz] = getDynamicPuzzleSiegePos(st.id);
        const jitterAlong = (Math.random() - 0.5) * 4.5;
        const siegeLocal = worldToRoomLocal(sx, sz, activePuzzleFrame);
        const [jx, jz] = roomLocalToWorld(siegeLocal.lx + jitterAlong, siegeLocal.lz, activePuzzleFrame);
        st.mode = 'investigate';
        st.investigateTarget = {
          x: Math.max(-14.8, Math.min(14.8, jx)),
          y: PUZZLE_CHAMBER_BOUNDS.elevation,
          z: Math.max(-14.8, Math.min(14.8, jz)),
          floor: PUZZLE_CHAMBER_BOUNDS.floor,
        };
        st.investigateTimeout = 14;
        st.waypoints = findNavPath({
          startX: st.x,
          startY: st.feetY,
          startZ: st.z,
          goalX: st.investigateTarget.x,
          goalY: st.investigateTarget.y,
          goalZ: st.investigateTarget.z,
          doorStates: input.doorStates,
          puzzleRoomProtected,
          avoidNodeIds: getAvoidNodes(),
        });
      } else {
        st.mode = 'patrol';
        st.waypoints = [];
        st.patrolPauseTimer = 0.4;
      }
    }
  } else {
    // PATROL
    activeSpeed = profile.patrolSpeed;
    if (st.patrolPauseTimer > 0) {
      st.patrolPauseTimer -= delta;
      activeSpeed = 0;
    } else if (st.waypoints.length === 0) {
      if (input.beastAlerted && puzzleRoomProtected) {
        const [sx, sz] = getDynamicPuzzleSiegePos(st.id);
        st.mode = 'investigate';
        st.investigateTarget = {
          x: sx,
          y: PUZZLE_CHAMBER_BOUNDS.elevation,
          z: sz,
          floor: PUZZLE_CHAMBER_BOUNDS.floor,
        };
        st.investigateTimeout = 30;
        st.waypoints = findNavPath({
          startX: st.x,
          startY: st.feetY,
          startZ: st.z,
          goalX: sx,
          goalY: PUZZLE_CHAMBER_BOUNDS.elevation,
          goalZ: sz,
          doorStates: input.doorStates,
          puzzleRoomProtected,
          avoidNodeIds: getAvoidNodes(),
        });
      } else {
        const biasFloor =
          profile.stage === 'puzzle' || profile.stage === 'escape' ? playerFloor : undefined;
        const targetNode = pickPatrolTargetNode({
          currentFloor: beastFloor,
          recentNodeIds: st.recentNodeIds,
          doorStates: input.doorStates,
          biasFloor,
          preferredFloors: st.preferredFloors,
          reservedNodeIds: input.reservedPatrolNodeIds,
          puzzleRoomProtected,
        });
        st.assignedTargetNodeId = targetNode.id;
        st.recentNodeIds.push(targetNode.id);
        if (st.recentNodeIds.length > 8) st.recentNodeIds.shift();

        st.waypoints = findNavPath({
          startX: st.x,
          startY: st.feetY,
          startZ: st.z,
          goalX: targetNode.x,
          goalY: targetNode.y,
          goalZ: targetNode.z,
          doorStates: input.doorStates,
          goalNodeIdOverride: targetNode.id,
          puzzleRoomProtected,
          avoidNodeIds: getAvoidNodes(),
        });
      }
    }

    if (st.patrolPauseTimer <= 0 && st.waypoints.length > 0) {
      const wp = st.waypoints[0];
      const isStairWp = wp.kind.startsWith('stair-');
      const nextIsSameFloor =
        st.waypoints.length > 1 &&
        !isStairWp &&
        !st.waypoints[1].kind.startsWith('stair-') &&
        Math.abs(st.waypoints[1].y - wp.y) < 0.5;
      const reachRadius = nextIsSameFloor ? 0.8 : isStairWp ? 0.55 : 0.6;
      if (Math.hypot(wp.x - st.x, wp.z - st.z) < reachRadius && Math.abs(wp.y - st.feetY) < 1.35) {
        st.waypoints.shift();
        if (st.waypoints.length === 0) {
          const [minP, maxP] = profile.patrolPauseSeconds;
          st.patrolPauseTimer = minP + Math.random() * (maxP - minP);
          if (Math.random() < 0.45) events.push('servo-scan');
        }
      }
      if (st.waypoints.length > 0) {
        moveTargetX = st.waypoints[0].x;
        moveTargetZ = st.waypoints[0].z;
        isFinalWaypoint = st.waypoints.length === 1;
      }
    }
  }

  // 5. Smooth Physical Movement with Acceleration/Deceleration, Sibling Separation & Collision
  st.isTurning = false;

  // Smooth anti-overlap repulsion from nearby sibling Beasts on the same elevation
  let sepX = 0;
  let sepZ = 0;
  if (input.otherBeasts && input.otherBeasts.length > 0) {
    const MIN_SEP = 1.38;
    for (let i = 0; i < input.otherBeasts.length; i++) {
      const other = input.otherBeasts[i];
      if (other.id === st.id) continue;
      if (Math.abs(other.feetY - st.feetY) > 1.45) continue;
      const rx = st.x - other.x;
      const rz = st.z - other.z;
      const dSq = rx * rx + rz * rz;
      if (dSq < MIN_SEP * MIN_SEP) {
        const d = Math.sqrt(dSq);
        const push = (MIN_SEP - d) / MIN_SEP;
        const smoothPush = push * push * 2.4;
        if (d > 1e-4) {
          sepX += (rx / d) * smoothPush;
          sepZ += (rz / d) * smoothPush;
        } else {
          const angle = (st.id - other.id) * 1.57;
          sepX += Math.cos(angle) * 1.4;
          sepZ += Math.sin(angle) * 1.4;
        }
      }
    }
  }

  // Compute desired horizontal velocity with smooth cosine turn slowdown & gentle stop approach
  let desiredVelX = sepX;
  let desiredVelZ = sepZ;
  let hasMoveIntent = false;
  let desiredSpeedMag = 0;

  if (moveTargetX !== null && moveTargetZ !== null && activeSpeed > 0) {
    const dx = moveTargetX - st.x;
    const dz = moveTargetZ - st.z;
    const moveDist = Math.hypot(dx, dz);

    if (moveDist > 0.04) {
      hasMoveIntent = true;
      const invDist = 1 / moveDist;
      const dirX = dx * invDist;
      const dirZ = dz * invDist;

      const desiredYaw = Math.atan2(dx, dz);
      const yawDiff = normalizeAngleDelta(desiredYaw, st.yaw);
      const turnRate = st.mode === 'chase' ? profile.turnSpeedRad * 1.15 : profile.turnSpeedRad;
      const turnAlpha = 1 - Math.exp(-turnRate * delta);
      st.yaw += yawDiff * turnAlpha;
      st.isTurning = Math.abs(yawDiff) > 0.14;

      // Smooth cosine alignment factor (eliminates binary 1.2 rad speed drop!)
      const cosAlign = Math.max(0, Math.cos(yawDiff));
      const turnFactor = 0.42 + 0.58 * Math.pow(cosAlign, 0.72);

      // Gentle arrival deceleration on final waypoint of patrol/search/investigate
      const arrivalFactor =
        isFinalWaypoint && moveDist < 0.95 ? Math.max(0.32, moveDist / 0.95) : 1.0;

      const effectiveSpeed = activeSpeed * turnFactor * arrivalFactor;
      desiredSpeedMag = effectiveSpeed;

      // Clamp step so we never overshoot the target on a frame
      const maxVel = moveDist / Math.max(delta, 0.016);
      const cappedSpeed = Math.min(effectiveSpeed, maxVel);

      desiredVelX = dirX * cappedSpeed + sepX;
      desiredVelZ = dirZ * cappedSpeed + sepZ;
    }
  }

  // Frame-rate independent smooth velocity acceleration & deceleration
  const velLambda = hasMoveIntent
    ? st.mode === 'chase'
      ? 11.5
      : 8.5
    : 11.0;
  const velAlpha = 1 - Math.exp(-velLambda * delta);
  st.velX += (desiredVelX - st.velX) * velAlpha;
  st.velZ += (desiredVelZ - st.velZ) * velAlpha;

  const velMagSq = st.velX * st.velX + st.velZ * st.velZ;
  if (velMagSq > 1e-4) {
    const prevX = st.x;
    const prevZ = st.z;
    const stepX = st.velX * delta;
    const stepZ = st.velZ * delta;

    let resolved = resolvePlayerMovement({
      x: prevX + stepX,
      z: prevZ + stepZ,
      feetY: st.feetY,
      radius: 0.42,
      doorStates: input.doorStates,
      isBeast: true,
      puzzleRoomProtected,
    });

    let actualDx = resolved.x - prevX;
    let actualDz = resolved.z - prevZ;
    let actualDisp = Math.hypot(actualDx, actualDz);
    const desiredDisp = Math.hypot(stepX, stepZ);

    // Subtle tangential wall-slide assist if a doorway/furniture corner stalls forward progress
    if (hasMoveIntent && desiredDisp > 0.01 && actualDisp < desiredDisp * 0.28) {
      const invDes = 1 / desiredDisp;
      const tangX = -(stepZ * invDes) * st.wallSlideSign * desiredDisp * 0.72;
      const tangZ = (stepX * invDes) * st.wallSlideSign * desiredDisp * 0.72;
      const alt = resolvePlayerMovement({
        x: prevX + stepX * 0.45 + tangX,
        z: prevZ + stepZ * 0.45 + tangZ,
        feetY: st.feetY,
        radius: 0.42,
        doorStates: input.doorStates,
        isBeast: true,
        puzzleRoomProtected,
      });
      const altDisp = Math.hypot(alt.x - prevX, alt.z - prevZ);
      if (altDisp > actualDisp + 0.004) {
        resolved = alt;
        actualDx = resolved.x - prevX;
        actualDz = resolved.z - prevZ;
        actualDisp = altDisp;
      } else {
        st.wallSlideSign = -st.wallSlideSign;
      }
    }

    st.x = resolved.x;
    st.z = resolved.z;

    // Ground elevation smoothly tracks stairs & flat floors
    const nextY = resolveSurfaceElevation(resolved.x, resolved.z, st.feetY);
    const yRate = 1 - Math.exp(-18 * delta);
    st.feetY = st.feetY + (nextY - st.feetY) * yRate;

    // Project stored velocity toward collision-resolved velocity so it doesn't build up against walls
    if (delta > 1e-4) {
      const resVx = actualDx / delta;
      const resVz = actualDz / delta;
      const projAlpha = 1 - Math.exp(-14 * delta);
      st.velX += (resVx - st.velX) * projAlpha;
      st.velZ += (resVz - st.velZ) * projAlpha;
    }

    const actualSpeed = delta > 1e-4 ? actualDisp / delta : 0;
    const speedSmoothAlpha = 1 - Math.exp(-12 * delta);
    st.smoothedSpeed += (actualSpeed - st.smoothedSpeed) * speedSmoothAlpha;
    st.currentSpeed = st.smoothedSpeed;
    st.isMoving = st.smoothedSpeed > 0.12;

    // Distance-coupled stride phase -> ZERO foot sliding even when slowing/turning/blocked!
    if (actualDisp > 1e-5) {
      const strideScale = st.mode === 'chase' ? 2.95 : 2.5;
      st.walkPhase += actualDisp * strideScale;
    }

    // Anti-stuck corner recovery (only when actively trying to reach waypoints)
    if (hasMoveIntent && desiredSpeedMag > 0.4) {
      st.stuckCheckAccum += delta;
      if (st.stuckCheckAccum >= 0.65) {
        const progressed = Math.hypot(st.x - st.lastCheckX, st.z - st.lastCheckZ);
        st.lastCheckX = st.x;
        st.lastCheckZ = st.z;
        st.stuckCheckAccum = 0;

        if (progressed < 0.22 && st.waypoints.length > 0) {
          const lastWp = st.waypoints[st.waypoints.length - 1];
          st.waypoints = findNavPath({
            startX: st.x,
            startY: st.feetY,
            startZ: st.z,
            goalX: lastWp.x,
            goalY: lastWp.y,
            goalZ: lastWp.z,
            doorStates: input.doorStates,
            puzzleRoomProtected,
            avoidNodeIds: getAvoidNodes(),
          });
          if (st.waypoints.length > 1) st.waypoints.shift();
        }
      }
    } else {
      st.stuckCheckAccum = 0;
      st.lastCheckX = st.x;
      st.lastCheckZ = st.z;
    }
  } else {
    st.velX = 0;
    st.velZ = 0;
    st.smoothedSpeed *= Math.exp(-14 * delta);
    if (st.smoothedSpeed < 0.02) st.smoothedSpeed = 0;
    st.currentSpeed = st.smoothedSpeed;
    st.isMoving = false;

    const nextY = resolveSurfaceElevation(st.x, st.z, st.feetY);
    const yRate = 1 - Math.exp(-18 * delta);
    st.feetY = st.feetY + (nextY - st.feetY) * yRate;
    st.stuckCheckAccum = 0;
    st.lastCheckX = st.x;
    st.lastCheckZ = st.z;
  }

  return events;
}
