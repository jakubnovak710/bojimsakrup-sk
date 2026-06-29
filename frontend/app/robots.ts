import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://bojimsakrup.sk'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      // Blokujeme AI tréningové crawlery — necháme len search index crawlery
      { userAgent: 'GPTBot',        disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'Bytespider',    disallow: '/' },
      { userAgent: 'CCBot',         disallow: '/' },
      // Perplexity a Claude nechávame — citácie v AI search prinášajú traffic
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
