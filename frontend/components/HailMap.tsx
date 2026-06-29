'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { RISK, type RiskLevel } from '@/lib/types'
import { type StormCell, dbzToColor, dbzToRisk } from '@/lib/storm-cells'

const IDN3_KRAJ: Record<number, string> = {
  1: 'bratislavsky-kraj',
  2: 'trnavsky-kraj',
  3: 'trenciansky-kraj',
  4: 'nitriansky-kraj',
  5: 'zilinsky-kraj',
  6: 'banskobystricky-kraj',
  7: 'presovsky-kraj',
  8: 'kosicky-kraj',
}

interface OkresTooltip { x: number; y: number; name: string; risk: RiskLevel }
interface CellTooltip  { x: number; y: number; cell: StormCell }

interface Props {
  riskBySlug: Record<string, RiskLevel>
  cells?: StormCell[]
  className?: string
}

export function HailMap({ riskBySlug, cells = [], className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const [ready, setReady]            = useState(false)
  const [okTooltip, setOkTooltip]   = useState<OkresTooltip | null>(null)
  const [cellTooltip, setCellTooltip] = useState<CellTooltip | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#F8FAFC' } }],
      },
      center: [19.3, 48.72],
      zoom: 6.5,
      minZoom: 5.5,
      maxZoom: 10,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
    })
    map.touchZoomRotate.disableRotation()

    let cancelled = false

    map.on('load', async () => {
      try {
        // ── 1. Okres choropleth ──────────────────────────────────────────────
        const res = await fetch('/okresy.geojson')
        if (!res.ok) throw new Error(`geojson ${res.status}`)
        const raw = await res.json()

        const features = raw.features.map((f: { properties?: Record<string, unknown>; geometry: unknown }) => {
          const idn3 = Number(f.properties?.IDN3 ?? 0)
          const krajSlug = IDN3_KRAJ[Math.floor(idn3 / 100)] ?? ''
          const risk: RiskLevel = riskBySlug[krajSlug] ?? 'none'
          return { ...f, properties: { ...f.properties, risk, krajSlug } }
        })

        if (cancelled) return

        map.addSource('okresy', { type: 'geojson', data: { ...raw, features }, promoteId: 'IDN3' })
        map.addLayer({
          id: 'okresy-fill', type: 'fill', source: 'okresy',
          paint: {
            'fill-color': ['match', ['get', 'risk'],
              'extreme', RISK.extreme.map, 'high', RISK.high.map,
              'medium', RISK.medium.map, 'low', RISK.low.map, RISK.none.map],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.82],
          },
        })
        map.addLayer({
          id: 'okresy-line', type: 'line', source: 'okresy',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 0.75],
            'line-opacity': 0.95,
          },
        })

        // ── 2. Storm cell trajectories ───────────────────────────────────────
        if (cells.length > 0) {
          // Trajectory lines (dashed)
          const trajectoryLines = {
            type: 'FeatureCollection' as const,
            features: cells.map(cell => ({
              type: 'Feature' as const,
              properties: { id: cell.id, color: dbzToColor(cell.dbz) },
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [cell.lon, cell.lat],
                  ...cell.trajectory.map(p => [p.lon, p.lat]),
                ],
              },
            })),
          }

          // Future position dots
          const futurePoints = {
            type: 'FeatureCollection' as const,
            features: cells.flatMap(cell =>
              cell.trajectory.map(p => ({
                type: 'Feature' as const,
                properties: {
                  id: cell.id, etaMin: p.etaMin,
                  color: dbzToColor(cell.dbz),
                  // opacity fades: 15min=0.7, 30min=0.5, 45min=0.3, 60min=0.2
                  opacity: Math.max(0.2, 0.85 - (p.etaMin / 60) * 0.65),
                  radius: Math.max(4, 8 - (p.etaMin / 60) * 4),
                },
                geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
              }))
            ),
          }

          // Current cell positions
          const cellPoints = {
            type: 'FeatureCollection' as const,
            features: cells.map(cell => ({
              type: 'Feature' as const,
              properties: {
                id: cell.id, dbz: cell.dbz, speedKmh: cell.speedKmh,
                directionDeg: cell.directionDeg, color: dbzToColor(cell.dbz),
                risk: dbzToRisk(cell.dbz), updatedAt: cell.updatedAt,
              },
              geometry: { type: 'Point' as const, coordinates: [cell.lon, cell.lat] },
            })),
          }

          map.addSource('trajectories', { type: 'geojson', data: trajectoryLines })
          map.addSource('future-points', { type: 'geojson', data: futurePoints })
          map.addSource('cell-points', { type: 'geojson', data: cellPoints })

          // Trajectory line
          map.addLayer({
            id: 'trajectory-line', type: 'line', source: 'trajectories',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2,
              'line-opacity': 0.7,
              'line-dasharray': [4, 3],
            },
          })

          // Future position dots (fading)
          map.addLayer({
            id: 'future-dots', type: 'circle', source: 'future-points',
            paint: {
              'circle-radius': ['get', 'radius'],
              'circle-color': ['get', 'color'],
              'circle-opacity': ['get', 'opacity'],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1,
              'circle-stroke-opacity': ['get', 'opacity'],
            },
          })

          // Cell glow (outer ring)
          map.addLayer({
            id: 'cell-glow', type: 'circle', source: 'cell-points',
            paint: {
              'circle-radius': cells.reduce((max, c) => Math.max(max, c.dbz >= 50 ? 28 : c.dbz >= 40 ? 22 : 16), 16),
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.15,
              'circle-blur': 1,
            },
          })

          // Cell center dot
          map.addLayer({
            id: 'cell-dots', type: 'circle', source: 'cell-points',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'dbz'], 30, 7, 50, 12, 65, 16],
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.95,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2,
            },
          })

          // Cell hover
          map.on('mousemove', 'cell-dots', (e) => {
            map.getCanvas().style.cursor = 'pointer'
            const f = e.features?.[0]
            if (!f) return
            const props = f.properties as { id?: string }
            const cell = cells.find(c => c.id === props.id)
            if (!cell) return
            setCellTooltip({ x: e.point.x, y: e.point.y, cell })
            setOkTooltip(null)
          })
          map.on('mouseleave', 'cell-dots', () => {
            map.getCanvas().style.cursor = ''
            setCellTooltip(null)
          })
        }

        map.fitBounds([[16.83, 47.73], [22.57, 49.61]], { padding: 20, duration: 0 })
        map.resize()

        // ── 3. Okres hover ───────────────────────────────────────────────────
        let hoveredId: string | number | null = null
        map.on('mousemove', 'okresy-fill', (e) => {
          if (cellTooltip) return
          map.getCanvas().style.cursor = 'pointer'
          const f = e.features?.[0]
          if (!f || f.id === undefined) return
          if (hoveredId !== null && hoveredId !== f.id) {
            map.setFeatureState({ source: 'okresy', id: hoveredId }, { hover: false })
          }
          hoveredId = f.id
          map.setFeatureState({ source: 'okresy', id: hoveredId }, { hover: true })
          const p = f.properties as { NM3?: string; risk?: string }
          setOkTooltip({ x: e.point.x, y: e.point.y, name: p.NM3 ?? '', risk: (p.risk ?? 'none') as RiskLevel })
        })
        map.on('mouseleave', 'okresy-fill', () => {
          map.getCanvas().style.cursor = ''
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'okresy', id: hoveredId }, { hover: false })
          }
          hoveredId = null
          setOkTooltip(null)
        })

        setReady(true)
      } catch (err) {
        console.error('[HailMap]', err)
      }
    })

    mapRef.current = map
    return () => {
      cancelled = true
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {!ready && <div className="absolute inset-0 bg-[#F1F5F9] animate-pulse rounded-xl" />}

      {/* Okres tooltip */}
      {okTooltip && (
        <div
          className="pointer-events-none absolute z-20 bg-white border border-[#E5E7EB] rounded-lg shadow-md px-3 py-2 -translate-y-full -translate-x-1/2"
          style={{ left: okTooltip.x, top: okTooltip.y - 8 }}
        >
          <div className="text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">{okTooltip.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: RISK[okTooltip.risk].indicator }} />
            <span className="text-[11px]" style={{ color: RISK[okTooltip.risk].text }}>{RISK[okTooltip.risk].label}</span>
          </div>
        </div>
      )}

      {/* Storm cell tooltip */}
      {cellTooltip && (
        <div
          className="pointer-events-none absolute z-20 bg-white border border-[#E5E7EB] rounded-xl shadow-lg px-3.5 py-3 -translate-y-full -translate-x-1/2 min-w-[160px]"
          style={{ left: cellTooltip.x, top: cellTooltip.y - 12 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: dbzToColor(cellTooltip.cell.dbz) }} />
            <span className="text-[13px] font-bold text-[#0F172A]">{dbzToRisk(cellTooltip.cell.dbz)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-4">
              <span className="text-[11px] text-[#64748B]">Intenzita</span>
              <span className="text-[11px] font-semibold text-[#0F172A]">{cellTooltip.cell.dbz} dBZ</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[11px] text-[#64748B]">Rýchlosť</span>
              <span className="text-[11px] font-semibold text-[#0F172A]">{cellTooltip.cell.speedKmh} km/h</span>
            </div>
            {cellTooltip.cell.trajectory[0] && (
              <div className="flex justify-between gap-4 pt-1 border-t border-[#F1F5F9] mt-0.5">
                <span className="text-[11px] text-[#64748B]">Za 15 min</span>
                <span className="text-[11px] font-semibold" style={{ color: dbzToColor(cellTooltip.cell.dbz) }}>
                  {cellTooltip.cell.trajectory[0].lat.toFixed(3)}°N
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur-sm border border-[#E5E7EB] rounded-lg px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          {(['none', 'low', 'medium', 'high', 'extreme'] as RiskLevel[]).map(level => (
            <div key={level} className="flex flex-col items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-sm block" style={{ background: RISK[level].map }} />
              <span className="text-[9px] leading-none" style={{ color: RISK[level].text }}>
                {RISK[level].label.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cell count badge */}
      {cells.length > 0 && (
        <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#0F172A]">{cells.length} aktívne bunky</span>
        </div>
      )}
    </div>
  )
}
