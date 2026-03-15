'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SessionsPage() {
  const router = useRouter()
  const [creator, setCreator] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [sessionTips, setSessionTips] = useState<any[]>([])
  const [sessionRequests, setSessionRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: c } = await supabase.from('creators').select('*').eq('id', user.id).single()
      if (!c) { router.push('/auth/login'); return }
      setCreator(c)

      const { data: s } = await supabase
        .from('sessions').select('*')
        .eq('creator_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20)
      setSessions(s || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function selectSession(s: any) {
    setSelected(s)
    setDetailLoading(true)

    const [{ data: tips }, { data: requests }] = await Promise.all([
      supabase.from('tips').select('*')
        .eq('session_id', s.id).eq('status', 'completed')
        .order('created_at', { ascending: false }),
      supabase.from('task_requests').select('*, tasks(*)')
        .eq('session_id', s.id)
        .or('task_id.not.is.null,custom_task_text.not.is.null')
        .order('created_at', { ascending: false }),
    ])

    setSessionTips(tips || [])
    setSessionRequests(requests || [])
    setDetailLoading(false)
  }

  function duration(s: any) {
    if (!s.started_at) return '—'
    const start = new Date(s.started_at)
    const end = s.ended_at ? new Date(s.ended_at) : new Date()
    const mins = Math.round((end.getTime() - start.getTime()) / 60000)
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const currency = creator?.currency?.toUpperCase() ?? 'RON'

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  // Detail view
  if (selected) {
    const tipTotal = sessionTips.reduce((s, t) => s + t.amount, 0)
    const reqTotal = sessionRequests.filter(r => r.status === 'completed').reduce((s, r) => s + r.amount, 0)
    const highestTip = sessionTips.reduce((max, t) => t.amount > max ? t.amount : max, 0)
    const uniqueTippers = new Set([
      ...sessionTips.map(t => t.tipper_name),
      ...sessionRequests.map(r => r.requester_name),
    ]).size

    return (
      <main className="min-h-screen bg-[#08080C] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/60 transition text-sm">← Sessions</button>
            <div>
              <h1 className="text-xl font-bold text-white">Session stats</h1>
              <p className="text-white/30 text-xs">{formatTime(selected.started_at)} · {duration(selected)}</p>
            </div>
            {selected.is_active && (
              <div className="ml-auto flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" />
                <span className="text-[#4AFFD4] text-xs font-semibold">Live</span>
              </div>
            )}
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#0F1A17] border border-[#4AFFD4]/15 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span>💸</span>
                    <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Tips</p>
                  </div>
                  <p className="text-amber-400 font-black text-2xl">{tipTotal.toFixed(0)}</p>
                  <p className="text-white/20 text-xs">{currency} · {sessionTips.length} tips</p>
                </div>
                <div className="bg-[#0F0F1A] border border-[#4AFFD4]/15 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span>🎯</span>
                    <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Requests</p>
                  </div>
                  <p className="text-[#4AFFD4] font-black text-2xl">{reqTotal.toFixed(0)}</p>
                  <p className="text-white/20 text-xs">{currency} · {sessionRequests.filter(r => r.status === 'completed').length} done</p>
                </div>
                <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4">
                  <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-2">Total earned</p>
                  <p className="text-white font-black text-2xl">{(tipTotal + reqTotal).toFixed(0)}</p>
                  <p className="text-white/20 text-xs">{currency}</p>
                </div>
                <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4">
                  <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-2">Unique tippers</p>
                  <p className="text-white font-black text-2xl">{uniqueTippers}</p>
                  {highestTip > 0 && <p className="text-white/20 text-xs">Top: {highestTip} {currency}</p>}
                </div>
              </div>

              {/* Tips */}
              {sessionTips.length > 0 && (
                <div className="mb-5">
                  <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Tips ({sessionTips.length})</h2>
                  <div className="space-y-2">
                    {sessionTips.map((t, i) => (
                      <div key={t.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                        i === 0 ? 'bg-amber-500/[0.07] border-amber-500/20' : 'bg-[#111117] border-white/[0.06]'
                      }`}>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium">{t.tipper_name} {i === 0 ? '🔥' : ''}</p>
                          {t.message && <p className="text-white/30 text-xs italic truncate">"{t.message}"</p>}
                          <p className="text-white/20 text-xs">{formatTime(t.created_at)}</p>
                        </div>
                        <p className="text-amber-400 font-bold shrink-0 ml-3">{t.amount} {currency}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Requests */}
              {sessionRequests.length > 0 && (
                <div>
                  <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Requests ({sessionRequests.length})</h2>
                  <div className="space-y-2">
                    {sessionRequests.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-[#111117] border border-white/[0.06] rounded-xl">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{r.tasks?.title || r.custom_task_text}</p>
                          <p className="text-white/30 text-xs">by {r.requester_name}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-[#4AFFD4] font-bold">{r.amount} {currency}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            r.status === 'completed' ? 'bg-[#4AFFD4]/10 text-[#4AFFD4]' :
                            r.status === 'accepted' ? 'bg-blue-500/10 text-blue-400' :
                            r.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sessionTips.length === 0 && sessionRequests.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-white/20 text-sm">No activity in this session</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    )
  }

  // Sessions list
  return (
    <main className="min-h-screen bg-[#08080C] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
            <p className="text-white/40 text-sm">No sessions yet</p>
            <p className="text-white/20 text-xs mt-1">Start your first session to see stats here</p>
            <button onClick={() => router.push('/dashboard/live')}
              className="mt-4 bg-[#4AFFD4] text-[#08080C] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#6FFFDF] transition">
              Start session →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => {
              const total = (s.total_tips_amount || 0) + (s.total_requests_amount || 0)
              return (
                <button key={s.id} onClick={() => selectSession(s)}
                  className="w-full bg-[#111117] border border-white/[0.06] hover:border-white/[0.10] rounded-2xl p-4 text-left transition">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {s.is_active ? (
                        <div className="flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" />
                          <span className="text-[#4AFFD4] text-xs font-semibold">Live</span>
                        </div>
                      ) : (
                        <span className="text-white/20 text-xs">{formatTime(s.started_at)}</span>
                      )}
                      <span className="text-white/15 text-xs">· {duration(s)}</span>
                    </div>
                    <span className="text-white font-bold">{total.toFixed(0)} {currency}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-amber-400/70 text-xs">💸 {s.total_tips_count || 0} tips · {(s.total_tips_amount || 0).toFixed(0)} {currency}</span>
                    <span className="text-[#4AFFD4]/70 text-xs">🎯 {s.total_requests_count || 0} requests · {(s.total_requests_amount || 0).toFixed(0)} {currency}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
