'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Map, Bell, MoreHorizontal } from 'lucide-react'
import clsx from 'clsx'

const TABS = [
  { href: '/',            label: 'Prehľad',    Icon: Home },
  { href: '/mapa',        label: 'Mapa',        Icon: Map },
  { href: '/upozornenia', label: 'Upozornenia', Icon: Bell },
  { href: '/viac',        label: 'Viac',        Icon: MoreHorizontal },
]

export function BottomNav() {
  const path = usePathname()
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] flex z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Hlavná navigácia"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 flex-1 py-2.5 cursor-pointer transition-colors duration-150',
              active ? 'text-[#A3113A]' : 'text-[#64748B] hover:text-[#0F172A]'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.75} />
            <span className={clsx('text-[11px]', active ? 'font-semibold' : 'font-medium')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
