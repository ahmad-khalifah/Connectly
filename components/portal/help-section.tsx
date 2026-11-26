import { WhatsAppNumber } from './whatsapp-number';

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'I paid but I am not online',
    a: 'Stay on the payment page: it shows your WiFi code as soon as the payment is confirmed. If you left the page, join the WiFi again and type the code under "Already paid?".',
  },
  {
    q: 'My payment did not go through',
    a: 'You are not charged for access unless the payment is confirmed. Choose a plan and pay again. If money left your account but no code appeared, message us with your payment reference.',
  },
  {
    q: 'Can I use more than one phone or laptop?',
    a: 'Each plan says how many devices it covers. Use the same WiFi code on each device, up to that number.',
  },
  {
    q: 'What happens when my plan ends?',
    a: 'Your connection stops at the end time shown on your payment page. Join the WiFi again to buy a new plan.',
  },
];

/** Answers that work before the customer is online, then how to reach us. */
export function HelpSection() {
  return (
    <section id="help" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-md px-5 py-8">
        <h2 className="text-lg font-bold text-ink">Help</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {QUESTIONS.map(({ q, a }) => (
            <details key={q} className="group py-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-xl leading-none text-subtle transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Still stuck? Message our help line on WhatsApp: <WhatsAppNumber />
          <span className="mt-1 block">Have your payment reference ready.</span>
        </p>
      </div>
    </section>
  );
}
