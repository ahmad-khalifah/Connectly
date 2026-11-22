import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://getconnectly.net';
  const now = new Date();
  const pages: [string, number][] = [
    ['', 1],
    ['/about', 0.8],
    ['/solutions', 0.8],
    ['/industries', 0.7],
    ['/partnerships', 0.7],
    ['/contact', 0.7],
  ];
  return pages.map(([path, priority]) => ({ url: `${baseUrl}${path}`, lastModified: now, changeFrequency: 'monthly', priority }));
}
