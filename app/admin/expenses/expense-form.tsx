'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/lib/admin/inputs';
import { inputClass as input, selectClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { adminFetch, refreshAdminData } from '@/components/admin/admin-data';


const LABELS: Record<string, string> = {
  backhaul: 'Backhaul (internet)', equipment: 'Equipment', installation: 'Installation', repairs: 'Repairs',
  power: 'Power', staff: 'Staff', marketing: 'Marketing', software: 'Software', other: 'Other',
};

export default function ExpenseForm({ locations, today }: { locations: { id: string; name: string }[]; today: string }) {
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
      const res = await adminFetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locationId: form.locationId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not record the expense.');
      setForm(empty);
      setOpen(false);
      refreshAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the expense.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add expense
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-panel)] border border-line bg-surface p-6" aria-label="Add an expense">
      <h2 className="text-[15px] font-semibold text-ink">Add expense</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold text-ink">Date</span>
          <input type="date" required max={today} value={form.expenseDate} onChange={(e) => set({ expenseDate: e.target.value })} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold text-ink">Amount (₦)</span>
          <input type="number" required min="0.01" step="0.01" inputMode="decimal" value={form.amountNaira}
            onChange={(e) => set({ amountNaira: e.target.value })} className={input} placeholder="25000" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold text-ink">Category</span>
          <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={selectClass}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{LABELS[c]}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold text-ink">Location</span>
          <select value={form.locationId} onChange={(e) => set({ locationId: e.target.value })} className={selectClass}>
            <option value="">General / network-wide</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-semibold text-ink">Description</span>
        <input required minLength={3} maxLength={300} value={form.description} onChange={(e) => set({ description: e.target.value })}
          className={input} placeholder="e.g. Starlink monthly subscription, November" />
      </label>
      {error && <Notice tone="bad" title="Not saved">{error}</Notice>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setError(''); }}>Cancel</Button>
      </div>
    </form>
  );
}
