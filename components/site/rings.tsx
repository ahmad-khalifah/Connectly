import { cn } from '@/lib/utils';

/**
 * The Connectly mark, drawn large: two rings and the lens where they meet,
 * with fine outer rings that drift slowly. Decorative only; it shows no
 * network, place or product.
 */
export function Rings({ className, quiet = false }: { className?: string; quiet?: boolean }) {
  return (
    <svg viewBox="0 0 800 800" aria-hidden className={cn('pointer-events-none select-none', className)}>
      <defs>
        <radialGradient id="cx-lens" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#f1dca8" />
          <stop offset="100%" stopColor="#d9a441" />
        </radialGradient>
        <clipPath id="cx-clip-b"><circle cx="470" cy="400" r="230" /></clipPath>
      </defs>
      <g className="cx-spin-slower" opacity={quiet ? 0.18 : 0.3}>
        <circle cx="400" cy="400" r="385" fill="none" stroke="#e6cc92" strokeWidth="1" strokeDasharray="2 9" />
      </g>
      <g className="cx-spin-slow" opacity={quiet ? 0.2 : 0.34}>
        <circle cx="400" cy="400" r="335" fill="none" stroke="#e6cc92" strokeWidth="1" />
        <circle cx="400" cy="65" r="5" fill="#e6cc92" />
        <circle cx="690" cy="567" r="4" fill="#e6cc92" />
        <circle cx="110" cy="567" r="4" fill="#e6cc92" />
      </g>
      <circle cx="330" cy="400" r="230" fill="url(#cx-lens)" clipPath="url(#cx-clip-b)" opacity={quiet ? 0.7 : 0.95} />
      <circle cx="330" cy="400" r="230" fill="none" stroke="#e6cc92" strokeWidth="14" opacity={quiet ? 0.45 : 0.9} />
      <circle cx="470" cy="400" r="230" fill="none" stroke="#e6cc92" strokeWidth="14" opacity={quiet ? 0.45 : 0.9} />
    </svg>
  );
}
