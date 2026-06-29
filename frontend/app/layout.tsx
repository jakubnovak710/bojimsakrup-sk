import type { Metadata } from 'next'
import './globals.css'
import { BottomNav } from '@/components/BottomNav'
import { TopNav } from '@/components/TopNav'

const BASE = 'https://bojimsakrup.sk'

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: 'BojímSaKrúp.sk — Monitoring krupobitia na Slovensku',
    template: '%s | BojímSaKrúp.sk',
  },
  description: 'Sledujte pravdepodobnosť krupobitia vo vašej obci v reálnom čase. Radarová analýza búrkových buniek aktualizovaná každých 15 minút. Pokrytie celého Slovenska.',
  keywords: ['krupobitie', 'búrky', 'počasie Slovensko', 'radar búrky', 'hailstorm Slovakia', 'CAPE index'],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    locale: 'sk_SK',
    url: BASE,
    siteName: 'BojímSaKrúp.sk',
    title: 'BojímSaKrúp.sk — Monitoring krupobitia na Slovensku',
    description: 'Pravdepodobnosť krupobitia vo vašej obci. Radarová analýza búrkových buniek, CAPE index a ETA dopadu. Celé Slovensko, 15-minútová aktualizácia.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BojímSaKrúp.sk — Mapa rizika krupobitia na Slovensku' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BojímSaKrúp.sk — Monitoring krupobitia na Slovensku',
    description: 'Pravdepodobnosť krupobitia vo vašej obci. Radarová analýza, CAPE index. Celé Slovensko.',
    images: ['/og-image.png'],
    creator: '@BojimSaKrup',
  },
  alternates: { canonical: BASE },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <head>
        {/* Umami — self-hosted, GDPR-friendly, cookieless analytics */}
        {process.env.NEXT_PUBLIC_UMAMI_ID && (
          <script
            defer
            src={process.env.NEXT_PUBLIC_UMAMI_URL ?? 'https://analytics.bojimsakrup.sk/script.js'}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_ID}
          />
        )}
      </head>
      <body className="bg-[#F8FAFC]">
        <TopNav />
        <main className="min-h-screen pb-20 lg:pb-0">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
