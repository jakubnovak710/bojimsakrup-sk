// Core hail probability calculation logic.
// In production this runs server-side every 10 min using Rainviewer + Open-Meteo data.

export interface RadarCell {
  lat: number
  lon: number
  intensityDbz: number
  velocityKmh: number
  headingDeg: number  // 0=N, 90=E, 180=S, 270=W
}

export interface ConvectiveParams {
  cape: number         // J/kg — Convective Available Potential Energy
  liftedIndex: number  // negative = unstable
  cin: number          // Convective Inhibition J/kg
}

export function hailProbability(
  targetLat: number,
  targetLon: number,
  cells: RadarCell[],
  params: ConvectiveParams
): { probability: number; etaMinutes: number | null; closestCell: RadarCell | null } {
  if (cells.length === 0 || params.cape < 500) {
    return { probability: capeProbability(params.cape), etaMinutes: null, closestCell: null }
  }

  let best = { prob: 0, eta: null as number | null, cell: null as RadarCell | null }

  for (const cell of cells) {
    const distKm = haversineKm(targetLat, targetLon, cell.lat, cell.lon)
    const trajProb = trajectoryProbability(targetLat, targetLon, cell, distKm)
    const intensityBonus = intensityFactor(cell.intensityDbz)
    const convectiveBonus = capeProbability(params.cape)

    const prob = Math.min(100, Math.round(trajProb * intensityBonus * convectiveBonus / 100))
    if (prob > best.prob) {
      best.prob = prob
      best.eta = distKm / cell.velocityKmh * 60
      best.cell = cell
    }
  }

  return { probability: best.prob, etaMinutes: best.eta ? Math.round(best.eta) : null, closestCell: best.cell }
}

function trajectoryProbability(
  targetLat: number, targetLon: number,
  cell: RadarCell, distKm: number
): number {
  // Angle from cell to target
  const dLat = targetLat - cell.lat
  const dLon = targetLon - cell.lon
  const angleToTarget = Math.atan2(dLon, dLat) * 180 / Math.PI
  const angleDiff = Math.abs(normalizeAngle(cell.headingDeg - angleToTarget))

  // Full probability if heading directly toward target (±15°), falls off to 0 at ±90°
  const angleFactor = angleDiff < 90 ? Math.cos(angleDiff * Math.PI / 180) : 0
  // Distance factor: max probability within 20km, falls off to 0 at 150km
  const distFactor = Math.max(0, 1 - distKm / 150)

  return angleFactor * distFactor * 100
}

function intensityFactor(dbz: number): number {
  if (dbz >= 65) return 1.3    // severe hail likely
  if (dbz >= 55) return 1.15   // large hail possible
  if (dbz >= 45) return 1.0    // hail possible
  if (dbz >= 35) return 0.7    // heavy rain, maybe small hail
  return 0.3
}

function capeProbability(cape: number): number {
  if (cape >= 2500) return 95
  if (cape >= 2000) return 85
  if (cape >= 1500) return 72
  if (cape >= 1000) return 55
  if (cape >= 500)  return 30
  return 8
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeAngle(angle: number): number {
  while (angle > 180) angle -= 360
  while (angle < -180) angle += 360
  return angle
}

export function probabilityToRisk(probability: number) {
  if (probability >= 70) return 'extreme' as const
  if (probability >= 45) return 'high' as const
  if (probability >= 20) return 'low' as const
  return 'none' as const
}

export function degreeToCompass(deg: number): string {
  const dirs = ['S','SSV','SV','VSV','V','VJV','JV','JJV','J','JJZ','JZ','ZJZ','Z','ZSZ','SZ','SSZ']
  return dirs[Math.round(deg / 22.5) % 16]
}
