'use client';

import { useState } from 'react';

export default function CopyBlock({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button type="button"
        onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 px-2 py-1 text-[11px] font-semibold rounded bg-slate-700 text-slate-100 hover:bg-slate-600">
        {copied ? 'Copied' : label}
      </button>
      <pre className="p-4 pr-16 bg-slate-900 text-slate-100 text-xs rounded-lg overflow-x-auto whitespace-pre">{text}</pre>
    </div>
  );
}
