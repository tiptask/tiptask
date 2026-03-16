'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { StripeCheckout } from './checkout'
import { TopNav } from '@/components/nav'
import Link from 'next/link'

const MINIMUMS: Record<string, number> = {
  usd: 1, eur: 1, gbp: 1, ron: 5, cad: 1,
  aud: 1, chf: 1, sek: 10, nok: 10, dkk: 7,
  pln: 4, huf: 370, czk: 23, bgn: 2, jpy: 150,
  inr: 84, brl: 5, mxn: 17, sgd: 1, hkd: 8, nzd: 1,
}
const FEE_THRESHOLD: Record<string, number> = {
  usd: 5, eur: 5, gbp: 5, ron: 25, cad: 7,
  aud: 8, chf: 5, sek: 50, nok: 50, dkk: 35,
  pln: 20, huf: 1850, czk: 115, bgn: 10, jpy: 750,
  inr: 420, brl: 25, mxn: 85, sgd: 7, hkd: 40, nzd: 8,
}

export default function TipPage({ params: paramsPromise }: { params: Promise<{ username: string }> }) {
  const params = React.use(paramsPromise)
  const [profile, setProfile] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeZone, setActiveZone] = useState<'tip' | 'request' | null>(null)
  const [requestMode, setRequestMode] = useState<'task' | 'custom' | null>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [customTask, setCustomTask] = useState('')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [coverFee, setCoverFee] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [tipId, setTipId] = useState<string | null>(null)
  const [taskRequestId, setTaskRequestId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [myRequestStatus, setMyRequestStatus] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const profileIdRef = useRef<string | null>(null)

  const loadSession = useCallback(async (uid: string) => {
    const { data: s } = await supabase.from('sessions').select('*').eq('user_id', uid).eq('is_active', true).single()
    setSession(s ?? null)
    if (s?.show_tasks) {
      const { data: t } = await supabase.from('tasks').select('*').eq('user_id', uid).eq('is_active', true)
      setTasks(t || [])
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('tiptask_ref', params.username)
    async function load() {
      const [{ data: profileData }, { data: { user } }] = await Promise.all([
        supabase.from('users').select('*').eq('username', params.username).single(),
        supabase.auth.getUser(),
      ])
      if (!profileData || !profileData.accepts_tips) { setLoading(false); return }
      // Block self-tipping
      if (user && user.id === profileData.id) {
        router.replace(`/dashboard`)
        return
      }
      setProfile(profileData)
      setProfileId(profileData.id)
      profileIdRef.current = profileData.id
      if (user) {
        setCurrentUser(user)
        const { data: u } = await supabase.from('users').select('display_name').eq('id', user.id).single()
        if (u) setName(u.display_name)
      }
      await loadSession(profileData.id)
      setLoading(false)
    }
    load()
  }, [params.username, loadSession])

  // Realtime + polling for session changes
  useEffect(() => {
    if (!profileId) return
    const channel = supabase.channel(`tip-session-${profileId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${profileId}` },
        () => loadSession(profileId))
      .subscribe()
    // Polling fallback every 5 seconds
    const poll = setInterval(() => { if (profileIdRef.current) loadSession(profileIdRef.current) }, 5000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [profileId, loadSession])

  // Realtime: watch specific request status once we have the ID
  useEffect(() => {
    if (!taskRequestId) return
    const channel = supabase.channel(`tip-request-${taskRequestId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'task_requests',
        filter: `id=eq.${taskRequestId}`,
      }, (payload) => {
        const newStatus = payload.new?.status
        if (newStatus) setMyRequestStatus(newStatus)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [taskRequestId])

  const currency = (profile?.currency || 'RON').toUpperCase()
  const currencyLower = currency.toLowerCase()
  const globalMin = MINIMUMS[currencyLower] ?? 1
  const feeThreshold = FEE_THRESHOLD[currencyLower] ?? 5
  const amountNum = parseFloat(amount) || 0
  const commissionRate = profile?.custom_commission_rate ?? 0.15

  const stripeFeeAmount = amountNum > 0 ? +(amountNum * 0.029 + 0.30).toFixed(2) : 0
  const platformFeeAmount = amountNum > 0 ? +(amountNum * commissionRate).toFixed(2) : 0
  const creatorReceives = amountNum > 0 ? +(amountNum - platformFeeAmount).toFixed(2) : 0
  const mustCoverFee = amountNum > 0 && amountNum < feeThreshold
  const effectiveCoverFee = mustCoverFee || coverFee
  const totalToPay = amountNum > 0 ? (effectiveCoverFee ? +(amountNum + stripeFeeAmount).toFixed(2) : amountNum) : 0

  async function handleTipSubmit() {
    if (!profile) return
    if (!name.trim()) { setError('Enter your name'); return }
    if (!amountNum || amountNum < globalMin) { setError(`Minimum tip is ${globalMin} ${currency}`); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/tips/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiver_username: params.username, sender_name: name, message, amount: amountNum, currency: profile.currency || 'RON', sender_id: currentUser?.id || null, cover_fee: effectiveCoverFee }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret); setTipId(data.tip_id)
    } catch (err: any) { setError(err.message) }
    setSubmitting(false)
  }

  async function handleRequestSubmit() {
    if (!profile || !session) return
    if (!name.trim()) { setError('Enter your name'); return }
    if (requestMode === 'task' && !selectedTask) { setError('Select a task'); return }
    if (requestMode === 'custom' && !customTask.trim()) { setError('Describe your request'); return }
    const minAmount = requestMode === 'task' && selectedTask ? Math.max(selectedTask.min_amount || 0, globalMin) : globalMin
    if (!amountNum || amountNum < minAmount) { setError(`Minimum is ${minAmount} ${currency}`); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, receiver_id: profile.id, task_id: selectedTask?.id || null, custom_task_text: requestMode === 'custom' ? customTask : null, sender_name: name, sender_id: currentUser?.id || null, amount: amountNum, message, cover_fee: effectiveCoverFee }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret); setTaskRequestId(data.task_request_id)
    } catch (err: any) { setError(err.message) }
    setSubmitting(false)
  }

  function resetAll() {
    setSuccess(false); setTipId(null); setTaskRequestId(null); setClientSecret(null)
    setActiveZone(null); setRequestMode(null); setSelectedTask(null)
    setCustomTask(''); setAmount(''); setMessage(''); setError(''); setMyRequestStatus(null)
  }

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-12"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)
  if (!profile) return (<><TopNav /><main className="min-h-screen bg-[#08080C] text-white flex items-center justify-center pt-12"><div className="text-center"><p className="text-white/40 mb-3 text-sm">This creator hasn't enabled tips yet</p><Link href="/discover" className="text-[#4AFFD4] text-sm">Discover creators →</Link></div></main></>)

  // Show request status update to sender
  if (myRequestStatus && myRequestStatus !== 'pending' && myRequestStatus !== 'draft') {
    return (
      <>
        <TopNav />
        <main className="min-h-screen bg-[#08080C] text-white flex items-center justify-center p-5 pt-16">
          <div className="max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              {myRequestStatus === 'accepted' ? '✅' : myRequestStatus === 'completed' ? '🎉' : myRequestStatus === 'declined' ? '❌' : '↩️'}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {myRequestStatus === 'accepted' ? 'Request accepted!' : myRequestStatus === 'completed' ? 'Request completed!' : myRequestStatus === 'declined' ? 'Request declined' : 'Request refunded'}
            </h2>
            <p className="text-white/40 text-sm mb-6">
              {myRequestStatus === 'accepted' ? `${profile.display_name} is working on it!` : myRequestStatus === 'completed' ? 'Payment has been captured. Thanks!' : myRequestStatus === 'declined' ? 'Your payment has been refunded.' : 'Payment refunded to your card.'}
            </p>
            <button onClick={resetAll} className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-2xl font-bold hover:bg-[#6FFFDF] transition text-sm">Back to profile</button>
          </div>
        </main>
      </>
    )
  }

  if (success) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white flex items-center justify-center p-5 pt-16">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-[#4AFFD4]/10 border-2 border-[#4AFFD4]/20 flex items-center justify-center mx-auto mb-4 text-2xl">{tipId ? '💸' : '🎯'}</div>
          <h2 className="text-xl font-bold mb-2">{tipId ? 'Tip sent!' : 'Request sent!'}</h2>
          <p className="text-white/40 text-sm mb-2">{tipId ? `Thanks for supporting ${profile.display_name}` : `Waiting for ${profile.display_name} to accept...`}</p>
          {!tipId && <p className="text-white/25 text-xs mb-6">This page will update automatically when they respond.</p>}
          {tipId && <div className="space-y-2 mt-4">
            <button onClick={resetAll} className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-2xl font-bold hover:bg-[#6FFFDF] transition text-sm">Send another</button>
            <Link href={`/${profile.username}`} className="block w-full bg-white/[0.06] text-white/60 py-3 rounded-2xl font-medium hover:bg-white/[0.09] transition text-sm">← Back to profile</Link>
          </div>}
        </div>
      </main>
    </>
  )

  if (clientSecret) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white p-4 pt-16">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-5">
            <p className="text-white/35 text-xs mb-1">{profile.display_name}</p>
            <h1 className="text-lg font-bold">{activeZone === 'tip' ? '💸 Tip' : selectedTask?.title || customTask}</h1>
          </div>
          {/* Fee breakdown */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3 mb-4 space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-white/40">Amount</span><span className="text-white">{amountNum} {currency}</span></div>
            {effectiveCoverFee && <div className="flex justify-between text-xs"><span className="text-white/40">Processing fee</span><span className="text-white/50">+{stripeFeeAmount} {currency}</span></div>}
            <div className="flex justify-between text-xs border-t border-white/[0.05] pt-1.5"><span className="text-white/60 font-medium">You pay</span><span className="text-white font-bold">{totalToPay} {currency}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/25">Creator receives</span><span className="text-[#4AFFD4]">{creatorReceives} {currency}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/20">Platform fee ({Math.round(commissionRate * 100)}%)</span><span className="text-white/20">−{platformFeeAmount} {currency}</span></div>
          </div>
          <div className="bg-[#111117] rounded-2xl p-4 border border-white/[0.06]">
            <StripeCheckout clientSecret={clientSecret} tipId={tipId || ''} taskRequestId={taskRequestId || ''} onSuccess={() => setSuccess(true)} />
          </div>
          <button onClick={() => { setClientSecret(null); setTipId(null); setTaskRequestId(null) }} className="w-full text-white/20 text-xs py-3 hover:text-white/40 transition mt-1">← Go back</button>
        </div>
      </main>
    </>
  )

  const showFeeToggle = amountNum >= globalMin
  const canSubmit = activeZone !== null && name.trim() && amount && (
    activeZone === 'tip' || (requestMode === 'task' && selectedTask) || (requestMode === 'custom' && customTask.trim())
  )
  const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white pb-36 pt-12">
        {/* Header */}
        <div className="pt-4 pb-4 px-4 text-center border-b border-white/[0.05] bg-[#0D0D12]">
          <Link href={`/${profile.username}`}>
            <div className="w-10 h-10 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center mx-auto mb-1.5 text-base font-bold text-[#4AFFD4]">{profile.display_name[0]}</div>
          </Link>
          <h1 className="text-sm font-semibold">{profile.display_name}</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            {session ? (
              <div className="flex items-center gap-1 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-2 py-0.5 rounded-full">
                <span className="w-1 h-1 bg-[#4AFFD4] rounded-full animate-pulse" />
                <span className="text-[#4AFFD4] text-xs font-semibold">Session active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.05] px-2 py-0.5 rounded-full">
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span className="text-white/30 text-xs">Tips only</span>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-sm mx-auto px-3 pt-3 space-y-2.5">
          {/* TIP ZONE */}
          <div className={`rounded-xl border transition-all overflow-hidden ${activeZone === 'tip' ? 'bg-[#0F1A17] border-[#4AFFD4]/30' : 'bg-[#111117] border-white/[0.06]'}`}>
            <button onClick={() => { setActiveZone(a => a === 'tip' ? null : 'tip'); setAmount(''); setError('') }} className="w-full px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${activeZone === 'tip' ? 'bg-[#4AFFD4]/15' : 'bg-white/[0.05]'}`}>💸</div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-white">Send a tip</p>
                  <p className="text-white/30 text-xs">min {globalMin} {currency} · always available</p>
                </div>
              </div>
              <span className={`text-white/25 text-xs transition-transform ${activeZone === 'tip' ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {activeZone === 'tip' && (
              <div className="px-4 pb-4 space-y-2.5 border-t border-white/[0.05] pt-3">
                <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))} placeholder="Your name" className={inputCls} />
                <div className="relative">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Amount (min ${globalMin})`} className={`${inputCls} pr-14`} />
                  <span className="absolute right-3 top-2.5 text-white/25 text-xs">{currency}</span>
                </div>
                <div className="flex gap-1.5">
                  {[5, 10, 20, 50].filter(v => v >= globalMin).map(v => (
                    <button key={v} onClick={() => setAmount(v.toString())} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${amount === v.toString() ? 'bg-[#4AFFD4] text-[#08080C]' : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08]'}`}>{v}</button>
                  ))}
                </div>
                <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))} placeholder="Message (optional)" className={inputCls} />
              </div>
            )}
          </div>

          {/* REQUEST ZONE */}
          {session ? (
            <div className={`rounded-xl border transition-all overflow-hidden ${activeZone === 'request' ? 'bg-[#0F0F1A] border-[#4AFFD4]/30' : 'bg-[#111117] border-white/[0.06]'}`}>
              <button onClick={() => { setActiveZone(a => a === 'request' ? null : 'request'); setAmount(''); setError('') }} className="w-full px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${activeZone === 'request' ? 'bg-[#4AFFD4]/15' : 'bg-white/[0.05]'}`}>🎯</div>
                  <div className="text-left">
                    <p className="font-semibold text-sm text-white">Send a request</p>
                    <p className="text-white/30 text-xs">session active · paid on completion</p>
                  </div>
                </div>
                <span className={`text-white/25 text-xs transition-transform ${activeZone === 'request' ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {activeZone === 'request' && (
                <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-2.5">
                  <div className="flex gap-1.5">
                    {session.show_tasks && tasks.length > 0 && (
                      <button onClick={() => { setRequestMode(m => m === 'task' ? null : 'task'); setSelectedTask(null); setAmount('') }} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${requestMode === 'task' ? 'bg-[#4AFFD4]/10 border-[#4AFFD4]/30 text-[#4AFFD4]' : 'bg-white/[0.04] border-white/[0.06] text-white/40'}`}>🎯 From list</button>
                    )}
                    {session.allow_custom_tasks && (
                      <button onClick={() => { setRequestMode(m => m === 'custom' ? null : 'custom'); setAmount('') }} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${requestMode === 'custom' ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-white/[0.04] border-white/[0.06] text-white/40'}`}>✏️ Custom</button>
                    )}
                  </div>
                  {requestMode === 'task' && (
                    <div className="space-y-1.5">
                      {tasks.map(task => (
                        <button key={task.id} onClick={() => { setSelectedTask(task); setAmount(task.suggested_amount?.toString() || Math.max(task.min_amount || 0, globalMin).toString()) }}
                          className={`w-full rounded-lg p-3 text-left transition border ${selectedTask?.id === task.id ? 'bg-[#4AFFD4] text-[#08080C] border-[#4AFFD4]' : 'bg-[#08080C] text-white border-white/[0.06]'}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-xs">{task.title}</span>
                            <span className={`text-xs ${selectedTask?.id === task.id ? 'text-[#08080C]/60' : 'text-white/25'}`}>{task.suggested_amount ? `${task.suggested_amount} ${currency}` : `min ${Math.max(task.min_amount || 0, globalMin)} ${currency}`}</span>
                          </div>
                          {task.description && <p className={`text-xs mt-0.5 ${selectedTask?.id === task.id ? 'text-[#08080C]/50' : 'text-white/25'}`}>{task.description}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {requestMode === 'custom' && (
                    <textarea value={customTask} onChange={e => setCustomTask(e.target.value.slice(0, 200))} placeholder="What would you like them to do?" rows={3} className={`${inputCls} resize-none`} />
                  )}
                  {requestMode && (
                    <>
                      <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))} placeholder="Your name" className={inputCls} />
                      <div className="relative">
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                          readOnly={requestMode === 'task' && !!selectedTask?.suggested_amount}
                          className={`${inputCls} pr-14 ${requestMode === 'task' && selectedTask?.suggested_amount ? 'opacity-50 cursor-not-allowed' : ''}`} />
                        <span className="absolute right-3 top-2.5 text-white/25 text-xs">{currency}</span>
                      </div>
                      <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))} placeholder="Message (optional)" className={inputCls} />
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.04] bg-[#111117]/50 px-4 py-3 flex items-center gap-2.5 opacity-50">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-base">🎯</div>
              <div><p className="font-semibold text-xs text-white/50">Requests unavailable</p><p className="text-white/20 text-xs">No active session</p></div>
            </div>
          )}

          {/* Fee breakdown + toggle */}
          {showFeeToggle && (
            <div className="bg-[#111117] border border-white/[0.06] rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-xs">Creator receives</span>
                <span className="text-[#4AFFD4] font-bold text-sm">{creatorReceives} {currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/20 text-xs">Platform fee ({Math.round(commissionRate * 100)}%)</span>
                <span className="text-white/25 text-xs">−{platformFeeAmount} {currency}</span>
              </div>
              <div className="border-t border-white/[0.05] pt-2">
                <button onClick={() => !mustCoverFee && setCoverFee(f => !f)}
                  className={`w-full flex items-center justify-between gap-2 ${mustCoverFee ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <div className="text-left">
                    <p className={`text-xs font-medium ${mustCoverFee ? 'text-white/40' : 'text-white'}`}>
                      Cover processing fee
                      {mustCoverFee && <span className="ml-1.5 text-xs text-amber-400/70">Required under {feeThreshold} {currency}</span>}
                    </p>
                    <p className="text-white/25 text-xs">+{stripeFeeAmount} {currency} · Stripe 2.9%+0.30</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors shrink-0 ${effectiveCoverFee ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 mt-0.5 shadow-sm ${effectiveCoverFee ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {!currentUser && (
            <div className="bg-[#111117] border border-white/[0.06] rounded-xl px-4 py-3 flex items-center justify-between">
              <div><p className="text-white/60 text-xs font-medium">New to TipTask?</p><p className="text-white/25 text-xs">Join free — follow creators, track history</p></div>
              <Link href={`/auth/register?ref=${profile.username}`} className="shrink-0 bg-white/[0.07] hover:bg-white/[0.10] border border-white/[0.08] text-white/60 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">Join →</Link>
            </div>
          )}

          {error && <p className="text-red-400 text-xs px-1">{error}</p>}
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#08080C] via-[#08080C]/95 to-transparent pt-6 z-20">
          <div className="max-w-sm mx-auto">
            <button onClick={activeZone === 'tip' ? handleTipSubmit : handleRequestSubmit} disabled={submitting || !canSubmit}
              className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-30 bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF] active:scale-[0.98]">
              {submitting ? 'Processing...' : !canSubmit ? 'Select an option above' :
               activeZone === 'tip' ? `💸 Pay ${totalToPay || amountNum || '0'} ${currency}` : `🎯 Pay ${totalToPay || amountNum || '0'} ${currency}`}
            </button>
            <p className="text-center text-white/15 text-xs mt-1.5">{activeZone === 'tip' ? 'Secured by Stripe' : 'Full refund if declined · Stripe secured'}</p>
          </div>
        </div>
      </main>
    </>
  )
}
