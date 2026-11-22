import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { MapPin, Mail, MessageCircle } from 'lucide-react';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { Container, PageHero } from '@/components/site/blocks';
import { WHATSAPP_DISPLAY, WHATSAPP_URL } from '@/lib/brand';
import { COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_NAME, COMPANY_RC } from '@/lib/company';

export const metadata: Metadata = pageMeta('Contact | Connectly Technologies', 'Contact Connectly Technologies about connectivity solutions and partnerships.', '/contact');

export default function ContactPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          title="Talk to us."
          intro="Tell us about your organisation and what you need. A member of our team will reply by email."
        />

        <section>
          <Container className="grid gap-12 py-14 md:py-20 lg:grid-cols-[1fr_1.5fr]">
            <div className="space-y-9">
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sand"><MapPin className="h-5 w-5" aria-hidden /></span>
                <address className="not-italic">
                  <p className="text-[17px] font-semibold text-ink">Registered business address</p>
                  <p className="mt-1 text-[16px] leading-relaxed text-muted">
                    {COMPANY_NAME}<br />
                    {COMPANY_ADDRESS.map((line, i) => (<span key={line}>{line}{i < COMPANY_ADDRESS.length - 1 && <br />}</span>))}
                  </p>
                  <p className="mt-1 text-[14px] text-subtle">{COMPANY_RC}</p>
                </address>
              </div>
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sand"><Mail className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="text-[17px] font-semibold text-ink">Business enquiries</p>
                  <a href={`mailto:${COMPANY_EMAIL}`} className="mt-1 inline-block text-[16px] text-brand underline underline-offset-4 hover:no-underline">{COMPANY_EMAIL}</a>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ok text-white"><MessageCircle className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="text-[17px] font-semibold text-ink">Customer support</p>
                  <p className="mt-1 text-[15px] text-muted">Already using a Connectly network and need help?</p>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[16px] font-semibold text-brand underline underline-offset-4 hover:no-underline">WhatsApp {WHATSAPP_DISPLAY}</a>
                </div>
              </div>
            </div>
            <div id="enquire" className="scroll-mt-24">
              <EnquiryForm />
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
