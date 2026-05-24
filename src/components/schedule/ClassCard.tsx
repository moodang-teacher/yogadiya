import Link from 'next/link'
import { cn, formatTime } from '@/lib/utils'
import { CapacityBadge, Badge } from '@/components/ui'
import type { ClassSession } from '@/types'

interface ClassCardProps {
  session: ClassSession
  href?: string
  showDate?: boolean
  compact?: boolean
}

export function ClassCard({ session, href, showDate = false, compact = false }: ClassCardProps) {
  const isCancelled = session.status === 'cancelled'
  const isCompleted = session.status === 'completed'

  const content = (
    <div className={cn(
      'card flex items-stretch gap-0 overflow-hidden',
      'transition-all duration-150',
      href && 'card-hover cursor-pointer',
      (isCancelled || isCompleted) && 'opacity-60'
    )}>
      {/* 시간 컬럼 */}
      <div className={cn(
        'flex flex-col items-center justify-center px-4 min-w-[80px]',
        'bg-primary text-on-primary rounded-l-lg',
        compact ? 'py-3' : 'py-4'
      )}>
        <span className={cn('font-bold tabular-nums', compact ? 'text-base' : 'text-lg')}>
          {formatTime(session.start_time)}
        </span>
        {!compact && (
          <span className="text-label-sm text-on-primary/70 mt-0.5">
            {session.end_time ? `${calcDuration(session.start_time, session.end_time)}분` : ''}
          </span>
        )}
      </div>

      {/* 내용 컬럼 */}
      <div className={cn('flex-1 flex flex-col justify-center px-4', compact ? 'py-3' : 'py-4')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* 레벨 뱃지 */}
            {session.level_label && (
              <Badge variant="secondary" className="mb-1.5">
                {session.level_label}
              </Badge>
            )}
            {/* 수업명 */}
            <p className={cn(
              'font-semibold text-on-surface text-ellipsis-2',
              compact ? 'text-body-sm' : 'text-body-md'
            )}>
              {session.name}
            </p>
            {/* 강사 */}
            {session.instructor && (
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                {session.instructor.name} 강사
              </p>
            )}
          </div>

          {/* 예약 현황 */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <CapacityBadge
              current={session.current_count}
              max={session.max_capacity}
            />
            {session.status === 'cancelled' && (
              <Badge variant="error">수업취소</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}
