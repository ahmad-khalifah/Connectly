'use client';

import { useState } from 'react';
import { Field, inputClass, selectClass, textareaClass } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SITE_TYPES, USER_RANGES } from '@/lib/enquiries';

import { COMPANY_EMAIL as CONTACT_EMAIL } from '@/lib/company';

const TOPICS = ['Solutions for my organisation', 'Partnership', 'Something else'] as const;

export function EnquiryForm() {
  const [startedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [sent, setSent] = useState<{ reference: number | null } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const fields = Object.fromEntries(f.entries());
    // The enquiry API has one message field, so the topic leads it.
    const { topic, message, ...rest } = fields as Record<string, string>;
    if ((message ?? '').trim().length < 10) {
      // The topic tag would otherwise let a very short message through.
      setError({ text: 'Tell us a little more (at least a sentence).', field: 'message' });
      document.getElementById('enq-message')?.focus();
      setBusy(false);
      return;
    }
    const body = { ...rest, message: `[${topic || TOPICS[0]}] ${message ?? ''}`, startedAt };
    try {
      const res = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ text: data.message || 'Your enquiry was not sent.', field: data.field });
        if (data.field) document.getElementById(`enq-${data.field}`)?.focus();
      } else {
        setSent({ reference: data.reference ?? null });
      }
    } catch {
      setError({ text: `No connection. Try again, or email ${CONTACT_EMAIL}.` });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-brand/20 bg-brand-soft p-6" role="status">
        <p className="text-lg font-bold text-ink">Thank you, your enquiry is with us.</p>
        <p className="mt-1 text-[15px] text-muted">
          We reply by email{sent.reference ? `. Your reference is #${sent.reference}` : ''}. If it is urgent, write to <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline">{CONTACT_EMAIL}</a>.
        </p>
      </div>
    );
  }

  const err = (f: string) => (error?.field === f ? error.text : null);

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-[var(--radius-panel)] border border-line bg-surface p-6 sm:p-8">
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="enq-website">Website</label>
        <input id="enq-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="What is your enquiry about?" htmlFor="enq-topic">
        <select id="enq-topic" name="topic" className={selectClass} defaultValue={TOPICS[0]}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="enq-name" error={err('name')}>
          <input id="enq-name" name="name" autoComplete="name" required className={inputClass} />
        </Field>
        <Field label="Organisation" htmlFor="enq-organisation" error={err('organisation')}>
          <input id="enq-organisation" name="organisation" autoComplete="organization" required className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="enq-email" error={err('email')}>
          <input id="enq-email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Phone" htmlFor="enq-phone" optional error={err('phone')}>
          <input id="enq-phone" name="phone" type="tel" autoComplete="tel" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Type of organisation or site" htmlFor="enq-siteType" optional>
          <select id="enq-siteType" name="siteType" className={selectClass} defaultValue=""><option value="">Choose one</option>{SITE_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="People who would use the network on a typical day" htmlFor="enq-users" optional>
          <select id="enq-users" name="users" className={selectClass} defaultValue=""><option value="">Choose one</option>{USER_RANGES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Town or area" htmlFor="enq-siteLocation" optional className="sm:col-span-2">
          <input id="enq-siteLocation" name="siteLocation" className={inputClass} />
        </Field>
      </div>

      <Field label="How can we help?" htmlFor="enq-message" error={err('message')}
        hint="Tell us about your organisation and what you are looking for.">
        <textarea id="enq-message" name="message" required className={textareaClass} />
      </Field>

      {error && !error.field && <Notice tone="bad" title="Not sent">{error.text}</Notice>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={busy}>{busy ? 'Sending…' : 'Send enquiry'}</Button>
        <p className="text-[13px] text-muted">Or email <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline underline-offset-2">{CONTACT_EMAIL}</a></p>
      </div>
    </form>
  );
}
