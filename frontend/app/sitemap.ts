import type { MetadataRoute } from 'next'
import { MOCK_KRAJE } from '@/lib/mock-data'

const BASE = 'https://bojimsakrup.sk'

// Revalidate: sitemap sa obnoví každých 24h (ISR)
export const revalidate = 86400

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'always',   // aktualizácia každých 15 min
      priority: 1.0,
    },
  ]

  // Kraj stránky
  for (const kraj of MOCK_KRAJE) {
    entries.push({
      url: `${BASE}/${kraj.slug}`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.9,
    })

    // Okres stránky
    for (const okres of kraj.okresy) {
      entries.push({
        url: `${BASE}/${kraj.slug}/${okres.slug}`,
        lastModified: now,
        changeFrequency: 'always',
        priority: 0.8,
      })

      // Obec stránky
      for (const obec of okres.obce) {
        entries.push({
          url: `${BASE}/${kraj.slug}/${okres.slug}/${obec.slug}`,
          lastModified: now,
          changeFrequency: 'always',
          priority: 0.7,
        })
      }
    }
  }

  return entries
}
