// OpenWeatherMap integration — current weather + 5-day forecast
// Free tier: 60 calls/min, 1M calls/month
// Docs: https://openweathermap.org/api/one-call-3

const API_KEY = process.env.OPENWEATHER_API_KEY
const BASE = 'https://api.openweathermap.org/data/2.5'

export interface CurrentWeather {
  temp: number          // °C
  feelsLike: number
  humidity: number      // %
  windSpeed: number     // m/s
  windDeg: number       // 0–360
  cloudiness: number    // %
  description: string   // lokalizovaný popis
  icon: string          // kód ikony (napr. "11d")
  pressure: number      // hPa
  visibility: number    // m
  updatedAt: number     // unix timestamp
}

export async function fetchCurrentWeather(
  lat: number,
  lon: number
): Promise<CurrentWeather | null> {
  if (!API_KEY) return null
  try {
    const res = await fetch(
      `${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sk`,
      { next: { revalidate: 900 } }
    )
    if (!res.ok) return null
    const d = await res.json()
    return {
      temp:        Math.round(d.main.temp),
      feelsLike:   Math.round(d.main.feels_like),
      humidity:    d.main.humidity,
      windSpeed:   d.wind.speed,
      windDeg:     d.wind.deg ?? 0,
      cloudiness:  d.clouds.all,
      description: d.weather[0]?.description ?? '',
      icon:        d.weather[0]?.icon ?? '',
      pressure:    d.main.pressure,
      visibility:  d.visibility ?? 0,
      updatedAt:   d.dt,
    }
  } catch {
    return null
  }
}

export function mpsToKmh(mps: number): number {
  return Math.round(mps * 3.6)
}

export function degToCompass(deg: number): string {
  const dirs = ['S','SSV','SV','VSV','V','VJV','JV','JJV','J','JJZ','JZ','ZJZ','Z','ZSZ','SZ','SSZ']
  return dirs[Math.round(deg / 22.5) % 16]
}

// Thunderstorm weather codes (OWM group 2xx)
export function isThunderstorm(icon: string): boolean {
  return icon.startsWith('11')
}

// Rain codes (3xx drizzle, 5xx rain)
export function isRain(icon: string): boolean {
  return icon.startsWith('09') || icon.startsWith('10')
}
