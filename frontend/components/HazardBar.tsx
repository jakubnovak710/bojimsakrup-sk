import type { LucideIcon } from 'lucide-react'

interface HazardBarProps {
  label: string
  value: number
  Icon: LucideIcon
}

function barColor(v: number): string {
  if (v >= 70) return '#EF4444'
  if (v >= 45) return '#FB923C'
  if (v >= 20) return '#FACC15'
  return '#22C55E'
}

export function HazardBar({ label, value, Icon }: HazardBarProps) {
  const color = barColor(value)
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} strokeWidth={1.75} className="text-[#64748B] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-[#0F172A]">{label}</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color }}>{value} %</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${value}%`, background: color }}
          />
        </div>
      </div>
    </div>
  )
}
