import { FloorNumber, SoundEvent, SoundEventKind } from '../types/game';

const SOUND_TTL_MS = 4500;
const MAX_QUEUED_SOUNDS = 24;

let nextSoundId = 1;
const soundEvents: SoundEvent[] = [];

export const SOUND_PRESETS: Record<SoundEventKind, { radius: number; intensity: number }> = {
  'footstep-walk': { radius: 8.5, intensity: 0.35 },
  'footstep-crouch': { radius: 2.8, intensity: 0.14 },
  'footstep-sprint': { radius: 22.0, intensity: 0.9 },
  'door-locked': { radius: 16.5, intensity: 0.65 },
  'door-unlock': { radius: 26.0, intensity: 1.0 },
  terminal: { radius: 20.5, intensity: 0.8 },
  'puzzle-loud': { radius: 26.0, intensity: 0.95 },
  'hide-rustle': { radius: 11.5, intensity: 0.55 },
  'key-alarm': { radius: 96.0, intensity: 1.0 },
  alert: { radius: 64.0, intensity: 1.0 },
};

export function emitSoundEvent(params: {
  x: number;
  y: number;
  z: number;
  floor: FloorNumber;
  kind: SoundEventKind;
  radiusOverride?: number;
  intensityOverride?: number;
  nowMs?: number;
}): SoundEvent {
  const preset = SOUND_PRESETS[params.kind];
  const now = params.nowMs ?? performance.now();
  const evt: SoundEvent = {
    id: nextSoundId++,
    x: params.x,
    y: params.y,
    z: params.z,
    floor: params.floor,
    radius: params.radiusOverride ?? preset.radius,
    intensity: params.intensityOverride ?? preset.intensity,
    kind: params.kind,
    timestamp: now,
  };
  soundEvents.push(evt);
  if (soundEvents.length > MAX_QUEUED_SOUNDS) {
    soundEvents.splice(0, soundEvents.length - MAX_QUEUED_SOUNDS);
  }
  return evt;
}

export function clearSoundEvents(): void {
  soundEvents.length = 0;
}

export function getAudibleSoundForBeast(params: {
  beastX: number;
  beastY: number;
  beastZ: number;
  beastFloor: FloorNumber;
  hearingMultiplier: number;
  lastProcessedId: number;
  nowMs?: number;
}): { event: SoundEvent; score: number } | null {
  const now = params.nowMs ?? performance.now();

  // Prune expired events
  while (soundEvents.length > 0 && now - soundEvents[0].timestamp > SOUND_TTL_MS) {
    soundEvents.shift();
  }

  let best: { event: SoundEvent; score: number } | null = null;

  for (const evt of soundEvents) {
    if (evt.id <= params.lastProcessedId) continue;

    const floorDiff = Math.abs(evt.floor - params.beastFloor);
    // Sound travels strongly on the same floor, somewhat across 1 floor (open courtyard/stairs), weakly across 2+ floors unless facility alert
    const floorAttenuation =
      evt.kind === 'alert' || evt.kind === 'key-alarm'
        ? 1.0
        : floorDiff === 0
        ? 1.0
        : floorDiff === 1
        ? 0.58
        : 0.25;

    const effectiveRadius = evt.radius * params.hearingMultiplier * floorAttenuation;
    const dist2D = Math.hypot(evt.x - params.beastX, evt.z - params.beastZ);

    if (dist2D <= effectiveRadius) {
      const proximityFactor = 1 - dist2D / Math.max(1, effectiveRadius);
      const score = evt.intensity * (0.45 + 0.55 * proximityFactor) * floorAttenuation;
      if (!best || score > best.score) {
        best = { event: evt, score };
      }
    }
  }

  return best;
}

export function getActiveSoundEventsSnapshot(): readonly SoundEvent[] {
  return soundEvents;
}
