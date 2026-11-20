import assert from 'node:assert/strict';
import {
  BEAST_COUNT,
  BEAST_DIFFICULTY_PROFILES,
  BEAST_ROSTER,
  getBeastDifficultyStage,
  getKeyAlarmSpeedMultiplier,
  KEY_ALARM_GRACE_SECONDS,
  KEY_ALARM_INITIAL_SPEED_FACTOR,
  KEY_ALARM_RAMP_SECONDS,
} from '../src/data/beastConfig';
import {
  assignSpecialRooms,
  EMERGENCY_DESCENT_STAIRCASES,
  FLOOR_ELEVATIONS,
  getMissionRoomNumber,
  GROUND_ESCAPE_ZONE,
  SAFE_ROOM_BOUNDS,
  SPECIAL_ROOMS_CONFIG,
} from '../src/data/buildingLayout';
import { HIDING_SPOTS } from '../src/data/hidingSpots';
import {
  PUZZLE_CATEGORY_ORDER,
  PUZZLE_CATEGORY_SPECS,
  PUZZLE_MAX_ATTEMPTS,
  PUZZLE_TIME_LIMIT_SECONDS,
  validatePuzzleSessionBundle,
} from '../src/data/puzzleConfig';
import {
  createBeastBrainStateForRoster,
  SiblingBeastPosition,
  stepBeastBrain,
} from '../src/three/beastAiEngine';
import { canBeastSeePlayer, findNavPath } from '../src/three/beastNavigation';
import { resolvePlayerMovement } from '../src/three/collision';
import {
  getFloorFromElevation,
  resolveSurfaceElevation,
  stairLocalToWorld,
} from '../src/three/floorNavigation';
import { clearSoundEvents } from '../src/three/soundBus';
import * as soundEffects from '../src/three/soundEffects';
import { BeastId, DoorAnimState, FloorNumber, SpecialDoorKey } from '../src/types/game';

const CLOSED_DOORS: Record<SpecialDoorKey, DoorAnimState> = {
  mission: 'closed',
  puzzle: 'closed',
  exit: 'closed',
};

async function runFourBeastsVerification() {
  // Mock window.localStorage for store import in Node
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

  console.log('Running LAST EXIT Four Beasts, Key Alarm, Hiding, Puzzle Protection & Safe Room Descent verification...');

  // ---------------------------------------------------------------------------
  // 1. Exactly 4 Beasts distributed across all 4 floors with independent routes
  // ---------------------------------------------------------------------------
  {
    assert.equal(BEAST_COUNT, 4, 'Must have exactly 4 Beasts');
    assert.equal(BEAST_ROSTER.length, 4, 'BEAST_ROSTER must define exactly 4 Hunters');

    const initialFloors = BEAST_ROSTER.map((r) => r.initialFloor).sort();
    assert.deepEqual(initialFloors, [1, 2, 3, 4], '4 Beasts must start distributed across Floors 1, 2, 3, and 4');

    const brains = ([0, 1, 2, 3] as BeastId[]).map((id) => createBeastBrainStateForRoster(id));
    for (let i = 0; i < 4; i++) {
      assert.equal(brains[i].id, i);
      assert.equal(getFloorFromElevation(brains[i].feetY), BEAST_ROSTER[i].initialFloor);
    }

    // Step all 4 Hunters for 6 seconds in patrol mode with reserved node tracking
    for (let step = 0; step < 120; step++) {
      const siblings: SiblingBeastPosition[] = brains.map((b) => ({
        id: b.id,
        x: b.x,
        feetY: b.feetY,
        z: b.z,
      }));
      const reserved = brains.map((b) => b.assignedTargetNodeId).filter((v): v is string => !!v);
      for (const b of brains) {
        stepBeastBrain({
          state: b,
          delta: 0.05,
          playerX: -22.3,
          playerFeetY: 0,
          playerZ: -15.8,
          controlMode: 'first-person',
          doorStates: CLOSED_DOORS,
          beastAlerted: false,
          keyAlarmTriggered: false,
          otherBeasts: siblings,
          reservedPatrolNodeIds: reserved,
          profile: BEAST_DIFFICULTY_PROFILES.early,
          nowMs: 1000 + step * 50,
        });
      }
    }

    // Verify all 4 Beasts moved independently and did not collapse onto identical coordinates
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const sameFloor = getFloorFromElevation(brains[i].feetY) === getFloorFromElevation(brains[j].feetY);
        if (sameFloor) {
          const dist = Math.hypot(brains[i].x - brains[j].x, brains[i].z - brains[j].z);
          assert.ok(dist >= 0.9, `Hunters ${i} and ${j} overlapped on same floor (dist=${dist.toFixed(2)})`);
        }
      }
    }
    console.log('PASS 1: Exactly 4 Warrior Hunters spawn across Floors 1–4 and patrol independently without overlap.');
  }

  // ---------------------------------------------------------------------------
  // 2. Mission Room Entry & False Key Must NOT Trigger Alarm or Alert Beasts
  // ---------------------------------------------------------------------------
  {
    clearSoundEvents();
    useGameStore.getState().startGameFromMenu();
    // Pin Apt 208 (F2 East) & Apt 318 (F3 West) for deterministic Four-Beasts coordinate tests
    assignSpecialRooms('f2-208', 'f3-318');

    // Open and enter Mission Room
    useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.missionDoorId);
    useGameStore.getState().markSpecialDoorOpen('mission');
    useGameStore.getState().enterMissionRoom();

    const afterEnter = useGameStore.getState();
    assert.equal(afterEnter.missionRoomEntered, true);
    assert.equal(afterEnter.keyPickupAlarmTriggered, false, 'Entering Mission Room must NOT trigger key alarm');
    assert.equal(afterEnter.emergencyAlarmActive, false, 'Entering Mission Room must NOT activate siren/lights');
    assert.equal(afterEnter.securityBreachBannerVisible, false, 'Entering Mission Room must NOT show breach banner');
    assert.equal(
      getBeastDifficultyStage(
        afterEnter.progression,
        afterEnter.missionCompleted,
        afterEnter.allPuzzlesCompleted,
        afterEnter.puzzleRoomEntered,
        afterEnter.keyPickupAlarmTriggered
      ),
      'early',
      'Entering Mission Room must NOT escalate Beast difficulty stage'
    );

    // Unlock and collect FALSE Key (Cell B) -> still NO alarm!
    const roomCode = getMissionRoomNumber();
    const unlockFalse = useGameStore.getState().submitKeyCellPassword('cell-b', roomCode);
    assert.equal(unlockFalse.granted, true);
    const collectFalse = useGameStore.getState().collectKeyFromCell('cell-b');
    assert.equal(collectFalse.collected, true);
    assert.equal(collectFalse.variant, 'false');

    const afterFalse = useGameStore.getState();
    assert.equal(afterFalse.hasFalsePuzzleKey, true);
    assert.equal(afterFalse.hasPuzzleRoomKey, false);
    assert.equal(afterFalse.keyPickupAlarmTriggered, false, 'False key MUST NOT trigger emergency alarm');
    assert.equal(afterFalse.emergencyAlarmActive, false, 'False key MUST NOT activate siren/lights');

    // Step all 4 Hunters with missionAlerted=true, keyAlarmTriggered=false -> none should react or converge
    const brains = ([0, 1, 2, 3] as BeastId[]).map((id) => createBeastBrainStateForRoster(id));
    for (const b of brains) {
      const evts = stepBeastBrain({
        state: b,
        delta: 0.05,
        playerX: 20.0,
        playerFeetY: FLOOR_ELEVATIONS[2],
        playerZ: 0.0,
        controlMode: 'first-person',
        doorStates: { ...CLOSED_DOORS, mission: 'open' },
        missionAlerted: true,
        keyAlarmTriggered: false,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.early,
      });
      assert.ok(!evts.includes('alarm-reaction'), 'Beasts must NOT react when player enters Mission Room');
      assert.equal(b.mode, 'patrol', 'Beasts must remain on normal patrol on Mission Room entry');
    }
    console.log('PASS 2: Mission Room entry, keypad use, and False Key collection stay completely silent (no alarm/convergence).');
  }

  // ---------------------------------------------------------------------------
  // 3. Genuine Puzzle Room Key Pickup Triggers Alarm EXACTLY ONCE & Converges All 4 Hunters
  // ---------------------------------------------------------------------------
  {
    const roomCode = getMissionRoomNumber();
    const unlockReal = useGameStore.getState().submitKeyCellPassword('cell-a', roomCode);
    assert.equal(unlockReal.granted, true);
    const collectReal = useGameStore.getState().collectKeyFromCell('cell-a');
    assert.equal(collectReal.collected, true);
    assert.equal(collectReal.variant, 'real');
    assert.equal(collectReal.message, 'SECURITY BREACH — ALL HUNTERS ACTIVATED');

    const afterReal = useGameStore.getState();
    assert.equal(afterReal.hasPuzzleRoomKey, true);
    assert.equal(afterReal.keyPickupAlarmTriggered, true);
    assert.equal(afterReal.emergencyAlarmActive, true);
    assert.equal(afterReal.securityBreachBannerVisible, true);
    assert.equal(
      afterReal.doorFeedback?.text,
      'SECURITY BREACH — ALL HUNTERS ACTIVATED',
      'Exact Security Breach HUD message must be displayed'
    );

    // Revisiting Mission Room or re-collecting cell-a must NEVER re-trigger alarm
    useGameStore.getState().dismissSecurityBreachBanner();
    useGameStore.getState().enterMissionRoom();
    const secondCollect = useGameStore.getState().collectKeyFromCell('cell-a');
    assert.equal(secondCollect.collected, false, 'Key cannot be collected a second time');
    assert.equal(
      useGameStore.getState().securityBreachBannerVisible,
      false,
      'Banner must not re-open on revisit'
    );

    // Notify all 4 Hunters simultaneously -> all 4 emit alarm-reaction and navigate physically toward Mission Room (Floor 2)
    const brains = ([0, 1, 2, 3] as BeastId[]).map((id) => createBeastBrainStateForRoster(id));
    const reacted = [false, false, false, false];
    const openMissionDoors: Record<SpecialDoorKey, DoorAnimState> = { ...CLOSED_DOORS, mission: 'open' };

    for (let step = 0; step < 360; step++) {
      const siblings: SiblingBeastPosition[] = brains.map((b) => ({
        id: b.id,
        x: b.x,
        feetY: b.feetY,
        z: b.z,
      }));
      for (let i = 0; i < 4; i++) {
        const prevY = brains[i].feetY;
        const evts = stepBeastBrain({
          state: brains[i],
          delta: 0.05,
          playerX: -14.8, // Player already escaped Mission Room to West corridor
          playerFeetY: FLOOR_ELEVATIONS[1],
          playerZ: -14.8,
          controlMode: 'first-person',
          doorStates: openMissionDoors,
          keyAlarmTriggered: true,
          beastAlerted: false,
          otherBeasts: siblings,
          profile: BEAST_DIFFICULTY_PROFILES.mission,
          nowMs: 5000 + step * 50,
        });
        if (evts.includes('alarm-reaction')) reacted[i] = true;
        // Verify zero teleportation on every step
        assert.ok(
          Math.abs(brains[i].feetY - prevY) < 0.6,
          `Hunter ${i} teleported vertically during alarm convergence!`
        );
      }
    }

    assert.deepEqual(reacted, [true, true, true, true], 'All 4 Hunters must receive alarm reaction simultaneously');
    // At least Hunters starting on Floors 1, 2, 3 should already reach Floor 2 near Apt 208 within 18s
    const onFloor2Count = brains.filter((b) => getFloorFromElevation(b.feetY) === 2).length;
    assert.ok(
      onFloor2Count >= 3,
      `Expected at least 3 Hunters converged onto Floor 2 within 18s, got ${onFloor2Count}`
    );
    console.log('PASS 3: Genuine key pickup triggers alarm ONCE, shows exact banner, and physically converges all 4 Hunters on Mission Room.');
  }

  // ---------------------------------------------------------------------------
  // 4. Hiding System Across All 4 Floors (20 spots, concealment, witnessed flush)
  // ---------------------------------------------------------------------------
  {
    assert.equal(HIDING_SPOTS.length, 20, 'Expected 20 hiding spots across the 4-floor building');
    const perFloor: Record<FloorNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const spot of HIDING_SPOTS) {
      perFloor[spot.floor]++;
      // Verify exitPos is valid walkable corridor space (collision resolver does not snap it away)
      const resolved = resolvePlayerMovement({
        x: spot.exitPos[0],
        z: spot.exitPos[2],
        feetY: FLOOR_ELEVATIONS[spot.floor],
        radius: 0.34,
        doorStates: CLOSED_DOORS,
        isBeast: false,
        puzzleRoomProtected: false,
      });
      const drift = Math.hypot(resolved.x - spot.exitPos[0], resolved.z - spot.exitPos[2]);
      assert.ok(
        drift < 0.25,
        `Hiding spot ${spot.id} exitPos obstructed by wall/furniture (drift=${drift.toFixed(2)})`
      );
    }
    assert.deepEqual(perFloor, { 1: 5, 2: 5, 3: 5, 4: 5 }, 'Every floor must have 5 believable hiding places');

    // Verify normal vision CANNOT see a hidden player even right in front of the hiding spot
    const testSpot = HIDING_SPOTS[0]; // Floor 1 Wardrobe
    const seenWhileHidden = canBeastSeePlayer({
      beastX: testSpot.exitPos[0],
      beastY: FLOOR_ELEVATIONS[1],
      beastZ: testSpot.exitPos[2],
      beastYaw: 0,
      playerX: testSpot.hidePos[0],
      playerY: FLOOR_ELEVATIONS[1],
      playerZ: testSpot.hidePos[2],
      visionRange: 25,
      visionFovDeg: 140,
      proximitySenseRadius: 4.0,
      doorStates: CLOSED_DOORS,
      playerHidden: true,
    });
    assert.equal(seenWhileHidden, false, 'Beast must NOT detect a hidden player via normal sight or proximity');

    // Unwitnessed Beast walking right past hiding spot must NOT detect or capture hidden player
    const unwitnessed = createBeastBrainStateForRoster(3);
    unwitnessed.x = testSpot.exitPos[0];
    unwitnessed.feetY = FLOOR_ELEVATIONS[1];
    unwitnessed.z = testSpot.exitPos[2];
    for (let i = 0; i < 20; i++) {
      const evts = stepBeastBrain({
        state: unwitnessed,
        delta: 0.05,
        playerX: testSpot.hidePos[0],
        playerFeetY: FLOOR_ELEVATIONS[1],
        playerZ: testSpot.hidePos[2],
        controlMode: 'first-person',
        doorStates: CLOSED_DOORS,
        beastAlerted: false,
        playerHidden: true,
        playerHiddenSpotId: testSpot.id,
        witnessedHidingSpotId: null,
        profile: BEAST_DIFFICULTY_PROFILES.mission,
      });
      assert.ok(!evts.includes('capture-started'), 'Unwitnessed Beast must NOT capture hidden player');
      assert.ok(!evts.includes('detect-warning'), 'Unwitnessed Beast must NOT detect hidden player');
    }

    // Witnessed Beast investigates the exact hiding spot and flushes/captures player on reaching exitPos
    const witnessed = createBeastBrainStateForRoster(3);
    witnessed.x = testSpot.exitPos[0] + 0.5;
    witnessed.feetY = FLOOR_ELEVATIONS[1];
    witnessed.z = testSpot.exitPos[2];
    let flushedCapture = false;
    for (let i = 0; i < 40; i++) {
      const evts = stepBeastBrain({
        state: witnessed,
        delta: 0.05,
        playerX: testSpot.hidePos[0],
        playerFeetY: FLOOR_ELEVATIONS[1],
        playerZ: testSpot.hidePos[2],
        controlMode: 'first-person',
        doorStates: CLOSED_DOORS,
        beastAlerted: false,
        playerHidden: true,
        playerHiddenSpotId: testSpot.id,
        witnessedHidingSpotId: testSpot.id,
        profile: BEAST_DIFFICULTY_PROFILES.mission,
      });
      if (evts.includes('capture-started')) {
        flushedCapture = true;
        break;
      }
    }
    assert.equal(flushedCapture, true, 'Witnessed Beast must investigate hiding spot and flush/capture player if caught inside');

    // Verify store hiding enter/exit cycle
    useGameStore.getState().enterHidingSpot(testSpot.id, []);
    assert.equal(useGameStore.getState().playerHiddenSpotId, testSpot.id);
    useGameStore.getState().exitHidingSpot();
    assert.equal(useGameStore.getState().playerHiddenSpotId, null);
    console.log('PASS 4: All 20 hiding spots validated; unwitnessed concealment & witnessed flushing both work.');
  }

  // ---------------------------------------------------------------------------
  // 5. Puzzle Room Protection Barrier (Beasts gather outside, NEVER enter/attack inside)
  // ---------------------------------------------------------------------------
  {
    const openPuzzleDoors: Record<SpecialDoorKey, DoorAnimState> = {
      mission: 'open',
      puzzle: 'open',
      exit: 'closed',
    };

    // Enter Puzzle Room -> activates protection and alerts all 4 Hunters
    useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.puzzleDoorId);
    useGameStore.getState().markSpecialDoorOpen('puzzle');
    useGameStore.getState().enterPuzzleRoom();

    const pState = useGameStore.getState();
    assert.equal(pState.puzzleRoomEntered, true);
    assert.equal(pState.puzzleProtectionActive, true, 'Puzzle Room protection must activate on entry');
    assert.equal(pState.puzzleTimerExpired, false);
    assert.equal(pState.beastAlerted, true);

    // Pathfinding from corridor into Apt 318 must be BLOCKED when puzzleRoomProtected=true
    const blockedPath = findNavPath({
      startX: -14.8,
      startY: FLOOR_ELEVATIONS[3],
      startZ: 0.0,
      goalX: -22.0,
      goalY: FLOOR_ELEVATIONS[3],
      goalZ: 0.0,
      doorStates: openPuzzleDoors,
      puzzleRoomProtected: true,
    });
    assert.ok(
      blockedPath.every((wp) => wp.x > -16.6),
      'Pathfinding must NOT produce any waypoint inside Apt 318 while protection is active'
    );

    // Collision resolver must physically block a Beast from crossing X = -16.6 into Apt 318
    const blockedMove = resolvePlayerMovement({
      x: -18.5,
      z: 0.0,
      feetY: FLOOR_ELEVATIONS[3],
      radius: 0.45,
      doorStates: openPuzzleDoors,
      isBeast: true,
      puzzleRoomProtected: true,
    });
    assert.ok(
      blockedMove.x >= -16.5,
      `Beast crossed Puzzle Room security barrier! x=${blockedMove.x.toFixed(2)}`
    );

    // Place all 4 Hunters right outside Apt 318 while player stands near the doorway inside
    const siegeBrains = ([0, 1, 2, 3] as BeastId[]).map((id) => createBeastBrainStateForRoster(id));
    siegeBrains[0].x = -14.9;
    siegeBrains[0].feetY = FLOOR_ELEVATIONS[3];
    siegeBrains[0].z = 0.0;
    siegeBrains[1].x = -14.9;
    siegeBrains[1].feetY = FLOOR_ELEVATIONS[3];
    siegeBrains[1].z = -2.8;
    siegeBrains[2].x = -14.9;
    siegeBrains[2].feetY = FLOOR_ELEVATIONS[3];
    siegeBrains[2].z = 2.8;
    siegeBrains[3].x = -14.9;
    siegeBrains[3].feetY = FLOOR_ELEVATIONS[3];
    siegeBrains[3].z = -5.5;

    let sawBarrierPressure = false;
    for (let step = 0; step < 120; step++) {
      const siblings: SiblingBeastPosition[] = siegeBrains.map((b) => ({
        id: b.id,
        x: b.x,
        feetY: b.feetY,
        z: b.z,
      }));
      for (const b of siegeBrains) {
        const evts = stepBeastBrain({
          state: b,
          delta: 0.05,
          playerX: -18.0, // Inside Apt 318 near doorway
          playerFeetY: FLOOR_ELEVATIONS[3],
          playerZ: 0.0,
          controlMode: 'first-person',
          doorStates: openPuzzleDoors,
          keyAlarmTriggered: true,
          beastAlerted: true,
          puzzleRoomProtected: true,
          puzzleTimerExpired: false,
          otherBeasts: siblings,
          profile: BEAST_DIFFICULTY_PROFILES.puzzle,
          nowMs: 10000 + step * 50,
        });
        assert.ok(b.x >= -16.6, `Hunter ${b.id} breached protected Puzzle Room! x=${b.x.toFixed(2)}`);
        assert.ok(!evts.includes('capture-started'), `Hunter ${b.id} captured player through Puzzle Room protection!`);
        if (evts.includes('barrier-strike') || evts.includes('siege-shout')) {
          sawBarrierPressure = true;
        }
      }
    }
    assert.equal(sawBarrierPressure, true, 'Hunters waiting outside must growl/shout/attack the protected entrance');
    console.log('PASS 5: All 4 Hunters besiege outside Apt 318 and are physically blocked from entering or attacking while protected.');

    // ---------------------------------------------------------------------------
    // 6. Timer Expiration Removes Protection -> Hunters Breach Apt 318 & Capture Player
    // ---------------------------------------------------------------------------
    useGameStore.setState({ puzzleTimerSeconds: 1, puzzleProtectionActive: true, puzzleTimerExpired: false });
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleProtectionActive, false, 'Protection MUST drop on timer expiration');
    assert.equal(useGameStore.getState().puzzleTimerExpired, true);

    let breachedInside = false;
    let capturedAfterExpiry = false;
    for (let step = 0; step < 120; step++) {
      const siblings: SiblingBeastPosition[] = siegeBrains.map((b) => ({
        id: b.id,
        x: b.x,
        feetY: b.feetY,
        z: b.z,
      }));
      for (const b of siegeBrains) {
        const evts = stepBeastBrain({
          state: b,
          delta: 0.05,
          playerX: -20.5,
          playerFeetY: FLOOR_ELEVATIONS[3],
          playerZ: 0.0,
          controlMode: 'first-person',
          doorStates: openPuzzleDoors,
          keyAlarmTriggered: true,
          beastAlerted: true,
          puzzleRoomProtected: false,
          puzzleTimerExpired: true,
          otherBeasts: siblings,
          profile: BEAST_DIFFICULTY_PROFILES.puzzle,
          nowMs: 20000 + step * 50,
        });
        if (b.x < -17.5) breachedInside = true;
        if (evts.includes('capture-started')) capturedAfterExpiry = true;
      }
      if (breachedInside && capturedAfterExpiry) break;
    }
    assert.equal(breachedInside, true, 'Hunters must breach inside Apt 318 once timer expires');
    assert.equal(capturedAfterExpiry, true, 'Hunters must capture player inside Apt 318 after timer expires');
    console.log('PASS 6: Timer expiration drops Puzzle Room protection and allows Hunters to breach and capture the player.');
  }

  // ---------------------------------------------------------------------------
  // 7. Solving Card Challenge Unlocks Separate Safe Room & Physical 2-Level Emergency Descent
  // ---------------------------------------------------------------------------
  {
    useGameStore.getState().recoverFromBeastCatch();
    useGameStore.getState().selectPuzzleCategory('math');
    useGameStore.getState().startPuzzleChallenge();
    useGameStore.getState().completePuzzleChallenge();

    const solvedState = useGameStore.getState();
    assert.equal(solvedState.allPuzzlesCompleted, true);
    assert.equal(solvedState.safeRoomUnlocked, true, 'Safe Room must unlock immediately upon completing challenge');
    assert.equal(solvedState.doorStates.exit, 'opening', 'Safe Room door must begin opening immediately');
    assert.equal(solvedState.puzzleProtectionActive, true, 'Beasts stay blocked outside during Safe Room escape');
    assert.equal(
      getCurrentObjective({
        progression: solvedState.progression,
        hasPuzzleRoomKey: solvedState.hasPuzzleRoomKey,
        puzzleRoomEntered: solvedState.puzzleRoomEntered,
        allPuzzlesCompleted: solvedState.allPuzzlesCompleted,
        finalExitUnlocked: solvedState.finalExitUnlocked,
        safeRoomUnlocked: solvedState.safeRoomUnlocked,
        puzzleTimerExpired: solvedState.puzzleTimerExpired,
      }),
      'REACH THE SAFE ROOM AND ESCAPE'
    );

    // Verify Beasts are blocked from entering Safe Room even with exit door open
    const allOpenDoors: Record<SpecialDoorKey, DoorAnimState> = {
      mission: 'open',
      puzzle: 'open',
      exit: 'open',
    };
    const beastSafeRoomBlock = resolvePlayerMovement({
      x: -30.0,
      z: 0.0,
      feetY: FLOOR_ELEVATIONS[3],
      radius: 0.45,
      doorStates: allOpenDoors,
      isBeast: true,
      puzzleRoomProtected: false,
    });
    assert.ok(
      beastSafeRoomBlock.x >= -27.7,
      `Beast entered Safe Room! x=${beastSafeRoomBlock.x.toFixed(2)}`
    );

    // Walk player physically from Apt 318 -> Safe Room -> Emergency Descent Tower F3 -> F2 -> F1 -> Ground Exit (ZERO TELEPORT)
    let px = -26.5;
    let py = FLOOR_ELEVATIONS[3]; // 9.0m
    let pz = 0.0;

    const walkStep = (tx: number, tz: number, steps = 25) => {
      for (let i = 0; i < steps; i++) {
        const dx = tx - px;
        const dz = tz - pz;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.08) break;
        const stepLen = Math.min(dist, 0.35);
        const nx = px + (dx / dist) * stepLen;
        const nz = pz + (dz / dist) * stepLen;
        const res = resolvePlayerMovement({
          x: nx,
          z: nz,
          feetY: py,
          radius: 0.34,
          doorStates: allOpenDoors,
          isBeast: false,
          puzzleRoomProtected: true,
        });
        const nextY = resolveSurfaceElevation(res.x, res.z, py);
        assert.ok(
          Math.abs(nextY - py) <= 0.45,
          `Discontinuous vertical jump during descent: ${py.toFixed(2)} -> ${nextY.toFixed(2)} at (${res.x.toFixed(2)}, ${res.z.toFixed(2)})`
        );
        px = res.x;
        pz = res.z;
        py = nextY;
      }
    };

    // 1. Walk through open Safe Room door into Safe Room interior
    walkStep((SAFE_ROOM_BOUNDS.minX + SAFE_ROOM_BOUNDS.maxX) / 2, 0.0, 25);
    assert.ok(px <= SAFE_ROOM_BOUNDS.maxX && px >= SAFE_ROOM_BOUNDS.minX, `Player did not enter Safe Room (x=${px.toFixed(2)})`);
    assert.equal(getFloorFromElevation(py), 3);

    // 2. Walk West into Floor 3 Escape Tower upper landing & down stair-escape-2-3 to Floor 2
    const stair23 = EMERGENCY_DESCENT_STAIRCASES.find((s) => s.id === 'stair-escape-2-3')!;
    const [top23X, top23Z] = stairLocalToWorld(0.94, 2.6, stair23);
    const [mid23AX, mid23AZ] = stairLocalToWorld(0.94, -1.75, stair23);
    const [mid23BX, mid23BZ] = stairLocalToWorld(-0.94, -1.75, stair23);
    const [bot23X, bot23Z] = stairLocalToWorld(-0.94, 2.6, stair23);
    walkStep(top23X, top23Z, 30);
    walkStep(mid23AX, mid23AZ, 35);
    walkStep(mid23BX, mid23BZ, 15);
    walkStep(bot23X, bot23Z, 35);
    assert.equal(getFloorFromElevation(py), 2, `Expected Floor 2 after first descent stairwell, got Floor ${getFloorFromElevation(py)} (y=${py.toFixed(2)})`);

    // 3. Cross Floor 2 tower platform to stair-escape-1-2 upper flight & descend to Floor 1
    const stair12 = EMERGENCY_DESCENT_STAIRCASES.find((s) => s.id === 'stair-escape-1-2')!;
    const [top12X, top12Z] = stairLocalToWorld(0.94, 2.6, stair12);
    const [mid12AX, mid12AZ] = stairLocalToWorld(0.94, -1.75, stair12);
    const [mid12BX, mid12BZ] = stairLocalToWorld(-0.94, -1.75, stair12);
    const [bot12X, bot12Z] = stairLocalToWorld(-0.94, 2.6, stair12);
    walkStep(top12X, top12Z, 20);
    walkStep(mid12AX, mid12AZ, 35);
    walkStep(mid12BX, mid12BZ, 15);
    walkStep(bot12X, bot12Z, 35);
    assert.equal(getFloorFromElevation(py), 1, `Expected Floor 1 after second descent stairwell, got Floor ${getFloorFromElevation(py)} (y=${py.toFixed(2)})`);

    // 4. Walk into Ground Floor Extraction Zone (GROUND_ESCAPE_ZONE)
    walkStep(
      (GROUND_ESCAPE_ZONE.minX + GROUND_ESCAPE_ZONE.maxX) / 2,
      (GROUND_ESCAPE_ZONE.minZ + GROUND_ESCAPE_ZONE.maxZ) / 2,
      30
    );
    assert.ok(
      px >= GROUND_ESCAPE_ZONE.minX &&
        px <= GROUND_ESCAPE_ZONE.maxX &&
        pz >= GROUND_ESCAPE_ZONE.minZ &&
        pz <= GROUND_ESCAPE_ZONE.maxZ &&
        py < 1.2,
      `Player failed to physically reach Ground Floor Exit Zone (pos=${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})`
    );

    // Trigger ground floor escape victory
    useGameStore.getState().triggerGroundFloorEscape();
    assert.equal(useGameStore.getState().escaped, true);
    assert.equal(useGameStore.getState().progression, 'ESCAPED');
    console.log('PASS 7: Safe Room unlocks on puzzle solve & continuous physical Floor 3 -> Floor 2 -> Floor 1 Ground Exit descent succeeds without teleporting.');
  }

  // ---------------------------------------------------------------------------
  // 8. Verify New Audio Exports (Alarm Siren, Beast Reaction, Barrier Strike, Hide, Safe Room, Exit)
  // ---------------------------------------------------------------------------
  {
    const newAudioFns = [
      'startEmergencyAlarmSiren',
      'stopEmergencyAlarmSiren',
      'playBeastAlarmReactionSound',
      'playBarrierStrikeSound',
      'playHideTransitionSound',
      'playSafeRoomUnlockSound',
      'playEmergencyExitSound',
    ] as const;

    for (const fn of newAudioFns) {
      assert.equal(typeof soundEffects[fn], 'function', `Missing required audio export ${fn}`);
    }
    soundEffects.startEmergencyAlarmSiren(true);
    soundEffects.stopEmergencyAlarmSiren();
    soundEffects.playBeastAlarmReactionSound({ x: 10, y: 4.5, z: 0 }, 0, true);
    soundEffects.playBarrierStrikeSound({ x: -16.6, y: 9.0, z: 0 }, true);
    soundEffects.playHideTransitionSound(true, true);
    soundEffects.playHideTransitionSound(false, true);
    soundEffects.playSafeRoomUnlockSound(true);
    soundEffects.playEmergencyExitSound(true);
    console.log('PASS 8: All new emergency alarm, barrier strike, hiding, Safe Room, and exit audio channels verified.');
  }

  // ---------------------------------------------------------------------------
  // 9. Four Randomized Mini-Game Categories & Per-Stage 3-Attempt Progression
  // ---------------------------------------------------------------------------
  {
    assert.deepEqual(PUZZLE_CATEGORY_ORDER, ['math', 'cards', 'memory', 'mechanical']);
    for (const cat of PUZZLE_CATEGORY_ORDER) {
      const spec = PUZZLE_CATEGORY_SPECS[cat];
      assert.ok(spec.rules.length >= 3, `${cat} must display clear rules`);
      assert.ok(spec.example.length > 10, `${cat} must display an example`);
    }

    // Verify per-stage attempt handling & stage advancement in store (wrong answer does NOT restart whole puzzle)
    useGameStore.getState().startGameFromMenu();
    const sessionCheck = validatePuzzleSessionBundle(useGameStore.getState().puzzleSession);
    assert.equal(sessionCheck.valid, true, `Generated puzzle bundle invalid: ${sessionCheck.errors.join('; ')}`);

    useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.missionDoorId);
    useGameStore.getState().markSpecialDoorOpen('mission');
    useGameStore.getState().enterMissionRoom();
    const rc = getMissionRoomNumber();
    useGameStore.getState().submitKeyCellPassword('cell-a', rc);
    useGameStore.getState().collectKeyFromCell('cell-a');
    useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.puzzleDoorId);
    useGameStore.getState().markSpecialDoorOpen('puzzle');
    useGameStore.getState().enterPuzzleRoom();
    useGameStore.getState().selectPuzzleCategory('mechanical');
    useGameStore.getState().startPuzzleChallenge();
    assert.equal(useGameStore.getState().puzzleStageIndex, 0);
    assert.equal(useGameStore.getState().puzzleTimerSeconds, PUZZLE_TIME_LIMIT_SECONDS);

    // Advance to stage 2 (index 1) -> attempts reset to 0
    useGameStore.getState().recordWrongAttempt();
    assert.equal(useGameStore.getState().puzzleAttempts, 1);
    useGameStore.getState().advancePuzzleStage();
    assert.equal(useGameStore.getState().puzzleStageIndex, 1);
    assert.equal(useGameStore.getState().puzzleAttempts, 0);

    // Wrong answer on stage 2 does NOT drop back to stage 1
    useGameStore.getState().recordWrongAttempt();
    assert.equal(useGameStore.getState().puzzleStageIndex, 1, 'Wrong attempt must NOT reset earlier completed stages');
    assert.equal(useGameStore.getState().puzzleStage, 'active');

    // Exhausting all 3 attempts on stage 2 enters failed state, retry keeps stage 2 (index 1)
    useGameStore.getState().recordWrongAttempt();
    useGameStore.getState().recordWrongAttempt();
    assert.equal(useGameStore.getState().puzzleAttempts, PUZZLE_MAX_ATTEMPTS);
    assert.equal(useGameStore.getState().puzzleStage, 'failed');
    useGameStore.getState().retryPuzzleChallenge();
    assert.equal(useGameStore.getState().puzzleStageIndex, 1, 'Retry stage must stay on current stage rather than restarting from stage 0');
    assert.equal(useGameStore.getState().puzzleAttempts, 0);
    console.log('PASS 9: All 4 randomized mini-game categories, procedural validation, and per-stage 3-attempt rules verified.');
  }

  // ---------------------------------------------------------------------------
  // 10. Beast Approach Speed & 25-Second Fair Escape Window After Key Pickup
  // ---------------------------------------------------------------------------
  {
    assert.equal(KEY_ALARM_GRACE_SECONDS, 25);
    assert.equal(KEY_ALARM_RAMP_SECONDS, 15);
    assert.equal(KEY_ALARM_INITIAL_SPEED_FACTOR, 0.65);

    // Speed multiplier curve: 0.65 during 0..25s, smooth linear ramp 25..40s, 1.0 at >=40s
    assert.equal(getKeyAlarmSpeedMultiplier(0), 0.65);
    assert.equal(getKeyAlarmSpeedMultiplier(12.5), 0.65);
    assert.equal(getKeyAlarmSpeedMultiplier(24.99), 0.65);
    const midRamp = getKeyAlarmSpeedMultiplier(32.5);
    assert.ok(midRamp > 0.8 && midRamp < 0.85, `Expected ~0.825 mid-ramp, got ${midRamp}`);
    assert.equal(getKeyAlarmSpeedMultiplier(40), 1.0);
    assert.equal(getKeyAlarmSpeedMultiplier(90), 1.0);

    // Live Beast AI test: right after key alarm, Beast right next to player chases & navigates
    // at 65% speed and MUST NOT instantly capture during 0 <= elapsed < 25s
    const graceBeast = createBeastBrainStateForRoster(1); // Floor 2 Hunter
    graceBeast.x = 14.8;
    graceBeast.feetY = FLOOR_ELEVATIONS[2];
    graceBeast.z = 0.0;
    const openMissionDoors: Record<SpecialDoorKey, DoorAnimState> = { ...CLOSED_DOORS, mission: 'open' };

    for (let step = 0; step < 60; step++) {
      // 3.0 seconds of alarm elapsed (< 25s) while player is right in front of the Beast
      const evts = stepBeastBrain({
        state: graceBeast,
        delta: 0.05,
        playerX: graceBeast.x + 0.4,
        playerFeetY: FLOOR_ELEVATIONS[2],
        playerZ: graceBeast.z,
        controlMode: 'first-person',
        doorStates: openMissionDoors,
        keyAlarmTriggered: true,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.mission,
        nowMs: 1000 + step * 50,
      });
      assert.ok(
        !evts.includes('capture-started'),
        `Beast captured player prematurely during 25s escape grace window (t=${(graceBeast.keyAlarmElapsedSeconds ?? 0).toFixed(2)}s)`
      );
    }
    const elapsedAfterSteps = graceBeast.keyAlarmElapsedSeconds ?? 0;
    assert.ok(elapsedAfterSteps >= 2.9 && elapsedAfterSteps < 25);

    // Advance alarm elapsed past 25s -> capture immediately re-enables!
    graceBeast.keyAlarmElapsedSeconds = 25.0;
    let capturedAfterGrace = false;
    for (let step = 0; step < 30; step++) {
      const evts = stepBeastBrain({
        state: graceBeast,
        delta: 0.05,
        playerX: graceBeast.x + 0.5,
        playerFeetY: FLOOR_ELEVATIONS[2],
        playerZ: graceBeast.z,
        controlMode: 'first-person',
        doorStates: openMissionDoors,
        keyAlarmTriggered: true,
        beastAlerted: false,
        profile: BEAST_DIFFICULTY_PROFILES.mission,
        nowMs: 30000 + step * 50,
      });
      if (evts.includes('capture-started')) {
        capturedAfterGrace = true;
        break;
      }
    }
    assert.equal(capturedAfterGrace, true, 'Normal Beast capture MUST resume immediately after the 25s grace window');
    console.log('PASS 10: 65% initial alarm speed, 25s no-instant-capture escape window, smooth ramp to 100%, and post-grace capture verified.');
  }

  // ---------------------------------------------------------------------------
  // 11. Key Security Rule (Return Real Key if Caught Before Puzzle Room; Preserve After)
  // ---------------------------------------------------------------------------
  {
    useGameStore.getState().startGameFromMenu();
    const rc = getMissionRoomNumber();
    useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.missionDoorId);
    useGameStore.getState().markSpecialDoorOpen('mission');
    useGameStore.getState().enterMissionRoom();

    // Collect FALSE key first (cell-b) and REAL key (cell-a)
    useGameStore.getState().submitKeyCellPassword('cell-b', rc);
    useGameStore.getState().collectKeyFromCell('cell-b');
    useGameStore.getState().submitKeyCellPassword('cell-a', rc);
    useGameStore.getState().collectKeyFromCell('cell-a');

    assert.equal(useGameStore.getState().hasPuzzleRoomKey, true);
    assert.equal(useGameStore.getState().hasFalsePuzzleKey, true);
    assert.equal(useGameStore.getState().keyCells['cell-a'].keyCollected, true);
    assert.equal(useGameStore.getState().keyCells['cell-b'].variant, 'false');
    assert.equal(useGameStore.getState().keyPickupAlarmTriggered, true);
    assert.equal(useGameStore.getState().emergencyAlarmActive, true);
    assert.equal(useGameStore.getState().puzzleRoomEntered, false);

    // Caught BEFORE entering Puzzle Room -> genuine key MUST return to cell-a & alarm resets
    useGameStore.getState().beginBeastCapture();
    useGameStore.getState().completeBeastCapture();
    const afterCatchBeforePuzzle = useGameStore.getState();
    assert.equal(afterCatchBeforePuzzle.hasPuzzleRoomKey, false, 'Real key must be removed from inventory');
    assert.equal(afterCatchBeforePuzzle.keyReturnedOnCatch, true, 'HUD flag must inform player that real key returned');
    assert.equal(afterCatchBeforePuzzle.keyCells['cell-a'].keyCollected, false, 'Real key must return to Mission Room Cell A');
    assert.equal(afterCatchBeforePuzzle.keyCells['cell-a'].variant, 'real', 'Cell A must stay real key');
    assert.equal(afterCatchBeforePuzzle.keyCells['cell-b'].variant, 'false', 'Cell B false key identity must stay untouched');
    assert.equal(afterCatchBeforePuzzle.keyPickupAlarmTriggered, false, 'Alarm state must reset cleanly for re-collection');
    assert.equal(afterCatchBeforePuzzle.emergencyAlarmActive, false, 'Emergency siren/lights must clear when key returns');

    // Respawn (3 -> 2) and re-collect real key from Cell A -> triggers alarm cleanly again
    useGameStore.getState().recoverFromBeastCatch();
    assert.equal(useGameStore.getState().respawnsRemaining, 2);
    const reCollect = useGameStore.getState().collectKeyFromCell('cell-a');
    assert.equal(reCollect.collected, true, 'Returned key must be cleanly re-collectable');
    assert.equal(reCollect.variant, 'real');
    assert.equal(useGameStore.getState().keyPickupAlarmTriggered, true);

    // Now enter Puzzle Room, then get caught -> genuine key MUST NOT be removed once Puzzle Room was entered
    useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.puzzleDoorId);
    useGameStore.getState().markSpecialDoorOpen('puzzle');
    useGameStore.getState().enterPuzzleRoom();
    assert.equal(useGameStore.getState().puzzleRoomEntered, true);
    useGameStore.getState().beginBeastCapture();
    useGameStore.getState().completeBeastCapture();
    assert.equal(useGameStore.getState().hasPuzzleRoomKey, true, 'Real key must stay in inventory if caught AFTER entering Puzzle Room');
    assert.equal(useGameStore.getState().keyReturnedOnCatch, false);
    console.log('PASS 11: Key Security Rule returns real key to Cell A before Puzzle Room entry, preserves false key, and keeps key after entry.');
  }

  // ---------------------------------------------------------------------------
  // 12. Limited Respawn System (3 Respawns Max, 4th Capture = Permanent Game Over + Restart Reset)
  // ---------------------------------------------------------------------------
  {
    useGameStore.getState().startGameFromMenu();
    assert.equal(useGameStore.getState().respawnsRemaining, 3, 'New game must start with 3/3 respawns');
    assert.equal(useGameStore.getState().permanentGameOver, false);

    // Capture 1 -> Respawn 1 (3 -> 2)
    useGameStore.getState().beginBeastCapture();
    useGameStore.getState().completeBeastCapture();
    assert.equal(useGameStore.getState().permanentGameOver, false);
    useGameStore.getState().recoverFromBeastCatch();
    assert.equal(useGameStore.getState().respawnsRemaining, 2);

    // Capture 2 -> Respawn 2 (2 -> 1)
    useGameStore.getState().beginBeastCapture();
    useGameStore.getState().completeBeastCapture();
    assert.equal(useGameStore.getState().permanentGameOver, false);
    useGameStore.getState().recoverFromBeastCatch();
    assert.equal(useGameStore.getState().respawnsRemaining, 1);

    // Capture 3 -> Respawn 3 (1 -> 0)
    useGameStore.getState().beginBeastCapture();
    useGameStore.getState().completeBeastCapture();
    assert.equal(useGameStore.getState().permanentGameOver, false);
    useGameStore.getState().recoverFromBeastCatch();
    assert.equal(useGameStore.getState().respawnsRemaining, 0);

    // Capture 4 (with 0 respawns remaining) -> PERMANENT GAME OVER, respawn strictly blocked
    useGameStore.getState().beginBeastCapture();
    useGameStore.getState().completeBeastCapture();
    assert.equal(useGameStore.getState().progression, 'PLAYER_CAUGHT');
    assert.equal(useGameStore.getState().permanentGameOver, true, '4th capture must trigger Permanent Game Over');

    // Attempting recoverFromBeastCatch() must be blocked
    useGameStore.getState().recoverFromBeastCatch();
    assert.equal(useGameStore.getState().progression, 'PLAYER_CAUGHT', 'Respawn must be blocked on Permanent Game Over');
    assert.equal(useGameStore.getState().permanentGameOver, true);
    assert.equal(useGameStore.getState().respawnsRemaining, 0);

    // Restart Game resets full progression and restores 3/3 respawns
    useGameStore.getState().resetNewGame();
    const restarted = useGameStore.getState();
    assert.equal(restarted.respawnsRemaining, 3, 'Restart Game must restore respawns to 3/3');
    assert.equal(restarted.permanentGameOver, false);
    assert.equal(restarted.progression, 'EXPLORE');
    assert.equal(restarted.hasPuzzleRoomKey, false);
    assert.equal(restarted.keyPickupAlarmTriggered, false);
    assert.equal(restarted.puzzleRoomEntered, false);
    console.log('PASS 12: Limited 3-respawn counter (3->2->1->0), 4th-capture Permanent Game Over, respawn lock, and full Restart Game reset verified.');
  }

  console.log('ALL FOUR BEASTS, PUZZLE UPGRADE, ESCAPE WINDOW, KEY SECURITY & LIMITED RESPAWN TESTS PASSED!');
}

void runFourBeastsVerification();
