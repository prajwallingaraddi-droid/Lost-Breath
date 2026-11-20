import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Calculator,
  CheckCircle2,
  Clock,
  Cog,
  Cpu,
  Diamond,
  Eye,
  Flame,
  KeyRound,
  Lock,
  Play,
  Radio,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Spade,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import {
  CardsStageData,
  cardSuitSymbol,
  isRedSuit,
  MathStageData,
  MechanicalCircuitStageData,
  MechanicalGearStageData,
  MechanicalStageData,
  MechanicalSwitchStageData,
  MemoryStageData,
  MemoryTokenIcon,
  MemoryTokenSpec,
  PlayingCardItem,
  PUZZLE_CATEGORY_ORDER,
  PUZZLE_CATEGORY_SPECS,
  PUZZLE_MAX_ATTEMPTS,
} from '../../data/puzzleConfig';
import { useGameStore } from '../../store/useGameStore';
import {
  playKeypadBeep,
  playPuzzleCompleteSound,
} from '../../three/soundEffects';
import { PuzzleCategoryId } from '../../types/game';

// ============================================================================
// SHARED VISUAL COMPONENTS (INDUSTRIAL ESCAPE-ROOM AESTHETIC)
// ============================================================================
const CategoryIcon: React.FC<{ id: PuzzleCategoryId; className?: string }> = ({
  id,
  className = 'h-6 w-6',
}) => {
  switch (id) {
    case 'math':
      return <Calculator className={className} />;
    case 'cards':
      return <Spade className={className} />;
    case 'memory':
      return <Brain className={className} />;
    case 'mechanical':
      return <Cog className={className} />;
  }
};

const MemoryGlyph: React.FC<{ icon: MemoryTokenIcon; className?: string }> = ({
  icon,
  className = 'h-6 w-6',
}) => {
  switch (icon) {
    case 'beacon':
      return <AlertTriangle className={className} />;
    case 'valve':
      return <Flame className={className} />;
    case 'core':
      return <Zap className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'relay':
      return <Radio className={className} />;
    case 'gear':
      return <Cog className={className} />;
    case 'key':
      return <KeyRound className={className} />;
    case 'prism':
      return <Diamond className={className} />;
  }
};

interface PlayingCardTileProps {
  card: PlayingCardItem | null;
  hidden?: boolean;
  missingSlot?: boolean;
  selected?: boolean;
  compact?: boolean;
  badgeText?: string;
  onClick?: () => void;
}

const PlayingCardTile: React.FC<PlayingCardTileProps> = ({
  card,
  hidden = false,
  missingSlot = false,
  selected = false,
  compact = false,
  badgeText,
  onClick,
}) => {
  const sizeClass = compact
    ? 'h-[82px] w-[58px] text-sm'
    : 'h-[104px] w-[74px] text-base';

  if (missingSlot || !card) {
    return (
      <div
        className={`${sizeClass} flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-400 bg-amber-500/15 font-mono-tech font-bold text-amber-300 shadow-inner`}
      >
        <span className="text-2xl">?</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wider">Missing</span>
      </div>
    );
  }

  if (hidden) {
    return (
      <div
        className={`${sizeClass} flex flex-col items-center justify-center rounded-lg border-2 border-sky-500/50 bg-[#101c2d] shadow-md`}
      >
        <div className="flex h-[84%] w-[82%] items-center justify-center rounded border border-sky-400/30 bg-[#0b1523]">
          <Lock className="h-4 w-4 text-sky-400/70" />
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const symbol = cardSuitSymbol(card.suit);
  const colorClass = red ? 'text-red-600' : 'text-slate-900';

  const content = (
    <>
      <div className="flex w-full items-center justify-between px-1.5 pt-1 leading-none">
        <span className={`font-mono-tech font-extrabold ${compact ? 'text-xs' : 'text-sm'} ${colorClass}`}>
          {card.rank}
        </span>
        <span className={`${compact ? 'text-xs' : 'text-sm'} ${colorClass}`}>{symbol}</span>
      </div>
      <div className={`my-auto ${compact ? 'text-2xl' : 'text-3xl'} leading-none ${colorClass}`}>
        {symbol}
      </div>
      <div className="flex w-full items-center justify-between px-1.5 pb-1 leading-none">
        <span className={`text-[10px] font-bold uppercase ${red ? 'text-red-500' : 'text-slate-600'}`}>
          {red ? 'RED' : 'BLK'}
        </span>
        <span className={`font-mono-tech font-extrabold ${compact ? 'text-xs' : 'text-sm'} ${colorClass}`}>
          {card.rank}
        </span>
      </div>
      {badgeText && (
        <span className="absolute -top-2 -right-2 rounded bg-sky-500 px-1.5 py-0.5 font-mono-tech text-[10px] font-bold text-slate-950 shadow">
          {badgeText}
        </span>
      )}
    </>
  );

  const baseClass = `relative ${sizeClass} flex flex-col items-center justify-between rounded-lg border-2 bg-slate-50 shadow-md transition-transform`;
  const borderClass = selected
    ? 'border-sky-400 ring-2 ring-sky-400/70 -translate-y-0.5'
    : 'border-slate-300';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} ${borderClass} hover:-translate-y-1 hover:border-amber-400 cursor-pointer`}
      >
        {content}
      </button>
    );
  }

  return <div className={`${baseClass} ${borderClass}`}>{content}</div>;
};

// ============================================================================
// GAME 1 — MATHEMATICS INTERACTIVE VIEW
// ============================================================================
const MathChallengeView: React.FC<{
  stages: MathStageData[];
  stageIndex: number;
  audioEnabled: boolean;
  onStagePassed: () => void;
  onWrong: () => void;
}> = ({ stages, stageIndex, audioEnabled, onStagePassed, onWrong }) => {
  const stage = stages[stageIndex] ?? stages[0];
  const [feedback, setFeedback] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setFeedback(null);
    setShowHint(false);
  }, [stage.id, stage.signature]);

  const handleSelect = (optionIdx: number) => {
    const chosenVal = stage.options[optionIdx];
    if (chosenVal === stage.correctAnswer) {
      playPuzzleCompleteSound(true, audioEnabled);
      setFeedback({ text: `Verified! ${stage.explanation}`, tone: 'success' });
      onStagePassed();
    } else {
      playKeypadBeep(210, audioEnabled);
      setShowHint(true);
      setFeedback({
        text: `${chosenVal} is incorrect. Check the calculation steps and try again.`,
        tone: 'error',
      });
      onWrong();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        handleSelect(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono-tech text-xs font-bold text-sky-400">
            STAGE {stageIndex + 1} / {stages.length}
          </span>
          <h3 className="font-display text-lg font-bold text-white">{stage.title}</h3>
        </div>
        <span className="rounded border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 font-mono-tech text-[11px] font-semibold text-sky-300">
          2–3 STEP LOGIC
        </span>
      </div>

      <div className="rounded-lg border border-slate-700/80 bg-[#0d1623] p-4">
        <p className="text-xs font-medium text-sky-300">{stage.ruleLabel}</p>
        <p className="mt-2 font-display text-lg font-bold text-white">{stage.prompt}</p>

        {stage.sequenceItems && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {stage.sequenceItems.map((val, idx) => (
              <div
                key={`seq-${idx}`}
                className={`flex h-14 min-w-[64px] items-center justify-center rounded-lg border-2 px-3 font-mono-tech text-xl font-extrabold ${
                  val === null
                    ? 'border-dashed border-amber-400 bg-amber-500/15 text-amber-300'
                    : 'border-slate-600 bg-[#08101b] text-slate-100'
                }`}
              >
                {val === null ? '?' : val}
              </div>
            ))}
          </div>
        )}

        {stage.equationLines && (
          <div className="mt-3 space-y-2 rounded-md border border-slate-800 bg-[#08101b] p-3 font-mono-tech text-sm text-slate-100">
            {stage.equationLines.map((line, idx) => (
              <div key={`eq-${idx}`} className="flex items-center gap-2.5">
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[11px] font-bold text-sky-300">
                  0{idx + 1}
                </span>
                <span>{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Validated Answer (Keys 1–4)
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stage.options.map((val, idx) => (
            <button
              key={`opt-${idx}-${val}`}
              type="button"
              onClick={() => handleSelect(idx)}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-600 bg-[#131e2e] px-4 py-3.5 text-center transition-colors hover:border-sky-400 hover:bg-sky-500/15 cursor-pointer"
            >
              <span className="font-mono-tech text-[10px] font-semibold text-slate-400">
                OPTION {idx + 1}
              </span>
              <span className="mt-1 font-mono-tech text-2xl font-extrabold text-white">{val}</span>
            </button>
          ))}
        </div>
      </div>

      {showHint && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
          <span className="font-bold">Guidance: </span>
          {stage.hint}
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-md border px-3.5 py-2 text-xs font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
              : 'border-red-500/60 bg-red-500/15 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// GAME 2 — PLAYING CARDS INTERACTIVE VIEW (ACCESSIBLE & VISUAL)
// ============================================================================
const CardsChallengeView: React.FC<{
  stages: CardsStageData[];
  stageIndex: number;
  audioEnabled: boolean;
  onStagePassed: () => void;
  onWrong: () => void;
}> = ({ stages, stageIndex, audioEnabled, onStagePassed, onWrong }) => {
  const stage = stages[stageIndex] ?? stages[0];
  const [feedback, setFeedback] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setFeedback(null);
    setShowHint(false);
  }, [stage.id, stage.signature]);

  const handlePickCard = (card: PlayingCardItem) => {
    if (card.id === stage.correctCardId) {
      playPuzzleCompleteSound(true, audioEnabled);
      setFeedback({ text: `Correct! ${stage.explanation}`, tone: 'success' });
      onStagePassed();
    } else {
      playKeypadBeep(210, audioEnabled);
      setShowHint(true);
      setFeedback({
        text: `${card.rank}${cardSuitSymbol(card.suit)} does not match every rule. Review the clue below.`,
        tone: 'error',
      });
      onWrong();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= stage.options.length) {
        handlePickCard(stage.options[n - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono-tech text-xs font-bold text-red-400">
            STAGE {stageIndex + 1} / {stages.length}
          </span>
          <h3 className="font-display text-lg font-bold text-white">{stage.title}</h3>
        </div>
        <div className="flex items-center gap-2 rounded border border-slate-700 bg-[#0d1623] px-2.5 py-1 font-mono-tech text-[11px]">
          <span className="font-bold text-red-400">♥ ♦ RED</span>
          <span className="text-slate-600">|</span>
          <span className="font-bold text-slate-200">♠ ♣ BLACK</span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-300">2→10, J, Q, K, A</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700/80 bg-[#0d1623] p-4 space-y-3">
        <div className="rounded border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200">
          <span className="font-bold text-sky-300">Rule: </span>
          {stage.ruleExplanation}
        </div>

        <p className="text-sm font-semibold text-white">{stage.prompt}</p>

        {/* Sequence Strip (Stages 1 & 3) */}
        {stage.sequence && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {stage.sequence.map((card, idx) => (
              <div key={`cseq-${idx}`} className="flex flex-col items-center gap-1">
                <PlayingCardTile card={card} missingSlot={card === null} compact />
                <span className="font-mono-tech text-[10px] text-slate-500">#{idx + 1}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reference Cards (Stage 2) */}
        {stage.referenceCards && (
          <div className="flex flex-wrap items-center justify-center gap-6 rounded-md border border-slate-800 bg-[#08101b] py-3 px-4">
            {stage.referenceCards.map((ref) => (
              <div key={ref.label} className="flex flex-col items-center gap-1.5">
                <span className="font-mono-tech text-[10px] font-bold uppercase text-amber-300">
                  {ref.label}
                </span>
                <PlayingCardTile card={ref.card} compact />
              </div>
            ))}
          </div>
        )}

        {/* Logic Clues (Stages 2 & 4) */}
        {stage.clues && (
          <ul className="space-y-1.5 rounded-md border border-slate-800 bg-[#08101b] p-3 text-xs text-slate-200">
            {stage.clues.map((clue, idx) => (
              <li key={`clue-${idx}`} className="flex items-start gap-2">
                <span className="mt-0.5 rounded bg-red-500/20 px-1.5 py-0.5 font-mono-tech text-[10px] font-bold text-red-300">
                  C{idx + 1}
                </span>
                <span>{clue}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Choose the Correct Card (Click or Press 1–{stage.options.length})
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {stage.options.map((card, idx) => (
            <PlayingCardTile
              key={card.id}
              card={card}
              badgeText={String(idx + 1)}
              onClick={() => handlePickCard(card)}
            />
          ))}
        </div>
      </div>

      {showHint && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
          <span className="font-bold">Hint: </span>
          {stage.hint}
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-md border px-3.5 py-2 text-xs font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
              : 'border-red-500/60 bg-red-500/15 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// GAME 3 — MEMORY CHALLENGE INTERACTIVE VIEW (LIGHTS / SYMBOLS / COLORS)
// ============================================================================
const MemoryChallengeView: React.FC<{
  stages: MemoryStageData[];
  stageIndex: number;
  audioEnabled: boolean;
  onStagePassed: () => void;
  onWrong: () => void;
}> = ({ stages, stageIndex, audioEnabled, onStagePassed, onWrong }) => {
  const stage = stages[stageIndex] ?? stages[0];
  const [phase, setPhase] = useState<'memorize' | 'recall'>('memorize');
  const [revealLeft, setRevealLeft] = useState<number>(stage.revealSeconds);
  const [slots, setSlots] = useState<(MemoryTokenSpec | null)[]>(() =>
    Array(stage.sequence.length).fill(null)
  );
  const [peekUsed, setPeekUsed] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'error' | 'info' | 'success' } | null>(
    null
  );
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setPhase('memorize');
    setRevealLeft(stage.revealSeconds);
    setSlots(Array(stage.sequence.length).fill(null));
    setPeekUsed(false);
    setFeedback(null);
  }, [stage.id, stage.signature, stage.revealSeconds, stage.sequence.length]);

  useEffect(() => {
    if (phase !== 'memorize') return;
    const started = performance.now();
    const totalMs = revealLeft * 1000;

    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - started;
      const rem = Math.max(0, (totalMs - elapsed) / 1000);
      setRevealLeft(Number(rem.toFixed(1)));
      if (rem <= 0) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        setPhase('recall');
      }
    }, 100);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [phase]);

  const handleAddToken = (token: MemoryTokenSpec) => {
    if (phase !== 'recall') return;
    const nextEmpty = slots.findIndex((s) => s === null);
    if (nextEmpty === -1) return;
    playKeypadBeep(680, audioEnabled);
    setSlots((prev) => {
      const next = [...prev];
      next[nextEmpty] = token;
      return next;
    });
  };

  const handleClearSlot = (idx: number) => {
    if (phase !== 'recall') return;
    playKeypadBeep(420, audioEnabled);
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  };

  const handleUndo = () => {
    if (phase !== 'recall') return;
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (slots[i] !== null) {
        handleClearSlot(i);
        return;
      }
    }
  };

  const handleClearAll = () => {
    if (phase !== 'recall') return;
    playKeypadBeep(360, audioEnabled);
    setSlots(Array(stage.sequence.length).fill(null));
  };

  const handleQuickPeek = () => {
    if (phase !== 'recall' || peekUsed) return;
    playKeypadBeep(760, audioEnabled);
    setPeekUsed(true);
    setRevealLeft(3.5);
    setPhase('memorize');
    setFeedback({ text: 'Quick Peek active — review the glowing sequence for 3.5 seconds.', tone: 'info' });
  };

  const handleSubmit = () => {
    if (phase !== 'recall' || slots.some((s) => s === null)) return;
    let exactMatches = 0;
    for (let i = 0; i < stage.sequence.length; i += 1) {
      if (slots[i]?.id === stage.sequence[i].id) exactMatches += 1;
    }

    if (exactMatches === stage.sequence.length) {
      playPuzzleCompleteSound(true, audioEnabled);
      setFeedback({ text: 'Signal sequence verified! Advancing to next stage.', tone: 'success' });
      onStagePassed();
    } else {
      playKeypadBeep(200, audioEnabled);
      setFeedback({
        text: `Mismatch: ${exactMatches}/${stage.sequence.length} positions matched. Brief 3.5s review flash activated.`,
        tone: 'error',
      });
      onWrong();
      setRevealLeft(3.5);
      setPhase('memorize');
    }
  };

  const filledCount = slots.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono-tech text-xs font-bold text-purple-400">
            STAGE {stageIndex + 1} / {stages.length} · LENGTH {stage.sequence.length}
          </span>
          <h3 className="font-display text-lg font-bold text-white">{stage.title}</h3>
        </div>
        <span
          className={`font-mono-tech rounded border px-2.5 py-1 text-xs font-bold ${
            phase === 'memorize'
              ? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
              : 'border-purple-400/70 bg-purple-500/20 text-purple-200'
          }`}
        >
          {phase === 'memorize' ? `MEMORIZE · ${revealLeft.toFixed(1)}s` : `RECALL · ${filledCount}/${stage.sequence.length}`}
        </span>
      </div>

      <div className="rounded-lg border border-slate-700/80 bg-[#0d1623] p-4">
        <p className="text-xs text-slate-300">{stage.instructions}</p>

        {/* Sequence Display Row (Either Illuminated Memorize Strip or Editable Recall Slots) */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {stage.sequence.map((targetToken, idx) => {
            if (phase === 'memorize') {
              return (
                <div
                  key={`mem-show-${idx}`}
                  className={`flex w-[92px] flex-col items-center rounded-lg border-2 px-2 py-2.5 shadow-md ${targetToken.bgClass} ${targetToken.borderClass}`}
                >
                  <span className="font-mono-tech text-[10px] font-bold text-slate-300">
                    #{idx + 1} · {targetToken.code}
                  </span>
                  <div className={`my-1.5 ${targetToken.textClass}`}>
                    <MemoryGlyph icon={targetToken.icon} className="h-7 w-7" />
                  </div>
                  <span className="text-center text-[10px] font-semibold text-white leading-tight">
                    {targetToken.label}
                  </span>
                </div>
              );
            }

            const placed = slots[idx];
            return (
              <button
                key={`mem-slot-${idx}`}
                type="button"
                onClick={() => placed && handleClearSlot(idx)}
                title={placed ? 'Click to clear this slot' : `Empty Slot #${idx + 1}`}
                className={`flex h-[96px] w-[92px] flex-col items-center justify-center rounded-lg border-2 px-2 py-2 transition-colors ${
                  placed
                    ? `${placed.bgClass} ${placed.borderClass} hover:opacity-85 cursor-pointer`
                    : 'border-dashed border-slate-600 bg-[#08101b] text-slate-500'
                }`}
              >
                <span className="font-mono-tech text-[10px] font-bold text-slate-400">
                  SLOT #{idx + 1}
                </span>
                {placed ? (
                  <>
                    <div className={`my-1 ${placed.textClass}`}>
                      <MemoryGlyph icon={placed.icon} className="h-6 w-6" />
                    </div>
                    <span className="text-center text-[10px] font-semibold text-white leading-tight">
                      {placed.label}
                    </span>
                  </>
                ) : (
                  <span className="mt-2 font-mono-tech text-lg font-bold text-slate-600">---</span>
                )}
              </button>
            );
          })}
        </div>

        {phase === 'memorize' && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setPhase('recall')}
              className="rounded border border-slate-600 bg-[#131e2e] px-3 py-1 text-xs font-semibold text-slate-200 hover:border-purple-400 cursor-pointer"
            >
              Ready Early — Hide &amp; Enter Sequence
            </button>
          </div>
        )}
      </div>

      {/* Signal Module Input Tray */}
      {phase === 'recall' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Click Signal Modules in Order
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={filledCount === 0}
                className="flex items-center gap-1 rounded border border-slate-700 bg-[#131d2b] px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40 cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={filledCount === 0}
                className="flex items-center gap-1 rounded border border-slate-700 bg-[#131d2b] px-2.5 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear All
              </button>
              <button
                type="button"
                onClick={handleQuickPeek}
                disabled={peekUsed}
                className="flex items-center gap-1 rounded border border-amber-500/60 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-40 cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                {peekUsed ? 'Peek Used' : 'Quick Peek (1)'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stage.palette.map((tok) => (
              <button
                key={tok.id}
                type="button"
                onClick={() => handleAddToken(tok)}
                disabled={filledCount >= stage.sequence.length}
                className={`flex items-center gap-2.5 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${tok.bgClass} ${tok.borderClass} hover:brightness-110 disabled:opacity-45 cursor-pointer`}
              >
                <div className={tok.textClass}>
                  <MemoryGlyph icon={tok.icon} className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-mono-tech text-[10px] font-bold text-slate-300">
                    {tok.code}
                  </div>
                  <div className="text-xs font-bold text-white">{tok.label}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={filledCount < stage.sequence.length}
              className="rounded-lg bg-purple-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-purple-400 disabled:opacity-40 transition-colors cursor-pointer"
            >
              SUBMIT SEQUENCE ({filledCount}/{stage.sequence.length})
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-md border px-3.5 py-2 text-xs font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
              : feedback.tone === 'info'
              ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
              : 'border-red-500/60 bg-red-500/15 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// GAME 4 — MECHANICAL LOGIC INTERACTIVE VIEW (SWITCHES / GEARS / CIRCUITS)
// ============================================================================
const SwitchRelayStage: React.FC<{
  stage: MechanicalSwitchStageData;
  audioEnabled: boolean;
  onPass: () => void;
  onWrong: () => void;
}> = ({ stage, audioEnabled, onPass, onWrong }) => {
  const [switches, setSwitches] = useState<[boolean, boolean, boolean, boolean]>([
    false,
    false,
    false,
    false,
  ]);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setSwitches([false, false, false, false]);
    setFeedback(null);
    setShowHint(false);
  }, [stage.signature]);

  const toggleSwitch = (idx: number) => {
    playKeypadBeep(switches[idx] ? 440 : 660, audioEnabled);
    setSwitches((prev) => {
      const next = [...prev] as [boolean, boolean, boolean, boolean];
      next[idx] = !next[idx];
      return next;
    });
  };

  const handleTest = () => {
    const matched = switches.every((val, idx) => val === stage.solution[idx]);
    if (matched) {
      playPuzzleCompleteSound(true, audioEnabled);
      setFeedback({ text: 'Breaker relay bus stabilized! Advancing to Gear Train.', tone: 'success' });
      onPass();
    } else {
      playKeypadBeep(200, audioEnabled);
      setShowHint(true);
      const activeCount = switches.filter(Boolean).length;
      setFeedback({
        text: `Relay fault (${activeCount}/4 breakers ON). Check each schematic rule and re-engage.`,
        tone: 'error',
      });
      onWrong();
    }
  };

  const activeCount = switches.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700/80 bg-[#0d1623] p-4 space-y-3">
        <p className="text-xs text-slate-300">{stage.instructions}</p>

        {/* Schematic Clues */}
        <ul className="space-y-1.5 rounded-md border border-slate-800 bg-[#08101b] p-3 text-xs text-slate-200">
          {stage.clues.map((clue, idx) => (
            <li key={`sw-clue-${idx}`} className="flex items-start gap-2">
              <span className="mt-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono-tech text-[10px] font-bold text-amber-300">
                R{idx + 1}
              </span>
              <span>{clue}</span>
            </li>
          ))}
        </ul>

        {/* Interactive 4-Breaker Switch Rack */}
        <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
          {stage.switchLabels.map((label, idx) => {
            const isOn = switches[idx];
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleSwitch(idx)}
                className={`flex flex-col items-center rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                  isOn
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : 'border-slate-700 bg-[#0a111c] hover:border-amber-400/70'
                }`}
              >
                <span className="font-mono-tech text-[11px] font-bold text-slate-300">{label}</span>
                {/* Physical Lever Track */}
                <div className="my-2.5 flex h-16 w-10 flex-col justify-between rounded-md border border-slate-600 bg-[#050910] p-1">
                  <div
                    className={`h-6 w-full rounded transition-colors ${
                      isOn ? 'bg-emerald-400 shadow' : 'bg-slate-800/40'
                    }`}
                  />
                  <div
                    className={`h-6 w-full rounded transition-colors ${
                      !isOn ? 'bg-slate-500' : 'bg-slate-800/40'
                    }`}
                  />
                </div>
                <span
                  className={`font-mono-tech text-xs font-extrabold ${
                    isOn ? 'text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  {isOn ? 'ON (UP)' : 'OFF (DOWN)'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono-tech text-xs text-slate-400">
          Active Breakers: <strong className="text-amber-300">{activeCount} / 4</strong>
        </span>
        <button
          type="button"
          onClick={handleTest}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
        >
          ENGAGE BREAKERS
        </button>
      </div>

      {showHint && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
          <span className="font-bold">Hint: </span>
          {stage.hint}
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-md border px-3.5 py-2 text-xs font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
              : 'border-red-500/60 bg-red-500/15 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
};

const GearTrainStage: React.FC<{
  stage: MechanicalGearStageData;
  audioEnabled: boolean;
  onPass: () => void;
  onWrong: () => void;
}> = ({ stage, audioEnabled, onPass, onWrong }) => {
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedGearId, setSelectedGearId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setSlots([null, null, null, null]);
    setSelectedGearId(null);
    setFeedback(null);
    setShowHint(false);
  }, [stage.signature]);

  const gearById = new Map(stage.gears.map((g) => [g.id, g]));
  const placedSet = new Set(slots.filter(Boolean) as string[]);

  const handleTrayClick = (gearId: string) => {
    if (placedSet.has(gearId)) return;
    playKeypadBeep(620, audioEnabled);
    // If clicked directly, auto-place into first open slot OR select
    const firstEmpty = slots.findIndex((s) => s === null);
    if (selectedGearId === gearId && firstEmpty !== -1) {
      setSlots((prev) => {
        const next = [...prev];
        next[firstEmpty] = gearId;
        return next;
      });
      setSelectedGearId(null);
    } else if (firstEmpty !== -1 && selectedGearId === null) {
      setSlots((prev) => {
        const next = [...prev];
        next[firstEmpty] = gearId;
        return next;
      });
    } else {
      setSelectedGearId(gearId);
    }
  };

  const handleSlotClick = (slotIdx: number) => {
    const existing = slots[slotIdx];
    if (selectedGearId) {
      playKeypadBeep(680, audioEnabled);
      setSlots((prev) => {
        const next = [...prev];
        // Remove selectedGearId if already placed elsewhere
        const prevIdx = next.indexOf(selectedGearId);
        if (prevIdx !== -1) next[prevIdx] = existing;
        next[slotIdx] = selectedGearId;
        return next;
      });
      setSelectedGearId(null);
      return;
    }

    if (existing) {
      playKeypadBeep(450, audioEnabled);
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = null;
        return next;
      });
    }
  };

  const handleTest = () => {
    if (slots.some((s) => s === null)) return;
    const isExact = slots.every((id, idx) => id === stage.solutionOrder[idx]);
    if (isExact) {
      playPuzzleCompleteSound(true, audioEnabled);
      setFeedback({ text: 'Gear train engaged cleanly! Advancing to Circuit Conduit Routing.', tone: 'success' });
      onPass();
    } else {
      playKeypadBeep(200, audioEnabled);
      setShowHint(true);
      const rightSlots = slots.filter((id, idx) => id === stage.solutionOrder[idx]).length;
      setFeedback({
        text: `Drive jammed (${rightSlots}/4 gears in exact slot). Click a mounted gear to remove and re-arrange.`,
        tone: 'error',
      });
      onWrong();
    }
  };

  const filledCount = slots.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700/80 bg-[#0d1623] p-4 space-y-3">
        <p className="text-xs text-slate-300">{stage.instructions}</p>

        <ul className="space-y-1.5 rounded-md border border-slate-800 bg-[#08101b] p-3 text-xs text-slate-200">
          {stage.clues.map((clue, idx) => (
            <li key={`gr-clue-${idx}`} className="flex items-start gap-2">
              <span className="mt-0.5 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono-tech text-[10px] font-bold text-amber-300">
                B{idx + 1}
              </span>
              <span>{clue}</span>
            </li>
          ))}
        </ul>

        {/* 4 Meshing Drive Slots */}
        <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
          {slots.map((gearId, idx) => {
            const gear = gearId ? gearById.get(gearId) : null;
            const spinDir = idx % 2 === 0 ? 'CW ↻' : 'CCW ↺';
            return (
              <button
                key={`gear-slot-${idx}`}
                type="button"
                onClick={() => handleSlotClick(idx)}
                className={`flex min-h-[112px] flex-col items-center justify-center rounded-xl border-2 p-2.5 transition-colors cursor-pointer ${
                  gear
                    ? 'border-amber-400/80 bg-[#111c2c] hover:border-red-400/70'
                    : 'border-dashed border-slate-600 bg-[#08101b] hover:border-sky-400'
                }`}
              >
                <span className="font-mono-tech text-[10px] font-bold text-slate-400">
                  SLOT {idx + 1} · {spinDir}
                </span>
                {gear ? (
                  <>
                    <Cog className="my-1.5 h-8 w-8" style={{ color: gear.accentHex }} />
                    <span className="font-mono-tech text-xs font-extrabold text-white">
                      {gear.label}
                    </span>
                    <span className="mt-0.5 text-[10px] text-slate-400">Click to remove</span>
                  </>
                ) : (
                  <span className="mt-2 font-mono-tech text-xs text-slate-500">EMPTY AXLE</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Unplaced Gear Tray */}
        <div className="border-t border-slate-800 pt-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">Available Gears (Click to Mount)</span>
            <button
              type="button"
              onClick={() => {
                setSlots([null, null, null, null]);
                setSelectedGearId(null);
              }}
              className="font-mono-tech text-[11px] text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              Reset All Slots
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stage.gears.map((g) => {
              const placed = placedSet.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={placed}
                  onClick={() => handleTrayClick(g.id)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                    placed
                      ? 'border-slate-800 bg-[#08101b] text-slate-600'
                      : 'border-slate-600 bg-[#131e2e] text-white hover:border-amber-400 cursor-pointer'
                  }`}
                >
                  <Cog className="h-4 w-4 shrink-0" style={{ color: placed ? '#475569' : g.accentHex }} />
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleTest}
          disabled={filledCount < 4}
          className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40 transition-colors cursor-pointer"
        >
          ENGAGE GEAR TRAIN ({filledCount}/4)
        </button>
      </div>

      {showHint && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
          <span className="font-bold">Hint: </span>
          {stage.hint}
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-md border px-3.5 py-2 text-xs font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
              : 'border-red-500/60 bg-red-500/15 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
};

const CircuitRoutingStage: React.FC<{
  stage: MechanicalCircuitStageData;
  audioEnabled: boolean;
  onPass: () => void;
  onWrong: () => void;
}> = ({ stage, audioEnabled, onPass, onWrong }) => {
  const [ports, setPorts] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setPorts([null, null, null, null]);
    setSelectedCableId(null);
    setFeedback(null);
    setShowHint(false);
  }, [stage.signature]);

  const cableById = new Map(stage.cables.map((c) => [c.id, c]));
  const routedSet = new Set(ports.filter(Boolean) as string[]);

  const handleCableClick = (cableId: string) => {
    playKeypadBeep(640, audioEnabled);
    if (selectedCableId === cableId) {
      setSelectedCableId(null);
      return;
    }
    setSelectedCableId(cableId);
  };

  const handlePortClick = (portIdx: number) => {
    const existing = ports[portIdx];
    if (selectedCableId) {
      playKeypadBeep(740, audioEnabled);
      setPorts((prev) => {
        const next = [...prev];
        const prevIdx = next.indexOf(selectedCableId);
        if (prevIdx !== -1) next[prevIdx] = existing;
        next[portIdx] = selectedCableId;
        return next;
      });
      setSelectedCableId(null);
      return;
    }
    if (existing) {
      playKeypadBeep(420, audioEnabled);
      setPorts((prev) => {
        const next = [...prev];
        next[portIdx] = null;
        return next;
      });
    }
  };

  const handleTestCircuit = () => {
    if (ports.some((p) => p === null)) return;
    const isExact = ports.every((id, idx) => id === stage.solutionPorts[idx]);
    if (isExact) {
      playPuzzleCompleteSound(true, audioEnabled);
      setFeedback({ text: 'Circuit bridge closed! Vault lock override confirmed.', tone: 'success' });
      onPass();
    } else {
      playKeypadBeep(200, audioEnabled);
      setShowHint(true);
      const rightPorts = ports.filter((id, idx) => id === stage.solutionPorts[idx]).length;
      setFeedback({
        text: `Short circuit detected (${rightPorts}/4 ports routed correctly). Re-check wiring clues.`,
        tone: 'error',
      });
      onWrong();
    }
  };

  const wiredCount = ports.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700/80 bg-[#0d1623] p-4 space-y-3">
        <p className="text-xs text-slate-300">{stage.instructions}</p>

        <ul className="space-y-1.5 rounded-md border border-slate-800 bg-[#08101b] p-3 text-xs text-slate-200">
          {stage.clues.map((clue, idx) => (
            <li key={`cir-clue-${idx}`} className="flex items-start gap-2">
              <span className="mt-0.5 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono-tech text-[10px] font-bold text-sky-300">
                W{idx + 1}
              </span>
              <span>{clue}</span>
            </li>
          ))}
        </ul>

        {/* Step 1: Select an Input Conduit */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>1. Select Input Conduit</span>
            <button
              type="button"
              onClick={() => {
                setPorts([null, null, null, null]);
                setSelectedCableId(null);
              }}
              className="font-mono-tech text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              Unplug All
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stage.cables.map((cable) => {
              const isSelected = selectedCableId === cable.id;
              const isRouted = routedSet.has(cable.id);
              return (
                <button
                  key={cable.id}
                  type="button"
                  onClick={() => handleCableClick(cable.id)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-white bg-slate-800'
                      : isRouted
                      ? 'border-slate-700 bg-[#09121e] opacity-70 hover:opacity-100'
                      : 'border-slate-600 bg-[#131e2e] hover:border-amber-400'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/40"
                    style={{ backgroundColor: cable.colorHex }}
                  />
                  <div className="min-w-0">
                    <div className="font-mono-tech text-[10px] font-bold text-slate-300">
                      {cable.code}
                    </div>
                    <div className="truncate text-xs font-bold text-white">{cable.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Plug into Output Ports A..D */}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            2. Click an Output Port to {selectedCableId ? 'Plug In / Swap' : 'Disconnect'}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stage.portLabels.map((portLabel, idx) => {
              const wiredId = ports[idx];
              const cable = wiredId ? cableById.get(wiredId) : null;
              return (
                <button
                  key={portLabel}
                  type="button"
                  onClick={() => handlePortClick(idx)}
                  className={`flex min-h-[86px] flex-col items-center justify-center rounded-xl border-2 p-2.5 transition-colors cursor-pointer ${
                    cable
                      ? 'bg-[#101a29]'
                      : selectedCableId
                      ? 'border-dashed border-sky-400 bg-sky-500/10'
                      : 'border-dashed border-slate-600 bg-[#08101b]'
                  }`}
                  style={cable ? { borderColor: cable.colorHex } : undefined}
                >
                  <span className="font-mono-tech text-[11px] font-bold text-slate-300">
                    {portLabel}
                  </span>
                  {cable ? (
                    <div className="mt-1.5 flex flex-col items-center">
                      <span
                        className="rounded px-2 py-0.5 font-mono-tech text-xs font-extrabold text-slate-950"
                        style={{ backgroundColor: cable.colorHex }}
                      >
                        {cable.code}
                      </span>
                      <span className="mt-1 text-[10px] font-semibold text-slate-200">
                        {cable.label}
                      </span>
                    </div>
                  ) : (
                    <span className="mt-2 font-mono-tech text-[11px] text-slate-500">
                      {selectedCableId ? 'CLICK TO WIRE' : 'OPEN PORT'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleTestCircuit}
          disabled={wiredCount < 4}
          className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition-colors cursor-pointer"
        >
          TEST CIRCUIT ({wiredCount}/4)
        </button>
      </div>

      {showHint && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
          <span className="font-bold">Hint: </span>
          {stage.hint}
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-md border px-3.5 py-2 text-xs font-semibold ${
            feedback.tone === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
              : 'border-red-500/60 bg-red-500/15 text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
};

const MechanicalLogicView: React.FC<{
  stages: MechanicalStageData[];
  stageIndex: number;
  audioEnabled: boolean;
  onStagePassed: () => void;
  onWrong: () => void;
}> = ({ stages, stageIndex, audioEnabled, onStagePassed, onWrong }) => {
  const stage = stages[stageIndex] ?? stages[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono-tech text-xs font-bold text-amber-400">
            STAGE {stageIndex + 1} / {stages.length}
          </span>
          <h3 className="font-display text-lg font-bold text-white">{stage.title}</h3>
        </div>
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono-tech text-[11px] font-semibold text-amber-300">
          MECHANICAL RIG
        </span>
      </div>

      {stage.kind === 'switches' && (
        <SwitchRelayStage
          stage={stage}
          audioEnabled={audioEnabled}
          onPass={onStagePassed}
          onWrong={onWrong}
        />
      )}
      {stage.kind === 'gears' && (
        <GearTrainStage
          stage={stage}
          audioEnabled={audioEnabled}
          onPass={onStagePassed}
          onWrong={onWrong}
        />
      )}
      {stage.kind === 'circuits' && (
        <CircuitRoutingStage
          stage={stage}
          audioEnabled={audioEnabled}
          onPass={onStagePassed}
          onWrong={onWrong}
        />
      )}
    </div>
  );
};

// ============================================================================
// MAIN PUZZLE INTERFACE MODAL (4 RANDOMIZED MINI-GAME CATEGORIES)
// ============================================================================
export const PuzzleInterface: React.FC = () => {
  const puzzleModalOpen = useGameStore((s) => s.puzzleModalOpen);
  const puzzleStage = useGameStore((s) => s.puzzleStage);
  const selectedPuzzleCategory = useGameStore((s) => s.selectedPuzzleCategory);
  const categoryLocked = useGameStore((s) => s.categoryLocked);
  const puzzleSession = useGameStore((s) => s.puzzleSession);
  const puzzleStageIndex = useGameStore((s) => s.puzzleStageIndex);
  const puzzleTimerSeconds = useGameStore((s) => s.puzzleTimerSeconds);
  const puzzleTimerExpired = useGameStore((s) => s.puzzleTimerExpired);
  const puzzleAttempts = useGameStore((s) => s.puzzleAttempts);
  const allPuzzlesCompleted = useGameStore((s) => s.allPuzzlesCompleted);
  const puzzleFloor = useGameStore((s) => s.puzzleFloor);
  const audioEnabled = useGameStore((s) => s.audioEnabled);

  const closePuzzleModal = useGameStore((s) => s.closePuzzleModal);
  const selectPuzzleCategory = useGameStore((s) => s.selectPuzzleCategory);
  const startPuzzleChallenge = useGameStore((s) => s.startPuzzleChallenge);
  const advancePuzzleStage = useGameStore((s) => s.advancePuzzleStage);
  const completePuzzleChallenge = useGameStore((s) => s.completePuzzleChallenge);
  const recordWrongAttempt = useGameStore((s) => s.recordWrongAttempt);
  const retryPuzzleChallenge = useGameStore((s) => s.retryPuzzleChallenge);

  // Close modal with Escape key (also allow 1-4 / Enter on Category Selection)
  useEffect(() => {
    if (!puzzleModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePuzzleModal();
        return;
      }
      if (puzzleStage === 'suit-select' && !categoryLocked) {
        if (e.key >= '1' && e.key <= '4') {
          const cat = PUZZLE_CATEGORY_ORDER[Number(e.key) - 1];
          playKeypadBeep(660, audioEnabled);
          selectPuzzleCategory(cat);
        } else if (e.key === 'Enter' && selectedPuzzleCategory) {
          playKeypadBeep(880, audioEnabled);
          startPuzzleChallenge();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    audioEnabled,
    categoryLocked,
    closePuzzleModal,
    puzzleModalOpen,
    puzzleStage,
    selectPuzzleCategory,
    selectedPuzzleCategory,
    startPuzzleChallenge,
  ]);

  if (!puzzleModalOpen) return null;

  const activeCategory: PuzzleCategoryId = selectedPuzzleCategory ?? 'math';
  const activeSpec = PUZZLE_CATEGORY_SPECS[activeCategory];

  const mins = String(Math.floor(puzzleTimerSeconds / 60)).padStart(2, '0');
  const secs = String(puzzleTimerSeconds % 60).padStart(2, '0');

  const handleStagePassed = () => {
    const totalStages = activeSpec.stageCount;
    if (puzzleStageIndex + 1 >= totalStages) {
      completePuzzleChallenge();
    } else {
      advancePuzzleStage();
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-3 sm:p-5">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#0b121c] shadow-2xl">
        {/* TOP HEADER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#080e17] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/15 text-sky-300">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-wider text-white">
                SECURITY OVERRIDE TERMINAL
              </h2>
              <p className="text-xs text-slate-400">
                Complete ONE of four randomized protocols to unlock the Safe Room
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live 5-Minute Countdown Timer */}
            <div
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono-tech text-sm font-extrabold ${
                puzzleTimerExpired || puzzleTimerSeconds <= 30
                  ? 'border-red-500 bg-red-500/20 text-red-300'
                  : puzzleTimerSeconds <= 60
                  ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                  : 'border-sky-500/60 bg-sky-500/15 text-sky-200'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>
                {mins}:{secs}
              </span>
            </div>

            {puzzleStage === 'active' && (
              <div className="rounded-md border border-slate-700 bg-[#101826] px-2.5 py-1.5 font-mono-tech text-xs font-bold text-slate-200">
                ATTEMPTS: {Math.max(0, PUZZLE_MAX_ATTEMPTS - puzzleAttempts)}/{PUZZLE_MAX_ATTEMPTS}
              </div>
            )}

            <button
              type="button"
              onClick={closePuzzleModal}
              aria-label="Close Puzzle Console"
              className="rounded-lg border border-slate-700 bg-[#131d2b] p-1.5 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 1. CATEGORY SELECTION & RULES PREVIEW */}
          {puzzleStage === 'suit-select' && !allPuzzlesCompleted && (
            <div className="space-y-5">
              <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-200">
                <strong className="text-sky-300">CONTAINMENT BARRIER ACTIVE:</strong> All 4 Hunters are locked outside while the timer holds. Choose <strong>ONE</strong> challenge category below — every new game generates fresh procedural puzzles.
              </div>

              {/* 4 Selectable Category Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PUZZLE_CATEGORY_ORDER.map((catId, idx) => {
                  const spec = PUZZLE_CATEGORY_SPECS[catId];
                  const isSelected = selectedPuzzleCategory === catId;
                  return (
                    <button
                      key={catId}
                      type="button"
                      onClick={() => {
                        playKeypadBeep(640, audioEnabled);
                        selectPuzzleCategory(catId);
                      }}
                      className={`group flex flex-col items-start rounded-xl border-2 p-4 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-[#132033]'
                          : 'border-slate-700/80 bg-[#0d1623] hover:border-slate-500'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg border bg-[#080f1a]"
                            style={{ borderColor: spec.accentHex, color: spec.accentHex }}
                          >
                            <CategoryIcon id={catId} className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-mono-tech text-[10px] font-bold tracking-widest text-slate-400">
                              {spec.gameNumber} · KEY {idx + 1}
                            </div>
                            <div className="font-display text-base font-bold text-white">
                              {spec.title}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 font-mono-tech text-[10px] font-bold ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isSelected ? 'SELECTED' : `${spec.stageCount} STAGES`}
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs text-slate-300">{spec.subtitle}</p>
                      <div className="mt-2 font-mono-tech text-[10px] font-semibold text-sky-300/90">
                        {spec.badgeText}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Category Briefing, Rules & Example */}
              {selectedPuzzleCategory ? (
                <div className="rounded-xl border border-amber-500/50 bg-[#0a1320] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <span className="font-mono-tech text-[11px] font-bold text-amber-300">
                        {activeSpec.gameNumber} BRIEFING
                      </span>
                      <h3 className="font-display text-lg font-bold text-white">
                        {activeSpec.title} — {activeSpec.subtitle}
                      </h3>
                    </div>
                    <span className="font-mono-tech text-xs text-slate-400">
                      Lock-in required on Start
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-200">{activeSpec.objective}</p>

                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {activeSpec.rules.map((r, idx) => (
                      <li key={`rule-${idx}`} className="flex items-start gap-2">
                        <span className="font-mono-tech font-bold text-amber-400">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="rounded-md border border-slate-700 bg-[#070d16] px-3 py-2 font-mono-tech text-xs text-emerald-300">
                    {activeSpec.example}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Controls: <strong className="text-slate-200">{activeSpec.controls}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playKeypadBeep(880, audioEnabled);
                        startPuzzleChallenge();
                      }}
                      className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      START CHALLENGE
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-[#080f1a] px-4 py-3 text-center text-xs text-slate-400">
                  Select any of the 4 categories above (or press keys 1–4) to inspect rules and start your challenge.
                </div>
              )}
            </div>
          )}

          {/* 2. ACTIVE CHALLENGE STAGE */}
          {puzzleStage === 'active' && !allPuzzlesCompleted && (
            <div className="space-y-4">
              {/* Locked Category Progress Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#080f1a] px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span style={{ color: activeSpec.accentHex }}>
                    <CategoryIcon id={activeCategory} className="h-4 w-4" />
                  </span>
                  <span className="font-display font-bold text-white">{activeSpec.title}</span>
                  <span className="font-mono-tech text-[10px] text-slate-400">
                    (LOCKED IN · SESSION #{puzzleSession.seed % 10000})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: activeSpec.stageCount }).map((_, idx) => (
                    <span
                      key={`dot-${idx}`}
                      className={`h-2.5 w-7 rounded-sm ${
                        idx < puzzleStageIndex
                          ? 'bg-emerald-400'
                          : idx === puzzleStageIndex
                          ? 'bg-amber-400'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {activeCategory === 'math' && (
                <MathChallengeView
                  stages={puzzleSession.math}
                  stageIndex={puzzleStageIndex}
                  audioEnabled={audioEnabled}
                  onStagePassed={handleStagePassed}
                  onWrong={recordWrongAttempt}
                />
              )}

              {activeCategory === 'cards' && (
                <CardsChallengeView
                  stages={puzzleSession.cards}
                  stageIndex={puzzleStageIndex}
                  audioEnabled={audioEnabled}
                  onStagePassed={handleStagePassed}
                  onWrong={recordWrongAttempt}
                />
              )}

              {activeCategory === 'memory' && (
                <MemoryChallengeView
                  stages={puzzleSession.memory}
                  stageIndex={puzzleStageIndex}
                  audioEnabled={audioEnabled}
                  onStagePassed={handleStagePassed}
                  onWrong={recordWrongAttempt}
                />
              )}

              {activeCategory === 'mechanical' && (
                <MechanicalLogicView
                  stages={puzzleSession.mechanical}
                  stageIndex={puzzleStageIndex}
                  audioEnabled={audioEnabled}
                  onStagePassed={handleStagePassed}
                  onWrong={recordWrongAttempt}
                />
              )}
            </div>
          )}

          {/* 3. ATTEMPT LIMIT REACHED (RETRY WHILE TIMER > 0) */}
          {puzzleStage === 'failed' && !allPuzzlesCompleted && (
            <div className="mx-auto max-w-md space-y-4 py-6 text-center">
              <div className="flex items-center justify-center gap-2 text-red-400">
                <ShieldAlert className="h-8 w-8" />
                <h3 className="font-display text-2xl font-bold">STAGE OVERLOAD</h3>
              </div>
              <p className="text-sm text-slate-300">
                {puzzleTimerSeconds <= 0
                  ? 'The 5-minute countdown expired and the containment barrier collapsed!'
                  : `You used all ${PUZZLE_MAX_ATTEMPTS} attempts on this stage. Reset the stage and try again while time remains!`}
              </p>
              {puzzleTimerSeconds > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playKeypadBeep(660, audioEnabled);
                    retryPuzzleChallenge();
                  }}
                  className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  Retry Stage ({mins}:{secs} Left)
                </button>
              )}
            </div>
          )}

          {/* 4. CHALLENGE COMPLETED — SAFE ROOM UNLOCKED */}
          {(puzzleStage === 'completed' || allPuzzlesCompleted) && (
            <div className="mx-auto max-w-lg space-y-4 py-6 text-center">
              <div className="flex items-center justify-center gap-2.5 text-emerald-400">
                <CheckCircle2 className="h-9 w-9" />
                <h3 className="font-display text-2xl font-bold tracking-wider">
                  CHALLENGE COMPLETED
                </h3>
              </div>

              <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/15 px-4 py-1.5 font-mono-tech text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                SAFE ROOM UNLOCKED · {activeSpec.title} VERIFIED
              </div>

              <p className="text-sm leading-relaxed text-slate-200">
                {puzzleFloor === 1
                  ? 'The armored Safe Room door at the rear of the Puzzle Room is now open. Enter the Safe Room and step straight into the Floor 1 Ground Extraction Zone to escape!'
                  : `The armored Safe Room door at the rear of the Puzzle Room is now open. Enter the Safe Room (Hunters cannot follow you inside) and descend the Emergency Descent stairwell from Floor ${puzzleFloor} to the Floor 1 Ground Exit!`}
              </p>

              <button
                type="button"
                onClick={closePuzzleModal}
                className="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                RETURN TO ROOM &amp; ENTER SAFE ROOM
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
