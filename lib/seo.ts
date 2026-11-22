import type { Metadata } from 'next';

const BASE = 'https://getconnectly.net';

/** Title, description and link-preview details for a corporate page. */
export function pageMeta(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: `${BASE}${path}` },
    openGraph: {
      title,
      description,
      url: `${BASE}${path}`,
      siteName: 'Connectly Technologies',
      locale: 'en_NG',
      type: 'website',
      images: [{ url: `${BASE}/connectly-logo-horizontal.svg`, width: 1200, height: 630, alt: 'Connectly Technologies' }],
    },
  };
}
