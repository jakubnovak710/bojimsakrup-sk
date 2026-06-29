'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { RISK, type RiskLevel } from '@/lib/types'
import { type StormCell } from '@/lib/storm-cells'

const IDN3_KRAJ: Record<number, string> = {
  1: 'bratislavsky-kraj', 2: 'trnavsky-kraj', 3: 'trenciansky-kraj',
  4: 'nitriansky-kraj', 5: 'zilinsky-kraj', 6: 'banskobystricky-kraj',
  7: 'presovsky-kraj', 8: 'kosicky-kraj',
}

interface OkresTooltip { x: number; y: number; name: string; risk: RiskLevel }
interface RadarFrame { path: string; time: number }

interface Props {
  riskBySlug: Record<string, RiskLevel>
  cells?: StormCell[]
  className?: string
}

function formatFrameTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}

// Colorizer 2 = Universal Blue (jasný, vhodný na svetlú mapu)
// Colorizer 6 = MeteoFrance (zelená→žltá→červená, podobný SHMÚ)
// Colorizer 8 = DarkSky
const COLORIZER = 6

function radarTileUrl(path: string) {
  return `https://tilecache.rainviewer.com${path}/256/{z}/{x}/{y}/${COLORIZER}/1_0.png`
}

export function HailMap({ riskBySlug, cells = [], className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const [ready,      setReady]      = useState(false)
  const [okTooltip,  setOkTooltip]  = useState<OkresTooltip | null>(null)
  const [frames,     setFrames]     = useState<RadarFrame[]>([])
  const [frameIdx,   setFrameIdx]   = useState(-1)   // -1 = posledný
  const [playing,    setPlaying]    = useState(false)
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const setRadarFrame = useCallback((map: maplibregl.Map, path: string) => {
    const src = map.getSource('radar') as maplibregl.RasterTileSource | undefined
    if (src) {
      src.setTiles([radarTileUrl(path)])
    } else {
      // Zdroj ešte neexistuje — pridaj ho
      map.addSource('radar', {
        type: 'raster',
        tiles: [radarTileUrl(path)],
        tileSize: 256,
        maxzoom: 8,          // Rainviewer poskytuje max zoom 8
        attribution: '© RainViewer',
      })
      // Vlož radar layer POD okresy ale NAD base mapu
      map.addLayer({
        id: 'radar',
        type: 'raster',
        source: 'radar',
        paint: { 'raster-opacity': 0.88 },
      }, 'okresy-fill')  // pred okresy-fill = pod ním
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
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
        },
        layers: [
          { id: 'bg',   type: 'background', paint: { 'background-color': '#EFF1F5' } },
          { id: 'base', type: 'raster',     source: 'carto', paint: { 'raster-opacity': 0.92 } },
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
        // ── Okresy choropleth ───────────────────────────────────────
        const res = await fetch('/okresy.geojson')
        const raw = await res.json()

        const features = raw.features.map((f: { properties?: Record<string, unknown>; geometry: unknown }) => {
          const idn3    = Number(f.properties?.IDN3 ?? 0)
          const slug    = IDN3_KRAJ[Math.floor(idn3 / 100)] ?? ''
          const risk: RiskLevel = riskBySlug[slug] ?? 'none'
          return { ...f, properties: { ...f.properties, risk } }
        })

        if (cancelled) return

        map.addSource('okresy', { type: 'geojson', data: { ...raw, features }, promoteId: 'IDN3' })

        map.addLayer({
          id: 'okresy-fill', type: 'fill', source: 'okresy',
          paint: {
            'fill-color': ['match', ['get', 'risk'],
              'extreme', RISK.extreme.map, 'high', RISK.high.map,
              'medium', RISK.medium.map, 'low', RISK.low.map, RISK.none.map],
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.28, 0.12],
          },
        })
        map.addLayer({
          id: 'okresy-line', type: 'line', source: 'okresy',
          paint: {
            'line-color': '#334155',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0.6],
            'line-opacity': 0.55,
          },
        })

        // ── Rainviewer radar — bez placeholder, pridáme až po API calli ─
        const rvRes    = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const rvData   = await rvRes.json()
        const pastFrames: RadarFrame[] = rvData.radar.past ?? []

        if (!cancelled && pastFrames.length > 0) {
          setFrames(pastFrames)
          setRadarFrame(map, pastFrames[pastFrames.length - 1].path)
        }

        // ── Hover na okresoch ───────────────────────────────────────
        let hoveredId: string | number | null = null
        map.on('mousemove', 'okresy-fill', (e) => {
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

  // Animácia snímok
  useEffect(() => {
    if (!playing || frames.length === 0 || !mapRef.current) return
    let idx = frameIdx < 0 ? frames.length - 1 : frameIdx
    playTimer.current = setInterval(() => {
      idx = (idx + 1) % frames.length
      setFrameIdx(idx)
      setRadarFrame(mapRef.current!, frames[idx].path)
    }, 600)
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

      {/* Timeline animácia */}
      {frames.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10
          bg-white/96 backdrop-blur-sm border border-[#E5E7EB] rounded-xl
          px-3 py-2 flex items-center gap-2 shadow-md">
          <button
            onClick={() => setPlaying(p => !p)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#F1F5F9] transition-colors cursor-pointer flex-shrink-0"
            aria-label={playing ? 'Pauza' : 'Prehrať'}>
            {playing
              ? <span className="flex gap-0.5"><span className="w-1 h-3 bg-[#0F172A] rounded-sm"/><span className="w-1 h-3 bg-[#0F172A] rounded-sm"/></span>
              : <span className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-[#0F172A] ml-0.5"/>
            }
          </button>

          <div className="flex items-center gap-[3px]">
            {frames.map((f, i) => {
              const isActive = frameIdx < 0 ? i === frames.length - 1 : i === frameIdx
              return (
                <button key={f.time}
                  onClick={() => {
                    setFrameIdx(i); setPlaying(false)
                    if (mapRef.current) setRadarFrame(mapRef.current, f.path)
                  }}
                  className={`h-3.5 rounded-sm transition-all cursor-pointer ${
                    isActive ? 'bg-[#A3113A] w-4' : 'bg-[#CBD5E1] hover:bg-[#94A3B8] w-2'
                  }`}
                  title={formatFrameTime(f.time)}
                />
              )
            })}
          </div>

          <span className="text-[11px] font-semibold text-[#0F172A] tabular-nums min-w-[36px]">
            {currentFrame ? formatFrameTime(currentFrame.time) : '—'}
          </span>
        </div>
      )}

      {/* Legenda */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 border border-[#E5E7EB] rounded-lg px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          {(['none', 'low', 'medium', 'high', 'extreme'] as RiskLevel[]).map(level => (
            <div key={level} className="flex flex-col items-center gap-0.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: RISK[level].map }} />
              <span className="text-[9px]" style={{ color: RISK[level].text }}>
                {RISK[level].label.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live badge */}
      <div className="absolute top-3 right-3 z-10 bg-white/95 border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-sm bg-[#EF4444] animate-pulse" />
        <span className="text-[11px] font-semibold text-[#0F172A]">LIVE radar</span>
      </div>
    </div>
  )
}
