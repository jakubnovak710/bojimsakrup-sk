'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, Bell, Map, Home, MoreHorizontal } from 'lucide-react'
import clsx from 'clsx'

const LINKS = [
  { href: '/',            label: 'Prehľad',    Icon: Home },
  { href: '/mapa',        label: 'Mapa',        Icon: Map },
  { href: '/upozornenia', label: 'Upozornenia', Icon: Bell },
  { href: '/viac',        label: 'Viac',        Icon: MoreHorizontal },
]

export function TopNav() {
  const path = usePathname()
  return (
    <header className="hidden lg:flex sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-6 h-14 items-center justify-between">
      <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
        <div className="w-7 h-7 rounded-md bg-[#A3113A] flex items-center justify-center">
          <Shield size={14} color="white" strokeWidth={2.2} />
        </div>
        <span className="text-[14px] font-bold text-[#0F172A] tracking-tight">
          BOJÍMSA<span className="text-[#A3113A]">KRÚP</span>.SK
        </span>
      </Link>

      <nav className="flex items-center gap-1">
        {LINKS.map(({ href, label, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150',
                active
                  ? 'bg-[#FFF1F2] text-[#A3113A]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              )}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.75} />
              {label}
            </Link>
          )
        })}
      </nav>

      <button
        className="w-8 h-8 rounded-lg border border-[#E5E7EB] flex items-center justify-center cursor-pointer hover:bg-[#F8FAFC] transition-colors duration-150"
        aria-label="Upozornenia"
      >
        <Bell size={15} className="text-[#64748B]" strokeWidth={1.75} />
      </button>
    </header>
  )
}
