'use client'

import { useState } from 'react'
import { ChevronDown, CloudHail, Thermometer, Zap, Navigation } from 'lucide-react'
import type { AuditTrail as AuditTrailType } from '@/lib/types'

interface Props {
  audit: AuditTrailType
  riskLabel: string
}

export function AuditTrail({ audit, riskLabel }: Props) {
  const [open, setOpen] = useState(false)

  const capeBand =
    audit.cape >= 2000 ? { label: 'Extrémna nestabilita', color: '#EF4444' } :
    audit.cape >= 1500 ? { label: 'Vysoká nestabilita', color: '#FB923C' } :
    audit.cape >= 800  ? { label: 'Mierna nestabilita', color: '#FACC15' } :
                         { label: 'Stabilná atmosféra', color: '#22C55E' }

  return (
    <div className="rounded-2xl bg-white border border-[#E5E7EB] overflow-hidden">

      {/* Primary: natural language — vždy viditeľné */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B] mb-3">Prečo {riskLabel} riziko?</p>
        <p className="text-[15px] text-[#0F172A] leading-[1.65] font-[450]">
          {audit.explanation}
        </p>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 border-t border-[#E5E7EB] text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors duration-150 cursor-pointer"
        aria-expanded={open}
      >
        <span>Technické detaily výpočtu</span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Collapsible metrics */}
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-[#E5E7EB] bg-[#F8FAFC]">
          <div className="grid grid-cols-2 gap-2">

            {/* CAPE */}
            <MetricTile
              icon={<Thermometer size={13} strokeWidth={1.75} />}
              label="CAPE"
              value={audit.cape.toLocaleString('sk-SK')}
              unit="J/kg"
              sub={capeBand.label}
              color={capeBand.color}
            />

            {/* Lifted Index */}
            <MetricTile
              icon={<Zap size={13} strokeWidth={1.75} />}
              label="Lifted Index"
              value={`${audit.liftedIndex > 0 ? '+' : ''}${audit.liftedIndex}`}
              unit={audit.liftedIndex < 0 ? 'nestabilné' : 'stabilné'}
              sub={audit.liftedIndex < -4 ? 'Silná búrka' : audit.liftedIndex < -2 ? 'Búrka možná' : audit.liftedIndex < 0 ? 'Slabá nestabilita' : 'Stabilné'}
              color={audit.liftedIndex < -2 ? '#EF4444' : audit.liftedIndex < 0 ? '#FB923C' : '#22C55E'}
            />

            {/* Radar cell */}
            {audit.radarCell && (
              <>
                <MetricTile
                  icon={<CloudHail size={13} strokeWidth={1.75} />}
                  label="Bunka"
                  value={`${audit.radarCell.distanceKm} km`}
                  unit={`smer ${audit.radarCell.direction}`}
                  sub={`${audit.radarCell.intensityDbz} dBZ`}
                  color="#0F172A"
                />
                <MetricTile
                  icon={<Navigation size={13} strokeWidth={1.75} />}
                  label="Odhadovaný dopad"
                  value={`${audit.radarCell.etaMinutes} min`}
                  unit={`${audit.radarCell.speedKmh} km/h`}
                  sub="ETA"
                  color="#FB923C"
                />
              </>
            )}
          </div>

          <p className="text-[11px] text-[#64748B] mt-3">
            Zdroj: Rainviewer (radar) · Open-Meteo CAPE ·{' '}
            Akt. {new Date(audit.updatedAt).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  )
}

function MetricTile({ icon, label, value, unit, sub, color }: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  sub: string
  color: string
}) {
  return (
    <div className="rounded-xl bg-white border border-[#E5E7EB] p-3.5">
      <div className="flex items-center gap-1.5 mb-2 text-[#64748B]">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="text-[20px] font-bold leading-none" style={{ color }}>{value}</div>
      <div className="text-[11px] text-[#64748B] mt-1">{unit}</div>
      <div
        className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
        style={{ background: `${color}18`, color }}
      >
        {sub}
      </div>
    </div>
  )
}
