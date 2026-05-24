'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Users, BookOpen, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const ADMIN_NAV: NavItem[] = [
  { href: '/schedule',    label: '시간표',   icon: Calendar,   roles: ['admin', 'manager', 'instructor'] },
  { href: '/members',     label: '회원관리', icon: Users,      roles: ['admin', 'manager'] },
  { href: '/bookings',    label: '예약관리', icon: BookOpen,   roles: ['admin', 'manager', 'instructor'] },
  { href: '/instructors', label: '강사관리', icon: UserCheck,  roles: ['admin'] },
]

const MEMBER_NAV: NavItem[] = [
  { href: '/home',     label: '시간표', icon: Calendar, roles: ['member'] },
  { href: '/my',       label: '내 예약', icon: BookOpen, roles: ['member'] },
]

interface BottomNavProps {
  role: UserRole
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname()
  const navItems = role === 'member' ? MEMBER_NAV : ADMIN_NAV

  const visibleItems = navItems.filter(item => item.roles.includes(role))

  return (
    <nav className="bottom-nav safe-bottom">
      <div className="flex items-stretch">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3',
                'text-label-sm transition-colors duration-150',
                isActive
                  ? 'text-secondary-DEFAULT'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <div className={cn(
                'w-12 flex items-center justify-center rounded-full py-1',
                isActive && 'bg-secondary-container'
              )}>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.5}
                  className={isActive ? 'text-on-secondary-container' : ''}
                />
              </div>
              <span className={cn('font-medium', isActive && 'font-semibold text-on-secondary-container')}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
