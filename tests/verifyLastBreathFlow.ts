import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SOUND_PRESETS } from '../src/three/soundBus';
import { playerWorldPos, virtualInput } from '../src/three/playerWorldState';
import { resolvePlayerMovement } from '../src/three/collision';
import * as soundEffects from '../src/three/soundEffects';
import { attemptQuitGame } from '../src/utils/appLifecycle';
import { PUZZLE_TIME_LIMIT_SECONDS } from '../src/data/puzzleConfig';

async function runLastBreathFlowTests() {
  const storageMap = new Map<string, string>();
  (globalThis as unknown as { window: Record<string, unknown> }).window = {
    localStorage: {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => storageMap.set(k, v),
      removeItem: (k: string) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    },
  };

  const { useGameStore, MAX_RESPAWNS } = await import('../src/store/useGameStore');

  console.log('Running LAST BREATH Identity, Loading Flow, Exit Menu & Full Restart verification...');

  // 1. Initial launch starts at Loading Screen with real progress 0 -> 100 gating Lobby transition
  {
    const initial = useGameStore.getState();
    assert.equal(initial.screenPhase, 'loading', 'App must boot into loading screen phase');
    assert.equal(initial.inMainMenu, true, 'Gameplay/Beasts stay paused during loading');
    assert.equal(initial.sceneReady, false, 'Scene ready begins false until real render ticks finish');

    // Premature finishLoadingToLobby before sceneReady must NOT skip loading
    initial.finishLoadingToLobby();
    assert.equal(
      useGameStore.getState().screenPhase,
      'loading',
      'Cannot leave loading screen before sceneReady & 100%'
    );

    // Partial real progress
    initial.setSceneLoadState(68, false);
    assert.equal(useGameStore.getState().sceneLoadProgress, 68);
    useGameStore.getState().finishLoadingToLobby();
    assert.equal(useGameStore.getState().screenPhase, 'loading');

    // Scene completes real initialization
    useGameStore.getState().setSceneLoadState(100, true);
    useGameStore.getState().finishLoadingToLobby();
    assert.equal(useGameStore.getState().screenPhase, 'lobby', 'Transitions cleanly to Player Lobby');
    assert.equal(useGameStore.getState().inMainMenu, true, 'Beasts stay paused in Player Lobby');
    console.log('PASS A: Loading Screen real-readiness gate -> Player Lobby verified.');
  }

  // 2. Player Lobby -> Start Game -> Game Briefing -> Back / Next flow
  {
    const st = useGameStore.getState();
    st.openBriefingFromLobby();
    assert.equal(useGameStore.getState().screenPhase, 'briefing', 'START GAME opens Game Briefing');
    assert.equal(useGameStore.getState().inMainMenu, true, 'Gameplay stays suspended during Briefing');

    useGameStore.getState().backToLobbyFromBriefing();
    assert.equal(useGameStore.getState().screenPhase, 'lobby', 'BACK returns cleanly to Player Lobby');
    assert.equal(useGameStore.getState().inMainMenu, true);

    useGameStore.getState().openBriefingFromLobby();
    assert.equal(useGameStore.getState().screenPhase, 'briefing');

    useGameStore.getState().startGameFromMenu();
    assert.equal(useGameStore.getState().screenPhase, 'playing', 'NEXT launches live gameplay');
    assert.equal(useGameStore.getState().inMainMenu, false);
    assert.equal(useGameStore.getState().gamePaused, false);
    assert.equal(useGameStore.getState().hasMissionRoomKey, true);
    console.log('PASS B: Player Lobby -> Game Briefing -> Back / Next -> Live Gameplay flow verified.');
  }

  // 3. Crouch stealth acoustic preset, Jump/Crouch store & virtualInput sync, collision safety
  {
    assert.ok(
      SOUND_PRESETS['footstep-crouch'].radius < SOUND_PRESETS['footstep-walk'].radius,
      'Crouch footsteps must emit significantly smaller hearing radius than walk'
    );
    assert.ok(
      SOUND_PRESETS['footstep-crouch'].intensity < SOUND_PRESETS['footstep-walk'].intensity,
      'Crouch footsteps must emit lower intensity than walk'
    );

    const st = useGameStore.getState();
    assert.equal(st.playerCrouched, false);
    st.toggleCrouch();
    assert.equal(useGameStore.getState().playerCrouched, true);
    st.setCrouch(false);
    assert.equal(useGameStore.getState().playerCrouched, false);

    const blocked = resolvePlayerMovement({
      x: 0,
      z: 22,
      feetY: 0,
      doorStates: useGameStore.getState().doorStates,
    });
    assert.ok(
      Number.isFinite(blocked.x) && Number.isFinite(blocked.z),
      'Character collision resolution remains deterministic and finite'
    );

    assert.equal(typeof soundEffects.playJumpLandSound, 'function');
    assert.equal(typeof soundEffects.playBriefingTransitionSound, 'function');
    assert.equal(typeof soundEffects.playGameplayStartSound, 'function');
    soundEffects.playJumpLandSound(true, false);
    soundEffects.playBriefingTransitionSound(false);
    soundEffects.playGameplayStartSound(false);
    console.log('PASS C: Crouch stealth sound radius, Jump/Briefing SFX, and collision verified.');
  }

  // 4. Quit Game host handling & dedicated EXITED screen
  {
    let desktopQuitCalled = false;
    const desktopRes = attemptQuitGame({
      desktopQuit: () => {
        desktopQuitCalled = true;
      },
    });
    assert.equal(desktopQuitCalled, true, 'Desktop host quit mechanism must be invoked when available');
    assert.equal(desktopRes.closed, true);
    assert.equal(desktopRes.environment, 'desktop');

    let browserCloseCalled = false;
    const blockedBrowserRes = attemptQuitGame({
      desktopQuit: null,
      canAttemptBrowserClose: false,
      browserClose: () => {
        browserCloseCalled = true;
      },
      isBrowserClosed: () => false,
    });
    assert.equal(browserCloseCalled, false, 'Blocked browser close must not falsely invoke or claim closure');
    assert.equal(blockedBrowserRes.closed, false);
    assert.equal(blockedBrowserRes.environment, 'browser');

    const permittedBlockedRes = attemptQuitGame({
      desktopQuit: null,
      canAttemptBrowserClose: true,
      browserClose: () => {
        browserCloseCalled = true;
      },
      isBrowserClosed: () => false,
    });
    assert.equal(browserCloseCalled, true);
    assert.equal(permittedBlockedRes.closed, false, 'When browser ignores window.close(), closed stays false');

    useGameStore.getState().enterExitedScreen();
    assert.equal(useGameStore.getState().screenPhase, 'exited');
    assert.equal(useGameStore.getState().inMainMenu, true);

    useGameStore.getState().returnToLobbyFromExited();
    assert.equal(useGameStore.getState().screenPhase, 'lobby');
    console.log('PASS D: Quit Game host detection, browser fallback, and EXITED screen verified.');
  }

  // 5. Full Game Restart from Lobby -> Clears gameplay state, preserves settings, displays Loading -> Lobby
  {
    const st = useGameStore.getState();
    // Apply custom persistent user settings before simulating an active run
    st.setMouseSensitivity(2.2);
    st.setCameraDistance(4.2);
    st.setMasterVolume(0.42);
    st.setMusicVolume(0.35);
    st.setSfxVolume(0.65);

    // Dirty session state as if mid-run
    st.startGameFromMenu();
    const prevLayoutVer = useGameStore.getState().layoutVersion;
    const prevLoadTrigger = useGameStore.getState().loadingSequenceTrigger;
    const prevSeed = useGameStore.getState().puzzleSessionSeed;

    useGameStore.setState({
      progression: 'PUZZLE_ACTIVE',
      respawnsRemaining: 1,
      hasPuzzleRoomKey: true,
      hasFalsePuzzleKey: true,
      emergencyAlarmActive: true,
      puzzleTimerRunning: true,
      puzzleTimerSeconds: 123,
      puzzleRoomEntered: true,
      missionRoomEntered: true,
      missionCompleted: true,
      safeRoomUnlocked: true,
      playerFloor: 3,
      hasEnteredApartment: true,
    });
    virtualInput.moveX = 0.7;
    virtualInput.moveY = -0.9;
    virtualInput.sprinting = true;
    playerWorldPos.isCrouching = true;

    // Return to lobby then confirm full restart
    useGameStore.getState().returnToMainMenu();
    assert.equal(useGameStore.getState().screenPhase, 'lobby');
    const prevBeastTrigger = useGameStore.getState().beastResetTrigger;
    const prevSpawnTrigger = useGameStore.getState().playerSpawnTrigger;

    const started = useGameStore.getState().restartFullGameToLobby();
    assert.equal(started, true, 'First restart request must execute');

    // Guard against duplicate simultaneous restart requests
    const duplicate = useGameStore.getState().restartFullGameToLobby();
    assert.equal(duplicate, false, 'Simultaneous duplicate restart must be blocked');

    const loadingState = useGameStore.getState();
    assert.equal(loadingState.screenPhase, 'loading', 'Restart displays Loading Screen first');
    assert.equal(loadingState.isRestarting, true);
    assert.equal(loadingState.inMainMenu, true, 'Beast AI & gameplay remain suspended');
    assert.equal(loadingState.sceneReady, false);
    assert.equal(loadingState.loadingSequenceTrigger, prevLoadTrigger + 1);

    // Verify all gameplay/inventory/timer/respawn state was cleanly reset
    assert.equal(loadingState.progression, 'EXPLORE');
    assert.equal(loadingState.respawnsRemaining, MAX_RESPAWNS);
    assert.equal(loadingState.hasMissionRoomKey, true);
    assert.equal(loadingState.hasPuzzleRoomKey, false);
    assert.equal(loadingState.hasFalsePuzzleKey, false);
    assert.equal(loadingState.emergencyAlarmActive, false);
    assert.equal(loadingState.puzzleTimerRunning, false);
    assert.equal(loadingState.puzzleTimerSeconds, PUZZLE_TIME_LIMIT_SECONDS);
    assert.equal(loadingState.puzzleRoomEntered, false);
    assert.equal(loadingState.missionRoomEntered, false);
    assert.equal(loadingState.missionCompleted, false);
    assert.equal(loadingState.safeRoomUnlocked, false);
    assert.equal(loadingState.playerFloor, 1);
    assert.equal(loadingState.hasEnteredApartment, false);
    assert.equal(loadingState.layoutVersion, prevLayoutVer + 1);
    assert.equal(loadingState.beastResetTrigger, prevBeastTrigger + 1);
    assert.equal(loadingState.playerSpawnTrigger, prevSpawnTrigger + 1);
    assert.notEqual(loadingState.puzzleSessionSeed, prevSeed);
    assert.equal(virtualInput.moveX, 0);
    assert.equal(virtualInput.moveY, 0);
    assert.equal(virtualInput.sprinting, false);
    assert.equal(playerWorldPos.isCrouching, false);

    // Verify persistent user settings were NOT reset
    assert.equal(loadingState.mouseSensitivity, 2.2);
    assert.equal(loadingState.cameraDistance, 4.2);
    assert.equal(loadingState.masterVolume, 0.42);
    assert.equal(loadingState.musicVolume, 0.35);
    assert.equal(loadingState.sfxVolume, 0.65);

    // Simulate SceneEnvironment completing frame-confirmed loading -> transitions to Player Lobby
    useGameStore.getState().setSceneLoadState(100, true);
    useGameStore.getState().finishLoadingToLobby();
    assert.equal(useGameStore.getState().screenPhase, 'lobby');
    assert.equal(useGameStore.getState().isRestarting, false);
    assert.equal(useGameStore.getState().inMainMenu, true);

    // Can begin a completely fresh game right after restart
    useGameStore.getState().openBriefingFromLobby();
    assert.equal(useGameStore.getState().screenPhase, 'briefing');
    useGameStore.getState().startGameFromMenu();
    assert.equal(useGameStore.getState().screenPhase, 'playing');
    assert.equal(useGameStore.getState().inMainMenu, false);
    console.log('PASS E: Full Restart sequence, duplicate guard, preserved user settings, and fresh Lobby flow verified.');
  }

  // 6. Branding & UI Text Verification
  {
    const rootDir = process.cwd();
    const uiFilesToCheck = [
      'index.html',
      'src/App.tsx',
      'src/components/hud/MainMenu.tsx',
      'src/components/hud/GameHUD.tsx',
      'src/components/hud/LoadingScreen.tsx',
      'src/components/hud/GameBriefing.tsx',
      'src/components/hud/CinematicIntroOverlay.tsx',
      'src/components/hud/LastBreathLogo.tsx',
      'src/components/hud/TouchControlsOverlay.tsx',
      'src/components/hud/SettingsControlsPanels.tsx',
      'src/components/scene/ApartmentBuildingExterior.tsx',
    ];

    for (const rel of uiFilesToCheck) {
      const content = fs.readFileSync(path.join(rootDir, rel), 'utf8');
      assert.equal(
        /last\s+exit/i.test(content),
        false,
        `Found forbidden legacy 'LAST EXIT' branding in ${rel}`
      );
    }

    const menuSrc = fs.readFileSync(path.join(rootDir, 'src/components/hud/MainMenu.tsx'), 'utf8');
    for (const requiredCopy of [
      'EXIT LAST BREATH',
      'Choose what you want to do.',
      'QUIT GAME',
      'Close the game completely.',
      'RESTART GAME',
      'Start again from the beginning.',
      'Are you sure you want to restart LAST BREATH? Your current game progress will be lost.',
      'You have left the game. You can close this browser tab.',
    ]) {
      assert.ok(menuSrc.includes(requiredCopy), `MainMenu.tsx missing required UI text: ${requiredCopy}`);
    }

    console.log('PASS F: 100% LAST BREATH rebranding & exact Exit/Restart modal copy confirmed.');
  }

  // 7. Minimum 7-second / Target ~8-second Loading Duration & Asset-Readiness Gating
  {
    const loadingMod = await import('../src/components/hud/LoadingScreen');
    const {
      MIN_LOADING_DURATION_MS,
      TARGET_PROGRESS_DURATION_MS,
      computeLoadingDisplayProgress,
    } = loadingMod;

    assert.equal(MIN_LOADING_DURATION_MS, 7000, 'Minimum loading duration must be 7000ms');
    assert.ok(
      TARGET_PROGRESS_DURATION_MS >= 7000 && TARGET_PROGRESS_DURATION_MS <= 8000,
      'Progress ramp targets ~7.5s so fade-out lands around 8s total'
    );

    // Even if assets finish instantly at 0ms / 3.5s / 6.99s, loading screen MUST NOT finish before 7s
    const atStart = computeLoadingDisplayProgress({
      elapsedMs: 0,
      actualProgress: 100,
      sceneReady: true,
    });
    assert.equal(atStart.displayPct, 0);
    assert.equal(atStart.canFinish, false);

    const midLoad = computeLoadingDisplayProgress({
      elapsedMs: 3500,
      actualProgress: 100,
      sceneReady: true,
    });
    assert.ok(midLoad.displayPct > 40 && midLoad.displayPct < 75, `Unexpected midLoad pct: ${midLoad.displayPct}`);
    assert.equal(midLoad.canFinish, false);

    const justBeforeMin = computeLoadingDisplayProgress({
      elapsedMs: 6999,
      actualProgress: 100,
      sceneReady: true,
    });
    assert.equal(justBeforeMin.canFinish, false, 'Cannot finish before 7000ms');

    // If assets take longer than 8s, screen stays visible and caps progress at real progress
    const slowAssets = computeLoadingDisplayProgress({
      elapsedMs: 9200,
      actualProgress: 64,
      sceneReady: false,
    });
    assert.equal(slowAssets.displayPct, 64, 'Slow assets cap displayed progress at real asset readiness');
    assert.equal(slowAssets.canFinish, false, 'Must wait beyond 8s if sceneReady is still false');

    // Once both >= 7s and sceneReady === true at target duration, reaches 100% and permits transition
    const readyFinish = computeLoadingDisplayProgress({
      elapsedMs: 7500,
      actualProgress: 100,
      sceneReady: true,
    });
    assert.equal(readyFinish.displayPct, 100);
    assert.equal(readyFinish.canFinish, true);
    console.log('PASS G: 7s minimum / ~8s target loading duration & genuine readiness gate verified.');
  }

  // 8. 10-Second Cinematic Environment Introduction Flow & Collision-Safe Camera Path
  {
    const THREE = await import('three');
    const {
      INTRO_DURATION_SECONDS,
      sampleIntroCameraPose,
      getIntroSegmentMeta,
    } = await import('../src/three/introCameraPath');
    const { resolveThirdPersonCameraPosition } = await import('../src/three/thirdPersonCamera');
    const { EXTERIOR_PLAYER_SPAWN, FLOOR_ELEVATIONS } = await import('../src/data/buildingLayout');

    assert.equal(INTRO_DURATION_SECONDS, 10.0, 'Intro cinematic duration must be ~10 seconds');

    // Start from briefing -> startIntroFromBriefing
    useGameStore.getState().returnToMainMenu();
    useGameStore.getState().openBriefingFromLobby();
    assert.equal(useGameStore.getState().screenPhase, 'briefing');

    const prevTrigger = useGameStore.getState().introSequenceTrigger;
    useGameStore.getState().startIntroFromBriefing();

    const introState = useGameStore.getState();
    assert.equal(introState.screenPhase, 'intro', 'Clicking PLAY NOW starts the intro phase');
    assert.equal(
      introState.inMainMenu,
      true,
      'Beasts, timers & player controls remain locked during 10s cinematic intro'
    );
    assert.equal(introState.introSequenceTrigger, prevTrigger + 1);
    assert.equal(introState.surviveBannerVisible, false);
    assert.equal(introState.puzzleTimerRunning, false);

    // Ensure third-person end pose matches spawn at (-20.5, 0, 74.0)
    const exactEndPose = resolveThirdPersonCameraPosition({
      playerX: EXTERIOR_PLAYER_SPAWN[0],
      playerFeetY: FLOOR_ELEVATIONS[1],
      playerZ: EXTERIOR_PLAYER_SPAWN[2],
      yaw: 0,
      pitch: 0.14,
      desiredDistance: introState.cameraDistance,
      doorStates: introState.doorStates,
      compoundGateOpen: false,
      mainEntranceOpen: false,
    });

    const outPos = new THREE.Vector3();
    const outLook = new THREE.Vector3();
    let enteredOpenAtrium = false;
    let passedOverGateZone = false;

    for (let t = 0; t <= 10.0 + 1e-6; t += 0.1) {
      sampleIntroCameraPose(t, exactEndPose, outPos, outLook);
      assert.ok(
        Number.isFinite(outPos.x) &&
          Number.isFinite(outPos.y) &&
          Number.isFinite(outPos.z) &&
          Number.isFinite(outLook.x) &&
          Number.isFinite(outLook.y) &&
          Number.isFinite(outLook.z),
        `Camera pose must stay finite at t=${t}`
      );
      assert.ok(outPos.y >= 1.5, `Camera height must clear ground/obstacles at t=${t}: y=${outPos.y}`);

      // Near compound gate wall line (z around 46), camera must fly cleanly above the 4.3m pillars/gate
      if (Math.abs(outPos.z - 46.0) < 2.0 && t > 3.0 && t < 6.0) {
        passedOverGateZone = true;
        assert.ok(outPos.y > 4.5, `Camera must clear compound gate lintel at t=${t}: y=${outPos.y}`);
      }

      // When crossing over the South building wing (z in [13.2, 28.2]), camera must stay above 18.8m parapet
      if (outPos.z >= 13.2 && outPos.z <= 28.2) {
        assert.ok(
          outPos.y > 18.8,
          `Camera must fly cleanly above building roof/parapet over South wing at t=${t}: y=${outPos.y}, z=${outPos.z}`
        );
      }

      // During 6-8s, camera must fly inside the open hollow central courtyard (|x|<13, |z|<13)
      if (t >= 6.5 && t <= 8.0 && Math.abs(outPos.x) < 12.5 && Math.abs(outPos.z) < 12.5) {
        enteredOpenAtrium = true;
      }
    }

    assert.equal(passedOverGateZone, true, 'Intro camera must pass cleanly over compound entrance zone');
    assert.equal(enteredOpenAtrium, true, 'Intro camera must showcase hollow central courtyard interior');

    // Exact convergence at t=10.0s (zero snap when switching to third-person gameplay)
    sampleIntroCameraPose(INTRO_DURATION_SECONDS, exactEndPose, outPos, outLook);
    assert.ok(Math.abs(outPos.x - exactEndPose.camX) < 1e-4);
    assert.ok(Math.abs(outPos.y - exactEndPose.camY) < 1e-4);
    assert.ok(Math.abs(outPos.z - exactEndPose.camZ) < 1e-4);
    assert.ok(Math.abs(outLook.x - exactEndPose.lookX) < 1e-4);
    assert.ok(Math.abs(outLook.y - exactEndPose.lookY) < 1e-4);
    assert.ok(Math.abs(outLook.z - exactEndPose.lookZ) < 1e-4);

    // Segment captions & SURVIVE directive
    assert.equal(getIntroSegmentMeta(1.0).index, 0);
    assert.equal(getIntroSegmentMeta(3.0).index, 1);
    assert.equal(getIntroSegmentMeta(5.0).index, 2);
    assert.equal(getIntroSegmentMeta(7.0).index, 3);
    assert.equal(getIntroSegmentMeta(9.0).index, 4);
    assert.equal(getIntroSegmentMeta(9.0).showDirective, true);

    // Complete intro -> live gameplay + "SURVIVE. FIND THE EXIT." banner
    useGameStore.getState().completeIntroToGameplay();
    const playingState = useGameStore.getState();
    assert.equal(playingState.screenPhase, 'playing');
    assert.equal(playingState.inMainMenu, false);
    assert.equal(playingState.surviveBannerVisible, true);

    playingState.dismissSurviveBanner();
    assert.equal(useGameStore.getState().surviveBannerVisible, false);

    console.log('PASS H: 10-second Cinematic Environment Introduction, clearances, convergence & gameplay unlock verified.');
  }

  console.log('ALL LAST BREATH IDENTITY, EXIT MENU, FULL RESTART, DURATION, INTRO & CONTROLS TESTS PASSED!');
}

void runLastBreathFlowTests();
