'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { BottomNav } from '@/components/layout/BottomNav'
import { Spinner } from '@/components/ui'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace('/login')
    } else if (!isLoading && profile?.role === 'member') {
      router.replace('/home')
    }
  }, [profile, isLoading, router])

  if (isLoading || !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Spinner size={40} />
      </div>
    )
  }

  if (profile.role === 'member') return null

  return (
    <div className="min-h-dvh pb-24">
      {children}
      <BottomNav role={profile.role} />
    </div>
  )
}
