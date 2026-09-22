import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/ops-console-x9f2/'], 
    },
    sitemap: 'https://getconnectly.net/sitemap.xml',
  };
}