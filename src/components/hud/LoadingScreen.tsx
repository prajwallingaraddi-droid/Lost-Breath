import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { initAudioContext } from '../../three/soundEffects';
import { LastBreathLogo } from './LastBreathLogo';

const SURVIVAL_TIPS = [
  'Stay quiet. The Hunters can hear your footsteps through corridors.',
  'Find the Mission Room before the Hunters find you.',
  'Choose your hiding places carefully — wardrobes and cabinets block Hunter sightlines.',
  'Only the genuine Puzzle Room Key unlocks the chamber and triggers the facility alarm.',
  'Complete your chosen Puzzle Category before the 5-minute containment barrier fails.',
  'Crouch with [C] near patrolling Hunters to drastically reduce movement noise.',
];

export const MIN_LOADING_DURATION_MS = 7000;
export const TARGET_PROGRESS_DURATION_MS = 7500;

export function computeLoadingDisplayProgress(params: {
  elapsedMs: number;
  actualProgress: number;
  sceneReady: boolean;
  minDurationMs?: number;
  targetDurationMs?: number;
}): { displayPct: number; canFinish: boolean } {
  const minDurationMs = params.minDurationMs ?? MIN_LOADING_DURATION_MS;
  const targetDurationMs = params.targetDurationMs ?? TARGET_PROGRESS_DURATION_MS;

  const clampedElapsed = Math.max(0, params.elapsedMs);
  const t = targetDurationMs > 0 ? Math.min(1, clampedElapsed / targetDurationMs) : 1;
  // Smooth cinematic ease-out ramp from 0% to 100% across ~7.5s
  const timePacedPct = (1 - Math.pow(1 - t, 1.35)) * 100;

  // Never allow display percentage to overtake genuine scene readiness
  const assetCapPct = params.sceneReady ? 100 : Math.min(96, Math.max(0, params.actualProgress));
  const rawPct = Math.min(timePacedPct, assetCapPct);
  const displayPct = Math.max(0, Math.min(100, Math.round(rawPct)));

  const canFinish =
    clampedElapsed >= minDurationMs &&
    params.sceneReady &&
    params.actualProgress >= 100 &&
    displayPct >= 100;

  return { displayPct, canFinish };
}

export const LoadingScreen: React.FC = () => {
  const screenPhase = useGameStore((s) => s.screenPhase);
  const loadingSequenceTrigger = useGameStore((s) => s.loadingSequenceTrigger);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const toggleAudio = useGameStore((s) => s.toggleAudio);
  const finishLoadingToLobby = useGameStore((s) => s.finishLoadingToLobby);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  // Rotate tactical survival tips every 2.6s while loading (single interval, cleaned on exit)
  useEffect(() => {
    if (screenPhase !== 'loading') return;
    setTipIndex(0);
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % SURVIVAL_TIPS.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [loadingSequenceTrigger, screenPhase]);

  // Single unified loading controller combining real scene readiness with 7s minimum / ~8s target duration
  useEffect(() => {
    if (screenPhase !== 'loading') return;

    const startTime = performance.now();
    let rafId = 0;
    let fadeTimer = 0;
    let exitTimer = 0;
    let cancelled = false;
    let transitionStarted = false;
    let lastReportedPct = -1;

    setDisplayProgress(0);
    setFadingOut(false);

    const step = (now: number) => {
      if (cancelled || transitionStarted) return;

      const storeState = useGameStore.getState();
      if (storeState.screenPhase !== 'loading') return;

      const elapsedMs = now - startTime;
      const { displayPct, canFinish } = computeLoadingDisplayProgress({
        elapsedMs,
        actualProgress: storeState.sceneLoadProgress,
        sceneReady: storeState.sceneReady,
      });

      if (displayPct !== lastReportedPct) {
        lastReportedPct = displayPct;
        setDisplayProgress(displayPct);
      }

      if (canFinish) {
        transitionStarted = true;
        fadeTimer = window.setTimeout(() => {
          if (!cancelled) setFadingOut(true);
        }, 120);
        exitTimer = window.setTimeout(() => {
          if (!cancelled) finishLoadingToLobby();
        }, 540);
        return;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(exitTimer);
    };
  }, [finishLoadingToLobby, loadingSequenceTrigger, screenPhase]);

  if (screenPhase !== 'loading') return null;

  const statusLabel =
    displayProgress < 35
      ? 'INITIALIZING ENVIRONMENT LIGHTING & SKY...'
      : displayProgress < 75
        ? 'COMPILING 4-FLOOR CONTAINMENT GEOMETRY...'
        : displayProgress < 100
          ? 'STAGING SURVIVOR & EXTERIOR BOULEVARD...'
          : 'CONTAINMENT SECTOR READY';

  return (
    <div
      data-testid="loading-screen"
      onClick={() => initAudioContext()}
      className={`pointer-events-auto fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-[#06090f]/85 via-[#070b12]/72 to-[#05080d]/92 p-6 sm:p-10 transition-opacity duration-500 ${
        fadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Subtle drifting atmospheric fog bands */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-1/4 top-1/4 h-72 w-[150%] opacity-25"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(148,163,184,0.22) 0%, rgba(15,23,42,0) 70%)',
          }}
        />
        <div
          className="absolute -right-1/4 bottom-1/4 h-80 w-[150%] opacity-20"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(220,38,38,0.16) 0%, rgba(15,23,42,0) 70%)',
          }}
        />
      </div>

      {/* Top Bar: Sector Classification + Audio Unlock */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="font-mono-tech text-[11px] font-semibold tracking-[0.2em] text-slate-400">
          SECTOR-04 CONTAINMENT COMPLEX · BLOCK 04
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            initAudioContext();
            toggleAudio();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/90 bg-[#0b121c] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-amber-400/70 transition-colors cursor-pointer"
        >
          {audioEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-slate-400" />
          )}
          {audioEnabled ? 'AMBIENCE ON' : 'MUTED'}
        </button>
      </div>

      {/* Center Logo Presentation */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center">
        <LastBreathLogo size="lg" subtitle="SURVIVE THE FOUR-FLOOR CONTAINMENT COMPLEX" />
        <p className="mt-5 max-w-md text-xs sm:text-sm leading-relaxed text-slate-300/90">
          Abandoned city perimeter loaded. Prepare for stealth infiltration across eighty rooms and four patrolling Warrior Hunters.
        </p>
      </div>

      {/* Bottom Progress Bar + Percentage + Rotating Tips */}
      <div className="relative z-10 mx-auto w-full max-w-2xl space-y-3 rounded-xl border border-slate-700/80 bg-[#090f18]/92 p-4 sm:p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold tracking-[0.18em] text-white">
              LOADING...
            </span>
            <span className="font-mono-tech hidden sm:inline text-[11px] text-slate-400">
              {statusLabel}
            </span>
          </div>
          <span
            data-testid="loading-percentage"
            className="font-mono-tech text-sm font-bold text-amber-400"
          >
            {displayProgress}%
          </span>
        </div>

        {/* Metallic Progress Track */}
        <div className="h-2.5 w-full overflow-hidden rounded-sm border border-slate-700 bg-[#05080e]">
          <div
            className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-amber-300 transition-[width] duration-150 ease-out"
            style={{ width: `${displayProgress}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <span className="font-mono-tech font-bold uppercase tracking-wider text-red-400">
            SURVIVAL TIP:
          </span>
          <span className="flex-1 text-slate-300">{SURVIVAL_TIPS[tipIndex]}</span>
        </div>
      </div>
    </div>
  );
};
