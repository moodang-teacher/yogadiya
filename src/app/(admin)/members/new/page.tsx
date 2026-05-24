'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { TopHeader } from '@/components/layout/TopHeader'
import { ResultModal } from '@/components/ui'
import { phoneToEmail, normalizePhone, calcExpireDate } from '@/lib/utils'
import type { PassType } from '@/types'

const schema = z.object({
  name:         z.string().min(2, '이름을 입력해주세요'),
  phone:        z.string().min(10, '전화번호를 입력해주세요'),
  birthday:     z.string().optional(),
  address:      z.string().optional(),
  pass_type_id: z.string().min(1, '수강권을 선택해주세요'),
  start_date:   z.string().min(1, '시작일을 입력해주세요'),
})

type FormData = z.infer<typeof schema>

export default function NewMemberPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [passTypes, setPassTypes]   = useState<PassType[]>([])
  const [resultModal, setResultModal] = useState<{ open: boolean; success: boolean; message: string }>({
    open: false, success: false, message: ''
  })

  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: format(new Date(), 'yyyy-MM-dd') },
  })

  const selectedPassId = watch('pass_type_id')
  const startDate      = watch('start_date')
  const selectedPass   = passTypes.find((p) => p.id === selectedPassId)
  const expireDate     = selectedPass && startDate
    ? format(calcExpireDate(new Date(startDate), selectedPass.validity_days), 'yyyy-MM-dd')
    : null

  useEffect(() => {
    supabase
      .from('pass_types')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => setPassTypes((data as PassType[]) ?? []))
  }, [supabase])

  const onSubmit = async (data: FormData) => {
    const phone     = normalizePhone(data.phone)
    const email     = phoneToEmail(phone)
    const initialPin = phone.slice(-4) // 전화번호 뒷 4자리

    // 1) Supabase Auth 계정 생성 (Admin API 필요 — 서버 액션으로 호출)
    const res = await fetch('/api/admin/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: initialPin,
        name: data.name,
        phone,
        birthday: data.birthday || null,
        address: data.address || null,
        pass_type_id: data.pass_type_id,
        start_date: data.start_date,
        expire_date: expireDate,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setResultModal({
        open: true,
        success: false,
        message: result.error === 'USER_EXISTS'
          ? '이미 등록된 전화번호입니다.'
          : '오류가 발생했습니다. 다시 시도해주세요.',
      })
      return
    }

    setResultModal({ open: true, success: true, message: '' })
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <TopHeader title="회원 등록" showBack />

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* 이름 */}
        <div className="space-y-1.5">
          <label className="text-label-lg text-on-surface">이름 <span className="text-error">*</span></label>
          <input {...register('name')} placeholder="홍길동" className="input-field" />
          {errors.name && <p className="text-body-sm text-error">{errors.name.message}</p>}
        </div>

        {/* 전화번호 */}
        <div className="space-y-1.5">
          <label className="text-label-lg text-on-surface">전화번호 <span className="text-error">*</span></label>
          <input
            {...register('phone')}
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            className="input-field"
          />
          {errors.phone && <p className="text-body-sm text-error">{errors.phone.message}</p>}
          <p className="text-label-sm text-on-surface-variant">
            초기 PIN: 전화번호 뒷 4자리
          </p>
        </div>

        {/* 생년월일 */}
        <div className="space-y-1.5">
          <label className="text-label-lg text-on-surface">생년월일</label>
          <input type="date" {...register('birthday')} className="input-field" />
        </div>

        {/* 주소 */}
        <div className="space-y-1.5">
          <label className="text-label-lg text-on-surface">주소 (선택)</label>
          <input {...register('address')} placeholder="주소를 입력하세요" className="input-field" />
        </div>

        {/* 수강권 종류 */}
        <div className="space-y-1.5">
          <label className="text-label-lg text-on-surface">수강권 종류 <span className="text-error">*</span></label>
          <select {...register('pass_type_id')} className="input-field">
            <option value="">수강권을 선택해주세요</option>
            {passTypes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.total_count !== null ? `${p.total_count}회` : '무제한'} / {p.validity_days}일)
              </option>
            ))}
          </select>
          {errors.pass_type_id && <p className="text-body-sm text-error">{errors.pass_type_id.message}</p>}
        </div>

        {/* 시작일 */}
        <div className="space-y-1.5">
          <label className="text-label-lg text-on-surface">수강 시작일 <span className="text-error">*</span></label>
          <input type="date" {...register('start_date')} className="input-field" />
        </div>

        {/* 만료일 미리보기 */}
        {expireDate && (
          <div className="card p-4 bg-surface-container-low">
            <div className="flex justify-between text-body-sm">
              <span className="text-on-surface-variant">수강권 만료일</span>
              <span className="font-semibold text-on-surface">{expireDate}</span>
            </div>
            <div className="flex justify-between text-body-sm mt-1.5">
              <span className="text-on-surface-variant">잔여 횟수</span>
              <span className="font-semibold text-on-surface">
                {selectedPass?.total_count !== null ? `${selectedPass?.total_count}회` : '무제한'}
              </span>
            </div>
          </div>
        )}

        <div className="pb-6">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? '등록 중...' : '회원 등록'}
          </button>
        </div>
      </form>

      <ResultModal
        open={resultModal.open}
        type={resultModal.success ? 'success' : 'error'}
        title={resultModal.success ? '회원 등록 완료' : '등록 실패'}
        description={resultModal.success ? '회원이 정상적으로 등록되었습니다.' : resultModal.message}
        onConfirm={() => {
          setResultModal({ open: false, success: false, message: '' })
          if (resultModal.success) router.push('/members')
        }}
      />
    </div>
  )
}
