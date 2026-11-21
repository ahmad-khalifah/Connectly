'use client';

import { useState } from 'react';

type Point = { key: string; label: string; revenue: number; payments: number };

const BAR = '#9e2b3b'; // brand maroon, mid step: passes lightness band and 3:1 contrast on white
const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

/** A rounded-up axis maximum with 4 even steps. */
function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return step * 4;
}

/** Revenue per day (or month). One series, so no legend: the panel title names it. */
export function RevenueChart({ data, unit }: { data: Point[]; unit: 'day' | 'month' }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = Math.max(320, data.length * 28 + PAD.left + PAD.right);
  const max = niceMax(Math.max(0, ...data.map((d) => d.revenue)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(data.length / 10);
  const total = data.reduce((s, d) => s + d.revenue, 0);

  if (data.length === 0 || total === 0) {
    return <p className="py-10 text-center text-sm text-muted">No paid purchases in this period.</p>;
  }

  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${H}`} className="block h-[220px] min-w-full" style={{ width }} role="img" aria-label={`Revenue per ${unit}, ${data.length} ${unit}s, total ${naira(total)}`}>
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (max / 4) * i;
            return (
              <g key={i}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={i === 0 ? 'var(--color-line-strong)' : 'var(--color-line)'} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-[var(--color-subtle)] text-[11px] tnum">{naira(v)}</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const top = y(d.revenue);
            const hgt = Math.max(0, PAD.top + plotH - top);
            const r = Math.min(4, hgt, barW / 2);
            const x0 = cx - barW / 2;
            const base = PAD.top + plotH;
            // Rounded data end, square at the baseline.
            const path = hgt <= 0 ? '' : `M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`;
            return (
              <g key={d.key}>
                {path && <path d={path} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.45} />}
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" className="fill-[var(--color-subtle)] text-[11px]">{d.label}</text>
                )}
                {/* Hit target wider than the bar, keyboard reachable. */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${naira(d.revenue)}, ${d.payments} payment${d.payments === 1 ? '' : 's'}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="cursor-default outline-none"
                />
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border border-line bg-surface px-3 py-2 text-[13px] shadow-sm"
            style={{ left: Math.min(Math.max(PAD.left + band * hover + band / 2 - 70, 0), width - 150) }}
          >
            <p className="font-semibold text-ink">{h.label}</p>
            <p className="tnum text-ink">{naira(h.revenue)}</p>
            <p className="text-muted">{h.payments} payment{h.payments === 1 ? '' : 's'}</p>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-brand">Show as a table</summary>
        <table className="mt-2 w-full max-w-md text-left">
          <thead className="text-muted">
            <tr><th className="py-1 font-semibold">{unit === 'day' ? 'Day' : 'Month'}</th><th className="py-1 text-right font-semibold">Revenue</th><th className="py-1 text-right font-semibold">Payments</th></tr>
          </thead>
          <tbody className="tnum">
            {data.map((d) => (
              <tr key={d.key} className="border-t border-line"><td className="py-1">{d.label}</td><td className="py-1 text-right">{naira(d.revenue)}</td><td className="py-1 text-right">{d.payments}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
