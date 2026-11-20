import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Gamepad2,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Settings,
  ShieldAlert,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  initAudioContext,
  playBriefingTransitionSound,
  playMenuClickSound,
} from '../../three/soundEffects';
import { attemptQuitGame } from '../../utils/appLifecycle';
import { LastBreathLogo } from './LastBreathLogo';
import { AudioSettingsPanel, ControlsGuidePanel } from './SettingsControlsPanels';

type LobbyModalTab = 'none' | 'settings' | 'controls' | 'exit-choice' | 'restart-confirm';

export const MainMenu: React.FC = () => {
  const screenPhase = useGameStore((s) => s.screenPhase);
  const inMainMenu = useGameStore((s) => s.inMainMenu);
  const isRestarting = useGameStore((s) => s.isRestarting);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const toggleAudio = useGameStore((s) => s.toggleAudio);
  const openBriefingFromLobby = useGameStore((s) => s.openBriefingFromLobby);
  const enterExitedScreen = useGameStore((s) => s.enterExitedScreen);
  const returnToLobbyFromExited = useGameStore((s) => s.returnToLobbyFromExited);
  const restartFullGameToLobby = useGameStore((s) => s.restartFullGameToLobby);

  const [modalTab, setModalTab] = useState<LobbyModalTab>('none');

  if (!inMainMenu) return null;

  // Dedicated EXITED screen when browser closing is blocked or unavailable
  if (screenPhase === 'exited') {
    return (
      <div
        data-testid="game-exited-screen"
        className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#06090f]/95 p-6"
      >
        <div className="w-full max-w-lg rounded-2xl border border-slate-700/90 bg-[#0b121c] p-7 sm:p-9 text-center shadow-2xl">
          <div className="flex justify-center">
            <LastBreathLogo size="md" subtitle="SESSION ENDED" />
          </div>

          <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/50 bg-red-500/10">
            <Power className="h-6 w-6 text-red-400" />
          </div>

          <h2 className="font-display mt-4 text-xl font-bold tracking-widest text-white">
            EXITED
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
            You have left the game. You can close this browser tab.
          </p>

          <div className="mt-7 flex justify-center">
            <button
              type="button"
              data-testid="exited-return-lobby-btn"
              onClick={() => {
                initAudioContext();
                playMenuClickSound(false, audioEnabled);
                setModalTab('none');
                returnToLobbyFromExited();
              }}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-[#121c2a] px-5 py-2.5 text-xs font-bold tracking-wider text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              RETURN TO LOBBY
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screenPhase !== 'lobby') return null;

  const handleStartBriefing = () => {
    if (isRestarting) return;
    initAudioContext();
    playMenuClickSound(true, audioEnabled);
    playBriefingTransitionSound(audioEnabled);
    setModalTab('none');
    openBriefingFromLobby();
  };

  const openModal = (next: LobbyModalTab) => {
    if (isRestarting) return;
    initAudioContext();
    playMenuClickSound(false, audioEnabled);
    setModalTab(next);
  };

  const handleQuitGame = () => {
    initAudioContext();
    playMenuClickSound(false, audioEnabled);
    setModalTab('none');
    const result = attemptQuitGame();
    if (!result.closed) {
      enterExitedScreen();
    }
  };

  const handleConfirmRestart = () => {
    if (isRestarting) return;
    initAudioContext();
    playMenuClickSound(true, audioEnabled);
    setModalTab('none');
    restartFullGameToLobby();
  };

  return (
    <div
      data-testid="player-lobby-screen"
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-4 sm:p-7"
    >
      {/* Subtle perimeter vignette keeping center 3D survivor and abandoned city clear */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(5,8,13,0.78) 0%, rgba(5,8,13,0.34) 36%, rgba(5,8,13,0.06) 65%, rgba(5,8,13,0.38) 100%)',
        }}
      />

      {/* TOP BAR: Sector Identity & Audio Quick Toggle */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto">
          <LastBreathLogo
            size="md"
            subtitle="SECTOR-04 CONTAINMENT COMPLEX · 4 FLOORS · 80 ROOMS"
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-red-500/45 bg-[#0b121c]/90 px-3 py-2 text-right shadow-lg">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <div>
              <div className="font-mono-tech text-[11px] font-bold tracking-wider text-red-300">
                4 WARRIOR HUNTERS ACTIVE
              </div>
              <div className="font-mono-tech text-[10px] text-slate-400">
                SIGHT &amp; SOUND STEALTH AI
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              initAudioContext();
              toggleAudio();
            }}
            aria-label="Toggle Audio"
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-700/90 bg-[#0b121c]/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400/70 transition-colors cursor-pointer shadow-lg"
          >
            {audioEnabled ? (
              <Volume2 className="h-4 w-4 text-amber-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
            <span className="hidden sm:inline">{audioEnabled ? 'AUDIO ON' : 'MUTED'}</span>
          </button>
        </div>
      </div>

      {/* LEFT INDUSTRIAL MENU RAIL (Center viewport remains open over live 3D Survivor) */}
      <div className="relative z-10 my-auto flex w-full max-w-[310px] flex-col gap-3 pointer-events-auto">
        <div className="rounded-xl border border-slate-700/85 bg-[#0b121c]/92 p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono-tech text-[11px] font-bold tracking-[0.2em] text-amber-400">
              PLAYER LOBBY
            </span>
            <span className="font-mono-tech text-[10px] text-slate-400">READY</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              data-testid="lobby-start-btn"
              onClick={handleStartBriefing}
              className="flex min-h-[48px] items-center justify-between rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-lg"
            >
              <span className="flex items-center gap-2.5">
                <Play className="h-4 w-4 fill-current" />
                START GAME
              </span>
              <span className="font-mono-tech text-[11px] font-bold text-slate-900">
                BRIEFING
              </span>
            </button>

            <button
              type="button"
              data-testid="lobby-settings-btn"
              onClick={() => openModal('settings')}
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-700 bg-[#121c2a] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-sky-400/70 hover:bg-[#162336] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Sliders className="h-4 w-4 text-sky-400" />
                SETTINGS
              </span>
              <span className="font-mono-tech text-[11px] text-slate-400">SENS / AUDIO</span>
            </button>

            <button
              type="button"
              data-testid="lobby-controls-btn"
              onClick={() => openModal('controls')}
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-700 bg-[#121c2a] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-amber-400/70 hover:bg-[#162336] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Gamepad2 className="h-4 w-4 text-amber-400" />
                CONTROLS
              </span>
              <span className="font-mono-tech text-[11px] text-slate-400">KEYBINDINGS</span>
            </button>

            <button
              type="button"
              data-testid="lobby-exit-btn"
              onClick={() => openModal('exit-choice')}
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-800 bg-[#0d1520] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-red-500/60 hover:text-red-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Power className="h-4 w-4 text-red-400" />
                EXIT GAME
              </span>
              <span className="font-mono-tech text-[11px] text-slate-500">QUIT / RESTART</span>
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR: Non-blocking 3D Character Rotation Hint */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="font-mono-tech text-[11px] text-slate-400">
          LAST BREATH · ABANDONED PERIMETER
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#0b121c]/85 px-3 py-1.5 font-mono-tech text-[11px] text-slate-300">
          <RotateCw className="h-3.5 w-3.5 text-amber-400" />
          DRAG ACROSS SURVIVOR TO ROTATE
        </div>
      </div>

      {/* SETTINGS & CONTROLS MODALS */}
      {(modalTab === 'settings' || modalTab === 'controls') && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
          <div className="my-auto w-full max-w-2xl rounded-xl border border-slate-700 bg-[#0b121c] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wider text-white">
                {modalTab === 'settings' ? (
                  <>
                    <Settings className="h-5 w-5 text-sky-400" />
                    SETTINGS &amp; AUDIO
                  </>
                ) : (
                  <>
                    <Gamepad2 className="h-5 w-5 text-amber-400" />
                    CONTROLS &amp; SURVIVAL GUIDE
                  </>
                )}
              </h2>
              <button
                type="button"
                onClick={() => openModal('none')}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#131d2b] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Lobby
              </button>
            </div>

            <div className="mt-4">
              {modalTab === 'settings' ? <AudioSettingsPanel /> : <ControlsGuidePanel />}
            </div>
          </div>
        </div>
      )}

      {/* EXIT LAST BREATH — TWO-OPTION MODAL (QUIT GAME vs RESTART GAME) */}
      {modalTab === 'exit-choice' && (
        <div
          data-testid="exit-choice-modal"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 transition-opacity duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-600/90 bg-[#0b121c] p-6 sm:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-wider text-white">
                  EXIT LAST BREATH
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-300">
                  Choose what you want to do.
                </p>
              </div>
              <Power className="h-5 w-5 shrink-0 text-red-400" />
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {/* OPTION 1 — QUIT GAME */}
              <button
                type="button"
                data-testid="exit-option-quit-btn"
                onClick={handleQuitGame}
                className="group flex min-h-[76px] w-full items-center gap-4 rounded-xl border border-red-500/45 bg-[#111622] px-5 py-4 text-left hover:border-red-400 hover:bg-red-950/35 hover:-translate-y-0.5 transition-all cursor-pointer shadow-lg"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15 text-red-400 group-hover:bg-red-500/25 transition-colors">
                  <Power className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold tracking-wider text-white">
                    QUIT GAME
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    Close the game completely.
                  </div>
                </div>
              </button>

              {/* OPTION 2 — RESTART GAME */}
              <button
                type="button"
                data-testid="exit-option-restart-btn"
                onClick={() => openModal('restart-confirm')}
                className="group flex min-h-[76px] w-full items-center gap-4 rounded-xl border border-amber-500/55 bg-amber-500/12 px-5 py-4 text-left hover:border-amber-400 hover:bg-amber-500/22 hover:-translate-y-0.5 transition-all cursor-pointer shadow-lg"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-400/50 bg-amber-500 text-slate-950 group-hover:bg-amber-400 transition-colors">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold tracking-wider text-amber-300">
                    RESTART GAME
                  </div>
                  <div className="mt-0.5 text-xs text-slate-300">
                    Start again from the beginning.
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                data-testid="exit-choice-back-btn"
                onClick={() => openModal('none')}
                className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121c2a] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTART CONFIRMATION MODAL */}
      {modalTab === 'restart-confirm' && (
        <div
          data-testid="restart-confirm-modal"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4 transition-opacity duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-500/55 bg-[#0b121c] p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/50 bg-amber-500/15 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-wider text-white">
                CONFIRM RESTART
              </h2>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-200">
              Are you sure you want to restart LAST BREATH? Your current game progress will be lost.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                data-testid="restart-cancel-btn"
                onClick={() => openModal('none')}
                className="min-h-[44px] rounded-xl border border-slate-700 bg-[#121c2a] px-5 py-2.5 text-xs font-bold tracking-wider text-slate-200 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                data-testid="restart-confirm-btn"
                onClick={handleConfirmRestart}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-lg"
              >
                <RefreshCw className="h-4 w-4" />
                RESTART
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
