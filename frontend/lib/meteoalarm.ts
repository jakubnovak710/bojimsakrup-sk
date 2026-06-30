// MeteoAlarm Atom feed — oficiálne výstrahy SHMÚ pre Slovensko
// Licencia: CC BY 4.0 · zdroj: EUMETNET / SHMÚ
// Feed: https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-slovakia

export type AlertSeverity = 'Minor' | 'Moderate' | 'Severe' | 'Extreme'
export type AlertUrgency  = 'Immediate' | 'Expected' | 'Future'

export interface MeteoAlert {
  id: string
  areaDesc: string        // názov oblasti (napr. "Banská Bystrica")
  emmaId: string          // EMMA_ID (napr. "SK601")
  krajSlug: string        // napr. "banskobystricky-kraj"
  okresSlug: string       // napr. "okres-banska-bystrica"
  event: string           // napr. "Moderate thunderstorm with hail warning"
  severity: AlertSeverity
  urgency: AlertUrgency
  onset: string           // ISO
  expires: string         // ISO
  sent: string            // ISO
  isHail: boolean
  isThunder: boolean
  isWind: boolean
  isHeat: boolean
}

// EMMA_ID prefix → kraj slug (SK1xx = Bratislavský, SK2xx = Trnavský, ...)
const EMMA_PREFIX_KRAJ: Record<string, string> = {
  'SK1': 'bratislavsky-kraj',
  'SK2': 'trnavsky-kraj',
  'SK3': 'trenciansky-kraj',
  'SK4': 'nitriansky-kraj',
  'SK5': 'zilinsky-kraj',
  'SK6': 'banskobystricky-kraj',
  'SK7': 'presovsky-kraj',
  'SK8': 'kosicky-kraj',
}

// Odvoď krajSlug z EMMA_ID (SK601 → SK6 → banskobystricky-kraj)
function emmaToKrajSlug(emmaId: string): string {
  const prefix = emmaId.slice(0, 3)          // SK6
  return EMMA_PREFIX_KRAJ[prefix] ?? 'unknown'
}

// Jednoduchý text → slug (bez diakritiky, malé, pomlčky)
function toSlug(name: string): string {
  return 'okres-' + name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

// Rozpoznaj typ nebezpečenstva z textu udalosti
function classifyEvent(event: string): Pick<MeteoAlert, 'isHail' | 'isThunder' | 'isWind' | 'isHeat'> {
  const e = event.toLowerCase()
  return {
    isHail:    e.includes('hail'),
    isThunder: e.includes('thunderstorm') || e.includes('thunder'),
    isWind:    e.includes('wind'),
    isHeat:    e.includes('temperature') || e.includes('heat'),
  }
}

// Parsuj XML text na AlertInfo[] (plain regex — bez DOM parsera pre server-side)
function parseAtomFeed(xml: string): MeteoAlert[] {
  const alerts: MeteoAlert[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]

    const id       = extractTag(entry, 'id')       ?? ''
    const areaDesc = extractTag(entry, 'cap:areaDesc') ?? extractTag(entry, 'areaDesc') ?? ''
    const emmaId   = extractTagWithAttr(entry, 'cap:geocode', 'EMMA_ID') ?? ''
    const event    = extractTag(entry, 'cap:event')    ?? ''
    const severity = (extractTag(entry, 'cap:severity') ?? 'Minor') as AlertSeverity
    const urgency  = (extractTag(entry, 'cap:urgency')  ?? 'Future') as AlertUrgency
    const onset    = extractTag(entry, 'cap:onset')     ?? ''
    const expires  = extractTag(entry, 'cap:expires')   ?? ''
    const sent     = extractTag(entry, 'cap:sent')      ?? ''

    if (!emmaId || !event) continue

    alerts.push({
      id,
      areaDesc,
      emmaId,
      krajSlug:   emmaToKrajSlug(emmaId),
      okresSlug:  toSlug(areaDesc),
      event,
      severity,
      urgency,
      onset,
      expires,
      sent,
      ...classifyEvent(event),
    })
  }

  return alerts
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag.replace(':', '[:]')}[^>]*>([\\s\\S]*?)<\\/${tag.replace(':', '[:]')}>`)
  const m = re.exec(xml)
  return m ? m[1].trim() : null
}

// Extrahuje hodnotu z páru <valueName>KEY</valueName><value>VAL</value>
function extractTagWithAttr(xml: string, _tag: string, key: string): string | null {
  const re = new RegExp(`<valueName>${key}<\\/valueName>\\s*<value>([^<]+)<\\/value>`)
  const m = re.exec(xml)
  return m ? m[1].trim() : null
}

// Hlavná export funkcia — načíta a parsuje MeteoAlarm feed
export async function fetchMeteoAlerts(): Promise<MeteoAlert[]> {
  try {
    const res = await fetch(
      'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-slovakia',
      { next: { revalidate: 600 } }   // 10 min cache
    )
    if (!res.ok) return []
    const xml = await res.text()
    const alerts = parseAtomFeed(xml)

    // Odfiltruj minulé výstrahy
    const now = Date.now()
    return alerts.filter(a => !a.expires || new Date(a.expires).getTime() > now)
  } catch {
    return []
  }
}

// Výstrahy pre konkrétny kraj (slug)
export function alertsForKraj(alerts: MeteoAlert[], krajSlug: string): MeteoAlert[] {
  return alerts.filter(a => a.krajSlug === krajSlug)
}

// Najvyššia závažnosť pre kraj
const SEV_NUM: Record<AlertSeverity, number> = { Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 }

export function maxSeverityForKraj(alerts: MeteoAlert[], krajSlug: string): AlertSeverity | null {
  const krajAlerts = alertsForKraj(alerts, krajSlug)
  if (krajAlerts.length === 0) return null
  return krajAlerts.reduce((best, a) =>
    SEV_NUM[a.severity] > SEV_NUM[best.severity] ? a : best
  ).severity
}

// Preloží AlertSeverity → čitateľný slovenský text
export function severityLabel(s: AlertSeverity): string {
  return { Minor: 'Nízka', Moderate: 'Stredná', Severe: 'Vysoká', Extreme: 'Extrémna' }[s]
}

// Farba výstrahy
export function severityColor(s: AlertSeverity): string {
  return { Minor: '#22C55E', Moderate: '#FACC15', Severe: '#FB923C', Extreme: '#EF4444' }[s]
}
