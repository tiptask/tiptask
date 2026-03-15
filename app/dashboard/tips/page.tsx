'use client'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      setProfile(p)
      const { data: s } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).single()
      setSession(s ?? null)
      await loadTips(user.id, 'session', s)
      setLoading(false)
      const channel = supabase.channel('tips-' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tips', filter: `receiver_id=eq.${user.id}` }, async () => { await loadTips(user.id, filter, s) })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [router])

  async function loadTips(uid: string, f: string, s: any) {
    let q = supabase.from('tips').select('*').eq('receiver_id', uid).eq('status', 'completed').order('created_at', { ascending: false })
    if (f === 'today') { const t = new Date(); t.setHours(0,0,0,0); q = q.gte('created_at', t.toISOString()) }
    else if (f === 'session') { if (!s) { setTips([]); return }; q = q.eq('session_id', s.id) }
    const { data } = await q.limit(50)
    setTips(data || [])
  }

  const currency = profile?.currency?.toUpperCase() ?? 'RON'
  const total = tips.reduce((s, t) => s + t.amount, 0)
  const highest = tips.reduce((max, t) => t.amount > max ? t.amount : max, 0)

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6"><BackButton href="/dashboard" /><h1 className="text-2xl font-bold text-white">Tips received</h1></div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4"><p className="text-white/30 text-xs mb-1">Count</p><p className="text-white font-bold text-2xl">{tips.length}</p></div>
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4"><p className="text-white/30 text-xs mb-1">Total</p><p className="text-amber-400 font-bold text-2xl">{total.toFixed(0)}</p><p className="text-white/20 text-xs">{currency}</p></div>
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4"><p className="text-white/30 text-xs mb-1">Highest</p><p className="text-[#4AFFD4] font-bold text-2xl">{highest.toFixed(0)}</p><p className="text-white/20 text-xs">{currency}</p></div>
          </div>
          <div className="flex gap-2 mb-5">
            {([['session','This session'],['today','Today'],['all','All time']] as const).map(([k,l]) => (
              <button key={k} onClick={async () => { setFilter(k); if(profile) await loadTips(profile.id, k, session) }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${filter === k ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}>{l}</button>
            ))}
          </div>
          {tips.length === 0 ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center"><p className="text-3xl mb-3">💸</p><p className="text-white/40 text-sm">No tips yet</p></div>
          ) : (
            <div className="space-y-2">
              {tips.map((tip, i) => (
                <div key={tip.id} className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border ${i === 0 && filter === 'session' ? 'bg-amber-500/[0.07] border-amber-500/20' : 'bg-[#111117] border-white/[0.06]'}`}>
                  <div className="min-w-0"><p className="text-white font-semibold text-sm">{tip.sender_name} {i === 0 && filter === 'session' ? '🔥' : ''}</p>{tip.message && <p className="text-white/35 text-xs italic truncate">"{tip.message}"</p>}<p className="text-white/20 text-xs">{new Date(tip.created_at).toLocaleTimeString()}</p></div>
                  <div className="text-right shrink-0 ml-3"><p className="text-amber-400 font-bold text-lg">{tip.amount}</p><p className="text-white/25 text-xs">{currency}</p></div>
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
