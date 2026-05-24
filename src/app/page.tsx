'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { Spinner } from '@/components/ui'

export default function RootPage() {
  const { profile, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!profile) {
      router.replace('/login')
    } else if (profile.role === 'member') {
      router.replace('/home')
    } else {
      router.replace('/schedule')
    }
  }, [profile, isLoading, router])

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <Spinner size={40} />
    </div>
  )
}
