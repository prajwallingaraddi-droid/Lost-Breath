export type FloorNumber = 1 | 2 | 3 | 4;

export type ScreenPhase = 'loading' | 'lobby' | 'briefing' | 'intro' | 'playing' | 'exited';

export type GameStage = 1 | 2 | 3 | 4;

export type ProgressionState =
  | 'EXPLORE'
  | 'MISSION_ROOM_UNLOCKED'
  | 'MISSION_ACTIVE'
  | 'MISSION_COMPLETED'
  | 'PUZZLE_ROOM_UNLOCKED'
  | 'PUZZLE_ACTIVE'
  | 'PUZZLES_COMPLETED'
  | 'EXIT_UNLOCKED'
  | 'ESCAPED'
  | 'PLAYER_CAUGHT';

export type BeastAiMode =
  | 'patrol'
  | 'investigate'
  | 'detect'
  | 'chase'
  | 'search'
  | 'capture';

export type BeastDifficultyStage = 'early' | 'mission' | 'puzzle' | 'escape';

export type BeastId = 0 | 1 | 2 | 3;

export interface BeastTelemetryEntry {
  id: BeastId;
  name: string;
  floor: FloorNumber;
  mode: BeastAiMode;
  distance: number;
  lastKnownFloor: FloorNumber | null;
}

export type HidingSpotType =
  | 'wardrobe'
  | 'storage-cabinet'
  | 'utility-cupboard'
  | 'crate-stack'
  | 'laundry-locker';

export interface HidingSpotDefinition {
  id: string;
  floor: FloorNumber;
  type: HidingSpotType;
  label: string;
  position: [number, number, number];
  rotationY: number;
  colliderBox: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  hidePos: [number, number, number];
  exitPos: [number, number, number];
  lookYaw: number;
}

export type SoundEventKind =
  | 'footstep-walk'
  | 'footstep-crouch'
  | 'footstep-sprint'
  | 'door-locked'
  | 'door-unlock'
  | 'terminal'
  | 'puzzle-loud'
  | 'hide-rustle'
  | 'key-alarm'
  | 'alert';

export interface SoundEvent {
  id: number;
  x: number;
  y: number;
  z: number;
  floor: FloorNumber;
  radius: number;
  intensity: number;
  kind: SoundEventKind;
  timestamp: number;
}

export type CameraPreset =
  | 'overview'
  | 'floor-1'
  | 'floor-2'
  | 'floor-3'
  | 'floor-4'
  | 'mission-room'
  | 'puzzle-room'
  | 'exit-gate';

export type CameraViewMode = 'orbit' | 'walkthrough';

export type ControlMode = 'third-person' | 'first-person' | 'orbit';

export type PlayerActionAnim =
  | 'none'
  | 'hide-enter'
  | 'hide-exit'
  | 'key-pickup'
  | 'door-interact'
  | 'puzzle-interact'
  | 'respawn'
  | 'capture-death';

export type DoorType = 'standard' | 'locked' | 'exit';

export type DoorDesignation =
  | 'mission-room'
  | 'puzzle-room'
  | 'final-exit'
  | 'apartment-unit';

export type DoorAnimState = 'closed' | 'opening' | 'open';

export type SpecialDoorKey = 'mission' | 'puzzle' | 'exit';

export type KeyCellId = 'cell-a' | 'cell-b';

export type KeyCellVariant = 'real' | 'false';

export interface KeyCellDefinition {
  id: KeyCellId;
  label: string;
  shortCode: string;
  variant: KeyCellVariant;
  position: [number, number, number];
  keypadPosition: [number, number, number];
  keyPosition: [number, number, number];
  rotationY: number;
}

export interface KeyCellState {
  id: KeyCellId;
  variant: KeyCellVariant;
  unlocked: boolean;
  doorState: DoorAnimState;
  keyCollected: boolean;
}

export type CardSuitId = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type PuzzleCategoryId = 'math' | 'cards' | 'memory' | 'mechanical';

export type PuzzleId = PuzzleCategoryId;

export type PuzzleStage =
  | 'idle'
  | 'suit-select'
  | 'instructions'
  | 'active'
  | 'completed'
  | 'failed';

export type DifficultyTier = 'Easy' | 'Medium' | 'Hard' | 'Very Hard';

export interface DifficultyProfile {
  floorDifference: number;
  label: DifficultyTier;
  timeLimitSeconds: number;
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type ApartmentUnitStyle = 'studio' | 'living' | 'bedroom' | 'utility' | 'mission' | 'puzzle' | 'exit';

export interface RoomDefinition {
  id: string;
  name: string;
  code: string;
  floor: FloorNumber;
  category: 'corridor' | 'utility' | 'security' | 'mission' | 'puzzle' | 'exit' | 'stairwell' | 'apartment';
  unitStyle: ApartmentUnitStyle;
  wing: 'north' | 'east' | 'south' | 'west';
  bounds: RoomBounds;
  description: string;
  accentColor: string;
}

export interface WallSegment {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thickness?: number;
  isFrontFacade?: boolean;
  isExterior?: boolean;
  isCorridorWall?: boolean;
}

export interface DoorDefinition {
  id: string;
  floor: FloorNumber;
  roomNumber: string;
  label: string;
  doorType: DoorType;
  designation: DoorDesignation;
  position: [number, number, number];
  rotationY: number;
  width: number;
  roomId: string;
  isInteriorEscape?: boolean;
}

export interface StaircaseDefinition {
  id: string;
  label: string;
  fromFloor: FloorNumber;
  toFloor: FloorNumber;
  origin: [number, number, number];
  rotationY: number;
  width: number;
  runLength: number;
}

export interface SlabCutout {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind?: 'courtyard' | 'stairwell';
}

export type ApartmentPropType =
  | 'sofa'
  | 'bed'
  | 'table'
  | 'kitchen'
  | 'wardrobe'
  | 'elec-box'
  | 'bench';

export interface PropPlacement {
  id: string;
  type: ApartmentPropType;
  position: [number, number, number];
  rotationY: number;
}

export interface PipeRun {
  id: string;
  points: [number, number, number][];
  radius: number;
  variant: 'coolant' | 'steam' | 'hazard';
}

export interface PuzzleTerminalDefinition {
  id: string;
  label: string;
  kind: 'circuits' | 'keypad' | 'diagnostic';
  position: [number, number, number];
}

export interface SpecialRoomConfig {
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

export interface FloorDefinition {
  floor: FloorNumber;
  name: string;
  subtitle: string;
  elevation: number;
  rooms: RoomDefinition[];
  walls: WallSegment[];
  doors: DoorDefinition[];
  props: PropPlacement[];
  pipes: PipeRun[];
  cutouts: SlabCutout[];
}
