import assert from 'node:assert/strict';
import {
  ALL_ROOMS,
  getMissionRoomNumber,
  MISSION_KEY_CELLS,
  SPECIAL_ROOMS_CONFIG,
} from '../src/data/buildingLayout';
import {
  PUZZLE_CATEGORY_ORDER,
  PUZZLE_CATEGORY_SPECS,
  PUZZLE_MAX_ATTEMPTS,
  PUZZLE_TIME_LIMIT_SECONDS,
  validatePuzzleSessionBundle,
} from '../src/data/puzzleConfig';
import * as soundEffects from '../src/three/soundEffects';

async function runMenuAndAudioTests() {
  // Provide an isolated localStorage + window shim in Node so sensitivity persistence is verified end-to-end
  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storageMap.set(k, v);
    },
    removeItem: (k: string) => {
      storageMap.delete(k);
    },
    clear: () => {
      storageMap.clear();
    },
  };
  (globalThis as unknown as { window: Record<string, unknown> }).window = {
    localStorage: mockLocalStorage,
  };

  const storeMod = await import('../src/store/useGameStore');
  const {
    useGameStore,
    DEFAULT_MOUSE_SENSITIVITY,
    MIN_MOUSE_SENSITIVITY,
    MAX_MOUSE_SENSITIVITY,
    SETTINGS_STORAGE_KEY,
  } = storeMod;

  console.log('Running LAST EXIT Main Menu, Sensitivity, Playing Card Challenge, Pause & Audio verification suite...');

  // 1. Game launches on Main Menu with default volume & Mouse Sensitivity (1.0)
  {
    const initial = useGameStore.getState();
    assert.equal(initial.inMainMenu, true, 'App must launch with Main Menu visible');
    assert.equal(initial.audioEnabled, true, 'Audio should default to enabled');
    assert.equal(initial.mouseSensitivity, DEFAULT_MOUSE_SENSITIVITY, 'Mouse sensitivity must default to 1.0');
    assert.ok(initial.masterVolume > 0 && initial.musicVolume > 0 && initial.sfxVolume > 0);
    initial.toggleGamePaused();
    assert.equal(useGameStore.getState().gamePaused, false, 'Pause must not activate on Main Menu');
    console.log('PASS A: Game launches cleanly on Main Menu with Mouse Sensitivity default 1.0.');
  }

  // 2. Mouse Sensitivity bounds, localStorage persistence, and Reset to Default
  {
    const st = useGameStore.getState();
    st.setMouseSensitivity(0.05);
    assert.equal(
      useGameStore.getState().mouseSensitivity,
      MIN_MOUSE_SENSITIVITY,
      'Sensitivity clamps to min 0.2'
    );
    st.setMouseSensitivity(5.5);
    assert.equal(
      useGameStore.getState().mouseSensitivity,
      MAX_MOUSE_SENSITIVITY,
      'Sensitivity clamps to max 3.0'
    );
    st.setMouseSensitivity(1.8);
    assert.equal(useGameStore.getState().mouseSensitivity, 1.8);

    const savedJson = mockLocalStorage.getItem(SETTINGS_STORAGE_KEY);
    assert.ok(savedJson && JSON.parse(savedJson).mouseSensitivity === 1.8, 'Sensitivity persisted in localStorage');

    st.startGameFromMenu();
    assert.equal(
      useGameStore.getState().mouseSensitivity,
      1.8,
      'Mouse sensitivity persists when starting game'
    );

    st.resetMouseSensitivity();
    assert.equal(useGameStore.getState().mouseSensitivity, 1.0, 'Reset to Default restores 1.0');
    const savedReset = mockLocalStorage.getItem(SETTINGS_STORAGE_KEY);
    assert.ok(savedReset && JSON.parse(savedReset).mouseSensitivity === 1.0);
    st.returnToMainMenu();
    console.log('PASS B: Mouse Sensitivity range (0.2–3.0), localStorage persistence, and Reset to Default verified.');
  }

  // 3. Volume & Mute controls + Pause Menu freeze / resume
  {
    const st = useGameStore.getState();
    st.setMasterVolume(0.45);
    st.setMusicVolume(0.3);
    st.setSfxVolume(0.7);
    st.toggleAudio();
    assert.equal(useGameStore.getState().audioEnabled, false);
    st.toggleAudio();
    assert.equal(useGameStore.getState().audioEnabled, true);

    st.startGameFromMenu();
    const playing = useGameStore.getState();
    assert.equal(playing.inMainMenu, false);
    assert.equal(playing.controlMode, 'third-person');
    assert.equal(playing.hasMissionRoomKey, true);
    assert.equal(playing.masterVolume, 0.45);

    st.toggleGamePaused();
    assert.equal(useGameStore.getState().gamePaused, true);
    useGameStore.setState({ puzzleStage: 'active', puzzleTimerRunning: true, puzzleTimerSeconds: 50 });
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 50, 'Timer must freeze while paused');

    st.toggleGamePaused();
    assert.equal(useGameStore.getState().gamePaused, false);
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 49, 'Timer resumes when unpaused');

    st.returnToMainMenu();
    assert.equal(useGameStore.getState().inMainMenu, true);
    console.log('PASS C: Audio, Pause freeze/resume, and Return to Main Menu verified.');
  }

  // 4. Four Randomized Mini-Game Categories configuration & generated bundle validation
  {
    assert.deepEqual(PUZZLE_CATEGORY_ORDER, ['math', 'cards', 'memory', 'mechanical']);
    assert.equal(PUZZLE_CATEGORY_SPECS.math.stageCount, 4);
    assert.equal(PUZZLE_CATEGORY_SPECS.cards.stageCount, 4);
    assert.equal(PUZZLE_CATEGORY_SPECS.memory.stageCount, 3);
    assert.equal(PUZZLE_CATEGORY_SPECS.mechanical.stageCount, 3);
    const session = useGameStore.getState().puzzleSession;
    const validation = validatePuzzleSessionBundle(session);
    assert.equal(validation.valid, true, `Puzzle session invalid: ${validation.errors.join('; ')}`);
    console.log('PASS D: All 4 randomized mini-game category specs & procedural session bundle validated.');
  }

  // 5. Full Progression: Mission Room Key Cells -> Real Key (timer still off) -> Enter Puzzle Room (300s starts)
  //    -> Suit switch -> Start locks suit -> Close/Reopen keeps timer -> 60s/30s warnings -> Timeout Game Over -> Retry -> 1 Suit Escape
  {
    useGameStore.getState().startGameFromMenu();
    assert.equal(MISSION_KEY_CELLS.length, 2);

    useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.missionDoorId);
    useGameStore.getState().markSpecialDoorOpen('mission');
    useGameStore.getState().enterMissionRoom();

    const dynamicRoomCode = ALL_ROOMS.find((r) => r.id === SPECIAL_ROOMS_CONFIG.missionRoomId)?.code;
    assert.ok(dynamicRoomCode);
    assert.equal(getMissionRoomNumber(), dynamicRoomCode);

    // False key rejected
    useGameStore.getState().submitKeyCellPassword('cell-b', dynamicRoomCode);
    useGameStore.getState().collectKeyFromCell('cell-b');
    const falseDoor = useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.puzzleDoorId);
    assert.equal(falseDoor.opened, false);

    // Real key collected — timer MUST NOT start yet
    useGameStore.getState().submitKeyCellPassword('cell-a', dynamicRoomCode);
    useGameStore.getState().collectKeyFromCell('cell-a');
    assert.equal(useGameStore.getState().hasPuzzleRoomKey, true);
    assert.equal(
      useGameStore.getState().puzzleTimerRunning,
      false,
      'Collecting Puzzle Key must NOT start the Puzzle Room countdown'
    );

    // Open & Enter Puzzle Room -> 5-minute (300s) timer starts IMMEDIATELY
    const puzzleDoor = useGameStore.getState().tryUnlockSpecialDoor(SPECIAL_ROOMS_CONFIG.puzzleDoorId);
    assert.equal(puzzleDoor.opened, true);
    useGameStore.getState().markSpecialDoorOpen('puzzle');
    useGameStore.getState().enterPuzzleRoom();

    const enteredState = useGameStore.getState();
    assert.equal(enteredState.puzzleRoomEntered, true);
    assert.equal(enteredState.puzzleStage, 'suit-select');
    assert.equal(enteredState.puzzleTimerSeconds, PUZZLE_TIME_LIMIT_SECONDS);
    assert.equal(enteredState.puzzleTimerRunning, true, 'Timer starts immediately upon entering Puzzle Room');
    assert.equal(enteredState.beastAlerted, true, 'Beast AI remains active');

    // Timer ticks during suit selection
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 299);

    // Switch categories before starting
    useGameStore.getState().selectPuzzleCategory('math');
    assert.equal(useGameStore.getState().selectedPuzzleCategory, 'math');
    useGameStore.getState().selectPuzzleCategory('cards');
    assert.equal(useGameStore.getState().selectedPuzzleCategory, 'cards');
    assert.equal(useGameStore.getState().categoryLocked, false);

    // Start challenge locks category and does NOT reset remaining timer
    useGameStore.getState().startPuzzleChallenge();
    assert.equal(useGameStore.getState().categoryLocked, true);
    assert.equal(useGameStore.getState().puzzleStage, 'active');
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 299);

    // Attempting to switch category after starting is blocked
    useGameStore.getState().selectPuzzleCategory('mechanical');
    assert.equal(useGameStore.getState().selectedPuzzleCategory, 'cards', 'Category cannot change once started');

    // Closing and reopening modal preserves remaining timer & ticks while closed
    useGameStore.getState().closePuzzleModal();
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 298);
    useGameStore.getState().openPuzzleModal();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 298, 'Reopening modal must NOT reset timer');

    // Wrong attempts up to PUZZLE_MAX_ATTEMPTS show failed stage while timer keeps running
    for (let i = 0; i < PUZZLE_MAX_ATTEMPTS; i++) {
      useGameStore.getState().recordWrongAttempt();
    }
    assert.equal(useGameStore.getState().puzzleStage, 'failed');
    assert.equal(useGameStore.getState().puzzleTimerRunning, true);
    useGameStore.getState().retryCardChallenge();
    assert.equal(useGameStore.getState().puzzleStage, 'active');

    // 60s and 30s warnings & 0s timeout Game Over
    useGameStore.setState({ puzzleTimerSeconds: 61, puzzleWarning: 'none' });
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 60);
    assert.equal(useGameStore.getState().puzzleWarning, '60s');

    useGameStore.setState({ puzzleTimerSeconds: 31 });
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 30);
    assert.equal(useGameStore.getState().puzzleWarning, '30s');

    // 0s timeout removes Puzzle Room protection so the 4 Hunters breach the chamber
    useGameStore.setState({ puzzleTimerSeconds: 1, puzzleProtectionActive: true, puzzleTimerExpired: false });
    useGameStore.getState().tickPuzzleTimer();
    assert.equal(useGameStore.getState().puzzleTimerSeconds, 0);
    assert.equal(
      useGameStore.getState().puzzleProtectionActive,
      false,
      'Puzzle Room protection MUST drop immediately when timer reaches 0'
    );
    assert.equal(useGameStore.getState().puzzleTimerExpired, true);
    assert.equal(useGameStore.getState().puzzleModalOpen, false);

    // Simulate Hunter breaching the room and capturing the player -> Game Over
    useGameStore.getState().beginBeastCapture();
    useGameStore.getState().completeBeastCapture();
    assert.equal(useGameStore.getState().progression, 'PLAYER_CAUGHT');
    assert.equal(useGameStore.getState().gameOverReason, 'puzzle-timeout');

    // Respawn resets the expired puzzle timer & restores protection cleanly so player can finish
    useGameStore.getState().recoverFromBeastCatch();
    assert.equal(useGameStore.getState().progression, 'PUZZLE_ACTIVE');
    assert.equal(useGameStore.getState().puzzleTimerSeconds, PUZZLE_TIME_LIMIT_SECONDS);
    assert.equal(useGameStore.getState().puzzleTimerRunning, true);
    assert.equal(useGameStore.getState().puzzleProtectionActive, true);
    assert.equal(useGameStore.getState().puzzleTimerExpired, false);

    // Completing ONLY ONE selected category challenge immediately unlocks the Safe Room & Emergency Descent
    useGameStore.getState().selectPuzzleCategory('memory');
    useGameStore.getState().startPuzzleChallenge();
    useGameStore.getState().completePuzzleChallenge();

    assert.equal(useGameStore.getState().allPuzzlesCompleted, true);
    assert.equal(useGameStore.getState().finalExitUnlocked, true);
    assert.equal(useGameStore.getState().safeRoomUnlocked, true);
    assert.equal(useGameStore.getState().puzzleProtectionActive, true, 'Protection stays active during escape');
    assert.equal(useGameStore.getState().progression, 'EXIT_UNLOCKED');

    // Reaching the Ground Floor Escape Zone via physical descent completes escape
    useGameStore.getState().triggerGroundFloorEscape();
    assert.equal(useGameStore.getState().escaped, true);
    assert.equal(useGameStore.getState().progression, 'ESCAPED');
    console.log('PASS E: Playing Card Challenge, 300s timer, protection drop on timeout, 1-suit Safe Room unlock & Ground Floor Escape verified.');
  }

  // 6. All existing & new Beast warrior audio exports exist and run cleanly (including 3D spatial pos)
  {
    const requiredFns = [
      'initAudioContext',
      'setAudioSettings',
      'updateBackgroundMusic',
      'playMenuClickSound',
      'playPlayerFootstepSound',
      'playDoorSound',
      'playLockedDoorSound',
      'playKeyPickupSound',
      'playMissionCompleteSound',
      'playPuzzleCompleteSound',
      'playVictoryEscapeSound',
      'playBeastAlertSiren',
      'playBeastFootstepSound',
      'playBeastServoSound',
      'playBeastDetectSound',
      'playBeastChasePulseSound',
      'playBeastCaptureSound',
      'playBeastBreathingSound',
      'playBeastGrowlSound',
      'playBeastBattleCrySound',
      'playBeastSwordSwishSound',
      'playKeypadBeep',
      'playFloorSwitchSound',
      'playTimerWarningSound',
    ] as const;

    for (const name of requiredFns) {
      assert.equal(typeof soundEffects[name], 'function', `Expected audio export ${name}`);
    }

    const samplePos = { x: 4, y: 0, z: -6 };
    soundEffects.updateBackgroundMusic('stalking');
    soundEffects.playBeastFootstepSound(6, true, true, samplePos);
    soundEffects.playBeastBreathingSound(samplePos, true, true);
    soundEffects.playBeastGrowlSound(samplePos, true);
    soundEffects.playBeastDetectSound(true, samplePos);
    soundEffects.playBeastBattleCrySound(samplePos, true, true);
    soundEffects.playBeastSwordSwishSound(samplePos, true, true);
    soundEffects.playBeastCaptureSound(true, samplePos);
    soundEffects.playTimerWarningSound(false, true);
    soundEffects.playTimerWarningSound(true, true);

    const { createBeastWarriorMaterials } = await import('../src/three/beastTextures');
    const warriorMats = createBeastWarriorMaterials();
    assert.ok(warriorMats.torsoMat && warriorMats.headMat && warriorMats.swordBladeMat);
    warriorMats.dispose();

    console.log('PASS F: All 24 audio functions, stalking music mode, and warrior materials verified.');
  }

  console.log('ALL MENU, SENSITIVITY, PLAYING CARD CHALLENGE, PAUSE & AUDIO TESTS PASSED!');
}

void runMenuAndAudioTests();
