import type { KrajData } from './types'

export const MOCK_KRAJE: KrajData[] = [
  {
    slug: 'bratislavsky-kraj',
    name: 'Bratislavský kraj',
    risk: 'none',
    hazards: { krupy: 5, burky: 8, vietor: 15, dazd: 20 },
    okresy: [
      {
        slug: 'okres-bratislava-i',
        name: 'Okres Bratislava I',
        krajSlug: 'bratislavsky-kraj',
        risk: 'none',
        hazards: { krupy: 5, burky: 8, vietor: 15, dazd: 20 },
        obce: [
          {
            slug: 'bratislava',
            name: 'Bratislava',
            okresSlug: 'okres-bratislava-i',
            krajSlug: 'bratislavsky-kraj',
            lat: 48.1486, lon: 17.1077,
            risk: 'none',
            hazards: { krupy: 5, burky: 8, vietor: 15, dazd: 20 },
            audit: {
              updatedAt: '2026-06-29T15:41:00Z',
              cape: 180,
              liftedIndex: 2.4,
              radarCell: null,
              explanation: 'Atmosféra je stabilná, CAPE 180 J/kg nestačí na tvorbu búrok. Žiadne konvektívne bunky v dosahu 150 km.',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'trnavsky-kraj',
    name: 'Trnavský kraj',
    risk: 'none',
    hazards: { krupy: 12, burky: 18, vietor: 22, dazd: 35 },
    okresy: [],
  },
  {
    slug: 'trenciansky-kraj',
    name: 'Trenčiansky kraj',
    risk: 'low',
    hazards: { krupy: 28, burky: 35, vietor: 40, dazd: 55 },
    okresy: [],
  },
  {
    slug: 'nitriansky-kraj',
    name: 'Nitriansky kraj',
    risk: 'none',
    hazards: { krupy: 10, burky: 14, vietor: 18, dazd: 30 },
    okresy: [],
  },
  {
    slug: 'zilinsky-kraj',
    name: 'Žilinský kraj',
    risk: 'low',
    hazards: { krupy: 35, burky: 42, vietor: 55, dazd: 65 },
    okresy: [],
  },
  {
    slug: 'banskobystricky-kraj',
    name: 'Banskobystrický kraj',
    risk: 'medium',
    hazards: { krupy: 62, burky: 70, vietor: 48, dazd: 80 },
    okresy: [
      {
        slug: 'okres-banska-bystrica',
        name: 'Okres Banská Bystrica',
        krajSlug: 'banskobystricky-kraj',
        risk: 'medium',
        hazards: { krupy: 62, burky: 70, vietor: 48, dazd: 80 },
        obce: [
          {
            slug: 'banska-bystrica',
            name: 'Banská Bystrica',
            okresSlug: 'okres-banska-bystrica',
            krajSlug: 'banskobystricky-kraj',
            lat: 48.7395, lon: 19.1463,
            risk: 'high',
            hazards: { krupy: 62, burky: 70, vietor: 48, dazd: 80 },
            audit: {
              updatedAt: '2026-06-29T15:41:00Z',
              cape: 1820,
              liftedIndex: -3.2,
              radarCell: {
                distanceKm: 28,
                intensityDbz: 52,
                direction: 'ZJZ',
                speedKmh: 55,
                etaMinutes: 31,
              },
              explanation: 'Silná konvektívna bunka (52 dBZ) sa pohybuje zo ZJZ smerom k mestu rýchlosťou 55 km/h. Pri CAPE 1 820 J/kg a zápornom lifted indexe je tvorba krupobitia pravdepodobná. Odhadovaný dopad za 31 minút.',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'presovsky-kraj',
    name: 'Prešovský kraj',
    risk: 'none',
    hazards: { krupy: 8, burky: 12, vietor: 20, dazd: 25 },
    okresy: [
      {
        slug: 'okres-topoltany',
        name: 'Okres Topoľčany',
        krajSlug: 'presovsky-kraj',
        risk: 'none',
        hazards: { krupy: 8, burky: 12, vietor: 20, dazd: 25 },
        obce: [
          {
            slug: 'bojna',
            name: 'Bojná',
            okresSlug: 'okres-topoltany',
            krajSlug: 'presovsky-kraj',
            lat: 48.5144, lon: 18.1381,
            risk: 'none',
            hazards: { krupy: 8, burky: 12, vietor: 20, dazd: 25 },
            audit: {
              updatedAt: '2026-06-29T15:41:00Z',
              cape: 420,
              liftedIndex: 0.8,
              radarCell: null,
              explanation: 'CAPE 420 J/kg naznačuje slabú nestabilitu. Žiadna radarová bunka v dosahu 80 km. Riziko krupobitia je minimálne.',
            },
          },
        ],
      },
    ],
  },
  {
    slug: 'kosicky-kraj',
    name: 'Košický kraj',
    risk: 'extreme',
    hazards: { krupy: 88, burky: 91, vietor: 74, dazd: 95 },
    okresy: [],
  },
]

export function getKraj(slug: string) {
  return MOCK_KRAJE.find(k => k.slug === slug) ?? null
}

export function getSlovakiaSummary() {
  const counts: Record<string, number> = { none: 0, low: 0, medium: 0, high: 0, extreme: 0 }
  for (const k of MOCK_KRAJE) counts[k.risk]++
  const worst = MOCK_KRAJE.reduce((a, b) => {
    const order: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, extreme: 4 }
    return order[b.risk] > order[a.risk] ? b : a
  })
  const totalHazards = {
    krupy: Math.round(MOCK_KRAJE.reduce((s, k) => s + k.hazards.krupy, 0) / MOCK_KRAJE.length),
    burky: Math.round(MOCK_KRAJE.reduce((s, k) => s + k.hazards.burky, 0) / MOCK_KRAJE.length),
    vietor: Math.round(MOCK_KRAJE.reduce((s, k) => s + k.hazards.vietor, 0) / MOCK_KRAJE.length),
    dazd: Math.round(MOCK_KRAJE.reduce((s, k) => s + k.hazards.dazd, 0) / MOCK_KRAJE.length),
  }
  return { counts, worst, totalHazards, updatedAt: '2026-06-29T15:41:00Z' }
}
