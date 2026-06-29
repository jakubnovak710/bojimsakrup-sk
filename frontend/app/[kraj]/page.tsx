import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, CloudHail, CloudLightning, Wind, CloudRain } from 'lucide-react'
import Link from 'next/link'
import { getKraj } from '@/lib/mock-data'
import { RiskBadge } from '@/components/RiskBadge'
import { JsonLd } from '@/components/JsonLd'
import { RISK } from '@/lib/types'
import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'

const BASE = 'https://bojimsakrup.sk'

export const revalidate = 900

interface Props { params: Promise<{ kraj: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kraj } = await params
  const data = getKraj(kraj)
  if (!data) return {}
  const url = `${BASE}/${kraj}`
  return {
    title: `Krupobitie — ${data.name}`,
    description: `Pravdepodobnosť krupobitia a búrok v ${data.name}. Radarová analýza búrkových buniek, CAPE index. Aktualizácia každých 15 minút.`,
    alternates: { canonical: url },
    openGraph: {
      url,
      title: `Krupobitie — ${data.name}`,
      description: `Pravdepodobnosť krupobitia a búrok v ${data.name}.`,
    },
  }
}

export default async function KrajPage({ params }: Props) {
  const { kraj } = await params
  const data = getKraj(kraj)
  if (!data) notFound()

  const r = RISK[data.risk]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BojímSaKrúp.sk', item: BASE },
        { '@type': 'ListItem', position: 2, name: data.name, item: `${BASE}/${kraj}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `Riziko krupobitia — ${data.name}`,
      description: `Pravdepodobnosť krupobitia, búrok a silného vetra v ${data.name}. Radarová analýza búrkových buniek.`,
      url: `${BASE}/${kraj}`,
      inLanguage: 'sk',
      temporalCoverage: new Date().toISOString(),
      creator: { '@type': 'Organization', name: 'BojímSaKrúp.sk', url: BASE },
    },
  ]

  return (
    <>
    <JsonLd data={jsonLd as unknown as Record<string, unknown>} />
    <div className="flex flex-col bg-[#F8FAFC] min-h-screen px-4 pt-5 pb-24 lg:max-w-3xl lg:mx-auto lg:px-6">

      {/* Back */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/" className="w-8 h-8 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150" aria-label="Späť">
          <ChevronLeft size={15} className="text-[#64748B]" strokeWidth={2} />
        </Link>
        <span className="text-[13px] text-[#64748B]">Slovensko</span>
        <ChevronRight size={12} className="text-[#E5E7EB]" strokeWidth={2} />
        <span className="text-[13px] font-medium text-[#0F172A] truncate">{data.name}</span>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 mb-3" style={{ borderColor: r.border }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Kraj</p>
            <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight leading-tight">{data.name}</h1>
          </div>
          {/* Risk badge */}
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

      {/* Bento 2×2 hazard tiles */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {([
          { label: 'Krúpy', value: data.hazards.krupy, Icon: CloudHail },
          { label: 'Búrky', value: data.hazards.burky, Icon: CloudLightning },
          { label: 'Silný vietor', value: data.hazards.vietor, Icon: Wind },
          { label: 'Prívalový dážď', value: data.hazards.dazd, Icon: CloudRain },
        ] as { label: string; value: number; Icon: LucideIcon }[]).map(({ label, value, Icon }) => (
          <BentoTile key={label} label={label} value={value} Icon={Icon} />
        ))}
      </div>

      {/* Okresy */}
      <div className="rounded-2xl bg-white border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B]">Okresy</span>
          <span className="text-[11px] text-[#64748B]">{data.okresy.length || '…'} okresov</span>
        </div>
        {data.okresy.length === 0 ? (
          <div className="px-5 py-10 text-sm text-[#64748B] text-center">Dáta sa načítavajú…</div>
        ) : (
          <div>
            {data.okresy.map((okres, i) => (
              <Link
                key={okres.slug}
                href={`/${kraj}/${okres.slug}`}
                className={`flex items-center px-5 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150 ${i < data.okresy.length - 1 ? 'border-b border-[#E5E7EB]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[#0F172A] truncate">{okres.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-[#64748B]">Krúpy {okres.hazards.krupy} %</span>
                    <span className="text-[#E5E7EB]">·</span>
                    <span className="text-[11px] text-[#64748B]">Búrky {okres.hazards.burky} %</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <RiskBadge level={okres.risk} />
                  <ChevronRight size={14} className="text-[#CBD5E1]" strokeWidth={2} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-[#64748B] text-center mt-5 leading-relaxed">
        Indikatívny výpočet — nie je to varovanie SHMÚ.
      </p>
    </div>
    </>
  )
}

function BentoTile({ label, value, Icon }: { label: string; value: number; Icon: LucideIcon }) {
  const color = value >= 70 ? '#EF4444' : value >= 45 ? '#FB923C' : value >= 20 ? '#FACC15' : '#22C55E'
  const bg = value >= 70 ? '#FEF2F2' : value >= 45 ? '#FFF7ED' : value >= 20 ? '#FEFCE8' : '#F0FDF4'
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
