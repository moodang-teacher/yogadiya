'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { Spinner } from '@/components/ui'

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace('/login')
    } else if (!isLoading && profile && profile.role !== 'member') {
      router.replace('/schedule')
    }
  }, [profile, isLoading, router])

  if (isLoading || !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Spinner size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-24">
      {children}
      <BottomNav role="member" />
    </div>
  )
}
