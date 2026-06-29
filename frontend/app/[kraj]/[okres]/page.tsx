import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, CloudHail, CloudLightning, Wind, CloudRain, MapPin } from 'lucide-react'
import Link from 'next/link'
import { getKraj } from '@/lib/mock-data'
import { RiskBadge } from '@/components/RiskBadge'
import { RISK } from '@/lib/types'
import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'

export const revalidate = 900

interface Props { params: Promise<{ kraj: string; okres: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kraj, okres } = await params
  const d = getKraj(kraj)?.okresy.find(o => o.slug === okres)
  if (!d) return {}
  return {
    title: `Krupobitie — ${d.name}`,
    description: `Pravdepodobnosť krupobitia v ${d.name}. Aktualizácia každých 15 minút.`,
  }
}

export default async function OkresPage({ params }: Props) {
  const { kraj, okres } = await params
  const krajData = getKraj(kraj)
  const d = krajData?.okresy.find(o => o.slug === okres)
  if (!d || !krajData) notFound()

  const r = RISK[d.risk]

  return (
    <div className="flex flex-col bg-[#F8FAFC] min-h-screen px-4 pt-5 pb-24 lg:max-w-3xl lg:mx-auto lg:px-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link href="/" className="w-8 h-8 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150" aria-label="Späť">
          <ChevronLeft size={15} className="text-[#64748B]" strokeWidth={2} />
        </Link>
        <Link href={`/${kraj}`} className="text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">{krajData.name}</Link>
        <ChevronRight size={12} className="text-[#E5E7EB]" strokeWidth={2} />
        <span className="text-[13px] font-medium text-[#0F172A] truncate">{d.name}</span>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl bg-white border p-5 mb-3" style={{ borderColor: r.border }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Okres</p>
            <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight leading-tight">{d.name}</h1>
          </div>
          <div
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold mt-1"
            style={{ background: r.bg, color: r.text, border: `1.5px solid ${r.border}` }}
          >
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: r.indicator }} />
            {r.label}
          </div>
        </div>
        <p className="text-[12px] text-[#64748B] mt-3">Aktualizované každých 15 minút · Zdroj: Rainviewer + Open-Meteo</p>
      </div>

      {/* Bento 2×2 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {([
          { label: 'Krúpy', value: d.hazards.krupy, Icon: CloudHail },
          { label: 'Búrky', value: d.hazards.burky, Icon: CloudLightning },
          { label: 'Silný vietor', value: d.hazards.vietor, Icon: Wind },
          { label: 'Prívalový dážď', value: d.hazards.dazd, Icon: CloudRain },
        ] as { label: string; value: number; Icon: LucideIcon }[]).map(({ label, value, Icon }) => (
          <BentoTile key={label} label={label} value={value} Icon={Icon} />
        ))}
      </div>

      {/* Obce */}
      <div className="rounded-2xl bg-white border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B]">Obce v okrese</span>
          <span className="text-[11px] text-[#64748B]">{d.obce.length || '…'} obcí</span>
        </div>
        {d.obce.length === 0 ? (
          <div className="px-5 py-10 text-sm text-[#64748B] text-center">Dáta sa načítavajú…</div>
        ) : (
          d.obce.map((obec, i) => (
            <Link
              key={obec.slug}
              href={`/${kraj}/${okres}/${obec.slug}`}
              className={`flex items-center px-5 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150 ${i < d.obce.length - 1 ? 'border-b border-[#E5E7EB]' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-[#64748B] flex-shrink-0" strokeWidth={1.75} />
                  <div className="text-[14px] font-semibold text-[#0F172A] truncate">{obec.name}</div>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-[19px]">
                  <span className="text-[11px] text-[#64748B]">{obec.lat.toFixed(3)}°N</span>
                  <span className="text-[#E5E7EB]">·</span>
                  <span className="text-[11px] text-[#64748B]">Krúpy {obec.hazards.krupy} %</span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <RiskBadge level={obec.risk} />
                <ChevronRight size={14} className="text-[#CBD5E1]" strokeWidth={2} />
              </div>
            </Link>
          ))
        )}
      </div>

      <p className="text-[11px] text-[#64748B] text-center mt-5 leading-relaxed">
        Indikatívny výpočet — nie je to varovanie SHMÚ.
      </p>
    </div>
  )
}

function BentoTile({ label, value, Icon }: { label: string; value: number; Icon: LucideIcon }) {
  const color = value >= 70 ? '#EF4444' : value >= 45 ? '#FB923C' : value >= 20 ? '#FACC15' : '#22C55E'
  return (
    <div className="rounded-xl bg-white border border-[#E5E7EB] p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon size={14} strokeWidth={1.75} className="text-[#64748B]" />
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold leading-none" style={{ color }}>{value}</span>
        <span className="text-[13px] text-[#64748B] mb-0.5">%</span>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}
