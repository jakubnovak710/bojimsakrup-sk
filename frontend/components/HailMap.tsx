'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { RISK, type RiskLevel } from '@/lib/types'
import { type StormCell, dbzToColor, dbzToRisk } from '@/lib/storm-cells'

const IDN3_KRAJ: Record<number, string> = {
  1: 'bratislavsky-kraj', 2: 'trnavsky-kraj', 3: 'trenciansky-kraj',
  4: 'nitriansky-kraj', 5: 'zilinsky-kraj', 6: 'banskobystricky-kraj',
  7: 'presovsky-kraj', 8: 'kosicky-kraj',
}

interface CellTooltip { x: number; y: number; cell: StormCell }
interface OkresTooltip { x: number; y: number; name: string; risk: RiskLevel }

interface Props {
  riskBySlug: Record<string, RiskLevel>
  cells?: StormCell[]
  className?: string
}

// Smer v stupňoch → GeoJSON LineString koncový bod (pre šípku)
function arrowEndpoint(lat: number, lon: number, dirDeg: number, lenKm: number) {
  const R = 6371
  const d = lenKm / R
  const lat1 = lat * Math.PI / 180
  const lon1 = lon * Math.PI / 180
  const dir = dirDeg * Math.PI / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(dir))
  const lon2 = lon1 + Math.atan2(Math.sin(dir) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return [lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]
}

export function HailMap({ riskBySlug, cells = [], className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const [ready, setReady]              = useState(false)
  const [okTooltip, setOkTooltip]     = useState<OkresTooltip | null>(null)
  const [cellTooltip, setCellTooltip] = useState<CellTooltip | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          // CARTO Voyager — svetlé, čisté, vhodné pre počasie
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors © CARTO',
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#EFF1F5' } },
          { id: 'base', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.9 } },
        ],
      },
      center: [19.3, 48.72],
      zoom: 6.4,
      minZoom: 5,
      maxZoom: 11,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
    })
    map.touchZoomRotate.disableRotation()

    let cancelled = false

    map.on('load', async () => {
      try {
        // ── 1. Okresy choropleth ─────────────────────────────────────────
        const res = await fetch('/okresy.geojson')
        if (!res.ok) throw new Error('geojson failed')
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
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.85, 0.62],
          },
        })

        map.addLayer({
          id: 'okresy-line', type: 'line', source: 'okresy',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.6],
            'line-opacity': 0.9,
          },
        })

        // Slovakia border — výraznejší obrys
        map.addLayer({
          id: 'sk-border', type: 'line', source: 'okresy',
          paint: { 'line-color': '#64748B', 'line-width': 1.5, 'line-opacity': 0.5 },
        })

        // ── 2. Storm cells ───────────────────────────────────────────────
        if (cells.length > 0) {
          // Filtrovanie: len bunky v okolí Slovenska ±3°
          const nearSK = cells.filter(c =>
            c.lat >= 46.5 && c.lat <= 51.5 &&
            c.lon >= 14.0 && c.lon <= 25.5
          )

          // Trajektórie — prerušovaná čiara
          const trajLines = {
            type: 'FeatureCollection' as const,
            features: nearSK.map(cell => ({
              type: 'Feature' as const,
              properties: { color: dbzToColor(cell.dbz) },
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [cell.lon, cell.lat],
                  ...cell.trajectory.slice(0, 3).map(p => [p.lon, p.lat]),
                ],
              },
            })),
          }

          // Smerové šípky (čiara od bunky v smere pohybu)
          const arrowLen = nearSK.map(c => Math.max(8, Math.min(30, c.speedKmh * 0.3)))
          const arrowLines = {
            type: 'FeatureCollection' as const,
            features: nearSK.map((cell, i) => ({
              type: 'Feature' as const,
              properties: { color: dbzToColor(cell.dbz) },
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [cell.lon, cell.lat],
                  arrowEndpoint(cell.lat, cell.lon, cell.directionDeg, arrowLen[i]),
                ],
              },
            })),
          }

          // Future position dots (15 a 30 min)
          const futureDots = {
            type: 'FeatureCollection' as const,
            features: nearSK.flatMap(cell =>
              cell.trajectory.slice(0, 2).map((p, idx) => ({
                type: 'Feature' as const,
                properties: {
                  color: dbzToColor(cell.dbz),
                  opacity: idx === 0 ? 0.55 : 0.28,
                  radius: idx === 0 ? 5 : 3.5,
                },
                geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
              }))
            ),
          }

          // Aktuálne bunky
          const cellDots = {
            type: 'FeatureCollection' as const,
            features: nearSK.map(cell => ({
              type: 'Feature' as const,
              properties: {
                id: cell.id, dbz: cell.dbz,
                speedKmh: cell.speedKmh,
                directionDeg: cell.directionDeg,
                color: dbzToColor(cell.dbz),
                risk: dbzToRisk(cell.dbz),
                updatedAt: cell.updatedAt,
                radius: cell.dbz >= 55 ? 10 : cell.dbz >= 45 ? 8 : 6,
              },
              geometry: { type: 'Point' as const, coordinates: [cell.lon, cell.lat] },
            })),
          }

          map.addSource('traj-lines', { type: 'geojson', data: trajLines })
          map.addSource('arrow-lines', { type: 'geojson', data: arrowLines })
          map.addSource('future-dots', { type: 'geojson', data: futureDots })
          map.addSource('cell-dots', { type: 'geojson', data: cellDots })

          // Trajektória
          map.addLayer({
            id: 'traj-line', type: 'line', source: 'traj-lines',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 1.5,
              'line-opacity': 0.45,
              'line-dasharray': [3, 3],
            },
          })

          // Smerová šípka — hrubšia, výrazná
          map.addLayer({
            id: 'arrow-line', type: 'line', source: 'arrow-lines',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2.5,
              'line-opacity': 0.9,
            },
          })

          // Budúce pozície
          map.addLayer({
            id: 'future-dot', type: 'circle', source: 'future-dots',
            paint: {
              'circle-radius': ['get', 'radius'],
              'circle-color': ['get', 'color'],
              'circle-opacity': ['get', 'opacity'],
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 1,
              'circle-stroke-opacity': ['get', 'opacity'],
            },
          })

          // Bunky — biele obrysové + farebné jadro
          map.addLayer({
            id: 'cell-outline', type: 'circle', source: 'cell-dots',
            paint: {
              'circle-radius': ['+', ['get', 'radius'], 3],
              'circle-color': '#FFFFFF',
              'circle-opacity': 0.9,
            },
          })
          map.addLayer({
            id: 'cell-fill', type: 'circle', source: 'cell-dots',
            paint: {
              'circle-radius': ['get', 'radius'],
              'circle-color': ['get', 'color'],
              'circle-opacity': 1,
            },
          })

          // Hover na bunkách
          map.on('mouseenter', 'cell-fill', (e) => {
            map.getCanvas().style.cursor = 'pointer'
            const f = e.features?.[0]
            if (!f) return
            const p = f.properties as { id?: string }
            const cell = nearSK.find(c => c.id === p.id)
            if (cell) { setCellTooltip({ x: e.point.x, y: e.point.y, cell }); setOkTooltip(null) }
          })
          map.on('mouseleave', 'cell-fill', () => {
            map.getCanvas().style.cursor = ''
            setCellTooltip(null)
          })
        }

        // ── 3. Rozšírené ohraničenie — SK + okolie ──────────────────────
        map.fitBounds([[15.8, 47.2], [23.5, 50.2]], { padding: 20, duration: 0 })
        map.resize()

        // ── 4. Hover na okresoch ─────────────────────────────────────────
        let hoveredId: string | number | null = null
        map.on('mousemove', 'okresy-fill', (e) => {
          if (cellTooltip) return
          map.getCanvas().style.cursor = 'pointer'
          const f = e.features?.[0]
          if (!f || f.id === undefined) return
          if (hoveredId !== null && hoveredId !== f.id)
            map.setFeatureState({ source: 'okresy', id: hoveredId }, { hover: false })
          hoveredId = f.id
          map.setFeatureState({ source: 'okresy', id: hoveredId }, { hover: true })
          const p = f.properties as { NM3?: string; risk?: string }
          setOkTooltip({ x: e.point.x, y: e.point.y, name: p.NM3 ?? '', risk: (p.risk ?? 'none') as RiskLevel })
        })
        map.on('mouseleave', 'okresy-fill', () => {
          map.getCanvas().style.cursor = ''
          if (hoveredId !== null)
            map.setFeatureState({ source: 'okresy', id: hoveredId }, { hover: false })
          hoveredId = null
          setOkTooltip(null)
        })

        setReady(true)
      } catch (err) {
        console.error('[HailMap]', err)
      }
    })

    mapRef.current = map
    return () => { cancelled = true; map.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full rounded-inherit" />
      {!ready && <div className="absolute inset-0 bg-[#EFF1F5] animate-pulse rounded-xl" />}

      {/* Okres tooltip */}
      {okTooltip && (
        <div className="pointer-events-none absolute z-20 bg-white border border-[#E5E7EB] rounded-lg shadow-lg px-3 py-2 -translate-y-full -translate-x-1/2"
          style={{ left: okTooltip.x, top: okTooltip.y - 10 }}>
          <div className="text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">{okTooltip.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: RISK[okTooltip.risk].indicator }} />
            <span className="text-[11px]" style={{ color: RISK[okTooltip.risk].text }}>{RISK[okTooltip.risk].label}</span>
          </div>
        </div>
      )}

      {/* Cell tooltip */}
      {cellTooltip && (
        <div className="pointer-events-none absolute z-20 bg-white border border-[#E5E7EB] rounded-xl shadow-xl px-3.5 py-3 -translate-y-full -translate-x-1/2 min-w-[148px]"
          style={{ left: cellTooltip.x, top: cellTooltip.y - 14 }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-sm" style={{ background: dbzToColor(cellTooltip.cell.dbz) }} />
            <span className="text-[12px] font-bold text-[#0F172A]">{dbzToRisk(cellTooltip.cell.dbz)}</span>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-[#64748B]">Intenzita</span>
              <span className="font-semibold text-[#0F172A]">{cellTooltip.cell.dbz.toFixed(0)} dBZ</span>
            </div>
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-[#64748B]">Rýchlosť</span>
              <span className="font-semibold text-[#0F172A]">{cellTooltip.cell.speedKmh} km/h</span>
            </div>
            {cellTooltip.cell.trajectory[0] && (
              <div className="flex justify-between gap-4 text-[11px] pt-1 border-t border-[#F1F5F9] mt-1">
                <span className="text-[#64748B]">ETA 15 min</span>
                <span className="font-semibold" style={{ color: dbzToColor(cellTooltip.cell.dbz) }}>
                  {cellTooltip.cell.trajectory[0].lat.toFixed(2)}°N
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/92 backdrop-blur-sm border border-[#E5E7EB] rounded-lg px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          {(['none', 'low', 'medium', 'high', 'extreme'] as RiskLevel[]).map(level => (
            <div key={level} className="flex flex-col items-center gap-0.5">
              <span className="w-3 h-3 rounded-sm block" style={{ background: RISK[level].map }} />
              <span className="text-[9px] leading-none" style={{ color: RISK[level].text }}>
                {RISK[level].label.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live badge — top right */}
      {cells.length > 0 && (
        <div className="absolute top-3 right-3 z-10 bg-white/92 backdrop-blur-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-sm bg-[#EF4444] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#0F172A]">{cells.length} buniek</span>
        </div>
      )}
    </div>
  )
}
