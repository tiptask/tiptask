'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
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
  const [allTimeTips, setAllTimeTips] = useState<any[]>([])
  const userIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const loadTips = useCallback(async (uid: string, f: string, s: any) => {
    let q = supabase.from('tips').select('*').eq('receiver_id', uid).eq('status', 'completed').order('created_at', { ascending: false })
    if (f === 'today') { const t = new Date(); t.setHours(0,0,0,0); q = q.gte('created_at', t.toISOString()) }
    else if (f === 'session') { if (!s) { setTips([]); return }; q = q.eq('session_id', s.id) }
    const { data } = await q.limit(50)
    setTips(data || [])
  }, [])

  const loadAllTime = useCallback(async (uid: string) => {
    const { data } = await supabase.from('tips').select('amount,platform_fee,created_at').eq('receiver_id', uid).eq('status', 'completed')
    setAllTimeTips(data || [])
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      userIdRef.current = user.id
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      setProfile(p)
      const { data: s } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).single()
      setSession(s ?? null)
      sessionIdRef.current = s?.id ?? null
      await Promise.all([loadTips(user.id, 'session', s), loadAllTime(user.id)])
      setLoading(false)
    }
    load()
  }, [router, loadTips, loadAllTime])

  // Realtime + polling
  useEffect(() => {
    if (!userIdRef.current) return
    const uid = userIdRef.current
    const channel = supabase.channel(`tips-feed-${uid}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips', filter: `receiver_id=eq.${uid}` }, () => {
        loadTips(uid, filter, session)
        loadAllTime(uid)
      })
      .subscribe()
    const poll = setInterval(() => {
      loadTips(uid, filter, session)
      loadAllTime(uid)
    }, 5000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [filter, session, loadTips, loadAllTime])

  const currency = profile?.currency?.toUpperCase() ?? 'RON'

  // Helper: net received = amount - platform_fee
  const net = (t: any) => t.amount - (t.platform_fee ?? 0)

  // Current filter totals
  const filterTotal = tips.reduce((s, t) => s + t.amount, 0)
  const filterNet = tips.reduce((s, t) => s + net(t), 0)
  const filterHighest = tips.reduce((max, t) => t.amount > max ? t.amount : max, 0)

  // All time breakdowns
  const now = new Date()
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const weekTips = allTimeTips.filter(t => new Date(t.created_at) >= startOfWeek)
  const monthTips = allTimeTips.filter(t => new Date(t.created_at) >= startOfMonth)

  const weekNet = weekTips.reduce((s, t) => s + net(t), 0)
  const monthNet = monthTips.reduce((s, t) => s + net(t), 0)
  const totalNet = allTimeTips.reduce((s, t) => s + net(t), 0)

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-12"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-12 pb-20">
        <div className="max-w-xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-4">
            <BackButton href="/dashboard" />
            <h1 className="text-xl font-bold text-white">Tips received</h1>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#4AFFD4]" /></span>
              <span className="text-[#4AFFD4] text-xs">Live</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 mb-4">
            {([['session','Session'],['today','Today'],['all','All time']] as const).map(([k,l]) => (
              <button key={k} onClick={async () => { setFilter(k); if(userIdRef.current) await loadTips(userIdRef.current, k, session) }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${filter === k ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}>{l}</button>
            ))}
          </div>

          {/* Stats for current filter */}
          {filter !== 'all' && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3">
                <p className="text-white/30 text-xs mb-0.5">Tips</p>
                <p className="text-white font-bold text-xl">{tips.length}</p>
              </div>
              <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3">
                <p className="text-white/30 text-xs mb-0.5">Gross</p>
                <p className="text-amber-400 font-bold text-xl">{filterTotal.toFixed(0)}</p>
                <p className="text-white/20 text-xs">{currency}</p>
              </div>
              <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3">
                <p className="text-white/30 text-xs mb-0.5">You got</p>
                <p className="text-[#4AFFD4] font-bold text-xl">{filterNet.toFixed(0)}</p>
                <p className="text-white/20 text-xs">{currency} after fees</p>
              </div>
            </div>
          )}

          {/* All time breakdown */}
          {filter === 'all' && (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 mb-4">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Earnings after fees</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-sm">This week</span>
                  <div className="text-right">
                    <span className="text-[#4AFFD4] font-bold">{weekNet.toFixed(2)}</span>
                    <span className="text-white/25 text-xs ml-1.5">{currency} · {weekTips.length} tips</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-sm">This month</span>
                  <div className="text-right">
                    <span className="text-[#4AFFD4] font-bold">{monthNet.toFixed(2)}</span>
                    <span className="text-white/25 text-xs ml-1.5">{currency} · {monthTips.length} tips</span>
                  </div>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">All time</span>
                  <div className="text-right">
                    <span className="text-[#4AFFD4] font-black text-lg">{totalNet.toFixed(2)}</span>
                    <span className="text-white/25 text-xs ml-1.5">{currency} · {allTimeTips.length} tips</span>
                  </div>
                </div>
                <p className="text-white/15 text-xs">Gross: {allTimeTips.reduce((s,t) => s+t.amount,0).toFixed(2)} {currency} · Fees paid: {allTimeTips.reduce((s,t) => s+(t.platform_fee??0),0).toFixed(2)} {currency}</p>
              </div>
            </div>
          )}

          {/* Tips list */}
          {tips.length === 0 ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
              <p className="text-2xl mb-2">💸</p>
              <p className="text-white/40 text-sm">No tips {filter === 'session' ? 'this session' : filter === 'today' ? 'today' : 'yet'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={tip.id} className={`flex items-center justify-between px-3 py-3 rounded-xl border ${i === 0 && filter === 'session' ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-[#111117] border-white/[0.06]'}`}>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">{tip.sender_name} {i === 0 && filter === 'session' ? '🔥' : ''}</p>
                    {tip.message && <p className="text-white/35 text-xs italic truncate">"{tip.message}"</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-white/20 text-xs">{new Date(tip.created_at).toLocaleTimeString()}</p>
                      <p className="text-white/15 text-xs">fee: {(tip.platform_fee??0).toFixed(2)} · net: {net(tip).toFixed(2)} {currency}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-amber-400 font-bold">{tip.amount}</p>
                    <p className="text-[#4AFFD4] text-xs">+{net(tip).toFixed(2)}</p>
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
