'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Creator, Session } from '@/types'

const SOCIAL_ICONS: Record<string, { icon: string; base: string; color: string }> = {
  instagram: { icon: '📸', base: 'https://instagram.com/', color: 'hover:text-pink-400' },
  tiktok:    { icon: '🎵', base: 'https://tiktok.com/@', color: 'hover:text-white' },
  youtube:   { icon: '▶️', base: 'https://youtube.com/@', color: 'hover:text-red-400' },
  twitch:    { icon: '🟣', base: 'https://twitch.tv/', color: 'hover:text-purple-400' },
  website:   { icon: '🌐', base: '', color: 'hover:text-[#4AFFD4]' },
}

export default function ProfilePage({ params: paramsPromise }: { params: Promise<{ username: string }> }) {
  const params = React.use(paramsPromise)
  const router = useRouter()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: creatorData } = await supabase
        .from('creators').select('*').eq('username', params.username).single()
      if (!creatorData) { setLoading(false); return }
      setCreator(creatorData)

      const { data: sessionData } = await supabase
        .from('sessions').select('*')
        .eq('creator_id', creatorData.id).eq('is_active', true).single()
      setSession(sessionData ?? null)

      if (sessionData && sessionData.use_landing_page === false) {
        router.replace(`/tip/${params.username}`)
        return
      }
      setLoading(false)
    }
    load()
  }, [params.username, router])

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  if (!creator) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-4">🔍</p>
        <p className="text-white/40">Creator not found</p>
        <Link href="/" className="text-[#4AFFD4] text-sm mt-4 block hover:text-[#6FFFDF] transition">← Back to TipTask</Link>
      </div>
    </main>
  )

  const socials = Object.entries(SOCIAL_ICONS).filter(([key]) => (creator as any)[key])
  const isLive = !!session

  return (
    <main className="min-h-screen bg-[#08080C] text-white relative overflow-hidden">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#4AFFD4] opacity-[0.03] blur-[120px] pointer-events-none" />
      <div className="max-w-md mx-auto px-6 pt-16 pb-24 relative z-10">

        <div className="text-center mb-12">
          <Link href="/" className="text-sm font-bold text-white/20 hover:text-white/40 transition tracking-wider">
            TIP<span className="text-[#4AFFD4]/40">TASK</span>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#4AFFD4]/10 border-2 border-[#4AFFD4]/20 flex items-center justify-center mx-auto mb-5 text-2xl font-bold text-[#4AFFD4]">
            {creator.display_name[0].toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{creator.display_name}</h1>
          <p className="text-white/30 text-sm">@{creator.username}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            {isLive ? (
              <div className="flex items-center gap-2 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-4 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4AFFD4]"></span>
                </span>
                <span className="text-[#4AFFD4] text-xs font-semibold">Live now</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] px-4 py-1.5 rounded-full">
                <span className="h-2 w-2 rounded-full bg-white/15"></span>
                <span className="text-white/30 text-xs">Offline</span>
              </div>
            )}
          </div>
        </div>

        {(creator as any).bio && (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl px-6 py-5 mb-5 text-center">
            <p className="text-white/60 text-sm leading-relaxed">{(creator as any).bio}</p>
          </div>
        )}

        {socials.length > 0 && (
          <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
            {socials.map(([key, cfg]) => {
              const handle = (creator as any)[key] as string
              const url = key === 'website' ? handle : cfg.base + handle.replace('@', '')
              return (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-2 bg-[#111117] border border-white/[0.06] px-4 py-2.5 rounded-xl text-sm text-white/40 ${cfg.color} hover:border-white/10 transition`}>
                  <span>{cfg.icon}</span>
                  <span className="capitalize">{key === 'website' ? 'Website' : handle.replace('@', '')}</span>
                </a>
              )
            })}
          </div>
        )}

        {isLive ? (
          <div className="space-y-3">
            <Link href={`/tip/${creator.username}`}
              className="block w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-bold text-lg text-center hover:bg-[#6FFFDF] transition active:scale-[0.98]">
              💸 Send a tip or request
            </Link>
            <p className="text-center text-white/20 text-xs">
              {creator.display_name} is live — your payment is held until they accept
            </p>
          </div>
        ) : (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl px-6 py-5 text-center">
            <p className="text-white/40 text-sm">Not live right now</p>
            <p className="text-white/20 text-xs mt-1">Come back when {creator.display_name} goes live</p>
          </div>
        )}

        <div className="text-center mt-12">
          <p className="text-white/10 text-xs">
            Powered by <Link href="/" className="text-white/20 hover:text-white/40 transition">TipTask</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
