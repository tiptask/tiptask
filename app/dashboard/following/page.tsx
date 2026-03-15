'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

export default function FollowingPage() {
  const router = useRouter()
  const [follows, setFollows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('follows')
        .select('*, users!follows_following_id_fkey(id,username,display_name,is_live,accepts_tips)')
        .eq('follower_id', user.id).order('created_at', { ascending: false })
      setFollows(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function unfollow(followingId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', followingId)
    setFollows(prev => prev.filter(f => f.following_id !== followingId))
  }

  async function toggleNotify(id: string, current: boolean) {
    await supabase.from('follows').update({ notify_on_session_start: !current }).eq('id', id)
    setFollows(prev => prev.map(f => f.id === id ? { ...f, notify_on_session_start: !current } : f))
  }

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6"><BackButton href="/dashboard" /><h1 className="text-2xl font-bold text-white">Following</h1></div>
          {follows.length === 0 ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
              <p className="text-white/40 text-sm">Not following anyone yet</p>
              <Link href="/discover" className="mt-3 inline-block text-[#4AFFD4] text-sm hover:text-[#6FFFDF] transition">Discover creators →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {follows.map(f => {
                const u = f.users
                return (
                  <div key={f.id} className="bg-[#111117] border border-white/[0.06] rounded-2xl px-4 py-4">
                    <div className="flex items-center justify-between">
                      <Link href={`/${u?.username}`} className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center text-sm font-bold text-[#4AFFD4]">{u?.display_name?.[0]}</div>
                          {u?.is_live && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#4AFFD4] rounded-full border-2 border-[#08080C]" />}
                        </div>
                        <div className="min-w-0"><p className="text-white font-semibold text-sm">{u?.display_name}</p><p className="text-white/30 text-xs">@{u?.username} {u?.is_live ? '· 🔴 Live' : ''}</p></div>
                      </Link>
                      <button onClick={() => unfollow(f.following_id)} className="text-white/20 hover:text-red-400 transition text-xs shrink-0 ml-3">Unfollow</button>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                      <span className="text-white/30 text-xs">Notify when session starts</span>
                      <button onClick={() => toggleNotify(f.id, f.notify_on_session_start)}
                        className={`w-10 h-5 rounded-full transition-colors ${f.notify_on_session_start ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${f.notify_on_session_start ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
