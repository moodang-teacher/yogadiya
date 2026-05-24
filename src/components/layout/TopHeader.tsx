'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopHeaderProps {
  title?: string
  showBack?: boolean
  showMenu?: boolean
  rightSlot?: React.ReactNode
  className?: string
  onMenuClick?: () => void
}

export function TopHeader({
  title,
  showBack = false,
  showMenu = false,
  rightSlot,
  className,
  onMenuClick,
}: TopHeaderProps) {
  const router = useRouter()

  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 h-14 safe-top',
        'bg-background/90 backdrop-blur-sm sticky top-0 z-40',
        className
      )}
    >
      {/* 왼쪽 */}
      <div className="w-10 flex items-center">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="btn-icon"
            aria-label="뒤로가기"
          >
            <ArrowLeft size={22} strokeWidth={1.8} />
          </button>
        )}
        {showMenu && (
          <button
            onClick={onMenuClick}
            className="btn-icon"
            aria-label="메뉴"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* 중앙 타이틀 */}
      {title && (
        <h1 className="text-body-md font-semibold text-on-surface">{title}</h1>
      )}

      {/* 오른쪽 슬롯 */}
      <div className="w-10 flex items-center justify-end">
        {rightSlot}
      </div>
    </header>
  )
}
