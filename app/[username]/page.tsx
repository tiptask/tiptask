'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Creator, Session } from '@/types'

const SOCIAL_CONFIG: Record<string, { label: string; icon: string; base: string }> = {
  instagram: { label: 'Instagram', icon: '📸', base: 'https://instagram.com/' },
  tiktok:    { label: 'TikTok',    icon: '🎵', base: 'https://tiktok.com/@' },
  youtube:   { label: 'YouTube',   icon: '▶️', base: 'https://youtube.com/@' },
  twitch:    { label: 'Twitch',    icon: '🟣', base: 'https://twitch.tv/' },
  website:   { label: 'Website',   icon: '🌐', base: '' },
}

export default function ProfilePage({ params: paramsPromise }: { params: Promise<{ username: string }> }) {
  const params = React.use(paramsPromise)
  const router = useRouter()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Store referral code so it persists to register even if user navigates away
    if (typeof window !== 'undefined') {
      localStorage.setItem('tiptask_ref', params.username)
    }
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

  const c = creator as any
  const isLive = !!session
  const customLinks: { label: string; url: string }[] = c.custom_links ?? []

  // Build social links list
  const socialLinks = Object.entries(SOCIAL_CONFIG)
    .filter(([key]) => c[key])
    .map(([key, cfg]) => {
      const handle = c[key] as string
      const url = key === 'website' ? handle : cfg.base + handle.replace('@', '')
      const display = key === 'website' ? (handle.replace(/https?:\/\//, '').split('/')[0]) : handle.replace('@', '')
      return { key, label: cfg.label, icon: cfg.icon, url, display }
    })

  return (
    <main className="min-h-screen bg-[#08080C] text-white relative overflow-hidden">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[#4AFFD4] opacity-[0.025] blur-[120px] pointer-events-none" />

      <div className="max-w-sm mx-auto px-5 pt-12 pb-20 relative z-10">

        {/* TipTask wordmark */}
        <div className="text-center mb-10">
          <Link href="/" className="text-xs font-bold text-white/15 hover:text-white/30 transition tracking-widest">
            TIP<span className="text-[#4AFFD4]/30">TASK</span>
          </Link>
        </div>

        {/* Avatar + name + live badge */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#4AFFD4]/10 border-2 border-[#4AFFD4]/20 flex items-center justify-center mb-4 text-2xl font-bold text-[#4AFFD4]">
            {creator.display_name[0].toUpperCase()}
          </div>
          <h1 className="text-xl font-bold text-white mb-0.5">{creator.display_name}</h1>
          <p className="text-white/30 text-sm mb-3">@{creator.username}</p>
          {isLive ? (
            <div className="flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-3 py-1 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4AFFD4]" />
              </span>
              <span className="text-[#4AFFD4] text-xs font-semibold">Live now</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.05] px-3 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
              <span className="text-white/25 text-xs">Offline</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {c.bio && (
          <p className="text-white/40 text-sm text-center leading-relaxed mb-7 px-2">{c.bio}</p>
        )}

        {/* CTA — tip button. Passes referral code so new signups are attributed to this creator */}
        {isLive && (
          <Link href={`/tip/${creator.username}?ref=${creator.username}`}
            className="flex items-center justify-center gap-2 w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-extrabold text-base mb-4 hover:bg-[#6FFFDF] transition active:scale-[0.98]">
            💸 Send a tip or request
          </Link>
        )}

        {/* Social links — linktree style */}
        {socialLinks.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-2.5">
            {socialLinks.map(link => (
              <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 w-full bg-[#111117] border border-white/[0.06] hover:border-white/[0.10] hover:bg-[#16161e] px-5 py-3.5 rounded-2xl transition group">
                <span className="text-xl w-7 text-center shrink-0">{link.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 font-semibold text-sm group-hover:text-white transition">{link.label}</p>
                  <p className="text-white/25 text-xs truncate">{link.display}</p>
                </div>
                <span className="text-white/15 group-hover:text-white/30 transition text-sm">↗</span>
              </a>
            ))}
          </div>
        )}

        {/* Custom links */}
        {customLinks.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-2.5">
            {customLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 w-full bg-[#111117] border border-white/[0.06] hover:border-white/[0.10] hover:bg-[#16161e] px-5 py-3.5 rounded-2xl transition group">
                <span className="text-xl w-7 text-center shrink-0">🔗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 font-semibold text-sm group-hover:text-white transition">{link.label}</p>
                  <p className="text-white/25 text-xs truncate">{link.url.replace(/https?:\/\//, '')}</p>
                </div>
                <span className="text-white/15 group-hover:text-white/30 transition text-sm">↗</span>
              </a>
            ))}
          </div>
        )}

        {/* Offline state */}
        {!isLive && (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl px-6 py-5 text-center mt-3">
            <p className="text-white/40 text-sm">Not live right now</p>
            <p className="text-white/20 text-xs mt-1">Come back when {creator.display_name} goes live</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-white/10 text-xs">
            Powered by <Link href="/" className="text-white/20 hover:text-white/30 transition">TipTask</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
