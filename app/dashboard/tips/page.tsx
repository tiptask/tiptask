'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function TipsPage() {
  const router = useRouter()
  const [creator, setCreator] = useState<any>(null)
  const [tips, setTips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'today' | 'session'>('session')
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: c } = await supabase.from('creators').select('*').eq('id', user.id).single()
      if (!c) { router.push('/auth/login'); return }
      setCreator(c)

      const { data: s } = await supabase.from('sessions').select('*')
        .eq('creator_id', user.id).eq('is_active', true).single()
      setSession(s ?? null)

      await loadTips(user.id, 'session', s)
      setLoading(false)

      // Realtime for new tips
      const channel = supabase.channel('tips-' + user.id)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'tips',
          filter: `creator_id=eq.${user.id}`,
        }, async () => { await loadTips(user.id, filter, s) })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'tips',
          filter: `creator_id=eq.${user.id}`,
        }, async () => { await loadTips(user.id, filter, s) })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [router])

  async function loadTips(creatorId: string, f: string, s: any) {
    let query = supabase.from('tips').select('*')
      .eq('creator_id', creatorId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (f === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    } else if (f === 'session' && s) {
      query = query.eq('session_id', s.id)
    } else if (f === 'session' && !s) {
      setTips([])
      return
    }

    const { data } = await query.limit(50)
    setTips(data || [])
  }

  async function changeFilter(f: 'all' | 'today' | 'session') {
    setFilter(f)
    if (creator) await loadTips(creator.id, f, session)
  }

  const currency = creator?.currency?.toUpperCase() ?? 'RON'
  const totalAmount = tips.reduce((sum, t) => sum + (t.amount || 0), 0)
  const highest = tips.reduce((max, t) => t.amount > max ? t.amount : max, 0)

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Tips</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-white/30 text-xs mb-1">Tips</p>
            <p className="text-white font-bold text-2xl">{tips.length}</p>
          </div>
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-white/30 text-xs mb-1">Total</p>
            <p className="text-[#4AFFD4] font-bold text-2xl">{totalAmount.toFixed(0)}</p>
            <p className="text-white/20 text-xs">{currency}</p>
          </div>
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-white/30 text-xs mb-1">Highest</p>
            <p className="text-amber-400 font-bold text-2xl">{highest.toFixed(0)}</p>
            <p className="text-white/20 text-xs">{currency}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'session', label: 'This session' },
            { key: 'today', label: 'Today' },
            { key: 'all', label: 'All time' },
          ].map(f => (
            <button key={f.key} onClick={() => changeFilter(f.key as any)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                filter === f.key
                  ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20'
                  : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.07]'
              }`}>{f.label}</button>
          ))}
        </div>

        {/* Tips list */}
        {tips.length === 0 ? (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
            <p className="text-3xl mb-3">💸</p>
            <p className="text-white/40 text-sm">No tips yet</p>
            <p className="text-white/20 text-xs mt-1">Tips appear here in real time</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tips.map((tip, i) => (
              <div key={tip.id}
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition ${
                  i === 0 && filter === 'session'
                    ? 'bg-amber-500/[0.07] border-amber-500/20'
                    : 'bg-[#111117] border-white/[0.06]'
                }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{i === 0 && filter === 'session' ? '🔥' : '💸'}</span>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm">{tip.tipper_name}</p>
                    {tip.message && (
                      <p className="text-white/35 text-xs italic truncate">"{tip.message}"</p>
                    )}
                    <p className="text-white/20 text-xs">{new Date(tip.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-amber-400 font-bold text-lg">{tip.amount}</p>
                  <p className="text-white/25 text-xs">{currency}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
