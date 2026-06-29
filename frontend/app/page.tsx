import { Bell, CloudHail, CloudLightning, Wind, CloudRain } from 'lucide-react'
import { HailMap } from '@/components/HailMap'
import { RiskBadge } from '@/components/RiskBadge'
import { JsonLd } from '@/components/JsonLd'
import { RISK, type RiskLevel } from '@/lib/types'
import { fetchStormCells } from '@/lib/cells-api'
import { dbzToColor, dbzToRisk } from '@/lib/storm-cells'
import { fetchAllKrajeWeather, weatherToRiskBySlug, wmoLabel } from '@/lib/weather-api'
import Link from 'next/link'

const BASE = 'https://bojimsakrup.sk'

export const revalidate = 900

const RISK_ORDER: RiskLevel[] = ['extreme', 'high', 'medium', 'low', 'none']

const HAZARDS = [
  { label: 'Krúpy',          key: 'krupy'  as const, Icon: CloudHail },
  { label: 'Búrky',          key: 'burky'  as const, Icon: CloudLightning },
  { label: 'Silný vietor',   key: 'vietor' as const, Icon: Wind },
  { label: 'Prívalový dážď', key: 'dazd'   as const, Icon: CloudRain },
]

function barColor(v: number) {
  if (v >= 70) return '#EF4444'
  if (v >= 45) return '#FB923C'
  if (v >= 20) return '#FACC15'
  return '#22C55E'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
}

export default async function HomePage() {
  // Paralelné načítanie: počasie všetkých krajov + radar bunky
  const [krajeWeather, cells] = await Promise.all([
    fetchAllKrajeWeather(),
    fetchStormCells(),
  ])

  // riskBySlug z reálnych dát: CAPE + WMO kódy z Open-Meteo
  const riskBySlug = weatherToRiskBySlug(krajeWeather)

  // Súhrn Slovenska
  const counts = Object.values(riskBySlug).reduce(
    (acc, r) => { acc[r] = (acc[r] ?? 0) + 1; return acc },
    {} as Record<RiskLevel, number>
  )
  const RISK_NUM: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3, extreme: 4 }
  const worstKraj = krajeWeather.sort((a, b) => RISK_NUM[b.risk] - RISK_NUM[a.risk])[0]
  const updatedAt = krajeWeather[0]?.updatedAt ?? new Date().toISOString()

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BojímSaKrúp.sk',
    url: BASE,
    description: 'Monitoring krupobitia a búrok na Slovensku.',
    inLanguage: 'sk',
  }

  return (
    <>
      <JsonLd data={websiteJsonLd} />

      {/* ── MOBILE HEADER ──────────────────────────────────────────────── */}
      <header className="lg:hidden flex items-center justify-between px-4 pt-5 pb-3 bg-white border-b border-[#E5E7EB]">
        <div>
          <div className="text-[16px] font-bold text-[#0F172A] tracking-tight leading-none">
            BOJÍMSA<span className="text-[#A3113A]">KRÚP</span>.SK
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Akt. {formatTime(updatedAt)}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-sm bg-[#EF4444] animate-pulse" />
          <span className="text-[11px] font-semibold text-[#0F172A]">LIVE</span>
        </div>
      </header>

      {/* ── DESKTOP STRIP ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex items-center border-b border-[#E5E7EB] bg-white h-11">
        {/* Live indikátor + čas */}
        <div className="flex items-center gap-2 px-5 border-r border-[#E5E7EB] h-full flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-sm bg-[#EF4444] animate-pulse" />
          <span className="text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
            {formatTime(updatedAt)}
          </span>
        </div>

        {/* Top kraje s rizikom */}
        {krajeWeather.slice(0, 4).map(k => (
          <Link key={k.slug} href={`/${k.slug}`}
            className="flex items-center gap-2 px-4 border-r border-[#E5E7EB] h-full flex-shrink-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
            <RiskBadge level={k.risk} />
            <span className="text-[11px] text-[#64748B] whitespace-nowrap">
              {wmoLabel(k.wmoCode)} · CAPE {k.capePeak}
            </span>
          </Link>
        ))}

        <div className="flex-1" />

        {/* Najhoršie riziko */}
        {worstKraj && (
          <div className="flex items-center gap-2.5 px-5 border-l border-[#E5E7EB] h-full flex-shrink-0">
            <span className="text-[11px] text-[#64748B]">Najvyššie</span>
            <span className="text-[12px] font-semibold text-[#0F172A]">{worstKraj.slug.replace('-kraj','').replace('ky','ký').replace('sky','ský')}</span>
            <RiskBadge level={worstKraj.risk} />
          </div>
        )}
      </div>

      {/* ── MOBILE RISK TILES ──────────────────────────────────────────── */}
      <div className="lg:hidden grid grid-cols-5 gap-px bg-[#E5E7EB] border-b border-[#E5E7EB]">
        {RISK_ORDER.map(level => (
          <div key={level} className="flex flex-col items-center gap-0.5 py-2.5 bg-white">
            <span className="text-[15px] font-bold leading-none text-[#0F172A]">
              {counts[level] ?? 0}
            </span>
            <span className="w-2 h-2 rounded-sm mt-0.5" style={{ background: RISK[level].indicator }} />
          </div>
        ))}
      </div>

      {/* ── MAPA — fullwidth ────────────────────────────────────────────── */}
      <HailMap
        riskBySlug={riskBySlug}
        cells={cells}
        className="w-full h-[56vw] max-h-[75vh] min-h-[300px] lg:h-[calc(100vh-11.5rem)]"
      />

      {/* ── DESKTOP BOTTOM PANEL ────────────────────────────────────────── */}
      <div className="hidden lg:flex items-stretch bg-white border-t border-[#E5E7EB] divide-x divide-[#E5E7EB]">

        {/* Risk počty */}
        <div className="flex items-center gap-5 px-6 py-3.5 flex-shrink-0">
          {RISK_ORDER.map(level => (
            <div key={level} className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold leading-none text-[#0F172A]">{counts[level] ?? 0}</span>
              <span className="w-2 h-2 rounded-sm" style={{ background: RISK[level].indicator }} />
              <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: RISK[level].text }}>
                {RISK[level].label}
              </span>
            </div>
          ))}
        </div>

        {/* Bunky */}
        <div className="flex items-center gap-2.5 px-5 py-3 flex-1 overflow-x-auto min-w-0">
          {cells.length === 0 ? (
            <span className="text-[12px] text-[#94A3B8]">Žiadne aktívne búrkové bunky</span>
          ) : (
            cells.slice(0, 5).map(cell => (
              <div key={cell.id}
                className="flex items-center gap-2 border border-[#E5E7EB] rounded-xl px-3 py-2 bg-[#F8FAFC] flex-shrink-0 hover:border-[#CBD5E1] transition-colors duration-150 cursor-default">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: dbzToColor(cell.dbz) }} />
                <div className="leading-none">
                  <div className="text-[12px] font-bold text-[#0F172A]">{cell.dbz.toFixed(0)} dBZ</div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">{cell.speedKmh} km/h · {cell.trajectory[0]?.etaMin ?? '—'}min</div>
                </div>
                <span className="text-[10px] font-semibold leading-none ml-1" style={{ color: dbzToColor(cell.dbz) }}>
                  {dbzToRisk(cell.dbz)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0">
          <Bell size={15} className="text-[#A3113A]" strokeWidth={1.75} />
          <div className="leading-none">
            <div className="text-[12px] font-semibold text-[#0F172A]">Upozornenia pre váš okres</div>
            <div className="text-[10px] text-[#64748B] mt-0.5">Nikdy nezmeškajte výstrahu</div>
          </div>
          <button className="bg-[#A3113A] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#7F0D2D] transition-colors duration-150 whitespace-nowrap flex-shrink-0">
            Zapnúť
          </button>
        </div>
      </div>

      {/* ── MOBILE CONTENT ──────────────────────────────────────────────── */}
      <div className="lg:hidden">

        {/* Aktívne bunky */}
        {cells.length > 0 && (
          <div className="bg-white border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Aktívne bunky</span>
              <span className="text-[11px] font-semibold text-[#0F172A]">{cells.length}</span>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {cells.slice(0, 3).map(cell => (
                <div key={cell.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: dbzToColor(cell.dbz) }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#0F172A]">{cell.dbz.toFixed(0)} dBZ · {cell.speedKmh} km/h</div>
                    <div className="text-[11px] text-[#64748B]">ETA {cell.trajectory[0]?.etaMin ?? '—'} min</div>
                  </div>
                  <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: dbzToColor(cell.dbz) }}>
                    {dbzToRisk(cell.dbz)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kraj situácia z reálnych dát */}
        <div className="bg-white border-b border-[#E5E7EB]">
          <div className="px-4 pt-3.5 pb-2 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Situácia krajov
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {krajeWeather.slice(0, 4).map(k => (
              <Link key={k.slug} href={`/${k.slug}`}
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                <div>
                  <div className="text-[13px] font-medium text-[#0F172A] capitalize">
                    {k.slug.replace('-kraj','').replace('sky','ský').replace('ky','ký')}
                  </div>
                  <div className="text-[11px] text-[#64748B]">{wmoLabel(k.wmoCode)} · CAPE {k.capePeak} J/kg</div>
                </div>
                <RiskBadge level={k.risk} />
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mx-4 my-4 bg-[#A3113A] rounded-xl px-4 py-3.5 flex items-center gap-3">
          <Bell size={18} color="white" strokeWidth={1.75} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-white text-[14px] font-semibold leading-tight">Nikdy nezmeškajte výstrahu.</div>
            <div className="text-white/70 text-[11px] mt-0.5">Upozornenia iba pre váš okres.</div>
          </div>
          <button className="bg-white text-[#A3113A] text-[12px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0">
            Zapnúť
          </button>
        </div>

        <p className="text-[10px] text-[#94A3B8] text-center px-4 pb-6">
          Indikatívny výpočet · nie je to varovanie SHMÚ ·{' '}
          <a href="https://www.shmu.sk" className="underline" target="_blank" rel="noopener noreferrer">shmu.sk</a>
        </p>
      </div>
    </>
  )
}
