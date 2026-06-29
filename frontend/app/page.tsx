import { Shield, Bell, CloudHail, CloudLightning, Wind, CloudRain } from 'lucide-react'
import { HailMap } from '@/components/HailMap'
import { RiskBadge } from '@/components/RiskBadge'
import { HazardBar } from '@/components/HazardBar'
import { JsonLd } from '@/components/JsonLd'
import { MOCK_KRAJE, getSlovakiaSummary } from '@/lib/mock-data'
import { RISK, type RiskLevel } from '@/lib/types'
import { fetchStormCells } from '@/lib/cells-api'
import Link from 'next/link'

const BASE = 'https://bojimsakrup.sk'

export const revalidate = 900

const RISK_ORDER: RiskLevel[] = ['extreme', 'high', 'medium', 'low', 'none']

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}

export default async function HomePage() {
  const summary = getSlovakiaSummary()
  const riskBySlug: Record<string, RiskLevel> = {}
  for (const k of MOCK_KRAJE) riskBySlug[k.slug] = k.risk

  const cells = await fetchStormCells()

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BojímSaKrúp.sk',
    url: BASE,
    description: 'Monitoring krupobitia a búrok na Slovensku. Radarová analýza búrkových buniek, CAPE index a pohyb búrkových buniek. Pokrytie celého Slovenska.',
    inLanguage: 'sk',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
    <JsonLd data={websiteJsonLd} />
    <div className="flex flex-col">

      {/* ── Mobile header (TopNav replaces on desktop) ── */}
      <header className="lg:hidden flex items-center justify-between px-4 pt-5 pb-4 bg-white border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#A3113A] flex items-center justify-center flex-shrink-0">
            <Shield size={18} color="white" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#0F172A] tracking-tight leading-none">
              BOJÍMSA<span className="text-[#A3113A]">KRÚP</span>.SK
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">Monitoring počasia na Slovensku</div>
          </div>
        </div>
        <button className="w-9 h-9 rounded-lg border border-[#E5E7EB] flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150" aria-label="Upozornenia">
          <Bell size={16} className="text-[#64748B]" strokeWidth={1.75} />
        </button>
      </header>

      {/* ── Desktop hero strip (hidden on mobile) ── */}
      <div className="hidden lg:block bg-white border-b border-[#E5E7EB] px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Prehľad rizika krupobitia</h1>
            <p className="text-sm text-[#64748B] mt-0.5">Slovenská republika · Aktualizácia každých 15 minút · Akt. {formatTime(summary.updatedAt)}</p>
          </div>
          <RiskBadge level={summary.worst.risk} />
        </div>
      </div>

      {/* ── Mobile: Risk strip ── */}
      <div className="lg:hidden bg-white px-4 py-3.5 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Prehľad rizika</span>
          <span className="text-[11px] text-[#64748B]">Akt. {formatTime(summary.updatedAt)}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {RISK_ORDER.map(level => (
            <div key={level} className="flex flex-col items-center gap-1 py-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC]">
              <span className="text-base font-bold text-[#0F172A] leading-none">{summary.counts[level] ?? 0}</span>
              <span className="text-[9px] font-semibold text-center leading-tight" style={{ color: RISK[level].text }}>
                {RISK[level].label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="lg:max-w-5xl lg:mx-auto lg:w-full lg:px-6 lg:py-6">

        {/* Desktop: two column */}
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">

          {/* LEFT — Map */}
          <div className="flex flex-col">
            {/* Desktop: risk strip above map */}
            <div className="hidden lg:grid grid-cols-5 gap-2 mb-4">
              {RISK_ORDER.map(level => (
                <div key={level} className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] transition-colors duration-150 cursor-default">
                  <span className="text-2xl font-bold text-[#0F172A] leading-none">{summary.counts[level] ?? 0}</span>
                  <span className="w-2 h-2 rounded-sm" style={{ background: RISK[level].indicator }} />
                  <span className="text-[10px] font-semibold text-center" style={{ color: RISK[level].text }}>
                    {RISK[level].label}
                  </span>
                </div>
              ))}
            </div>

            {/* Map */}
            <div className="relative bg-white lg:rounded-xl lg:overflow-hidden lg:border lg:border-[#E5E7EB]">
              <HailMap
                riskBySlug={riskBySlug}
                cells={cells}
                className="h-[250px] lg:h-[420px]"
              />
            </div>
            <p className="text-[11px] text-[#64748B] text-center mt-2 lg:mt-2 px-4 lg:px-0">
              Kliknite na kraj pre detail · Dáta: <a href="https://github.com/drakh/slovakia-gps-data" className="underline hover:text-[#0F172A]" target="_blank" rel="noopener noreferrer">CC BY 4.0 drakh/slovakia-gps-data</a>
            </p>
          </div>

          {/* RIGHT — Hazard panel */}
          <div className="mt-2 lg:mt-0 flex flex-col gap-3">

            {/* Hazard bars */}
            <div className="bg-white px-4 py-4 border-b border-[#E5E7EB] lg:rounded-xl lg:border lg:border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Aktuálna situácia</span>
              </div>
              <div className="flex flex-col gap-3.5">
                <HazardBar label="Krúpy" value={summary.totalHazards.krupy} Icon={CloudHail} />
                <HazardBar label="Búrky" value={summary.totalHazards.burky} Icon={CloudLightning} />
                <HazardBar label="Silný vietor" value={summary.totalHazards.vietor} Icon={Wind} />
                <HazardBar label="Prívalový dážď" value={summary.totalHazards.dazd} Icon={CloudRain} />
              </div>
            </div>

            {/* Worst region card */}
            <div className="bg-white px-4 py-3.5 border-b border-[#E5E7EB] lg:rounded-xl lg:border lg:border-[#E5E7EB]">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-2.5">Najvyššie riziko</span>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-bold text-[#0F172A] leading-tight">{summary.worst.name}</div>
                  <div className="mt-1"><RiskBadge level={summary.worst.risk} /></div>
                </div>
                <Link href={`/${summary.worst.slug}`} className="text-xs font-semibold text-[#A3113A] hover:text-[#7F0D2D] transition-colors duration-150 cursor-pointer">
                  Detail →
                </Link>
              </div>
            </div>

            {/* CTA — desktop only inside panel */}
            <div className="hidden lg:flex items-center gap-3 bg-[#A3113A] rounded-xl px-4 py-3.5">
              <Bell size={18} color="white" strokeWidth={1.75} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-semibold leading-tight">Nikdy nezmeškajte výstrahu.</div>
                <div className="text-white/70 text-[11px] mt-0.5">Upozornenia iba pre váš okres.</div>
              </div>
              <button className="bg-white text-[#A3113A] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#FFF1F2] transition-colors duration-150 whitespace-nowrap flex-shrink-0">
                Zapnúť
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: CTA + quick stats ── */}
      <div className="lg:hidden">
        <div className="grid grid-cols-3 gap-px bg-[#E5E7EB] border-t border-[#E5E7EB]">
          {[
            { label: 'Aktívne výstrahy', value: '4', color: '#EF4444', href: '/upozornenia' },
            { label: 'Bez rizika', value: String(summary.counts.none ?? 0), color: '#22C55E', href: '/' },
            { label: 'Detail mapy', value: 'Graf', color: '#A3113A', href: '/mapa' },
          ].map(({ label, value, color, href }) => (
            <Link key={label} href={href} className="bg-white px-3 py-3.5 flex flex-col items-center gap-1 cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150">
              <span className="text-lg font-bold leading-none" style={{ color }}>{value}</span>
              <span className="text-[10px] text-[#64748B] text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>

        <div className="mx-4 my-4 rounded-xl bg-[#A3113A] px-4 py-3.5 flex items-center gap-3">
          <Bell size={18} color="white" strokeWidth={1.75} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold leading-tight">Nikdy nezmeškajte výstrahu.</div>
            <div className="text-white/70 text-[11px] mt-0.5">Upozornenia iba pre váš okres.</div>
          </div>
          <button className="bg-white text-[#A3113A] text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0 hover:bg-[#FFF1F2] transition-colors duration-150 whitespace-nowrap">
            Zapnúť
          </button>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <p className="text-[11px] text-[#64748B] text-center px-4 pb-8 lg:pb-6 lg:max-w-5xl lg:mx-auto leading-relaxed">
        Indikatívny výpočet z radarových dát — nie je to varovanie SHMÚ.{' '}
        <a href="https://www.shmu.sk" className="underline hover:text-[#0F172A] transition-colors" target="_blank" rel="noopener noreferrer">shmu.sk</a>
      </p>
    </div>
    </>
  )
}
