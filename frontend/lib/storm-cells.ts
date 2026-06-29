// Storm cell data structure — bude plnené Python backendom cez /api/cells
// Optický tok (Farneback) na Rainviewer snímkoch, blob detection na dBZ threshold

export interface StormCell {
  id: string
  lat: number
  lon: number
  dbz: number           // radarová reflektivita dBZ (35+ = búrka, 50+ = krúpy)
  directionDeg: number  // 0 = sever, 90 = východ, 180 = juh, 270 = západ
  speedKmh: number
  trajectory: TrajectoryPoint[]
  updatedAt: string
}

export interface TrajectoryPoint {
  lat: number
  lon: number
  etaMin: number
}

// Haversine projekcia bodu z lat/lon + smer + vzdialenosť
function projectPoint(lat: number, lon: number, dirDeg: number, distKm: number): { lat: number; lon: number } {
  const R = 6371
  const dirRad = (dirDeg * Math.PI) / 180
  const distRad = distKm / R
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180

  const newLat = Math.asin(
    Math.sin(latRad) * Math.cos(distRad) +
    Math.cos(latRad) * Math.sin(distRad) * Math.cos(dirRad)
  )
  const newLon = lonRad + Math.atan2(
    Math.sin(dirRad) * Math.sin(distRad) * Math.cos(latRad),
    Math.cos(distRad) - Math.sin(latRad) * Math.sin(newLat)
  )

  return {
    lat: (newLat * 180) / Math.PI,
    lon: (newLon * 180) / Math.PI,
  }
}

export function buildTrajectory(
  lat: number, lon: number, dirDeg: number, speedKmh: number,
  steps = [15, 30, 45, 60]
): TrajectoryPoint[] {
  return steps.map(etaMin => {
    const distKm = (speedKmh * etaMin) / 60
    const { lat: pLat, lon: pLon } = projectPoint(lat, lon, dirDeg, distKm)
    return { lat: pLat, lon: pLon, etaMin }
  })
}

// Mock dáta — v produkcii prídu z /api/cells (Python backend)
export const MOCK_CELLS: StormCell[] = [
  {
    id: 'cell-bb-01',
    lat: 48.312,
    lon: 18.641,
    dbz: 52,
    directionDeg: 70,   // ENE → smerom k Banskej Bystrici
    speedKmh: 55,
    trajectory: buildTrajectory(48.312, 18.641, 70, 55),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cell-ke-01',
    lat: 48.501,
    lon: 21.101,
    dbz: 61,
    directionDeg: 355,  // takmer priamo na sever
    speedKmh: 42,
    trajectory: buildTrajectory(48.501, 21.101, 355, 42),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cell-za-01',
    lat: 49.052,
    lon: 18.741,
    dbz: 38,
    directionDeg: 110,  // ESE
    speedKmh: 38,
    trajectory: buildTrajectory(49.052, 18.741, 110, 38),
    updatedAt: new Date().toISOString(),
  },
]

// dBZ → farba a riziko
export function dbzToColor(dbz: number): string {
  if (dbz >= 60) return '#7F1D1D'  // extrémne
  if (dbz >= 50) return '#EF4444'  // vysoké
  if (dbz >= 40) return '#FB923C'  // zvýšené
  if (dbz >= 30) return '#FACC15'  // nízke
  return '#86EFAC'
}

export function dbzToRisk(dbz: number): string {
  if (dbz >= 60) return 'Extrémne'
  if (dbz >= 50) return 'Vysoké'
  if (dbz >= 40) return 'Zvýšené'
  if (dbz >= 30) return 'Nízke'
  return 'Bez rizika'
}
