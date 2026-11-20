import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { getIntroSegmentMeta } from '../../three/introCameraPath';

const SEGMENT_SECONDS = [1.0, 3.0, 5.0, 7.0, 9.0] as const;

export const CinematicIntroOverlay: React.FC = () => {
  const screenPhase = useGameStore((s) => s.screenPhase);
  const introSegmentIndex = useGameStore((s) => s.introSegmentIndex);
  const introShowDirective = useGameStore((s) => s.introShowDirective);

  if (screenPhase !== 'intro') return null;

  const meta = getIntroSegmentMeta(SEGMENT_SECONDS[introSegmentIndex] ?? 0);

  return (
    <div
      data-testid="cinematic-intro-overlay"
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between select-none"
    >
      {/* Subtle Top Cinematic Letterbox Bar */}
      <div className="bg-gradient-to-b from-[#06090f]/95 via-[#06090f]/75 to-transparent px-6 pt-5 pb-8 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="font-display text-xs sm:text-sm font-bold tracking-[0.28em] text-slate-300 uppercase">
            LAST BREATH
          </div>
          <div className="font-mono-tech text-[11px] tracking-[0.2em] text-amber-400/90 uppercase">
            0{introSegmentIndex + 1} / 05
          </div>
        </div>
      </div>

      {/* Centered "SURVIVE. FIND THE EXIT." Reveal during Final 8-10s Convergence */}
      <div className="flex flex-1 items-end justify-center px-4 pb-10">
        {introShowDirective && (
          <div
            data-testid="intro-survive-directive"
            className="rounded-md border border-red-500/45 bg-[#070b12]/88 px-6 py-3 text-center shadow-2xl transition-opacity duration-500"
          >
            <div className="font-display text-lg sm:text-2xl font-bold tracking-[0.22em] text-white uppercase">
              SURVIVE. FIND THE EXIT.
            </div>
          </div>
        )}
      </div>

      {/* Bottom Cinematic Letterbox Bar & Current Environment Location Caption */}
      <div className="bg-gradient-to-t from-[#06090f]/95 via-[#06090f]/80 to-transparent px-6 pt-8 pb-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-display text-sm sm:text-base font-bold tracking-[0.18em] text-amber-400 uppercase">
              {meta.title}
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-300">
              {meta.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {([0, 1, 2, 3, 4] as const).map((idx) => (
              <span
                key={idx}
                className={`h-1 rounded-sm transition-colors duration-300 ${
                  idx === introSegmentIndex
                    ? 'w-7 bg-amber-400'
                    : idx < introSegmentIndex
                    ? 'w-4 bg-slate-400'
                    : 'w-4 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
