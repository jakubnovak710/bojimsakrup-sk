import type { RiskLevel } from './types'
import { SK_OKRESY, okresyByKraj, getOkres } from './okresy-data'

export interface KrajWeather {
  slug: string
  risk: RiskLevel        // AKTUÁLNE riziko — čo sa deje práve teraz
  riskPeak: RiskLevel    // najvyššie riziko predpovedané na dnes
  cape: number           // J/kg — aktuálna hodina
  capePeak: number       // max CAPE počas dňa (predpoveď)
  capePeakHour: string   // čas max CAPE (ISO)
  wmoCode: number        // WMO počasie kód (aktuálna hodina)
  wmoCodePeak: number    // najhorší WMO kód v nasledujúcich 6h (predpoveď)
  wmoPeakHour: string    // čas najhoršieho WMO kódu (ISO)
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

interface OpenMeteoForecast {
  current: {
    weather_code?: number
    temperature_2m?: number
    wind_speed_10m?: number
    wind_gusts_10m?: number
  }
  hourly: {
    time: string[]
    cape: (number | null)[]
    precipitation_probability: (number | null)[]
    weather_code: (number | null)[]
  }
}

function parseForecast(slug: string, d: OpenMeteoForecast): KrajWeather {
  const cur  = d.current
  const hrly = d.hourly

  // Aktuálna hodina
  const now      = new Date()
  const nowHour  = now.getHours()
  const currentI = Math.min(nowHour, hrly.time.length - 1)

  const currentCAPE = hrly.cape[currentI] ?? 0
  const precipProb  = hrly.precipitation_probability[currentI] ?? 0
  const wmoCode     = Number(cur.weather_code ?? hrly.weather_code[currentI] ?? 0)

  // AKTUÁLNE riziko — len z toho čo sa deje práve teraz (žiadna predpoveď)
  const risk = maxRisk(wmoToRisk(wmoCode), capeToRisk(currentCAPE))

  // Peak CAPE zvyšok dňa (od teraz, nie spätne)
  const futureCapes = hrly.cape.slice(currentI).map(v => v ?? 0)
  const capePeak     = Math.max(currentCAPE, ...futureCapes)
  const peakIdx      = hrly.cape.indexOf(capePeak) // hľadá v celom dni (peak môže byť aj teraz)
  const capePeakH     = hrly.time[peakIdx] ?? ''

  // Najhorší WMO v nasledujúcich 6h
  const nextWmos    = hrly.weather_code.slice(currentI, currentI + 6).map(v => v ?? 0)
  const wmoCodePeak  = Math.max(...nextWmos)
  const wmoPeakIdx   = hrly.weather_code.slice(currentI, currentI + 6).findIndex(v => v === wmoCodePeak)
  const wmoPeakHour  = hrly.time[currentI + Math.max(0, wmoPeakIdx)] ?? ''

  // Riziko predpovede = max(aktuálne riziko, peak CAPE, WMO peak 6h)
  const riskPeak = maxRisk(
    maxRisk(risk, capeToRisk(capePeak)),
    wmoToRisk(wmoCodePeak),
  )

  return {
    slug,
    risk,
    riskPeak,
    cape:         Math.round(currentCAPE),
    capePeak:     Math.round(capePeak),
    capePeakHour: capePeakH,
    wmoCode,
    wmoCodePeak,
    wmoPeakHour,
    tempC:        Math.round(cur.temperature_2m ?? 0),
    windKmh:      Math.round(cur.wind_speed_10m ?? 0),
    gustsKmh:     Math.round(cur.wind_gusts_10m ?? 0),
    precipProb:   Math.round(precipProb),
    updatedAt:    new Date().toISOString(),
  }
}

const FORECAST_PARAMS = {
  current: ['weather_code', 'temperature_2m', 'precipitation', 'wind_speed_10m', 'wind_gusts_10m'].join(','),
  hourly:  ['cape', 'precipitation_probability', 'weather_code'].join(','),
}

// Jediný batch HTTP request pre N súradníc (Open-Meteo podporuje čiarkou oddelené lat/lon)
async function fetchBatch(
  points: { slug: string; lat: number; lon: number }[],
): Promise<KrajWeather[]> {
  if (points.length === 0) return []
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude',  points.map(p => p.lat).join(','))
  url.searchParams.set('longitude', points.map(p => p.lon).join(','))
  url.searchParams.set('current',       FORECAST_PARAMS.current)
  url.searchParams.set('hourly',        FORECAST_PARAMS.hourly)
  url.searchParams.set('timezone',      'Europe/Bratislava')
  url.searchParams.set('forecast_days', '1')

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
  if (!res.ok) throw new Error(`open-meteo batch: ${res.status}`)
  const data = await res.json()

  // Batch odpoveď = array, jednotlivá = objekt — normalizuj na array
  const arr: OpenMeteoForecast[] = Array.isArray(data) ? data : [data]
  return arr.map((d, i) => parseForecast(points[i].slug, d))
}

// Načíta počasie pre všetky kraje (1 batch request)
export async function fetchAllKrajeWeather(): Promise<KrajWeather[]> {
  const points = Object.entries(KRAJ_COORDS).map(([slug, c]) => ({ slug, ...c }))
  try {
    return await fetchBatch(points)
  } catch (err) {
    console.error('[weather-api] kraje batch failed', err)
    return []
  }
}

// Načíta počasie pre všetkých 79 okresov SR (1 batch request) — voliteľne len pre jeden kraj
export async function fetchAllOkresyWeather(krajSlug?: string): Promise<KrajWeather[]> {
  const list = krajSlug ? okresyByKraj(krajSlug) : SK_OKRESY
  const points = list.map(o => ({ slug: o.slug, lat: o.lat, lon: o.lon }))
  try {
    return await fetchBatch(points)
  } catch (err) {
    console.error('[weather-api] okresy batch failed', err)
    return []
  }
}

// Počasie pre jeden okres (z existujúceho zoznamu, ak treba len jeden)
export async function fetchOneOkresWeather(okresSlug: string): Promise<KrajWeather | null> {
  const okres = getOkres(okresSlug)
  if (!okres) return null
  const [result] = await fetchBatch([{ slug: okres.slug, lat: okres.lat, lon: okres.lon }])
  return result ?? null
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

// ISO čas → "15:00"
export function hourLabel(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}
