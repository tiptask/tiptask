'use client'
import React from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RefPage({ params: paramsPromise }: { params: Promise<{ code: string }> }) {
  const params = React.use(paramsPromise)
  const router = useRouter()
  useEffect(() => {
    router.replace(`/auth/register?ref=${params.code}`)
  }, [params.code, router])
  return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )
}
