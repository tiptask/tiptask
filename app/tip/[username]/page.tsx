'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StripeCheckout } from './checkout'
import { TopNav } from '@/components/nav'
import Link from 'next/link'

// Minimum amounts in smallest currency unit (cents etc)
const MINIMUMS: Record<string, number> = {
  usd: 1.00, eur: 1.00, gbp: 1.00, ron: 5.00, cad: 1.00,
  aud: 1.00, chf: 1.00, sek: 10.00, nok: 10.00, dkk: 7.00,
  pln: 4.00, huf: 370, czk: 23.00, bgn: 2.00, jpy: 150,
  inr: 84, brl: 5.00, mxn: 17.00, sgd: 1.00, hkd: 7.80, nzd: 1.00,
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

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('tiptask_ref', params.username)
    async function load() {
      const [{ data: profileData }, { data: { user } }] = await Promise.all([
        supabase.from('users').select('*').eq('username', params.username).single(),
        supabase.auth.getUser(),
      ])
      if (!profileData || !profileData.accepts_tips) { setLoading(false); return }
      setProfile(profileData)
      if (user) {
        setCurrentUser(user)
        const { data: u } = await supabase.from('users').select('display_name').eq('id', user.id).single()
        if (u) setName(u.display_name)
      }
      const { data: s } = await supabase.from('sessions').select('*').eq('user_id', profileData.id).eq('is_active', true).single()
      setSession(s ?? null)
      if (s?.show_tasks) {
        const { data: t } = await supabase.from('tasks').select('*').eq('user_id', profileData.id).eq('is_active', true)
        setTasks(t || [])
      }
      setLoading(false)
    }
    load()
  }, [params.username])

  const currency = (profile?.currency || 'RON').toUpperCase()
  const currencyLower = currency.toLowerCase()
  const globalMin = MINIMUMS[currencyLower] ?? 1.00
  const amountNum = parseFloat(amount) || 0

  // Fee calculations
  const stripeFeeAmount = amountNum > 0 ? +(amountNum * 0.029 + 0.30).toFixed(2) : 0
  const totalIfCovered = amountNum > 0 ? +(amountNum + stripeFeeAmount).toFixed(2) : 0
  const creatorGetsIfNotCovered = amountNum > 0 ? +(amountNum * (1 - (profile?.custom_commission_rate ?? 0.15)) - stripeFeeAmount).toFixed(2) : 0
  const creatorGetsIfCovered = amountNum > 0 ? +(amountNum * (1 - (profile?.custom_commission_rate ?? 0.15))).toFixed(2) : 0
  const creatorGets = coverFee ? creatorGetsIfCovered : creatorGetsIfNotCovered
  const totalToPay = coverFee ? totalIfCovered : amountNum

  async function handleTipSubmit() {
    if (!profile) return
    if (!name.trim()) { setError('Enter your name'); return }
    if (!amountNum || amountNum < globalMin) { setError(`Minimum tip is ${globalMin} ${currency}`); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/tips/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_username: params.username,
          sender_name: name, message, amount: amountNum,
          currency: profile.currency || 'RON',
          sender_id: currentUser?.id || null,
          cover_fee: coverFee,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret)
      setTipId(data.tip_id)
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
        body: JSON.stringify({
          session_id: session.id, receiver_id: profile.id,
          task_id: selectedTask?.id || null,
          custom_task_text: requestMode === 'custom' ? customTask : null,
          sender_name: name, sender_id: currentUser?.id || null,
          amount: amountNum, message, cover_fee: coverFee,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret)
      setTaskRequestId(data.task_request_id)
    } catch (err: any) { setError(err.message) }
    setSubmitting(false)
  }

  function resetAll() {
    setSuccess(false); setTipId(null); setTaskRequestId(null); setClientSecret(null)
    setActiveZone(null); setRequestMode(null); setSelectedTask(null)
    setCustomTask(''); setAmount(''); setMessage(''); setError('')
  }

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)
  if (!profile) return (<><TopNav /><main className="min-h-screen bg-[#08080C] text-white flex items-center justify-center pt-14"><div className="text-center"><p className="text-white/40 mb-4">This creator hasn't enabled tips yet</p><Link href="/discover" className="text-[#4AFFD4] text-sm">Discover creators →</Link></div></main></>)

  if (success) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white flex items-center justify-center p-6 pt-20">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#4AFFD4]/10 border-2 border-[#4AFFD4]/20 flex items-center justify-center mx-auto mb-6 text-3xl">{tipId ? '💸' : '🎯'}</div>
          <h2 className="text-2xl font-bold mb-2">{tipId ? 'Tip sent!' : 'Request sent!'}</h2>
          <p className="text-white/40 mb-8">{tipId ? `Thanks for supporting ${profile.display_name}` : `Waiting for ${profile.display_name} to accept`}</p>
          <div className="space-y-3">
            <button onClick={resetAll} className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-2xl font-bold hover:bg-[#6FFFDF] transition">Send another</button>
            <Link href={`/${profile.username}`} className="block w-full bg-white/[0.06] text-white/60 py-3 rounded-2xl font-medium hover:bg-white/[0.09] transition">← Back to profile</Link>
            {!currentUser && <Link href={`/auth/register?ref=${profile.username}`} className="block w-full border border-[#4AFFD4]/20 text-[#4AFFD4] py-3 rounded-2xl font-medium hover:bg-[#4AFFD4]/[0.06] transition text-sm">Join TipTask to track your history →</Link>}
          </div>
        </div>
      </main>
    </>
  )

  if (clientSecret) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white p-6 pt-20">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <p className="text-white/35 text-sm mb-1">{profile.display_name}</p>
            <h1 className="text-2xl font-bold">{activeZone === 'tip' ? '💸 Tip' : selectedTask?.title || customTask}</h1>
            <p className="text-white/40 mt-1">{totalToPay} {currency} · from {name}</p>
          </div>
          <div className="bg-[#111117] rounded-2xl p-6 border border-white/[0.06]">
            <StripeCheckout clientSecret={clientSecret} tipId={tipId || ''} taskRequestId={taskRequestId || ''} onSuccess={() => setSuccess(true)} />
          </div>
          <button onClick={() => { setClientSecret(null); setTipId(null); setTaskRequestId(null) }} className="w-full text-white/20 text-sm py-4 hover:text-white/40 transition mt-2">← Go back</button>
        </div>
      </main>
    </>
  )

  const showForm = activeZone === 'tip' || (activeZone === 'request' && requestMode)
  const canSubmit = activeZone !== null && name.trim() && amount && (
    activeZone === 'tip' || (requestMode === 'task' && selectedTask) || (requestMode === 'custom' && customTask.trim())
  )

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white pb-40 pt-14">
        <div className="fixed top-14 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-[#4AFFD4] opacity-[0.03] blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="pt-6 pb-5 px-6 text-center border-b border-white/[0.05] bg-[#0D0D12]">
          <Link href={`/${profile.username}`} className="inline-block">
            <div className="w-12 h-12 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center mx-auto mb-2 text-lg font-bold text-[#4AFFD4]">{profile.display_name[0]}</div>
          </Link>
          <h1 className="text-base font-semibold">{profile.display_name}</h1>
          <div className="flex items-center justify-center gap-2 mt-1.5">
            {session ? (
              <div className="flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" />
                <span className="text-[#4AFFD4] text-xs font-semibold">Session active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.05] px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                <span className="text-white/30 text-xs">Tips only</span>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 pt-4 space-y-3">

          {/* TIP ZONE */}
          <div className={`rounded-2xl border transition-all overflow-hidden ${activeZone === 'tip' ? 'bg-[#0F1A17] border-[#4AFFD4]/30' : 'bg-[#111117] border-white/[0.06]'}`}>
            <button onClick={() => { setActiveZone(a => a === 'tip' ? null : 'tip'); setAmount(''); setError('') }} className="w-full px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${activeZone === 'tip' ? 'bg-[#4AFFD4]/15' : 'bg-white/[0.05]'}`}>💸</div>
                <div className="text-left"><p className="font-semibold text-sm text-white">Send a tip</p><p className="text-white/30 text-xs mt-0.5">Always available · min {globalMin} {currency}</p></div>
              </div>
              <span className={`text-white/25 text-xs transition-transform ${activeZone === 'tip' ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {activeZone === 'tip' && (
              <div className="px-5 pb-5 space-y-3 border-t border-white/[0.05] pt-4">
                <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))} placeholder="Your name" className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition" />
                <div className="relative">
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Amount (min ${globalMin})`} className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 pr-16 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition" />
                  <span className="absolute right-4 top-3 text-white/25 text-sm">{currency}</span>
                </div>
                <div className="flex gap-2">
                  {[5, 10, 20, 50].filter(v => v >= globalMin).map(v => (
                    <button key={v} onClick={() => setAmount(v.toString())} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${amount === v.toString() ? 'bg-[#4AFFD4] text-[#08080C]' : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08]'}`}>{v}</button>
                  ))}
                </div>
                <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))} placeholder="Message (optional)" className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition" />
              </div>
            )}
          </div>

          {/* REQUEST ZONE */}
          {session ? (
            <div className={`rounded-2xl border transition-all overflow-hidden ${activeZone === 'request' ? 'bg-[#0F0F1A] border-[#4AFFD4]/30' : 'bg-[#111117] border-white/[0.06]'}`}>
              <button onClick={() => { setActiveZone(a => a === 'request' ? null : 'request'); setAmount(''); setError('') }} className="w-full px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${activeZone === 'request' ? 'bg-[#4AFFD4]/15' : 'bg-white/[0.05]'}`}>🎯</div>
                  <div className="text-left"><p className="font-semibold text-sm text-white">Send a request</p><p className="text-white/30 text-xs mt-0.5">Session active · paid on completion</p></div>
                </div>
                <span className={`text-white/25 text-xs transition-transform ${activeZone === 'request' ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {activeZone === 'request' && (
                <div className="px-5 pb-5 border-t border-white/[0.05] pt-4 space-y-3">
                  <div className="flex gap-2">
                    {session.show_tasks && tasks.length > 0 && (
                      <button onClick={() => { setRequestMode(m => m === 'task' ? null : 'task'); setSelectedTask(null); setAmount('') }} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition border ${requestMode === 'task' ? 'bg-[#4AFFD4]/10 border-[#4AFFD4]/30 text-[#4AFFD4]' : 'bg-white/[0.04] border-white/[0.06] text-white/40'}`}>🎯 From list</button>
                    )}
                    {session.allow_custom_tasks && (
                      <button onClick={() => { setRequestMode(m => m === 'custom' ? null : 'custom'); setAmount('') }} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition border ${requestMode === 'custom' ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-white/[0.04] border-white/[0.06] text-white/40'}`}>✏️ Custom</button>
                    )}
                  </div>
                  {requestMode === 'task' && (
                    <div className="space-y-2">
                      {tasks.map(task => (
                        <button key={task.id} onClick={() => { setSelectedTask(task); setAmount(task.suggested_amount?.toString() || Math.max(task.min_amount || 0, globalMin).toString()) }}
                          className={`w-full rounded-xl p-3.5 text-left transition border ${selectedTask?.id === task.id ? 'bg-[#4AFFD4] text-[#08080C] border-[#4AFFD4]' : 'bg-[#08080C] text-white border-white/[0.06]'}`}>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">{task.title}</span>
                            <span className={`text-xs ${selectedTask?.id === task.id ? 'text-[#08080C]/60' : 'text-white/25'}`}>{task.suggested_amount ? `${task.suggested_amount} ${currency}` : `min ${Math.max(task.min_amount || 0, globalMin)} ${currency}`}</span>
                          </div>
                          {task.description && <p className={`text-xs mt-1 ${selectedTask?.id === task.id ? 'text-[#08080C]/50' : 'text-white/25'}`}>{task.description}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {requestMode === 'custom' && (
                    <textarea value={customTask} onChange={e => setCustomTask(e.target.value.slice(0, 200))} placeholder="What would you like them to do?" rows={3} className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500/40 transition resize-none" />
                  )}
                  {requestMode && (
                    <>
                      <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))} placeholder="Your name" className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition" />
                      <div className="relative">
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                          readOnly={requestMode === 'task' && !!selectedTask?.suggested_amount}
                          placeholder={`Amount (min ${requestMode === 'task' && selectedTask ? Math.max(selectedTask.min_amount || 0, globalMin) : globalMin})`}
                          className={`w-full border rounded-xl px-4 py-3 pr-16 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition ${requestMode === 'task' && selectedTask?.suggested_amount ? 'bg-white/[0.03] border-white/[0.04] cursor-not-allowed text-white/30' : 'bg-[#08080C] border-white/[0.08]'}`} />
                        <span className="absolute right-4 top-3 text-white/25 text-sm">{currency}</span>
                      </div>
                      <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))} placeholder="Message (optional)" className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition" />
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.04] bg-[#111117]/50 px-5 py-4 flex items-center gap-3 opacity-50">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg">🎯</div>
              <div><p className="font-semibold text-sm text-white/50">Requests unavailable</p><p className="text-white/20 text-xs mt-0.5">No active session</p></div>
            </div>
          )}

          {/* Fee toggle - only show when amount is set */}
          {showForm && amountNum >= globalMin && (
            <div className={`rounded-2xl border p-4 transition ${coverFee ? 'border-[#4AFFD4]/20 bg-[#4AFFD4]/[0.04]' : 'border-white/[0.06] bg-[#111117]'}`}>
              <button onClick={() => setCoverFee(f => !f)} className="w-full flex items-center justify-between gap-3">
                <div className="text-left">
                  <p className="text-white text-sm font-medium">Cover processing fee</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {coverFee
                      ? `You pay ${totalIfCovered} ${currency} · creator gets ~${creatorGetsIfCovered} ${currency}`
                      : `You pay ${amountNum} ${currency} · creator gets ~${Math.max(0, creatorGetsIfNotCovered)} ${currency}`}
                  </p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${coverFee ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 mt-0.5 shadow-sm ${coverFee ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </button>
              {amountNum > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.05] flex justify-between text-xs">
                  <span className="text-white/25">+{stripeFeeAmount} {currency} processing</span>
                  <span className={coverFee ? 'text-[#4AFFD4] font-semibold' : 'text-white/25'}>
                    Total: {coverFee ? totalIfCovered : amountNum} {currency}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Join CTA */}
          {!currentUser && (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl px-5 py-4 flex items-center justify-between">
              <div><p className="text-white/60 text-sm font-medium">New to TipTask?</p><p className="text-white/25 text-xs mt-0.5">Join free — follow creators, track history</p></div>
              <Link href={`/auth/register?ref=${profile.username}`} className="shrink-0 bg-white/[0.07] hover:bg-white/[0.10] border border-white/[0.08] text-white/60 hover:text-white text-xs font-semibold px-4 py-2 rounded-xl transition">Join →</Link>
            </div>
          )}

          {error && <p className="text-red-400 text-sm px-1">{error}</p>}
        </div>

        {/* Sticky CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#08080C] via-[#08080C]/95 to-transparent pt-8 z-20">
          <div className="max-w-md mx-auto">
            <button onClick={activeZone === 'tip' ? handleTipSubmit : handleRequestSubmit} disabled={submitting || !canSubmit}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-30 bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF] active:scale-[0.98]">
              {submitting ? 'Processing...' : !canSubmit ? 'Select an option above' :
               activeZone === 'tip'
                 ? `💸 Send tip · ${coverFee ? totalIfCovered : amountNum || '0'} ${currency}`
                 : `🎯 Send request · ${coverFee ? totalIfCovered : amountNum || '0'} ${currency}`}
            </button>
            <p className="text-center text-white/15 text-xs mt-2">
              {activeZone === 'tip' ? 'Secured by Stripe' : 'Full refund if declined · Stripe secured'}
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
