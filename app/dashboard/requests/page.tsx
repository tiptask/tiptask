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
  const [mobileTab, setMobileTab] = useState<'requests' | 'tips'>('requests')
  const sessionIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const loadRequests = useCallback(async (sid: string) => {
    const { data } = await supabase.from('task_requests').select('*, tasks(title)').eq('session_id', sid).order('created_at', { ascending: true })
    if (data) {
      const now = Date.now()
      const activePending = data.filter(r => r.status === 'pending' && (!r.expires_at || new Date(r.expires_at).getTime() > now))
      const expiredPending = data.filter(r => r.status === 'pending' && r.expires_at && new Date(r.expires_at).getTime() <= now)
      const activeAccepted = data.filter(r => r.status === 'accepted' && (!r.expires_at || new Date(r.expires_at).getTime() > now))
      const expiredAccepted = data.filter(r => r.status === 'accepted' && r.expires_at && new Date(r.expires_at).getTime() <= now)
      setPending(activePending.sort((a, b) => new Date(a.expires_at || 0).getTime() - new Date(b.expires_at || 0).getTime()))
      setAccepted(activeAccepted.sort((a, b) => new Date(a.expires_at || 0).getTime() - new Date(b.expires_at || 0).getTime()))
      setDone([
        ...expiredPending.map(r => ({ ...r, _display_status: 'expired_pending' })),
        ...expiredAccepted.map(r => ({ ...r, _display_status: 'expired' })),
        ...data.filter(r => ['completed', 'declined', 'refunded'].includes(r.status))
      ])
      if (expiredPending.length > 0) fetch('/api/payments/auto-decline', { method: 'POST' }).catch(() => {})
    }
  }, [])

  const loadTips = useCallback(async (sid: string, uid: string) => {
    const { data } = await supabase.from('tips').select('*').eq('receiver_id', uid).eq('session_id', sid).eq('status', 'completed').order('created_at', { ascending: false }).limit(50)
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
        fetch('/api/payments/auto-decline', { method: 'POST' }).catch(() => {})
        await Promise.all([loadRequests(s.id), loadTips(s.id, user.id)])
      }
      setLoading(false)
    }
    load()
  }, [router, loadRequests, loadTips])

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`req-${userId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests', filter: `receiver_id=eq.${userId}` },
        () => { if (sessionIdRef.current) loadRequests(sessionIdRef.current) })
      .subscribe()
    const tipsChannel = supabase.channel(`tips-live-${userId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips', filter: `receiver_id=eq.${userId}` },
        () => { if (sessionIdRef.current && userIdRef.current) loadTips(sessionIdRef.current, userIdRef.current) })
      .subscribe()
    const poll = setInterval(() => {
      if (sessionIdRef.current) {
        fetch('/api/payments/auto-decline', { method: 'POST' }).catch(() => {})
        loadRequests(sessionIdRef.current)
        if (userIdRef.current) loadTips(sessionIdRef.current, userIdRef.current)
      }
    }, 4000)
    return () => { supabase.removeChannel(channel); supabase.removeChannel(tipsChannel); clearInterval(poll) }
  }, [userId, loadRequests, loadTips])

  useEffect(() => {
    const now = Date.now()
    setPending(prev => {
      const expired = prev.filter(r => r.expires_at && new Date(r.expires_at).getTime() <= now)
      if (expired.length > 0) {
        setDone(d => [...expired.map(r => ({ ...r, _display_status: 'expired_pending' })), ...d])
        fetch('/api/payments/auto-decline', { method: 'POST' }).catch(() => {})
        return prev.filter(r => !r.expires_at || new Date(r.expires_at).getTime() > now)
      }
      return prev
    })
    setAccepted(prev => {
      const expired = prev.filter(r => r.expires_at && new Date(r.expires_at).getTime() <= now)
      if (expired.length > 0) {
        setDone(d => [...expired.map(r => ({ ...r, _display_status: 'expired' })), ...d])
        return prev.filter(r => !r.expires_at || new Date(r.expires_at).getTime() > now)
      }
      return prev
    })
  }, [tick])

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
    return { label: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`, urgent: diff < 3 * 60 * 1000 }
  }

  const currency = profile?.currency?.toUpperCase() ?? 'RON'
  const commissionRate = profile?.custom_commission_rate ?? 0.15
  const tipsTotalThisSession = recentTips.reduce((s, t) => s + t.amount, 0)
  const tipsFeesThisSession = recentTips.reduce((s, t) => s + (t.platform_fee ?? 0), 0)
  const tipsNetThisSession = tipsTotalThisSession - tipsFeesThisSession

  // Compact done row — no buttons, minimal info
  const DoneRow = ({ req }: { req: any }) => {
    const isCustom = !!req.custom_task_text
    const label = req.tasks?.title || req.custom_task_text || 'Request'
    const displayStatus = req._display_status || req.status

    let statusLabel = ''
    let statusColor = 'text-white/20'
    if (displayStatus === 'completed') { statusLabel = 'done'; statusColor = 'text-[#4AFFD4]/40' }
    else if (displayStatus === 'declined') { statusLabel = 'declined'; statusColor = 'text-red-400/40' }
    else if (displayStatus === 'refunded') { statusLabel = 'refunded'; statusColor = 'text-white/20' }
    else if (displayStatus === 'expired' || displayStatus === 'expired_pending') { statusLabel = 'expired'; statusColor = 'text-white/20' }

    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg opacity-50 hover:opacity-70 transition-opacity">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs shrink-0">{isCustom ? '✏️' : '🎯'}</span>
          <span className="text-white/40 text-xs truncate">{label}</span>
          <span className="text-white/20 text-xs shrink-0">by {req.sender_name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-white/25 text-xs">{req.amount} {currency}</span>
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>
    )
  }

  // Active request card — full with buttons
  const RequestCard = ({ req, showActions }: { req: any, showActions: boolean }) => {
    const isCustom = !!req.custom_task_text
    const label = req.tasks?.title || req.custom_task_text || 'Request'
    const expiry = formatExpiry(req.expires_at)
    const creatorReceives = +(req.amount - (req.platform_fee ?? req.amount * commissionRate)).toFixed(2)

    return (
      <div className={`rounded-xl border p-3 transition ${showActions ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-[#4AFFD4]/20 bg-[#4AFFD4]/[0.03]'}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm shrink-0">{isCustom ? '✏️' : '🎯'}</span>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm truncate">{label}</p>
              <p className="text-white/40 text-xs">by {req.sender_name}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white font-bold text-sm">{req.amount} {currency}</p>
            <p className="text-[#4AFFD4] text-xs">→ {creatorReceives} {currency}</p>
            {expiry && typeof expiry === 'object' && (
              <p className={`text-xs font-bold ${expiry.urgent ? 'text-red-400' : 'text-white/30'}`}>⏱ {expiry.label}</p>
            )}
          </div>
        </div>
        {req.message && <p className="text-white/35 text-xs italic mb-1.5">"{req.message}"</p>}
        <p className="text-white/15 text-xs mb-2">fee: {(req.platform_fee ?? req.amount * commissionRate).toFixed(2)} {currency} ({Math.round(commissionRate * 100)}%)</p>

        {showActions ? (
          <div className="flex gap-1.5">
            <button onClick={() => respond(req.id, 'accept')} disabled={acting === req.id}
              className="flex-1 bg-[#4AFFD4] text-[#08080C] py-2 rounded-lg text-xs font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
              {acting === req.id ? '...' : 'Accept'}
            </button>
            <button onClick={() => respond(req.id, 'decline')} disabled={acting === req.id}
              className="flex-1 border border-red-500/20 text-red-400 py-2 rounded-lg text-xs hover:bg-red-500/[0.06] transition disabled:opacity-50">
              Decline
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <button onClick={() => complete(req.id)} disabled={acting === req.id}
              className="w-full bg-[#4AFFD4] text-[#08080C] py-2 rounded-lg text-xs font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
              {acting === req.id ? 'Processing...' : '✓ Mark as done'}
            </button>
            {extendConfirm === req.id ? (
              <div className="flex gap-1.5">
                <button onClick={() => extend(req.id)} disabled={acting === req.id}
                  className="flex-1 bg-white/[0.07] text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-white/[0.10] transition disabled:opacity-50">
                  +5 min confirm
                </button>
                <button onClick={() => setExtendConfirm(null)}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.06] text-white/30 text-xs hover:text-white/60 transition">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setExtendConfirm(req.id)}
                className="w-full border border-white/[0.06] text-white/30 py-1.5 rounded-lg text-xs hover:text-white/60 hover:border-white/[0.10] transition">
                ⏱ Extend +5 min
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const TipsPanel = () => (
    <div className="space-y-3">
      {/* Tips totals */}
      <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest">💸 Tips</h2>
          <span className="text-white/25 text-xs">{recentTips.length}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/30">Total</span>
            <span className="text-amber-400 font-bold">{tipsTotalThisSession.toFixed(0)} {currency}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/30">Fees</span>
            <span className="text-red-400/60">−{tipsFeesThisSession.toFixed(2)}</span>
          </div>
          <div className="h-px bg-white/[0.06]" />
          <div className="flex justify-between text-xs">
            <span className="text-white/60 font-medium">You got</span>
            <span className="text-[#4AFFD4] font-bold">{tipsNetThisSession.toFixed(2)}</span>
          </div>
        </div>
        <a href="/dashboard/payments" className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-lg px-2 py-1.5 mt-2 hover:bg-[#4AFFD4]/[0.05] hover:border-[#4AFFD4]/10 transition group">
          <div>
            <p className="text-white/30 text-xs capitalize">{profile?.tier || 'starter'} · {Math.round((profile?.custom_commission_rate ?? 0.15) * 100)}% fee</p>
            <p className="text-white/20 text-xs">Upgrade for lower fees →</p>
          </div>
          <span className="text-white/15 group-hover:text-[#4AFFD4] transition text-xs">⚡</span>
        </a>
      </div>

      {/* Tips feed */}
      {recentTips.length === 0 ? (
        <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-4 text-center">
          <p className="text-white/20 text-xs">No tips yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {recentTips.map((tip, i) => (
            <div key={tip.id} className={`rounded-xl border px-3 py-2.5 ${i === 0 ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-[#111117] border-white/[0.04]'}`}>
              <div className="flex items-center justify-between">
                <span className="text-white text-xs font-medium truncate">{tip.sender_name} {i === 0 ? '🔥' : ''}</span>
                <span className="text-amber-400 font-bold text-sm shrink-0 ml-2">{tip.amount}</span>
              </div>
              {tip.message && <p className="text-white/30 text-xs italic truncate">"{tip.message}"</p>}
              <div className="flex justify-between mt-0.5">
                <span className="text-white/15 text-xs">{new Date(tip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[#4AFFD4] text-xs">+{(tip.amount - (tip.platform_fee ?? 0)).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const allActive = [...pending, ...accepted]

  if (loading) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-12">
        <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
      </main>
    </>
  )

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-12 pb-20">
        <div className="max-w-5xl mx-auto p-4">

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <BackButton href="/dashboard" />
            <h1 className="text-xl font-bold text-white">Live Session</h1>
            {session && (
              <div className="flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" />
                <span className="text-[#4AFFD4] text-xs font-semibold">Live</span>
              </div>
            )}
            <div className="ml-auto text-xs text-white/30">
              {allActive.length} active · {done.filter(r => r.status === 'completed').length} done
            </div>
          </div>

          {actError && (
            <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 mb-4">
              <p className="text-red-400 text-sm">{actError}</p>
            </div>
          )}

          {!session ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
              <p className="text-white/40 text-sm">No active session</p>
              <button onClick={() => router.push('/dashboard/live')} className="mt-3 bg-[#4AFFD4] text-[#08080C] px-5 py-2 rounded-xl font-bold text-sm hover:bg-[#6FFFDF] transition">
                Start session →
              </button>
            </div>
          ) : (
            <>
              {/* Mobile tabs */}
              <div className="flex gap-1.5 mb-4 md:hidden">
                <button
                  onClick={() => setMobileTab('requests')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${mobileTab === 'requests' ? 'text-[#4AFFD4] border-[#4AFFD4]/20 bg-[#4AFFD4]/10' : 'text-white/40 border-white/[0.06] bg-white/[0.04]'}`}>
                  🎯 Requests {pending.length > 0 ? `(${pending.length})` : ''}
                </button>
                <button
                  onClick={() => setMobileTab('tips')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${mobileTab === 'tips' ? 'text-[#4AFFD4] border-[#4AFFD4]/20 bg-[#4AFFD4]/10' : 'text-white/40 border-white/[0.06] bg-white/[0.04]'}`}>
                  💸 Tips {recentTips.length > 0 ? `(${recentTips.length})` : ''}
                </button>
              </div>

              {/* Content */}
              <div className="flex gap-4 items-start">

                {/* LEFT: Requests */}
                <div className={`flex-1 min-w-0 space-y-4 ${mobileTab === 'tips' ? 'hidden md:block' : ''}`}>

                  {/* Active */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest">Requests</h2>
                      {pending.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full font-bold">{pending.length} pending</span>}
                      {accepted.length > 0 && <span className="bg-[#4AFFD4]/10 text-[#4AFFD4] text-xs px-1.5 py-0.5 rounded-full font-bold">{accepted.length} in progress</span>}
                    </div>
                    {allActive.length === 0 ? (
                      <p className="text-white/20 text-xs">No active requests</p>
                    ) : (
                      <div className="space-y-2">
                        {pending.map(r => <RequestCard key={r.id} req={r} showActions={true} />)}
                        {accepted.map(r => <RequestCard key={r.id} req={r} showActions={false} />)}
                      </div>
                    )}
                  </div>

                  {/* Done / Expired — compact rows */}
                  {done.length > 0 && (
                    <div>
                      <h2 className="text-white/20 text-xs font-semibold uppercase tracking-widest mb-1">Done / Expired</h2>
                      <div className="divide-y divide-white/[0.03]">
                        {done.slice(0, 20).map(r => <DoneRow key={r.id} req={r} />)}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Tips */}
                <div className={`w-full md:w-[30%] shrink-0 ${mobileTab === 'requests' ? 'hidden md:block' : ''}`}>
                  <TipsPanel />
                </div>

              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
