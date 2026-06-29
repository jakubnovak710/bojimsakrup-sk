'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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

interface RadarFrame { path: string; time: number }

interface Props {
  riskBySlug: Record<string, RiskLevel>
  cells?: StormCell[]
  className?: string
}

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

function formatFrameTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}

export function HailMap({ riskBySlug, cells = [], className = '' }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<maplibregl.Map | null>(null)
  const [ready, setReady]              = useState(false)
  const [okTooltip, setOkTooltip]     = useState<OkresTooltip | null>(null)
  const [cellTooltip, setCellTooltip] = useState<CellTooltip | null>(null)
  const [frames, setFrames]           = useState<RadarFrame[]>([])
  const [frameIdx, setFrameIdx]       = useState<number>(-1)  // -1 = najnovší
  const [playing, setPlaying]         = useState(false)
  const playTimer                     = useRef<ReturnType<typeof setInterval> | null>(null)

  // Aktualizuj radar vrstvu pri zmene snímky
  const setRadarFrame = useCallback((map: maplibregl.Map, path: string) => {
    const src = map.getSource('radar') as maplibregl.RasterTileSource | undefined
    if (!src) return
    src.setTiles([
      `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/8/1_1.png`,
    ])
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO',
          },
          // Placeholder — path nastavíme po načítaní API
          radar: {
            type: 'raster',
            tiles: ['https://tilecache.rainviewer.com/v2/radar/nowcast/256/{z}/{x}/{y}/8/1_1.png'],
            tileSize: 256,
            attribution: '© RainViewer',
          },
        },
        layers: [
          { id: 'bg',    type: 'background', paint: { 'background-color': '#EFF1F5' } },
          { id: 'base',  type: 'raster', source: 'carto',  paint: { 'raster-opacity': 0.92 } },
          { id: 'radar', type: 'raster', source: 'radar',  paint: { 'raster-opacity': 0.0 } },
        ],
      },
      center: [19.3, 48.72],
      zoom: 6.8,
      minZoom: 5,
      maxZoom: 12,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
    })
    map.touchZoomRotate.disableRotation()

    let cancelled = false

    map.on('load', async () => {
      try {
        // ── 1. Rainviewer radar frames ──────────────────────────────
        const rvRes = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const rvData = await rvRes.json()
        const pastFrames: RadarFrame[] = rvData.radar.past ?? []
        if (!cancelled && pastFrames.length > 0) {
          setFrames(pastFrames)
          const latest = pastFrames[pastFrames.length - 1]
          setRadarFrame(map, latest.path)
          // Fade in radar overlay
          map.setPaintProperty('radar', 'raster-opacity', 0.72)
        }

        // ── 2. Okresy choropleth ────────────────────────────────────
        const res = await fetch('/okresy.geojson')
        const raw = await res.json()

        const features = raw.features.map((f: { properties?: Record<string, unknown>; geometry: unknown }) => {
          const idn3 = Number(f.properties?.IDN3 ?? 0)
          const krajSlug = IDN3_KRAJ[Math.floor(idn3 / 100)] ?? ''
          const risk: RiskLevel = riskBySlug[krajSlug] ?? 'none'
          return { ...f, properties: { ...f.properties, risk, krajSlug } }
        })

        if (cancelled) return

        map.addSource('okresy', { type: 'geojson', data: { ...raw, features }, promoteId: 'IDN3' })

        // Polotransparentný fill — radar musí byť viditeľný pod ním
        map.addLayer({
          id: 'okresy-fill', type: 'fill', source: 'okresy',
          paint: {
            'fill-color': ['match', ['get', 'risk'],
              'extreme', RISK.extreme.map, 'high', RISK.high.map,
              'medium', RISK.medium.map, 'low', RISK.low.map, RISK.none.map],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0.18],
          },
        })

        map.addLayer({
          id: 'okresy-line', type: 'line', source: 'okresy',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.7],
            'line-opacity': 0.8,
          },
        })

        // ── 3. Storm cell vektory ───────────────────────────────────
        const nearSK = cells.filter(c =>
          c.lat >= 47.3 && c.lat <= 50.0 &&
          c.lon >= 16.3 && c.lon <= 23.1
        )

        if (nearSK.length > 0) {
          const arrowLen = nearSK.map(c => Math.max(10, Math.min(35, c.speedKmh * 0.35)))

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

          const trajLines = {
            type: 'FeatureCollection' as const,
            features: nearSK.map(cell => ({
              type: 'Feature' as const,
              properties: { color: dbzToColor(cell.dbz) },
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [cell.lon, cell.lat],
                  ...cell.trajectory.slice(0, 2).map(p => [p.lon, p.lat]),
                ],
              },
            })),
          }

          const futureDots = {
            type: 'FeatureCollection' as const,
            features: nearSK.flatMap(cell =>
              cell.trajectory.slice(0, 2).map((p, idx) => ({
                type: 'Feature' as const,
                properties: {
                  color: dbzToColor(cell.dbz),
                  opacity: idx === 0 ? 0.6 : 0.35,
                  radius: idx === 0 ? 5 : 3.5,
                },
                geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
              }))
            ),
          }

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
              },
              geometry: { type: 'Point' as const, coordinates: [cell.lon, cell.lat] },
            })),
          }

          map.addSource('traj-lines',  { type: 'geojson', data: trajLines })
          map.addSource('arrow-lines', { type: 'geojson', data: arrowLines })
          map.addSource('future-dots', { type: 'geojson', data: futureDots })
          map.addSource('cell-dots',   { type: 'geojson', data: cellDots })

          map.addLayer({ id: 'traj-line', type: 'line', source: 'traj-lines',
            paint: { 'line-color': ['get', 'color'], 'line-width': 1.5,
              'line-opacity': 0.5, 'line-dasharray': [4, 3] } })

          map.addLayer({ id: 'arrow-line', type: 'line', source: 'arrow-lines',
            paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 1 } })

          map.addLayer({ id: 'future-dot', type: 'circle', source: 'future-dots',
            paint: { 'circle-radius': ['get', 'radius'], 'circle-color': ['get', 'color'],
              'circle-opacity': ['get', 'opacity'],
              'circle-stroke-color': '#FFF', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': ['get', 'opacity'] } })

          map.addLayer({ id: 'cell-outline', type: 'circle', source: 'cell-dots',
            paint: { 'circle-radius': 11, 'circle-color': '#FFFFFF', 'circle-opacity': 0.95 } })

          map.addLayer({ id: 'cell-fill', type: 'circle', source: 'cell-dots',
            paint: { 'circle-radius': 8, 'circle-color': ['get', 'color'], 'circle-opacity': 1 } })

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

        // ── 4. Hover na okresoch ────────────────────────────────────
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

        map.fitBounds([[15.8, 47.2], [23.5, 50.2]], { padding: 20, duration: 0 })
        map.resize()
        setReady(true)
      } catch (err) {
        console.error('[HailMap]', err)
      }
    })

    mapRef.current = map
    return () => { cancelled = true; map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prehrávanie animácie
  useEffect(() => {
    if (!playing || frames.length === 0 || !mapRef.current) return
    let idx = frameIdx < 0 ? frames.length - 1 : frameIdx
    playTimer.current = setInterval(() => {
      idx = (idx + 1) % frames.length
      setFrameIdx(idx)
      setRadarFrame(mapRef.current!, frames[idx].path)
    }, 700)
    return () => { if (playTimer.current) clearInterval(playTimer.current) }
  }, [playing, frames, frameIdx, setRadarFrame])

  const currentFrame = frameIdx >= 0 ? frames[frameIdx] : frames[frames.length - 1]

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {!ready && <div className="absolute inset-0 bg-[#EFF1F5] animate-pulse" />}

      {/* Okres tooltip */}
      {okTooltip && (
        <div className="pointer-events-none absolute z-20 bg-white/95 border border-[#E5E7EB] rounded-xl shadow-lg px-3 py-2 -translate-y-full -translate-x-1/2"
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
        <div className="pointer-events-none absolute z-20 bg-white/97 border border-[#E5E7EB] rounded-xl shadow-xl px-3.5 py-3 -translate-y-full -translate-x-1/2 min-w-[150px]"
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
                  {cellTooltip.cell.trajectory[0].etaMin} min
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Časová os radaru */}
      {frames.length > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10
          bg-white/95 backdrop-blur-sm border border-[#E5E7EB] rounded-xl
          px-3 py-2 flex items-center gap-2 shadow-sm">
          {/* Play/Pause */}
          <button
            onClick={() => setPlaying(p => !p)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer flex-shrink-0"
            aria-label={playing ? 'Pauza' : 'Prehrať animáciu'}>
            {playing
              ? <span className="flex gap-0.5"><span className="w-1 h-3 bg-[#0F172A] rounded-sm"/><span className="w-1 h-3 bg-[#0F172A] rounded-sm"/></span>
              : <span className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-[#0F172A] ml-0.5"/>
            }
          </button>

          {/* Snímky */}
          <div className="flex items-center gap-1">
            {frames.map((f, i) => {
              const isActive = frameIdx < 0 ? i === frames.length - 1 : i === frameIdx
              return (
                <button key={f.time}
                  onClick={() => {
                    setFrameIdx(i)
                    setPlaying(false)
                    if (mapRef.current) setRadarFrame(mapRef.current, f.path)
                  }}
                  className={`h-4 rounded-sm transition-all cursor-pointer ${
                    isActive ? 'bg-[#A3113A] w-4' : 'bg-[#CBD5E1] hover:bg-[#94A3B8] w-2'
                  }`}
                  title={formatFrameTime(f.time)}
                />
              )
            })}
          </div>

          {/* Čas aktívnej snímky */}
          <span className="text-[11px] font-semibold text-[#0F172A] tabular-nums flex-shrink-0 min-w-[36px]">
            {currentFrame ? formatFrameTime(currentFrame.time) : '—'}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-14 left-3 z-10 bg-white/95 backdrop-blur-sm border border-[#E5E7EB] rounded-lg px-2.5 py-2">
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

      {/* Live badge */}
      {cells.length > 0 && (
        <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-sm bg-[#EF4444] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#0F172A]">{cells.length} buniek</span>
        </div>
      )}
    </div>
  )
}
