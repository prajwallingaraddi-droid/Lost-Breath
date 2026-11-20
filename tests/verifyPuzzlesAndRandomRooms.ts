import assert from 'node:assert/strict';
import {
  ALL_DOORS,
  ALL_ROOMS,
  assignSpecialRooms,
  EMERGENCY_DESCENT_STAIRCASES,
  escapeLocalToWorld,
  FLOOR_ELEVATIONS,
  getActivePuzzleEscapeFrame,
  getMissionRoomNumber,
  GROUND_ESCAPE_ZONE,
  MISSION_KEY_CELLS,
  SAFE_ROOM_BOUNDS,
  SPECIAL_ROOMS_CONFIG,
} from '../src/data/buildingLayout';
import {
  clearPuzzleHistoryForTests,
  PUZZLE_CATEGORY_ORDER,
  PUZZLE_CATEGORY_SPECS,
  PUZZLE_TIME_LIMIT_SECONDS,
  validatePuzzleSessionBundle,
} from '../src/data/puzzleConfig';
import { resolvePlayerMovement } from '../src/three/collision';
import {
  getFloorFromElevation,
  resolveSurfaceElevation,
  stairLocalToWorld,
} from '../src/three/floorNavigation';
import { DoorAnimState, PuzzleCategoryId, SpecialDoorKey } from '../src/types/game';

async function runPuzzlesAndRandomRoomsTests() {
  const storageMap = new Map<string, string>();
  (globalThis as unknown as { window: Record<string, unknown> }).window = {
    localStorage: {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => storageMap.set(k, v),
      removeItem: (k: string) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    },
  };

  const { useGameStore, getCurrentObjective } = await import('../src/store/useGameStore');

  console.log('Running LAST EXIT Randomized 4 Mini-Games & Dynamic Room Assignment verification suite...');

  // ---------------------------------------------------------------------------
  // 1. Fresh Procedural Generation Across 8 Consecutive New Games (Zero Static Repeats)
  // ---------------------------------------------------------------------------
  {
    clearPuzzleHistoryForTests();
    const seenSeeds = new Set<number>();
    const mathSigs = new Set<string>();
    const cardSigs = new Set<string>();
    const memSigs = new Set<string>();
    const mechSigs = new Set<string>();
    const missionRoomsSeen = new Set<string>();
    const puzzleRoomsSeen = new Set<string>();

    let prevMissionId = '';
    let prevPuzzleId = '';

    for (let run = 0; run < 8; run += 1) {
      if (run % 2 === 0) {
        useGameStore.getState().startGameFromMenu();
      } else {
        useGameStore.getState().resetNewGame();
      }

      const st = useGameStore.getState();
      // Validate 80-room invariant & distinct random room assignments
      assert.equal(ALL_ROOMS.length, 80, 'Building must always preserve all 80 rooms');
      assert.notEqual(st.missionRoomId, st.puzzleRoomId, 'Mission and Puzzle room must NEVER be identical');
      assert.equal(SPECIAL_ROOMS_CONFIG.missionRoomId, st.missionRoomId);
      assert.equal(SPECIAL_ROOMS_CONFIG.puzzleRoomId, st.puzzleRoomId);
      assert.equal(getMissionRoomNumber(), st.missionRoomNumber);
      assert.equal(MISSION_KEY_CELLS.length, 2, 'Mission Room must always have 2 Key Cells');

      if (prevMissionId) {
        assert.notEqual(st.missionRoomId, prevMissionId, 'Consecutive new games must avoid immediate Mission Room repeat');
        assert.notEqual(st.puzzleRoomId, prevPuzzleId, 'Consecutive new games must avoid immediate Puzzle Room repeat');
      }
      prevMissionId = st.missionRoomId;
      prevPuzzleId = st.puzzleRoomId;
      missionRoomsSeen.add(st.missionRoomId);
      puzzleRoomsSeen.add(st.puzzleRoomId);

      // Validate generated puzzle session bundle
      const bundle = st.puzzleSession;
      const check = validatePuzzleSessionBundle(bundle);
      assert.equal(check.valid, true, `Run ${run + 1} bundle invalid: ${check.errors.join('; ')}`);
      seenSeeds.add(bundle.seed);

      // Track procedural signatures across sessions
      bundle.math.forEach((s) => mathSigs.add(s.signature));
      bundle.cards.forEach((s) => cardSigs.add(s.signature));
      bundle.memory.forEach((s) => memSigs.add(s.signature));
      bundle.mechanical.forEach((s) => mechSigs.add(s.signature));

      // Verify zero duplicate questions within a single session
      assert.equal(new Set(bundle.math.map((s) => s.signature)).size, 4);
      assert.equal(new Set(bundle.cards.map((s) => s.signature)).size, 4);
      assert.equal(new Set(bundle.memory.map((s) => s.signature)).size, 3);
      assert.equal(new Set(bundle.mechanical.map((s) => s.signature)).size, 3);
    }

    assert.equal(seenSeeds.size, 8, 'Every new game must produce a unique procedural seed');
    assert.ok(mathSigs.size >= 24, `Expected high procedural variety in Math (got ${mathSigs.size}/32 unique)`);
    assert.ok(cardSigs.size >= 24, `Expected high procedural variety in Playing Cards (got ${cardSigs.size}/32 unique)`);
    assert.ok(memSigs.size >= 22, `Expected high procedural variety in Memory (got ${memSigs.size}/24 unique)`);
    assert.ok(mechSigs.size >= 18, `Expected high procedural variety in Mechanical Logic (got ${mechSigs.size}/24 unique)`);
    assert.ok(missionRoomsSeen.size >= 5, `Mission Room should randomize widely across runs (saw ${missionRoomsSeen.size})`);
    assert.ok(puzzleRoomsSeen.size >= 5, `Puzzle Room should randomize widely across runs (saw ${puzzleRoomsSeen.size})`);

    console.log(
      `PASS 1: 8 consecutive New Games verified — unique signatures: Math=${mathSigs.size}/32, Cards=${cardSigs.size}/32, Memory=${memSigs.size}/24, Mech=${mechSigs.size}/24; Rooms: ${missionRoomsSeen.size} Mission, ${puzzleRoomsSeen.size} Puzzle.`
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Completing ANY ONE of the 4 Categories Unlocks Safe Room & Preserves Timer/Lock Rules
  // ---------------------------------------------------------------------------
  for (const cat of PUZZLE_CATEGORY_ORDER as PuzzleCategoryId[]) {
    useGameStore.getState().startGameFromMenu();
    const st0 = useGameStore.getState();

    // Non-spoiler objective before discovery
    const exploreObj = getCurrentObjective(st0);
    assert.equal(exploreObj, 'FIND THE MISSION ROOM');
    assert.ok(!exploreObj.includes(st0.missionRoomNumber), 'Objective must NOT leak Mission Room number');

    // Open dynamically assigned Mission Room & collect genuine key with its dynamic room number password
    assert.equal(st0.tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.missionDoorId).opened, true);
    useGameStore.getState().markSpecialDoorOpen('mission');
    useGameStore.getState().enterMissionRoom();

    const roomPw = getMissionRoomNumber();
    const badPw = useGameStore.getState().submitKeyCellPassword('cell-a', '000');
    assert.equal(badPw.granted, false, 'Wrong password must be rejected');
    const goodPw = useGameStore.getState().submitKeyCellPassword('cell-a', roomPw);
    assert.equal(goodPw.granted, true, `Dynamic Mission Room password ${roomPw} must unlock Cell A`);
    useGameStore.getState().collectKeyFromCell('cell-a');
    assert.equal(useGameStore.getState().hasPuzzleRoomKey, true);

    // Ordinary respawn preserves current Mission & Puzzle room assignments
    const savedMission = useGameStore.getState().missionRoomId;
    const savedPuzzle = useGameStore.getState().puzzleRoomId;
    const savedSeed = useGameStore.getState().puzzleSessionSeed;

    // Open & Enter dynamically assigned Puzzle Room
    assert.equal(useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.puzzleDoorId).opened, true);
    useGameStore.getState().markSpecialDoorOpen('puzzle');
    useGameStore.getState().enterPuzzleRoom();

    assert.equal(useGameStore.getState().puzzleTimerSeconds, PUZZLE_TIME_LIMIT_SECONDS);
    assert.equal(useGameStore.getState().puzzleTimerRunning, true);
    assert.equal(useGameStore.getState().puzzleProtectionActive, true);

    // Select & Start this category
    useGameStore.getState().selectPuzzleCategory(cat);
    assert.equal(useGameStore.getState().selectedPuzzleCategory, cat);
    useGameStore.getState().startPuzzleChallenge();
    assert.equal(useGameStore.getState().categoryLocked, true);

    // Advance through all stages of this category and complete
    const stageCount = PUZZLE_CATEGORY_SPECS[cat].stageCount;
    for (let s = 0; s < stageCount - 1; s += 1) {
      useGameStore.getState().advancePuzzleStage();
      assert.equal(useGameStore.getState().puzzleStageIndex, s + 1);
    }
    useGameStore.getState().completePuzzleChallenge();

    const solved = useGameStore.getState();
    assert.equal(solved.allPuzzlesCompleted, true, `Completing ${cat} must mark challenge completed`);
    assert.equal(solved.safeRoomUnlocked, true, `Completing ${cat} must unlock Safe Room`);
    assert.equal(solved.finalExitUnlocked, true, `Completing ${cat} must unlock Final Exit`);
    assert.equal(solved.doorStates.exit, 'opening', `Completing ${cat} must open Safe Room door`);
    assert.equal(solved.progression, 'EXIT_UNLOCKED');
    assert.equal(solved.missionRoomId, savedMission);
    assert.equal(solved.puzzleRoomId, savedPuzzle);
    assert.equal(solved.puzzleSessionSeed, savedSeed);
  }
  console.log('PASS 2: All 4 categories (math, cards, memory, mechanical) independently lock, progress across all stages, and unlock the Safe Room.');

  // ---------------------------------------------------------------------------
  // 3. Physical Safe Room & Emergency Descent Traversal Across ALL 4 Wings & ALL 4 Floors
  // ---------------------------------------------------------------------------
  const wingAndFloorSamples: { mission: string; puzzle: string; label: string; expectedFlights: number }[] = [
    { mission: 'f2-208', puzzle: 'f1-103', label: 'Floor 1 North Wing (Direct Ground Exit)', expectedFlights: 0 },
    { mission: 'f3-318', puzzle: 'f2-208', label: 'Floor 2 East Wing (1 Descent Flight)', expectedFlights: 1 },
    { mission: 'f1-101', puzzle: 'f3-313', label: 'Floor 3 South Wing (2 Descent Flights)', expectedFlights: 2 },
    { mission: 'f2-215', puzzle: 'f4-418', label: 'Floor 4 West Wing (3 Descent Flights)', expectedFlights: 3 },
  ];

  const allOpenDoors: Record<SpecialDoorKey, DoorAnimState> = {
    mission: 'open',
    puzzle: 'open',
    exit: 'open',
  };

  for (const sample of wingAndFloorSamples) {
    assignSpecialRooms(sample.mission, sample.puzzle);
    assert.equal(
      EMERGENCY_DESCENT_STAIRCASES.length,
      sample.expectedFlights,
      `${sample.label}: expected ${sample.expectedFlights} descent flights`
    );

    const ef = getActivePuzzleEscapeFrame();
    const exitDoor = ALL_DOORS.find((d) => d.id === SPECIAL_ROOMS_CONFIG.finalExitDoorId);
    assert.ok(exitDoor && exitDoor.floor === ef.floor, `${sample.label}: Safe Room door must sit on Floor ${ef.floor}`);

    // Start inside Puzzle Room near rear Safe Room door (escape local X = -4.2, Z = 0)
    let [px, pz] = escapeLocalToWorld(-4.2, 0, ef);
    let py = FLOOR_ELEVATIONS[ef.floor];

    const walkTo = (tx: number, tz: number, maxSteps = 45) => {
      for (let i = 0; i < maxSteps; i += 1) {
        const dx = tx - px;
        const dz = tz - pz;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.08) break;
        const stepLen = Math.min(dist, 0.32);
        const res = resolvePlayerMovement({
          x: px + (dx / dist) * stepLen,
          z: pz + (dz / dist) * stepLen,
          feetY: py,
          radius: 0.34,
          doorStates: allOpenDoors,
          isBeast: false,
          puzzleRoomProtected: true,
        });
        const nextY = resolveSurfaceElevation(res.x, res.z, py);
        assert.ok(
          Math.abs(nextY - py) <= 0.45,
          `${sample.label}: vertical discontinuity ${py.toFixed(2)} -> ${nextY.toFixed(2)}`
        );
        px = res.x;
        pz = res.z;
        py = nextY;
      }
    };

    // Walk into Safe Room center
    walkTo(SAFE_ROOM_BOUNDS.centerX, SAFE_ROOM_BOUNDS.centerZ, 35);
    assert.equal(getFloorFromElevation(py), ef.floor);

    // Descend each Emergency Descent flight in top-down order (if puzzleFloor >= 2)
    const flightsTopDown = [...EMERGENCY_DESCENT_STAIRCASES].sort((a, b) => b.fromFloor - a.fromFloor);
    for (const stair of flightsTopDown) {
      const [topX, topZ] = stairLocalToWorld(0.94, 2.6, stair);
      const [midAX, midAZ] = stairLocalToWorld(0.94, -1.75, stair);
      const [midBX, midBZ] = stairLocalToWorld(-0.94, -1.75, stair);
      const [botX, botZ] = stairLocalToWorld(-0.94, 2.6, stair);
      walkTo(topX, topZ, 35);
      walkTo(midAX, midAZ, 40);
      walkTo(midBX, midBZ, 20);
      walkTo(botX, botZ, 40);
      assert.equal(
        getFloorFromElevation(py),
        stair.fromFloor,
        `${sample.label}: expected Floor ${stair.fromFloor} after ${stair.id}, got F${getFloorFromElevation(py)} (y=${py.toFixed(2)})`
      );
    }

    // Walk into Floor 1 Ground Escape Zone
    const [gx, gz] = escapeLocalToWorld(-12.15, 3.0, ef);
    walkTo(gx, gz, 45);
    assert.ok(
      py < 1.0 &&
        px >= GROUND_ESCAPE_ZONE.minX &&
        px <= GROUND_ESCAPE_ZONE.maxX &&
        pz >= GROUND_ESCAPE_ZONE.minZ &&
        pz <= GROUND_ESCAPE_ZONE.maxZ,
      `${sample.label}: failed to reach Ground Escape Zone (pos=${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})`
    );
  }
  console.log('PASS 3: Continuous physical Puzzle Room -> Safe Room -> Emergency Descent -> Ground Exit verified on ALL 4 wings & ALL 4 floors (F1–F4).');

  console.log('ALL RANDOMIZED MINI-GAME & DYNAMIC ROOM ASSIGNMENT TESTS PASSED!');
}

void runPuzzlesAndRandomRoomsTests();
