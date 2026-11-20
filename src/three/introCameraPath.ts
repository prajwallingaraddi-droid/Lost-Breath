import * as THREE from 'three';

export const INTRO_DURATION_SECONDS = 10.0;

export interface IntroTargetCameraPose {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

export interface IntroSegmentMeta {
  index: 0 | 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  showDirective: boolean;
}

interface TimedKeyframe {
  t: number;
  pos: [number, number, number];
  look: [number, number, number];
}

// Timed collision-free keyframes covering all 5 required cinematic segments over 10.0s:
// 0-2s: Wide aerial abandoned city establishing shot
// 2-4s: Approach LAST BREATH apartment building exterior & compound perimeter + single gate
// 4-6s: Pass cleanly above compound gate into overgrown yard, trees, pathways & Main Entrance
// 6-8s: Rise above roof parapet & swoop into open hollow central courtyard (4 floors, fountain, dark flooring)
// 8-10s: Ascend out of atrium, sweep back to player exterior spawn (-20.5, 0, 74) & converge into 3rd-person cam
const TIMED_KEYFRAMES: readonly TimedKeyframe[] = [
  { t: 0.0, pos: [-23.0, 25.0, 86.0], look: [-15.0, 10.5, 28.0] },
  { t: 1.2, pos: [-17.5, 19.5, 72.0], look: [-14.0, 9.2, 25.0] },
  { t: 2.3, pos: [-19.0, 13.5, 58.0], look: [-15.5, 6.2, 30.0] },
  { t: 3.3, pos: [-20.5, 8.2, 49.5], look: [-20.5, 3.6, 33.5] },
  { t: 4.1, pos: [-20.5, 5.5, 45.2], look: [-20.5, 2.8, 28.0] },
  { t: 5.0, pos: [-20.5, 4.2, 34.8], look: [-20.5, 2.9, 27.5] },
  { t: 5.65, pos: [-17.5, 22.2, 29.8], look: [-6.0, 8.5, 8.0] },
  { t: 6.15, pos: [-10.0, 22.0, 11.2], look: [0.0, 5.5, 0.0] },
  { t: 6.75, pos: [-7.2, 11.8, 7.4], look: [0.0, 2.8, 0.0] },
  { t: 7.45, pos: [6.4, 7.0, -5.8], look: [-1.5, 3.8, 1.5] },
  { t: 8.05, pos: [1.5, 14.5, -1.5], look: [-4.0, 5.5, 4.0] },
  { t: 8.55, pos: [-4.5, 22.5, 11.0], look: [-16.0, 4.5, 42.0] },
  { t: 9.05, pos: [-15.0, 20.5, 32.5], look: [-20.5, 2.2, 62.0] },
  { t: 9.5, pos: [-19.5, 7.2, 57.5], look: [-20.5, 1.6, 72.5] },
  { t: 10.0, pos: [-20.5, 2.8, 77.6], look: [-20.5, 1.5, 70.0] },
];

function catmullRomValue(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

function smootherstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Samples the automated 10-second timed cinematic camera pose with C1 Catmull-Rom
 * continuity and blends smoothly over the final second directly into the exact
 * third-person shoulder camera pose. Zero-GC in per-frame loops.
 */
export function sampleIntroCameraPose(
  elapsedSeconds: number,
  exactEndPose: IntroTargetCameraPose,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3
): number {
  const t = Math.max(0, Math.min(INTRO_DURATION_SECONDS, elapsedSeconds));

  let segIdx = TIMED_KEYFRAMES.length - 2;
  for (let i = 0; i < TIMED_KEYFRAMES.length - 1; i++) {
    if (t <= TIMED_KEYFRAMES[i + 1].t) {
      segIdx = i;
      break;
    }
  }

  const k0 = TIMED_KEYFRAMES[Math.max(0, segIdx - 1)];
  const k1 = TIMED_KEYFRAMES[segIdx];
  const k2 = TIMED_KEYFRAMES[segIdx + 1];
  const k3 = TIMED_KEYFRAMES[Math.min(TIMED_KEYFRAMES.length - 1, segIdx + 2)];

  const span = Math.max(1e-4, k2.t - k1.t);
  const localU = Math.max(0, Math.min(1, (t - k1.t) / span));

  const px = catmullRomValue(k0.pos[0], k1.pos[0], k2.pos[0], k3.pos[0], localU);
  const py = catmullRomValue(k0.pos[1], k1.pos[1], k2.pos[1], k3.pos[1], localU);
  const pz = catmullRomValue(k0.pos[2], k1.pos[2], k2.pos[2], k3.pos[2], localU);

  const lx = catmullRomValue(k0.look[0], k1.look[0], k2.look[0], k3.look[0], localU);
  const ly = catmullRomValue(k0.look[1], k1.look[1], k2.look[1], k3.look[1], localU);
  const lz = catmullRomValue(k0.look[2], k1.look[2], k2.look[2], k3.look[2], localU);

  // Smoothly blend last 0.9s (9.1s -> 10.0s) into exact third-person shoulder pose (zero snap)
  const endBlend = smootherstep01((t - 9.1) / 0.9);

  outPos.set(
    THREE.MathUtils.lerp(px, exactEndPose.camX, endBlend),
    THREE.MathUtils.lerp(py, exactEndPose.camY, endBlend),
    THREE.MathUtils.lerp(pz, exactEndPose.camZ, endBlend)
  );
  outLook.set(
    THREE.MathUtils.lerp(lx, exactEndPose.lookX, endBlend),
    THREE.MathUtils.lerp(ly, exactEndPose.lookY, endBlend),
    THREE.MathUtils.lerp(lz, exactEndPose.lookZ, endBlend)
  );

  return t / INTRO_DURATION_SECONDS;
}

export function getIntroSegmentMeta(elapsedSeconds: number): IntroSegmentMeta {
  const t = Math.max(0, Math.min(INTRO_DURATION_SECONDS, elapsedSeconds));
  if (t < 2.0) {
    return {
      index: 0,
      title: 'ABANDONED URBAN SECTOR',
      subtitle: 'Reclaimed city district surrounding the containment perimeter.',
      showDirective: false,
    };
  }
  if (t < 4.0) {
    return {
      index: 1,
      title: 'LAST BREATH COMPOUND',
      subtitle: 'Reinforced concrete perimeter with a single entrance gate.',
      showDirective: false,
    };
  }
  if (t < 6.0) {
    return {
      index: 2,
      title: 'OVERGROWN APPROACH',
      subtitle: 'Cross the outer courtyard to breach the Main Apartment Entrance.',
      showDirective: false,
    };
  }
  if (t < 8.0) {
    return {
      index: 3,
      title: 'FOUR-FLOOR COMPLEX & ATRIUM',
      subtitle: '80 locked rooms encircling the haunted courtyard fountain.',
      showDirective: false,
    };
  }
  return {
    index: 4,
    title: 'INSERTION POINT',
    subtitle: 'Four Warrior Hunters roam inside. Stay quiet or stay hidden.',
    showDirective: t >= 8.35,
  };
}
