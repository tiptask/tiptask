'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

export default function RequestsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [pending, setPending] = useState<any[]>([])
  const [accepted, setAccepted] = useState<any[]>([])
  const [done, setDone] = useState<any[]>([])
  const [recentTips, setRecentTips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)
  const [extendConfirm, setExtendConfirm] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const sessionIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const loadRequests = useCallback(async (sid: string) => {
    const { data } = await supabase.from('task_requests').select('*, tasks(title)').eq('session_id', sid).order('created_at', { ascending: false })
    if (data) {
      const now = Date.now()
      const activeAccepted = data.filter(r => r.status === 'accepted' && (!r.expires_at || new Date(r.expires_at).getTime() > now))
      const expiredAccepted = data.filter(r => r.status === 'accepted' && r.expires_at && new Date(r.expires_at).getTime() <= now)
      setPending(data.filter(r => r.status === 'pending'))
      setAccepted(activeAccepted)
      setDone([...expiredAccepted.map(r => ({ ...r, _display_status: 'expired' })), ...data.filter(r => ['completed','declined','refunded'].includes(r.status))])
    }
  }, [])

  const loadTips = useCallback(async (sid: string, uid: string) => {
    const { data } = await supabase.from('tips').select('*').eq('receiver_id', uid).eq('session_id', sid).eq('status', 'completed').order('created_at', { ascending: false }).limit(30)
    setRecentTips(data || [])
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id); userIdRef.current = user.id
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      setProfile(p)
      const { data: s } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).single()
      setSession(s ?? null)
      if (s) {
        setSessionId(s.id); sessionIdRef.current = s.id
        await Promise.all([loadRequests(s.id), loadTips(s.id, user.id)])
      }
      setLoading(false)
    }
    load()
  }, [router, loadRequests, loadTips])

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`requests-${userId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests', filter: `receiver_id=eq.${userId}` },
        () => { if (sessionIdRef.current) loadRequests(sessionIdRef.current) })
      .subscribe()
    const tipsChannel = supabase.channel(`tips-live-${userId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips', filter: `receiver_id=eq.${userId}` },
        () => { if (sessionIdRef.current && userIdRef.current) loadTips(sessionIdRef.current, userIdRef.current) })
      .subscribe()
    const poll = setInterval(() => {
      if (sessionIdRef.current) {
        loadRequests(sessionIdRef.current)
        if (userIdRef.current) loadTips(sessionIdRef.current, userIdRef.current)
      }
    }, 4000)
    return () => { supabase.removeChannel(channel); supabase.removeChannel(tipsChannel); clearInterval(poll) }
  }, [userId, loadRequests, loadTips])

  async function respond(id: string, action: 'accept' | 'decline') {
    setActing(id); setActError(null)
    try {
      const res = await fetch('/api/payments/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_request_id: id, action }) })
      const data = await res.json()
      if (!res.ok) { setActError(data.error || 'Failed'); setActing(null); return }
      if (sessionIdRef.current) await loadRequests(sessionIdRef.current)
    } catch (err: any) { setActError(err.message) }
    setActing(null)
  }

  async function complete(id: string) {
    setActing(id); setActError(null)
    try {
      const res = await fetch('/api/payments/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_request_id: id }) })
      const data = await res.json()
      if (!res.ok) { setActError(data.error || 'Failed'); setActing(null); return }
      if (sessionIdRef.current) await loadRequests(sessionIdRef.current)
    } catch (err: any) { setActError(err.message) }
    setActing(null)
  }

  async function extend(id: string) {
    setActing(id)
    try {
      await fetch('/api/payments/extend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_request_id: id }) })
      if (sessionIdRef.current) await loadRequests(sessionIdRef.current)
    } catch (err: any) { setActError(err.message) }
    setActing(null); setExtendConfirm(null)
  }

  function formatExpiry(expiresAt: string | null) {
    void tick
    if (!expiresAt) return null
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const mins = Math.floor(diff / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const currency = profile?.currency?.toUpperCase() ?? 'RON'
  const commissionRate = profile?.custom_commission_rate ?? 0.15
  const tipsTotalThisSession = recentTips.reduce((s, t) => s + t.amount, 0)
  const tipsFeesThisSession = recentTips.reduce((s, t) => s + (t.platform_fee ?? 0), 0)
  const tipsNetThisSession = tipsTotalThisSession - tipsFeesThisSession

  const Card = ({ req, showActions }: { req: any, showActions: boolean }) => {
    const isCustom = !!req.custom_task_text
    const label = req.tasks?.title || req.custom_task_text || 'Request'
    const expiry = formatExpiry(req.expires_at)
    const isExpiringSoon = req.expires_at && new Date(req.expires_at).getTime() - Date.now() < 3 * 60 * 1000 && new Date(req.expires_at).getTime() > Date.now()
    const creatorReceives = +(req.amount - (req.platform_fee ?? req.amount * commissionRate)).toFixed(2)
    const displayStatus = req._display_status || req.status

    return (
      <div className={`rounded-xl border p-3 transition ${showActions ? 'border-[#4AFFD4]/20 bg-[#4AFFD4]/[0.03]' : displayStatus === 'expired' ? 'border-red-500/20 bg-red-500/[0.03] opacity-70' : 'border-white/[0.06] bg-[#111117]'}`}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">{isCustom ? '✏️' : '🎯'}</span>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm truncate">{label}</p>
              <p className="text-white/40 text-xs">by {req.sender_name}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white font-bold text-sm">{req.amount} {currency}</p>
            <p className="text-[#4AFFD4] text-xs">→ {creatorReceives} {currency}</p>
            {expiry && <p className={`text-xs font-medium ${isExpiringSoon ? 'text-red-400' : expiry === 'Expired' ? 'text-red-500' : 'text-white/25'}`}>⏱ {expiry}</p>}
          </div>
        </div>
        {req.message && <p className="text-white/35 text-xs italic mb-2">"{req.message}"</p>}
        <p className="text-white/15 text-xs mb-2">Platform fee: {(req.platform_fee ?? req.amount * commissionRate).toFixed(2)} {currency} ({Math.round(commissionRate * 100)}%)</p>
        {showActions && (
          <div className="flex gap-1.5 mt-2">
            <button onClick={() => respond(req.id, 'accept')} disabled={acting === req.id} className="flex-1 bg-[#4AFFD4] text-[#08080C] py-2 rounded-lg text-xs font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">{acting === req.id ? '...' : 'Accept'}</button>
            <button onClick={() => respond(req.id, 'decline')} disabled={acting === req.id} className="flex-1 border border-red-500/20 text-red-400 py-2 rounded-lg text-xs hover:bg-red-500/[0.06] transition disabled:opacity-50">Decline</button>
          </div>
        )}
        {!showActions && req.status === 'accepted' && displayStatus !== 'expired' && (
          <div className="mt-2 space-y-1.5">
            <button onClick={() => complete(req.id)} disabled={acting === req.id} className="w-full bg-[#4AFFD4] text-[#08080C] py-2 rounded-lg text-xs font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">{acting === req.id ? 'Processing...' : '✓ Mark as done'}</button>
            {extendConfirm === req.id ? (
              <div className="flex gap-1.5">
                <button onClick={() => extend(req.id)} disabled={acting === req.id} className="flex-1 bg-white/[0.07] text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-white/[0.10] transition disabled:opacity-50">+5 min confirm</button>
                <button onClick={() => setExtendConfirm(null)} className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-white/30 text-xs hover:text-white/60 transition">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setExtendConfirm(req.id)} className="w-full border border-white/[0.06] text-white/30 py-1.5 rounded-lg text-xs hover:text-white/60 hover:border-white/[0.10] transition">⏱ Extend +5 min</button>
            )}
          </div>
        )}
        {displayStatus === 'expired' && (
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => complete(req.id)} disabled={acting === req.id} className="flex-1 bg-white/[0.06] text-white/60 py-2 rounded-lg text-xs font-semibold hover:bg-white/[0.10] transition disabled:opacity-50">{acting === req.id ? '...' : '✓ Complete anyway'}</button>
            <button onClick={() => respond(req.id, 'decline')} disabled={acting === req.id} className="flex-1 border border-red-500/20 text-red-400/60 py-2 rounded-lg text-xs hover:bg-red-500/[0.06] transition disabled:opacity-50">Decline</button>
          </div>
        )}
      </div>
    )
  }

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-12"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-12 pb-20">
        <div className="max-w-xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-4">
            <BackButton href="/dashboard" />
            <h1 className="text-xl font-bold text-white">Live Session</h1>
            {session && <div className="ml-auto flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-2.5 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" /><span className="text-[#4AFFD4] text-xs font-semibold">Live</span></div>}
          </div>

          {actError && <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 mb-4"><p className="text-red-400 text-sm">{actError}</p></div>}

          {!session ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
              <p className="text-white/40 text-sm">No active session</p>
              <button onClick={() => router.push('/dashboard/live')} className="mt-3 bg-[#4AFFD4] text-[#08080C] px-5 py-2 rounded-xl font-bold text-sm hover:bg-[#6FFFDF] transition">Start session →</button>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Tips this session */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest">💸 Tips this session</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-white/25 text-xs">{recentTips.length} tips</span>
                    <span className="text-amber-400 text-xs font-bold">{tipsTotalThisSession.toFixed(0)} {currency}</span>
                  </div>
                </div>
                {recentTips.length === 0 ? (
                  <p className="text-white/20 text-xs">No tips yet this session</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentTips.map((tip, i) => (
                      <div key={tip.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${i === 0 ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-[#111117] border-white/[0.04]'}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white text-sm font-medium">{tip.sender_name}</span>
                            {i === 0 && <span className="text-amber-400 text-xs">🔥</span>}
                          </div>
                          {tip.message && <p className="text-white/35 text-xs italic truncate">"{tip.message}"</p>}
                          <p className="text-white/15 text-xs">→ {(tip.amount - tip.platform_fee).toFixed(2)} {currency} · fee: {tip.platform_fee} {currency}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-amber-400 font-bold text-sm">{tip.amount}</p>
                          <p className="text-white/25 text-xs">{currency}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending requests */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest">🎯 Pending requests</h2>
                  {pending.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full font-bold">{pending.length}</span>}
                </div>
                {pending.length === 0 ? <p className="text-white/20 text-xs">No pending requests</p> :
                  <div className="space-y-2">{pending.map(r => <Card key={r.id} req={r} showActions={true} />)}</div>}
              </div>

              {/* In progress */}
              {accepted.length > 0 && (
                <div>
                  <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">⏳ In Progress · {accepted.length}</h2>
                  <div className="space-y-2">{accepted.map(r => <Card key={r.id} req={r} showActions={false} />)}</div>
                </div>
              )}

              {/* Done */}
              {done.length > 0 && (
                <div>
                  <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">✅ Done / Expired</h2>
                  <div className="space-y-1.5">
                    {done.map(r => {
                      const displayStatus = r._display_status || r.status
                      if (displayStatus === 'expired') return <Card key={r.id} req={r} showActions={false} />
                      return (
                        <div key={r.id} className="flex items-center justify-between px-3 py-2.5 bg-[#111117] border border-white/[0.04] rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">{r.custom_task_text ? '✏️' : '🎯'}</span>
                            <div className="min-w-0">
                              <span className="text-white/40 text-xs truncate">{r.tasks?.title || r.custom_task_text}</span>
                              <span className="text-white/20 text-xs ml-1.5">by {r.sender_name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-white/50 text-xs">{r.amount} {currency}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-[#4AFFD4]/10 text-[#4AFFD4]' : r.status === 'declined' ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.06] text-white/30'}`}>{r.status}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
