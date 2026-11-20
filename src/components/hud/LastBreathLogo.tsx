import React from 'react';

interface LastBreathLogoProps {
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}

export const LastBreathLogo: React.FC<LastBreathLogoProps> = ({
  size = 'md',
  subtitle,
}) => {
  const titleSize =
    size === 'lg'
      ? 'text-4xl sm:text-6xl tracking-[0.16em]'
      : size === 'sm'
        ? 'text-lg tracking-[0.14em]'
        : 'text-3xl sm:text-4xl tracking-[0.15em]';

  const emblemSize =
    size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';

  return (
    <div className="inline-flex flex-col select-none">
      <div className="flex items-center gap-2.5">
        <svg
          viewBox="0 0 36 36"
          aria-hidden="true"
          className={`${emblemSize} shrink-0`}
        >
          <defs>
            <linearGradient id="lb-steel" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
          <polygon
            points="18,2 33,10 33,26 18,34 3,26 3,10"
            fill="#0b1017"
            stroke="url(#lb-steel)"
            strokeWidth="2"
          />
          <path
            d="M11 24 L11 12 M11 24 L17 24 M21 12 L25 12 C27 12 27 17.5 24.5 17.5 L21 17.5 L21 24 L25 24 C27.5 24 27.5 18 24.5 17.5"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="2.1"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <line x1="6" y1="27" x2="30" y2="9" stroke="#dc2626" strokeWidth="1.6" />
        </svg>

        <div className="relative">
          <div
            className={`font-display font-bold uppercase leading-none bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${titleSize}`}
          >
            LAST <span className="text-red-500">BREATH</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-[2px] w-10 bg-red-600" />
            <span className="h-[1px] flex-1 bg-slate-600/80" />
          </div>
        </div>
      </div>

      {subtitle && (
        <div className="font-mono-tech mt-1.5 text-[10px] sm:text-xs font-semibold tracking-[0.22em] text-amber-400/95 uppercase">
          {subtitle}
        </div>
      )}
    </div>
  );
};
