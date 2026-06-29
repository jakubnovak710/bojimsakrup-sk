import type { RiskLevel } from './types'
import type { StormCell } from './storm-cells'

// Hrubé bbox-y krajov (lat_min, lat_max, lon_min, lon_max)
// + 0.3° buffer aby sme zachytili bunky blízko hranice
const KRAJ_BBOX: Record<string, [number, number, number, number]> = {
  'bratislavsky-kraj':      [47.85, 48.45, 16.85, 17.80],
  'trnavsky-kraj':          [47.80, 48.85, 17.00, 18.45],
  'trenciansky-kraj':       [48.50, 49.45, 17.45, 18.90],
  'nitriansky-kraj':        [47.80, 48.90, 17.75, 19.30],
  'zilinsky-kraj':          [48.65, 49.70, 17.75, 20.10],
  'banskobystricky-kraj':   [47.75, 49.25, 18.45, 21.30],
  'presovsky-kraj':         [48.75, 49.65, 19.85, 22.60],
  'kosicky-kraj':           [47.85, 48.90, 20.70, 22.65],
}

function dbzToRiskLevel(dbz: number): RiskLevel {
  if (dbz >= 60) return 'extreme'
  if (dbz >= 50) return 'high'
  if (dbz >= 40) return 'medium'
  if (dbz >= 30) return 'low'
  return 'none'
}

const RISK_NUM: Record<RiskLevel, number> = {
  none: 0, low: 1, medium: 2, high: 3, extreme: 4,
}

// Odvodí riskBySlug z reálnych buniek.
// Pre každý kraj nájde max dBZ bunky ktorá leží v jeho bbox (alebo do 40 km od centra).
export function deriveRiskBySlug(cells: StormCell[]): Record<string, RiskLevel> {
  const result: Record<string, RiskLevel> = {}

  for (const [slug, [latMin, latMax, lonMin, lonMax]] of Object.entries(KRAJ_BBOX)) {
    let maxDbz = 0

    for (const cell of cells) {
      if (cell.lat >= latMin && cell.lat <= latMax && cell.lon >= lonMin && cell.lon <= lonMax) {
        if (cell.dbz > maxDbz) maxDbz = cell.dbz
      }
      // Aj trajektória — bunka smeruje do kraja
      for (const pt of cell.trajectory.slice(0, 2)) {
        if (pt.lat >= latMin && pt.lat <= latMax && pt.lon >= lonMin && pt.lon <= lonMax) {
          const etaDbz = cell.dbz * 0.85  // zníženie pre budúce polohy
          if (etaDbz > maxDbz) maxDbz = etaDbz
        }
      }
    }

    result[slug] = dbzToRiskLevel(maxDbz)
  }

  return result
}

// Zlúči mock riskBySlug s reálnym (reálny má prednosť ak > none)
export function mergeRisk(
  mockRisk: Record<string, RiskLevel>,
  realRisk: Record<string, RiskLevel>,
): Record<string, RiskLevel> {
  const merged: Record<string, RiskLevel> = { ...mockRisk }
  for (const [slug, level] of Object.entries(realRisk)) {
    if (RISK_NUM[level] > RISK_NUM[merged[slug] ?? 'none']) {
      merged[slug] = level
    }
  }
  return merged
}
