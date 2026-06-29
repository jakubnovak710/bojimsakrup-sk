import { RISK, type RiskLevel } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  level: RiskLevel
  size?: 'sm' | 'md' | 'lg'
}

export function RiskBadge({ level, size = 'md' }: Props) {
  const r = RISK[level]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-md border',
        size === 'sm' && 'text-[11px] px-1.5 py-0.5',
        size === 'md' && 'text-xs px-2 py-1',
        size === 'lg' && 'text-sm px-2.5 py-1',
      )}
      style={{ background: r.bg, borderColor: r.border, color: r.text }}
    >
      <span
        className="rounded-sm flex-shrink-0"
        style={{
          width:  size === 'sm' ? 5 : 6,
          height: size === 'sm' ? 5 : 6,
          background: r.indicator,
        }}
      />
      {r.label}
    </span>
  )
}
