import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Lock, X } from 'lucide-react';
import { MISSION_KEY_CELLS } from '../../data/buildingLayout';
import { useGameStore } from '../../store/useGameStore';
import { playerWorldPos } from '../../three/playerWorldState';
import { emitSoundEvent } from '../../three/soundBus';
import { playKeypadBeep, playMenuClickSound } from '../../three/soundEffects';

export const KeyCellKeypadModal: React.FC = () => {
  const activeKeyCellModal = useGameStore((s) => s.activeKeyCellModal);
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const playerFloor = useGameStore((s) => s.playerFloor);

  const closeKeyCellModal = useGameStore((s) => s.closeKeyCellModal);
  const submitKeyCellPassword = useGameStore((s) => s.submitKeyCellPassword);

  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [unlockedDone, setUnlockedDone] = useState(false);

  useEffect(() => {
    setCode('');
    setFeedback(null);
    setUnlockedDone(false);
  }, [activeKeyCellModal]);

  const handleDigit = useCallback(
    (d: string) => {
      if (unlockedDone || code.length >= 6) return;
      playKeypadBeep(580, audioEnabled);
      setFeedback(null);
      setCode((prev) => prev + d);
    },
    [audioEnabled, code.length, unlockedDone]
  );

  const handleClear = useCallback(() => {
    if (unlockedDone) return;
    playKeypadBeep(420, audioEnabled);
    setCode('');
    setFeedback(null);
  }, [audioEnabled, unlockedDone]);

  const handleEnter = useCallback(() => {
    if (!activeKeyCellModal || unlockedDone) return;
    if (!code.trim()) {
      playKeypadBeep(210, audioEnabled);
      setFeedback({ text: 'ENTER MISSION ROOM NUMBER', ok: false });
      return;
    }

    const res = submitKeyCellPassword(activeKeyCellModal, code);
    emitSoundEvent({
      x: playerWorldPos.x,
      y: playerWorldPos.feetY,
      z: playerWorldPos.z,
      floor: playerFloor,
      kind: 'terminal',
    });

    if (res.granted) {
      setFeedback({ text: 'ACCESS GRANTED', ok: true });
      setUnlockedDone(true);
    } else {
      setFeedback({ text: 'INCORRECT PASSWORD', ok: false });
      setCode('');
    }
  }, [activeKeyCellModal, code, playerFloor, submitKeyCellPassword, unlockedDone, audioEnabled]);

  useEffect(() => {
    if (!unlockedDone) return;
    const timer = window.setTimeout(() => {
      closeKeyCellModal();
    }, 680);
    return () => window.clearTimeout(timer);
  }, [closeKeyCellModal, unlockedDone]);

  useEffect(() => {
    if (!activeKeyCellModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        playMenuClickSound(false, audioEnabled);
        closeKeyCellModal();
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (!unlockedDone) {
          playKeypadBeep(420, audioEnabled);
          setCode((prev) => prev.slice(0, -1));
          setFeedback(null);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnter();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeKeyCellModal, audioEnabled, closeKeyCellModal, handleDigit, handleEnter, unlockedDone]);

  if (!activeKeyCellModal) return null;

  const cellDef = MISSION_KEY_CELLS.find((c) => c.id === activeKeyCellModal);
  const isCellA = activeKeyCellModal === 'cell-a';

  return (
    <div className="pointer-events-auto fixed inset-0 z-35 flex items-center justify-center bg-black/70 p-4">
      <div
        className={`w-full max-w-sm rounded-xl border bg-[#0b121c] p-5 shadow-2xl ${
          isCellA ? 'border-amber-500/60' : 'border-sky-500/60'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className={`h-4 w-4 ${isCellA ? 'text-amber-400' : 'text-sky-400'}`} />
              <h2 className="font-display text-lg font-bold tracking-wider text-white">
                {cellDef?.shortCode ?? 'KEY CELL'} · KEYPAD
              </h2>
            </div>
            <p className="mt-1 text-xs font-semibold tracking-wide text-slate-300">
              ENTER MISSION ROOM NUMBER
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              playMenuClickSound(false, audioEnabled);
              closeKeyCellModal();
            }}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-[#131d2b] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>

        {/* Digital Entry Display */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-700 bg-[#070d16] px-4 py-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5" />
            PASSCODE
          </span>
          <span className="font-mono-tech text-2xl font-bold tracking-[0.35em] text-amber-300">
            {(code || '').padEnd(3, '•')}
          </span>
        </div>

        {feedback && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold tracking-wide ${
              feedback.ok
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                : 'border-red-500/60 bg-red-500/15 text-red-300'
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Numeric Keypad 0-9, CLEAR, ENTER */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              disabled={unlockedDone}
              onClick={() => handleDigit(d)}
              className="font-mono-tech rounded-lg border border-sky-500/40 bg-[#131d2b] py-3 text-base font-bold text-white hover:bg-sky-500/20 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            disabled={unlockedDone}
            onClick={handleClear}
            className="rounded-lg border border-slate-700 bg-[#131d2b] py-3 text-xs font-bold tracking-wider text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={unlockedDone}
            onClick={() => handleDigit('0')}
            className="font-mono-tech rounded-lg border border-sky-500/40 bg-[#131d2b] py-3 text-base font-bold text-white hover:bg-sky-500/20 disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={unlockedDone}
            onClick={handleEnter}
            className="rounded-lg bg-amber-500 py-3 text-xs font-bold tracking-wider text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            ENTER
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-400">
          Use keyboard digits (0–9, Backspace, Enter) or click keypad buttons.
        </p>
      </div>
    </div>
  );
};
