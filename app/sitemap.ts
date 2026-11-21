import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://getconnectly.net';
  const now = new Date();
  return [
    { url: baseUrl, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${baseUrl}/wifi`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
