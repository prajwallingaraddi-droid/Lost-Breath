import assert from 'node:assert/strict';
import {
  assignSpecialRooms,
  FLOOR_ELEVATIONS,
  FLOOR_HEIGHT,
  SLAB_THICKNESS,
  SPECIAL_ROOMS_CONFIG,
} from '../src/data/buildingLayout';
import { BEAST_DIFFICULTY_PROFILES } from '../src/data/beastConfig';
import { HIDING_SPOTS } from '../src/data/hidingSpots';
import {
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_MOUSE_SENSITIVITY,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  SETTINGS_STORAGE_KEY,
  useGameStore,
} from '../src/store/useGameStore';
import { createBeastBrainStateForRoster, stepBeastBrain } from '../src/three/beastAiEngine';
import { canBeastSeePlayer } from '../src/three/beastNavigation';
import { resolvePlayerMovement } from '../src/three/collision';
import { createPlayerSurvivorMaterials } from '../src/three/playerTextures';
import {
  playerWorldPos,
  triggerPlayerActionAnim,
  worldDirToCharacterYaw,
} from '../src/three/playerWorldState';
import {
  CAMERA_MIN_OCCLUDED_DIST,
  resolveThirdPersonCameraPosition,
} from '../src/three/thirdPersonCamera';

// Mock localStorage for Node verification
const storageMap = new Map<string, string>();
(globalThis as unknown as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storageMap.set(k, v);
    },
    removeItem: (k: string) => {
      storageMap.delete(k);
    },
  },
};

console.log('Running LAST EXIT Third-Person Player Character & Camera verification suite...');

// ---------------------------------------------------------------------------
// TEST 1: Default Third-Person Gameplay Perspective & Camera Distance Setting
// ---------------------------------------------------------------------------
{
  useGameStore.getState().startGameFromMenu();
  const s = useGameStore.getState();
  assert.equal(s.controlMode, 'third-person', 'Default gameplay perspective must be third-person');
  assert.equal(s.mouseSensitivity, DEFAULT_MOUSE_SENSITIVITY);
  assert.equal(s.cameraDistance, DEFAULT_CAMERA_DISTANCE);

  // Adjust & persist cameraDistance
  s.setCameraDistance(4.4);
  assert.equal(useGameStore.getState().cameraDistance, 4.4);
  const rawStored = JSON.parse(storageMap.get(SETTINGS_STORAGE_KEY) || '{}') as {
    cameraDistance?: number;
  };
  assert.equal(rawStored.cameraDistance, 4.4, 'Camera distance must persist to localStorage');

  // Out-of-range clamping
  s.setCameraDistance(99);
  assert.equal(useGameStore.getState().cameraDistance, MAX_CAMERA_DISTANCE);
  s.setCameraDistance(0.1);
  assert.equal(useGameStore.getState().cameraDistance, MIN_CAMERA_DISTANCE);

  // Reset to default
  s.resetCameraDistance();
  assert.equal(useGameStore.getState().cameraDistance, DEFAULT_CAMERA_DISTANCE);
  console.log('PASS 1: Third-person default perspective and persisted camera distance setting verified.');
}

// ---------------------------------------------------------------------------
// TEST 2: Survivor Character Materials, Contrast & Disposal
// ---------------------------------------------------------------------------
{
  const mats = createPlayerSurvivorMaterials();
  assert.ok(mats.tunicMat && mats.trousersMat && mats.beltLeatherMat && mats.bootLeatherMat);
  assert.ok(mats.skinMat && mats.headMat && mats.hairMat && mats.shadowMat);
  // Roughness separation: leather boots/belt (<= 0.5) vs matte cream linen tunic (>= 0.85)
  assert.ok(
    mats.tunicMat.roughness - mats.bootLeatherMat.roughness >= 0.35,
    'Leather boots must have distinct PBR roughness contrast against matte linen tunic'
  );
  mats.dispose();
  console.log('PASS 2: Survivor 3D character PBR materials verified and cleanly disposed.');
}

// ---------------------------------------------------------------------------
// TEST 3: Character Movement Facing Direction & Zero-Slide Alignment
// ---------------------------------------------------------------------------
{
  // Character forward vector for rotation.y = yaw is (+sin(yaw), +cos(yaw))
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7071, 0.7071],
    [-0.7071, 0.7071],
    [0.7071, -0.7071],
    [-0.7071, -0.7071],
  ];
  for (const [dx, dz] of dirs) {
    const yaw = worldDirToCharacterYaw(dx, dz);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const len = Math.hypot(dx, dz);
    assert.ok(
      Math.abs(fx - dx / len) < 1e-4 && Math.abs(fz - dz / len) < 1e-4,
      `Character facing yaw must match movement direction (${dx}, ${dz})`
    );
  }
  console.log('PASS 3: Character facing direction matches movement vectors across all 8 directions.');
}

// ---------------------------------------------------------------------------
// TEST 4: Third-Person Camera Over-Shoulder Placement & Wall/Door/Ceiling Collision
// ---------------------------------------------------------------------------
{
  const closedDoors = {
    mission: 'closed' as const,
    puzzle: 'closed' as const,
    exit: 'closed' as const,
  };

  // Open corridor (Floor 1 North corridor along X at z = -14.8, looking East yaw = -PI/2)
  const openCam = resolveThirdPersonCameraPosition({
    playerX: 0,
    playerFeetY: FLOOR_ELEVATIONS[1],
    playerZ: -14.8,
    yaw: -Math.PI / 2,
    pitch: 0.14,
    desiredDistance: 3.0,
    doorStates: closedDoors,
  });
  // Camera must be behind player (-X side when looking +X) and above feetY
  assert.ok(openCam.camX < -1.5, 'Camera should sit behind the player along -X when looking +X');
  assert.ok(openCam.camY > FLOOR_ELEVATIONS[1] + 1.5, 'Camera should sit above player shoulder');
  assert.ok(
    openCam.camY < FLOOR_ELEVATIONS[1] + FLOOR_HEIGHT - SLAB_THICKNESS,
    'Camera must stay strictly below floor ceiling slab'
  );
  assert.ok(openCam.effectiveDistance >= 2.5, 'Open corridor should keep full follow distance');

  // Back right up against outer perimeter wall at x = -27.0 looking East (+X): camera MUST pull in!
  const wallCam = resolveThirdPersonCameraPosition({
    playerX: -26.8,
    playerFeetY: FLOOR_ELEVATIONS[1],
    playerZ: -15.8,
    yaw: -Math.PI / 2,
    pitch: 0.14,
    desiredDistance: 3.6,
    doorStates: closedDoors,
  });
  assert.ok(wallCam.isOccluded, 'Wall directly behind player must trigger camera occlusion pull-in');
  assert.ok(wallCam.camX >= -27.56, `Camera must not pass through exterior wall (camX=${wallCam.camX})`);
  assert.ok(
    wallCam.effectiveDistance >= 0.16 &&
      wallCam.effectiveDistance < 1.5,
    `Occluded camera should pull in cleanly (got ${wallCam.effectiveDistance.toFixed(2)}m)`
  );

  // Standing in narrow corridor facing perpendicular to inner courtyard/apartment wall
  const narrowCam = resolveThirdPersonCameraPosition({
    playerX: 0,
    playerFeetY: FLOOR_ELEVATIONS[2],
    playerZ: -16.0, // close to North apartment wall at z = -16.6
    yaw: Math.PI, // looking South (+Z), so camera wants to sit North (-Z) through wall at -16.6
    pitch: 0.1,
    desiredDistance: 3.5,
    doorStates: closedDoors,
  });
  assert.ok(narrowCam.isOccluded, 'Corridor wall behind player must pull camera forward');
  assert.ok(narrowCam.camZ > -16.65, `Camera must not clip behind apartment corridor wall (camZ=${narrowCam.camZ})`);

  // Extreme downward pitch must still respect ceiling slab height
  const highPitchCam = resolveThirdPersonCameraPosition({
    playerX: 0,
    playerFeetY: FLOOR_ELEVATIONS[1],
    playerZ: -14.8,
    yaw: -Math.PI / 2,
    pitch: 0.92,
    desiredDistance: 4.5,
    doorStates: closedDoors,
  });
  assert.ok(
    highPitchCam.camY <= FLOOR_ELEVATIONS[1] + FLOOR_HEIGHT - SLAB_THICKNESS - 0.25,
    'High pitch must clamp below ceiling slab'
  );

  console.log('PASS 4: Third-person camera placement, corridor/wall occlusion pull-in & ceiling clamp verified.');
}

// ---------------------------------------------------------------------------
// TEST 5: Beast AI Detects Actual Player Body Position (NOT Offset Camera)
// ---------------------------------------------------------------------------
{
  assignSpecialRooms('f2-208', 'f3-318');
  const closedDoors = {
    mission: 'closed' as const,
    puzzle: 'closed' as const,
    exit: 'closed' as const,
  };

  // Place player in North corridor at x = 0, z = -14.8; camera sits behind at x = -3.0
  const playerX = 0;
  const playerZ = -14.8;
  const camSol = resolveThirdPersonCameraPosition({
    playerX,
    playerFeetY: FLOOR_ELEVATIONS[1],
    playerZ,
    yaw: -Math.PI / 2,
    pitch: 0.14,
    desiredDistance: 3.0,
    doorStates: closedDoors,
  });
  assert.ok(Math.hypot(camSol.camX - playerX, camSol.camZ - playerZ) > 2.2);

  // Beast stands at x = 4.0, z = -14.8 looking West (-X, yaw = -PI/2) toward player body
  const beast = createBeastBrainStateForRoster(0);
  beast.x = 4.0;
  beast.feetY = FLOOR_ELEVATIONS[1];
  beast.z = -14.8;
  beast.yaw = -Math.PI / 2;
  beast.mode = 'patrol';

  // Confirm Beast sees player body at (0, -14.8) in third-person mode
  const profile = BEAST_DIFFICULTY_PROFILES.early;
  const seesBody = canBeastSeePlayer({
    beastX: beast.x,
    beastY: beast.feetY,
    beastZ: beast.z,
    beastYaw: beast.yaw,
    playerX,
    playerY: FLOOR_ELEVATIONS[1],
    playerZ,
    visionRange: profile.visionRange,
    visionFovDeg: profile.visionFovDeg,
    proximitySenseRadius: profile.proximitySenseRadius,
    doorStates: closedDoors,
    playerHidden: false,
    puzzleRoomProtected: false,
  });
  assert.equal(seesBody, true, 'Beast must detect actual player character body in corridor');

  // Step Beast AI with controlMode: 'third-person' — Beast must transition to detect/chase and target player body
  let detected = false;
  for (let i = 0; i < 12; i++) {
    stepBeastBrain({
      state: beast,
      delta: 0.05,
      playerX,
      playerFeetY: FLOOR_ELEVATIONS[1],
      playerZ,
      controlMode: 'third-person',
      doorStates: closedDoors,
      keyAlarmTriggered: false,
      beastAlerted: false,
      puzzleRoomProtected: false,
      puzzleTimerExpired: false,
      playerHidden: false,
      playerHiddenSpotId: null,
      witnessedHidingSpotId: null,
      otherBeasts: [],
      reservedPatrolNodeIds: [],
      profile,
    });
    const liveMode: string = beast.mode;
    if (liveMode === 'detect' || liveMode === 'chase') detected = true;
  }
  assert.equal(detected, true, 'Beast AI must detect & pursue player in third-person controlMode');
  assert.ok(beast.lastKnownPlayerPos !== null);
  assert.ok(
    Math.abs(beast.lastKnownPlayerPos.x - playerX) < 0.01 &&
      Math.abs(beast.lastKnownPlayerPos.z - playerZ) < 0.01,
    'Beast lastKnownPlayerPos must track actual player body, NOT offset third-person camera'
  );

  // Confirm player character collision still stops cleanly at apartment wall
  const wallHit = resolvePlayerMovement({
    x: 0,
    z: -16.55,
    feetY: FLOOR_ELEVATIONS[1],
    doorStates: closedDoors,
    isBeast: false,
    puzzleRoomProtected: false,
  });
  assert.ok(wallHit.z > -16.4, 'Player character must not pass through apartment walls');

  console.log('PASS 5: Beast AI detects/tracks actual player body in third-person mode & player collision holds.');
}

// ---------------------------------------------------------------------------
// TEST 6: Hiding, Key Collection, Capture & Respawn Action Animations
// ---------------------------------------------------------------------------
{
  useGameStore.getState().startGameFromMenu();
  assert.equal(playerWorldPos.actionAnim, 'respawn', 'New game spawn triggers respawn recovery anim');

  // Hiding enter & exit animations
  const spot = HIDING_SPOTS[0];
  useGameStore.getState().enterHidingSpot(spot.id, []);
  assert.equal(playerWorldPos.isHidden, true);
  assert.equal(playerWorldPos.actionAnim, 'hide-enter');

  useGameStore.getState().exitHidingSpot();
  assert.equal(playerWorldPos.isHidden, false);
  assert.equal(playerWorldPos.actionAnim, 'hide-exit');

  // Key pickup animation
  const st = useGameStore.getState();
  st.tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.missionDoorId);
  st.markSpecialDoorOpen('mission');
  st.enterMissionRoom();
  st.submitKeyCellPassword('cell-b', useGameStore.getState().missionRoomNumber);
  st.markKeyCellDoorOpen('cell-b');
  st.collectKeyFromCell('cell-b');
  assert.equal(playerWorldPos.actionAnim, 'key-pickup', 'Collecting key triggers key-pickup animation');

  // Door & puzzle interaction triggers
  triggerPlayerActionAnim('door-interact', 0.55);
  assert.equal(playerWorldPos.actionAnim, 'door-interact');
  triggerPlayerActionAnim('puzzle-interact', 0.7);
  assert.equal(playerWorldPos.actionAnim, 'puzzle-interact');

  // Capture & respawn cycle restores player model cleanly
  useGameStore.getState().beginBeastCapture();
  assert.equal(playerWorldPos.actionAnim, 'capture-death', 'Beast capture triggers capture-death animation');
  useGameStore.getState().completeBeastCapture();
  assert.equal(useGameStore.getState().progression, 'PLAYER_CAUGHT');

  useGameStore.getState().recoverFromBeastCatch();
  assert.equal(useGameStore.getState().progression, 'MISSION_ACTIVE');
  assert.equal(useGameStore.getState().respawnsRemaining, 2);
  assert.equal(playerWorldPos.actionAnim, 'respawn', 'Respawning restores character with respawn animation');
  assert.equal(playerWorldPos.isHidden, false);

  console.log('PASS 6: Hiding, key pickup, door/puzzle interaction, capture & respawn animations verified.');
}

console.log('ALL THIRD-PERSON PLAYER CHARACTER & CAMERA TESTS PASSED!');
