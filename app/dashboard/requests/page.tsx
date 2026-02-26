'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Creator, TaskRequest } from '@/types'

function getRequestType(req: TaskRequest): 'task' | 'custom' | 'tip' {
  if (req.custom_task_text) return 'custom'
  if (req.task_id) return 'task'
  return 'tip'
}

const TYPE_CONFIG = {
  task: {
    icon: '🎯', label: 'Task request',
    pendingBorder: 'border-blue-900/60', pendingBg: 'bg-blue-950/20',
    acceptedBorder: 'border-blue-700/40', acceptedBg: 'bg-blue-950/10',
    dot: 'bg-blue-400', badge: 'bg-blue-900/40 text-blue-300',
  },
  custom: {
    icon: '✏️', label: 'Custom request',
    pendingBorder: 'border-purple-900/60', pendingBg: 'bg-purple-950/20',
    acceptedBorder: 'border-purple-700/40', acceptedBg: 'bg-purple-950/10',
    dot: 'bg-purple-400', badge: 'bg-purple-900/40 text-purple-300',
  },
  tip: {
    icon: '💸', label: 'Tip',
    pendingBorder: 'border-yellow-900/60', pendingBg: 'bg-yellow-950/20',
    acceptedBorder: 'border-yellow-700/40', acceptedBg: 'bg-yellow-950/10',
    dot: 'bg-yellow-400', badge: 'bg-yellow-900/40 text-yellow-300',
  },
}

export default function RequestsPage() {
  const router = useRouter()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [pending, setPending] = useState<TaskRequest[]>([])
  const [accepted, setAccepted] = useState<TaskRequest[]>([])
  const [done, setDone] = useState<TaskRequest[]>([]) // completed/declined — shown blurred
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [extendConfirm, setExtendConfirm] = useState<{ id: string, amount: number } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: creatorData } = await supabase
        .from('creators').select('*').eq('id', user.id).single()
      setCreator(creatorData)

      // Get active session first
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id')
        .eq('creator_id', user.id)
        .eq('is_active', true)
        .single()

      const { data } = await supabase
        .from('task_requests').select('*, tasks(*)')
        .eq('creator_id', user.id)
        .in('status', ['pending', 'accepted'])
        .eq('session_id', sessionData?.id ?? '')
        .order('created_at', { ascending: true })

      const now = new Date()
      setPending((data || []).filter(r =>
        r.status === 'pending' &&
        new Date(r.expires_at) > now &&
        (r.task_id || r.custom_task_text)
      ))
      setAccepted((data || []).filter(r => r.status === 'accepted'))

      // Load recent done items from current session only
      if (sessionData) {
        const { data: doneData } = await supabase
          .from('task_requests').select('*, tasks(*)')
          .eq('creator_id', user.id)
          .eq('session_id', sessionData.id)
          .in('status', ['completed', 'declined', 'refunded'])
          .order('created_at', { ascending: false })
          .limit(20)
        setDone(doneData || [])
      }

      setLoading(false)

      const channel = supabase.channel('requests')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'task_requests',
          filter: `creator_id=eq.${user.id}`,
        }, (payload) => {
          const req = payload.new as TaskRequest
          if (req.status === 'accepted') {
            setAccepted(prev => [req, ...prev])
          } else if (new Date(req.expires_at) > new Date() && (req.task_id || req.custom_task_text)) {
            setPending(prev => [...prev, req])
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'task_requests',
          filter: `creator_id=eq.${user.id}`,
        }, (payload) => {
          const updated = payload.new as TaskRequest

          // Remove from pending and accepted always
          setPending(prev => prev.filter(r => r.id !== updated.id))
          setAccepted(prev => prev.filter(r => r.id !== updated.id))

          if (updated.status === 'accepted') {
            setAccepted(prev => [updated, ...prev])
          } else if (updated.status === 'completed' || updated.status === 'declined' || updated.status === 'refunded') {
            // Upsert into done — replace if already exists (from optimistic update)
            setDone(prev => {
              const exists = prev.find(r => r.id === updated.id)
              if (exists) return prev.map(r => r.id === updated.id ? updated : r)
              return [updated, ...prev]
            })
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [router])

  async function respond(requestId: string, action: 'accept' | 'decline') {
    if (!creator) return
    setActing(requestId + action)
    try {
      const res = await fetch('/api/payments/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_request_id: requestId, action, creator_id: creator.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const req = pending.find(r => r.id === requestId)
      if (req) {
        setPending(prev => prev.filter(r => r.id !== requestId))
        if (action === 'decline') {
          setDone(prev => [{ ...req, status: 'declined' }, ...prev])
        } else {
          // Optimistic accept — move to accepted immediately
          setAccepted(prev => [{ ...req, status: 'accepted' }, ...prev])
        }
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActing(null)
    }
  }

  async function complete(requestId: string) {
    if (!creator) return
    setActing(requestId + 'complete')
    try {
      const res = await fetch('/api/payments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_request_id: requestId, creator_id: creator.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const req = accepted.find(r => r.id === requestId)
      if (req) {
        setAccepted(prev => prev.filter(r => r.id !== requestId))
        setDone(prev => [{ ...req, status: 'completed' }, ...prev])
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActing(null)
    }
  }

  async function refund(requestId: string) {
    if (!creator) return
    if (!confirm('Refund this? The viewer will not be charged.')) return
    setActing(requestId + 'refund')
    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_request_id: requestId, creator_id: creator.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const req = accepted.find(r => r.id === requestId)
      if (req) {
        setAccepted(prev => prev.filter(r => r.id !== requestId))
        setDone(prev => [{ ...req, status: 'refunded' }, ...prev])
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActing(null)
    }
  }

  async function extend(requestId: string, taskAmount: number) {
    if (!creator) return
    const extensionFee = Math.round(taskAmount * 0.10 * 100) / 100
    if (!confirm(`Extend this task by 5 minutes?\n\nExtension fee: ${extensionFee} ${creator.currency?.toUpperCase() ?? 'RON'} (10% of task value) — kept by platform`)) return
    setActing(requestId + 'extend')
    try {
      const res = await fetch('/api/payments/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_request_id: requestId, creator_id: creator.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Update local expires_at
      setAccepted(prev => prev.map(r =>
        r.id === requestId ? { ...r, expires_at: data.new_expiry } : r
      ))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActing(null)
    }
  }

  async function dismissTip(requestId: string) {
    if (!creator) return
    await supabase.from('task_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestId)
    const req = accepted.find(r => r.id === requestId)
    if (req) {
      setAccepted(prev => prev.filter(r => r.id !== requestId))
      setDone(prev => [{ ...req, status: 'completed' }, ...prev])
    }
  }

  function getTaskLabel(req: TaskRequest) {
    if (req.tasks?.title) return req.tasks.title
    if (req.custom_task_text) return req.custom_task_text
    if (req.task_id) return 'Task request'
    return 'Free tip'
  }

  function timeLeft(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const mins = Math.floor(diff / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(n => n + 1)
      // Auto-move expired pending requests to done
      const now = new Date()
      setPending(prev => {
        const expired = prev.filter(r => new Date(r.expires_at) <= now)
        if (expired.length > 0) {
          setDone(d => {
            const newExpired = expired.filter(e => !d.find(x => x.id === e.id))
            return newExpired.length > 0 ? [...newExpired.map(r => ({ ...r, status: 'expired' as any })), ...d] : d
          })
          return prev.filter(r => new Date(r.expires_at) > now)
        }
        return prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </main>
  )

  const pendingEarnings = accepted
    .filter(r => getRequestType(r) !== 'tip')
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  const hasAnything = pending.length > 0 || accepted.length > 0 || done.length > 0

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard/live')}
            className="text-white/40 hover:text-white transition text-sm">← Live</button>
          <h1 className="text-xl font-bold">Requests</h1>
          {pending.length > 0 && (
            <span className="bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
          {pendingEarnings > 0 && (
            <span className="ml-auto text-sm text-white/40">
              <span className="text-white font-semibold">{pendingEarnings} {creator?.currency?.toUpperCase() ?? 'RON'}</span> pending capture
            </span>
          )}
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div className="mb-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Needs response</p>
            <div className="space-y-3">
              {pending.map(req => {
                const type = getRequestType(req)
                const cfg = TYPE_CONFIG[type]
                const expiring = new Date(req.expires_at).getTime() - Date.now() < 60000
                return (
                  <div key={req.id} className={`rounded-2xl p-4 border ${cfg.pendingBorder} ${cfg.pendingBg}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-xl">{req.amount} {req.currency}</span>
                          <span className="text-white/40 text-sm">from {req.requester_name}</span>
                        </div>
                        <p className="text-white font-medium mt-1">{getTaskLabel(req)}</p>
                        {req.message && <p className="text-white/40 text-sm mt-1 italic">"{req.message}"</p>}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-white/30 text-xs mb-1">expires in</p>
                        <p className={`font-mono text-sm font-bold ${expiring ? 'text-red-400' : 'text-white/60'}`}>
                          {timeLeft(req.expires_at)}
                        </p>
                        <button onClick={() => setExtendConfirm({ id: req.id, amount: req.amount })} disabled={!!acting}
                          className="mt-1.5 px-2.5 py-1 rounded-lg border border-yellow-900/40 bg-yellow-950/20 text-yellow-500 text-xs font-semibold hover:border-yellow-700/60 hover:text-yellow-300 transition disabled:opacity-30 block w-full text-center">
                          {acting === req.id + 'extend' ? '...' : '⏱ +5m'}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respond(req.id, 'accept')} disabled={!!acting}
                        className="flex-1 bg-white text-black py-2.5 rounded-xl font-bold text-sm hover:bg-white/90 transition disabled:opacity-50">
                        {acting === req.id + 'accept' ? '...' : '✓ Accept'}
                      </button>
                      <button onClick={() => respond(req.id, 'decline')} disabled={!!acting}
                        className="flex-1 border border-white/10 text-white/50 py-2.5 rounded-xl text-sm hover:border-white/20 transition disabled:opacity-50">
                        {acting === req.id + 'decline' ? '...' : '✕ Decline'}
                      </button>

                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* In Progress — tasks and custom only */}
        {accepted.filter(r => getRequestType(r) !== 'tip').length > 0 && (
          <div className="mb-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">In progress</p>
            <div className="space-y-3">
              {accepted.filter(r => getRequestType(r) !== 'tip').map(req => {
                const type = getRequestType(req)
                const cfg = TYPE_CONFIG[type]
                return (
                  <div key={req.id} className={`rounded-2xl p-4 border ${cfg.acceptedBorder} ${cfg.acceptedBg}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${cfg.dot}`} />
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-xl">{req.amount} {req.currency}</span>
                          <span className="text-white/40 text-sm">from {req.requester_name}</span>
                        </div>
                        <p className="text-white font-medium mt-1">{getTaskLabel(req)}</p>
                        {req.message && <p className="text-white/40 text-sm mt-1 italic">"{req.message}"</p>}
                        {req.extensions && req.extensions.length > 0 && (
                          <p className="text-yellow-600/60 text-xs mt-1">
                            ⏱ Extended {req.extensions.length}× (+{req.extensions.length * 5}min)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => complete(req.id)} disabled={!!acting}
                        className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-500 transition disabled:opacity-50">
                        {acting === req.id + 'complete' ? '...' : `✓ Done — charge ${req.amount} ${req.currency}`}
                      </button>
                      <button onClick={() => refund(req.id)} disabled={!!acting}
                        className="border border-white/10 text-white/40 px-4 py-2.5 rounded-xl text-sm hover:border-white/20 hover:text-white/60 transition disabled:opacity-50">
                        {acting === req.id + 'refund' ? '...' : '↩'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tips — separate section, already charged */}
        {accepted.filter(r => getRequestType(r) === 'tip').length > 0 && (
          <div className="mb-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Tips received</p>
            <div className="space-y-2">
              {accepted.filter(r => getRequestType(r) === 'tip').map(req => (
                <div key={req.id} className="rounded-xl px-4 py-3 border border-yellow-900/30 bg-yellow-950/10 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-yellow-400 text-base shrink-0">💸</span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold">{req.amount} {req.currency}</span>
                        <span className="text-white/40 text-sm truncate">from {req.requester_name}</span>
                      </div>
                      {req.message && (
                        <p className="text-white/30 text-xs truncate mt-0.5 italic">"{req.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-green-400/70 text-xs font-medium">✓ Charged</span>
                    <button onClick={() => dismissTip(req.id)}
                      className="text-white/20 text-xs hover:text-white/50 transition px-2 py-1 border border-white/8 rounded-lg">
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done / Declined — blurred */}
        {done.length > 0 && (
          <div className="mb-6">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Session history</p>
            <div className="space-y-3">
              {done.map(req => {
                const type = getRequestType(req)
                const cfg = TYPE_CONFIG[type]
                const isDeclined = req.status === 'declined' || req.status === 'refunded' || req.status === 'expired'
                return (
                  <div key={req.id} className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 ${
                    isDeclined ? 'border-red-900/20 bg-red-950/10' : 'border-green-900/20 bg-green-950/10'
                  }`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`text-lg shrink-0 ${isDeclined ? 'opacity-40' : ''}`}>{cfg.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={`font-bold text-lg ${isDeclined ? 'text-white/40 line-through' : 'text-white'}`}>
                            {req.amount} {req.currency}
                          </span>
                          <span className="text-white/40 text-sm truncate">{req.requester_name}</span>
                        </div>
                        <p className="text-white/30 text-xs truncate mt-0.5">{getTaskLabel(req)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                      isDeclined
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-green-500/15 text-green-400'
                    }`}>
                      {req.status === 'completed' ? '✓ Done' : req.status === 'refunded' ? '↩ Refunded' : req.status === 'expired' ? '⏱ Expired' : '✕ Declined'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!hasAnything && (
          <div className="text-center py-24">
            <p className="text-4xl mb-4">👀</p>
            <p className="text-white/40">Waiting for requests...</p>
            <p className="text-white/20 text-sm mt-1">New requests appear here instantly</p>
          </div>
        )}
      </div>

      {/* Extend confirm modal */}
      {extendConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-5">
            <div className="text-center">
              <p className="text-3xl mb-3">⏱</p>
              <h2 className="text-lg font-bold">Extend acceptance time</h2>
              <p className="text-white/40 text-sm mt-1">Give yourself 5 more minutes to decide</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Extension time</span>
                <span className="font-semibold">+5 minutes</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-white/50">Platform fee (10%)</span>
                <span className="font-semibold text-yellow-400">
                  {Math.round(extendConfirm.amount * 0.10 * 100) / 100} {creator?.currency?.toUpperCase() ?? 'RON'}
                </span>
              </div>
              <p className="text-white/30 text-xs pt-1">Deducted from your payout when the task is completed</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setExtendConfirm(null)}
                className="flex-1 border border-white/10 text-white/50 py-3 rounded-xl text-sm hover:border-white/20 transition">
                Cancel
              </button>
              <button onClick={confirmExtend}
                className="flex-1 bg-yellow-500 text-black py-3 rounded-xl text-sm font-bold hover:bg-yellow-400 transition">
                Extend +5 min
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
