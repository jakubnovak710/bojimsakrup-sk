import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, Thermometer, Wind, Droplets, CloudLightning } from 'lucide-react'
import Link from 'next/link'
import { RiskBadge } from '@/components/RiskBadge'
import { JsonLd } from '@/components/JsonLd'
import { RISK } from '@/lib/types'
import { fetchAllKrajeWeather, fetchAllOkresyWeather, wmoLabel, hourLabel } from '@/lib/weather-api'
import { okresyByKraj } from '@/lib/okresy-data'
import type { Metadata } from 'next'

const BASE = 'https://bojimsakrup.sk'

const KRAJ_NAMES: Record<string, string> = {
  'bratislavsky-kraj':    'Bratislavský kraj',
  'trnavsky-kraj':        'Trnavský kraj',
  'trenciansky-kraj':     'Trenčiansky kraj',
  'nitriansky-kraj':      'Nitriansky kraj',
  'zilinsky-kraj':        'Žilinský kraj',
  'banskobystricky-kraj': 'Banskobystrický kraj',
  'presovsky-kraj':       'Prešovský kraj',
  'kosicky-kraj':         'Košický kraj',
}

export const revalidate = 900

interface Props { params: Promise<{ kraj: string }> }

export async function generateStaticParams() {
  return Object.keys(KRAJ_NAMES).map(kraj => ({ kraj }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kraj } = await params
  const name = KRAJ_NAMES[kraj]
  if (!name) return {}
  const url = `${BASE}/${kraj}`
  return {
    title: `Krupobitie — ${name}`,
    description: `Aktuálne riziko krupobitia a búrok v ${name}. CAPE index, WMO počasie, radar. Aktualizácia každých 30 minút.`,
    alternates: { canonical: url },
    openGraph: { url, title: `Krupobitie — ${name}`, description: `Aktuálne riziko krupobitia v ${name}.` },
  }
}

export default async function KrajPage({ params }: Props) {
  const { kraj } = await params
  const name = KRAJ_NAMES[kraj]
  if (!name) notFound()

  // Paralelne: počasie kraja + počasie všetkých okresov tohto kraja
  const [krajeWeather, okrWeather] = await Promise.all([
    fetchAllKrajeWeather(),
    fetchAllOkresyWeather(kraj),
  ])

  const w = krajeWeather.find(k => k.slug === kraj)
  const r = w ? RISK[w.risk] : RISK.none
  const okrList = okresyByKraj(kraj)
  const okrWeatherMap = Object.fromEntries(okrWeather.map(o => [o.slug, o]))

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BojímSaKrúp.sk', item: BASE },
        { '@type': 'ListItem', position: 2, name, item: `${BASE}/${kraj}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `Riziko krupobitia — ${name}`,
      description: `Aktuálne CAPE, WMO kódy a riziko búrok/krupobitia v ${name}.`,
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
        <Link href="/" className="w-8 h-8 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] transition-colors" aria-label="Späť">
          <ChevronLeft size={15} className="text-[#64748B]" strokeWidth={2} />
        </Link>
        <span className="text-[13px] text-[#64748B]">Slovensko</span>
        <ChevronRight size={12} className="text-[#CBD5E1]" strokeWidth={2} />
        <span className="text-[13px] font-medium text-[#0F172A] truncate">{name}</span>
      </div>

      {/* Hero card — aktuálny stav */}
      <div className="rounded-2xl bg-white border-2 p-5 mb-3" style={{ borderColor: r.border }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Aktuálne</p>
            <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight leading-tight">{name}</h1>
            {w && (
              <p className="text-[13px] text-[#64748B] mt-1">{wmoLabel(w.wmoCode)} · {w.tempC}°C</p>
            )}
          </div>
          <div className="flex-shrink-0 mt-1">
            <RiskBadge level={w?.risk ?? 'none'} size="lg" />
          </div>
        </div>

        {/* Metriky */}
        {w && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Metric icon={<Thermometer size={14} strokeWidth={1.75} />} label="CAPE teraz" value={`${w.cape} J/kg`} />
            <Metric icon={<Wind size={14} strokeWidth={1.75} />} label="Vietor" value={`${w.windKmh} km/h`} sub={w.gustsKmh > w.windKmh ? `nárazov ${w.gustsKmh}` : undefined} />
            <Metric icon={<Droplets size={14} strokeWidth={1.75} />} label="Zrážky %" value={`${w.precipProb} %`} />
            <Metric icon={<CloudLightning size={14} strokeWidth={1.75} />} label="CAPE vrchol" value={`${w.capePeak} J/kg`} sub={w.capePeak > 0 ? `o ${hourLabel(w.capePeakHour)}` : undefined} />
          </div>
        )}

        {/* Predpoveď vrchol — zobrazí sa iba ak je predpoveď horšia ako aktuálny stav */}
        {w && w.riskPeak !== w.risk && (
          <div className="mt-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-4 py-3 flex items-center gap-3 flex-wrap gap-y-2">
            <span className="text-[11px] font-semibold text-[#92400E]">Predpoveď na dnes</span>
            <RiskBadge level={w.riskPeak} />
            <span className="text-[11px] text-[#78350F] ml-auto">
              {w.wmoCodePeak >= 95
                ? `${wmoLabel(w.wmoCodePeak)} o ${hourLabel(w.wmoPeakHour)}`
                : `CAPE ${w.capePeak} J/kg o ${hourLabel(w.capePeakHour)}`}
            </span>
          </div>
        )}

        <p className="text-[11px] text-[#94A3B8] mt-3">Zdroj: Open-Meteo · aktualizované každých 30 minút</p>
      </div>

      {/* Okresy */}
      <div className="rounded-2xl bg-white border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B]">Okresy</span>
          <span className="text-[11px] text-[#64748B]">{okrList.length}</span>
        </div>
        <div>
          {okrList.map((ok, i) => {
            const ow = okrWeatherMap[ok.slug]
            return (
              <Link
                key={ok.slug}
                href={`/${kraj}/${ok.slug}`}
                className={`flex items-center px-5 py-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors ${i < okrList.length - 1 ? 'border-b border-[#E5E7EB]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[#0F172A] truncate">{ok.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-[#64748B]">
                      {ow ? `${wmoLabel(ow.wmoCode)} · ${ow.tempC}°C · CAPE ${ow.cape}` : 'Načítava sa…'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <RiskBadge level={ow?.risk ?? 'none'} />
                  <ChevronRight size={14} className="text-[#CBD5E1]" strokeWidth={2} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-[#64748B] text-center mt-5 leading-relaxed">
        Indikatívny výpočet — nie je to varovanie SHMÚ.{' '}
        <a href="https://www.shmu.sk" className="underline" target="_blank" rel="noopener">shmu.sk</a>
      </p>
    </div>
    </>
  )
}

function Metric({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
}) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1.5 text-[#94A3B8]">{icon}
        <span className="text-[10px] uppercase tracking-wide font-medium text-[#94A3B8]">{label}</span>
      </div>
      <div className="text-[15px] font-bold text-[#0F172A]">{value}</div>
      {sub && <div className="text-[11px] text-[#64748B] mt-0.5">{sub}</div>}
    </div>
  )
}
