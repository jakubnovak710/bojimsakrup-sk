/**
 * Klient pre /api/cells — Python backend na Hetzneri.
 * V dev mode (NEXT_PUBLIC_API_URL nie je nastavené) padne späť na MOCK_CELLS.
 */

import type { StormCell } from './storm-cells'
import { MOCK_CELLS } from './storm-cells'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function fetchStormCells(): Promise<StormCell[]> {
  if (!API_URL) {
    // Lokálny vývoj bez backendu — použijeme mock
    return MOCK_CELLS
  }

  try {
    const res = await fetch(`${API_URL}/api/cells`, {
      next: { revalidate: 600 },  // ISR cache 10 minút (zhodné s backendom)
    })
    if (!res.ok) throw new Error(`/api/cells ${res.status}`)
    const data = await res.json()

    return (data.cells ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      dbz: c.dbz,
      directionDeg: c.direction_deg,
      speedKmh: c.speed_kmh,
      trajectory: (c.trajectory as Record<string, unknown>[]).map(p => ({
        lat: p.lat,
        lon: p.lon,
        etaMin: p.eta_min,
      })),
      updatedAt: c.updated_at ?? new Date().toISOString(),
    })) as StormCell[]
  } catch (err) {
    console.error('[fetchStormCells]', err)
    return []
  }
}
