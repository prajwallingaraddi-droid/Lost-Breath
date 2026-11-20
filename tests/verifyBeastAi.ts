import assert from 'node:assert/strict';
import {
  BEAST_DIFFICULTY_PROFILES,
  getBeastDifficultyProfile,
} from '../src/data/beastConfig';
import { FLOOR_ELEVATIONS } from '../src/data/buildingLayout';
import { useGameStore } from '../src/store/useGameStore';
import {
  createBeastBrainState,
  stepBeastBrain,
} from '../src/three/beastAiEngine';
import {
  canBeastSeePlayer,
  findNavPath,
  getAllNavNodes,
  hasBeastLineOfSight,
  pickPatrolTargetNode,
} from '../src/three/beastNavigation';
import { getFloorFromElevation } from '../src/three/floorNavigation';
import { clearSoundEvents, emitSoundEvent } from '../src/three/soundBus';
import { DoorAnimState, FloorNumber, SpecialDoorKey } from '../src/types/game';

const CLOSED_DOORS: Record<SpecialDoorKey, DoorAnimState> = {
  mission: 'closed',
  puzzle: 'closed',
  exit: 'closed',
};

function runTests() {
  console.log('Running LAST EXIT Phase 3 AI Beast verification suite...');

  // Test 1: Beast patrols all four floors & avoids repetitive movement
  {
    const nodes = getAllNavNodes();
    assert.ok(nodes.length > 100, 'Expected full 4-floor nav graph with >100 nodes');

    const visitedFloors = new Set<FloorNumber>();
    const recent: string[] = [];
    for (let i = 0; i < 40; i++) {
      const currentFloor = ((i % 4) + 1) as FloorNumber;
      const pick = pickPatrolTargetNode({
        currentFloor,
        recentNodeIds: recent,
        doorStates: CLOSED_DOORS,
      });
      assert.ok(!recent.includes(pick.id), `Patrol repeated recent node ${pick.id}`);
      recent.push(pick.id);
      if (recent.length > 8) recent.shift();
      visitedFloors.add(pick.floor);
    }
    assert.deepEqual(
      Array.from(visitedFloors).sort(),
      [1, 2, 3, 4],
      'Beast patrol must cover all 4 floors'
    );
    console.log('PASS 1: Beast patrols all four floors without repetitive cycling.');
  }

  // Test 2: Beast uses actual stairs (no teleporting between floors)
  {
    const path = findNavPath({
      startX: -14.8,
      startY: FLOOR_ELEVATIONS[1],
      startZ: -14.8,
      goalX: -14.8,
      goalY: FLOOR_ELEVATIONS[4],
      goalZ: -14.8,
      doorStates: CLOSED_DOORS,
    });
    const stairNodes = path.filter((wp) => wp.kind.startsWith('stair-'));
    assert.ok(stairNodes.length >= 9, `Expected multi-flight stair waypoints, got ${stairNodes.length}`);
    for (let i = 1; i < path.length; i++) {
      const dy = Math.abs(path[i].y - path[i - 1].y);
      assert.ok(dy <= 2.3, `Illegal vertical teleport detected: dy=${dy}`);
    }
    console.log('PASS 2: Beast uses physical staircases between Floor 1 and Floor 4 without teleporting.');
  }

  // Test 3: Beast detects player in line of sight
  {
    clearSoundEvents();
    const brain = createBeastBrainState(1);
    brain.x = -14.8;
    brain.feetY = FLOOR_ELEVATIONS[1];
    brain.z = -14.8;
    brain.yaw = Math.PI / 2; // Facing East along North corridor (+X)

    const seen = canBeastSeePlayer({
      beastX: brain.x,
      beastY: brain.feetY,
      beastZ: brain.z,
      beastYaw: brain.yaw,
      playerX: -4.0,
      playerY: FLOOR_ELEVATIONS[1],
      playerZ: -14.8,
      visionRange: 18,
      visionFovDeg: 110,
      proximitySenseRadius: 2.5,
      doorStates: CLOSED_DOORS,
    });
    assert.equal(seen, true, 'Beast should see player down open corridor');

    // Step brain past aiUpdateInterval + detectConfirmSeconds
    let detected = false;
    let chased = false;
    for (let i = 0; i < 30; i++) {
      const evts = stepBeastBrain({
        state: brain,
        delta: 0.05,
        playerX: -4.0,
        playerFeetY: FLOOR_ELEVATIONS[1],
        playerZ: -14.8,
        controlMode: 'first-person',
        doorStates: CLOSED_DOORS,
        missionAlerted: false,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.early,
      });
      if (evts.includes('detect-warning')) detected = true;
      if (brain.mode === 'chase') chased = true;
    }
    assert.equal(detected, true, 'Beast should trigger detect state first');
    assert.equal(chased, true, 'Beast should transition from detect to chase');
    console.log('PASS 3: Beast detects player in FOV + LOS and enters Chase.');
  }

  // Test 4: Beast cannot see through walls or closed doors
  {
    const blockedByWall = hasBeastLineOfSight(
      0.0,
      FLOOR_ELEVATIONS[2],
      -14.8, // Corridor outside North apartments
      0.0,
      FLOOR_ELEVATIONS[2],
      -21.0, // Inside Apt 203 behind closed corridor wall/door
      CLOSED_DOORS
    );
    assert.equal(blockedByWall, false, 'Beast must NOT see through walls or closed doors');

    // Also verify Floor 2 Mission Room door blocks sight when closed, allows sight when open
    const missionClosed = hasBeastLineOfSight(
      14.8,
      FLOOR_ELEVATIONS[2],
      0,
      20.0,
      FLOOR_ELEVATIONS[2],
      0,
      CLOSED_DOORS
    );
    assert.equal(missionClosed, false, 'Closed Mission door must block sight');

    const missionOpen = hasBeastLineOfSight(
      14.8,
      FLOOR_ELEVATIONS[2],
      0,
      20.0,
      FLOOR_ELEVATIONS[2],
      0,
      { ...CLOSED_DOORS, mission: 'open' }
    );
    assert.equal(missionOpen, true, 'Open Mission door should allow sight');
    console.log('PASS 4: Solid walls and closed doors block Beast vision.');
  }

  // Test 5 & 6: Beast hears sprinting from greater distance than walking & investigates sounds
  {
    clearSoundEvents();
    const brainWalk = createBeastBrainState(1);
    brainWalk.x = -14.8;
    brainWalk.feetY = FLOOR_ELEVATIONS[1];
    brainWalk.z = -14.8;
    brainWalk.yaw = -Math.PI / 2; // Facing West (away from player at x=3.2)
    brainWalk.patrolPauseTimer = 5.0;

    emitSoundEvent({
      x: 3.2, // 18m away along corridor (outside 8.5m walk radius, inside 22m sprint radius)
      y: FLOOR_ELEVATIONS[1],
      z: -14.8,
      floor: 1,
      kind: 'footstep-walk',
      nowMs: 1000,
    });
    stepBeastBrain({
      state: brainWalk,
      delta: 0.05,
      playerX: 3.2,
      playerFeetY: FLOOR_ELEVATIONS[1],
      playerZ: -14.8,
      controlMode: 'first-person',
      doorStates: CLOSED_DOORS,
      missionAlerted: false,
      beastAlerted: false,
      profile: BEAST_DIFFICULTY_PROFILES.mission,
      nowMs: 1000,
    });
    // Step past aiUpdateInterval (0.14s)
    for (let i = 0; i < 4; i++) {
      stepBeastBrain({
        state: brainWalk,
        delta: 0.05,
        playerX: 3.2,
        playerFeetY: FLOOR_ELEVATIONS[1],
        playerZ: -14.8,
        controlMode: 'first-person',
        doorStates: CLOSED_DOORS,
        missionAlerted: false,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.mission,
        nowMs: 1050,
      });
    }
    assert.equal(brainWalk.mode, 'patrol', 'Beast should NOT hear walking footsteps at 18m');

    emitSoundEvent({
      x: 3.2,
      y: FLOOR_ELEVATIONS[1],
      z: -14.8,
      floor: 1,
      kind: 'footstep-sprint',
      nowMs: 1200,
    });
    let enteredInvestigate = false;
    for (let i = 0; i < 4; i++) {
      const evts = stepBeastBrain({
        state: brainWalk,
        delta: 0.05,
        playerX: 14.8, // Player turned corner out of LOS after sprinting
        playerFeetY: FLOOR_ELEVATIONS[1],
        playerZ: 0.0,
        controlMode: 'first-person',
        doorStates: CLOSED_DOORS,
        missionAlerted: false,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.mission,
        nowMs: 1250,
      });
      if (evts.includes('investigate-started') || (brainWalk.mode as string) === 'investigate') {
        enteredInvestigate = true;
      }
    }
    assert.equal(enteredInvestigate, true, 'Beast SHOULD hear sprinting at 18m and investigate');
    assert.equal(brainWalk.mode, 'investigate');
    assert.ok(brainWalk.waypoints.length > 0, 'Beast should compute nav path to sound source');
    console.log('PASS 5 & 6: Beast hears sprinting at longer range and investigates sound sources.');
  }

  // Test 7 & 8: Beast remembers last known player location & searches nearby rooms
  {
    clearSoundEvents();
    const brain = createBeastBrainState(1);
    brain.x = -14.8;
    brain.feetY = FLOOR_ELEVATIONS[1];
    brain.z = -14.8;
    brain.yaw = Math.PI / 2;
    brain.mode = 'chase';
    brain.chaseMemoryTimer = 0.2;
    brain.lastKnownPlayerPos = { x: 0, y: FLOOR_ELEVATIONS[1], z: -14.8, floor: 1 };

    // Player hides on Floor 2 behind walls (no LOS)
    let enteredSearch = false;
    for (let i = 0; i < 12; i++) {
      const evts = stepBeastBrain({
        state: brain,
        delta: 0.05,
        playerX: 0,
        playerFeetY: FLOOR_ELEVATIONS[2],
        playerZ: -21.0,
        controlMode: 'first-person',
        doorStates: CLOSED_DOORS,
        missionAlerted: false,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.early,
      });
      if (evts.includes('search-started') || (brain.mode as string) === 'search') {
        enteredSearch = true;
      }
    }
    assert.equal(enteredSearch, true, 'Beast should transition to SEARCH when chase memory expires');
    assert.ok(brain.lastKnownPlayerPos !== null, 'Beast remembers last known player position');
    assert.ok(brain.searchQueue.length >= 2, 'Beast populates nearby corridor/room nodes to search');
    console.log('PASS 7 & 8: Beast remembers last known player position and searches nearby rooms.');
  }

  // Test 9: Beast chases player across floors physically
  {
    clearSoundEvents();
    const brain = createBeastBrainState(3);
    brain.x = -14.8;
    brain.feetY = FLOOR_ELEVATIONS[3];
    brain.z = -14.8;
    brain.mode = 'chase';
    brain.chaseMemoryTimer = 30.0;
    brain.lastKnownPlayerPos = { x: -14.8, y: FLOOR_ELEVATIONS[1], z: -14.8, floor: 1 };

    // Simulate 16 seconds of multi-floor chase from Floor 3 down NW stairwell to Floor 1
    for (let i = 0; i < 320; i++) {
      stepBeastBrain({
        state: brain,
        delta: 0.05,
        playerX: -14.8,
        playerFeetY: FLOOR_ELEVATIONS[1],
        playerZ: -14.8,
        controlMode: 'first-person',
        doorStates: CLOSED_DOORS,
        missionAlerted: false,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.escape,
      });
      brain.chaseMemoryTimer = 30.0; // Keep pursuit active across floors for test
    }
    const endFloor = getFloorFromElevation(brain.feetY);
    assert.equal(endFloor, 1, `Expected Beast to descend stairs to Floor 1, ended on Floor ${endFloor}`);
    console.log('PASS 9: Beast physically chases player across floors via staircases.');
  }

  // Test 10 & 11: Beast catches player (even during active puzzle modal) & triggers Game Over
  {
    clearSoundEvents();
    useGameStore.getState().resetNewGame();
    useGameStore.setState({
      missionCompleted: true,
      hasPuzzleRoomKey: true,
      puzzleRoomEntered: true,
      puzzleModalOpen: true,
      puzzleTimerRunning: true,
    });

    const brain = createBeastBrainState(3);
    brain.x = -21.5;
    brain.feetY = FLOOR_ELEVATIONS[3];
    brain.z = 0.0;
    brain.mode = 'chase';

    const startEvents = stepBeastBrain({
      state: brain,
      delta: 0.05,
      playerX: -22.2,
      playerFeetY: FLOOR_ELEVATIONS[3],
      playerZ: 0.0,
      controlMode: 'first-person',
      doorStates: { ...CLOSED_DOORS, puzzle: 'open' },
      missionAlerted: true,
      beastAlerted: true,
      profile: BEAST_DIFFICULTY_PROFILES.puzzle,
    });

    assert.ok(startEvents.includes('capture-started'), 'Beast should start capture within catch radius');
    assert.equal(brain.mode, 'capture');
    useGameStore.getState().beginBeastCapture();
    assert.equal(useGameStore.getState().beastCapturing, true);
    assert.equal(useGameStore.getState().puzzleModalOpen, false, 'Puzzle modal closes on capture');

    let completed = false;
    for (let i = 0; i < 30; i++) {
      const evts = stepBeastBrain({
        state: brain,
        delta: 0.05,
        playerX: -22.2,
        playerFeetY: FLOOR_ELEVATIONS[3],
        playerZ: 0.0,
        controlMode: 'first-person',
        doorStates: { ...CLOSED_DOORS, puzzle: 'open' },
        missionAlerted: true,
        beastAlerted: true,
        profile: BEAST_DIFFICULTY_PROFILES.puzzle,
      });
      if (evts.includes('capture-completed')) {
        completed = true;
        useGameStore.getState().completeBeastCapture();
        break;
      }
    }
    assert.equal(completed, true, 'Capture animation should finish and trigger Game Over');
    assert.equal(useGameStore.getState().progression, 'PLAYER_CAUGHT', 'Game Over state must be PLAYER_CAUGHT');
    console.log('PASS 10 & 11: Beast captures player (including during puzzles) and triggers GAME OVER.');
  }

  // Test 12: Dynamic difficulty scales across stages fairly
  {
    const early = getBeastDifficultyProfile('EXPLORE', false, false, false, false);
    const mission = getBeastDifficultyProfile('MISSION_ACTIVE', false, false, false, true);
    const puzzle = getBeastDifficultyProfile('PUZZLE_ACTIVE', true, false, true, true);
    const escape = getBeastDifficultyProfile('EXIT_UNLOCKED', true, true, true, true);

    assert.ok(early.chaseSpeed < mission.chaseSpeed);
    assert.ok(mission.chaseSpeed < puzzle.chaseSpeed);
    assert.ok(puzzle.chaseSpeed < escape.chaseSpeed);
    assert.ok(escape.chaseSpeed < 8.6, 'Beast must not be unfairly faster than player sprint (8.6 m/s)');
    assert.ok(early.visionRange < escape.visionRange);
    assert.ok(early.hearingMultiplier < escape.hearingMultiplier);
    console.log('PASS 12: AI difficulty scales cleanly across Early -> Mission -> Puzzle -> Escape.');
  }

  console.log('ALL 12 PHASE 3 AI BEAST TESTS PASSED!');
}

runTests();
