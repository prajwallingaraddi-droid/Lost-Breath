import { CardSuitId, PuzzleCategoryId } from '../types/game';

// ============================================================================
// PROCEDURAL PUZZLE GENERATOR & VALIDATOR FOR LAST EXIT (4 MINI-GAME CATEGORIES)
// Generates fresh, mathematically verified puzzles on every New Game / Restart
// while avoiding recently used questions/patterns via a session history buffer.
// ============================================================================

export type CardRank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface PlayingCardItem {
  id: string;
  rank: CardRank;
  suit: CardSuitId;
}

// ----------------------------------------------------------------------------
// GAME 1 — MATHEMATICS (4 procedural stages: 2–3 steps of thinking)
// ----------------------------------------------------------------------------
export type MathStageKind = 'arithmetic' | 'sequence' | 'system' | 'vault-logic';

export interface MathStageData {
  id: string;
  signature: string;
  kind: MathStageKind;
  title: string;
  ruleLabel: string;
  prompt: string;
  /** Optional structured chips (for missing-number sequence or equation cards) */
  sequenceItems?: (number | null)[];
  equationLines?: string[];
  options: number[];
  correctAnswer: number;
  correctIndex: number;
  hint: string;
  explanation: string;
}

// ----------------------------------------------------------------------------
// GAME 2 — PLAYING CARDS (4 beginner-friendly procedural stages)
// ----------------------------------------------------------------------------
export type CardsStageKind = 'color-sequence' | 'rule-match' | 'suit-sequence' | 'deduction';

export interface CardsStageData {
  id: string;
  signature: string;
  kind: CardsStageKind;
  title: string;
  ruleExplanation: string;
  prompt: string;
  /** Sequence strip with one hidden slot (null) for sequence stages */
  sequence?: (PlayingCardItem | null)[];
  missingIndex?: number;
  /** Reference cards displayed for matching stages */
  referenceCards?: { label: string; card: PlayingCardItem }[];
  /** Clue bullets for rule-match / deduction stages */
  clues?: string[];
  /** Selectable candidate cards (4 for sequence, 5-6 for match/deduction) */
  options: PlayingCardItem[];
  correctCardId: string;
  correctIndex: number;
  hint: string;
  explanation: string;
}

// ----------------------------------------------------------------------------
// GAME 3 — MEMORY CHALLENGE (3 escalating stages: lengths 5 → 6 → 7)
// ----------------------------------------------------------------------------
export type MemoryTokenIcon =
  | 'beacon'
  | 'valve'
  | 'core'
  | 'shield'
  | 'relay'
  | 'gear'
  | 'key'
  | 'prism';

export interface MemoryTokenSpec {
  id: string;
  code: string;
  label: string;
  colorHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  icon: MemoryTokenIcon;
}

export const MEMORY_TOKEN_CATALOG: MemoryTokenSpec[] = [
  {
    id: 'red-beacon',
    code: 'R1',
    label: 'Red Beacon',
    colorHex: '#ef4444',
    bgClass: 'bg-red-500/20',
    borderClass: 'border-red-500/75',
    textClass: 'text-red-300',
    icon: 'beacon',
  },
  {
    id: 'cyan-core',
    code: 'C2',
    label: 'Cyan Core',
    colorHex: '#38bdf8',
    bgClass: 'bg-sky-500/20',
    borderClass: 'border-sky-400/75',
    textClass: 'text-sky-300',
    icon: 'core',
  },
  {
    id: 'amber-valve',
    code: 'A3',
    label: 'Amber Valve',
    colorHex: '#f59e0b',
    bgClass: 'bg-amber-500/20',
    borderClass: 'border-amber-400/75',
    textClass: 'text-amber-300',
    icon: 'valve',
  },
  {
    id: 'emerald-lock',
    code: 'E4',
    label: 'Emerald Lock',
    colorHex: '#22c55e',
    bgClass: 'bg-emerald-500/20',
    borderClass: 'border-emerald-400/75',
    textClass: 'text-emerald-300',
    icon: 'shield',
  },
  {
    id: 'violet-relay',
    code: 'V5',
    label: 'Violet Relay',
    colorHex: '#a855f7',
    bgClass: 'bg-purple-500/20',
    borderClass: 'border-purple-400/75',
    textClass: 'text-purple-300',
    icon: 'relay',
  },
  {
    id: 'steel-gear',
    code: 'S6',
    label: 'Steel Gear',
    colorHex: '#cbd5e1',
    bgClass: 'bg-slate-400/20',
    borderClass: 'border-slate-300/75',
    textClass: 'text-slate-200',
    icon: 'gear',
  },
  {
    id: 'gold-key',
    code: 'G7',
    label: 'Gold Key',
    colorHex: '#eab308',
    bgClass: 'bg-yellow-500/20',
    borderClass: 'border-yellow-400/75',
    textClass: 'text-yellow-300',
    icon: 'key',
  },
  {
    id: 'coral-prism',
    code: 'P8',
    label: 'Coral Prism',
    colorHex: '#fb7185',
    bgClass: 'bg-rose-500/20',
    borderClass: 'border-rose-400/75',
    textClass: 'text-rose-300',
    icon: 'prism',
  },
];

export interface MemoryStageData {
  id: string;
  signature: string;
  title: string;
  instructions: string;
  sequence: MemoryTokenSpec[];
  palette: MemoryTokenSpec[];
  revealSeconds: number;
}

// ----------------------------------------------------------------------------
// GAME 4 — MECHANICAL LOGIC (3 interactive stages with unique proven solutions)
// ----------------------------------------------------------------------------
export interface MechanicalSwitchStageData {
  id: string;
  signature: string;
  kind: 'switches';
  title: string;
  instructions: string;
  switchLabels: string[];
  clues: string[];
  /** Exact 4-element boolean target (true = UP/ON, false = DOWN/OFF) */
  solution: [boolean, boolean, boolean, boolean];
  hint: string;
}

export interface GearPieceSpec {
  id: string;
  teeth: number;
  alloy: string;
  label: string;
  accentHex: string;
}

export interface MechanicalGearStageData {
  id: string;
  signature: string;
  kind: 'gears';
  title: string;
  instructions: string;
  gears: GearPieceSpec[];
  clues: string[];
  /** Ordered array of 4 gear IDs from Slot 1 (Drive) to Slot 4 (Output) */
  solutionOrder: [string, string, string, string];
  hint: string;
}

export interface CircuitCableSpec {
  id: string;
  code: string;
  label: string;
  colorHex: string;
}

export interface MechanicalCircuitStageData {
  id: string;
  signature: string;
  kind: 'circuits';
  title: string;
  instructions: string;
  cables: CircuitCableSpec[];
  portLabels: [string, string, string, string];
  clues: string[];
  /** Ordered array of 4 cable IDs wired into ports [OUT-A, OUT-B, OUT-C, OUT-D] */
  solutionPorts: [string, string, string, string];
  hint: string;
}

export type MechanicalStageData =
  | MechanicalSwitchStageData
  | MechanicalGearStageData
  | MechanicalCircuitStageData;

export interface GeneratedPuzzleSession {
  seed: number;
  generatedAt: number;
  math: MathStageData[];
  cards: CardsStageData[];
  memory: MemoryStageData[];
  mechanical: MechanicalStageData[];
}

// ============================================================================
// DETERMINISTIC SEEDABLE PRNG + RECENT HISTORY BUFFER (AVOIDS REPEATS)
// ============================================================================
const HISTORY_STORAGE_KEY = 'last_exit_puzzle_history_v1';
const MAX_RECENT_SIGNATURES = 160;
const recentSignaturesMemory: string[] = [];
let sessionSeedCounter = 0;

function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadRecentHistorySet(): Set<string> {
  const result = new Set<string>(recentSignaturesMemory);
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (typeof item === 'string') result.add(item);
          }
        }
      }
    } catch {
      // Ignore storage errors in sandboxed frames
    }
  }
  return result;
}

function recordRecentSignatures(signatures: string[]): void {
  for (const sig of signatures) {
    recentSignaturesMemory.push(sig);
  }
  while (recentSignaturesMemory.length > MAX_RECENT_SIGNATURES) {
    recentSignaturesMemory.shift();
  }
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(recentSignaturesMemory.slice(-MAX_RECENT_SIGNATURES))
      );
    } catch {
      // Ignore storage quota errors
    }
  }
}

export function clearPuzzleHistoryForTests(): void {
  recentSignaturesMemory.length = 0;
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pickOne<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffleWithRng<T>(rng: () => number, items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function buildDistinctNumericOptions(
  rng: () => number,
  correct: number,
  plausibleCandidates: number[]
): { options: number[]; correctIndex: number } {
  const chosen = new Set<number>([correct]);
  const shuffledPlausible = shuffleWithRng(rng, plausibleCandidates);
  for (const candidate of shuffledPlausible) {
    if (chosen.size >= 4) break;
    if (Number.isInteger(candidate) && candidate >= 0 && candidate !== correct) {
      chosen.add(candidate);
    }
  }

  let offset = 1;
  while (chosen.size < 4) {
    const delta = pickOne(rng, [-offset, offset, offset + 2, -offset - 1]);
    const val = correct + delta;
    if (val >= 0 && !chosen.has(val)) {
      chosen.add(val);
    }
    offset += 1;
  }

  const options = shuffleWithRng(rng, Array.from(chosen));
  return {
    options,
    correctIndex: options.indexOf(correct),
  };
}

// ============================================================================
// GAME 1 — MATHEMATICS GENERATOR (4 Procedural Stages)
// ============================================================================
function generateMathStage1Arithmetic(
  rng: () => number,
  used: Set<string>
): MathStageData {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const variant = randInt(rng, 0, 2);
    let prompt = '';
    let answer = 0;
    let distractors: number[] = [];
    let hint = '';
    let explanation = '';

    if (variant === 0) {
      // (a * b) + c - d
      const a = randInt(rng, 4, 12);
      const b = randInt(rng, 3, 9);
      const c = randInt(rng, 8, 29);
      const d = randInt(rng, 4, Math.min(22, a * b + c - 5));
      answer = a * b + c - d;
      prompt = `Compute: (${a} × ${b}) + ${c} − ${d}`;
      distractors = [
        a * (b + c) - d,
        answer + a,
        answer - b,
        answer + 2 * d,
        answer + 4,
        Math.max(1, answer - 3),
      ];
      hint = `Step 1: Multiply ${a} × ${b} = ${a * b}. Step 2: Add ${c}, then subtract ${d}.`;
      explanation = `${a} × ${b} = ${a * b}; ${a * b} + ${c} = ${a * b + c}; ${a * b + c} − ${d} = ${answer}.`;
    } else if (variant === 1) {
      // (a + b) * c - d
      const a = randInt(rng, 4, 14);
      const b = randInt(rng, 3, 11);
      const c = randInt(rng, 3, 7);
      const d = randInt(rng, 5, 24);
      answer = (a + b) * c - d;
      prompt = `Compute: (${a} + ${b}) × ${c} − ${d}`;
      distractors = [
        a + b * c - d,
        (a + b) * c + d,
        answer + c,
        Math.max(1, answer - c),
        answer + 6,
      ];
      hint = `Step 1: Add inside brackets (${a} + ${b}). Step 2: Multiply by ${c}, then subtract ${d}.`;
      explanation = `${a} + ${b} = ${a + b}; ${a + b} × ${c} = ${(a + b) * c}; ${(a + b) * c} − ${d} = ${answer}.`;
    } else {
      // (a * b) / d + c  with exact division
      const d = randInt(rng, 2, 6);
      const q = randInt(rng, 5, 16);
      const prod = d * q;
      const b = randInt(rng, 3, 9);
      const c = randInt(rng, 7, 25);
      answer = q * b - c;
      if (answer <= 3) continue;
      prompt = `Compute: (${prod} ÷ ${d}) × ${b} − ${c}`;
      distractors = [
        q * b + c,
        (q + 1) * b - c,
        Math.max(1, (q - 1) * b - c),
        answer + d,
        Math.max(1, answer - d),
      ];
      hint = `Step 1: Divide ${prod} ÷ ${d}. Step 2: Multiply the result by ${b}, then subtract ${c}.`;
      explanation = `${prod} ÷ ${d} = ${q}; ${q} × ${b} = ${q * b}; ${q * b} − ${c} = ${answer}.`;
    }

    const signature = `math-s1:${prompt}`;
    if (used.has(signature) && attempt < 35) continue;
    used.add(signature);

    const { options, correctIndex } = buildDistinctNumericOptions(rng, answer, distractors);
    return {
      id: 'math-stage-1',
      signature,
      kind: 'arithmetic',
      title: 'Stage 1 · Multi-Step Arithmetic',
      ruleLabel: 'Evaluate brackets first, then multiply/divide, then add/subtract.',
      prompt,
      options,
      correctAnswer: answer,
      correctIndex,
      hint,
      explanation,
    };
  }
  throw new Error('Failed to generate Math Stage 1');
}

function generateMathStage2Sequence(
  rng: () => number,
  used: Set<string>
): MathStageData {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const patternType = randInt(rng, 0, 2);
    const seq: number[] = [];
    let hint = '';
    let explanation = '';

    if (patternType === 0) {
      // Growing step: +d, +(d+k), +(d+2k)...
      const start = randInt(rng, 3, 18);
      const d = randInt(rng, 2, 6);
      const k = randInt(rng, 2, 4);
      let cur = start;
      seq.push(cur);
      for (let i = 0; i < 5; i += 1) {
        cur += d + i * k;
        seq.push(cur);
      }
      hint = `Look at the differences between consecutive numbers: they increase by +${k} each step.`;
      explanation = `Differences grow by +${k} each step (+${d}, +${d + k}, +${d + 2 * k}, +${d + 3 * k}, +${d + 4 * k}).`;
    } else if (patternType === 1) {
      // Alternating +a, -b
      const start = randInt(rng, 10, 28);
      const a = randInt(rng, 6, 13);
      const b = randInt(rng, 2, a - 3);
      let cur = start;
      seq.push(cur);
      for (let i = 0; i < 5; i += 1) {
        cur += i % 2 === 0 ? a : -b;
        seq.push(cur);
      }
      hint = `Two alternating operations repeat across the sequence: add ${a}, then subtract ${b}.`;
      explanation = `Alternating steps: +${a}, −${b}, +${a}, −${b}, +${a}.`;
    } else {
      // ×2 + k (or ×2 - k)
      const start = randInt(rng, 2, 5);
      const k = pickOne(rng, [-1, 1, 2, 3]);
      let cur = start;
      seq.push(cur);
      for (let i = 0; i < 5; i += 1) {
        cur = cur * 2 + k;
        seq.push(cur);
      }
      if (cur > 260) continue;
      const kText = k > 0 ? `+ ${k}` : `− ${Math.abs(k)}`;
      hint = `Each term doubles the previous term and then applies ${kText}.`;
      explanation = `Rule: next = (previous × 2) ${kText}.`;
    }

    const missingIdx = randInt(rng, 2, 4);
    const answer = seq[missingIdx];
    const sequenceItems = seq.map((n, idx) => (idx === missingIdx ? null : n));
    const signature = `math-s2:${seq.join(',')}:${missingIdx}`;
    if (used.has(signature) && attempt < 35) continue;
    used.add(signature);

    const stepNear = Math.max(2, Math.abs(seq[missingIdx] - seq[missingIdx - 1]));
    const { options, correctIndex } = buildDistinctNumericOptions(rng, answer, [
      answer + 2,
      Math.max(1, answer - 2),
      answer + stepNear,
      Math.max(1, answer - Math.floor(stepNear / 2)),
      answer + 4,
    ]);

    return {
      id: 'math-stage-2',
      signature,
      kind: 'sequence',
      title: 'Stage 2 · Missing-Number Sequence',
      ruleLabel: 'Deduce the step rule between consecutive numbers to recover the missing slot.',
      prompt: 'Which number correctly replaces the "?" in this sequence?',
      sequenceItems,
      options,
      correctAnswer: answer,
      correctIndex,
      hint,
      explanation,
    };
  }
  throw new Error('Failed to generate Math Stage 2');
}

function generateMathStage3System(
  rng: () => number,
  used: Set<string>
): MathStageData {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const variant = randInt(rng, 0, 1);
    let equationLines: string[] = [];
    let prompt = '';
    let answer = 0;
    let distractors: number[] = [];
    let hint = '';
    let explanation = '';

    if (variant === 0) {
      const a = randInt(rng, 4, 12);
      const b = randInt(rng, 5, 15);
      if (a === b) continue;
      const coeffA = randInt(rng, 2, 4);
      const sumEq = coeffA * a + b;
      const multB = randInt(rng, 2, 4);
      const offset = randInt(rng, 3, 11);
      answer = b * multB - offset;
      if (answer <= 2) continue;

      equationLines = [
        `CORE [A] = ${a}`,
        `${coeffA} × [A] + [B] = ${sumEq}`,
        `TARGET = ([B] × ${multB}) − ${offset}`,
      ];
      prompt = 'Solve for [B] first, then compute the TARGET override value.';
      distractors = [
        b * multB + offset,
        a * multB - offset,
        (b + 1) * multB - offset,
        Math.max(1, (b - 1) * multB - offset),
        b + offset,
      ];
      hint = `Substitute [A] = ${a} into ${coeffA} × ${a} + [B] = ${sumEq} to find [B], then multiply by ${multB} and subtract ${offset}.`;
      explanation = `${coeffA} × ${a} = ${coeffA * a}, so [B] = ${sumEq} − ${coeffA * a} = ${b}. TARGET = (${b} × ${multB}) − ${offset} = ${answer}.`;
    } else {
      const x = randInt(rng, 4, 11);
      const y = randInt(rng, 6, 16);
      if (x === y) continue;
      const multX = randInt(rng, 2, 4);
      const total1 = multX * x;
      const total2 = x + y;
      const bonus = randInt(rng, 2, 9);
      answer = 2 * y + bonus;

      equationLines = [
        `${multX} × [X] = ${total1}`,
        `[X] + [Y] = ${total2}`,
        `TARGET = (2 × [Y]) + ${bonus}`,
      ];
      prompt = 'Find [X], deduce [Y], and calculate the TARGET relay code.';
      distractors = [
        2 * y - bonus,
        2 * x + bonus,
        y + bonus,
        answer + 4,
        Math.max(1, answer - 3),
      ];
      hint = `Divide ${total1} by ${multX} to find [X], subtract from ${total2} to get [Y], then double [Y] and add ${bonus}.`;
      explanation = `[X] = ${total1} ÷ ${multX} = ${x}; [Y] = ${total2} − ${x} = ${y}; TARGET = 2 × ${y} + ${bonus} = ${answer}.`;
    }

    const signature = `math-s3:${equationLines.join('|')}`;
    if (used.has(signature) && attempt < 35) continue;
    used.add(signature);

    const { options, correctIndex } = buildDistinctNumericOptions(rng, answer, distractors);
    return {
      id: 'math-stage-3',
      signature,
      kind: 'system',
      title: 'Stage 3 · Logical Variable Deduction',
      ruleLabel: 'Use the first two equations to isolate the unknown value, then evaluate TARGET.',
      prompt,
      equationLines,
      options,
      correctAnswer: answer,
      correctIndex,
      hint,
      explanation,
    };
  }
  throw new Error('Failed to generate Math Stage 3');
}

function generateMathStage4VaultLogic(
  rng: () => number,
  used: Set<string>
): MathStageData {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const variant = randInt(rng, 0, 1);
    let equationLines: string[] = [];
    let prompt = '';
    let answer = 0;
    let distractors: number[] = [];
    let hint = '';
    let explanation = '';

    if (variant === 0) {
      // Industrial power relays word/logic calculation
      const base = randInt(rng, 6, 14);
      const mult = randInt(rng, 2, 4);
      const loss = randInt(rng, 3, 9);
      const second = base * mult - loss;
      const bonus = randInt(rng, 4, 12);
      answer = base + second + bonus;

      equationLines = [
        `Relay 1 outputs ${base} kW.`,
        `Relay 2 outputs (${mult} × Relay 1) − ${loss} kW.`,
        `Backup Cell adds +${bonus} kW to their combined output.`,
      ];
      prompt = 'What is the TOTAL combined output (in kW) across all three units?';
      distractors = [
        second + bonus,
        base + base * mult + loss + bonus,
        answer + loss,
        Math.max(1, answer - bonus),
        answer + base,
      ];
      hint = `First find Relay 2 = (${mult} × ${base}) − ${loss} = ${second}. Then add Relay 1 + Relay 2 + ${bonus}.`;
      explanation = `Relay 2 = ${second} kW. Total = ${base} + ${second} + ${bonus} = ${answer} kW.`;
    } else {
      // Three-step vault lock checksum
      const floors = randInt(rng, 3, 6);
      const unitsPerFloor = randInt(rng, 5, 11);
      const offline = randInt(rng, 3, 9);
      const activeUnits = floors * unitsPerFloor - offline;
      const powerPerUnit = randInt(rng, 2, 4);
      answer = activeUnits * powerPerUnit;

      equationLines = [
        `A wing has ${floors} sectors with ${unitsPerFloor} locks each.`,
        `${offline} locks are offline and disabled.`,
        `Each remaining ACTIVE lock draws ${powerPerUnit} amps.`,
      ];
      prompt = 'How many TOTAL amps do all active locks draw together?';
      distractors = [
        floors * unitsPerFloor * powerPerUnit,
        activeUnits * (powerPerUnit + 1),
        (activeUnits + offline) * powerPerUnit - offline,
        answer - powerPerUnit * 2,
        answer + powerPerUnit * 2,
      ];
      hint = `Step 1: Total locks = ${floors} × ${unitsPerFloor}. Step 2: Subtract ${offline} offline locks. Step 3: Multiply active locks by ${powerPerUnit}.`;
      explanation = `Total = ${floors * unitsPerFloor}; Active = ${floors * unitsPerFloor} − ${offline} = ${activeUnits}; Amps = ${activeUnits} × ${powerPerUnit} = ${answer}.`;
    }

    const signature = `math-s4:${equationLines.join('|')}`;
    if (used.has(signature) && attempt < 35) continue;
    used.add(signature);

    const { options, correctIndex } = buildDistinctNumericOptions(rng, answer, distractors);
    return {
      id: 'math-stage-4',
      signature,
      kind: 'vault-logic',
      title: 'Stage 4 · Vault Load Calculation',
      ruleLabel: 'Break the problem into 3 sequential steps and verify your final sum.',
      prompt,
      equationLines,
      options,
      correctAnswer: answer,
      correctIndex,
      hint,
      explanation,
    };
  }
  throw new Error('Failed to generate Math Stage 4');
}

export function generateMathStages(
  rng: () => number,
  used: Set<string>
): MathStageData[] {
  return [
    generateMathStage1Arithmetic(rng, used),
    generateMathStage2Sequence(rng, used),
    generateMathStage3System(rng, used),
    generateMathStage4VaultLogic(rng, used),
  ];
}

// ============================================================================
// GAME 2 — PLAYING CARDS GENERATOR (4 Beginner-Friendly Procedural Stages)
// ============================================================================
const ALL_SUITS: readonly CardSuitId[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RED_SUITS: readonly CardSuitId[] = ['hearts', 'diamonds'];
const BLACK_SUITS: readonly CardSuitId[] = ['spades', 'clubs'];
const ORDERED_RANKS: readonly CardRank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];
const FACE_RANKS: readonly CardRank[] = ['J', 'Q', 'K'];
const NUMBER_RANKS: readonly CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];

export function isRedSuit(suit: CardSuitId): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function cardSuitSymbol(suit: CardSuitId): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
  }
}

export function cardSuitName(suit: CardSuitId): string {
  switch (suit) {
    case 'spades':
      return 'Spades';
    case 'hearts':
      return 'Hearts';
    case 'diamonds':
      return 'Diamonds';
    case 'clubs':
      return 'Clubs';
  }
}

export function cardRankValue(rank: CardRank): number {
  return ORDERED_RANKS.indexOf(rank) + 2; // 2..14 (A=14)
}

function makeCard(rank: CardRank, suit: CardSuitId, suffix = ''): PlayingCardItem {
  return {
    id: `${rank}-${suit}${suffix ? `-${suffix}` : ''}`,
    rank,
    suit,
  };
}

function buildDistinctCardOptions(
  rng: () => number,
  target: PlayingCardItem,
  distractors: PlayingCardItem[]
): { options: PlayingCardItem[]; correctIndex: number } {
  const byKey = new Map<string, PlayingCardItem>();
  byKey.set(`${target.rank}-${target.suit}`, target);

  for (const d of shuffleWithRng(rng, distractors)) {
    if (byKey.size >= 4) break;
    const key = `${d.rank}-${d.suit}`;
    if (!byKey.has(key)) byKey.set(key, d);
  }

  while (byKey.size < 4) {
    const r = pickOne(rng, ORDERED_RANKS);
    const s = pickOne(rng, ALL_SUITS);
    const key = `${r}-${s}`;
    if (!byKey.has(key)) byKey.set(key, makeCard(r, s));
  }

  const options = shuffleWithRng(rng, Array.from(byKey.values()));
  return {
    options,
    correctIndex: options.findIndex((c) => c.id === target.id),
  };
}

function generateCardsStage1ColorSequence(
  rng: () => number,
  used: Set<string>
): CardsStageData {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const redSuit = pickOne(rng, RED_SUITS);
    const blackSuit = pickOne(rng, BLACK_SUITS);
    const startWithRed = rng() < 0.5;
    const step = pickOne(rng, [1, 2]);
    const maxStartIdx = ORDERED_RANKS.length - 1 - 5 * step;
    const startIdx = randInt(rng, 0, Math.max(0, maxStartIdx));

    const fullSeq: PlayingCardItem[] = [];
    for (let i = 0; i < 6; i += 1) {
      const rank = ORDERED_RANKS[startIdx + i * step];
      const useRed = startWithRed ? i % 2 === 0 : i % 2 === 1;
      fullSeq.push(makeCard(rank, useRed ? redSuit : blackSuit, `s1-${i}`));
    }

    const missingIndex = randInt(rng, 2, 4);
    const answer = fullSeq[missingIndex];
    const signature = `cards-s1:${fullSeq.map((c) => `${c.rank}${c.suit[0]}`).join(',')}:${missingIndex}`;
    if (used.has(signature) && attempt < 35) continue;
    used.add(signature);

    const wrongSuitSameColor = isRedSuit(answer.suit)
      ? RED_SUITS.find((s) => s !== answer.suit)!
      : BLACK_SUITS.find((s) => s !== answer.suit)!;
    const oppositeSuit = isRedSuit(answer.suit) ? blackSuit : redSuit;
    const ansIdx = ORDERED_RANKS.indexOf(answer.rank);
    const neighborRank =
      ORDERED_RANKS[Math.min(ORDERED_RANKS.length - 1, Math.max(0, ansIdx + (ansIdx < 11 ? 1 : -1)))];

    const { options, correctIndex } = buildDistinctCardOptions(rng, answer, [
      makeCard(answer.rank, oppositeSuit, 'd1'),
      makeCard(answer.rank, wrongSuitSameColor, 'd2'),
      makeCard(neighborRank, answer.suit, 'd3'),
      makeCard(neighborRank, oppositeSuit, 'd4'),
    ]);

    return {
      id: 'cards-stage-1',
      signature,
      kind: 'color-sequence',
      title: 'Stage 1 · Alternating Suit & Rank Pattern',
      ruleExplanation:
        'Cards alternate between one Red suit (♥/♦) and one Black suit (♠/♣) while advancing by a constant rank step.',
      prompt: 'Identify the missing card "?" that continues both the suit alternation and rank progression.',
      sequence: fullSeq.map((c, idx) => (idx === missingIndex ? null : c)),
      missingIndex,
      options,
      correctCardId: answer.id,
      correctIndex,
      hint: `Check the two cards next to "?": suits alternate ${cardSuitSymbol(redSuit)} and ${cardSuitSymbol(blackSuit)}, and ranks step by +${step}.`,
      explanation: `Position ${missingIndex + 1} requires ${answer.rank}${cardSuitSymbol(answer.suit)} to maintain the alternating suits and +${step} rank step.`,
    };
  }
  throw new Error('Failed to generate Cards Stage 1');
}

function generateCardsStage2RuleMatch(
  rng: () => number,
  used: Set<string>
): CardsStageData {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    // Pick 2 reference cards and build 5 candidate cards where strictly 1 satisfies 3 simple rules
    const refColorCard = makeCard(pickOne(rng, NUMBER_RANKS), pickOne(rng, ALL_SUITS), 'ref1');
    const refRankCard = makeCard(
      pickOne(rng, ['5', '6', '7', '8', '9'] as const),
      pickOne(rng, ALL_SUITS),
      'ref2'
    );
    const targetIsRed = isRedSuit(refColorCard.suit);
    const sameSuitAsRef1 = rng() < 0.5;
    const targetSuit: CardSuitId = sameSuitAsRef1
      ? refColorCard.suit
      : (targetIsRed ? RED_SUITS : BLACK_SUITS).find((s) => s !== refColorCard.suit)!;
    const requireHigher = rng() < 0.5;
    const refVal = cardRankValue(refRankCard.rank);

    const matchingRanks = NUMBER_RANKS.filter((r) =>
      requireHigher ? cardRankValue(r) > refVal : cardRankValue(r) < refVal
    );
    if (matchingRanks.length < 2) continue;

    const targetRank = pickOne(rng, matchingRanks);
    const answer = makeCard(targetRank, targetSuit, 'ans');

    // Construct 4 distractors that each fail at least 1 rule
    const otherColorSuit = pickOne(rng, targetIsRed ? BLACK_SUITS : RED_SUITS);
    const otherSameColorSuit = (targetIsRed ? RED_SUITS : BLACK_SUITS).find((s) => s !== targetSuit)!;
    const wrongDirectionRanks = NUMBER_RANKS.filter((r) =>
      requireHigher ? cardRankValue(r) < refVal : cardRankValue(r) > refVal
    );
    if (wrongDirectionRanks.length === 0) continue;

    const candidatesPool: PlayingCardItem[] = [
      answer,
      makeCard(targetRank, otherColorSuit, 'w1'), // wrong color
      makeCard(pickOne(rng, matchingRanks), otherSameColorSuit, 'w2'), // right color, wrong suit
      makeCard(pickOne(rng, wrongDirectionRanks), targetSuit, 'w3'), // right suit, wrong rank side
      makeCard(pickOne(rng, FACE_RANKS), targetSuit, 'w4'), // face card (not number card)
    ];

    const predicate = (c: PlayingCardItem): boolean => {
      const colorOk = isRedSuit(c.suit) === targetIsRed;
      const suitOk = sameSuitAsRef1 ? c.suit === refColorCard.suit : c.suit !== refColorCard.suit;
      const numberOk = NUMBER_RANKS.includes(c.rank);
      const rankOk = requireHigher ? cardRankValue(c.rank) > refVal : cardRankValue(c.rank) < refVal;
      return colorOk && suitOk && numberOk && rankOk;
    };

    // Ensure unique card faces AND strictly 1 match
    const uniqueKeys = new Set(candidatesPool.map((c) => `${c.rank}-${c.suit}`));
    if (uniqueKeys.size !== 5) continue;
    const winners = candidatesPool.filter(predicate);
    if (winners.length !== 1 || winners[0].id !== answer.id) continue;

    const signature = `cards-s2:${answer.rank}${answer.suit[0]}:${refColorCard.suit[0]}:${refRankCard.rank}:${requireHigher ? 'H' : 'L'}`;
    if (used.has(signature) && attempt < 50) continue;
    used.add(signature);

    const options = shuffleWithRng(rng, candidatesPool);
    const correctIndex = options.findIndex((c) => c.id === answer.id);

    const clues = [
      `Must be the SAME COLOR (${targetIsRed ? 'Red: ♥ or ♦' : 'Black: ♠ or ♣'}) as Reference Card 1.`,
      sameSuitAsRef1
        ? `Must have the EXACT SAME SUIT as Reference Card 1 (${cardSuitName(refColorCard.suit)} ${cardSuitSymbol(refColorCard.suit)}).`
        : `Must have a DIFFERENT SUIT from Reference Card 1 (not ${cardSuitName(refColorCard.suit)} ${cardSuitSymbol(refColorCard.suit)}).`,
      `Must be a NUMBER card (2–10, not J/Q/K/A) with a rank ${requireHigher ? 'HIGHER' : 'LOWER'} than Reference Card 2 (${refRankCard.rank}).`,
    ];

    return {
      id: 'cards-stage-2',
      signature,
      kind: 'rule-match',
      title: 'Stage 2 · Reference Card Matching',
      ruleExplanation:
        'Compare the 5 candidate cards against the two Reference Cards. Exactly ONE card satisfies every rule.',
      prompt: 'Select the ONLY candidate card that matches all three rules below.',
      referenceCards: [
        { label: 'Reference Card 1', card: refColorCard },
        { label: 'Reference Card 2', card: refRankCard },
      ],
      clues,
      options,
      correctCardId: answer.id,
      correctIndex,
      hint: `Eliminate wrong-color and face cards first, then check suit vs Card 1 and rank vs ${refRankCard.rank}.`,
      explanation: `${answer.rank}${cardSuitSymbol(answer.suit)} is the only card matching the color, suit, number-card, and rank rules.`,
    };
  }
  throw new Error('Failed to generate Cards Stage 2');
}

function generateCardsStage3SuitCycle(
  rng: () => number,
  used: Set<string>
): CardsStageData {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    // 3-suit repeating cycle across 7 cards + simple rank rule (+1 or alternating pair ranks)
    const suitOrder = shuffleWithRng(rng, ALL_SUITS).slice(0, 3);
    const descending = rng() < 0.45;
    const startIdx = descending ? randInt(rng, 7, 11) : randInt(rng, 1, 5);

    const fullSeq: PlayingCardItem[] = [];
    for (let i = 0; i < 7; i += 1) {
      const rank = ORDERED_RANKS[startIdx + (descending ? -i : i)];
      const suit = suitOrder[i % 3];
      fullSeq.push(makeCard(rank, suit, `s3-${i}`));
    }

    const missingIndex = randInt(rng, 3, 5);
    const answer = fullSeq[missingIndex];
    const signature = `cards-s3:${fullSeq.map((c) => `${c.rank}${c.suit[0]}`).join(',')}:${missingIndex}`;
    if (used.has(signature) && attempt < 35) continue;
    used.add(signature);

    const wrongSuit1 = suitOrder[(missingIndex + 1) % 3];
    const wrongSuit2 = suitOrder[(missingIndex + 2) % 3];
    const ansIdx = ORDERED_RANKS.indexOf(answer.rank);
    const altRank = ORDERED_RANKS[Math.min(12, Math.max(0, ansIdx + (descending ? -1 : 1)))];

    const { options, correctIndex } = buildDistinctCardOptions(rng, answer, [
      makeCard(answer.rank, wrongSuit1, 'd1'),
      makeCard(answer.rank, wrongSuit2, 'd2'),
      makeCard(altRank, answer.suit, 'd3'),
      makeCard(altRank, wrongSuit1, 'd4'),
    ]);

    return {
      id: 'cards-stage-3',
      signature,
      kind: 'suit-sequence',
      title: 'Stage 3 · Three-Suit Cycle Sequence',
      ruleExplanation:
        'The suits repeat in a 3-card cycle (1 → 2 → 3 → 1 → 2 → 3...) while ranks move step-by-step in order.',
      prompt: 'Find the missing card "?" that fits both the 3-suit cycle and the rank progression.',
      sequence: fullSeq.map((c, idx) => (idx === missingIndex ? null : c)),
      missingIndex,
      options,
      correctCardId: answer.id,
      correctIndex,
      hint: `Look 3 positions earlier than "?" for the exact same suit (${suitOrder.map(cardSuitSymbol).join(' → ')}), and check the rank order (${descending ? 'going down by 1' : 'going up by 1'}).`,
      explanation: `Position ${missingIndex + 1} repeats the suit from position ${missingIndex - 2} (${cardSuitSymbol(answer.suit)}) with rank ${answer.rank}.`,
    };
  }
  throw new Error('Failed to generate Cards Stage 3');
}

function generateCardsStage4Deduction(
  rng: () => number,
  used: Set<string>
): CardsStageData {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const targetSuit = pickOne(rng, ALL_SUITS);
    const targetIsRed = isRedSuit(targetSuit);
    const excludedSameColorSuit = (targetIsRed ? RED_SUITS : BLACK_SUITS).find(
      (s) => s !== targetSuit
    )!;
    const oppositeSuits = targetIsRed ? BLACK_SUITS : RED_SUITS;

    const isFaceTarget = rng() < 0.5;
    let targetRank: CardRank;
    let rankClue: string;
    let rankPredicate: (r: CardRank) => boolean;

    if (isFaceTarget) {
      targetRank = pickOne(rng, FACE_RANKS);
      if (targetRank === 'K') {
        rankClue = 'It is a Face Card (J, Q, or K) and is the HIGHEST of the three face cards (above Queen).';
        rankPredicate = (r) => r === 'K';
      } else if (targetRank === 'J') {
        rankClue = 'It is a Face Card (J, Q, or K) and is LOWER in rank than a Queen.';
        rankPredicate = (r) => r === 'J';
      } else {
        rankClue = 'It is a Face Card (J, Q, or K), NOT a Jack and NOT a King.';
        rankPredicate = (r) => r === 'Q';
      }
    } else {
      const evenRanks: CardRank[] = ['4', '6', '8', '10'];
      const oddRanks: CardRank[] = ['3', '5', '7', '9'];
      const wantEven = rng() < 0.5;
      const pool = wantEven ? evenRanks : oddRanks;
      targetRank = pickOne(rng, pool);
      const val = cardRankValue(targetRank);
      const lowBound = val - 1;
      const highBound = val + 1;
      rankClue = `It is an ${wantEven ? 'EVEN' : 'ODD'} number card strictly between ${lowBound} and ${highBound}.`;
      rankPredicate = (r) => {
        const v = cardRankValue(r);
        return NUMBER_RANKS.includes(r) && (v % 2 === (wantEven ? 0 : 1)) && v > lowBound && v < highBound;
      };
    }

    const answer = makeCard(targetRank, targetSuit, 'ans');
    const otherRanks = ORDERED_RANKS.filter((r) => r !== targetRank);
    const sameCategoryWrongRank = isFaceTarget
      ? pickOne(rng, FACE_RANKS.filter((r) => r !== targetRank))
      : pickOne(rng, NUMBER_RANKS.filter((r) => r !== targetRank && !rankPredicate(r)));

    const candidates: PlayingCardItem[] = [
      answer,
      makeCard(targetRank, excludedSameColorSuit, 'c1'),
      makeCard(targetRank, oppositeSuits[0], 'c2'),
      makeCard(sameCategoryWrongRank, targetSuit, 'c3'),
      makeCard(pickOne(rng, isFaceTarget ? NUMBER_RANKS : FACE_RANKS), targetSuit, 'c4'),
      makeCard(pickOne(rng, otherRanks), oppositeSuits[1], 'c5'),
    ];

    const uniqueKeys = new Set(candidates.map((c) => `${c.rank}-${c.suit}`));
    if (uniqueKeys.size !== 6) continue;

    const fullCheck = (c: PlayingCardItem): boolean =>
      isRedSuit(c.suit) === targetIsRed &&
      c.suit !== excludedSameColorSuit &&
      rankPredicate(c.rank);

    const winners = candidates.filter(fullCheck);
    if (winners.length !== 1 || winners[0].id !== answer.id) continue;

    const signature = `cards-s4:${answer.rank}${answer.suit[0]}:${isFaceTarget ? 'F' : 'N'}`;
    if (used.has(signature) && attempt < 50) continue;
    used.add(signature);

    const options = shuffleWithRng(rng, candidates);
    const correctIndex = options.findIndex((c) => c.id === answer.id);

    const clues = [
      `The hidden card is a ${targetIsRed ? 'RED suit (♥ Hearts or ♦ Diamonds)' : 'BLACK suit (♠ Spades or ♣ Clubs)'}.`,
      `It is NOT a ${cardSuitName(excludedSameColorSuit)} (${cardSuitSymbol(excludedSameColorSuit)}).`,
      rankClue,
    ];

    return {
      id: 'cards-stage-4',
      signature,
      kind: 'deduction',
      title: 'Stage 4 · Hidden Card Deduction',
      ruleExplanation:
        'Use all three logic clues to eliminate 5 decoy cards and pinpoint the single hidden vault card.',
      prompt: 'Which of the 6 cards satisfies EVERY clue below?',
      clues,
      options,
      correctCardId: answer.id,
      correctIndex,
      hint: `Clues 1 & 2 narrow the suit strictly to ${cardSuitName(targetSuit)} ${cardSuitSymbol(targetSuit)}. Then apply Clue 3.`,
      explanation: `Only ${answer.rank}${cardSuitSymbol(answer.suit)} matches the suit color, suit exclusion, and rank condition.`,
    };
  }
  throw new Error('Failed to generate Cards Stage 4');
}

export function generateCardsStages(
  rng: () => number,
  used: Set<string>
): CardsStageData[] {
  return [
    generateCardsStage1ColorSequence(rng, used),
    generateCardsStage2RuleMatch(rng, used),
    generateCardsStage3SuitCycle(rng, used),
    generateCardsStage4Deduction(rng, used),
  ];
}

// ============================================================================
// GAME 3 — MEMORY CHALLENGE GENERATOR (3 Escalating Stages: 5 → 6 → 7)
// ============================================================================
export function generateMemoryStages(
  rng: () => number,
  used: Set<string>
): MemoryStageData[] {
  const configs = [
    { idx: 1, length: 5, paletteSize: 6, revealSeconds: 6.0, label: 'Stage 1 · 5-Signal Relay' },
    { idx: 2, length: 6, paletteSize: 7, revealSeconds: 7.5, label: 'Stage 2 · 6-Signal Sequence' },
    { idx: 3, length: 7, paletteSize: 8, revealSeconds: 9.0, label: 'Stage 3 · 7-Signal Override' },
  ];

  const stages: MemoryStageData[] = [];

  for (const cfg of configs) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const palette = shuffleWithRng(rng, MEMORY_TOKEN_CATALOG).slice(0, cfg.paletteSize);
      const sequence: MemoryTokenSpec[] = [];

      // Build sequence with good variety (avoid triple repeats & ensure at least 4 distinct items)
      for (let i = 0; i < cfg.length; i += 1) {
        let candidate = pickOne(rng, palette);
        let guard = 0;
        while (
          guard < 12 &&
          sequence.length >= 2 &&
          sequence[sequence.length - 1].id === candidate.id &&
          sequence[sequence.length - 2].id === candidate.id
        ) {
          candidate = pickOne(rng, palette);
          guard += 1;
        }
        sequence.push(candidate);
      }

      const distinctCount = new Set(sequence.map((s) => s.id)).size;
      if (distinctCount < Math.min(4, cfg.length)) continue;

      const signature = `mem-s${cfg.idx}:${sequence.map((s) => s.code).join('-')}`;
      if (used.has(signature) && attempt < 35) continue;
      used.add(signature);

      stages.push({
        id: `memory-stage-${cfg.idx}`,
        signature,
        title: cfg.label,
        instructions: `Memorize the ${cfg.length} industrial signal modules in exact left-to-right order before they conceal.`,
        sequence,
        palette,
        revealSeconds: cfg.revealSeconds,
      });
      break;
    }
  }

  return stages;
}

// ============================================================================
// GAME 4 — MECHANICAL LOGIC GENERATOR (3 Interactive Stages, Brute-Force Unique)
// ============================================================================
function permute<T>(arr: readonly T[]): T[][] {
  if (arr.length <= 1) return [[...arr]];
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += 1) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) {
      res.push([arr[i], ...p]);
    }
  }
  return res;
}

function generateMechanicalStage1Switches(
  rng: () => number,
  used: Set<string>
): MechanicalSwitchStageData {
  const switchLabels = ['BREAKER S1', 'BREAKER S2', 'BREAKER S3', 'BREAKER S4'];
  const allMasks: [boolean, boolean, boolean, boolean][] = [];
  for (let m = 0; m < 16; m += 1) {
    allMasks.push([Boolean(m & 1), Boolean(m & 2), Boolean(m & 4), Boolean(m & 8)]);
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    // Pick a non-trivial target mask (1..14 so never all-OFF or all-ON)
    const targetMaskIdx = randInt(rng, 1, 14);
    const sol = allMasks[targetMaskIdx];
    const activeCount = sol.filter(Boolean).length;

    interface SwitchClue {
      text: string;
      check: (s: [boolean, boolean, boolean, boolean]) => boolean;
    }

    const candidateClues: SwitchClue[] = [];

    // 1. Exact active count clue
    candidateClues.push({
      text: `Exactly ${activeCount} of the 4 breakers must be switched ON (UP).`,
      check: (s) => s.filter(Boolean).length === activeCount,
    });

    // 2. Pairwise relation clues (same vs opposite)
    const pairs: [number, number][] = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];
    for (const [i, j] of shuffleWithRng(rng, pairs)) {
      const same = sol[i] === sol[j];
      candidateClues.push({
        text: same
          ? `S${i + 1} and S${j + 1} must be in the SAME position (both ON or both OFF).`
          : `S${i + 1} and S${j + 1} must be in OPPOSITE positions (one ON, one OFF).`,
        check: (s) => (same ? s[i] === s[j] : s[i] !== s[j]),
      });
    }

    // 3. Direct breaker anchor clues
    for (const i of shuffleWithRng(rng, [0, 1, 2, 3])) {
      const isOn = sol[i];
      candidateClues.push({
        text: `Breaker S${i + 1} must be set to ${isOn ? 'ON (UP)' : 'OFF (DOWN)'}.`,
        check: (s) => s[i] === isOn,
      });
    }

    // Greedily pick 3-4 clues (starting with active count + pairwise relations) until strictly 1 state survives!
    const selected: SwitchClue[] = [candidateClues[0]];
    const remainingPool = candidateClues.slice(1);

    let surviving = allMasks.filter((m) => selected.every((c) => c.check(m)));
    for (const clue of remainingPool) {
      if (surviving.length === 1) break;
      if (selected.length >= 4) break;
      const nextSurviving = surviving.filter((m) => clue.check(m));
      if (nextSurviving.length < surviving.length && nextSurviving.length >= 1) {
        selected.push(clue);
        surviving = nextSurviving;
      }
    }

    if (surviving.length !== 1) continue;
    const verified = surviving[0];
    if (verified.some((v, idx) => v !== sol[idx])) continue;

    const signature = `mech-sw:${sol.map((b) => (b ? '1' : '0')).join('')}:${selected.length}`;
    if (used.has(signature) && attempt < 50) continue;
    used.add(signature);

    return {
      id: 'mech-stage-1',
      signature,
      kind: 'switches',
      title: 'Stage 1 · Breaker Relay Alignment',
      instructions:
        'Toggle the 4 industrial circuit breakers ON (UP) or OFF (DOWN) so that every schematic rule is satisfied.',
      switchLabels,
      clues: selected.map((c) => c.text),
      solution: sol,
      hint: `Start with any fixed breaker rule, apply the SAME/OPPOSITE pairs, and verify the total ON count equals ${activeCount}.`,
    };
  }
  throw new Error('Failed to generate Mechanical Stage 1 (Switches)');
}

function generateMechanicalStage2Gears(
  rng: () => number,
  used: Set<string>
): MechanicalGearStageData {
  const gearSets: GearPieceSpec[][] = [
    [
      { id: 'gear-a', teeth: 12, alloy: 'Brass', label: '12T Brass', accentHex: '#eab308' },
      { id: 'gear-b', teeth: 18, alloy: 'Steel', label: '18T Steel', accentHex: '#94a3b8' },
      { id: 'gear-c', teeth: 24, alloy: 'Copper', label: '24T Copper', accentHex: '#f97316' },
      { id: 'gear-d', teeth: 30, alloy: 'Cobalt', label: '30T Cobalt', accentHex: '#38bdf8' },
    ],
    [
      { id: 'gear-a', teeth: 10, alloy: 'Bronze', label: '10T Bronze', accentHex: '#d97706' },
      { id: 'gear-b', teeth: 16, alloy: 'Chrome', label: '16T Chrome', accentHex: '#cbd5e1' },
      { id: 'gear-c', teeth: 22, alloy: 'Emerald', label: '22T Alloy', accentHex: '#22c55e' },
      { id: 'gear-d', teeth: 28, alloy: 'Crimson', label: '28T Core', accentHex: '#ef4444' },
    ],
  ];

  const gears = pickOne(rng, gearSets);
  const allPerms = permute(gears.map((g) => g.id));
  const gearById = new Map(gears.map((g) => [g.id, g]));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const sol = pickOne(rng, allPerms) as [string, string, string, string];

    interface PermClue {
      text: string;
      check: (order: string[]) => boolean;
    }

    const pool: PermClue[] = [];

    // Immediate neighbor clues ("immediately right of")
    for (const idx of shuffleWithRng(rng, [0, 1, 2])) {
      const leftG = gearById.get(sol[idx])!;
      const rightG = gearById.get(sol[idx + 1])!;
      pool.push({
        text: `${rightG.label} meshes immediately to the RIGHT of ${leftG.label}.`,
        check: (o) => o.indexOf(rightG.id) === o.indexOf(leftG.id) + 1,
      });
    }

    // Relative left/right ordering clues
    for (const [i, j] of shuffleWithRng(rng, [
      [0, 2],
      [0, 3],
      [1, 3],
    ] as [number, number][])) {
      const g1 = gearById.get(sol[i])!;
      const g2 = gearById.get(sol[j])!;
      pool.push({
        text: `${g1.label} sits to the LEFT of ${g2.label}.`,
        check: (o) => o.indexOf(g1.id) < o.indexOf(g2.id),
      });
    }

    // Exclusion slot clues ("NOT in Slot X")
    for (const slotIdx of shuffleWithRng(rng, [0, 1, 2, 3])) {
      const wrongGearId = pickOne(
        rng,
        gears.map((g) => g.id).filter((id) => id !== sol[slotIdx])
      );
      const wrongG = gearById.get(wrongGearId)!;
      pool.push({
        text: `${wrongG.label} must NOT be placed in Slot ${slotIdx + 1}.`,
        check: (o) => o[slotIdx] !== wrongGearId,
      });
    }

    // Exact anchor slot clue (fallback if needed)
    for (const slotIdx of shuffleWithRng(rng, [0, 3, 1, 2])) {
      const g = gearById.get(sol[slotIdx])!;
      pool.push({
        text: `Slot ${slotIdx + 1} requires the ${g.label} gear.`,
        check: (o) => o[slotIdx] === g.id,
      });
    }

    const selected: PermClue[] = [];
    let surviving = allPerms;
    for (const clue of pool) {
      if (surviving.length === 1) break;
      if (selected.length >= 4) break;
      const next = surviving.filter((o) => clue.check(o));
      if (next.length < surviving.length && next.length >= 1) {
        selected.push(clue);
        surviving = next;
      }
    }

    if (surviving.length !== 1) continue;
    if (surviving[0].some((id, idx) => id !== sol[idx])) continue;

    const signature = `mech-gear:${sol.join(',')}:${gears[0].teeth}`;
    if (used.has(signature) && attempt < 50) continue;
    used.add(signature);

    return {
      id: 'mech-stage-2',
      signature,
      kind: 'gears',
      title: 'Stage 2 · Meshing Gear Train Assembly',
      instructions:
        'Mount all 4 gears into Slots 1–4 (Drive → Output) in the exact meshing order described by the blueprints.',
      gears,
      clues: selected.map((c) => c.text),
      solutionOrder: sol,
      hint: 'Pair up any gears that must sit directly next to each other first, then place them using the slot rules.',
    };
  }
  throw new Error('Failed to generate Mechanical Stage 2 (Gears)');
}

function generateMechanicalStage3Circuits(
  rng: () => number,
  used: Set<string>
): MechanicalCircuitStageData {
  const cables: CircuitCableSpec[] = [
    { id: 'wire-red', code: 'IN-1', label: 'Red Conduit', colorHex: '#ef4444' },
    { id: 'wire-cyan', code: 'IN-2', label: 'Cyan Conduit', colorHex: '#38bdf8' },
    { id: 'wire-amber', code: 'IN-3', label: 'Amber Conduit', colorHex: '#f59e0b' },
    { id: 'wire-emerald', code: 'IN-4', label: 'Emerald Conduit', colorHex: '#22c55e' },
  ];
  const portLabels: [string, string, string, string] = ['PORT A', 'PORT B', 'PORT C', 'PORT D'];
  const allPerms = permute(cables.map((c) => c.id));
  const cableById = new Map(cables.map((c) => [c.id, c]));

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const sol = pickOne(rng, allPerms) as [string, string, string, string];

    interface WireClue {
      text: string;
      check: (ports: string[]) => boolean;
    }

    const pool: WireClue[] = [];

    // Adjacency clues
    for (const idx of shuffleWithRng(rng, [0, 1, 2])) {
      const c1 = cableById.get(sol[idx])!;
      const c2 = cableById.get(sol[idx + 1])!;
      pool.push({
        text: `${c2.code} (${c2.label}) connects immediately to the RIGHT of ${c1.code} (${c1.label}).`,
        check: (p) => p.indexOf(c2.id) === p.indexOf(c1.id) + 1,
      });
    }

    // Left-of ordering clues
    for (const [i, j] of shuffleWithRng(rng, [
      [0, 2],
      [1, 3],
      [0, 3],
    ] as [number, number][])) {
      const c1 = cableById.get(sol[i])!;
      const c2 = cableById.get(sol[j])!;
      pool.push({
        text: `${c1.code} (${c1.label}) is routed to an earlier port (left of) ${c2.code} (${c2.label}).`,
        check: (p) => p.indexOf(c1.id) < p.indexOf(c2.id),
      });
    }

    // Port exclusion clues
    for (const pIdx of shuffleWithRng(rng, [0, 1, 2, 3])) {
      const wrongId = pickOne(
        rng,
        cables.map((c) => c.id).filter((id) => id !== sol[pIdx])
      );
      const wrongC = cableById.get(wrongId)!;
      pool.push({
        text: `${portLabels[pIdx]} must NOT receive ${wrongC.code} (${wrongC.label}).`,
        check: (p) => p[pIdx] !== wrongId,
      });
    }

    // Direct terminal lock clue (used if needed to force unique solution)
    for (const pIdx of shuffleWithRng(rng, [0, 3, 1, 2])) {
      const c = cableById.get(sol[pIdx])!;
      pool.push({
        text: `${portLabels[pIdx]} is wired directly to ${c.code} (${c.label}).`,
        check: (p) => p[pIdx] === c.id,
      });
    }

    const selected: WireClue[] = [];
    let surviving = allPerms;
    for (const clue of pool) {
      if (surviving.length === 1) break;
      if (selected.length >= 4) break;
      const next = surviving.filter((p) => clue.check(p));
      if (next.length < surviving.length && next.length >= 1) {
        selected.push(clue);
        surviving = next;
      }
    }

    if (surviving.length !== 1) continue;
    if (surviving[0].some((id, idx) => id !== sol[idx])) continue;

    const signature = `mech-circ:${sol.join(',')}`;
    if (used.has(signature) && attempt < 50) continue;
    used.add(signature);

    return {
      id: 'mech-stage-3',
      signature,
      kind: 'circuits',
      title: 'Stage 3 · Circuit Conduit Routing',
      instructions:
        'Connect each of the 4 color-coded Input Conduits (IN-1..IN-4) to its matching Output Port (PORT A..D).',
      cables,
      portLabels,
      clues: selected.map((c) => c.text),
      solutionPorts: sol,
      hint: 'Lock in any direct port or adjacency pair first, then eliminate excluded ports to finish the circuit.',
    };
  }
  throw new Error('Failed to generate Mechanical Stage 3 (Circuits)');
}

export function generateMechanicalStages(
  rng: () => number,
  used: Set<string>
): MechanicalStageData[] {
  return [
    generateMechanicalStage1Switches(rng, used),
    generateMechanicalStage2Gears(rng, used),
    generateMechanicalStage3Circuits(rng, used),
  ];
}

// ============================================================================
// SESSION BUNDLE GENERATOR & STRICT INTEGRITY VALIDATOR
// ============================================================================
export function generatePuzzleSessionBundle(explicitSeed?: number): GeneratedPuzzleSession {
  sessionSeedCounter += 1;
  const seed =
    explicitSeed !== undefined
      ? explicitSeed >>> 0
      : ((Date.now() ^ Math.floor(Math.random() * 0xffffffff) ^ (sessionSeedCounter * 2654435761)) >>>
          0);

  const rng = createPrng(seed);
  const usedHistory = loadRecentHistorySet();

  const math = generateMathStages(rng, usedHistory);
  const cards = generateCardsStages(rng, usedHistory);
  const memory = generateMemoryStages(rng, usedHistory);
  const mechanical = generateMechanicalStages(rng, usedHistory);

  recordRecentSignatures([
    ...math.map((s) => s.signature),
    ...cards.map((s) => s.signature),
    ...memory.map((s) => s.signature),
    ...mechanical.map((s) => s.signature),
  ]);

  const bundle: GeneratedPuzzleSession = {
    seed,
    generatedAt: Date.now(),
    math,
    cards,
    memory,
    mechanical,
  };

  const validation = validatePuzzleSessionBundle(bundle);
  if (!validation.valid) {
    throw new Error(`Generated puzzle bundle failed validation: ${validation.errors.join('; ')}`);
  }

  return bundle;
}

export function getStageCountForCategory(
  bundle: GeneratedPuzzleSession,
  category: PuzzleCategoryId
): number {
  switch (category) {
    case 'math':
      return bundle.math.length;
    case 'cards':
      return bundle.cards.length;
    case 'memory':
      return bundle.memory.length;
    case 'mechanical':
      return bundle.mechanical.length;
  }
}

export function validatePuzzleSessionBundle(bundle: GeneratedPuzzleSession): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (bundle.math.length !== 4) errors.push(`Expected 4 math stages, got ${bundle.math.length}`);
  for (const s of bundle.math) {
    if (s.options.length !== 4) errors.push(`${s.id}: must have 4 options`);
    if (new Set(s.options).size !== 4) errors.push(`${s.id}: duplicate numeric options`);
    if (s.options[s.correctIndex] !== s.correctAnswer) {
      errors.push(`${s.id}: correctIndex mismatch`);
    }
  }

  if (bundle.cards.length !== 4) errors.push(`Expected 4 cards stages, got ${bundle.cards.length}`);
  for (const s of bundle.cards) {
    const uniqueFaces = new Set(s.options.map((c) => `${c.rank}-${c.suit}`));
    if (uniqueFaces.size !== s.options.length) errors.push(`${s.id}: duplicate card options`);
    if (s.options[s.correctIndex]?.id !== s.correctCardId) {
      errors.push(`${s.id}: correctCardId/correctIndex mismatch`);
    }
  }

  if (bundle.memory.length !== 3) errors.push(`Expected 3 memory stages, got ${bundle.memory.length}`);
  for (let i = 0; i < bundle.memory.length; i += 1) {
    const s = bundle.memory[i];
    const expectedLen = 5 + i;
    if (s.sequence.length !== expectedLen) {
      errors.push(`${s.id}: expected sequence length ${expectedLen}, got ${s.sequence.length}`);
    }
    const paletteIds = new Set(s.palette.map((p) => p.id));
    if (s.sequence.some((item) => !paletteIds.has(item.id))) {
      errors.push(`${s.id}: sequence token missing from palette`);
    }
  }

  if (bundle.mechanical.length !== 3) {
    errors.push(`Expected 3 mechanical stages, got ${bundle.mechanical.length}`);
  }
  for (const s of bundle.mechanical) {
    if (s.clues.length < 2) errors.push(`${s.id}: insufficient clues`);
    if (s.kind === 'switches' && s.solution.length !== 4) {
      errors.push(`${s.id}: switch solution must have 4 booleans`);
    }
    if (s.kind === 'gears' && new Set(s.solutionOrder).size !== 4) {
      errors.push(`${s.id}: gear solutionOrder must be a 4-gear permutation`);
    }
    if (s.kind === 'circuits' && new Set(s.solutionPorts).size !== 4) {
      errors.push(`${s.id}: circuit solutionPorts must be a 4-wire permutation`);
    }
  }

  return { valid: errors.length === 0, errors };
}
