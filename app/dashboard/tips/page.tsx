'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

export default function TipsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [tips, setTips] = useState<any[]>([])
  const [session, setSession] = useState<any>(null)
  const [filter, setFilter] = useState<'session' | 'today' | 'all'>('session')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const loadTips = useCallback(async (uid: string, f: string, s: any) => {
    let q = supabase.from('tips').select('*').eq('receiver_id', uid).eq('status', 'completed').order('created_at', { ascending: false })
    if (f === 'today') { const t = new Date(); t.setHours(0,0,0,0); q = q.gte('created_at', t.toISOString()) }
    else if (f === 'session') { if (!s) { setTips([]); return }; q = q.eq('session_id', s.id) }
    const { data } = await q.limit(50)
    setTips(data || [])
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      setProfile(p)
      const { data: s } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).single()
      setSession(s ?? null)
      await loadTips(user.id, 'session', s)
      setLoading(false)
    }
    load()
  }, [router, loadTips])

  // Realtime
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`tips-feed-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips', filter: `receiver_id=eq.${userId}` },
        () => loadTips(userId, filter, session))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, filter, session, loadTips])

  const currency = profile?.currency?.toUpperCase() ?? 'RON'
  const total = tips.reduce((s, t) => s + t.amount, 0)
  const highest = tips.reduce((max, t) => t.amount > max ? t.amount : max, 0)

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-12"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-12 pb-20">
        <div className="max-w-xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-5"><BackButton href="/dashboard" /><h1 className="text-xl font-bold text-white">Tips received</h1>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#4AFFD4]" /></span>
              <span className="text-[#4AFFD4] text-xs">Live</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3"><p className="text-white/30 text-xs mb-0.5">Count</p><p className="text-white font-bold text-xl">{tips.length}</p></div>
            <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3"><p className="text-white/30 text-xs mb-0.5">Total</p><p className="text-amber-400 font-bold text-xl">{total.toFixed(0)}</p><p className="text-white/20 text-xs">{currency}</p></div>
            <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3"><p className="text-white/30 text-xs mb-0.5">Highest</p><p className="text-[#4AFFD4] font-bold text-xl">{highest.toFixed(0)}</p><p className="text-white/20 text-xs">{currency}</p></div>
          </div>
          <div className="flex gap-1.5 mb-4">
            {([['session','Session'],['today','Today'],['all','All time']] as const).map(([k,l]) => (
              <button key={k} onClick={async () => { setFilter(k); if(profile) await loadTips(profile.id, k, session) }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${filter === k ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}>{l}</button>
            ))}
          </div>
          {tips.length === 0 ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center"><p className="text-2xl mb-2">💸</p><p className="text-white/40 text-sm">No tips yet</p></div>
          ) : (
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={tip.id} className={`flex items-center justify-between px-3 py-3 rounded-xl border ${i === 0 && filter === 'session' ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-[#111117] border-white/[0.06]'}`}>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">{tip.sender_name} {i === 0 && filter === 'session' ? '🔥' : ''}</p>
                    {tip.message && <p className="text-white/35 text-xs italic truncate">"{tip.message}"</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-white/20 text-xs">{new Date(tip.created_at).toLocaleTimeString()}</p>
                      <p className="text-white/15 text-xs">fee: {tip.platform_fee} {currency}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-amber-400 font-bold">{tip.amount}</p>
                    <p className="text-white/25 text-xs">{currency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
