'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/lib/admin/inputs';

const input =
  'w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6d1825] focus:border-[#6d1825]';

const LABELS: Record<string, string> = {
  backhaul: 'Backhaul (internet)', equipment: 'Equipment', installation: 'Installation', repairs: 'Repairs',
  power: 'Power', staff: 'Staff', marketing: 'Marketing', software: 'Software', other: 'Other',
};

export default function ExpenseForm({ locations, today }: { locations: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const empty = { category: 'backhaul', amountNaira: '', locationId: '', description: '', expenseDate: today };
  const [form, setForm] = useState(empty);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locationId: form.locationId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not record the expense.');
      setForm(empty);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the expense.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#6d1825] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a141e]">
        <Plus className="h-4 w-4" /> Add expense
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs" aria-label="Add an expense">
      <h2 className="text-sm font-bold text-slate-900">Add expense</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Date</span>
          <input type="date" required max={today} value={form.expenseDate} onChange={(e) => set({ expenseDate: e.target.value })} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Amount (₦)</span>
          <input type="number" required min="0.01" step="0.01" inputMode="decimal" value={form.amountNaira}
            onChange={(e) => set({ amountNaira: e.target.value })} className={input} placeholder="25000" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Category</span>
          <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={input}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{LABELS[c]}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Location</span>
          <select value={form.locationId} onChange={(e) => set({ locationId: e.target.value })} className={input}>
            <option value="">General / network-wide</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Description</span>
        <input required minLength={3} maxLength={300} value={form.description} onChange={(e) => set({ description: e.target.value })}
          className={input} placeholder="e.g. Starlink monthly subscription, November" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy}
          className="rounded-lg bg-[#6d1825] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a141e] disabled:opacity-50">
          {busy ? 'Saving…' : 'Save expense'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(''); }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
