import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parse, isToday, isSameDay, addDays, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'

// ── Tailwind 클래스 병합 ───────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── 날짜 포맷 ──────────────────────────────────────────────
export const formatDate = (date: Date | string, fmt = 'yyyy년 M월 d일') => {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, fmt, { locale: ko })
}

export const formatTime = (time: string) => {
  // "HH:mm:ss" → "HH:mm"
  return time.slice(0, 5)
}

export const formatDateShort = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'M월 d일 (E)', { locale: ko })
}

// ── 해당 주 날짜 배열 생성 (월요일 시작) ──────────────────
export function getWeekDays(baseDate: Date): Date[] {
  const monday = startOfWeek(baseDate, { weekStartsOn: 1 })
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i))
}

// ── 월 캘린더 날짜 배열 생성 ──────────────────────────────
export function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1)
  const last  = new Date(year, month, 0)

  // 달력 첫 행 채우기 (일요일 시작)
  const startDow = first.getDay()  // 0=일
  const endDow   = 6 - last.getDay()

  const days: Date[] = []
  for (let i = startDow; i > 0; i--) {
    days.push(new Date(year, month - 1, 1 - i))
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month - 1, d))
  }
  for (let i = 1; i <= endDow; i++) {
    days.push(new Date(year, month, i))
  }
  return days
}

// ── 수강권 만료일 계산 ────────────────────────────────────
export function calcExpireDate(startDate: Date, validityDays: number): Date {
  return addDays(startDate, validityDays - 1)
}

// ── 전화번호 포맷 ─────────────────────────────────────────
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// ── Supabase Auth용 이메일 변환 ───────────────────────────
// 전화번호를 Supabase email 형식으로 변환
export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@yogadiya.app`
}

// ── 정원 현황 뱃지 텍스트 ─────────────────────────────────
export function getCapacityBadge(current: number, max: number): {
  text: string
  variant: 'available' | 'warning' | 'full'
} {
  if (current >= max) return { text: `${current}/${max} 마감`, variant: 'full' }
  if (current >= max * 0.8) return { text: `${current}/${max} 예약`, variant: 'warning' }
  return { text: `${current}/${max} 예약`, variant: 'available' }
}

// ── 요일 라벨 ─────────────────────────────────────────────
export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

// ── 수업 취소 가능 여부 확인 ──────────────────────────────
export function canCancelBooking(
  sessionDate: string,
  startTime: string,
  role: string,
  cutoffHours = 2,
): boolean {
  if (role === 'admin' || role === 'manager') return true
  const sessionStart = new Date(`${sessionDate}T${startTime}`)
  const cutoff = new Date(sessionStart.getTime() - cutoffHours * 60 * 60 * 1000)
  return new Date() < cutoff
}

// ── 숫자 통화 포맷 ────────────────────────────────────────
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

// ── 대한민국 공휴일 API (공공데이터포털) ─────────────────
// 실제 배포 시 API 키 필요, 개발 중에는 기본 공휴일 목록 사용
const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '크리스마스',
}

export function isKoreanHoliday(date: Date): boolean {
  const mmdd = format(date, 'MM-dd')
  return mmdd in FIXED_HOLIDAYS
}

export function getHolidayName(date: Date): string | null {
  const mmdd = format(date, 'MM-dd')
  return FIXED_HOLIDAYS[mmdd] ?? null
}
