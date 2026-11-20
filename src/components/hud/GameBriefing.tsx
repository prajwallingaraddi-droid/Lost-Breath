import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Compass,
  Cpu,
  DoorOpen,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import {
  initAudioContext,
  playGameplayStartSound,
  playMenuClickSound,
} from '../../three/soundEffects';
import { LastBreathLogo } from './LastBreathLogo';

export const GameBriefing: React.FC = () => {
  const screenPhase = useGameStore((s) => s.screenPhase);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const backToLobbyFromBriefing = useGameStore((s) => s.backToLobbyFromBriefing);
  const startIntroFromBriefing = useGameStore((s) => s.startIntroFromBriefing);

  if (screenPhase !== 'briefing') return null;

  const handleBack = () => {
    initAudioContext();
    playMenuClickSound(false, audioEnabled);
    backToLobbyFromBriefing();
  };

  const handlePlayNow = () => {
    initAudioContext();
    playGameplayStartSound(audioEnabled);
    startIntroFromBriefing();
  };

  return (
    <div
      data-testid="game-briefing-screen"
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-3 sm:p-6 overflow-y-auto"
    >
      <div className="my-auto w-full max-w-4xl rounded-xl border border-slate-700/90 bg-[#0b121c] p-5 sm:p-7 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <LastBreathLogo size="sm" />
            <h1 className="font-display mt-2 text-2xl sm:text-3xl font-bold tracking-wider text-white">
              LAST BREATH — SURVIVAL PROTOCOL
            </h1>
          </div>
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3.5 py-2 text-right">
            <div className="font-mono-tech text-xs font-bold tracking-wider text-red-300">
              CONTAINMENT STATUS: HOSTILE
            </div>
            <div className="font-mono-tech text-[11px] text-slate-400">
              4 FLOORS · 80 ROOMS · 4 WARRIOR HUNTERS
            </div>
          </div>
        </div>

        {/* Briefing Sections Grid */}
        <div className="mt-5 grid gap-3.5 md:grid-cols-2">
          {/* OBJECTIVE */}
          <div className="rounded-lg border border-amber-500/40 bg-[#070d16] p-4 md:col-span-2">
            <div className="flex items-center gap-2 text-amber-400">
              <Compass className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold tracking-widest uppercase">
                OBJECTIVE
              </h2>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-200">
              Breach the abandoned apartment compound, locate the hidden Mission Room, recover the genuine Puzzle Room Key, complete one security trial behind the Puzzle Chamber containment barrier, and escape alive through the Safe Room to the Floor 1 Ground Exit.
            </p>
          </div>

          {/* STAGE 1 */}
          <div className="rounded-lg border border-slate-800 bg-[#070d16] p-4">
            <div className="flex items-center gap-2 text-sky-400">
              <KeyRound className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold tracking-wider uppercase">
                STAGE 1 — FIND THE MISSION ROOM
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              You begin outside the compound holding the <span className="font-semibold text-amber-300">Mission Room Key</span>. Open the single compound gate and the apartment main entrance, then search all four floors for the randomized Mission Room while evading four patrolling Hunters.
            </p>
          </div>

          {/* STAGE 2 + WARNING */}
          <div className="rounded-lg border border-slate-800 bg-[#070d16] p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <ShieldAlert className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold tracking-wider uppercase">
                STAGE 2 — COLLECT THE PUZZLE ROOM KEY
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              Enter the Mission Room quietly and unlock its two Key Cells using the room number keypad. Only one locker holds the genuine Puzzle Room Key; the other holds a useless false key.
            </p>
            <div className="mt-2.5 flex items-start gap-2 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <span>
                WARNING: Picking up the genuine Puzzle Room Key immediately triggers the building-wide emergency alarm and draws all 4 Hunters toward you!
              </span>
            </div>
          </div>

          {/* STAGE 3 */}
          <div className="rounded-lg border border-slate-800 bg-[#070d16] p-4">
            <div className="flex items-center gap-2 text-sky-300">
              <Cpu className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold tracking-wider uppercase">
                STAGE 3 — SOLVE THE PUZZLE
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              Unlock and enter the Puzzle Room. Its electromagnetic barrier seals Hunters outside for <span className="font-semibold text-amber-300">5 minutes</span>. Choose and finish <span className="font-semibold text-slate-100">one category</span> before time expires:
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono-tech text-[11px] text-slate-200">
              <div className="rounded border border-slate-800 bg-[#0f1724] px-2 py-1">1. Mathematics</div>
              <div className="rounded border border-slate-800 bg-[#0f1724] px-2 py-1">2. Playing Cards</div>
              <div className="rounded border border-slate-800 bg-[#0f1724] px-2 py-1">3. Memory</div>
              <div className="rounded border border-slate-800 bg-[#0f1724] px-2 py-1">4. Pattern Recognition</div>
            </div>
          </div>

          {/* STAGE 4 */}
          <div className="rounded-lg border border-slate-800 bg-[#070d16] p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <DoorOpen className="h-4 w-4" />
              <h2 className="font-display text-sm font-bold tracking-wider uppercase">
                STAGE 4 — ESCAPE
              </h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
              Completing your chosen trial unlocks the <span className="font-semibold text-emerald-300">Safe Room</span> at the rear of the Puzzle Chamber. Step through into the Emergency Descent tower and reach the Floor 1 Ground Exit to escape.
            </p>
          </div>

          {/* IMPORTANT RULES */}
          <div className="rounded-lg border border-red-500/40 bg-[#070d16] p-4 md:col-span-2">
            <h2 className="font-display text-xs font-bold tracking-widest text-red-400 uppercase">
              IMPORTANT SURVIVAL RULES
            </h2>
            <ul className="mt-2 grid gap-1.5 text-xs text-slate-300 sm:grid-cols-2">
              <li>• Maximum <span className="font-semibold text-white">3 Respawns</span> per session — exhausting all 3 triggers Permanent Game Over.</li>
              <li>• Caught before entering the Puzzle Room returns the genuine Puzzle Key to its cell.</li>
              <li>• Sprinting emits loud noise; <span className="font-semibold text-amber-300">Crouch [C]</span> dramatically lowers Hunter hearing detection.</li>
              <li>• Hide inside wardrobes, cabinets &amp; lockers (<span className="font-semibold text-amber-300">[E] / HIDE</span>) if not spotted entering.</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
          <button
            type="button"
            data-testid="briefing-back-btn"
            onClick={handleBack}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#121c2a] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            BACK
          </button>

          <button
            type="button"
            data-testid="briefing-next-btn"
            onClick={handlePlayNow}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-7 py-2.5 text-sm font-bold tracking-wider text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-lg"
          >
            PLAY NOW
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
