import { PuzzleCategoryId } from '../types/game';
export {
  cardRankValue,
  cardSuitName,
  cardSuitSymbol,
  clearPuzzleHistoryForTests,
  generateCardsStages,
  generateMathStages,
  generateMechanicalStages,
  generateMemoryStages,
  generatePuzzleSessionBundle,
  getStageCountForCategory,
  isRedSuit,
  MEMORY_TOKEN_CATALOG,
  validatePuzzleSessionBundle,
  type CardRank,
  type CardsStageData,
  type CircuitCableSpec,
  type GearPieceSpec,
  type GeneratedPuzzleSession,
  type MathStageData,
  type MechanicalCircuitStageData,
  type MechanicalGearStageData,
  type MechanicalStageData,
  type MechanicalSwitchStageData,
  type MemoryStageData,
  type MemoryTokenIcon,
  type MemoryTokenSpec,
  type PlayingCardItem,
} from './puzzleGenerators';

// ============================================================================
// LAST EXIT — FOUR RANDOMIZED MINI-GAME CATEGORIES SPECIFICATION
// Completing ANY ONE selected category within 05:00 unlocks the Safe Room.
// ============================================================================

export const PUZZLE_TIME_LIMIT_SECONDS = 300; // 5 minutes
export const PUZZLE_MAX_ATTEMPTS = 3; // 3 attempts per stage

export const PUZZLE_CATEGORY_ORDER: PuzzleCategoryId[] = [
  'math',
  'cards',
  'memory',
  'mechanical',
];

export interface PuzzleCategorySpec {
  id: PuzzleCategoryId;
  gameNumber: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  accentHex: string;
  badgeText: string;
  stageCount: number;
  objective: string;
  rules: string[];
  example: string;
  controls: string;
  maxAttempts: number;
}

export const PUZZLE_CATEGORY_SPECS: Record<PuzzleCategoryId, PuzzleCategorySpec> = {
  math: {
    id: 'math',
    gameNumber: 'GAME 01',
    title: 'MATHEMATICS',
    shortTitle: 'Mathematics',
    subtitle: 'Arithmetic, Sequences & Logical Calculations',
    accentHex: '#38bdf8',
    badgeText: '4 STAGES · LOGIC & NUMBERS',
    stageCount: 4,
    objective:
      'Solve 4 procedurally generated 2–3 step math and sequence calculations to override the Safe Room lock.',
    rules: [
      'Each new game generates fresh arithmetic, missing-number sequences, variable deductions, and vault load problems.',
      'Work through 2–3 logical steps carefully and pick the single validated answer from 4 dynamic options.',
      'You have 3 attempts per stage while the 5-minute containment countdown is running.',
    ],
    example:
      'Example: Compute (6 × 5) + 14 − 9 → 30 + 14 = 44 → 44 − 9 = 35.',
    controls: 'Click an answer button or press keys 1–4.',
    maxAttempts: PUZZLE_MAX_ATTEMPTS,
  },
  cards: {
    id: 'cards',
    gameNumber: 'GAME 02',
    title: 'PLAYING CARDS',
    shortTitle: 'Playing Cards',
    subtitle: 'Card Matching, Missing Cards & Suit Logic',
    accentHex: '#ef4444',
    badgeText: '4 STAGES · SUITS & PATTERNS',
    stageCount: 4,
    objective:
      'Complete 4 accessible playing-card recognition and deduction stages — no advanced card knowledge required.',
    rules: [
      'Suit color guide: Hearts ♥ and Diamonds ♦ are RED; Spades ♠ and Clubs ♣ are BLACK.',
      'Stages cover alternating color/rank sequences, reference-card matching, 3-suit cycles, and hidden-card clues.',
      'Every card arrangement and clue set is freshly randomized each game with strictly one logical solution.',
    ],
    example:
      'Example: Sequence 4♥, 5♠, 6♥, ?, 8♥ → Suits alternate ♥/♠ and ranks increase by +1, so "?" is 7♠.',
    controls: 'Click the matching playing card (or press 1–6).',
    maxAttempts: PUZZLE_MAX_ATTEMPTS,
  },
  memory: {
    id: 'memory',
    gameNumber: 'GAME 03',
    title: 'MEMORY CHALLENGE',
    shortTitle: 'Memory Challenge',
    subtitle: 'Industrial Light, Symbol & Color Sequences',
    accentHex: '#a855f7',
    badgeText: '3 STAGES · 5 → 6 → 7 SIGNALS',
    stageCount: 3,
    objective:
      'Memorize 3 escalating sequences of glowing industrial lights, symbols, and colors, then reproduce them in order.',
    rules: [
      'Watch the glowing signal modules carefully during the timed reveal window before they go dark.',
      'Click modules from the signal tray to rebuild the exact left-to-right sequence. Sequence length grows from 5 → 6 → 7.',
      'You can click any filled slot to clear it, use Undo / Clear All, or spend 1 Quick Peek per stage before submitting.',
    ],
    example:
      'Example: Reveal shows [Red Beacon → Cyan Core → Amber Valve → Steel Gear → Emerald Lock] → rebuild in exact order and press Submit.',
    controls: 'Click signal modules to fill slots, click a slot to remove it, then click SUBMIT SEQUENCE.',
    maxAttempts: PUZZLE_MAX_ATTEMPTS,
  },
  mechanical: {
    id: 'mechanical',
    gameNumber: 'GAME 04',
    title: 'MECHANICAL LOGIC',
    shortTitle: 'Mechanical Logic',
    subtitle: 'Interactive Breakers, Gears & Circuit Routing',
    accentHex: '#f59e0b',
    badgeText: '3 STAGES · INTERACTIVE RIGS',
    stageCount: 3,
    objective:
      'Configure 3 interactive industrial mechanisms — Breaker Switches, a Meshing Gear Train, and a Circuit Patchboard.',
    rules: [
      'Stage 1: Flip the 4 circuit breakers ON/OFF to match every schematic relay rule.',
      'Stage 2: Place all 4 toothed gears into Drive Slots 1–4 following the meshing order blueprints.',
      'Stage 3: Route all 4 color-coded Input Conduits into Output Ports A–D according to the wiring clues.',
    ],
    example:
      'Example: If "24T Copper meshes immediately right of 12T Brass" and "Slot 1 is 12T Brass", then Slot 2 must hold 24T Copper.',
    controls: 'Click switches to toggle, or click gears/conduits and target slots/ports to connect and swap.',
    maxAttempts: PUZZLE_MAX_ATTEMPTS,
  },
};
