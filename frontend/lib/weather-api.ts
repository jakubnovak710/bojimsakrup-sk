import type { RiskLevel } from './types'

export interface KrajWeather {
  slug: string
  risk: RiskLevel
  cape: number           // J/kg — aktuálna hodina alebo najbližší peak
  capePeak: number       // max CAPE počas dňa
  capePeakHour: string   // čas max CAPE (ISO)
  wmoCode: number        // WMO počasie kód (aktuálna hodina)
  wmoCodePeak: number    // najhorší WMO kód v nasledujúcich 6h
  tempC: number
  windKmh: number
  gustsKmh: number
  precipProb: number     // % pravdepodobnosť zrážok
  updatedAt: string
}

// Súradnice krajských miest
const KRAJ_COORDS: Record<string, { lat: number; lon: number }> = {
  'bratislavsky-kraj':    { lat: 48.1486, lon: 17.1077 },
  'trnavsky-kraj':        { lat: 48.3774, lon: 17.5880 },
  'trenciansky-kraj':     { lat: 48.8944, lon: 18.0441 },
  'nitriansky-kraj':      { lat: 48.3078, lon: 18.0899 },
  'zilinsky-kraj':        { lat: 49.2234, lon: 18.7394 },
  'banskobystricky-kraj': { lat: 48.7360, lon: 19.1460 },
  'presovsky-kraj':       { lat: 48.9988, lon: 21.2327 },
  'kosicky-kraj':         { lat: 48.7172, lon: 21.2497 },
}

// WMO kódy → riziko krúp
function wmoToRisk(code: number): RiskLevel {
  if (code === 99) return 'extreme'            // búrka s ťažkými krúpami
  if (code === 96 || code === 97) return 'high' // búrka s krúpami
  if (code === 95) return 'medium'             // búrka (bez krúp)
  if (code >= 80 && code <= 82) return 'low'   // dažďové prehánky
  if (code >= 51 && code <= 67) return 'low'   // mrholenie/dážď
  return 'none'
}

// CAPE → riziko
function capeToRisk(cape: number): RiskLevel {
  if (cape >= 2500) return 'extreme'
  if (cape >= 1500) return 'high'
  if (cape >= 800)  return 'medium'
  if (cape >= 300)  return 'low'
  return 'none'
}

const RISK_NUM: Record<RiskLevel, number> = {
  none: 0, low: 1, medium: 2, high: 3, extreme: 4,
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_NUM[a] >= RISK_NUM[b] ? a : b
}

async function fetchOneKraj(
  slug: string,
  coords: { lat: number; lon: number },
): Promise<KrajWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',  String(coords.lat))
  url.searchParams.set('longitude', String(coords.lon))
  url.searchParams.set('current', [
    'weather_code', 'temperature_2m', 'precipitation',
    'wind_speed_10m', 'wind_gusts_10m',
  ].join(','))
  url.searchParams.set('hourly', [
    'cape', 'precipitation_probability', 'weather_code',
  ].join(','))
  url.searchParams.set('timezone',      'Europe/Bratislava')
  url.searchParams.set('forecast_days', '1')

  const res  = await fetch(url.toString(), { next: { revalidate: 1800 } })
  if (!res.ok) throw new Error(`open-meteo ${slug}: ${res.status}`)
  const d    = await res.json()
  const cur  = d.current
  const hrly = d.hourly as {
    time: string[]
    cape: (number | null)[]
    precipitation_probability: (number | null)[]
    weather_code: (number | null)[]
  }

  // Aktuálna hodina
  const now      = new Date()
  const nowHour  = now.getHours()
  const currentI = Math.min(nowHour, hrly.time.length - 1)

  const currentCAPE = hrly.cape[currentI] ?? 0
  const precipProb  = hrly.precipitation_probability[currentI] ?? 0
  const wmoCode     = Number(cur.weather_code ?? hrly.weather_code[currentI] ?? 0)

  // Peak CAPE celý deň
  const capes      = hrly.cape.map(v => v ?? 0)
  const capePeak   = Math.max(...capes)
  const peakIdx    = capes.indexOf(capePeak)
  const capePeakH  = hrly.time[peakIdx] ?? ''

  // Najhorší WMO v nasledujúcich 6h
  const nextWmos   = hrly.weather_code.slice(currentI, currentI + 6).map(v => v ?? 0)
  const wmoCodePeak = Math.max(...nextWmos)

  // Riziko = max(aktuálny WMO, peak CAPE, WMO peak 6h)
  const risk = maxRisk(
    maxRisk(wmoToRisk(wmoCode), capeToRisk(capePeak)),
    wmoToRisk(wmoCodePeak),
  )

  return {
    slug,
    risk,
    cape:         Math.round(currentCAPE),
    capePeak:     Math.round(capePeak),
    capePeakHour: capePeakH,
    wmoCode,
    wmoCodePeak,
    tempC:        Math.round(cur.temperature_2m ?? 0),
    windKmh:      Math.round(cur.wind_speed_10m ?? 0),
    gustsKmh:     Math.round(cur.wind_gusts_10m ?? 0),
    precipProb:   Math.round(precipProb),
    updatedAt:    new Date().toISOString(),
  }
}

// Načíta počasie pre všetky kraje paralelne
export async function fetchAllKrajeWeather(): Promise<KrajWeather[]> {
  const results = await Promise.allSettled(
    Object.entries(KRAJ_COORDS).map(([slug, coords]) => fetchOneKraj(slug, coords))
  )
  return results
    .filter((r): r is PromiseFulfilledResult<KrajWeather> => r.status === 'fulfilled')
    .map(r => r.value)
}

export function weatherToRiskBySlug(data: KrajWeather[]): Record<string, RiskLevel> {
  return Object.fromEntries(data.map(d => [d.slug, d.risk]))
}

// WMO kód → slovenský popis
export function wmoLabel(code: number): string {
  if (code === 0)  return 'Jasno'
  if (code <= 2)   return 'Polojasno'
  if (code === 3)  return 'Zamračené'
  if (code <= 49)  return 'Hmla'
  if (code <= 67)  return 'Dážď'
  if (code <= 77)  return 'Sneženie'
  if (code <= 82)  return 'Prehánky'
  if (code <= 86)  return 'Snehové prehánky'
  if (code === 95) return 'Búrka'
  if (code === 96) return 'Búrka s krúpami'
  if (code === 99) return 'Silná búrka s krúpami'
  return 'Neznáme'
}
