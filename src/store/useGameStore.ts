import { create } from 'zustand';
import {
  BeastAiMode,
  BeastId,
  BeastTelemetryEntry,
  CameraPreset,
  CameraViewMode,
  ControlMode,
  DoorAnimState,
  FloorNumber,
  GameStage,
  KeyCellId,
  KeyCellState,
  KeyCellVariant,
  ProgressionState,
  PuzzleCategoryId,
  PuzzleId,
  PuzzleStage,
  ScreenPhase,
  SpecialDoorKey,
} from '../types/game';
import {
  GeneratedPuzzleSession,
  generatePuzzleSessionBundle,
  PUZZLE_MAX_ATTEMPTS,
  PUZZLE_TIME_LIMIT_SECONDS,
} from '../data/puzzleConfig';
import { BEAST_ROSTER } from '../data/beastConfig';
import {
  getActiveRoomAssignment,
  getMissionRoomNumber,
  MISSION_KEY_CELLS,
  MISSION_ROOM_BOUNDS,
  randomizeSpecialRooms,
  SPECIAL_ROOMS_CONFIG,
} from '../data/buildingLayout';
import {
  playerWorldPos,
  triggerPlayerActionAnim,
  virtualInput,
} from '../three/playerWorldState';
import {
  clampCameraDistance,
  DEFAULT_CAMERA_DISTANCE,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
} from '../three/thirdPersonCamera';
import { clearSoundEvents, emitSoundEvent } from '../three/soundBus';
import {
  initAudioContext,
  playBeastAlertSiren,
  playDoorSound,
  playEmergencyExitSound,
  playHideTransitionSound,
  playKeyPickupSound,
  playKeypadBeep,
  playPuzzleCompleteSound,
  playSafeRoomUnlockSound,
  playTimerWarningSound,
  playVictoryEscapeSound,
  setAudioSettings,
  startEmergencyAlarmSiren,
  stopEmergencyAlarmSiren,
} from '../three/soundEffects';

export const DEFAULT_MOUSE_SENSITIVITY = 1.0;
export const MIN_MOUSE_SENSITIVITY = 0.2;
export const MAX_MOUSE_SENSITIVITY = 3.0;
export const MAX_RESPAWNS = 3;
export const SETTINGS_STORAGE_KEY = 'last_exit_settings_v1';

export function clampMouseSensitivity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MOUSE_SENSITIVITY;
  const clamped = Math.min(MAX_MOUSE_SENSITIVITY, Math.max(MIN_MOUSE_SENSITIVITY, value));
  return Math.round(clamped * 10) / 10;
}

function loadSavedMouseSensitivity(): number {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_MOUSE_SENSITIVITY;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_MOUSE_SENSITIVITY;
    const parsed = JSON.parse(raw) as { mouseSensitivity?: unknown };
    if (typeof parsed.mouseSensitivity === 'number') {
      return clampMouseSensitivity(parsed.mouseSensitivity);
    }
  } catch {
    // Ignore malformed storage entries
  }
  return DEFAULT_MOUSE_SENSITIVITY;
}

function saveMouseSensitivity(value: number): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...existing, mouseSensitivity: value })
    );
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export {
  clampCameraDistance,
  DEFAULT_CAMERA_DISTANCE,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
};

function loadSavedCameraDistance(): number {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_CAMERA_DISTANCE;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_CAMERA_DISTANCE;
    const parsed = JSON.parse(raw) as { cameraDistance?: unknown };
    if (typeof parsed.cameraDistance === 'number') {
      return clampCameraDistance(parsed.cameraDistance);
    }
  } catch {
    // Ignore malformed storage entries
  }
  return DEFAULT_CAMERA_DISTANCE;
}

function saveCameraDistance(value: number): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...existing, cameraDistance: value })
    );
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export type PuzzleWarningLevel = 'none' | '60s' | '30s';
export type GameOverReason = 'beast-capture' | 'puzzle-timeout';

export interface GameState {
  // Centralized Progression State Machine & Limited Respawn System (Max 3)
  progression: ProgressionState;
  preCatchProgression: ProgressionState;
  gameOverReason: GameOverReason;
  respawnsRemaining: number;
  permanentGameOver: boolean;
  keyReturnedOnCatch: boolean;

  // Dynamic Session Room Assignment (Re-randomized on New Game / Restart, preserved on Respawns)
  layoutVersion: number;
  missionRoomId: string;
  puzzleRoomId: string;
  missionRoomNumber: string;
  puzzleRoomNumber: string;
  missionFloor: FloorNumber;
  puzzleFloor: FloorNumber;

  // Navigation & camera mode
  controlMode: ControlMode;
  activeFloor: FloorNumber | 'all';
  cameraPreset: CameraPreset;
  cameraViewMode: CameraViewMode;
  presetVersion: number;

  // Screen Flow, Menu, Loading, Player Posture & Four-Beast World State
  screenPhase: ScreenPhase;
  sceneLoadProgress: number;
  sceneReady: boolean;
  loadingSequenceTrigger: number;
  introSequenceTrigger: number;
  introSegmentIndex: 0 | 1 | 2 | 3 | 4;
  introShowDirective: boolean;
  surviveBannerVisible: boolean;
  isRestarting: boolean;
  playerCrouched: boolean;
  inMainMenu: boolean;
  gamePaused: boolean;
  playerFloor: FloorNumber;
  beasts: BeastTelemetryEntry[];
  beastFloor: FloorNumber;
  beastAiMode: BeastAiMode;
  beastDistance: number;
  beastThreatLabel: string;
  beastLastKnownFloor: FloorNumber | null;
  beastCapturing: boolean;
  playerSpawnTarget: 'f1-entry' | 'f1-lobby' | 'f2-mission' | 'f3-puzzle' | 'f4-exit';
  playerSpawnTrigger: number;
  beastResetTrigger: number;
  pointerLocked: boolean;
  interactionPrompt: string | null;
  doorFeedback: { text: string; tone: 'error' | 'info' | 'success'; seq: number } | null;
  nearbyDoorId: string | null;
  nearbyPuzzleTerminalId: string | null;
  nearbyKeyCellId: KeyCellId | null;
  nearbyHidingSpotId: string | null;
  nearbyExteriorInteract: 'compound-gate' | 'main-entrance' | null;

  // Exterior Compound Gate & Main Apartment Entrance Progression
  compoundGateState: DoorAnimState;
  mainEntranceState: DoorAnimState;
  hasEnteredApartment: boolean;
  entryCinematicActive: boolean;

  // Hiding System
  playerHiddenSpotId: string | null;
  playerHiddenWitnessedBy: BeastId[];

  // Genuine Key Pickup Building-Wide Alarm (Triggers ONCE)
  keyPickupAlarmTriggered: boolean;
  emergencyAlarmActive: boolean;
  securityBreachBannerVisible: boolean;

  // Architectural visibility, camera sensitivity & audio
  cutawayMode: boolean;
  ceilingLightsOn: boolean;
  mouseSensitivity: number;
  cameraDistance: number;
  audioEnabled: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;

  // Player Key Inventory (Starts ONLY with MISSION ROOM KEY)
  hasMissionRoomKey: boolean;
  hasPuzzleRoomKey: boolean;
  hasFalsePuzzleKey: boolean;
  puzzleKeyAwarded: boolean;

  // Door Animation States (Strictly only Mission door, Puzzle door, and Safe Room door can open)
  doorStates: Record<SpecialDoorKey, DoorAnimState>;

  // Stage 2: Mission Room State & Two-Locker Key Cell System
  missionRoomEntered: boolean;
  missionCompleted: boolean;
  activeKeyCellModal: KeyCellId | null;
  keyCells: Record<KeyCellId, KeyCellState>;

  // Stage 3: Four Randomized Mini-Game Categories, Protection Barrier & 5-Minute Countdown
  puzzleRoomEntered: boolean;
  beastAlerted: boolean;
  puzzleProtectionActive: boolean;
  puzzleTimerExpired: boolean;
  puzzleModalOpen: boolean;
  puzzleSessionSeed: number;
  puzzleSession: GeneratedPuzzleSession;
  selectedPuzzleCategory: PuzzleCategoryId | null;
  categoryLocked: boolean;
  /** Backwards-compatible aliases kept synced with selectedPuzzleCategory / categoryLocked */
  selectedCardSuit: PuzzleCategoryId | null;
  suitLocked: boolean;
  currentPuzzleId: PuzzleId;
  puzzleStage: PuzzleStage;
  puzzleTimerSeconds: number;
  puzzleTimerRunning: boolean;
  puzzleWarning: PuzzleWarningLevel;
  puzzleStageIndex: number;
  puzzleAttempts: number;
  completedPuzzles: PuzzleId[];
  allPuzzlesCompleted: boolean;

  // Stage 4: Safe Room & Physical Emergency Descent Route
  safeRoomUnlocked: boolean;
  finalExitUnlocked: boolean;
  escapeAnimating: boolean;
  escaped: boolean;

  // Orbit inspection helpers
  selectedRoomId: string | null;
  hoveredDoorId: string | null;
  hudCollapsed: boolean;

  // Actions
  setSceneLoadState: (progress: number, ready: boolean) => void;
  finishLoadingToLobby: () => void;
  openBriefingFromLobby: () => void;
  backToLobbyFromBriefing: () => void;
  enterExitedScreen: () => void;
  returnToLobbyFromExited: () => void;
  restartFullGameToLobby: () => boolean;
  startIntroFromBriefing: () => void;
  setIntroUiProgress: (segmentIndex: 0 | 1 | 2 | 3 | 4, showDirective: boolean) => void;
  completeIntroToGameplay: () => void;
  dismissSurviveBanner: () => void;
  toggleCrouch: () => void;
  setCrouch: (crouched: boolean) => void;
  startGameFromMenu: () => void;
  returnToMainMenu: () => void;
  toggleGamePaused: () => void;
  setGamePaused: (paused: boolean) => void;
  setControlMode: (mode: ControlMode) => void;
  setPointerLocked: (locked: boolean) => void;
  setPlayerFloor: (floor: FloorNumber) => void;
  setBeastTelemetry: (
    floor: FloorNumber,
    mode: BeastAiMode,
    distance: number,
    threatLabel?: string,
    lastKnownFloor?: FloorNumber | null
  ) => void;
  setBeastsTelemetry: (
    entries: BeastTelemetryEntry[],
    threatLabel: string,
    lastKnownFloor?: FloorNumber | null
  ) => void;
  setBeastFloorOverride: (floor: FloorNumber) => void;
  respawnPlayerAt: (target: 'f1-entry' | 'f1-lobby' | 'f2-mission' | 'f3-puzzle' | 'f4-exit') => void;
  setInteractionPrompt: (
    prompt: string | null,
    doorId?: string | null,
    puzzleTerminalId?: string | null,
    keyCellId?: KeyCellId | null,
    hidingSpotId?: string | null,
    exteriorInteract?: 'compound-gate' | 'main-entrance' | null
  ) => void;

  // Exterior Gate & Main Building Entrance Actions
  tryOpenCompoundGate: () => boolean;
  markCompoundGateOpen: () => void;
  tryOpenMainEntrance: () => boolean;
  markMainEntranceOpen: () => void;
  finishEntryCinematic: () => void;
  markEnteredApartment: () => void;

  // Hiding & Alarm Actions
  enterHidingSpot: (spotId: string, witnessedBy: BeastId[]) => void;
  exitHidingSpot: () => void;
  dismissSecurityBreachBanner: () => void;
  triggerGroundFloorEscape: () => void;

  showDoorFeedback: (text: string, tone?: 'error' | 'info' | 'success') => void;
  clearDoorFeedback: () => void;

  // Centralized Progression & Strict Door Actions
  tryUnlockSpecialDoor: (doorId: string) => {
    opened: boolean;
    reason?:
      | 'locked-building'
      | 'missing-mission-key'
      | 'missing-puzzle-key'
      | 'incorrect-puzzle-key'
      | 'exit-sealed'
      | 'already-open';
    message?: string;
  };
  markSpecialDoorOpen: (key: SpecialDoorKey) => void;

  // Mission Room Actions
  enterMissionRoom: () => void;

  // Key Cell Locker & Physical Key Pickup Actions
  openKeyCellModal: (cellId: KeyCellId) => void;
  closeKeyCellModal: () => void;
  submitKeyCellPassword: (
    cellId: KeyCellId,
    enteredCode: string
  ) => { granted: boolean; message: string };
  markKeyCellDoorOpen: (cellId: KeyCellId) => void;
  collectKeyFromCell: (cellId: KeyCellId) => {
    collected: boolean;
    variant: KeyCellVariant;
    message: string;
  };

  // Puzzle Room Actions (Four Randomized Mini-Game Categories)
  enterPuzzleRoom: () => void;
  openPuzzleModal: (categoryId?: PuzzleCategoryId) => void;
  closePuzzleModal: () => void;
  selectPuzzleCategory: (categoryId: PuzzleCategoryId) => void;
  selectCardSuit: (categoryId: PuzzleCategoryId) => void;
  startPuzzleChallenge: () => void;
  startCardChallenge: () => void;
  startCurrentPuzzle: () => void;
  tickPuzzleTimer: () => void;
  recordWrongAttempt: () => void;
  advancePuzzleStage: () => void;
  completePuzzleChallenge: () => void;
  completeCardChallenge: () => void;
  completeCurrentPuzzle: () => void;
  retryPuzzleChallenge: () => void;
  retryCardChallenge: () => void;
  retryCurrentPuzzle: () => void;

  // Final Exit & Lifecycle Actions
  activateFinalExit: () => boolean;
  finishEscapeCinematic: () => void;
  beginBeastCapture: () => void;
  completeBeastCapture: () => void;
  catchPlayerByBeast: () => void;
  recoverFromBeastCatch: () => void;
  resetNewGame: () => void;

  // Camera / Scene / Settings actions
  setMouseSensitivity: (sensitivity: number) => void;
  resetMouseSensitivity: () => void;
  setCameraDistance: (distance: number) => void;
  resetCameraDistance: () => void;
  selectFloor: (floor: FloorNumber | 'all') => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setCameraViewMode: (mode: CameraViewMode) => void;
  toggleCutawayMode: () => void;
  toggleCeilingLights: () => void;
  toggleAudio: () => void;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  selectRoom: (roomId: string | null) => void;
  setHoveredDoor: (doorId: string | null) => void;
  toggleHudCollapsed: () => void;
  resetView: () => void;
}

export function getStageFromProgression(progression: ProgressionState): GameStage {
  switch (progression) {
    case 'EXPLORE':
      return 1;
    case 'MISSION_ROOM_UNLOCKED':
    case 'MISSION_ACTIVE':
    case 'MISSION_COMPLETED':
      return 2;
    case 'PUZZLE_ROOM_UNLOCKED':
    case 'PUZZLE_ACTIVE':
    case 'PUZZLES_COMPLETED':
      return 3;
    case 'EXIT_UNLOCKED':
    case 'ESCAPED':
      return 4;
    case 'PLAYER_CAUGHT':
    default:
      return 1;
  }
}

export function getCurrentObjective(state: Pick<
  GameState,
  | 'progression'
  | 'hasPuzzleRoomKey'
  | 'puzzleRoomEntered'
  | 'allPuzzlesCompleted'
  | 'finalExitUnlocked'
  | 'safeRoomUnlocked'
  | 'puzzleTimerExpired'
>): string {
  if (state.progression === 'ESCAPED') {
    return 'Escape Successful!';
  }
  if (
    state.safeRoomUnlocked ||
    state.progression === 'EXIT_UNLOCKED' ||
    state.progression === 'PUZZLES_COMPLETED'
  ) {
    return 'REACH THE SAFE ROOM AND ESCAPE';
  }
  switch (state.progression) {
    case 'EXPLORE':
      return 'FIND THE MISSION ROOM';
    case 'MISSION_ROOM_UNLOCKED':
      return 'Enter the Mission Room to access the two Key Cells.';
    case 'MISSION_ACTIVE':
    case 'MISSION_COMPLETED':
      return state.hasPuzzleRoomKey
        ? 'FIND THE PUZZLE ROOM'
        : 'Unlock the Key Cells in the Mission Room and collect the genuine Puzzle Room Key.';
    case 'PUZZLE_ROOM_UNLOCKED':
      return 'Enter the Puzzle Room to start the Security Override Challenge.';
    case 'PUZZLE_ACTIVE':
      return state.puzzleTimerExpired
        ? 'Containment failed! Survive the Hunters breaching the Puzzle Room!'
        : 'Select one Puzzle Category and complete it before the 5-minute timer expires.';
    case 'PLAYER_CAUGHT':
      return 'Evade the 4 Hunters and retry.';
    default:
      return 'FIND THE MISSION ROOM';
  }
}

const INITIAL_BEASTS_TELEMETRY: BeastTelemetryEntry[] = BEAST_ROSTER.map((entry) => ({
  id: entry.id,
  name: entry.name,
  floor: entry.initialFloor,
  mode: 'patrol' as BeastAiMode,
  distance: 36,
  lastKnownFloor: null,
}));

const INITIAL_ASSIGNMENT = getActiveRoomAssignment();
const INITIAL_PUZZLE_SESSION = generatePuzzleSessionBundle();

const INITIAL_CORE_STATE = {
  progression: 'EXPLORE' as ProgressionState,
  preCatchProgression: 'EXPLORE' as ProgressionState,
  gameOverReason: 'beast-capture' as GameOverReason,
  respawnsRemaining: MAX_RESPAWNS,
  permanentGameOver: false,
  keyReturnedOnCatch: false,

  layoutVersion: 0,
  missionRoomId: INITIAL_ASSIGNMENT.missionRoomId,
  puzzleRoomId: INITIAL_ASSIGNMENT.puzzleRoomId,
  missionRoomNumber: INITIAL_ASSIGNMENT.missionRoomNumber,
  puzzleRoomNumber: INITIAL_ASSIGNMENT.puzzleRoomNumber,
  missionFloor: INITIAL_ASSIGNMENT.missionFloor,
  puzzleFloor: INITIAL_ASSIGNMENT.puzzleFloor,

  controlMode: 'third-person' as ControlMode,
  activeFloor: 1 as FloorNumber | 'all',
  cameraPreset: 'overview' as CameraPreset,
  cameraViewMode: 'orbit' as CameraViewMode,
  presetVersion: 0,

  screenPhase: 'loading' as ScreenPhase,
  sceneLoadProgress: 8,
  sceneReady: false,
  loadingSequenceTrigger: 0,
  introSequenceTrigger: 0,
  introSegmentIndex: 0 as 0 | 1 | 2 | 3 | 4,
  introShowDirective: false,
  surviveBannerVisible: false,
  isRestarting: false,
  playerCrouched: false,
  inMainMenu: true,
  gamePaused: false,
  playerFloor: 1 as FloorNumber,
  beasts: INITIAL_BEASTS_TELEMETRY,
  beastFloor: 4 as FloorNumber,
  beastAiMode: 'patrol' as BeastAiMode,
  beastDistance: 36,
  beastThreatLabel: 'Low Threat',
  beastLastKnownFloor: null as FloorNumber | null,
  beastCapturing: false,
  playerSpawnTarget: 'f1-entry' as 'f1-entry' | 'f1-lobby' | 'f2-mission' | 'f3-puzzle' | 'f4-exit',
  playerSpawnTrigger: 0,
  beastResetTrigger: 0,
  pointerLocked: false,
  interactionPrompt: null as string | null,
  doorFeedback: null as { text: string; tone: 'error' | 'info' | 'success'; seq: number } | null,
  nearbyDoorId: null as string | null,
  nearbyPuzzleTerminalId: null as string | null,
  nearbyKeyCellId: null as KeyCellId | null,
  nearbyHidingSpotId: null as string | null,
  nearbyExteriorInteract: null as 'compound-gate' | 'main-entrance' | null,

  compoundGateState: 'closed' as DoorAnimState,
  mainEntranceState: 'closed' as DoorAnimState,
  hasEnteredApartment: false,
  entryCinematicActive: false,

  playerHiddenSpotId: null as string | null,
  playerHiddenWitnessedBy: [] as BeastId[],

  keyPickupAlarmTriggered: false,
  emergencyAlarmActive: false,
  securityBreachBannerVisible: false,

  cutawayMode: true,
  ceilingLightsOn: true,
  mouseSensitivity: loadSavedMouseSensitivity(),
  cameraDistance: loadSavedCameraDistance(),
  audioEnabled: true,
  masterVolume: 0.85,
  musicVolume: 0.6,
  sfxVolume: 0.85,

  // Player starts ONLY with MISSION ROOM KEY
  hasMissionRoomKey: true,
  hasPuzzleRoomKey: false,
  hasFalsePuzzleKey: false,
  puzzleKeyAwarded: false,

  doorStates: {
    mission: 'closed',
    puzzle: 'closed',
    exit: 'closed',
  } as Record<SpecialDoorKey, DoorAnimState>,

  missionRoomEntered: false,
  missionCompleted: false,
  activeKeyCellModal: null as KeyCellId | null,
  keyCells: {
    'cell-a': {
      id: 'cell-a',
      variant: MISSION_KEY_CELLS.find((c) => c.id === 'cell-a')?.variant ?? 'real',
      unlocked: false,
      doorState: 'closed',
      keyCollected: false,
    },
    'cell-b': {
      id: 'cell-b',
      variant: MISSION_KEY_CELLS.find((c) => c.id === 'cell-b')?.variant ?? 'false',
      unlocked: false,
      doorState: 'closed',
      keyCollected: false,
    },
  } as Record<KeyCellId, KeyCellState>,

  puzzleRoomEntered: false,
  beastAlerted: false,
  puzzleProtectionActive: false,
  puzzleTimerExpired: false,
  puzzleModalOpen: false,
  puzzleSessionSeed: INITIAL_PUZZLE_SESSION.seed,
  puzzleSession: INITIAL_PUZZLE_SESSION,
  selectedPuzzleCategory: null as PuzzleCategoryId | null,
  categoryLocked: false,
  selectedCardSuit: null as PuzzleCategoryId | null,
  suitLocked: false,
  currentPuzzleId: 'math' as PuzzleId,
  puzzleStage: 'idle' as PuzzleStage,
  puzzleTimerSeconds: PUZZLE_TIME_LIMIT_SECONDS,
  puzzleTimerRunning: false,
  puzzleWarning: 'none' as PuzzleWarningLevel,
  puzzleStageIndex: 0,
  puzzleAttempts: 0,
  completedPuzzles: [] as PuzzleId[],
  allPuzzlesCompleted: false,

  safeRoomUnlocked: false,
  finalExitUnlocked: false,
  escapeAnimating: false,
  escaped: false,

  selectedRoomId: null as string | null,
  hoveredDoorId: null as string | null,
  hudCollapsed: false,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...INITIAL_CORE_STATE,

  setSceneLoadState: (progress, ready) =>
    set((state) => {
      const clamped = Math.max(state.sceneLoadProgress, Math.min(100, Math.round(progress)));
      const nextReady = state.sceneReady || (ready && clamped >= 100);
      if (clamped === state.sceneLoadProgress && nextReady === state.sceneReady) {
        return state;
      }
      return {
        sceneLoadProgress: clamped,
        sceneReady: nextReady,
      };
    }),

  finishLoadingToLobby: () =>
    set((state) => {
      if (!state.sceneReady && state.sceneLoadProgress < 100) return state;
      return {
        screenPhase: 'lobby',
        inMainMenu: true,
        isRestarting: false,
      };
    }),

  openBriefingFromLobby: () =>
    set((state) => {
      if (state.isRestarting || state.screenPhase === 'loading') return state;
      return {
        screenPhase: 'briefing',
        inMainMenu: true,
        gamePaused: false,
      };
    }),

  backToLobbyFromBriefing: () =>
    set({
      screenPhase: 'lobby',
      inMainMenu: true,
      gamePaused: false,
    }),

  enterExitedScreen: () => {
    clearSoundEvents();
    stopEmergencyAlarmSiren();
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({
      screenPhase: 'exited',
      inMainMenu: true,
      gamePaused: false,
      isRestarting: false,
    });
  },

  returnToLobbyFromExited: () =>
    set({
      screenPhase: 'lobby',
      inMainMenu: true,
      gamePaused: false,
      isRestarting: false,
    }),

  restartFullGameToLobby: () => {
    const prev = get();
    // Guard against concurrent / duplicate restart triggers
    if (prev.isRestarting || prev.screenPhase === 'loading') {
      return false;
    }

    clearSoundEvents();
    stopEmergencyAlarmSiren();
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Reset transient world & virtual control state completely
    virtualInput.moveX = 0;
    virtualInput.moveY = 0;
    virtualInput.sprinting = false;
    virtualInput.jumpQueued = false;
    virtualInput.interactQueued = false;
    virtualInput.hideQueued = false;
    virtualInput.lobbyCharacterYaw = 0.24;

    playerWorldPos.vx = 0;
    playerWorldPos.vz = 0;
    playerWorldPos.speed = 0;
    playerWorldPos.moveRatio = 0;
    playerWorldPos.isMoving = false;
    playerWorldPos.isSprinting = false;
    playerWorldPos.sprintBlend = 0;
    playerWorldPos.isCrouching = false;
    playerWorldPos.crouchBlend = 0;
    playerWorldPos.jumpOffsetY = 0;
    playerWorldPos.jumpVelocity = 0;
    playerWorldPos.isGrounded = true;
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    playerWorldPos.actionAnim = 'none';
    playerWorldPos.actionAnimClock = 0;

    // Generate completely fresh randomized room layout & puzzle bundle for new session
    const nextAssignment = randomizeSpecialRooms({
      missionRoomId: prev.missionRoomId,
      puzzleRoomId: prev.puzzleRoomId,
    });
    const nextPuzzleSession = generatePuzzleSessionBundle();

    set((state) => ({
      ...INITIAL_CORE_STATE,
      screenPhase: 'loading',
      sceneLoadProgress: 12,
      sceneReady: false,
      loadingSequenceTrigger: state.loadingSequenceTrigger + 1,
      isRestarting: true,
      playerCrouched: false,
      inMainMenu: true,
      gamePaused: false,
      layoutVersion: state.layoutVersion + 1,
      missionRoomId: nextAssignment.missionRoomId,
      puzzleRoomId: nextAssignment.puzzleRoomId,
      missionRoomNumber: nextAssignment.missionRoomNumber,
      puzzleRoomNumber: nextAssignment.puzzleRoomNumber,
      missionFloor: nextAssignment.missionFloor,
      puzzleFloor: nextAssignment.puzzleFloor,
      puzzleSessionSeed: nextPuzzleSession.seed,
      puzzleSession: nextPuzzleSession,
      // Preserve persistent user settings (volume, audio toggle, sensitivity, camera distance, lights/cutaway)
      mouseSensitivity: state.mouseSensitivity,
      cameraDistance: state.cameraDistance,
      audioEnabled: state.audioEnabled,
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      ceilingLightsOn: state.ceilingLightsOn,
      cutawayMode: state.cutawayMode,
      playerSpawnTrigger: state.playerSpawnTrigger + 1,
      beastResetTrigger: state.beastResetTrigger + 1,
      presetVersion: state.presetVersion + 1,
    }));

    return true;
  },

  toggleCrouch: () =>
    set((state) => {
      if (state.inMainMenu || state.gamePaused || state.playerHiddenSpotId) return state;
      const next = !state.playerCrouched;
      playerWorldPos.isCrouching = next;
      return { playerCrouched: next };
    }),

  setCrouch: (crouched) =>
    set((state) => {
      if (state.playerCrouched === crouched) return state;
      playerWorldPos.isCrouching = crouched;
      return { playerCrouched: crouched };
    }),

  startIntroFromBriefing: () => {
    clearSoundEvents();
    stopEmergencyAlarmSiren();
    virtualInput.moveX = 0;
    virtualInput.moveY = 0;
    virtualInput.sprinting = false;
    virtualInput.jumpQueued = false;
    virtualInput.interactQueued = false;
    virtualInput.hideQueued = false;
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    playerWorldPos.isCrouching = false;
    playerWorldPos.jumpOffsetY = 0;
    playerWorldPos.jumpVelocity = 0;
    const prev = get();
    const nextAssignment = randomizeSpecialRooms({
      missionRoomId: prev.missionRoomId,
      puzzleRoomId: prev.puzzleRoomId,
    });
    const nextPuzzleSession = generatePuzzleSessionBundle();
    setAudioSettings({
      enabled: prev.audioEnabled,
      masterVolume: prev.masterVolume,
      musicVolume: prev.musicVolume,
      sfxVolume: prev.sfxVolume,
    });
    initAudioContext();
    set((state) => ({
      ...INITIAL_CORE_STATE,
      screenPhase: 'intro',
      sceneLoadProgress: state.sceneLoadProgress,
      sceneReady: state.sceneReady,
      loadingSequenceTrigger: state.loadingSequenceTrigger,
      introSequenceTrigger: state.introSequenceTrigger + 1,
      introSegmentIndex: 0,
      introShowDirective: false,
      surviveBannerVisible: false,
      isRestarting: false,
      playerCrouched: false,
      // Keep Beasts, timers, and gameplay input locked until the 10s intro completes
      inMainMenu: true,
      gamePaused: false,
      layoutVersion: state.layoutVersion + 1,
      missionRoomId: nextAssignment.missionRoomId,
      puzzleRoomId: nextAssignment.puzzleRoomId,
      missionRoomNumber: nextAssignment.missionRoomNumber,
      puzzleRoomNumber: nextAssignment.puzzleRoomNumber,
      missionFloor: nextAssignment.missionFloor,
      puzzleFloor: nextAssignment.puzzleFloor,
      puzzleSessionSeed: nextPuzzleSession.seed,
      puzzleSession: nextPuzzleSession,
      mouseSensitivity: state.mouseSensitivity,
      cameraDistance: state.cameraDistance,
      audioEnabled: state.audioEnabled,
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      ceilingLightsOn: state.ceilingLightsOn,
      cutawayMode: state.cutawayMode,
      playerSpawnTrigger: state.playerSpawnTrigger + 1,
      beastResetTrigger: state.beastResetTrigger + 1,
      presetVersion: state.presetVersion + 1,
    }));
  },

  setIntroUiProgress: (segmentIndex, showDirective) =>
    set((state) => {
      if (
        state.screenPhase !== 'intro' ||
        (state.introSegmentIndex === segmentIndex && state.introShowDirective === showDirective)
      ) {
        return state;
      }
      return {
        introSegmentIndex: segmentIndex,
        introShowDirective: showDirective,
      };
    }),

  completeIntroToGameplay: () => {
    const state = get();
    if (state.screenPhase !== 'intro') return;
    set({
      screenPhase: 'playing',
      inMainMenu: false,
      gamePaused: false,
      surviveBannerVisible: true,
      introSegmentIndex: 4,
      introShowDirective: false,
    });
    triggerPlayerActionAnim('respawn', 0.65);
  },

  dismissSurviveBanner: () =>
    set((state) => (state.surviveBannerVisible ? { surviveBannerVisible: false } : state)),

  startGameFromMenu: () => {
    clearSoundEvents();
    stopEmergencyAlarmSiren();
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    playerWorldPos.isCrouching = false;
    playerWorldPos.jumpOffsetY = 0;
    playerWorldPos.jumpVelocity = 0;
    const prev = get();
    // Randomly assign a fresh Mission Room & Puzzle Room across all 4 floors (80 rooms)
    const nextAssignment = randomizeSpecialRooms({
      missionRoomId: prev.missionRoomId,
      puzzleRoomId: prev.puzzleRoomId,
    });
    // Procedurally generate fresh, validated puzzles for all 4 categories
    const nextPuzzleSession = generatePuzzleSessionBundle();
    setAudioSettings({
      enabled: prev.audioEnabled,
      masterVolume: prev.masterVolume,
      musicVolume: prev.musicVolume,
      sfxVolume: prev.sfxVolume,
    });
    initAudioContext();
    set((state) => ({
      ...INITIAL_CORE_STATE,
      screenPhase: 'playing',
      sceneLoadProgress: state.sceneLoadProgress,
      sceneReady: state.sceneReady,
      loadingSequenceTrigger: state.loadingSequenceTrigger,
      isRestarting: false,
      playerCrouched: false,
      inMainMenu: false,
      layoutVersion: state.layoutVersion + 1,
      missionRoomId: nextAssignment.missionRoomId,
      puzzleRoomId: nextAssignment.puzzleRoomId,
      missionRoomNumber: nextAssignment.missionRoomNumber,
      puzzleRoomNumber: nextAssignment.puzzleRoomNumber,
      missionFloor: nextAssignment.missionFloor,
      puzzleFloor: nextAssignment.puzzleFloor,
      puzzleSessionSeed: nextPuzzleSession.seed,
      puzzleSession: nextPuzzleSession,
      mouseSensitivity: state.mouseSensitivity,
      cameraDistance: state.cameraDistance,
      audioEnabled: state.audioEnabled,
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      ceilingLightsOn: state.ceilingLightsOn,
      cutawayMode: state.cutawayMode,
      playerSpawnTrigger: state.playerSpawnTrigger + 1,
      beastResetTrigger: state.beastResetTrigger + 1,
      presetVersion: state.presetVersion + 1,
    }));
    triggerPlayerActionAnim('respawn', 0.75);
  },

  returnToMainMenu: () => {
    clearSoundEvents();
    stopEmergencyAlarmSiren();
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    playerWorldPos.isCrouching = false;
    playerWorldPos.jumpOffsetY = 0;
    playerWorldPos.jumpVelocity = 0;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set((state) => ({
      ...INITIAL_CORE_STATE,
      screenPhase: 'lobby',
      sceneLoadProgress: state.sceneLoadProgress,
      sceneReady: state.sceneReady,
      loadingSequenceTrigger: state.loadingSequenceTrigger,
      isRestarting: false,
      playerCrouched: false,
      inMainMenu: true,
      layoutVersion: state.layoutVersion,
      missionRoomId: state.missionRoomId,
      puzzleRoomId: state.puzzleRoomId,
      missionRoomNumber: state.missionRoomNumber,
      puzzleRoomNumber: state.puzzleRoomNumber,
      missionFloor: state.missionFloor,
      puzzleFloor: state.puzzleFloor,
      mouseSensitivity: state.mouseSensitivity,
      cameraDistance: state.cameraDistance,
      audioEnabled: state.audioEnabled,
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      ceilingLightsOn: state.ceilingLightsOn,
      cutawayMode: state.cutawayMode,
      playerSpawnTrigger: state.playerSpawnTrigger + 1,
      beastResetTrigger: state.beastResetTrigger + 1,
      presetVersion: state.presetVersion + 1,
    }));
  },

  toggleGamePaused: () =>
    set((state) => {
      if (state.inMainMenu) return state;
      const nextPaused = !state.gamePaused;
      if (nextPaused) {
        stopEmergencyAlarmSiren();
        if (typeof document !== 'undefined' && document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      return { gamePaused: nextPaused };
    }),

  setGamePaused: (paused) =>
    set((state) => {
      if (state.inMainMenu) return state;
      if (paused) {
        stopEmergencyAlarmSiren();
        if (typeof document !== 'undefined' && document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
      return { gamePaused: paused };
    }),

  setControlMode: (mode) =>
    set((state) => ({
      controlMode: mode,
      puzzleModalOpen: mode === 'orbit' ? false : state.puzzleModalOpen,
      activeKeyCellModal: mode === 'orbit' ? null : state.activeKeyCellModal,
      presetVersion: state.presetVersion + 1,
    })),

  setPointerLocked: (locked) => set({ pointerLocked: locked }),
  setPlayerFloor: (floor) => set({ playerFloor: floor }),

  setBeastTelemetry: (floor, mode, distance, threatLabel, lastKnownFloor) =>
    set((state) => {
      const nextThreat = threatLabel ?? state.beastThreatLabel;
      const nextLastKnown =
        lastKnownFloor !== undefined ? lastKnownFloor : state.beastLastKnownFloor;
      if (
        state.beastFloor === floor &&
        state.beastAiMode === mode &&
        state.beastThreatLabel === nextThreat &&
        state.beastLastKnownFloor === nextLastKnown &&
        Math.abs(state.beastDistance - distance) < 0.4
      ) {
        return state;
      }
      return {
        beastFloor: floor,
        beastAiMode: mode,
        beastDistance: distance,
        beastThreatLabel: nextThreat,
        beastLastKnownFloor: nextLastKnown,
      };
    }),

  setBeastsTelemetry: (entries, threatLabel, lastKnownFloor) =>
    set((state) => {
      if (entries.length === 0) return state;
      const modePriority: Record<BeastAiMode, number> = {
        capture: 5,
        chase: 4,
        detect: 3,
        investigate: 2,
        search: 1,
        patrol: 0,
      };
      // Determine most urgent / closest Beast for aggregate HUD & music tension
      let primary = entries[0];
      let minDist = entries[0].distance;
      for (const e of entries) {
        if (e.distance < minDist) minDist = e.distance;
        const pDiff = modePriority[e.mode] - modePriority[primary.mode];
        if (pDiff > 0 || (pDiff === 0 && e.distance < primary.distance)) {
          primary = e;
        }
      }
      const nextLastKnown =
        lastKnownFloor !== undefined ? lastKnownFloor : state.beastLastKnownFloor;

      // Skip state update when all visible HUD/audio telemetry fields are unchanged
      if (
        state.beastFloor === primary.floor &&
        state.beastAiMode === primary.mode &&
        state.beastDistance === minDist &&
        state.beastThreatLabel === threatLabel &&
        state.beastLastKnownFloor === nextLastKnown &&
        state.beasts.length === entries.length
      ) {
        let sameEntries = true;
        for (let i = 0; i < entries.length; i++) {
          const prev = state.beasts[i];
          const next = entries[i];
          if (
            prev.id !== next.id ||
            prev.floor !== next.floor ||
            prev.mode !== next.mode ||
            prev.distance !== next.distance ||
            prev.lastKnownFloor !== next.lastKnownFloor
          ) {
            sameEntries = false;
            break;
          }
        }
        if (sameEntries) return state;
      }

      return {
        beasts: entries,
        beastFloor: primary.floor,
        beastAiMode: primary.mode,
        beastDistance: minDist,
        beastThreatLabel: threatLabel,
        beastLastKnownFloor: nextLastKnown,
      };
    }),

  setBeastFloorOverride: (floor) =>
    set((state) => ({
      beastFloor: floor,
      beastResetTrigger: state.beastResetTrigger + 1,
    })),

  respawnPlayerAt: (target) =>
    set((state) => {
      playerWorldPos.isHidden = false;
      playerWorldPos.hiddenSpotId = null;
      triggerPlayerActionAnim('respawn', 0.75);
      return {
        controlMode: 'third-person',
        playerSpawnTarget: target,
        playerSpawnTrigger: state.playerSpawnTrigger + 1,
        playerFloor:
          target === 'f1-entry' || target === 'f1-lobby'
            ? 1
            : target === 'f2-mission'
            ? state.missionFloor
            : target === 'f3-puzzle'
            ? state.puzzleFloor
            : 4,
        playerHiddenSpotId: null,
        playerHiddenWitnessedBy: [],
        puzzleModalOpen: false,
        activeKeyCellModal: null,
      };
    }),

  setInteractionPrompt: (
    prompt,
    doorId = null,
    puzzleTerminalId = null,
    keyCellId = null,
    hidingSpotId = null,
    exteriorInteract = null
  ) =>
    set({
      interactionPrompt: prompt,
      nearbyDoorId: doorId,
      nearbyPuzzleTerminalId: puzzleTerminalId,
      nearbyKeyCellId: keyCellId,
      nearbyHidingSpotId: hidingSpotId,
      nearbyExteriorInteract: exteriorInteract,
    }),

  tryOpenCompoundGate: () => {
    const state = get();
    if (state.compoundGateState !== 'closed') return false;
    const nextSeq = (state.doorFeedback?.seq ?? 0) + 1;
    set({
      compoundGateState: 'opening',
      doorFeedback: {
        text: 'COMPOUND GATE OPENING — PROCEED TO BUILDING ENTRANCE',
        tone: 'info',
        seq: nextSeq,
      },
    });
    return true;
  },

  markCompoundGateOpen: () =>
    set((state) => (state.compoundGateState === 'open' ? state : { compoundGateState: 'open' })),

  tryOpenMainEntrance: () => {
    const state = get();
    if (state.mainEntranceState !== 'closed') return false;
    const nextSeq = (state.doorFeedback?.seq ?? 0) + 1;
    set({
      mainEntranceState: 'opening',
      entryCinematicActive: true,
      doorFeedback: {
        text: 'MAIN ENTRANCE UNLOCKED — ENTER LAST BREATH',
        tone: 'success',
        seq: nextSeq,
      },
    });
    return true;
  },

  markMainEntranceOpen: () =>
    set((state) => (state.mainEntranceState === 'open' ? state : { mainEntranceState: 'open' })),

  finishEntryCinematic: () =>
    set((state) => (state.entryCinematicActive ? { entryCinematicActive: false } : state)),

  markEnteredApartment: () =>
    set((state) => (state.hasEnteredApartment ? state : { hasEnteredApartment: true })),

  enterHidingSpot: (spotId, witnessedBy) => {
    const state = get();
    if (state.playerHiddenSpotId === spotId) return;
    playerWorldPos.isHidden = true;
    playerWorldPos.hiddenSpotId = spotId;
    triggerPlayerActionAnim('hide-enter', 0.45);
    playHideTransitionSound(true, state.audioEnabled);
    emitSoundEvent({
      x: playerWorldPos.x,
      y: playerWorldPos.feetY,
      z: playerWorldPos.z,
      floor: state.playerFloor,
      kind: 'hide-rustle',
    });
    set({
      playerHiddenSpotId: spotId,
      playerHiddenWitnessedBy: witnessedBy,
      interactionPrompt: 'PRESS E TO EXIT HIDING',
      nearbyHidingSpotId: spotId,
    });
  },

  exitHidingSpot: () => {
    const state = get();
    if (!state.playerHiddenSpotId) return;
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    triggerPlayerActionAnim('hide-exit', 0.45);
    playHideTransitionSound(false, state.audioEnabled);
    emitSoundEvent({
      x: playerWorldPos.x,
      y: playerWorldPos.feetY,
      z: playerWorldPos.z,
      floor: state.playerFloor,
      kind: 'hide-rustle',
    });
    set({
      playerHiddenSpotId: null,
      playerHiddenWitnessedBy: [],
      interactionPrompt: null,
    });
  },

  dismissSecurityBreachBanner: () => set({ securityBreachBannerVisible: false }),

  triggerGroundFloorEscape: () => {
    const state = get();
    if (state.escaped || !state.safeRoomUnlocked) return;
    stopEmergencyAlarmSiren();
    playEmergencyExitSound(state.audioEnabled);
    playVictoryEscapeSound(state.audioEnabled);
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({
      escapeAnimating: false,
      escaped: true,
      emergencyAlarmActive: false,
      securityBreachBannerVisible: false,
      progression: 'ESCAPED',
    });
  },

  showDoorFeedback: (text, tone = 'info') =>
    set((state) => ({
      doorFeedback: { text, tone, seq: (state.doorFeedback?.seq ?? 0) + 1 },
    })),

  clearDoorFeedback: () => set({ doorFeedback: null }),

  tryUnlockSpecialDoor: (doorId) => {
    const state = get();
    const nextSeq = (state.doorFeedback?.seq ?? 0) + 1;

    // 1. Mission Room Door (strict ID check; requires MISSION ROOM KEY)
    if (doorId === SPECIAL_ROOMS_CONFIG.missionDoorId) {
      if (!state.hasMissionRoomKey) {
        const message = 'Mission Room Key required.';
        set({ doorFeedback: { text: message, tone: 'error', seq: nextSeq } });
        return { opened: false, reason: 'missing-mission-key', message };
      }
      if (state.doorStates.mission !== 'closed') {
        return { opened: false, reason: 'already-open' };
      }
      set({
        doorStates: { ...state.doorStates, mission: 'opening' },
        doorFeedback: { text: 'Mission Room unlocked.', tone: 'success', seq: nextSeq },
        progression:
          state.progression === 'EXPLORE' ? 'MISSION_ROOM_UNLOCKED' : state.progression,
      });
      return { opened: true };
    }

    // 2. Puzzle Room Door (strict ID check; requires REAL PUZZLE ROOM KEY)
    if (doorId === SPECIAL_ROOMS_CONFIG.puzzleDoorId) {
      if (!state.hasPuzzleRoomKey) {
        if (state.hasFalsePuzzleKey) {
          const message = 'ACCESS DENIED — INCORRECT KEY.';
          set({ doorFeedback: { text: message, tone: 'error', seq: nextSeq } });
          return { opened: false, reason: 'incorrect-puzzle-key', message };
        }
        const message = 'Puzzle Room Key required.';
        set({ doorFeedback: { text: message, tone: 'error', seq: nextSeq } });
        return { opened: false, reason: 'missing-puzzle-key', message };
      }
      if (state.doorStates.puzzle !== 'closed') {
        return { opened: false, reason: 'already-open' };
      }
      set({
        doorStates: { ...state.doorStates, puzzle: 'opening' },
        doorFeedback: { text: 'Puzzle Room unlocked.', tone: 'success', seq: nextSeq },
        progression:
          state.progression === 'MISSION_COMPLETED' || state.progression === 'MISSION_ACTIVE'
            ? 'PUZZLE_ROOM_UNLOCKED'
            : state.progression,
      });
      return { opened: true };
    }

    // 3. Safe Room Door inside Puzzle Room (requires Puzzle Key + Card Challenge Completed)
    if (doorId === SPECIAL_ROOMS_CONFIG.finalExitDoorId) {
      if (
        !state.hasPuzzleRoomKey ||
        !state.allPuzzlesCompleted ||
        !state.safeRoomUnlocked
      ) {
        const message = 'Complete one Puzzle Challenge to unlock the Safe Room.';
        set({ doorFeedback: { text: message, tone: 'error', seq: nextSeq } });
        return { opened: false, reason: 'exit-sealed', message };
      }
      if (state.doorStates.exit !== 'closed' || state.escapeAnimating || state.escaped) {
        return { opened: false, reason: 'already-open' };
      }
      set({
        doorStates: { ...state.doorStates, exit: 'opening' },
        doorFeedback: {
          text: 'SAFE ROOM UNLOCKED — REACH THE EMERGENCY DESCENT',
          tone: 'success',
          seq: nextSeq,
        },
      });
      return { opened: true };
    }

    // 4. All 78 ordinary apartment doors remain permanently locked
    const message = 'Door locked.';
    set({ doorFeedback: { text: message, tone: 'error', seq: nextSeq } });
    return { opened: false, reason: 'locked-building', message };
  },

  markSpecialDoorOpen: (key) => {
    const state = get();
    if (state.doorStates[key] === 'open') return;
    set({
      doorStates: { ...state.doorStates, [key]: 'open' },
    });
  },

  // Entering the Mission Room must NEVER trigger the alarm, siren, flashing lights, or Beast convergence.
  enterMissionRoom: () => {
    const state = get();
    if (state.doorStates.mission !== 'open' || state.missionRoomEntered) return;
    set({
      missionRoomEntered: true,
      progression: state.hasPuzzleRoomKey ? state.progression : 'MISSION_ACTIVE',
    });
  },

  openKeyCellModal: (cellId) => {
    const state = get();
    if (!state.missionRoomEntered) return;
    const cell = state.keyCells[cellId];
    if (!cell || cell.unlocked) return;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({ activeKeyCellModal: cellId });
  },

  closeKeyCellModal: () => set({ activeKeyCellModal: null }),

  submitKeyCellPassword: (cellId, enteredCode) => {
    const state = get();
    const cell = state.keyCells[cellId];
    if (!cell || !state.missionRoomEntered) {
      return { granted: false, message: 'Enter the Mission Room first.' };
    }
    if (cell.unlocked) {
      return { granted: true, message: 'ACCESS GRANTED' };
    }

    const expectedRoomPassword = getMissionRoomNumber();
    if (enteredCode.trim() !== expectedRoomPassword) {
      playKeypadBeep(200, state.audioEnabled);
      return { granted: false, message: 'INCORRECT PASSWORD' };
    }

    playDoorSound(true, state.audioEnabled);
    playKeypadBeep(880, state.audioEnabled);
    const nextSeq = (state.doorFeedback?.seq ?? 0) + 1;
    set({
      keyCells: {
        ...state.keyCells,
        [cellId]: {
          ...cell,
          unlocked: true,
          doorState: 'opening',
        },
      },
      doorFeedback: { text: 'ACCESS GRANTED', tone: 'success', seq: nextSeq },
    });
    return { granted: true, message: 'ACCESS GRANTED' };
  },

  markKeyCellDoorOpen: (cellId) => {
    const state = get();
    const cell = state.keyCells[cellId];
    if (!cell || cell.doorState === 'open') return;
    set({
      keyCells: {
        ...state.keyCells,
        [cellId]: {
          ...cell,
          doorState: 'open',
        },
      },
    });
  },

  collectKeyFromCell: (cellId) => {
    const state = get();
    const cell = state.keyCells[cellId];
    if (!cell || !cell.unlocked || cell.keyCollected) {
      return {
        collected: false,
        variant: cell?.variant ?? 'false',
        message: 'Cell locked or key already collected.',
      };
    }

    const nextSeq = (state.doorFeedback?.seq ?? 0) + 1;
    const isReal = cell.variant === 'real';
    const triggerAlarmNow = isReal && !state.keyPickupAlarmTriggered;
    const message = triggerAlarmNow
      ? 'SECURITY BREACH — ALL HUNTERS ACTIVATED'
      : isReal
        ? 'PUZZLE ROOM KEY COLLECTED'
        : 'FALSE KEY COLLECTED';

    playKeyPickupSound(state.audioEnabled);
    triggerPlayerActionAnim('key-pickup', 0.65);

    // ONLY physically collecting the GENUINE Puzzle Room Key triggers the building-wide alarm — ONCE!
    if (triggerAlarmNow) {
      startEmergencyAlarmSiren(state.audioEnabled);
      emitSoundEvent({
        x: MISSION_ROOM_BOUNDS.centerX,
        y: MISSION_ROOM_BOUNDS.elevation,
        z: MISSION_ROOM_BOUNDS.centerZ,
        floor: MISSION_ROOM_BOUNDS.floor,
        kind: 'key-alarm',
      });
    }

    set({
      keyCells: {
        ...state.keyCells,
        [cellId]: {
          ...cell,
          keyCollected: true,
        },
      },
      hasPuzzleRoomKey: isReal ? true : state.hasPuzzleRoomKey,
      hasFalsePuzzleKey: !isReal ? true : state.hasFalsePuzzleKey,
      puzzleKeyAwarded: isReal ? true : state.puzzleKeyAwarded,
      missionCompleted: isReal ? true : state.missionCompleted,
      keyPickupAlarmTriggered: triggerAlarmNow ? true : state.keyPickupAlarmTriggered,
      emergencyAlarmActive: triggerAlarmNow ? true : state.emergencyAlarmActive,
      securityBreachBannerVisible: triggerAlarmNow ? true : state.securityBreachBannerVisible,
      progression:
        isReal &&
        (state.progression === 'EXPLORE' ||
          state.progression === 'MISSION_ROOM_UNLOCKED' ||
          state.progression === 'MISSION_ACTIVE')
          ? 'MISSION_COMPLETED'
          : state.progression,
      doorFeedback: {
        text: message,
        tone: triggerAlarmNow ? 'error' : isReal ? 'success' : 'info',
        seq: nextSeq,
      },
    });

    return { collected: true, variant: cell.variant, message };
  },

  enterPuzzleRoom: () => {
    const state = get();
    if (
      !state.hasPuzzleRoomKey ||
      state.doorStates.puzzle !== 'open' ||
      state.puzzleRoomEntered
    ) {
      return;
    }
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }

    set({
      puzzleRoomEntered: true,
      beastAlerted: true,
      puzzleProtectionActive: true,
      puzzleTimerExpired: false,
      progression: state.allPuzzlesCompleted ? state.progression : 'PUZZLE_ACTIVE',
      puzzleModalOpen: true,
      selectedPuzzleCategory: null,
      categoryLocked: false,
      selectedCardSuit: null,
      suitLocked: false,
      currentPuzzleId: 'math',
      puzzleStage: state.allPuzzlesCompleted ? 'completed' : 'suit-select',
      puzzleTimerSeconds: state.allPuzzlesCompleted
        ? state.puzzleTimerSeconds
        : PUZZLE_TIME_LIMIT_SECONDS,
      puzzleTimerRunning: !state.allPuzzlesCompleted,
      puzzleWarning: 'none',
      puzzleStageIndex: 0,
      puzzleAttempts: 0,
    });
  },

  openPuzzleModal: (categoryId) => {
    const state = get();
    if (!state.puzzleRoomEntered) return;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }

    if (state.allPuzzlesCompleted) {
      set({
        puzzleModalOpen: true,
        puzzleStage: 'completed',
      });
      return;
    }

    const canSelect = Boolean(categoryId && !state.categoryLocked);
    const nextCategory = canSelect ? categoryId! : state.selectedPuzzleCategory;
    const nextStage: PuzzleStage =
      state.puzzleStage === 'idle' ? 'suit-select' : state.puzzleStage;

    set({
      puzzleModalOpen: true,
      selectedPuzzleCategory: nextCategory,
      selectedCardSuit: nextCategory,
      currentPuzzleId: nextCategory ?? state.currentPuzzleId,
      puzzleStage: nextStage,
    });
  },

  closePuzzleModal: () => set({ puzzleModalOpen: false }),

  selectPuzzleCategory: (categoryId) => {
    const state = get();
    if (state.categoryLocked || state.allPuzzlesCompleted) return;
    set({
      selectedPuzzleCategory: categoryId,
      selectedCardSuit: categoryId,
      currentPuzzleId: categoryId,
      puzzleStage: 'suit-select',
    });
  },

  selectCardSuit: (categoryId) => {
    get().selectPuzzleCategory(categoryId);
  },

  startPuzzleChallenge: () => {
    const state = get();
    if (state.allPuzzlesCompleted) return;
    const chosenCategory = state.selectedPuzzleCategory ?? state.currentPuzzleId;
    if (!chosenCategory) return;

    set({
      selectedPuzzleCategory: chosenCategory,
      selectedCardSuit: chosenCategory,
      currentPuzzleId: chosenCategory,
      categoryLocked: true,
      suitLocked: true,
      puzzleStage: 'active',
      puzzleStageIndex: 0,
      puzzleTimerSeconds:
        state.puzzleTimerSeconds > 0 ? state.puzzleTimerSeconds : PUZZLE_TIME_LIMIT_SECONDS,
      puzzleTimerRunning: true,
      puzzleAttempts: 0,
    });
  },

  startCardChallenge: () => {
    get().startPuzzleChallenge();
  },

  startCurrentPuzzle: () => {
    get().startPuzzleChallenge();
  },

  tickPuzzleTimer: () => {
    const cur = get();
    if (
      cur.inMainMenu ||
      cur.gamePaused ||
      !cur.puzzleTimerRunning ||
      cur.allPuzzlesCompleted ||
      cur.escaped ||
      cur.progression === 'PLAYER_CAUGHT'
    ) {
      return;
    }

    if (cur.puzzleTimerSeconds <= 1) {
      // Timer expired! Drop Puzzle Room containment protection so all 4 Hunters breach & attack!
      playBeastAlertSiren(cur.audioEnabled);
      const nextSeq = (cur.doorFeedback?.seq ?? 0) + 1;
      set({
        puzzleTimerSeconds: 0,
        puzzleTimerRunning: false,
        puzzleModalOpen: false,
        puzzleStage: 'failed',
        puzzleProtectionActive: false,
        puzzleTimerExpired: true,
        doorFeedback: {
          text: 'CONTAINMENT FAILED — HUNTERS BREACHING PUZZLE ROOM!',
          tone: 'error',
          seq: nextSeq,
        },
      });
      return;
    }

    const nextSeconds = cur.puzzleTimerSeconds - 1;
    let nextWarning = cur.puzzleWarning;
    if (nextSeconds === 60) {
      nextWarning = '60s';
      playTimerWarningSound(false, cur.audioEnabled);
    } else if (nextSeconds === 30) {
      nextWarning = '30s';
      playTimerWarningSound(true, cur.audioEnabled);
    }

    set({
      puzzleTimerSeconds: nextSeconds,
      puzzleWarning: nextWarning,
    });
  },

  recordWrongAttempt: () => {
    const cur = get();
    if (cur.puzzleStage === 'active') {
      emitSoundEvent({
        x: playerWorldPos.x,
        y: playerWorldPos.feetY,
        z: playerWorldPos.z,
        floor: cur.playerFloor,
        kind: 'puzzle-loud',
      });
    }
    set((state) => {
      if (state.puzzleStage !== 'active') return state;
      const nextAttempts = state.puzzleAttempts + 1;
      if (nextAttempts >= PUZZLE_MAX_ATTEMPTS) {
        return {
          puzzleAttempts: nextAttempts,
          puzzleStage: 'failed',
        };
      }
      return { puzzleAttempts: nextAttempts };
    });
  },

  advancePuzzleStage: () => {
    set((state) => ({
      puzzleStageIndex: state.puzzleStageIndex + 1,
      puzzleAttempts: 0,
      puzzleStage: 'active',
    }));
  },

  completePuzzleChallenge: () => {
    const cur = get();
    const solvedCategory = cur.selectedPuzzleCategory ?? cur.currentPuzzleId;
    emitSoundEvent({
      x: playerWorldPos.x,
      y: playerWorldPos.feetY,
      z: playerWorldPos.z,
      floor: cur.playerFloor,
      kind: 'puzzle-loud',
    });
    playPuzzleCompleteSound(true, cur.audioEnabled);
    playSafeRoomUnlockSound(cur.audioEnabled);
    set((state) => {
      const updatedCompleted = state.completedPuzzles.includes(solvedCategory)
        ? state.completedPuzzles
        : [...state.completedPuzzles, solvedCategory];

      return {
        puzzleStage: 'completed',
        puzzleTimerRunning: false,
        puzzleProtectionActive: true, // Keep Beasts outside while player enters Safe Room & descends!
        completedPuzzles: updatedCompleted,
        allPuzzlesCompleted: true,
        safeRoomUnlocked: true,
        finalExitUnlocked: true,
        doorStates: {
          ...state.doorStates,
          exit: state.doorStates.exit === 'closed' ? 'opening' : state.doorStates.exit,
        },
        progression: 'EXIT_UNLOCKED',
        doorFeedback: {
          text: 'CHALLENGE COMPLETED — SAFE ROOM UNLOCKED!',
          tone: 'success',
          seq: (state.doorFeedback?.seq ?? 0) + 1,
        },
      };
    });
  },

  completeCardChallenge: () => {
    get().completePuzzleChallenge();
  },

  completeCurrentPuzzle: () => {
    get().completePuzzleChallenge();
  },

  retryPuzzleChallenge: () => {
    const state = get();
    if (state.puzzleTimerSeconds <= 0) return;
    set({
      puzzleStage: 'active',
      puzzleAttempts: 0,
    });
  },

  retryCardChallenge: () => {
    get().retryPuzzleChallenge();
  },

  retryCurrentPuzzle: () => {
    get().retryPuzzleChallenge();
  },

  activateFinalExit: () => {
    const state = get();
    if (
      state.escapeAnimating ||
      state.escaped ||
      !state.hasPuzzleRoomKey ||
      !state.allPuzzlesCompleted ||
      !state.finalExitUnlocked
    ) {
      return false;
    }
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({
      doorStates: { ...state.doorStates, exit: 'opening' },
      puzzleModalOpen: false,
      activeKeyCellModal: null,
      escapeAnimating: true,
    });
    return true;
  },

  finishEscapeCinematic: () => {
    const state = get();
    if (!state.finalExitUnlocked) return;
    playVictoryEscapeSound(state.audioEnabled);
    set({
      escapeAnimating: false,
      escaped: true,
      progression: 'ESCAPED',
    });
  },

  beginBeastCapture: () => {
    const state = get();
    if (
      state.progression === 'ESCAPED' ||
      state.progression === 'PLAYER_CAUGHT' ||
      state.escapeAnimating ||
      state.beastCapturing
    ) {
      return;
    }
    stopEmergencyAlarmSiren();
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    triggerPlayerActionAnim('capture-death', 1.4);
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    set({
      beastCapturing: true,
      beastAiMode: 'capture',
      playerHiddenSpotId: null,
      playerHiddenWitnessedBy: [],
      puzzleModalOpen: false,
      activeKeyCellModal: null,
      puzzleTimerRunning: false,
    });
  },

  completeBeastCapture: () => {
    const state = get();
    if (state.progression === 'ESCAPED' || state.progression === 'PLAYER_CAUGHT') {
      return;
    }
    stopEmergencyAlarmSiren();

    // KEY SECURITY RULE: If caught after picking up the genuine Puzzle Room Key but BEFORE entering
    // the Puzzle Room, strip the key, return it to its original Mission Room cell, and reset the alarm
    // for a clean retry. False key identity is strictly preserved.
    const shouldReturnGenuineKey = state.hasPuzzleRoomKey && !state.puzzleRoomEntered;
    const nextKeyCells = { ...state.keyCells };
    if (shouldReturnGenuineKey) {
      const realCellId = (Object.keys(nextKeyCells) as KeyCellId[]).find(
        (cid) => nextKeyCells[cid].variant === 'real'
      );
      if (realCellId) {
        nextKeyCells[realCellId] = {
          ...nextKeyCells[realCellId],
          keyCollected: false,
        };
      }
    }

    const nextPreCatch: ProgressionState =
      shouldReturnGenuineKey &&
      (state.progression === 'MISSION_COMPLETED' || state.progression === 'PUZZLE_ROOM_UNLOCKED')
        ? 'MISSION_ACTIVE'
        : state.progression;

    const isPermanentGameOver = state.respawnsRemaining <= 0;

    set({
      beastCapturing: false,
      preCatchProgression: nextPreCatch,
      progression: 'PLAYER_CAUGHT',
      gameOverReason: state.puzzleTimerExpired ? 'puzzle-timeout' : 'beast-capture',
      permanentGameOver: isPermanentGameOver,
      keyReturnedOnCatch: shouldReturnGenuineKey,
      hasPuzzleRoomKey: shouldReturnGenuineKey ? false : state.hasPuzzleRoomKey,
      puzzleKeyAwarded: shouldReturnGenuineKey ? false : state.puzzleKeyAwarded,
      missionCompleted: shouldReturnGenuineKey ? false : state.missionCompleted,
      keyCells: nextKeyCells,
      doorStates: shouldReturnGenuineKey
        ? { ...state.doorStates, puzzle: 'closed' }
        : state.doorStates,
      keyPickupAlarmTriggered: shouldReturnGenuineKey ? false : state.keyPickupAlarmTriggered,
      emergencyAlarmActive: shouldReturnGenuineKey ? false : state.emergencyAlarmActive,
      securityBreachBannerVisible: false,
      puzzleTimerRunning: false,
    });
  },

  catchPlayerByBeast: () => {
    const state = get();
    if (
      state.progression === 'ESCAPED' ||
      state.progression === 'PLAYER_CAUGHT' ||
      state.escapeAnimating
    ) {
      return;
    }
    stopEmergencyAlarmSiren();
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }

    const shouldReturnGenuineKey = state.hasPuzzleRoomKey && !state.puzzleRoomEntered;
    const nextKeyCells = { ...state.keyCells };
    if (shouldReturnGenuineKey) {
      const realCellId = (Object.keys(nextKeyCells) as KeyCellId[]).find(
        (cid) => nextKeyCells[cid].variant === 'real'
      );
      if (realCellId) {
        nextKeyCells[realCellId] = {
          ...nextKeyCells[realCellId],
          keyCollected: false,
        };
      }
    }

    const nextPreCatch: ProgressionState =
      shouldReturnGenuineKey &&
      (state.progression === 'MISSION_COMPLETED' || state.progression === 'PUZZLE_ROOM_UNLOCKED')
        ? 'MISSION_ACTIVE'
        : state.progression;

    const isPermanentGameOver = state.respawnsRemaining <= 0;

    set({
      beastCapturing: false,
      playerHiddenSpotId: null,
      playerHiddenWitnessedBy: [],
      puzzleModalOpen: false,
      activeKeyCellModal: null,
      preCatchProgression: nextPreCatch,
      progression: 'PLAYER_CAUGHT',
      gameOverReason: state.puzzleTimerExpired ? 'puzzle-timeout' : 'beast-capture',
      permanentGameOver: isPermanentGameOver,
      keyReturnedOnCatch: shouldReturnGenuineKey,
      hasPuzzleRoomKey: shouldReturnGenuineKey ? false : state.hasPuzzleRoomKey,
      puzzleKeyAwarded: shouldReturnGenuineKey ? false : state.puzzleKeyAwarded,
      missionCompleted: shouldReturnGenuineKey ? false : state.missionCompleted,
      keyCells: nextKeyCells,
      doorStates: shouldReturnGenuineKey
        ? { ...state.doorStates, puzzle: 'closed' }
        : state.doorStates,
      keyPickupAlarmTriggered: shouldReturnGenuineKey ? false : state.keyPickupAlarmTriggered,
      emergencyAlarmActive: shouldReturnGenuineKey ? false : state.emergencyAlarmActive,
      securityBreachBannerVisible: false,
      puzzleTimerRunning: false,
    });
  },

  recoverFromBeastCatch: () => {
    const current = get();
    // Enforce strict 3-respawn limit: never allow respawning once all 3 respawns are exhausted
    if (current.respawnsRemaining <= 0 || current.permanentGameOver) {
      return;
    }

    clearSoundEvents();
    stopEmergencyAlarmSiren();
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    triggerPlayerActionAnim('respawn', 0.85);

    set((state) => {
      if (state.respawnsRemaining <= 0 || state.permanentGameOver) return state;

      const nextRespawns = Math.max(0, state.respawnsRemaining - 1);
      const timedOutInPuzzle =
        state.puzzleRoomEntered && !state.allPuzzlesCompleted && state.puzzleTimerSeconds <= 0;
      const resumePuzzleTimer = state.puzzleRoomEntered && !state.allPuzzlesCompleted;
      const nextSeq = (state.doorFeedback?.seq ?? 0) + 1;

      return {
        progression: state.preCatchProgression,
        gameOverReason: 'beast-capture',
        respawnsRemaining: nextRespawns,
        permanentGameOver: false,
        keyReturnedOnCatch: false,
        beastCapturing: false,
        gamePaused: false,
        playerHiddenSpotId: null,
        playerHiddenWitnessedBy: [],
        playerSpawnTarget: state.hasEnteredApartment ? 'f1-lobby' : 'f1-entry',
        playerSpawnTrigger: state.playerSpawnTrigger + 1,
        beastResetTrigger: state.beastResetTrigger + 1,
        playerFloor: 1,
        puzzleProtectionActive: timedOutInPuzzle ? true : state.puzzleProtectionActive,
        puzzleTimerExpired: timedOutInPuzzle ? false : state.puzzleTimerExpired,
        puzzleTimerSeconds: timedOutInPuzzle
          ? PUZZLE_TIME_LIMIT_SECONDS
          : state.puzzleTimerSeconds,
        puzzleTimerRunning: resumePuzzleTimer,
        puzzleWarning: timedOutInPuzzle ? 'none' : state.puzzleWarning,
        puzzleStage: timedOutInPuzzle ? 'suit-select' : state.puzzleStage,
        puzzleStageIndex: timedOutInPuzzle ? 0 : state.puzzleStageIndex,
        selectedPuzzleCategory: timedOutInPuzzle ? null : state.selectedPuzzleCategory,
        categoryLocked: timedOutInPuzzle ? false : state.categoryLocked,
        selectedCardSuit: timedOutInPuzzle ? null : state.selectedCardSuit,
        suitLocked: timedOutInPuzzle ? false : state.suitLocked,
        puzzleAttempts: timedOutInPuzzle ? 0 : state.puzzleAttempts,
        doorFeedback: {
          text: state.keyReturnedOnCatch
            ? `RESPAWNED (${nextRespawns}/${MAX_RESPAWNS} LEFT) — PUZZLE KEY RETURNED TO MISSION ROOM`
            : `RESPAWNED AT FLOOR 1 — ${nextRespawns}/${MAX_RESPAWNS} RESPAWNS REMAINING`,
          tone: 'info',
          seq: nextSeq,
        },
      };
    });
  },

  resetNewGame: () => {
    clearSoundEvents();
    stopEmergencyAlarmSiren();
    playerWorldPos.isHidden = false;
    playerWorldPos.hiddenSpotId = null;
    playerWorldPos.isCrouching = false;
    playerWorldPos.jumpOffsetY = 0;
    playerWorldPos.jumpVelocity = 0;
    const prev = get();
    // Fresh random Mission Room & Puzzle Room assignment on every New Game / Restart after Game Over
    const nextAssignment = randomizeSpecialRooms({
      missionRoomId: prev.missionRoomId,
      puzzleRoomId: prev.puzzleRoomId,
    });
    // Fresh procedurally generated puzzles across all 4 categories on every New Game / Restart
    const nextPuzzleSession = generatePuzzleSessionBundle();
    set((state) => ({
      ...INITIAL_CORE_STATE,
      screenPhase: 'playing',
      sceneLoadProgress: state.sceneLoadProgress,
      sceneReady: state.sceneReady,
      loadingSequenceTrigger: state.loadingSequenceTrigger,
      isRestarting: false,
      playerCrouched: false,
      inMainMenu: false,
      layoutVersion: state.layoutVersion + 1,
      missionRoomId: nextAssignment.missionRoomId,
      puzzleRoomId: nextAssignment.puzzleRoomId,
      missionRoomNumber: nextAssignment.missionRoomNumber,
      puzzleRoomNumber: nextAssignment.puzzleRoomNumber,
      missionFloor: nextAssignment.missionFloor,
      puzzleFloor: nextAssignment.puzzleFloor,
      puzzleSessionSeed: nextPuzzleSession.seed,
      puzzleSession: nextPuzzleSession,
      mouseSensitivity: state.mouseSensitivity,
      cameraDistance: state.cameraDistance,
      audioEnabled: state.audioEnabled,
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      ceilingLightsOn: state.ceilingLightsOn,
      cutawayMode: state.cutawayMode,
      playerSpawnTrigger: state.playerSpawnTrigger + 1,
      beastResetTrigger: state.beastResetTrigger + 1,
      presetVersion: state.presetVersion + 1,
    }));
    triggerPlayerActionAnim('respawn', 0.75);
  },

  setMouseSensitivity: (sensitivity) => {
    const next = clampMouseSensitivity(sensitivity);
    saveMouseSensitivity(next);
    set({ mouseSensitivity: next });
  },

  resetMouseSensitivity: () => {
    saveMouseSensitivity(DEFAULT_MOUSE_SENSITIVITY);
    set({ mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY });
  },

  setCameraDistance: (distance) => {
    const next = clampCameraDistance(distance);
    saveCameraDistance(next);
    set({ cameraDistance: next });
  },

  resetCameraDistance: () => {
    saveCameraDistance(DEFAULT_CAMERA_DISTANCE);
    set({ cameraDistance: DEFAULT_CAMERA_DISTANCE });
  },

  selectFloor: (floor) =>
    set((state) => ({
      controlMode: 'orbit',
      activeFloor: floor,
      cameraPreset: floor === 'all' ? 'overview' : (`floor-${floor}` as CameraPreset),
      presetVersion: state.presetVersion + 1,
    })),

  setCameraPreset: (preset) =>
    set((state) => {
      let nextFloor: FloorNumber | 'all' = state.activeFloor;
      if (preset === 'overview') nextFloor = 'all';
      else if (preset === 'floor-1') nextFloor = 1;
      else if (preset === 'floor-2') nextFloor = 2;
      else if (preset === 'floor-3') nextFloor = 3;
      else if (preset === 'floor-4') nextFloor = 4;
      else if (preset === 'mission-room') nextFloor = state.missionFloor;
      else if (preset === 'puzzle-room' || preset === 'exit-gate') nextFloor = state.puzzleFloor;

      return {
        controlMode: 'orbit',
        activeFloor: nextFloor,
        cameraPreset: preset,
        presetVersion: state.presetVersion + 1,
      };
    }),

  setCameraViewMode: (mode) =>
    set((state) => ({
      controlMode: 'orbit',
      cameraViewMode: mode,
      presetVersion: state.presetVersion + 1,
    })),

  toggleCutawayMode: () => set((state) => ({ cutawayMode: !state.cutawayMode })),
  toggleCeilingLights: () => set((state) => ({ ceilingLightsOn: !state.ceilingLightsOn })),
  toggleAudio: () =>
    set((state) => {
      const next = !state.audioEnabled;
      setAudioSettings({ enabled: next });
      if (next) initAudioContext();
      return { audioEnabled: next };
    }),
  setMasterVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setAudioSettings({ masterVolume: clamped });
    set({ masterVolume: clamped });
  },
  setMusicVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setAudioSettings({ musicVolume: clamped });
    set({ musicVolume: clamped });
  },
  setSfxVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setAudioSettings({ sfxVolume: clamped });
    set({ sfxVolume: clamped });
  },

  selectRoom: (roomId) => set({ selectedRoomId: roomId }),
  setHoveredDoor: (doorId) => set({ hoveredDoorId: doorId }),
  toggleHudCollapsed: () => set((state) => ({ hudCollapsed: !state.hudCollapsed })),

  resetView: () =>
    set((state) => ({
      activeFloor: 'all',
      cameraPreset: 'overview',
      cameraViewMode: 'orbit',
      selectedRoomId: null,
      presetVersion: state.presetVersion + 1,
    })),
}));
