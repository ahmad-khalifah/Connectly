/**
 * Signature drawing for the website: a site plan (rows of stalls or rooms),
 * the coverage rings of its access points, and the lens where two rings
 * overlap, which is the Connectly mark. Geometry is computed, not traced.
 */
type AP = { x: number; y: number };

const R = 118;
const APS: AP[] = [
  { x: 150, y: 150 }, { x: 330, y: 120 }, { x: 500, y: 175 },
  { x: 225, y: 310 }, { x: 420, y: 320 },
];

/** Lens between two equal circles, or null if they do not overlap. */
function lens(a: AP, b: AP, r: number): string | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d >= 2 * r || d === 0) return null;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const h = Math.sqrt(r * r - (d / 2) ** 2);
  const ux = -dy / d, uy = dx / d;
  const p1 = [mx + ux * h, my + uy * h].map((n) => n.toFixed(1));
  const p2 = [mx - ux * h, my - uy * h].map((n) => n.toFixed(1));
  return `M${p1[0]} ${p1[1]} A${r} ${r} 0 0 1 ${p2[0]} ${p2[1]} A${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}Z`;
}

const LENSES = APS.flatMap((a, i) => APS.slice(i + 1).map((b) => lens(a, b, R))).filter((p): p is string => p !== null);

// Stall rows: the plan of a market or a hostel block, drawn as quiet outlines.
const ROWS = Array.from({ length: 6 }, (_, r) => Array.from({ length: 11 }, (_, c) => ({ x: 40 + c * 52, y: 46 + r * 66 }))).flat();

export function CoverageDrawing({ className, tone = 'brand' }: { className?: string; tone?: 'brand' | 'indigo' }) {
  const ring = tone === 'indigo' ? 'var(--color-indigo)' : 'var(--color-brand)';
  return (
    <svg viewBox="0 0 640 440" className={className} role="img" aria-label="Plan of a site with the coverage of five access points overlapping">
      <g stroke="var(--color-line-strong)" strokeWidth="1" fill="none">
        {ROWS.map((s, i) => <rect key={i} x={s.x} y={s.y} width="40" height="34" rx="2" />)}
      </g>
      <g fill="var(--color-ochre)" opacity="0.55">
        {LENSES.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g fill="none" stroke={ring} strokeWidth="2">
        {APS.map((a, i) => (
          <circle key={i} cx={a.x} cy={a.y} r={R} className="coverage-ring" style={{ animationDelay: `${i * 120}ms` }} pathLength={1} />
        ))}
      </g>
      <g fill={ring}>
        {APS.map((a, i) => <circle key={i} cx={a.x} cy={a.y} r="5" />)}
      </g>
      <style>{`
        .coverage-ring { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ring-draw 1.4s cubic-bezier(.2,.7,.2,1) forwards; }
        @keyframes ring-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .coverage-ring { animation: none; stroke-dashoffset: 0; } }
      `}</style>
    </svg>
  );
}
