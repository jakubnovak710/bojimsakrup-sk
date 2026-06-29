import { notFound } from 'next/navigation'
import {
  ChevronLeft, ChevronRight,
  CloudHail, CloudLightning, Wind, CloudRain,
  Droplets, Eye, Gauge, Timer
} from 'lucide-react'
import Link from 'next/link'
import { getKraj } from '@/lib/mock-data'
import { RISK } from '@/lib/types'
import { fetchCurrentWeather, mpsToKmh, degToCompass } from '@/lib/openweather'
import { JsonLd } from '@/components/JsonLd'
import { AuditTrail } from '@/components/AuditTrail'
import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'

const BASE = 'https://bojimsakrup.sk'

export const revalidate = 900

interface Props { params: Promise<{ kraj: string; okres: string; obec: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kraj, okres, obec } = await params
  const d = getKraj(kraj)?.okresy.find(o => o.slug === okres)?.obce.find(o => o.slug === obec)
  if (!d) return {}
  const url = `${BASE}/${kraj}/${okres}/${obec}`
  return {
    title: `Krupobitie — ${d.name}`,
    description: `Pravdepodobnosť krupobitia v obci ${d.name}. Radarová analýza búrkových buniek, CAPE index a čas dopadu. Aktualizácia každých 15 minút.`,
    alternates: { canonical: url },
    openGraph: {
      url,
      title: `Krupobitie — ${d.name}`,
      description: `Pravdepodobnosť krupobitia v obci ${d.name}. Radarová analýza, CAPE index a ETA dopadu.`,
    },
  }
}

export default async function ObecPage({ params }: Props) {
  const { kraj, okres, obec: obecSlug } = await params
  const krajData = getKraj(kraj)
  const okresData = krajData?.okresy.find(o => o.slug === okres)
  const d = okresData?.obce.find(o => o.slug === obecSlug)
  if (!d || !krajData || !okresData) notFound()

  const { audit } = d
  const wx = await fetchCurrentWeather(d.lat, d.lon)
  const r = RISK[d.risk]
  const pageUrl = `${BASE}/${kraj}/${okres}/${obecSlug}`

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'BojímSaKrúp.sk', item: BASE },
        { '@type': 'ListItem', position: 2, name: krajData.name, item: `${BASE}/${kraj}` },
        { '@type': 'ListItem', position: 3, name: okresData.name, item: `${BASE}/${kraj}/${okres}` },
        { '@type': 'ListItem', position: 4, name: d.name, item: pageUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: d.name,
      url: pageUrl,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: d.lat,
        longitude: d.lon,
      },
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: okresData.name,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: krajData.name,
          containedInPlace: { '@type': 'Country', name: 'Slovensko', sameAs: 'https://www.wikidata.org/wiki/Q214' },
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Report',
      name: `Riziko krupobitia — ${d.name}`,
      headline: `Pravdepodobnosť krupobitia v obci ${d.name}`,
      description: `Radarová analýza búrkových buniek, CAPE index a pohyb búrkových buniek pre ${d.name}.`,
      url: pageUrl,
      inLanguage: 'sk',
      datePublished: audit?.updatedAt ?? new Date().toISOString(),
      dateModified: audit?.updatedAt ?? new Date().toISOString(),
      publisher: { '@type': 'Organization', name: 'BojímSaKrúp.sk', url: BASE },
      about: { '@type': 'Place', name: d.name, geo: { '@type': 'GeoCoordinates', latitude: d.lat, longitude: d.lon } },
    },
  ]

  return (
    <>
    <JsonLd data={jsonLd as unknown as Record<string, unknown>} />
    <div className="flex flex-col bg-[#F8FAFC] min-h-screen px-4 pt-5 pb-24 lg:max-w-3xl lg:mx-auto lg:px-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link href={`/${kraj}/${okres}`} className="w-8 h-8 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150" aria-label="Späť">
          <ChevronLeft size={15} className="text-[#64748B]" strokeWidth={2} />
        </Link>
        <Link href={`/${kraj}`} className="text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors duration-150 hidden sm:block">{krajData.name}</Link>
        <ChevronRight size={12} className="text-[#E5E7EB] hidden sm:block" strokeWidth={2} />
        <Link href={`/${kraj}/${okres}`} className="text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors duration-150">{okresData.name}</Link>
        <ChevronRight size={12} className="text-[#E5E7EB]" strokeWidth={2} />
        <span className="text-[13px] font-medium text-[#0F172A]">{d.name}</span>
      </div>

      {/* Hero card — risk + ETA */}
      <div className="rounded-2xl bg-white border p-5 mb-3" style={{ borderColor: r.border }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Obec</p>
            <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight leading-tight">{d.name}</h1>
            <p className="text-[12px] text-[#64748B] mt-0.5">{d.lat.toFixed(4)}°N · {d.lon.toFixed(4)}°E</p>
          </div>
          <div
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold mt-1"
            style={{ background: r.bg, color: r.text, border: `1.5px solid ${r.border}` }}
          >
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: r.indicator }} />
            {r.label}
          </div>
        </div>

        {/* ETA banner (ak je aktívna bunka) */}
        {audit?.radarCell && (
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: r.bg, border: `1px solid ${r.border}` }}>
            <Timer size={16} strokeWidth={1.75} style={{ color: r.text }} className="flex-shrink-0" />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: r.text }}>
                Búrková bunka dorazí za {audit.radarCell.etaMinutes} minút
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: r.text, opacity: 0.75 }}>
                {audit.radarCell.distanceKm} km · smer {audit.radarCell.direction} · {audit.radarCell.speedKmh} km/h
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bento 2×2 hazard */}
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

      {/* Live weather (OpenWeather) */}
      {wx && (
        <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5 mb-3">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#64748B]">Aktuálne počasie</span>
            <span className="text-[11px] text-[#64748B] capitalize">{wx.description}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-5xl font-bold text-[#0F172A] leading-none">{wx.temp}°</span>
            <span className="text-[15px] text-[#64748B]">pocitovo {wx.feelsLike}°C</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <WeatherCell icon={<Droplets size={14} strokeWidth={1.75} />} label="Vlhkosť" value={`${wx.humidity}%`} />
            <WeatherCell
              icon={<Wind size={14} strokeWidth={1.75} />}
              label="Vietor"
              value={`${mpsToKmh(wx.windSpeed)}`}
              unit={`km/h ${degToCompass(wx.windDeg)}`}
            />
            <WeatherCell
              icon={<Eye size={14} strokeWidth={1.75} />}
              label="Viditeľ."
              value={wx.visibility >= 1000 ? `${Math.round(wx.visibility / 1000)}` : String(wx.visibility)}
              unit={wx.visibility >= 1000 ? 'km' : 'm'}
            />
            <WeatherCell icon={<Gauge size={14} strokeWidth={1.75} />} label="Tlak" value={String(wx.pressure)} unit="hPa" />
          </div>
        </div>
      )}

      {/* Audit trail — natural language prominentne, metriky za togglem */}
      {audit && (
        <div className="mb-3">
          <AuditTrail audit={audit} riskLabel={RISK[d.risk].label} />
        </div>
      )}

      <p className="text-[11px] text-[#64748B] text-center mt-2 leading-relaxed">
        Nie je to varovanie SHMÚ — ide o indikatívny výpočet. Chráňte svoje auto na základe vlastného uváženia.
      </p>
    </div>
    </>
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
      <div className="flex items-end gap-1">
        <span className="text-3xl font-bold leading-none" style={{ color }}>{value}</span>
        <span className="text-[13px] text-[#64748B] mb-0.5">%</span>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

function WeatherCell({ icon, label, value, unit }: {
  icon: React.ReactNode; label: string; value: string; unit?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
      <span className="text-[#64748B]">{icon}</span>
      <span className="text-[14px] font-bold text-[#0F172A] leading-none">{value}</span>
      {unit && <span className="text-[10px] text-[#64748B] text-center leading-tight">{unit}</span>}
      <span className="text-[10px] text-[#64748B]">{label}</span>
    </div>
  )
}

