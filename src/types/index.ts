// ============================================================
// 요가디야 - TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'manager' | 'instructor' | 'member'
export type SessionStatus = 'scheduled' | 'cancelled' | 'completed'
export type BookingStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show'
export type ClassCategory = 'flying' | 'low_flying' | 'kids_flying' | 'mat_yoga'

// ── Database Row Types ─────────────────────────────────────

export interface Profile {
  id: string
  name: string
  phone: string
  birthday: string | null
  address: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClassTemplate {
  id: string
  name: string
  category: ClassCategory
  level_label: string | null
  max_capacity: number
  min_capacity: number
  waitlist_max: number
  duration_min: number
  instructor_id: string | null
  recurrence_days: number[]          // 0=일, 1=월, ..., 6=토
  start_time: string                 // HH:mm:ss
  color: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  instructor?: Profile
}

export interface ClassSession {
  id: string
  template_id: string | null
  name: string
  category: ClassCategory
  level_label: string | null
  instructor_id: string | null
  session_date: string               // YYYY-MM-DD
  start_time: string                 // HH:mm:ss
  end_time: string
  max_capacity: number
  min_capacity: number
  waitlist_max: number
  current_count: number
  waitlist_count: number
  status: SessionStatus
  color: string
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  instructor?: Profile
  bookings?: Booking[]
}

export interface PassType {
  id: string
  name: string
  total_count: number | null         // null = 무제한
  validity_days: number
  price: number
  is_active: boolean
  created_at: string
}

export interface MemberPass {
  id: string
  member_id: string
  pass_type_id: string
  remaining_count: number | null     // null = 무제한
  start_date: string
  expire_date: string
  is_active: boolean
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  pass_type?: PassType
  member?: Profile
}

export interface Booking {
  id: string
  session_id: string
  member_id: string
  pass_id: string | null
  status: BookingStatus
  waitlist_order: number | null
  booked_at: string
  cancelled_at: string | null
  attended_at: string | null
  note: string | null
  // joined
  session?: ClassSession
  member?: Profile
  pass?: MemberPass
}

export interface InstructorPay {
  id: string
  instructor_id: string
  hourly_rate: number
  effective_from: string
  created_at: string
}

export interface PayrollRecord {
  id: string
  instructor_id: string
  year: number
  month: number
  total_sessions: number
  total_hours: number
  total_pay: number
  calculated_at: string
  // joined
  instructor?: Profile
}

// ── RPC Response Types ─────────────────────────────────────

export interface BookSessionResult {
  ok: boolean
  status?: 'confirmed' | 'waitlisted'
  booking_id?: string
  waitlist_order?: number
  error?: 'SESSION_NOT_FOUND' | 'SESSION_NOT_AVAILABLE' | 'ALREADY_BOOKED' | 'PASS_INVALID' | 'FULLY_BOOKED'
}

export interface CancelBookingResult {
  ok: boolean
  error?: 'BOOKING_NOT_FOUND' | 'ALREADY_CANCELLED' | 'CANCEL_DEADLINE_PASSED'
}

export interface GenerateSessionPreview {
  session_date: string
  start_time: string
  end_time: string
  name: string
  instructor_id: string | null
  is_holiday: boolean
}

// ── UI State Types ─────────────────────────────────────────

export interface WeekDay {
  date: Date
  dayStr: string   // "월", "화", ...
  dateNum: number
  isToday: boolean
  isSelected: boolean
  isHoliday: boolean
}

export const CLASS_CATEGORY_LABELS: Record<ClassCategory, string> = {
  flying: '플라잉요가',
  low_flying: '로우플라잉',
  kids_flying: '키즈플라잉',
  mat_yoga: '매트요가',
}

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
export const DAY_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed:  '예약확정',
  waitlisted: '대기중',
  cancelled:  '취소',
  attended:   '출석',
  no_show:    '노쇼',
}

export const CLASS_TEMPLATE_NAMES = [
  '레벨0 플라잉요가 입문',
  '레벨0.5 플라잉요가 초급',
  '레벨0.7 플라잉요가 중급',
  '레벨1 플라잉요가 고급',
  '로우플라잉',
  '키즈플라잉',
  '매트요가 (빈야사)',
  '매트요가 (아쉬탕가)',
] as const
