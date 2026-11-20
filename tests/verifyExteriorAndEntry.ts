import assert from 'node:assert/strict';
import {
  assignSpecialRooms,
  COMPOUND_BOUNDS,
  COMPOUND_GATE_POS,
  COMPOUND_GATE_WIDTH,
  EXTERIOR_HERO_TREES,
  EXTERIOR_PLAYER_SPAWN,
  EXTERIOR_STATUE_POSITIONS,
  FLOOR_ELEVATIONS,
  getActivePuzzleEscapeFrame,
  LOBBY_RESPAWN_POS,
  MAIN_ENTRANCE_POS,
  MAIN_ENTRANCE_WIDTH,
} from '../src/data/buildingLayout';
import { getCurrentObjective, useGameStore } from '../src/store/useGameStore';
import { resolvePlayerMovement } from '../src/three/collision';
import { resolveThirdPersonCameraPosition } from '../src/three/thirdPersonCamera';
import { resolveSurfaceElevation } from '../src/three/floorNavigation';

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

console.log('Running LAST EXIT Exterior City, Single Compound Gate & Physical Entry verification...');

const closedDoorStates = {
  mission: 'closed' as const,
  puzzle: 'closed' as const,
  exit: 'closed' as const,
};

// ---------------------------------------------------------------------------
// TEST 1: Initial Spawn Outside Compound & Preserved Gameplay Objectives
// ---------------------------------------------------------------------------
{
  useGameStore.getState().startGameFromMenu();
  const s = useGameStore.getState();

  assert.equal(s.playerFloor, 1, 'Player must start on Floor 1 ground level');
  assert.equal(s.playerSpawnTarget, 'f1-entry', 'Start/New Game must spawn at exterior entry');
  assert.equal(s.compoundGateState, 'closed', 'Compound gate must start closed');
  assert.equal(s.mainEntranceState, 'closed', 'Apartment main entrance must start closed');
  assert.equal(s.hasEnteredApartment, false, 'Player starts outside the apartment');

  // Verify spawn point sits strictly outside the 92x92 compound on the abandoned city boulevard
  const [sx, sy, sz] = EXTERIOR_PLAYER_SPAWN;
  assert.ok(sz > COMPOUND_BOUNDS.maxZ + 10, `Spawn Z=${sz} must be outside compound maxZ=${COMPOUND_BOUNDS.maxZ}`);
  assert.equal(sy, 0, 'Spawn Y must be ground elevation');
  assert.equal(sx, COMPOUND_GATE_POS[0], 'Spawn X must align cleanly with the single compound gate');

  // Preserve getCurrentObjective contract
  const obj = getCurrentObjective({
    progression: s.progression,
    hasPuzzleRoomKey: s.hasPuzzleRoomKey,
    puzzleRoomEntered: s.puzzleRoomEntered,
    allPuzzlesCompleted: s.allPuzzlesCompleted,
    finalExitUnlocked: s.finalExitUnlocked,
    safeRoomUnlocked: s.safeRoomUnlocked,
    puzzleTimerExpired: s.puzzleTimerExpired,
  });
  assert.equal(obj, 'FIND THE MISSION ROOM', 'Initial objective string must remain preserved');
  console.log('PASS 1: Exterior boulevard spawn, initial gate/door state, and preserved objective verified.');
}

// ---------------------------------------------------------------------------
// TEST 2: Single Compound Gate Enforcement (Perimeter Blocks Everywhere Else)
// ---------------------------------------------------------------------------
{
  // Attempt to walk north across South compound wall AWAY from the single gate -> must be blocked
  const nonGateXs = [-34, -29, -25, -15, -8, -1, 2];
  for (const testX of nonGateXs) {
    let curZ = 47.4;
    for (let step = 0; step < 18; step++) {
      const res = resolvePlayerMovement({
        x: testX,
        feetY: 0,
        z: curZ - 0.25,
        doorStates: closedDoorStates,
        compoundGateOpen: true,
        mainEntranceOpen: true,
      });
      curZ = res.z;
    }
    assert.ok(
      curZ >= 46.5,
      `Compound perimeter must stay solid at non-gate X=${testX}, reached Z=${curZ.toFixed(2)}`
    );
  }

  // Attempt to walk through the SINGLE gate at X = -20.5 while CLOSED -> must be blocked
  let gateClosedZ = 47.4;
  for (let step = 0; step < 16; step++) {
    const res = resolvePlayerMovement({
      x: COMPOUND_GATE_POS[0],
      feetY: 0,
      z: gateClosedZ - 0.25,
      doorStates: closedDoorStates,
      compoundGateOpen: false,
      mainEntranceOpen: false,
    });
    gateClosedZ = res.z;
  }
  assert.ok(
    gateClosedZ >= 46.25,
    `Closed compound gate must block entry (stopped at Z=${gateClosedZ.toFixed(2)})`
  );

  // Open compound gate -> player physically walks straight through into compound yard
  assert.equal(useGameStore.getState().tryOpenCompoundGate(), true);
  useGameStore.getState().markCompoundGateOpen();
  assert.equal(useGameStore.getState().compoundGateState, 'open');

  let walkX = COMPOUND_GATE_POS[0];
  let walkZ = 47.4;
  for (let step = 0; step < 48; step++) {
    const res = resolvePlayerMovement({
      x: walkX,
      feetY: 0,
      z: walkZ - 0.35,
      doorStates: closedDoorStates,
      compoundGateOpen: true,
      mainEntranceOpen: false,
    });
    walkX = res.x;
    walkZ = res.z;
  }
  assert.ok(
    walkZ < 32.0 && walkZ > 28.1,
    `After opening gate, player must walk along compound walkway to main entrance (Z=${walkZ.toFixed(2)})`
  );
  console.log('PASS 2: Single compound entrance gate gating & perimeter sealing verified.');
}

// ---------------------------------------------------------------------------
// TEST 3: Physical Entry Through Main Apartment Entrance Into Floor 1 Lobby
// ---------------------------------------------------------------------------
{
  // Closed Main Entrance must block entry at Z = 28.0
  let closedMainZ = 29.4;
  for (let step = 0; step < 14; step++) {
    const res = resolvePlayerMovement({
      x: MAIN_ENTRANCE_POS[0],
      feetY: 0,
      z: closedMainZ - 0.25,
      doorStates: closedDoorStates,
      compoundGateOpen: true,
      mainEntranceOpen: false,
    });
    closedMainZ = res.z;
  }
  assert.ok(
    closedMainZ >= 28.35,
    `Closed Main Entrance must block player outside Z=28.0 (stopped at Z=${closedMainZ.toFixed(2)})`
  );

  // Open Main Entrance -> player physically walks directly inside Floor 1 SW lobby (Z < 27)
  assert.equal(useGameStore.getState().tryOpenMainEntrance(), true);
  useGameStore.getState().markMainEntranceOpen();
  assert.equal(useGameStore.getState().mainEntranceState, 'open');

  let insideX = MAIN_ENTRANCE_POS[0];
  let insideZ = 29.4;
  for (let step = 0; step < 26; step++) {
    const res = resolvePlayerMovement({
      x: insideX,
      feetY: 0,
      z: insideZ - 0.28,
      doorStates: closedDoorStates,
      compoundGateOpen: true,
      mainEntranceOpen: true,
    });
    insideX = res.x;
    insideZ = res.z;
  }
  assert.ok(
    insideZ <= LOBBY_RESPAWN_POS[2] + 0.5,
    `Opening Main Entrance must physically connect exterior to Floor 1 SW Lobby (reached Z=${insideZ.toFixed(2)})`
  );
  assert.ok(
    Math.abs(insideX - MAIN_ENTRANCE_POS[0]) < MAIN_ENTRANCE_WIDTH / 2,
    'Player path through Main Entrance remained centered cleanly'
  );
  console.log('PASS 3: Physical Main Entrance doorway connects exterior compound directly to Floor 1 interior.');
}

// ---------------------------------------------------------------------------
// TEST 4: Beasts Strictly Contained Inside Building Even When Main Entrance Open
// ---------------------------------------------------------------------------
{
  let beastZ = 25.0;
  for (let step = 0; step < 24; step++) {
    const res = resolvePlayerMovement({
      x: MAIN_ENTRANCE_POS[0],
      feetY: 0,
      z: beastZ + 0.35,
      doorStates: closedDoorStates,
      compoundGateOpen: true,
      mainEntranceOpen: true,
      isBeast: true,
    });
    beastZ = res.z;
  }
  assert.ok(
    beastZ <= 27.5,
    `Beasts must stay strictly inside building perimeter even when Main Entrance is open (beastZ=${beastZ.toFixed(2)})`
  );
  console.log('PASS 4: Beast indoor containment strictly enforced across Main Entrance.');
}

// ---------------------------------------------------------------------------
// TEST 5: Exterior Camera Raycast, Surface Elevation & Safe Room Compound Clearance
// ---------------------------------------------------------------------------
{
  // Surface elevation outdoors stays smoothly at ground 0.0
  const surfStreet = resolveSurfaceElevation(EXTERIOR_PLAYER_SPAWN[0], EXTERIOR_PLAYER_SPAWN[2], 0);
  const surfYard = resolveSurfaceElevation(MAIN_ENTRANCE_POS[0], 37.0, 0);
  assert.equal(surfStreet, FLOOR_ELEVATIONS[1]);
  assert.equal(surfYard, FLOOR_ELEVATIONS[1]);

  // Camera outdoors maintains full pull-back behind spawn without collapsing into interior bounds
  const camAtSpawn = resolveThirdPersonCameraPosition({
    playerX: EXTERIOR_PLAYER_SPAWN[0],
    playerFeetY: 0,
    playerZ: EXTERIOR_PLAYER_SPAWN[2],
    yaw: 0,
    pitch: 0.16,
    desiredDistance: 3.1,
    doorStates: closedDoorStates,
    compoundGateOpen: false,
    mainEntranceOpen: false,
  });
  assert.ok(camAtSpawn.camZ > EXTERIOR_PLAYER_SPAWN[2] + 2.2, 'Exterior camera pulls cleanly behind player on street');
  assert.ok(camAtSpawn.effectiveDistance >= 2.8, 'Unobstructed street camera keeps desired pull-back');

  // Verify Escape Tower clears compound perimeter walls across all 4 randomized wings & floors
  const wings: Array<[string, string]> = [
    ['f2-208', 'f1-103'],
    ['f3-318', 'f2-208'],
    ['f1-101', 'f3-313'],
    ['f2-215', 'f4-418'],
  ];
  for (const [mId, pId] of wings) {
    assignSpecialRooms(mId, pId);
    const frame = getActivePuzzleEscapeFrame();
    assert.ok(
      Math.abs(frame.centerX) < COMPOUND_BOUNDS.maxX - 8 &&
        Math.abs(frame.centerZ) < COMPOUND_BOUNDS.maxZ - 8,
      `Escape frame must have ample clearance inside compound perimeter (${pId})`
    );
  }

  // Verify exterior landmarks & tree clearances against entry path
  assert.ok(COMPOUND_GATE_WIDTH >= 4.0, 'Single compound gate is wide and comfortable to traverse');
  assert.equal(EXTERIOR_STATUE_POSITIONS.length, 4, 'Four weathered classical street statues placed');
  assert.ok(EXTERIOR_HERO_TREES.length >= 12, 'Overgrown hero trees populate street and compound');
  for (const t of EXTERIOR_HERO_TREES) {
    const onEntryCorridor =
      Math.abs(t.x - MAIN_ENTRANCE_POS[0]) < 3.6 && t.z >= 27 && t.z <= 76;
    assert.equal(onEntryCorridor, false, `Tree at (${t.x}, ${t.z}) must not block player entry path`);
  }

  console.log('PASS 5: Exterior elevation, camera raycast, Escape Tower clearances, and landmark placements verified.');
}

console.log('ALL EXTERIOR & ENTRY VERIFICATION CHECKS PASSED.');
