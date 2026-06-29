// Design tokens — BojímSaKrúp.sk
// Style: Apple × Linear × Cloudflare — minimal, data-dense, trustworthy

export const color = {
  primary:        '#A3113A',
  primaryHover:   '#7F0D2D',
  background:     '#F8FAFC',
  surface:        '#FFFFFF',
  text:           '#0F172A',
  textSecondary:  '#64748B',
  border:         '#E5E7EB',
} as const

export const risk = {
  none: {
    indicator: '#22C55E',
    text:      '#15803D',   // green-700 — 5.1:1 contrast on bg
    bg:        '#F0FDF4',
    border:    '#D1FAE5',
    map:       '#86EFAC',
    label:     'Bez rizika',
  },
  low: {
    indicator: '#FACC15',
    text:      '#A16207',   // amber-700 — 4.8:1 contrast on bg
    bg:        '#FEFCE8',
    border:    '#FEF08A',
    map:       '#FDE047',
    label:     'Nízke',
  },
  medium: {
    indicator: '#FB923C',
    text:      '#C2410C',   // orange-700 — 5.3:1 contrast on bg
    bg:        '#FFF7ED',
    border:    '#FED7AA',
    map:       '#FDBA74',
    label:     'Zvýšené',
  },
  high: {
    indicator: '#EF4444',
    text:      '#B91C1C',   // red-700 — 5.1:1 contrast on bg
    bg:        '#FEF2F2',
    border:    '#FECACA',
    map:       '#FCA5A5',
    label:     'Vysoké',
  },
  extreme: {
    indicator: '#7F1D1D',
    text:      '#7F1D1D',   // red-950 — 7.2:1 contrast on bg
    bg:        '#FFF1F2',
    border:    '#FECDD3',
    map:       '#991B1B',
    label:     'Extrémne',
  },
} as const

export type RiskKey = keyof typeof risk

export const radius = {
  sm:  '4px',
  md:  '6px',
  lg:  '10px',
  xl:  '14px',
  '2xl': '20px',
} as const

export const shadow = {
  sm:  '0 1px 2px rgba(0,0,0,0.05)',
  md:  '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.03)',
} as const

export const typography = {
  labelXs:  'text-[11px] font-medium tracking-wide uppercase',
  labelSm:  'text-xs font-medium',
  body:     'text-sm leading-relaxed',
  headingMd: 'text-base font-semibold tracking-tight',
  headingLg: 'text-lg font-bold tracking-tight',
} as const
