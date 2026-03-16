'use client'
import React from 'react'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TopNav, BottomNav } from '@/components/nav'

const SOCIAL_CONFIG: Record<string, { label: string; icon: string; base: string }> = {
  instagram: { label: 'Instagram', icon: '📸', base: 'https://instagram.com/' },
  tiktok:    { label: 'TikTok',    icon: '🎵', base: 'https://tiktok.com/@' },
  youtube:   { label: 'YouTube',   icon: '▶️', base: 'https://youtube.com/@' },
  twitch:    { label: 'Twitch',    icon: '🟣', base: 'https://twitch.tv/' },
  website:   { label: 'Website',   icon: '🌐', base: '' },
}

const RESERVED = ['admin','api','auth','dashboard','discover','tip','overlay','ref','invite','fan']

export default function ProfilePage({ params: paramsPromise }: { params: Promise<{ username: string }> }) {
  const params = React.use(paramsPromise)
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (RESERVED.includes(params.username)) { router.replace('/' + params.username); return }
  }, [params.username, router])

  const loadSession = useCallback(async (userId: string) => {
    const { data: s } = await supabase.from('sessions').select('*').eq('user_id', userId).eq('is_active', true).single()
    setSession(s ?? null)
    if (s && s.use_landing_page === false) router.replace(`/tip/${params.username}`)
  }, [params.username, router])

  useEffect(() => {
    if (RESERVED.includes(params.username)) return
    if (typeof window !== 'undefined') localStorage.setItem('tiptask_ref', params.username)
    async function load() {
      const [{ data: profileData }, { data: { user } }] = await Promise.all([
        supabase.from('users').select('*').eq('username', params.username).single(),
        supabase.auth.getUser(),
      ])
      if (!profileData) { setLoading(false); return }
      setProfile(profileData)
      if (profileData.accepts_tips) await loadSession(profileData.id)
      if (user) {
        setCurrentUser(user)
        const { data: follow } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', profileData.id).single()
        setIsFollowing(!!follow)
      }
      setLoading(false)
    }
    load()
  }, [params.username, loadSession])

  // Realtime + polling for session updates
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase.channel(`profile-${profile.id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${profile.id}` },
        () => loadSession(profile.id))
      .subscribe()
    const poll = setInterval(() => loadSession(profile.id), 5000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [profile?.id, loadSession])

  async function handleFollow() {
    if (!currentUser) { router.push('/auth/login'); return }
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', profile.id)
      setIsFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profile.id, notify_on_session_start: true })
      setIsFollowing(true)
    }
    setFollowLoading(false)
  }

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-12"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  if (!profile) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-12">
        <div className="text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-white/40 text-sm mb-3">User not found</p>
          <Link href="/discover" className="text-[#4AFFD4] text-sm hover:text-[#6FFFDF] transition">← Browse creators</Link>
        </div>
      </main>
    </>
  )

  const isLive = !!session
  const acceptsTips = profile.accepts_tips
  const customLinks: { label: string; url: string }[] = profile.custom_links ?? []
  const isOwnProfile = currentUser?.id === profile.id

  const socialLinks = Object.entries(SOCIAL_CONFIG)
    .filter(([key]) => profile[key])
    .map(([key, cfg]) => {
      const handle = profile[key] as string
      const url = key === 'website' ? handle : cfg.base + handle.replace('@', '')
      const display = key === 'website' ? handle.replace(/https?:\/\//, '').split('/')[0] : handle.replace('@', '')
      return { key, label: cfg.label, icon: cfg.icon, url, display }
    })

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white pt-12 pb-20">
        <div className="max-w-sm mx-auto px-4 pt-7 pb-8">

          {/* Avatar + name */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-16 h-16 rounded-full bg-[#4AFFD4]/10 border-2 border-[#4AFFD4]/20 flex items-center justify-center mb-3 text-xl font-bold text-[#4AFFD4]">
              {profile.display_name[0].toUpperCase()}
            </div>
            <h1 className="text-lg font-bold text-white mb-0.5">{profile.display_name}</h1>
            <p className="text-white/30 text-xs mb-2.5">@{profile.username}</p>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              {acceptsTips && (
                isLive ? (
                  <div className="flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-2.5 py-0.5 rounded-full">
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-60" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4AFFD4]" /></span>
                    <span className="text-[#4AFFD4] text-xs font-semibold">Session active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.05] px-2.5 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                    <span className="text-white/25 text-xs">Tips open</span>
                  </div>
                )
              )}
              {currentUser && !isOwnProfile && (
                <button onClick={handleFollow} disabled={followLoading}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition border disabled:opacity-50 ${
                    isFollowing ? 'bg-white/[0.06] border-white/[0.10] text-white/50 hover:border-red-500/30 hover:text-red-400'
                    : 'bg-[#4AFFD4]/[0.08] border-[#4AFFD4]/20 text-[#4AFFD4] hover:bg-[#4AFFD4]/[0.14]'
                  }`}>
                  {isFollowing ? '✓ Following' : '+ Follow'}
                </button>
              )}
              {isOwnProfile && (
                <Link href="/dashboard/profile" className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-white/[0.06] border-white/[0.08] text-white/40 hover:text-white/70 transition">
                  Edit profile
                </Link>
              )}
            </div>
          </div>

          {profile.bio && <p className="text-white/40 text-xs text-center leading-relaxed mb-4 px-2">{profile.bio}</p>}

          {acceptsTips && (
            <Link href={`/tip/${profile.username}`}
              className="flex items-center justify-center gap-2 w-full bg-[#4AFFD4] text-[#08080C] py-3.5 rounded-2xl font-extrabold text-sm mb-3 hover:bg-[#6FFFDF] transition active:scale-[0.98]">
              {isLive ? '💸 Send a tip or request' : '💸 Send a tip'}
            </Link>
          )}

          {socialLinks.length > 0 && (
            <div className="flex flex-col gap-2 mb-2">
              {socialLinks.map(link => (
                <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 w-full bg-[#111117] border border-white/[0.06] hover:border-white/[0.10] px-4 py-3 rounded-xl transition group">
                  <span className="text-lg w-6 text-center shrink-0">{link.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-semibold text-xs group-hover:text-white transition">{link.label}</p>
                    <p className="text-white/25 text-xs truncate">{link.display}</p>
                  </div>
                  <span className="text-white/15 group-hover:text-white/30 transition text-xs">↗</span>
                </a>
              ))}
            </div>
          )}

          {customLinks.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {customLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 w-full bg-[#111117] border border-white/[0.06] hover:border-white/[0.10] px-4 py-3 rounded-xl transition group">
                  <span className="text-lg w-6 text-center shrink-0">🔗</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-semibold text-xs group-hover:text-white transition">{link.label}</p>
                    <p className="text-white/25 text-xs truncate">{link.url.replace(/https?:\/\//, '')}</p>
                  </div>
                  <span className="text-white/15 group-hover:text-white/30 transition text-xs">↗</span>
                </a>
              ))}
            </div>
          )}

          {!currentUser && (
            <div className="bg-[#111117] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center justify-between mt-1">
              <div>
                <p className="text-white/60 text-xs font-medium">New to TipTask?</p>
                <p className="text-white/25 text-xs mt-0.5">Join free — follow, track history</p>
              </div>
              <Link href={`/auth/register?ref=${profile.username}`}
                className="shrink-0 bg-white/[0.07] hover:bg-white/[0.10] border border-white/[0.08] text-white/60 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                Join →
              </Link>
            </div>
          )}

          <div className="text-center mt-6">
            <p className="text-white/10 text-xs">Powered by <Link href="/" className="text-white/20 hover:text-white/30 transition">TipTask</Link></p>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
