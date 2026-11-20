import { playerWorldPos } from './playerWorldState';

export type MusicMode =
  | 'menu'
  | 'intro'
  | 'gameplay'
  | 'stalking'
  | 'chase'
  | 'paused'
  | 'victory'
  | 'gameover';

export interface SpatialAudioPos {
  x: number;
  y: number;
  z: number;
}

export interface AudioSettings {
  enabled: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let currentSettings: AudioSettings = {
  enabled: true,
  masterVolume: 0.85,
  musicVolume: 0.6,
  sfxVolume: 0.85,
};

const lastChannelPlayMs = new Map<string, number>();
let activeVocalPriority = 0;
let activeVocalUntilMs = 0;

interface MusicGraph {
  subOsc: OscillatorNode;
  padOsc: OscillatorNode;
  fifthOsc: OscillatorNode;
  lfoOsc: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
  envGain: GainNode;
  activeMode: MusicMode;
}

let musicGraph: MusicGraph | null = null;
let desiredMusicMode: MusicMode = 'menu';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function canPlayChannel(channel: string, minIntervalMs: number): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const prev = lastChannelPlayMs.get(channel) ?? -Infinity;
  if (now - prev < minIntervalMs) {
    return false;
  }
  lastChannelPlayMs.set(channel, now);
  return true;
}

function ensureAudioGraph(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();

    masterGain = audioCtx.createGain();
    musicGain = audioCtx.createGain();
    sfxGain = audioCtx.createGain();

    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    applyGainValues();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function applyGainValues(): void {
  if (!audioCtx || !masterGain || !musicGain || !sfxGain) return;
  const now = audioCtx.currentTime;
  const masterVal = currentSettings.enabled ? clamp01(currentSettings.masterVolume) : 0;
  const musicVal = clamp01(currentSettings.musicVolume);
  const sfxVal = clamp01(currentSettings.sfxVolume);

  masterGain.gain.setTargetAtTime(masterVal, now, 0.03);
  musicGain.gain.setTargetAtTime(musicVal, now, 0.05);
  sfxGain.gain.setTargetAtTime(sfxVal, now, 0.02);
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.4);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

function tryClaimVocalChannel(
  channel: string,
  priority: number,
  cooldownMs: number,
  holdMs: number
): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now < activeVocalUntilMs && priority <= activeVocalPriority) {
    return false;
  }
  const prev = lastChannelPlayMs.get(channel) ?? -Infinity;
  if (now - prev < cooldownMs) {
    return false;
  }
  lastChannelPlayMs.set(channel, now);
  activeVocalPriority = priority;
  activeVocalUntilMs = now + holdMs;
  return true;
}

function getSfxDestination(ctx: AudioContext): AudioNode {
  return sfxGain ?? ctx.destination;
}

interface SpatialMetrics {
  pan: number;
  atten: number;
  muffleHz: number;
  distance: number;
}

function computeSpatialMetrics(pos?: SpatialAudioPos, maxRange = 30): SpatialMetrics {
  if (!pos) {
    return { pan: 0, atten: 1, muffleHz: 14000, distance: 0 };
  }
  const dx = pos.x - playerWorldPos.x;
  const dy = pos.y - playerWorldPos.feetY;
  const dz = pos.z - playerWorldPos.z;
  const floorGap = Math.abs(dy);
  const dist3D = Math.hypot(dx, dy * 1.45, dz);

  // Player basis vectors match PlayerController yaw convention
  const rightX = Math.cos(playerWorldPos.yaw);
  const rightZ = -Math.sin(playerWorldPos.yaw);
  const fwdX = -Math.sin(playerWorldPos.yaw);
  const fwdZ = -Math.cos(playerWorldPos.yaw);

  const horizDist = Math.max(0.75, Math.hypot(dx, dz));
  const rawPan = (dx * rightX + dz * rightZ) / horizDist;
  const pan = Math.max(-0.92, Math.min(0.92, rawPan));

  const frontDot = (dx * fwdX + dz * fwdZ) / horizDist; // +1 in front, -1 behind
  const behindFactor = frontDot < 0 ? Math.abs(frontDot) : 0;

  const normDist = Math.max(0, Math.min(1, dist3D / maxRange));
  const atten = Math.pow(1 - normDist, 1.55) * (floorGap > 2.2 ? 0.62 : 1);

  let muffleHz = 12500 - normDist * 7500 - behindFactor * 2800;
  if (floorGap > 2.2) {
    muffleHz = Math.min(muffleHz, 1350);
  }
  muffleHz = Math.max(650, Math.min(14000, muffleHz));

  return { pan, atten, muffleHz, distance: dist3D };
}

function createSpatialSfxBus(
  ctx: AudioContext,
  pos?: SpatialAudioPos,
  maxRange = 30
): { input: BiquadFilterNode; metrics: SpatialMetrics } {
  const metrics = computeSpatialMetrics(pos, maxRange);
  const dest = getSfxDestination(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = metrics.muffleHz;
  filter.Q.value = 0.7;

  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = metrics.pan;
    filter.connect(panner);
    panner.connect(dest);
  } else {
    filter.connect(dest);
  }

  return { input: filter, metrics };
}

/**
 * Unlocks / resumes the Web Audio API context on user interaction and initializes background music.
 */
export function initAudioContext(): void {
  const ctx = ensureAudioGraph();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  applyGainValues();
  syncMusicGraphToMode(desiredMusicMode);
}

/**
 * Updates master, music, SFX volume and mute state cleanly in real time.
 */
export function setAudioSettings(partial: Partial<AudioSettings>): void {
  currentSettings = {
    enabled: partial.enabled ?? currentSettings.enabled,
    masterVolume:
      partial.masterVolume !== undefined ? clamp01(partial.masterVolume) : currentSettings.masterVolume,
    musicVolume:
      partial.musicVolume !== undefined ? clamp01(partial.musicVolume) : currentSettings.musicVolume,
    sfxVolume:
      partial.sfxVolume !== undefined ? clamp01(partial.sfxVolume) : currentSettings.sfxVolume,
  };
  applyGainValues();
  if (musicGraph) {
    syncMusicGraphToMode(desiredMusicMode);
  }
}

function ensureMusicGraph(ctx: AudioContext): MusicGraph | null {
  if (!musicGain) return null;
  if (musicGraph) return musicGraph;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  filter.Q.value = 1.6;

  const envGain = ctx.createGain();
  envGain.gain.value = 0.0001;

  const subOsc = ctx.createOscillator();
  subOsc.type = 'triangle';
  subOsc.frequency.value = 55;

  const padOsc = ctx.createOscillator();
  padOsc.type = 'sawtooth';
  padOsc.frequency.value = 82.41;

  const fifthOsc = ctx.createOscillator();
  fifthOsc.type = 'sine';
  fifthOsc.frequency.value = 110;

  const padGain = ctx.createGain();
  padGain.gain.value = 0.24;

  const subGain = ctx.createGain();
  subGain.gain.value = 0.42;

  const fifthGain = ctx.createGain();
  fifthGain.gain.value = 0.2;

  const lfoOsc = ctx.createOscillator();
  lfoOsc.type = 'sine';
  lfoOsc.frequency.value = 0.22;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 45;

  lfoOsc.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  subOsc.connect(subGain);
  padOsc.connect(padGain);
  fifthOsc.connect(fifthGain);

  subGain.connect(filter);
  padGain.connect(filter);
  fifthGain.connect(filter);

  filter.connect(envGain);
  envGain.connect(musicGain);

  const now = ctx.currentTime;
  subOsc.start(now);
  padOsc.start(now);
  fifthOsc.start(now);
  lfoOsc.start(now);

  musicGraph = {
    subOsc,
    padOsc,
    fifthOsc,
    lfoOsc,
    lfoGain,
    filter,
    envGain,
    activeMode: desiredMusicMode,
  };
  return musicGraph;
}

function syncMusicGraphToMode(mode: MusicMode): void {
  if (typeof window === 'undefined' || !audioCtx) return;
  const graph = ensureMusicGraph(audioCtx);
  if (!graph) return;

  const now = audioCtx.currentTime;
  graph.activeMode = mode;

  if (!currentSettings.enabled) {
    graph.envGain.gain.setTargetAtTime(0.0001, now, 0.08);
    return;
  }

  switch (mode) {
    case 'menu':
      graph.subOsc.frequency.setTargetAtTime(55, now, 0.25);
      graph.padOsc.frequency.setTargetAtTime(82.41, now, 0.25);
      graph.fifthOsc.frequency.setTargetAtTime(110, now, 0.25);
      graph.filter.frequency.setTargetAtTime(220, now, 0.3);
      graph.lfoOsc.frequency.setTargetAtTime(0.22, now, 0.25);
      graph.lfoGain.gain.setTargetAtTime(45, now, 0.25);
      graph.envGain.gain.setTargetAtTime(0.11, now, 0.25);
      break;
    case 'intro':
      graph.subOsc.frequency.setTargetAtTime(49, now, 0.45);
      graph.padOsc.frequency.setTargetAtTime(73.42, now, 0.45);
      graph.fifthOsc.frequency.setTargetAtTime(110, now, 0.45);
      graph.filter.frequency.setTargetAtTime(255, now, 0.5);
      graph.lfoOsc.frequency.setTargetAtTime(0.16, now, 0.4);
      graph.lfoGain.gain.setTargetAtTime(58, now, 0.4);
      graph.envGain.gain.setTargetAtTime(0.102, now, 0.4);
      break;
    case 'gameplay':
      graph.subOsc.frequency.setTargetAtTime(49, now, 0.25);
      graph.padOsc.frequency.setTargetAtTime(73.42, now, 0.25);
      graph.fifthOsc.frequency.setTargetAtTime(98, now, 0.25);
      graph.filter.frequency.setTargetAtTime(190, now, 0.3);
      graph.lfoOsc.frequency.setTargetAtTime(0.35, now, 0.25);
      graph.lfoGain.gain.setTargetAtTime(52, now, 0.25);
      graph.envGain.gain.setTargetAtTime(0.09, now, 0.25);
      break;
    case 'stalking':
      graph.subOsc.frequency.setTargetAtTime(51.91, now, 0.22);
      graph.padOsc.frequency.setTargetAtTime(77.78, now, 0.22);
      graph.fifthOsc.frequency.setTargetAtTime(103.83, now, 0.22);
      graph.filter.frequency.setTargetAtTime(300, now, 0.25);
      graph.lfoOsc.frequency.setTargetAtTime(1.35, now, 0.2);
      graph.lfoGain.gain.setTargetAtTime(95, now, 0.2);
      graph.envGain.gain.setTargetAtTime(0.118, now, 0.22);
      break;
    case 'chase':
      graph.subOsc.frequency.setTargetAtTime(58.27, now, 0.15);
      graph.padOsc.frequency.setTargetAtTime(87.31, now, 0.15);
      graph.fifthOsc.frequency.setTargetAtTime(116.54, now, 0.15);
      graph.filter.frequency.setTargetAtTime(470, now, 0.15);
      graph.lfoOsc.frequency.setTargetAtTime(4.2, now, 0.15);
      graph.lfoGain.gain.setTargetAtTime(140, now, 0.15);
      graph.envGain.gain.setTargetAtTime(0.145, now, 0.15);
      break;
    case 'paused':
      graph.filter.frequency.setTargetAtTime(125, now, 0.15);
      graph.lfoOsc.frequency.setTargetAtTime(0.15, now, 0.15);
      graph.lfoGain.gain.setTargetAtTime(18, now, 0.15);
      graph.envGain.gain.setTargetAtTime(0.045, now, 0.15);
      break;
    case 'victory':
      graph.subOsc.frequency.setTargetAtTime(65.41, now, 0.3);
      graph.padOsc.frequency.setTargetAtTime(98.0, now, 0.3);
      graph.fifthOsc.frequency.setTargetAtTime(130.81, now, 0.3);
      graph.filter.frequency.setTargetAtTime(340, now, 0.3);
      graph.lfoOsc.frequency.setTargetAtTime(0.3, now, 0.3);
      graph.lfoGain.gain.setTargetAtTime(35, now, 0.3);
      graph.envGain.gain.setTargetAtTime(0.08, now, 0.35);
      break;
    case 'gameover':
      graph.subOsc.frequency.setTargetAtTime(41.2, now, 0.35);
      graph.padOsc.frequency.setTargetAtTime(61.74, now, 0.35);
      graph.fifthOsc.frequency.setTargetAtTime(82.41, now, 0.35);
      graph.filter.frequency.setTargetAtTime(140, now, 0.3);
      graph.lfoOsc.frequency.setTargetAtTime(0.18, now, 0.3);
      graph.lfoGain.gain.setTargetAtTime(20, now, 0.3);
      graph.envGain.gain.setTargetAtTime(0.055, now, 0.35);
      break;
  }
}

/**
 * Transitions the singleton background industrial music synthesizer cleanly across game states.
 * Never creates duplicate overlapping music loops.
 */
export function updateBackgroundMusic(mode: MusicMode): void {
  desiredMusicMode = mode;
  if (typeof window === 'undefined' || !audioCtx) return;
  syncMusicGraphToMode(mode);
}

/**
 * Tactile UI / Menu button click & confirmation sound.
 */
export function playMenuClickSound(confirm = false, enabled = currentSettings.enabled): void {
  if (!enabled) return;
  if (!canPlayChannel('menu-click', 55)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = confirm ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(confirm ? 520 : 680, now);
  osc.frequency.exponentialRampToValueAtTime(confirm ? 820 : 480, now + (confirm ? 0.14 : 0.055));

  gain.gain.setValueAtTime(confirm ? 0.085 : 0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (confirm ? 0.16 : 0.065));

  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + (confirm ? 0.17 : 0.07));
}

/**
 * Player walking and sprinting footstep sounds on industrial concrete/metal corridors.
 */
export function playPlayerFootstepSound(sprinting: boolean, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('player-step', sprinting ? 210 : 340)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const vol = sprinting ? 0.095 : 0.052;

  // Low boot heel impact
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = 'triangle';
  const pitchJitter = 0.94 + Math.random() * 0.12;
  thud.frequency.setValueAtTime((sprinting ? 128 : 98) * pitchJitter, now);
  thud.frequency.exponentialRampToValueAtTime(38, now + 0.085);

  thudGain.gain.setValueAtTime(vol, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

  thud.connect(thudGain);
  thudGain.connect(dest);
  thud.start(now);
  thud.stop(now + 0.1);

  // Subtle sole grit / concrete scrape using filtered noise burst
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(sprinting ? 1400 : 950, now);
  filter.Q.value = 1.4;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.42, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  src.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);
  src.start(now);
  src.stop(now + 0.075);
}

/**
 * Procedural heavy armored hinge door swing + hydraulic unlatch sound.
 */
export function playDoorSound(opening: boolean, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('door-swing', 240)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(opening ? 95 : 140, now);
  osc.frequency.exponentialRampToValueAtTime(opening ? 150 : 68, now + 0.32);

  gain.gain.setValueAtTime(0.095, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + 0.36);

  const latch = ctx.createOscillator();
  const latchGain = ctx.createGain();
  latch.type = 'triangle';
  latch.frequency.setValueAtTime(opening ? 520 : 340, now + 0.03);
  latchGain.gain.setValueAtTime(0.07, now + 0.03);
  latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  latch.connect(latchGain);
  latchGain.connect(dest);
  latch.start(now + 0.03);
  latch.stop(now + 0.15);
}

/**
 * Metallic locked-door rejection thud.
 */
export function playLockedDoorSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('door-locked', 200)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(135, now);
  osc.frequency.setValueAtTime(98, now + 0.07);

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + 0.17);
}

/**
 * Keycard / security key pickup harmonic chime.
 */
export function playKeyPickupSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('key-pickup', 350)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const freqs = [587.33, 880, 1174.66];
  freqs.forEach((f, idx) => {
    const start = now + idx * 0.075;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, start);
    gain.gain.setValueAtTime(0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + 0.25);
  });
}

/**
 * Mission completion confirmation sequence.
 */
export function playMissionCompleteSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('mission-complete', 700)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const notes = [440, 554.37, 659.25, 880];
  notes.forEach((freq, i) => {
    const start = now + i * 0.095;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.09, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + 0.35);
  });
}

/**
 * Puzzle solved sound (elevated triumphant cadence when all 5 puzzles unlock the final exit).
 */
export function playPuzzleCompleteSound(allCompleted: boolean, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('puzzle-complete', 400)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const notes = allCompleted ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const start = now + i * 0.085;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(allCompleted ? 0.1 : 0.075, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + 0.32);
  });
}

/**
 * Victory / final escape chord chime.
 */
export function playVictoryEscapeSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('victory-escape', 1200)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const chord = [392.0, 493.88, 587.33, 783.99, 987.77];
  chord.forEach((freq, idx) => {
    const start = now + idx * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.095, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + 0.68);
  });
}

/**
 * Industrial beast alert klaxon pulse when Mission or Puzzle Chamber activates.
 */
export function playBeastAlertSiren(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('beast-alert-siren', 850)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const start = now + i * 0.42;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(310, start);
    osc.frequency.linearRampToValueAtTime(540, start + 0.25);

    gain.gain.setValueAtTime(0.085, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + 0.38);
  }
}

/**
 * Heavy leather-boot footsteps on apartment concrete, with subtle hip-chain rattle when sprinting
 * and full 3D stereo panning + floor muffling.
 */
export function playBeastFootstepSound(
  distance: number,
  running: boolean,
  enabled: boolean,
  pos?: SpatialAudioPos,
  beastId?: number,
  voicePitch = 1.0
): void {
  if (!enabled || distance > 30) return;
  const channel = beastId !== undefined ? `beast-step-${beastId}` : 'beast-step';
  if (!canPlayChannel(channel, running ? 165 : 275)) return;
  // Global density cap so 4 Hunters walking simultaneously never distort or clip
  if (!canPlayChannel('beast-step-global', 75)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 30);
  const atten = pos ? metrics.atten : Math.pow(Math.max(0, 1 - distance / 30), 1.5);
  const volume = (running ? 0.135 : 0.082) * atten;
  if (volume < 0.003) return;

  const now = ctx.currentTime;
  const jitter = (0.92 + Math.random() * 0.16) * voicePitch;

  // Heavy leather boot heel thud
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime((running ? 105 : 82) * jitter, now);
  thud.frequency.exponentialRampToValueAtTime(28, now + 0.12);
  thudGain.gain.setValueAtTime(volume, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.135);
  thud.connect(thudGain);
  thudGain.connect(input);
  thud.start(now);
  thud.stop(now + 0.145);

  // Concrete sole scuff grit
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const gritFilter = ctx.createBiquadFilter();
  gritFilter.type = 'bandpass';
  gritFilter.frequency.setValueAtTime((running ? 980 : 680) * jitter, now);
  gritFilter.Q.value = 1.2;
  const gritGain = ctx.createGain();
  gritGain.gain.setValueAtTime(volume * 0.55, now);
  gritGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  src.connect(gritFilter);
  gritFilter.connect(gritGain);
  gritGain.connect(input);
  src.start(now);
  src.stop(now + 0.095);

  // Subtle hip chain metallic clink during heavy strides
  if (running || atten > 0.35) {
    const chain = ctx.createBufferSource();
    chain.buffer = getNoiseBuffer(ctx);
    const chainFilter = ctx.createBiquadFilter();
    chainFilter.type = 'bandpass';
    chainFilter.frequency.setValueAtTime(3600 * jitter, now + 0.02);
    chainFilter.Q.value = 4.5;
    const chainGain = ctx.createGain();
    chainGain.gain.setValueAtTime(volume * (running ? 0.22 : 0.09), now + 0.02);
    chainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    chain.connect(chainFilter);
    chainFilter.connect(chainGain);
    chainGain.connect(input);
    chain.start(now + 0.02);
    chain.stop(now + 0.09);
  }
}

/**
 * Deep, intimidating warrior breathing when idle or stalking close by.
 */
export function playBeastBreathingSound(
  pos: SpatialAudioPos | undefined,
  intense: boolean,
  enabled: boolean
): void {
  if (!enabled) return;
  if (!tryClaimVocalChannel('beast-breath', 1, intense ? 2400 : 3800, 680)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 18);
  if (metrics.atten < 0.04) return;
  const vol = (intense ? 0.075 : 0.05) * metrics.atten;
  const now = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;

  const throatFilter = ctx.createBiquadFilter();
  throatFilter.type = 'bandpass';
  throatFilter.frequency.setValueAtTime(intense ? 460 : 320, now);
  throatFilter.frequency.linearRampToValueAtTime(intense ? 260 : 210, now + 0.62);
  throatFilter.Q.value = 2.6;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(vol, now + 0.16);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.66);

  src.connect(throatFilter);
  throatFilter.connect(env);
  env.connect(input);
  src.start(now);
  src.stop(now + 0.68);

  // Subtle low chest vocal cord rasp
  const chest = ctx.createOscillator();
  const chestGain = ctx.createGain();
  chest.type = 'sawtooth';
  chest.frequency.setValueAtTime(intense ? 82 : 66, now);
  chest.frequency.linearRampToValueAtTime(54, now + 0.58);
  const chestLp = ctx.createBiquadFilter();
  chestLp.type = 'lowpass';
  chestLp.frequency.value = 180;
  chestGain.gain.setValueAtTime(0.001, now);
  chestGain.gain.linearRampToValueAtTime(vol * 0.45, now + 0.15);
  chestGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  chest.connect(chestLp);
  chestLp.connect(chestGain);
  chestGain.connect(input);
  chest.start(now);
  chest.stop(now + 0.62);
}

/**
 * Low, frightening guttural warrior growl while prowling, investigating, or searching.
 */
export function playBeastGrowlSound(
  pos: SpatialAudioPos | undefined,
  enabled: boolean,
  beastId?: number,
  voicePitch = 1.0
): void {
  if (!enabled) return;
  const channel = beastId !== undefined ? `beast-growl-${beastId}` : 'beast-growl';
  if (!tryClaimVocalChannel(channel, 2, 4600, 680)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 28);
  if (metrics.atten < 0.03) return;
  const vol = 0.11 * metrics.atten;
  const now = ctx.currentTime;

  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  oscA.type = 'sawtooth';
  oscB.type = 'sawtooth';
  const pitch = (66 + Math.random() * 10) * voicePitch;
  oscA.frequency.setValueAtTime(pitch, now);
  oscA.frequency.linearRampToValueAtTime(pitch * 1.12, now + 0.24);
  oscA.frequency.exponentialRampToValueAtTime(pitch * 0.78, now + 0.74);

  oscB.frequency.setValueAtTime(pitch * 1.07, now);
  oscB.frequency.exponentialRampToValueAtTime(pitch * 0.82, now + 0.74);

  // Throat flutter LFO for raw guttural rumble
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 23;
  lfoGain.gain.value = 0.35;

  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.setValueAtTime(290, now);
  formant.frequency.linearRampToValueAtTime(420, now + 0.25);
  formant.frequency.linearRampToValueAtTime(220, now + 0.74);
  formant.Q.value = 2.2;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.002, now);
  master.gain.linearRampToValueAtTime(vol, now + 0.14);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.76);

  lfo.connect(lfoGain);
  lfoGain.connect(master.gain);

  oscA.connect(formant);
  oscB.connect(formant);
  formant.connect(master);
  master.connect(input);

  // Breathy throat grit layer
  const breath = ctx.createBufferSource();
  breath.buffer = getNoiseBuffer(ctx);
  breath.loop = true;
  const bFilter = ctx.createBiquadFilter();
  bFilter.type = 'bandpass';
  bFilter.frequency.value = 580;
  bFilter.Q.value = 1.8;
  const bGain = ctx.createGain();
  bGain.gain.setValueAtTime(0.001, now);
  bGain.gain.linearRampToValueAtTime(vol * 0.48, now + 0.15);
  bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
  breath.connect(bFilter);
  bFilter.connect(bGain);
  bGain.connect(input);

  oscA.start(now);
  oscB.start(now);
  lfo.start(now);
  breath.start(now);

  oscA.stop(now + 0.78);
  oscB.stop(now + 0.78);
  lfo.stop(now + 0.78);
  breath.stop(now + 0.74);
}

/**
 * Leather & chain rustle + subtle wary exhale when Warrior turns or scans in Search/Patrol.
 * Preserves export name for backward compatibility without any robotic servo sound.
 */
export function playBeastServoSound(
  distance: number,
  enabled: boolean,
  pos?: SpatialAudioPos
): void {
  if (!enabled || distance > 24) return;
  if (!canPlayChannel('beast-servo', 420)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 24);
  const atten = pos ? metrics.atten : Math.max(0, 1 - distance / 24);
  const volume = 0.048 * atten;
  if (volume < 0.003) return;

  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1150, now);
  filter.frequency.linearRampToValueAtTime(720, now + 0.24);
  filter.Q.value = 1.6;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.002, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(input);
  src.start(now);
  src.stop(now + 0.26);
}

/**
 * Aggressive warrior snarl/shout + cold steel blade draw hiss when Beast detects the player.
 */
export function playBeastDetectSound(
  enabled: boolean,
  pos?: SpatialAudioPos,
  beastId?: number,
  voicePitch = 1.0
): void {
  if (!enabled) return;
  const channel = beastId !== undefined ? `beast-detect-${beastId}` : 'beast-detect';
  if (!tryClaimVocalChannel(channel, 3, 650, 480)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 34);
  const vol = 0.14 * Math.max(0.32, metrics.atten);
  const now = ctx.currentTime;

  // Sharp aggressive vocal shout
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc2.type = 'sawtooth';
  osc.frequency.setValueAtTime(125 * voicePitch, now);
  osc.frequency.exponentialRampToValueAtTime(205 * voicePitch, now + 0.09);
  osc.frequency.exponentialRampToValueAtTime(102 * voicePitch, now + 0.42);
  osc2.frequency.setValueAtTime(132 * voicePitch, now);
  osc2.frequency.exponentialRampToValueAtTime(214 * voicePitch, now + 0.09);
  osc2.frequency.exponentialRampToValueAtTime(108 * voicePitch, now + 0.42);

  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.setValueAtTime(580, now);
  formant.frequency.linearRampToValueAtTime(920, now + 0.12);
  formant.frequency.linearRampToValueAtTime(420, now + 0.42);
  formant.Q.value = 2.0;

  const vGain = ctx.createGain();
  vGain.gain.setValueAtTime(0.002, now);
  vGain.gain.linearRampToValueAtTime(vol, now + 0.045);
  vGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

  osc.connect(formant);
  osc2.connect(formant);
  formant.connect(vGain);
  vGain.connect(input);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.46);
  osc2.stop(now + 0.46);

  // Subtle steel blade raise rasp
  const rasp = ctx.createBufferSource();
  rasp.buffer = getNoiseBuffer(ctx);
  const rFilter = ctx.createBiquadFilter();
  rFilter.type = 'bandpass';
  rFilter.frequency.setValueAtTime(2200, now + 0.04);
  rFilter.frequency.exponentialRampToValueAtTime(3800, now + 0.24);
  rFilter.Q.value = 3.5;
  const rGain = ctx.createGain();
  rGain.gain.setValueAtTime(vol * 0.28, now + 0.04);
  rGain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
  rasp.connect(rFilter);
  rFilter.connect(rGain);
  rGain.connect(input);
  rasp.start(now + 0.04);
  rasp.stop(now + 0.28);
}

/**
 * Terrifying warrior battle cry / scream when chase starts + fierce chase shouts.
 */
export function playBeastBattleCrySound(
  pos: SpatialAudioPos | undefined,
  isInitialChase: boolean,
  enabled: boolean,
  beastId?: number,
  voicePitch = 1.0
): void {
  if (!enabled) return;
  const suffix = beastId !== undefined ? `-${beastId}` : '';
  if (
    !tryClaimVocalChannel(
      (isInitialChase ? 'beast-battle-cry-init' : 'beast-battle-cry') + suffix,
      4,
      isInitialChase ? 850 : 3400,
      isInitialChase ? 820 : 560
    )
  ) {
    return;
  }
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 36);
  const vol = (isInitialChase ? 0.155 : 0.12) * Math.max(0.28, metrics.atten);
  const now = ctx.currentTime;
  const dur = isInitialChase ? 0.88 : 0.55;

  const glottisA = ctx.createOscillator();
  const glottisB = ctx.createOscillator();
  glottisA.type = 'sawtooth';
  glottisB.type = 'sawtooth';

  if (isInitialChase) {
    glottisA.frequency.setValueAtTime(145 * voicePitch, now);
    glottisA.frequency.exponentialRampToValueAtTime(285 * voicePitch, now + 0.16);
    glottisA.frequency.linearRampToValueAtTime(235 * voicePitch, now + 0.45);
    glottisA.frequency.exponentialRampToValueAtTime(118 * voicePitch, now + dur);

    glottisB.frequency.setValueAtTime(151 * voicePitch, now);
    glottisB.frequency.exponentialRampToValueAtTime(294 * voicePitch, now + 0.16);
    glottisB.frequency.exponentialRampToValueAtTime(124 * voicePitch, now + dur);
  } else {
    glottisA.frequency.setValueAtTime(135 * voicePitch, now);
    glottisA.frequency.exponentialRampToValueAtTime(215 * voicePitch, now + 0.11);
    glottisA.frequency.exponentialRampToValueAtTime(108 * voicePitch, now + dur);

    glottisB.frequency.setValueAtTime(141 * voicePitch, now);
    glottisB.frequency.exponentialRampToValueAtTime(222 * voicePitch, now + 0.11);
    glottisB.frequency.exponentialRampToValueAtTime(112 * voicePitch, now + dur);
  }

  const formantLow = ctx.createBiquadFilter();
  formantLow.type = 'bandpass';
  formantLow.frequency.setValueAtTime(isInitialChase ? 640 : 540, now);
  formantLow.frequency.linearRampToValueAtTime(1080, now + 0.18);
  formantLow.frequency.linearRampToValueAtTime(460, now + dur);
  formantLow.Q.value = 1.9;

  const screamGain = ctx.createGain();
  screamGain.gain.setValueAtTime(0.002, now);
  screamGain.gain.linearRampToValueAtTime(vol, now + 0.06);
  screamGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  glottisA.connect(formantLow);
  glottisB.connect(formantLow);
  formantLow.connect(screamGain);
  screamGain.connect(input);

  // Hoarse scream breath air layer
  const air = ctx.createBufferSource();
  air.buffer = getNoiseBuffer(ctx);
  air.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'bandpass';
  airFilter.frequency.value = 1280;
  airFilter.Q.value = 1.4;
  const airGain = ctx.createGain();
  airGain.gain.setValueAtTime(0.001, now);
  airGain.gain.linearRampToValueAtTime(vol * 0.45, now + 0.07);
  airGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(input);

  glottisA.start(now);
  glottisB.start(now);
  air.start(now);
  glottisA.stop(now + dur + 0.02);
  glottisB.stop(now + dur + 0.02);
  air.stop(now + dur);
}

/**
 * Realistic broadsword metallic air-whoosh / swishing sound during aggressive swings & attacks.
 */
export function playBeastSwordSwishSound(
  pos: SpatialAudioPos | undefined,
  heavyAttack: boolean,
  enabled: boolean
): void {
  if (!enabled) return;
  if (!canPlayChannel('beast-sword-swish', heavyAttack ? 180 : 650)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 26);
  const vol = (heavyAttack ? 0.165 : 0.085) * Math.max(0.2, metrics.atten);
  if (vol < 0.004) return;

  const now = ctx.currentTime;
  const dur = heavyAttack ? 0.34 : 0.24;

  const whoosh = ctx.createBufferSource();
  whoosh.buffer = getNoiseBuffer(ctx);
  const sweep = ctx.createBiquadFilter();
  sweep.type = 'bandpass';
  sweep.frequency.setValueAtTime(360, now);
  sweep.frequency.exponentialRampToValueAtTime(heavyAttack ? 2450 : 1850, now + dur * 0.42);
  sweep.frequency.exponentialRampToValueAtTime(420, now + dur);
  sweep.Q.value = 1.8;

  const wGain = ctx.createGain();
  wGain.gain.setValueAtTime(0.002, now);
  wGain.gain.linearRampToValueAtTime(vol, now + dur * 0.35);
  wGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  whoosh.connect(sweep);
  sweep.connect(wGain);
  wGain.connect(input);
  whoosh.start(now);
  whoosh.stop(now + dur + 0.02);

  // Subtle cold steel edge ring
  const edge = ctx.createOscillator();
  const edgeGain = ctx.createGain();
  edge.type = 'sine';
  edge.frequency.setValueAtTime(heavyAttack ? 1720 : 1480, now + 0.03);
  edge.frequency.exponentialRampToValueAtTime(980, now + dur);
  edgeGain.gain.setValueAtTime(vol * 0.18, now + 0.03);
  edgeGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  edge.connect(edgeGain);
  edgeGain.connect(input);
  edge.start(now + 0.03);
  edge.stop(now + dur + 0.02);
}

/**
 * Deep suspenseful pursuit heartbeat throb during active Chase state.
 */
export function playBeastChasePulseSound(
  distance: number,
  enabled: boolean,
  pos?: SpatialAudioPos
): void {
  if (!enabled) return;
  if (!canPlayChannel('beast-chase-pulse', 820)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 36);
  const atten = pos ? Math.max(0.25, metrics.atten) : Math.max(0.25, Math.min(1, 1 - distance / 34));
  const now = ctx.currentTime;

  const beats = [0, 0.18];
  beats.forEach((offset, idx) => {
    const t = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(idx === 0 ? 64 : 54, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.14);

    gain.gain.setValueAtTime((idx === 0 ? 0.11 : 0.075) * atten, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(input);
    osc.start(t);
    osc.stop(t + 0.17);
  });
}

/**
 * Heavy broadsword cleave impact + frightening dread sting when Beast captures the player.
 */
export function playBeastCaptureSound(enabled: boolean, pos?: SpatialAudioPos): void {
  if (!enabled) return;
  if (!tryClaimVocalChannel('beast-capture', 5, 650, 950)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input } = createSpatialSfxBus(ctx, pos, 32);
  const now = ctx.currentTime;

  // Heavy low cleave impact
  const impact = ctx.createOscillator();
  const impactGain = ctx.createGain();
  impact.type = 'triangle';
  impact.frequency.setValueAtTime(125, now);
  impact.frequency.exponentialRampToValueAtTime(28, now + 0.45);
  impactGain.gain.setValueAtTime(0.18, now);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
  impact.connect(impactGain);
  impactGain.connect(input);
  impact.start(now);
  impact.stop(now + 0.54);

  // Brutal metallic strike transient
  const strikeNoise = ctx.createBufferSource();
  strikeNoise.buffer = getNoiseBuffer(ctx);
  const nFilter = ctx.createBiquadFilter();
  nFilter.type = 'bandpass';
  nFilter.frequency.setValueAtTime(1600, now);
  nFilter.frequency.exponentialRampToValueAtTime(340, now + 0.25);
  nFilter.Q.value = 1.1;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.16, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  strikeNoise.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(input);
  strikeNoise.start(now);
  strikeNoise.stop(now + 0.3);

  // Dark ringing steel & ominous descending dread chord
  const ringFreqs = [233.08, 311.13];
  ringFreqs.forEach((f) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(f * 0.62, now + 0.85);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 780;
    gain.gain.setValueAtTime(0.065, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(input);
    osc.start(now + 0.05);
    osc.stop(now + 0.9);
  });
}

export function playKeypadBeep(freq: number, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('keypad', 40)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + 0.09);
}

export function playFloorSwitchSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('floor-switch', 80)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(640, now + 0.07);

  gain.gain.setValueAtTime(0.055, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + 0.1);
}

/**
 * Subtle countdown warning tone at 60s (single chime) and 30s (double pulse).
 */
export function playTimerWarningSound(critical: boolean, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('timer-warning', 600)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const pulses = critical ? [0, 0.18] : [0];
  pulses.forEach((offset) => {
    const start = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(critical ? 740 : 540, start);
    gain.gain.setValueAtTime(critical ? 0.08 : 0.055, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + 0.15);
  });
}

// ============================================================================
// BUILDING-WIDE EMERGENCY ALARM SIREN (GENUINE KEY PICKUP EVENT)
// ============================================================================

let emergencySirenTimer: ReturnType<typeof setInterval> | null = null;
let emergencySirenPulseCount = 0;

function triggerEmergencySirenPulse(): void {
  if (!currentSettings.enabled) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  // Original industrial dual-horn warble siren (loud, unmistakable, non-clipping)
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  oscA.type = 'sawtooth';
  oscB.type = 'triangle';

  oscA.frequency.setValueAtTime(420, now);
  oscA.frequency.exponentialRampToValueAtTime(860, now + 0.46);
  oscA.frequency.exponentialRampToValueAtTime(410, now + 0.92);

  oscB.frequency.setValueAtTime(630, now);
  oscB.frequency.exponentialRampToValueAtTime(1290, now + 0.46);
  oscB.frequency.exponentialRampToValueAtTime(615, now + 0.92);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1050, now);
  filter.Q.value = 1.25;

  gain.gain.setValueAtTime(0.002, now);
  gain.gain.linearRampToValueAtTime(0.115, now + 0.08);
  gain.gain.setValueAtTime(0.11, now + 0.72);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.98);

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  oscA.start(now);
  oscB.start(now);
  oscA.stop(now + 1.0);
  oscB.stop(now + 1.0);
}

/**
 * Starts the building-wide emergency alarm siren (pulses for ~20s or until explicitly stopped).
 */
export function startEmergencyAlarmSiren(enabled = currentSettings.enabled): void {
  stopEmergencyAlarmSiren();
  if (!enabled) return;
  emergencySirenPulseCount = 0;
  triggerEmergencySirenPulse();
  emergencySirenPulseCount = 1;

  if (typeof window !== 'undefined') {
    emergencySirenTimer = setInterval(() => {
      emergencySirenPulseCount += 1;
      if (emergencySirenPulseCount > 18) {
        stopEmergencyAlarmSiren();
        return;
      }
      triggerEmergencySirenPulse();
    }, 1150);
  }
}

export function stopEmergencyAlarmSiren(): void {
  if (emergencySirenTimer !== null) {
    clearInterval(emergencySirenTimer);
    emergencySirenTimer = null;
  }
  emergencySirenPulseCount = 0;
}

/**
 * Staggered fierce warrior war-roar + blade draw resonance when all 4 Hunters activate.
 */
export function playBeastAlarmReactionSound(
  pos: SpatialAudioPos | undefined,
  beastIndex: number,
  enabled: boolean
): void {
  if (!enabled) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 44);
  const vol = 0.115 * Math.max(0.28, metrics.atten);
  const stagger = beastIndex * 0.14;
  const now = ctx.currentTime + stagger;
  const pitchScale = 0.88 + beastIndex * 0.075;

  const osc = ctx.createOscillator();
  const formant = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(118 * pitchScale, now);
  osc.frequency.exponentialRampToValueAtTime(240 * pitchScale, now + 0.18);
  osc.frequency.exponentialRampToValueAtTime(92 * pitchScale, now + 0.72);

  formant.type = 'bandpass';
  formant.frequency.setValueAtTime(520, now);
  formant.frequency.linearRampToValueAtTime(980, now + 0.2);
  formant.frequency.linearRampToValueAtTime(380, now + 0.72);
  formant.Q.value = 1.8;

  gain.gain.setValueAtTime(0.002, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.07);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

  osc.connect(formant);
  formant.connect(gain);
  gain.connect(input);
  osc.start(now);
  osc.stop(now + 0.78);
}

/**
 * Heavy metallic broadsword strike + electromagnetic barrier crackle outside the protected Puzzle Room.
 */
export function playBarrierStrikeSound(
  pos: SpatialAudioPos | undefined,
  enabled: boolean
): void {
  if (!enabled) return;
  if (!canPlayChannel('barrier-strike', 420)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const { input, metrics } = createSpatialSfxBus(ctx, pos, 28);
  const vol = 0.15 * Math.max(0.26, metrics.atten);
  const now = ctx.currentTime;

  // Heavy metallic door/barrier thud
  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(140, now);
  thud.frequency.exponentialRampToValueAtTime(36, now + 0.24);
  thudGain.gain.setValueAtTime(vol, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  thud.connect(thudGain);
  thudGain.connect(input);
  thud.start(now);
  thud.stop(now + 0.3);

  // Electromagnetic containment zap / shield crackle
  const zap = ctx.createOscillator();
  const zapGain = ctx.createGain();
  zap.type = 'sawtooth';
  zap.frequency.setValueAtTime(960, now);
  zap.frequency.exponentialRampToValueAtTime(240, now + 0.19);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1650;
  bp.Q.value = 2.4;
  zapGain.gain.setValueAtTime(vol * 0.55, now);
  zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  zap.connect(bp);
  bp.connect(zapGain);
  zapGain.connect(input);
  zap.start(now);
  zap.stop(now + 0.24);
}

/**
 * Believable cabinet/wardrobe door creak & soft latch click when entering or exiting hiding.
 */
export function playHideTransitionSound(entering: boolean, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('hide-transition', 160)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  // Soft cabinet wood/metal hinge creak
  const creak = ctx.createOscillator();
  const creakGain = ctx.createGain();
  creak.type = 'triangle';
  creak.frequency.setValueAtTime(entering ? 210 : 280, now);
  creak.frequency.exponentialRampToValueAtTime(entering ? 140 : 340, now + 0.14);
  creakGain.gain.setValueAtTime(0.055, now);
  creakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  creak.connect(creakGain);
  creakGain.connect(dest);
  creak.start(now);
  creak.stop(now + 0.17);

  // Subtle latch click
  const latch = ctx.createOscillator();
  const latchGain = ctx.createGain();
  latch.type = 'square';
  latch.frequency.setValueAtTime(entering ? 420 : 540, now + 0.11);
  latchGain.gain.setValueAtTime(0.032, now + 0.11);
  latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  latch.connect(latchGain);
  latchGain.connect(dest);
  latch.start(now + 0.11);
  latch.stop(now + 0.17);
}

/**
 * Heavy Safe Room armored bulkhead bolt release + emerald clearance chime.
 */
export function playSafeRoomUnlockSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('safe-room-unlock', 600)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  // Pneumatic deadbolt clunk
  const bolt = ctx.createOscillator();
  const boltGain = ctx.createGain();
  bolt.type = 'sawtooth';
  bolt.frequency.setValueAtTime(110, now);
  bolt.frequency.exponentialRampToValueAtTime(52, now + 0.25);
  boltGain.gain.setValueAtTime(0.11, now);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  bolt.connect(boltGain);
  boltGain.connect(dest);
  bolt.start(now);
  bolt.stop(now + 0.3);

  // Ascending green clearance triad
  const notes = [523.25, 659.25, 1046.5];
  notes.forEach((freq, idx) => {
    const start = now + 0.12 + idx * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.085, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(start);
    osc.stop(start + 0.38);
  });
}

/**
 * Ground-floor Emergency Extraction airlock release sound on final escape.
 */
export function playEmergencyExitSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('emergency-exit', 900)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  // Airlock pressure hiss
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.frequency.exponentialRampToValueAtTime(420, now + 0.55);
  filter.Q.value = 1.4;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.095, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
  src.connect(filter);
  filter.connect(nGain);
  nGain.connect(dest);
  src.start(now);
  src.stop(now + 0.6);
}

/**
 * Heavy rusted double iron compound gate groan, latch clank, and hinge creak.
 */
export function playCompoundGateSound(opening: boolean, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('compound-gate', 450)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  // Heavy iron latch clank
  const clank = ctx.createOscillator();
  const clankGain = ctx.createGain();
  clank.type = 'triangle';
  clank.frequency.setValueAtTime(opening ? 320 : 240, now);
  clank.frequency.exponentialRampToValueAtTime(84, now + 0.14);
  clankGain.gain.setValueAtTime(0.14, now);
  clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  clank.connect(clankGain);
  clankGain.connect(dest);
  clank.start(now);
  clank.stop(now + 0.18);

  // Metallic rusted hinge squeak & low groan
  const squeak = ctx.createOscillator();
  const squeakFilter = ctx.createBiquadFilter();
  const squeakGain = ctx.createGain();
  squeak.type = 'sawtooth';
  squeak.frequency.setValueAtTime(opening ? 195 : 230, now + 0.08);
  squeak.frequency.linearRampToValueAtTime(opening ? 310 : 155, now + 0.42);
  squeak.frequency.exponentialRampToValueAtTime(145, now + 0.78);
  squeakFilter.type = 'bandpass';
  squeakFilter.frequency.value = 680;
  squeakFilter.Q.value = 3.2;
  squeakGain.gain.setValueAtTime(0.001, now + 0.06);
  squeakGain.gain.linearRampToValueAtTime(0.085, now + 0.18);
  squeakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
  squeak.connect(squeakFilter);
  squeakFilter.connect(squeakGain);
  squeakGain.connect(dest);
  squeak.start(now + 0.06);
  squeak.stop(now + 0.84);

  // Gritty iron drag noise
  const drag = ctx.createBufferSource();
  drag.buffer = getNoiseBuffer(ctx);
  const dragFilter = ctx.createBiquadFilter();
  dragFilter.type = 'bandpass';
  dragFilter.frequency.setValueAtTime(420, now + 0.08);
  dragFilter.frequency.linearRampToValueAtTime(240, now + 0.76);
  dragFilter.Q.value = 1.6;
  const dragGain = ctx.createGain();
  dragGain.gain.setValueAtTime(0.001, now + 0.08);
  dragGain.gain.linearRampToValueAtTime(0.065, now + 0.22);
  dragGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  drag.connect(dragFilter);
  dragFilter.connect(dragGain);
  dragGain.connect(dest);
  drag.start(now + 0.08);
  drag.stop(now + 0.82);
}

/**
 * Heavy industrial apartment double-entrance steel latch release and deep echoing door swing.
 */
export function playHeavyMainEntranceSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('main-entrance', 600)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  // Heavy bar latch unlock clunk
  const latch = ctx.createOscillator();
  const latchGain = ctx.createGain();
  latch.type = 'square';
  latch.frequency.setValueAtTime(160, now);
  latch.frequency.exponentialRampToValueAtTime(58, now + 0.14);
  latchGain.gain.setValueAtTime(0.095, now);
  latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  latch.connect(latchGain);
  latchGain.connect(dest);
  latch.start(now);
  latch.stop(now + 0.18);

  // Deep hydraulic/steel double-door resonance
  const groan = ctx.createOscillator();
  const groanFilter = ctx.createBiquadFilter();
  const groanGain = ctx.createGain();
  groan.type = 'sawtooth';
  groan.frequency.setValueAtTime(92, now + 0.08);
  groan.frequency.linearRampToValueAtTime(126, now + 0.45);
  groan.frequency.exponentialRampToValueAtTime(64, now + 1.05);
  groanFilter.type = 'lowpass';
  groanFilter.frequency.value = 440;
  groanGain.gain.setValueAtTime(0.001, now + 0.08);
  groanGain.gain.linearRampToValueAtTime(0.11, now + 0.22);
  groanGain.gain.exponentialRampToValueAtTime(0.001, now + 1.12);
  groan.connect(groanFilter);
  groanFilter.connect(groanGain);
  groanGain.connect(dest);
  groan.start(now + 0.08);
  groan.stop(now + 1.15);

  // Air rush / lobby threshold echo
  const rush = ctx.createBufferSource();
  rush.buffer = getNoiseBuffer(ctx);
  const rushFilter = ctx.createBiquadFilter();
  rushFilter.type = 'bandpass';
  rushFilter.frequency.setValueAtTime(620, now + 0.12);
  rushFilter.frequency.exponentialRampToValueAtTime(180, now + 0.95);
  rushFilter.Q.value = 1.2;
  const rushGain = ctx.createGain();
  rushGain.gain.setValueAtTime(0.001, now + 0.12);
  rushGain.gain.linearRampToValueAtTime(0.075, now + 0.25);
  rushGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  rush.connect(rushFilter);
  rushFilter.connect(rushGain);
  rushGain.connect(dest);
  rush.start(now + 0.12);
  rush.stop(now + 1.04);
}

/**
 * Subtle boot jump launch / concrete landing thud synced to player jump & crouch movement.
 */
export function playJumpLandSound(isJump: boolean, enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('player-jump-land', 120)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  const thud = ctx.createOscillator();
  const gain = ctx.createGain();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(isJump ? 95 : 132, now);
  thud.frequency.exponentialRampToValueAtTime(isJump ? 148 : 40, now + 0.11);

  gain.gain.setValueAtTime(isJump ? 0.042 : 0.075, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

  thud.connect(gain);
  gain.connect(dest);
  thud.start(now);
  thud.stop(now + 0.14);
}

/**
 * Subtle metallic UI transition sound when entering the Survival Briefing screen.
 */
export function playBriefingTransitionSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('briefing-transition', 140)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;
  const notes = [329.63, 493.88];
  notes.forEach((freq, idx) => {
    const t = now + idx * 0.065;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.055, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

/**
 * Deep atmospheric deployment chord when player clicks NEXT to enter live gameplay.
 */
export function playGameplayStartSound(enabled: boolean): void {
  if (!enabled) return;
  if (!canPlayChannel('gameplay-start', 350)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'triangle';
  sub.frequency.setValueAtTime(110, now);
  sub.frequency.exponentialRampToValueAtTime(55, now + 0.42);
  subGain.gain.setValueAtTime(0.11, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
  sub.connect(subGain);
  subGain.connect(dest);
  sub.start(now);
  sub.stop(now + 0.5);

  const chime = ctx.createOscillator();
  const chimeGain = ctx.createGain();
  chime.type = 'sine';
  chime.frequency.setValueAtTime(440, now + 0.04);
  chime.frequency.exponentialRampToValueAtTime(659.25, now + 0.28);
  chimeGain.gain.setValueAtTime(0.065, now + 0.04);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
  chime.connect(chimeGain);
  chimeGain.connect(dest);
  chime.start(now + 0.04);
  chime.stop(now + 0.38);
}

/**
 * Subtle filtered wind swell and distant industrial metallic resonance used during
 * the 10-second cinematic environment showcase.
 */
export function playIntroWindAmbience(enabled: boolean, isInteriorSegment = false): void {
  if (!enabled) return;
  if (!canPlayChannel('intro-wind-ambience', 2100)) return;
  const ctx = ensureAudioGraph();
  if (!ctx) return;

  const dest = getSfxDestination(ctx);
  const now = ctx.currentTime;

  const windSrc = ctx.createBufferSource();
  windSrc.buffer = getNoiseBuffer(ctx);
  windSrc.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.setValueAtTime(isInteriorSegment ? 260 : 420, now);
  windFilter.frequency.linearRampToValueAtTime(isInteriorSegment ? 185 : 310, now + 2.4);
  windFilter.Q.value = isInteriorSegment ? 1.8 : 0.9;

  const windGain = ctx.createGain();
  windGain.gain.setValueAtTime(0.0001, now);
  windGain.gain.linearRampToValueAtTime(isInteriorSegment ? 0.032 : 0.048, now + 0.65);
  windGain.gain.exponentialRampToValueAtTime(0.0008, now + 2.45);

  windSrc.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(dest);
  windSrc.start(now);
  windSrc.stop(now + 2.5);

  // Distant subtle industrial resonance hum
  const drone = ctx.createOscillator();
  const droneGain = ctx.createGain();
  drone.type = 'sine';
  drone.frequency.setValueAtTime(isInteriorSegment ? 73.42 : 65.41, now);
  drone.frequency.exponentialRampToValueAtTime(isInteriorSegment ? 69.3 : 61.74, now + 2.2);
  droneGain.gain.setValueAtTime(0.0001, now);
  droneGain.gain.linearRampToValueAtTime(0.036, now + 0.55);
  droneGain.gain.exponentialRampToValueAtTime(0.0006, now + 2.35);
  drone.connect(droneGain);
  droneGain.connect(dest);
  drone.start(now);
  drone.stop(now + 2.4);
}




