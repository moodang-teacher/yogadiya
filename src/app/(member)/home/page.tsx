'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, addDays, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { TopHeader } from '@/components/layout/TopHeader'
import { Modal, ResultModal, Badge, CapacityBadge, Spinner, EmptyState } from '@/components/ui'
import { getWeekDays, formatTime, cn, canCancelBooking } from '@/lib/utils'
import type { ClassSession, Booking, MemberPass, BookSessionResult } from '@/types'

export default function MemberHomePage() {
  const { profile } = useAuth()
  const supabase    = createClient()

  const [selectedDate, setSelected] = useState(new Date())
  const [sessions, setSessions]     = useState<ClassSession[]>([])
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [myPass, setMyPass]         = useState<MemberPass | null>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [bookingModal, setBookingModal] = useState<ClassSession | null>(null)
  const [resultModal, setResultModal]   = useState<{
    open: boolean; type: 'success' | 'error'; title: string; desc: string
  } | null>(null)

  const weekDays = getWeekDays(new Date())

  const fetchData = useCallback(async () => {
    if (!profile) return
    setIsLoading(true)

    const from = format(weekDays[0], 'yyyy-MM-dd')
    const to   = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd')

    const [{ data: sessData }, { data: bookData }, { data: passData }] = await Promise.all([
      supabase
        .from('class_sessions')
        .select('*, instructor:profiles!instructor_id(id, name)')
        .gte('session_date', from)
        .lte('session_date', to)
        .eq('status', 'scheduled')
        .order('start_time'),

      supabase
        .from('bookings')
        .select('*')
        .eq('member_id', profile.id)
        .in('status', ['confirmed', 'waitlisted']),

      supabase
        .from('member_passes')
        .select('*, pass_type:pass_types(name)')
        .eq('member_id', profile.id)
        .eq('is_active', true)
        .gte('expire_date', format(new Date(), 'yyyy-MM-dd'))
        .order('expire_date')
        .limit(1)
        .single(),
    ])

    setSessions((sessData as ClassSession[]) ?? [])
    setMyBookings((bookData as Booking[]) ?? [])
    setMyPass(passData as MemberPass | null)
    setIsLoading(false)
  }, [profile, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const todaySessions = sessions.filter(
    (s) => s.session_date === format(selectedDate, 'yyyy-MM-dd')
  )

  const getMyBookingForSession = (sessionId: string) =>
    myBookings.find((b) => b.session_id === sessionId)

  // 예약
  const handleBook = async (session: ClassSession) => {
    if (!profile || !myPass) return

    const result = await supabase.rpc('book_session', {
      p_session_id: session.id,
      p_member_id:  profile.id,
      p_pass_id:    myPass.id,
    }) as { data: BookSessionResult }

    const res = result.data
    if (res.ok) {
      setBookingModal(null)
      setResultModal({
        open: true,
        type: 'success',
        title: res.status === 'confirmed' ? '예약 완료!' : '대기 등록 완료',
        desc:  res.status === 'confirmed'
          ? '수업이 예약되었습니다.'
          : `대기 ${res.waitlist_order}번으로 등록되었습니다.`,
      })
      fetchData()
    } else {
      const errorMessages: Record<string, string> = {
        PASS_INVALID:         '유효한 수강권이 없습니다.',
        ALREADY_BOOKED:       '이미 예약된 수업입니다.',
        FULLY_BOOKED:         '대기 인원도 마감되었습니다.',
        SESSION_NOT_AVAILABLE:'수업이 취소되었습니다.',
      }
      setBookingModal(null)
      setResultModal({
        open: true,
        type: 'error',
        title: '예약 실패',
        desc:  errorMessages[res.error ?? ''] ?? '오류가 발생했습니다.',
      })
    }
  }

  // 취소
  const handleCancel = async (booking: Booking, session: ClassSession) => {
    if (!canCancelBooking(session.session_date, session.start_time, 'member')) {
      setResultModal({
        open: true,
        type: 'error',
        title: '취소 불가',
        desc:  '수업 시작 2시간 전에는 취소할 수 없습니다.',
      })
      return
    }

    const { data } = await supabase.rpc('cancel_booking', {
      p_booking_id:       booking.id,
      p_cancelled_by_role: 'member',
    })

    if (data?.ok) {
      setResultModal({ open: true, type: 'success', title: '예약 취소 완료', desc: '예약이 취소되었습니다.' })
      fetchData()
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <TopHeader
        showMenu
        rightSlot={
          <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center">
            <span className="text-body-sm font-bold text-primary">
              {profile?.name.slice(0, 1)}
            </span>
          </div>
        }
      />

      {/* 수강권 현황 */}
      {myPass && (
        <div className="mx-4 mt-2 card bg-primary p-4 text-on-primary">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-label-sm text-on-primary/70">내 수강권</p>
              <p className="text-body-md font-bold mt-0.5">
                {(myPass as any).pass_type?.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-label-sm text-on-primary/70">잔여</p>
              <p className="text-body-lg font-bold">
                {myPass.remaining_count !== null ? `${myPass.remaining_count}회` : '무제한'}
              </p>
            </div>
          </div>
          <p className="text-label-sm text-on-primary/60 mt-2">
            만료: {myPass.expire_date}
          </p>
        </div>
      )}

      {/* 날짜 선택 */}
      <div className="px-4 pt-4 pb-3">
        <p className="text-label-sm text-on-surface-variant tracking-wide mb-2">주간 시간표</p>
        <div className="flex gap-1.5">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate)
            const dow        = day.getDay()
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                className={cn(
                  'flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all duration-150',
                  isSelected ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container'
                )}
              >
                <span className={cn(
                  'text-label-sm font-medium',
                  isSelected ? 'text-on-primary/80' : 'text-on-surface-variant',
                  !isSelected && dow === 0 && 'text-error',
                )}>
                  {['일','월','화','수','목','금','토'][dow]}
                </span>
                <span className={cn(
                  'text-lg font-bold mt-0.5 tabular-nums',
                  isSelected ? 'text-on-primary' : 'text-on-surface',
                )}>
                  {day.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 수업 목록 */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        <h2 className="text-headline-md font-bold text-on-surface">
          오늘의 수업
          <span className="text-body-md font-normal text-on-surface-variant ml-2">
            ({todaySessions.length})
          </span>
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size={32} /></div>
        ) : todaySessions.length === 0 ? (
          <EmptyState title="수업이 없습니다" />
        ) : (
          todaySessions.map((session) => {
            const myBooking = getMyBookingForSession(session.id)
            return (
              <MemberClassCard
                key={session.id}
                session={session}
                myBooking={myBooking}
                onBook={() => setBookingModal(session)}
                onCancel={() => myBooking && handleCancel(myBooking, session)}
              />
            )
          })
        )}
      </div>

      {/* 예약 확인 모달 */}
      {bookingModal && (
        <Modal open onClose={() => setBookingModal(null)}>
          <div className="p-6 space-y-4">
            <h3 className="text-headline-md font-bold text-on-surface">예약하시겠습니까?</h3>
            <div className="card bg-surface-container-low p-4 space-y-2">
              <p className="text-body-md font-semibold">{bookingModal.name}</p>
              <p className="text-body-sm text-on-surface-variant">
                {format(new Date(bookingModal.session_date), 'M월 d일 (E)', { locale: ko })} · {formatTime(bookingModal.start_time)}
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {bookingModal.instructor?.name} 강사
              </p>
              <CapacityBadge current={bookingModal.current_count} max={bookingModal.max_capacity} />
            </div>
            {!myPass && (
              <p className="text-body-sm text-error">유효한 수강권이 없습니다.</p>
            )}
            <div className="space-y-2.5">
              <button
                onClick={() => handleBook(bookingModal)}
                disabled={!myPass}
                className="btn-primary"
              >
                예약하기
              </button>
              <button onClick={() => setBookingModal(null)} className="btn-ghost">
                취소
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ResultModal
        open={!!resultModal?.open}
        type={resultModal?.type ?? 'success'}
        title={resultModal?.title ?? ''}
        description={resultModal?.desc}
        onConfirm={() => setResultModal(null)}
      />
    </div>
  )
}

function MemberClassCard({
  session, myBooking, onBook, onCancel
}: {
  session: ClassSession
  myBooking?: Booking
  onBook: () => void
  onCancel: () => void
}) {
  const isFull = session.current_count >= session.max_capacity
  const canCancel = myBooking && canCancelBooking(session.session_date, session.start_time, 'member')

  return (
    <div className="card overflow-hidden">
      <div className="flex items-stretch gap-0">
        {/* 시간 */}
        <div className="flex flex-col items-center justify-center px-4 py-4 bg-primary text-on-primary min-w-[72px]">
          <span className="text-base font-bold tabular-nums">{formatTime(session.start_time)}</span>
        </div>
        {/* 내용 */}
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start gap-2">
            <div>
              {session.level_label && (
                <Badge variant="secondary" className="mb-1">{session.level_label}</Badge>
              )}
              <p className="text-body-md font-semibold text-on-surface">{session.name}</p>
              <p className="text-body-sm text-on-surface-variant">{session.instructor?.name} 강사</p>
            </div>
            <CapacityBadge current={session.current_count} max={session.max_capacity} />
          </div>

          {/* 예약 상태 / 버튼 */}
          <div className="mt-3">
            {myBooking?.status === 'confirmed' ? (
              <div className="flex items-center justify-between">
                <Badge variant="secondary" size="md">✓ 예약완료</Badge>
                {canCancel && (
                  <button
                    onClick={onCancel}
                    className="text-label-sm text-on-surface-variant underline"
                  >
                    예약 취소
                  </button>
                )}
              </div>
            ) : myBooking?.status === 'waitlisted' ? (
              <div className="flex items-center justify-between">
                <Badge variant="default" size="md">대기 {myBooking.waitlist_order}번</Badge>
                <button onClick={onCancel} className="text-label-sm text-on-surface-variant underline">
                  대기 취소
                </button>
              </div>
            ) : (
              <button
                onClick={onBook}
                className={cn(
                  'w-full py-2.5 rounded-lg text-label-lg font-semibold transition-colors',
                  isFull
                    ? session.waitlist_count < session.waitlist_max
                      ? 'bg-surface-container-high text-on-surface-variant'
                      : 'bg-surface-dim text-on-surface-variant/50 cursor-not-allowed'
                    : 'bg-secondary-container text-on-secondary-container'
                )}
                disabled={isFull && session.waitlist_count >= session.waitlist_max}
              >
                {isFull
                  ? session.waitlist_count < session.waitlist_max ? '대기 등록' : '마감'
                  : '예약하기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
