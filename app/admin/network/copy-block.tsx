'use client';

import { useState } from 'react';

export default function CopyBlock({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'blocked'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('blocked');
    }
    setTimeout(() => setState('idle'), 1800);
  };
  return (
    <div className="relative">
      <button type="button" onClick={copy}
        className="absolute right-2 top-2 rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-white/20">
        {state === 'copied' ? 'Copied' : state === 'blocked' ? 'Select and copy' : label}
      </button>
      <pre className="overflow-x-auto whitespace-pre rounded-[var(--radius-control)] bg-ink p-4 pr-20 text-[12.5px] leading-relaxed text-white">{text}</pre>
    </div>
  );
}
