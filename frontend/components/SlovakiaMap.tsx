'use client'

import { KRAJ_SVG_PATHS, KRAJE_CENTROIDS, KRAJE } from '@/lib/slovakia-data'
import { RISK, type RiskLevel } from '@/lib/types'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SlovakiaMapProps {
  riskBySlug: Record<string, RiskLevel>
}

export function SlovakiaMap({ riskBySlug }: SlovakiaMapProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const router = useRouter()

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox="0 0 800 370"
        className="w-full h-auto"
        aria-label="Mapa Slovenska — riziká krupobitia podľa kraja"
      >
        {KRAJE.map(({ slug, name, short }) => {
          const level = riskBySlug[slug] ?? 'none'
          const r = RISK[level]
          const centroid = KRAJE_CENTROIDS[slug]
          const isHovered = hovered === slug

          return (
            <g key={slug}>
              <path
                d={KRAJ_SVG_PATHS[slug]}
                fill={isHovered ? r.text : r.map}
                stroke="#FFFFFF"
                strokeWidth={2.5}
                strokeLinejoin="round"
                className="cursor-pointer"
                style={{ transition: 'fill 120ms ease' }}
                onMouseEnter={() => setHovered(slug)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => router.push(`/${slug}`)}
                role="button"
                aria-label={`${name} — ${r.label}`}
              />
              {centroid && (
                <text
                  x={centroid.x}
                  y={centroid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={slug === 'bratislavsky-kraj' ? 7 : 9}
                  fontWeight={600}
                  fill="rgba(255,255,255,0.9)"
                  style={{ pointerEvents: 'none', fontFamily: 'Inter, sans-serif' }}
                >
                  {short}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hovered && (() => {
        const level = riskBySlug[hovered] ?? 'none'
        const r = RISK[level]
        const name = KRAJE.find(k => k.slug === hovered)?.name
        return (
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white border border-[#E5E7EB] rounded-md px-3 py-1.5 text-xs font-medium text-[#0F172A] pointer-events-none whitespace-nowrap"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <span className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ background: r.indicator }} />
            {name}
            <span className="text-[#64748B]">—</span>
            <span style={{ color: r.text }}>{r.label}</span>
          </div>
        )
      })()}
    </div>
  )
}
