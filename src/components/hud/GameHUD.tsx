import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  Footprints,
  Gamepad2,
  Home,
  KeyRound,
  Lightbulb,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getCurrentObjective,
  getStageFromProgression,
  MAX_RESPAWNS,
  useGameStore,
} from '../../store/useGameStore';
import { ALL_DOORS, BUILDING_FLOORS, getRoomById } from '../../data/buildingLayout';
import { PUZZLE_CATEGORY_SPECS } from '../../data/puzzleConfig';
import {
  initAudioContext,
  playFloorSwitchSound,
  playMenuClickSound,
} from '../../three/soundEffects';
import { FloorNumber } from '../../types/game';
import { KeyCellKeypadModal } from './KeyCellKeypadModal';
import { PuzzleInterface } from './PuzzleInterface';
import { AudioSettingsPanel, ControlsGuidePanel } from './SettingsControlsPanels';
import { TouchControlsOverlay } from './TouchControlsOverlay';

export const GameHUD: React.FC = () => {
  const inMainMenu = useGameStore((s) => s.inMainMenu);
  const screenPhase = useGameStore((s) => s.screenPhase);
  const progression = useGameStore((s) => s.progression);
  const gameOverReason = useGameStore((s) => s.gameOverReason);
  const respawnsRemaining = useGameStore((s) => s.respawnsRemaining);
  const permanentGameOver = useGameStore((s) => s.permanentGameOver);
  const keyReturnedOnCatch = useGameStore((s) => s.keyReturnedOnCatch);
  const gamePaused = useGameStore((s) => s.gamePaused);
  const controlMode = useGameStore((s) => s.controlMode);
  const playerFloor = useGameStore((s) => s.playerFloor);
  const hasEnteredApartment = useGameStore((s) => s.hasEnteredApartment);
  const beasts = useGameStore((s) => s.beasts);
  const beastFloor = useGameStore((s) => s.beastFloor);
  const beastAiMode = useGameStore((s) => s.beastAiMode);
  const beastDistance = useGameStore((s) => s.beastDistance);
  const beastThreatLabel = useGameStore((s) => s.beastThreatLabel);
  const beastLastKnownFloor = useGameStore((s) => s.beastLastKnownFloor);
  const beastCapturing = useGameStore((s) => s.beastCapturing);
  const emergencyAlarmActive = useGameStore((s) => s.emergencyAlarmActive);
  const securityBreachBannerVisible = useGameStore((s) => s.securityBreachBannerVisible);
  const dismissSecurityBreachBanner = useGameStore((s) => s.dismissSecurityBreachBanner);
  const surviveBannerVisible = useGameStore((s) => s.surviveBannerVisible);
  const dismissSurviveBanner = useGameStore((s) => s.dismissSurviveBanner);
  const playerHiddenSpotId = useGameStore((s) => s.playerHiddenSpotId);
  const puzzleProtectionActive = useGameStore((s) => s.puzzleProtectionActive);
  const puzzleTimerExpired = useGameStore((s) => s.puzzleTimerExpired);
  const safeRoomUnlocked = useGameStore((s) => s.safeRoomUnlocked);
  const pointerLocked = useGameStore((s) => s.pointerLocked);
  const interactionPrompt = useGameStore((s) => s.interactionPrompt);
  const doorFeedback = useGameStore((s) => s.doorFeedback);
  const clearDoorFeedback = useGameStore((s) => s.clearDoorFeedback);

  const activeFloor = useGameStore((s) => s.activeFloor);
  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const cameraViewMode = useGameStore((s) => s.cameraViewMode);
  const cutawayMode = useGameStore((s) => s.cutawayMode);
  const ceilingLightsOn = useGameStore((s) => s.ceilingLightsOn);
  const audioEnabled = useGameStore((s) => s.audioEnabled);

  const hasMissionRoomKey = useGameStore((s) => s.hasMissionRoomKey);
  const hasPuzzleRoomKey = useGameStore((s) => s.hasPuzzleRoomKey);
  const hasFalsePuzzleKey = useGameStore((s) => s.hasFalsePuzzleKey);

  const keyCells = useGameStore((s) => s.keyCells);
  const missionRoomEntered = useGameStore((s) => s.missionRoomEntered);

  const puzzleRoomEntered = useGameStore((s) => s.puzzleRoomEntered);
  const beastAlerted = useGameStore((s) => s.beastAlerted);
  const selectedPuzzleCategory = useGameStore((s) => s.selectedPuzzleCategory);
  const categoryLocked = useGameStore((s) => s.categoryLocked);
  const puzzleTimerSeconds = useGameStore((s) => s.puzzleTimerSeconds);
  const puzzleTimerRunning = useGameStore((s) => s.puzzleTimerRunning);
  const puzzleWarning = useGameStore((s) => s.puzzleWarning);
  const allPuzzlesCompleted = useGameStore((s) => s.allPuzzlesCompleted);

  const finalExitUnlocked = useGameStore((s) => s.finalExitUnlocked);
  const escapeAnimating = useGameStore((s) => s.escapeAnimating);
  const escaped = useGameStore((s) => s.escaped);
  const missionRoomNumber = useGameStore((s) => s.missionRoomNumber);
  const puzzleRoomNumber = useGameStore((s) => s.puzzleRoomNumber);
  const puzzleFloor = useGameStore((s) => s.puzzleFloor);

  const selectedRoomId = useGameStore((s) => s.selectedRoomId);
  const hoveredDoorId = useGameStore((s) => s.hoveredDoorId);
  const hudCollapsed = useGameStore((s) => s.hudCollapsed);

  const toggleGamePaused = useGameStore((s) => s.toggleGamePaused);
  const setControlMode = useGameStore((s) => s.setControlMode);
  const openPuzzleModal = useGameStore((s) => s.openPuzzleModal);
  const tickPuzzleTimer = useGameStore((s) => s.tickPuzzleTimer);
  const recoverFromBeastCatch = useGameStore((s) => s.recoverFromBeastCatch);
  const resetNewGame = useGameStore((s) => s.resetNewGame);
  const returnToMainMenu = useGameStore((s) => s.returnToMainMenu);

  const selectFloor = useGameStore((s) => s.selectFloor);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const setCameraViewMode = useGameStore((s) => s.setCameraViewMode);
  const toggleCutawayMode = useGameStore((s) => s.toggleCutawayMode);
  const toggleCeilingLights = useGameStore((s) => s.toggleCeilingLights);
  const toggleAudio = useGameStore((s) => s.toggleAudio);
  const selectRoom = useGameStore((s) => s.selectRoom);
  const toggleHudCollapsed = useGameStore((s) => s.toggleHudCollapsed);
  const resetView = useGameStore((s) => s.resetView);

  const [pauseTab, setPauseTab] = useState<'main' | 'settings' | 'controls'>('main');
  const [hudVisible, setHudVisible] = useState(false);

  const selectedRoom = getRoomById(selectedRoomId);
  const hoveredDoor = hoveredDoorId ? ALL_DOORS.find((d) => d.id === hoveredDoorId) : undefined;
  const activeCategorySpec = selectedPuzzleCategory
    ? PUZZLE_CATEGORY_SPECS[selectedPuzzleCategory]
    : null;

  const currentStage = getStageFromProgression(progression);
  const currentObjective = getCurrentObjective({
    progression,
    hasPuzzleRoomKey,
    puzzleRoomEntered,
    allPuzzlesCompleted,
    finalExitUnlocked,
    safeRoomUnlocked,
    puzzleTimerExpired,
  });
  const unlockedCellsCount =
    (keyCells['cell-a'].unlocked ? 1 : 0) + (keyCells['cell-b'].unlocked ? 1 : 0);

  useEffect(() => {
    if (!gamePaused) {
      setPauseTab('main');
    }
  }, [gamePaused]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const st = useGameStore.getState();
      if (st.inMainMenu) return;

      const key = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (
          st.escaped ||
          st.escapeAnimating ||
          st.beastCapturing ||
          st.progression === 'PLAYER_CAUGHT' ||
          st.activeKeyCellModal ||
          st.puzzleModalOpen
        ) {
          return;
        }
        initAudioContext();
        playMenuClickSound(false, st.audioEnabled);
        toggleGamePaused();
        return;
      }
      if (key === 'p') {
        if (
          st.escaped ||
          st.escapeAnimating ||
          st.beastCapturing ||
          st.progression === 'PLAYER_CAUGHT'
        ) {
          return;
        }
        initAudioContext();
        playMenuClickSound(false, st.audioEnabled);
        toggleGamePaused();
        return;
      }
      if (key === 'h') {
        toggleHudCollapsed();
        return;
      }
      if (controlMode !== 'orbit') return;
      if (key === '0') {
        playFloorSwitchSound(audioEnabled);
        selectFloor('all');
      } else if (key === '1' || key === '2' || key === '3' || key === '4') {
        playFloorSwitchSound(audioEnabled);
        selectFloor(Number(key) as FloorNumber);
      } else if (key === 'c') {
        toggleCutawayMode();
      } else if (key === 'r') {
        resetView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [audioEnabled, controlMode, resetView, selectFloor, toggleCutawayMode, toggleGamePaused, toggleHudCollapsed]);

  // Global 5-minute Puzzle Room countdown loop (persists while modal is closed, freezes only on Pause/Menu/End)
  useEffect(() => {
    if (
      inMainMenu ||
      gamePaused ||
      !puzzleTimerRunning ||
      allPuzzlesCompleted ||
      escaped ||
      progression === 'PLAYER_CAUGHT'
    ) {
      return;
    }
    const id = window.setInterval(() => {
      tickPuzzleTimer();
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    allPuzzlesCompleted,
    escaped,
    gamePaused,
    inMainMenu,
    progression,
    puzzleTimerRunning,
    tickPuzzleTimer,
  ]);

  useEffect(() => {
    if (!doorFeedback) return;
    const id = window.setTimeout(() => {
      clearDoorFeedback();
    }, 2800);
    return () => window.clearTimeout(id);
  }, [clearDoorFeedback, doorFeedback]);

  // Auto-dismiss large Security Breach banner after 7.5s while keeping compact ALARM ACTIVE badge
  useEffect(() => {
    if (!securityBreachBannerVisible) return;
    const id = window.setTimeout(() => {
      dismissSecurityBreachBanner();
    }, 7500);
    return () => window.clearTimeout(id);
  }, [dismissSecurityBreachBanner, securityBreachBannerVisible]);

  // Smooth HUD fade-in when entering live gameplay after intro/briefing
  useEffect(() => {
    if (inMainMenu || screenPhase !== 'playing') {
      setHudVisible(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      setHudVisible(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [inMainMenu, screenPhase]);

  // Auto-dismiss "SURVIVE. FIND THE EXIT." opening directive after 3.8s
  useEffect(() => {
    if (!surviveBannerVisible) return;
    const id = window.setTimeout(() => {
      dismissSurviveBanner();
    }, 3800);
    return () => window.clearTimeout(id);
  }, [dismissSurviveBanner, surviveBannerVisible]);

  if (inMainMenu || screenPhase !== 'playing') return null;

  const mins = String(Math.floor(puzzleTimerSeconds / 60)).padStart(2, '0');
  const secs = String(puzzleTimerSeconds % 60).padStart(2, '0');

  const activeFloorMeta =
    controlMode !== 'orbit'
      ? !hasEnteredApartment
        ? {
            title: 'Exterior Approach',
            subtitle: 'Abandoned City Street & Compound · Enter LAST BREATH',
          }
        : {
            title: `Floor 0${playerFloor}`,
            subtitle:
              BUILDING_FLOORS.find((f) => f.floor === playerFloor)?.name ?? 'Apartment Complex',
          }
      : activeFloor === 'all'
      ? { title: 'Apartment Complex', subtitle: '4 Floors · 80 Apartments · Hollow Atrium' }
      : {
          title: BUILDING_FLOORS.find((f) => f.floor === activeFloor)?.name ?? `Floor ${activeFloor}`,
          subtitle: BUILDING_FLOORS.find((f) => f.floor === activeFloor)?.subtitle ?? '',
        };

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-3 transition-opacity duration-700 ${
          hudVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* TOP ROW: Inventory & Objectives Panel (Left) + Active Room / Alert Status & Pause (Right) */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          {/* Top-Left: Compact Corner Stage, Floor, Dynamic Objective, Inventory Keys & Beast Telemetry */}
          <div className="pointer-events-auto w-full max-w-[268px] rounded-md border border-slate-700/85 bg-[#0b121c]/90 px-2.5 py-1.5 shadow-lg">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <h1 className="font-display text-xs font-bold tracking-wider text-slate-100 whitespace-nowrap">
                  LAST BREATH
                </h1>
                <span className="font-mono-tech text-[10px] font-semibold text-sky-400 truncate">
                  {activeFloorMeta.title}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  data-testid="hud-respawns-counter"
                  className={`font-mono-tech rounded border px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${
                    respawnsRemaining === 0
                      ? 'border-red-500/70 bg-red-500/20 text-red-300'
                      : respawnsRemaining === 1
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                      : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {respawnsRemaining}/{MAX_RESPAWNS}
                </span>
                <span className="font-mono-tech rounded border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 whitespace-nowrap">
                  S{currentStage}/4
                </span>
              </div>
            </div>

            <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-300">
              {activeFloorMeta.subtitle}
            </p>

            {/* Dynamic Current Objective */}
            <div className="mt-1 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[10px] leading-tight">
              <span className="font-semibold text-sky-300">Objective: </span>
              <span className="font-medium text-slate-100">{currentObjective}</span>
            </div>

            {/* Key Inventory & Milestones Grid */}
            <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-slate-800/90 pt-1.5 text-[9px]">
              <div className="flex items-center justify-between rounded border border-slate-800 bg-[#101824] px-1.5 py-0.5">
                <span className="flex items-center gap-1 text-slate-300">
                  <KeyRound className="h-2.5 w-2.5 text-amber-400" />
                  Mission
                </span>
                <span className="font-mono-tech font-bold text-amber-300">
                  {hasMissionRoomKey ? 'HELD' : 'NONE'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded border border-slate-800 bg-[#101824] px-1.5 py-0.5">
                <span className="flex items-center gap-1 text-slate-300">
                  <KeyRound className="h-2.5 w-2.5 text-sky-400" />
                  Puzzle
                </span>
                <span
                  className={`font-mono-tech font-bold ${
                    hasPuzzleRoomKey ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {hasPuzzleRoomKey ? 'HELD' : 'LOCKED'}
                </span>
              </div>

              {hasFalsePuzzleKey && (
                <div className="col-span-2 flex items-center justify-between rounded border border-amber-500/40 bg-[#101824] px-1.5 py-0.5">
                  <span className="flex items-center gap-1 text-slate-300">
                    <KeyRound className="h-2.5 w-2.5 text-slate-400" />
                    Unverified Key
                  </span>
                  <span className="font-mono-tech font-bold text-amber-300">HELD</span>
                </div>
              )}

              <div className="flex items-center justify-between rounded border border-slate-800 bg-[#101824] px-1.5 py-0.5">
                <span className="text-slate-300">Cells</span>
                <span
                  className={`font-mono-tech font-bold ${
                    hasPuzzleRoomKey
                      ? 'text-emerald-400'
                      : missionRoomEntered
                      ? 'text-amber-300'
                      : 'text-slate-500'
                  }`}
                >
                  {hasPuzzleRoomKey ? 'VERIFIED' : `${unlockedCellsCount}/2`}
                </span>
              </div>

              <div className="flex items-center justify-between rounded border border-slate-800 bg-[#101824] px-1.5 py-0.5">
                <span className="text-slate-300">Trial</span>
                <span
                  className={`font-mono-tech font-bold ${
                    allPuzzlesCompleted
                      ? 'text-emerald-400'
                      : puzzleRoomEntered
                      ? 'text-sky-300'
                      : 'text-slate-500'
                  }`}
                >
                  {allPuzzlesCompleted ? '1/1 DONE' : puzzleRoomEntered ? 'ACTIVE' : 'LOCKED'}
                </span>
              </div>
            </div>

            {/* Safe Room Exit & 4-Hunter Squad Telemetry */}
            <div className="mt-1 flex items-center justify-between gap-1.5 border-t border-slate-800/90 pt-1 text-[9px]">
              <span className="flex items-center gap-1 truncate">
                {safeRoomUnlocked || finalExitUnlocked ? (
                  <Unlock className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
                ) : (
                  <Lock className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                )}
                <span
                  className={
                    safeRoomUnlocked || finalExitUnlocked
                      ? 'font-bold text-emerald-400 truncate'
                      : 'text-slate-400 truncate'
                  }
                >
                  Safe Room:{' '}
                  {safeRoomUnlocked || finalExitUnlocked ? 'UNLOCKED' : 'SEALED'}
                </span>
              </span>

              {emergencyAlarmActive && (
                <span className="font-mono-tech shrink-0 rounded border border-red-500/70 bg-red-500/20 px-1 py-0.5 text-[8px] font-bold text-red-300">
                  ALARM
                </span>
              )}
            </div>

            {/* 4 Warrior Hunters Live Telemetry Grid */}
            <div className="mt-1 grid grid-cols-2 gap-0.5 text-[9px]">
              {beasts.map((b) => {
                const modeColor =
                  b.mode === 'chase' || b.mode === 'detect' || b.mode === 'capture'
                    ? 'border-red-500/50 text-red-300'
                    : b.mode === 'investigate'
                    ? 'border-orange-500/40 text-orange-300'
                    : b.mode === 'search'
                    ? 'border-sky-500/40 text-sky-300'
                    : 'border-slate-800 text-slate-300';
                return (
                  <div
                    key={b.id}
                    className={`font-mono-tech flex items-center justify-between rounded border bg-[#0d1522] px-1.5 py-0.5 ${modeColor}`}
                  >
                    <span className="font-bold truncate">{b.name}</span>
                    <span className="shrink-0">
                      F{b.floor}·{b.mode.slice(0, 3).toUpperCase()}·{b.distance.toFixed(0)}m
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] text-slate-400">
              <span className="truncate">
                Closest: F{beastFloor} · {beastAiMode.toUpperCase()} ({beastDistance.toFixed(0)}m) ·{' '}
                {beastThreatLabel}
              </span>
              {beastLastKnownFloor && (beastAiMode === 'search' || beastAiMode === 'investigate') && (
                <span className="font-mono-tech shrink-0 text-sky-300">F{beastLastKnownFloor}</span>
              )}
            </div>
          </div>

          {/* Top-Center: Opening Survival Banner or Urgent Security Breach Banner */}
          {surviveBannerVisible && !escaped && progression !== 'PLAYER_CAUGHT' && (
            <div
              data-testid="gameplay-survive-banner"
              className="pointer-events-none mx-auto rounded-lg border border-amber-500/55 bg-[#0b121c]/95 px-6 py-2.5 text-center shadow-2xl"
            >
              <div className="font-display text-sm sm:text-base font-bold tracking-[0.22em] text-amber-300 uppercase">
                SURVIVE. FIND THE EXIT.
              </div>
            </div>
          )}

          {securityBreachBannerVisible && !escaped && progression !== 'PLAYER_CAUGHT' && (
            <div className="pointer-events-none mx-auto max-w-lg rounded-lg border-2 border-red-500 bg-[#1a070b] px-5 py-2.5 text-center shadow-2xl">
              <div className="flex items-center justify-center gap-2 text-red-400">
                <ShieldAlert className="h-5 w-5" />
                <span className="font-display text-sm sm:text-base font-bold tracking-widest text-red-200">
                  SECURITY BREACH — ALL HUNTERS ACTIVATED
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-red-200/90">
                Genuine Puzzle Room Key removed — all 4 Hunters are converging on the Mission Room!
              </p>
            </div>
          )}

          {/* Top-Right: Dedicated Pause Button + Stage-Specific Active Alerts & Consoles */}
          <div className="flex flex-col items-end gap-2">
            {controlMode !== 'orbit' && !escaped && !escapeAnimating && progression !== 'PLAYER_CAUGHT' && (
              <button
                type="button"
                data-testid="hud-pause-btn"
                onClick={() => {
                  initAudioContext();
                  playMenuClickSound(false, audioEnabled);
                  toggleGamePaused();
                }}
                className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-600/90 bg-[#0b121c]/92 px-3.5 py-2 text-xs font-bold tracking-wider text-slate-100 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer shadow-lg"
              >
                <Pause className="h-3.5 w-3.5 text-amber-400" />
                <span>PAUSE</span>
                <span className="font-mono-tech hidden sm:inline text-[10px] text-slate-400">[P]</span>
              </button>
            )}
            {puzzleRoomEntered && !allPuzzlesCompleted && (
              <div
                className={`pointer-events-auto rounded-lg border bg-[#0b121c] px-4 py-2.5 shadow-xl ${
                  puzzleTimerExpired
                    ? 'border-red-500'
                    : puzzleTimerSeconds <= 30
                    ? 'border-red-500/80'
                    : puzzleTimerSeconds <= 60
                    ? 'border-amber-500/80'
                    : 'border-sky-500/60'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`h-4 w-4 ${
                        puzzleTimerExpired || puzzleTimerSeconds <= 30
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}
                    />
                    <span className="font-display text-sm font-bold tracking-wide text-sky-300 whitespace-nowrap">
                      PUZZLE CHALLENGE TIMER
                    </span>
                  </div>
                  {beastAlerted && (
                    <span className="font-mono-tech text-xs font-semibold text-red-400 whitespace-nowrap">
                      4 Hunters Outside
                    </span>
                  )}
                  <span
                    className={`font-mono-tech rounded px-2 py-0.5 text-xs font-bold ${
                      puzzleTimerExpired || puzzleTimerSeconds <= 30
                        ? 'bg-red-500/20 text-red-300'
                        : puzzleTimerSeconds <= 60
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-sky-500/15 text-sky-200'
                    }`}
                  >
                    {mins}:{secs}
                  </span>
                </div>

                {/* Puzzle Room Protection Barrier Status */}
                <div
                  className={`mt-1.5 flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                    puzzleProtectionActive
                      ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                      : 'border-red-500/70 bg-red-500/20 text-red-200'
                  }`}
                >
                  {puzzleProtectionActive ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                      PUZZLE ROOM PROTECTED — HUNTERS BLOCKED OUTSIDE
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      PROTECTION FAILED — HUNTERS BREACHING ROOM!
                    </>
                  )}
                </div>

                {!puzzleTimerExpired &&
                  (puzzleWarning === '60s' || puzzleWarning === '30s' || puzzleTimerSeconds <= 60) && (
                    <div
                      className={`mt-1.5 rounded px-2.5 py-1 text-[11px] font-bold tracking-wide ${
                        puzzleTimerSeconds <= 30
                          ? 'border border-red-500/50 bg-red-500/15 text-red-200'
                          : 'border border-amber-500/50 bg-amber-500/15 text-amber-200'
                      }`}
                    >
                      {puzzleTimerSeconds <= 30
                        ? 'CRITICAL WARNING: UNDER 30 SECONDS BEFORE BARRIER DROPS!'
                        : 'WARNING: 60 SECONDS REMAINING — COMPLETE CHALLENGE!'}
                    </div>
                  )}

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-800 pt-2 text-xs">
                  <span className="font-mono-tech text-slate-300">
                    {categoryLocked && activeCategorySpec
                      ? `Mode: ${activeCategorySpec.shortTitle}`
                      : 'Select 1 Puzzle Category'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openPuzzleModal()}
                    className="flex items-center gap-1 rounded bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap"
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    Open Puzzle Console
                  </button>
                </div>
              </div>
            )}

            {(safeRoomUnlocked || finalExitUnlocked) && !escaped && !escapeAnimating && (
              <div className="pointer-events-auto max-w-sm rounded-lg border border-emerald-500/70 bg-[#0b121c] px-4 py-2.5 shadow-xl">
                <div className="flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-display text-sm font-bold tracking-wide">
                    CHALLENGE COMPLETED
                  </span>
                </div>
                <div className="mt-1 font-mono-tech text-[11px] font-bold text-emerald-300">
                  REACH THE SAFE ROOM AND ESCAPE
                </div>
                <p className="mt-1 text-xs text-slate-200">
                  {puzzleFloor === 1
                    ? 'Enter the open Safe Room doorway at the rear of the Puzzle Room and proceed straight to the Floor 1 Ground Exit.'
                    : 'Enter the open Safe Room doorway at the rear of the Puzzle Room and descend the Emergency Descent stairwell to the Floor 1 Ground Exit.'}
                </p>
              </div>
            )}

            {/* Orbit Hover / Selection Readout */}
            {controlMode === 'orbit' && (hoveredDoor || selectedRoom) && (
              <div className="pointer-events-auto max-w-xs rounded-lg border border-slate-700/80 bg-[#0b121c] px-3.5 py-2.5 shadow-lg">
                {hoveredDoor ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-sm font-semibold text-amber-400 whitespace-nowrap">
                        {hoveredDoor.label}
                      </span>
                      <span className="font-mono-tech text-xs text-slate-300">
                        F{hoveredDoor.floor}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {hoveredDoor.isInteriorEscape
                        ? 'Interior Security Escape Door — unlocks after completing all puzzles.'
                        : 'Apartment entrance door — inspect and try keys in First-Person.'}
                    </p>
                  </div>
                ) : selectedRoom ? (
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-display text-sm font-semibold text-sky-300 whitespace-nowrap">
                        {selectedRoom.code} · {selectedRoom.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => selectRoom(null)}
                        className="text-xs text-slate-400 hover:text-slate-100"
                      >
                        Close
                      </button>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {selectedRoom.description}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* CENTER RETICLE, DOOR FEEDBACK TOAST & CONTEXTUAL INTERACTION PROMPT */}
        {controlMode !== 'orbit' && !escaped && !escapeAnimating && (
          <div className="flex flex-col items-center justify-center gap-2.5">
            {pointerLocked && (
              <div className="h-1 w-1 rounded-full bg-white/70 ring-1 ring-slate-950/60" />
            )}
            {doorFeedback && (
              <div
                className={`rounded-md border px-4 py-1.5 text-xs font-bold tracking-wide shadow-xl ${
                  doorFeedback.tone === 'error'
                    ? 'border-red-500/70 bg-[#0b121c] text-red-300'
                    : doorFeedback.tone === 'success'
                    ? 'border-emerald-500/70 bg-[#0b121c] text-emerald-300'
                    : 'border-sky-500/70 bg-[#0b121c] text-sky-300'
                }`}
              >
                {doorFeedback.text}
              </div>
            )}
            {interactionPrompt && (
              <div
                className={`rounded-md border px-4 py-1.5 text-xs font-bold tracking-wider shadow-lg ${
                  interactionPrompt.includes('LOCKED')
                    ? 'border-red-500/60 bg-[#0b121c] text-red-300'
                    : 'border-amber-400/70 bg-[#0b121c] text-amber-300'
                }`}
              >
                {interactionPrompt}
              </div>
            )}
          </div>
        )}

        {/* Cinematic Escape Banner */}
        {escapeAnimating && (
          <div className="flex flex-col items-center justify-center">
            <div className="rounded-lg border border-emerald-400/70 bg-[#0b121c] px-5 py-2.5 text-center shadow-2xl">
              <div className="font-display text-base font-bold tracking-widest text-emerald-400">
                ESCAPE PASSAGE BREACHED
              </div>
              <div className="mt-0.5 text-xs text-slate-300">
                Exiting through the Puzzle Room security escape corridor...
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM CENTER: Controls Hint + Collapsible Unified Control Dock */}
        <div className="flex flex-col items-center">
          {controlMode !== 'orbit' && !hudCollapsed && !escapeAnimating && (
            <div className="mb-1 hidden sm:block rounded-md border border-slate-700/70 bg-[#0b121c]/90 px-3 py-1 text-[11px] text-slate-300">
              {playerHiddenSpotId
                ? 'CONCEALED · Move Mouse to Peek · Press E to Exit Hiding · P Pause'
                : pointerLocked
                ? 'WASD Move · Shift Sprint · C Crouch · Space Jump · E Interact / Hide · P Pause · Esc Release'
                : 'Click 3D view to Rotate Camera · WASD Move · C Crouch · Space Jump · E Interact · P Pause'}
            </div>
          )}

          {controlMode === 'orbit' && (
            <>
              <button
                type="button"
                onClick={toggleHudCollapsed}
                aria-label={hudCollapsed ? 'Show Controls' : 'Hide Controls'}
                className="pointer-events-auto mb-1.5 flex items-center gap-1.5 rounded-t-md border border-b-0 border-slate-700/80 bg-[#0b121c] px-3 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                {hudCollapsed ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span>{hudCollapsed ? 'Show Controls (H)' : 'Hide Controls (H)'}</span>
              </button>

              {!hudCollapsed && (
                <div className="pointer-events-auto w-full max-w-[1040px] rounded-xl border border-slate-700/85 bg-[#0b121c] px-3 py-2.5 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* 1. Primary Mode Toggle: Third-Person Play vs Orbit Inspect */}
                    <div className="flex items-center gap-1 rounded-lg bg-[#131d2b] p-1">
                      <button
                        type="button"
                        onClick={() => setControlMode('third-person')}
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <Footprints className="h-3.5 w-3.5" />
                        Third-Person
                      </button>
                      <button
                        type="button"
                        onClick={() => setControlMode('orbit')}
                        className="flex items-center gap-1.5 rounded-md bg-sky-500 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-950 transition-colors"
                      >
                        <Compass className="h-3.5 w-3.5" />
                        Orbit Inspect
                      </button>
                    </div>

                    {/* 2. Orbit Inspect Navigation Controls */}
                    <div className="flex items-center gap-1 rounded-lg bg-[#131d2b] p-1">
                      <button
                        type="button"
                        onClick={() => {
                          playFloorSwitchSound(audioEnabled);
                          selectFloor('all');
                        }}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                          activeFloor === 'all'
                            ? 'bg-sky-500 font-semibold text-slate-950'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        All 4
                      </button>
                      {([1, 2, 3, 4] as FloorNumber[]).map((fl) => (
                        <button
                          key={fl}
                          type="button"
                          onClick={() => {
                            playFloorSwitchSound(audioEnabled);
                            selectFloor(fl);
                          }}
                          className={`font-mono-tech rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                            activeFloor === fl
                              ? 'bg-sky-500 font-semibold text-slate-950'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          F{fl}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 rounded-lg bg-[#131d2b] p-1">
                      <button
                        type="button"
                        onClick={() => setCameraPreset('exit-gate')}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                          cameraPreset === 'exit-gate'
                            ? 'bg-emerald-500 font-semibold text-slate-950'
                            : 'text-emerald-300 hover:bg-slate-800'
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Exit Gate
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCameraViewMode(
                            cameraViewMode === 'orbit' ? 'walkthrough' : 'orbit'
                          )
                        }
                        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                      >
                        {cameraViewMode === 'orbit' ? 'Orbit Cam' : 'Corridor Eye'}
                      </button>
                    </div>

                    {/* 3. Shared Environment Controls & New Game Reset */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleCutawayMode}
                        title="Toggle Cutaway / Enclosed Shell (C)"
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                          cutawayMode
                            ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
                            : 'border-slate-700 bg-[#131d2b] text-slate-300 hover:text-white'
                        }`}
                      >
                        {cutawayMode ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                        {cutawayMode ? 'Cutaway' : 'Enclosed'}
                      </button>

                  <button
                    type="button"
                    onClick={toggleCeilingLights}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      ceilingLightsOn
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                        : 'border-slate-700 bg-[#131d2b] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    Lights
                  </button>

                  <button
                    type="button"
                    onClick={toggleAudio}
                    aria-label="Toggle Sound Effects"
                    className="flex items-center justify-center rounded-lg border border-slate-700 bg-[#131d2b] p-1.5 text-slate-300 hover:text-white"
                  >
                    {audioEnabled ? (
                      <Volume2 className="h-4 w-4 text-sky-400" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      initAudioContext();
                      playMenuClickSound(false, audioEnabled);
                      toggleGamePaused();
                    }}
                    title="Pause / Resume AI & Timers (P / Esc)"
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      gamePaused
                        ? 'border-amber-400 bg-amber-500 font-semibold text-slate-950'
                        : 'border-slate-700 bg-[#131d2b] text-slate-300 hover:text-white'
                    }`}
                  >
                    {gamePaused ? (
                      <Play className="h-3.5 w-3.5" />
                    ) : (
                      <Pause className="h-3.5 w-3.5" />
                    )}
                    {gamePaused ? 'Resume' : 'Pause'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      initAudioContext();
                      playMenuClickSound(true, audioEnabled);
                      resetNewGame();
                    }}
                    title="Reset New Game"
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#131d2b] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-amber-500/60 hover:text-white whitespace-nowrap"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    New Game
                  </button>

                      <button
                        type="button"
                        onClick={resetView}
                        aria-label="Reset Camera View"
                        className="flex items-center justify-center rounded-lg border border-slate-700 bg-[#131d2b] p-1.5 text-slate-300 hover:text-white"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hiding Concealment Slats Frame (no backdrop-blur over WebGL) */}
      {playerHiddenSpotId &&
        controlMode !== 'orbit' &&
        !escaped &&
        progression !== 'PLAYER_CAUGHT' && (
          <div className="pointer-events-none fixed inset-0 z-15">
            <div className="absolute inset-y-0 left-0 w-16 sm:w-28 bg-black/70 border-r border-slate-800/80" />
            <div className="absolute inset-y-0 right-0 w-16 sm:w-28 bg-black/70 border-l border-slate-800/80" />
            <div className="absolute inset-x-0 top-0 h-14 bg-black/55" />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-black/55" />
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-md border border-amber-400/70 bg-[#0b121c] px-4 py-1.5 text-center shadow-xl">
              <div className="font-mono-tech text-xs font-bold tracking-widest text-amber-300">
                CONCEALED — PRESS E TO EXIT HIDING
              </div>
            </div>
          </div>
        )}

      {/* Stage 2 Key Cell Keypad */}
      <KeyCellKeypadModal />

      {/* Stage 3 Interactive Puzzle Room Console */}
      <PuzzleInterface />

      {/* Explicit Game Pause Menu Overlay */}
      {gamePaused && progression !== 'PLAYER_CAUGHT' && !escaped && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0b121c] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="font-mono-tech text-[10px] font-bold tracking-[0.2em] text-amber-400">
                  LAST BREATH
                </div>
                <h2 className="font-display text-2xl font-bold tracking-wider text-white">
                  {pauseTab === 'settings'
                    ? 'SETTINGS & AUDIO'
                    : pauseTab === 'controls'
                    ? 'CONTROLS GUIDE'
                    : 'GAME PAUSED'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  All 4 Warrior Hunters, alarm sirens, and puzzle timers are suspended.
                </p>
              </div>
              {pauseTab !== 'main' && (
                <button
                  type="button"
                  onClick={() => {
                    playMenuClickSound(false, audioEnabled);
                    setPauseTab('main');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#131d2b] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}
            </div>

            {pauseTab === 'main' && (
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    initAudioContext();
                    playMenuClickSound(true, audioEnabled);
                    toggleGamePaused();
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Resume Game (P / Esc)
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      initAudioContext();
                      playMenuClickSound(false, audioEnabled);
                      setPauseTab('settings');
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#131d2b] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:border-sky-400/70"
                  >
                    <Sliders className="h-4 w-4 text-sky-400" />
                    Settings &amp; Audio
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      initAudioContext();
                      playMenuClickSound(false, audioEnabled);
                      setPauseTab('controls');
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#131d2b] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:border-amber-400/70"
                  >
                    <Gamepad2 className="h-4 w-4 text-amber-400" />
                    Controls
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      initAudioContext();
                      playMenuClickSound(true, audioEnabled);
                      resetNewGame();
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#131d2b] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-amber-500/60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Restart Game
                  </button>

                  <button
                    type="button"
                    data-testid="pause-lobby-btn"
                    onClick={() => {
                      playMenuClickSound(false, audioEnabled);
                      returnToMainMenu();
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0d1520] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-red-500/60 hover:text-red-300"
                  >
                    <Home className="h-3.5 w-3.5" />
                    Return to Lobby
                  </button>
                </div>
              </div>
            )}

            {pauseTab === 'settings' && (
              <div className="mt-4">
                <AudioSettingsPanel />
              </div>
            )}

            {pauseTab === 'controls' && (
              <div className="mt-4">
                <ControlsGuidePanel />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Capture Sequence Frame */}
      {beastCapturing && (
        <div className="pointer-events-none fixed inset-0 z-35 border-4 border-red-500/80 bg-red-950/25">
          <div className="flex h-full items-end justify-center pb-24">
            <div className="rounded-lg border border-red-500/80 bg-[#0b121c] px-5 py-2 text-center shadow-2xl">
              <div className="font-display text-base font-bold tracking-widest text-red-400">
                HUNTER INTERCEPTION
              </div>
              <div className="text-xs text-slate-200">Movement locked — warrior hunter closed the distance.</div>
            </div>
          </div>
        </div>
      )}

      {/* Warrior Hunters Game Over / Respawn Modal */}
      {progression === 'PLAYER_CAUGHT' && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/70 bg-[#0b121c] p-6 text-center shadow-2xl">
            <div className="font-mono-tech mb-1 text-[10px] font-bold tracking-[0.22em] text-slate-400">
              LAST BREATH
            </div>
            <div className="flex items-center justify-center gap-2 text-red-400">
              <ShieldAlert className="h-7 w-7" />
              <h2 className="font-display text-2xl font-bold tracking-wider">
                {permanentGameOver || respawnsRemaining <= 0 ? 'PERMANENT GAME OVER' : 'GAME OVER'}
              </h2>
            </div>

            <div className="mt-1 font-mono-tech text-xs font-semibold tracking-wider text-red-300">
              {permanentGameOver || respawnsRemaining <= 0
                ? 'ALL 3 RESPAWNS EXHAUSTED — SESSION TERMINATED'
                : gameOverReason === 'puzzle-timeout'
                ? 'CONTAINMENT FAILED — HUNTERS BREACHED PUZZLE ROOM'
                : 'CAPTURED BY WARRIOR HUNTER'}
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-700 bg-[#070d16] px-3 py-1 font-mono-tech text-xs font-bold">
              <span className="text-slate-400">RESPAWNS:</span>
              <span className={respawnsRemaining === 0 ? 'text-red-400' : 'text-amber-300'}>
                {respawnsRemaining}/{MAX_RESPAWNS}
              </span>
            </div>

            {keyReturnedOnCatch && !(permanentGameOver || respawnsRemaining <= 0) && (
              <div className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-200">
                KEY SECURITY PROTOCOL: Your genuine Puzzle Room Key was returned to Mission Room Cell A. Collect it again after respawning.
              </div>
            )}

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {permanentGameOver || respawnsRemaining <= 0
                ? 'You have exhausted all three respawns for this session. Restart the game to reset all progression and restore 3/3 respawns.'
                : gameOverReason === 'puzzle-timeout'
                ? 'The 5-minute Puzzle Room barrier dropped and the Hunters breached the chamber. Use one of your remaining respawns to retry from Floor 1.'
                : 'One of the four Warrior Hunters intercepted you inside the facility. Use corridor hiding spots to evade pursuit and respawn at Floor 1.'}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {!(permanentGameOver || respawnsRemaining <= 0) ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      initAudioContext();
                      playMenuClickSound(true, audioEnabled);
                      recoverFromBeastCatch();
                    }}
                    className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    Respawn at Floor 1 ({respawnsRemaining} Left)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      initAudioContext();
                      playMenuClickSound(true, audioEnabled);
                      resetNewGame();
                    }}
                    className="rounded-lg border border-slate-600 bg-[#131d2b] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Restart Game
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    initAudioContext();
                    playMenuClickSound(true, audioEnabled);
                    resetNewGame();
                  }}
                  className="rounded-lg bg-red-500 px-6 py-2.5 text-sm font-bold tracking-wide text-white hover:bg-red-400 transition-colors cursor-pointer"
                >
                  RESTART GAME
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  playMenuClickSound(false, audioEnabled);
                  returnToMainMenu();
                }}
                className="rounded-lg border border-slate-700 bg-[#0d1520] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage 4 Final Escape Victory Screen */}
      {escaped && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-emerald-500/70 bg-[#0b121c] p-6 text-center shadow-2xl">
            <div className="font-mono-tech mb-1 text-[10px] font-bold tracking-[0.22em] text-emerald-300/80">
              LAST BREATH
            </div>
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
              <h2 className="font-display text-2xl font-bold tracking-wider">
                ESCAPE SUCCESSFUL
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              You survived the building-wide alarm, outmaneuvered all four Warrior Hunters, completed the Puzzle Room Challenge behind the containment barrier, and escaped from the Floor {puzzleFloor} Safe Room to the Floor 1 Ground Exit.
            </p>
            <div className="mt-4 space-y-1.5 rounded-lg border border-slate-800 bg-[#070d16] p-3 text-left text-xs">
              <div className="flex items-center justify-between text-emerald-300">
                <span>Stage 2 · Mission Room Key Cells (Apt {missionRoomNumber})</span>
                <span className="font-mono-tech font-bold">GENUINE KEY RECOVERED</span>
              </div>
              <div className="flex items-center justify-between text-emerald-300">
                <span>
                  Stage 3 · {activeCategorySpec ? activeCategorySpec.shortTitle : 'Puzzle'} Challenge (Apt {puzzleRoomNumber})
                </span>
                <span className="font-mono-tech font-bold">COMPLETED</span>
              </div>
              <div className="flex items-center justify-between text-emerald-300">
                <span>Stage 4 · Safe Room &amp; Emergency Descent</span>
                <span className="font-mono-tech font-bold">GROUND EXIT REACHED</span>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  initAudioContext();
                  playMenuClickSound(true, audioEnabled);
                  resetNewGame();
                }}
                className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-400 transition-colors"
              >
                Play New Game
              </button>
              <button
                type="button"
                onClick={() => {
                  playMenuClickSound(false, audioEnabled);
                  returnToMainMenu();
                }}
                className="rounded-lg border border-slate-700 bg-[#131d2b] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:text-white transition-colors"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive Virtual Movement Joystick + Survival Action Controls */}
      <TouchControlsOverlay />
    </>
  );
};
