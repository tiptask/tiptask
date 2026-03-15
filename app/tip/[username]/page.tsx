'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StripeCheckout } from './checkout'
import { SuccessScreen } from './success'
import { FanHistory } from './history'
import type { Creator, Session, Task } from '@/types'

type RequestMode = 'task' | 'custom' | null
type ActiveZone = 'tip' | 'request' | null

const MINIMUM_AMOUNTS: Record<string, number> = {
  usd: 1.00, eur: 0.95, gbp: 0.80, ron: 5.00, cad: 1.40,
  aud: 1.55, chf: 0.90, sek: 10.50, nok: 10.50, dkk: 7.00,
  pln: 4.00, huf: 370, czk: 23.00, bgn: 1.85, jpy: 150,
  inr: 84, brl: 5.00, mxn: 17.00, sgd: 1.35, hkd: 7.80, nzd: 1.65,
}

export default function TipPage({ params: paramsPromise }: { params: Promise<{ username: string }> }) {
  const params = React.use(paramsPromise)
  const [creator, setCreator] = useState<Creator | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Zone state
  const [activeZone, setActiveZone] = useState<ActiveZone>(null)
  const [requestMode, setRequestMode] = useState<RequestMode>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [customTask, setCustomTask] = useState('')

  // Shared fields
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Payment state
  const [submitting, setSubmitting] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [tipId, setTipId] = useState<string | null>(null)
  const [taskRequestId, setTaskRequestId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [myRequestIds, setMyRequestIds] = useState<string[]>([])

  useEffect(() => {
    // Store referral
    if (typeof window !== 'undefined') {
      localStorage.setItem('tiptask_ref', params.username)
    }
    async function load() {
      const { data: creatorData } = await supabase
        .from('creators').select('*').eq('username', params.username).single()
      if (!creatorData) { setLoading(false); return }
      setCreator(creatorData)

      const { data: sessionData } = await supabase
        .from('sessions').select('*')
        .eq('creator_id', creatorData.id).eq('is_active', true).single()
      setSession(sessionData ?? null)

      if (sessionData?.show_tasks) {
        const { data: tasksData } = await supabase
          .from('tasks').select('*')
          .eq('creator_id', creatorData.id).eq('is_active', true).order('category')
        setTasks(tasksData || [])
      }
      setLoading(false)
    }
    load()
  }, [params.username])

  const currency = (creator?.currency || 'RON').toUpperCase()
  const currencyLower = currency.toLowerCase()
  const globalMin = MINIMUM_AMOUNTS[currencyLower] ?? 1.00

  function switchZone(zone: ActiveZone) {
    setActiveZone(prev => prev === zone ? null : zone)
    setRequestMode(null)
    setSelectedTask(null)
    setAmount('')
    setError('')
  }

  function selectRequestMode(mode: RequestMode) {
    setRequestMode(prev => prev === mode ? null : mode)
    setSelectedTask(null)
    setAmount('')
  }

  function selectTask(task: Task) {
    setSelectedTask(task)
    if (task.suggested_amount) setAmount(task.suggested_amount.toString())
    else if (task.min_amount && task.min_amount > globalMin) setAmount(task.min_amount.toString())
    else setAmount(globalMin.toString())
  }

  async function handleTipSubmit() {
    if (!creator) return
    if (!name.trim()) { setError('Enter your name'); return }
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum < globalMin) {
      setError(`Minimum tip is ${globalMin} ${currency}`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/tips/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_username: params.username,
          tipper_name: name,
          message,
          amount: amountNum,
          currency: creator.currency || 'RON',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret)
      setTipId(data.tip_id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestSubmit() {
    if (!creator || !session) return
    if (!name.trim()) { setError('Enter your name'); return }
    if (requestMode === 'task' && !selectedTask) { setError('Select a task'); return }
    if (requestMode === 'custom' && !customTask.trim()) { setError('Describe your request'); return }

    const amountNum = parseFloat(amount)
    let minAmount = globalMin
    if (requestMode === 'task' && selectedTask) {
      minAmount = Math.max(selectedTask.min_amount || 0, globalMin)
      if (selectedTask.suggested_amount) minAmount = selectedTask.suggested_amount
    }
    if (!amountNum || amountNum < minAmount) {
      setError(`Minimum is ${minAmount} ${currency}`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          creator_id: creator.id,
          task_id: selectedTask?.id || null,
          custom_task_text: requestMode === 'custom' ? customTask : null,
          is_free_tip: false,
          requester_name: name,
          amount: amountNum,
          message,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret)
      setTaskRequestId(data.task_request_id)
      setMyRequestIds(prev => [...prev, data.task_request_id])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function resetAll() {
    setSuccess(false)
    setTipId(null)
    setTaskRequestId(null)
    setClientSecret(null)
    setActiveZone(null)
    setRequestMode(null)
    setSelectedTask(null)
    setCustomTask('')
    setAmount('')
    setMessage('')
    setName('')
    setError('')
    setShowHistory(false)
  }

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  if (!creator) return (
    <main className="min-h-screen bg-[#08080C] text-white flex items-center justify-center">
      <p className="text-white/25">Creator not found</p>
    </main>
  )

  // Success screen
  if (success) return (
    <>
      <SuccessScreen
        taskRequestId={taskRequestId || tipId || ''}
        creatorName={creator.display_name}
        taskLabel={activeZone === 'tip' ? 'Free tip' : selectedTask?.title || customTask}
        amount={parseFloat(amount)}
        currency={currency}
        isTip={activeZone === 'tip'}
        onSendAnother={resetAll}
        onViewHistory={() => setShowHistory(true)}
      />
      {showHistory && session && (
        <FanHistory
          sessionId={session.id}
          requesterName={name}
          requestIds={myRequestIds}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )

  // Checkout screen
  if (clientSecret) return (
    <main className="min-h-screen bg-[#08080C] text-white p-6">
      <div className="max-w-md mx-auto pt-8">
        <div className="text-center mb-8">
          <p className="text-white/35 text-sm mb-1">{creator.display_name}</p>
          <h1 className="text-2xl font-bold text-white">
            {activeZone === 'tip' ? '💸 Tip' : selectedTask?.title || customTask}
          </h1>
          <p className="text-white/40 mt-1">{amount} {currency} · from {name}</p>
        </div>
        <div className="bg-[#111117] rounded-2xl p-6 border border-white/[0.06]">
          <StripeCheckout
            clientSecret={clientSecret}
            taskRequestId={taskRequestId || ''}
            tipId={tipId || ''}
            onSuccess={() => setSuccess(true)}
          />
        </div>
        <button onClick={() => { setClientSecret(null); setTipId(null); setTaskRequestId(null) }}
          className="w-full text-white/20 text-sm py-4 hover:text-white/40 transition mt-2">
          ← Go back
        </button>
      </div>
    </main>
  )

  const canSubmit = activeZone !== null && (
    (activeZone === 'tip' && !!amount && !!name) ||
    (activeZone === 'request' && !!requestMode && !!amount && !!name &&
      (requestMode === 'task' ? !!selectedTask : !!customTask))
  )

  return (
    <main className="min-h-screen bg-[#08080C] text-white pb-40">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-[#4AFFD4] opacity-[0.03] blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="pt-10 pb-6 px-6 text-center border-b border-white/[0.05] bg-[#0D0D12] relative z-10">
        <div className="w-14 h-14 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center mx-auto mb-3 text-xl font-bold text-[#4AFFD4]">
          {creator.display_name[0]}
        </div>
        <h1 className="text-lg font-semibold text-white">{creator.display_name}</h1>
        <div className="flex items-center justify-center gap-3 mt-2">
          {session ? (
            <div className="flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" />
              <span className="text-[#4AFFD4] text-xs font-semibold">Session active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.05] px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
              <span className="text-white/30 text-xs">Tips only · no active session</span>
            </div>
          )}
          {name && session && (
            <button onClick={() => setShowHistory(true)}
              className="text-white/25 text-xs hover:text-white/50 transition underline">
              My requests
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-3 relative z-10">

        {/* ── TIP ZONE — always visible ── */}
        <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          activeZone === 'tip'
            ? 'bg-[#0F1A17] border-[#4AFFD4]/30'
            : 'bg-[#111117] border-white/[0.06]'
        }`}>
          <button onClick={() => switchZone('tip')}
            className="w-full px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                activeZone === 'tip' ? 'bg-[#4AFFD4]/15' : 'bg-white/[0.05]'
              }`}>💸</div>
              <div className="text-left">
                <p className="font-semibold text-sm text-white">Send a tip</p>
                <p className="text-white/30 text-xs mt-0.5">Always available · min {globalMin} {currency}</p>
              </div>
            </div>
            <span className={`text-white/25 text-xs transition-transform duration-200 ${activeZone === 'tip' ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {activeZone === 'tip' && (
            <div className="px-5 pb-5 space-y-3 border-t border-white/[0.05] pt-4">
              <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))}
                placeholder="Your name"
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
              <div className="relative">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder={`Amount (min ${globalMin})`}
                  min={globalMin}
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 pr-16 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                <span className="absolute right-4 top-3 text-white/25 text-sm">{currency}</span>
              </div>
              {/* Quick amounts */}
              <div className="flex gap-2">
                {[10, 20, 50, 100].filter(v => v >= globalMin).map(v => (
                  <button key={v} onClick={() => setAmount(v.toString())}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                      amount === v.toString()
                        ? 'bg-[#4AFFD4] text-[#08080C]'
                        : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08]'
                    }`}>{v}</button>
                ))}
              </div>
              <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))}
                placeholder="Message (optional)"
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
            </div>
          )}
        </div>

        {/* ── REQUEST ZONE — only if session active ── */}
        {session ? (
          <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
            activeZone === 'request'
              ? 'bg-[#0F0F1A] border-[#4AFFD4]/30'
              : 'bg-[#111117] border-white/[0.06]'
          }`}>
            <button onClick={() => switchZone('request')}
              className="w-full px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                  activeZone === 'request' ? 'bg-[#4AFFD4]/15' : 'bg-white/[0.05]'
                }`}>🎯</div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-white">Send a request</p>
                  <p className="text-white/30 text-xs mt-0.5">Session active · paid on completion</p>
                </div>
              </div>
              <span className={`text-white/25 text-xs transition-transform duration-200 ${activeZone === 'request' ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {activeZone === 'request' && (
              <div className="px-5 pb-5 border-t border-white/[0.05] pt-4 space-y-3">

                {/* Request type selector */}
                <div className="flex gap-2">
                  {session.show_tasks && tasks.length > 0 && (
                    <button onClick={() => selectRequestMode('task')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition border ${
                        requestMode === 'task'
                          ? 'bg-[#4AFFD4]/10 border-[#4AFFD4]/30 text-[#4AFFD4]'
                          : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:bg-white/[0.07]'
                      }`}>🎯 From list</button>
                  )}
                  {session.allow_custom_tasks && (
                    <button onClick={() => selectRequestMode('custom')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition border ${
                        requestMode === 'custom'
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                          : 'bg-white/[0.04] border-white/[0.06] text-white/40 hover:bg-white/[0.07]'
                      }`}>✏️ Custom</button>
                  )}
                </div>

                {/* Task list */}
                {requestMode === 'task' && (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <button key={task.id} onClick={() => selectTask(task)}
                        className={`w-full rounded-xl p-3.5 text-left transition border ${
                          selectedTask?.id === task.id
                            ? 'bg-[#4AFFD4] text-[#08080C] border-[#4AFFD4]'
                            : 'bg-[#08080C] hover:bg-white/[0.04] text-white border-white/[0.06]'
                        }`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{task.title}</span>
                          <span className={`text-xs ${selectedTask?.id === task.id ? 'text-[#08080C]/60' : 'text-white/25'}`}>
                            {task.suggested_amount
                              ? `${task.suggested_amount} ${currency}`
                              : `min ${Math.max(task.min_amount || 0, globalMin)} ${currency}`}
                          </span>
                        </div>
                        {task.description && (
                          <p className={`text-xs mt-1 ${selectedTask?.id === task.id ? 'text-[#08080C]/50' : 'text-white/25'}`}>
                            {task.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom textarea */}
                {requestMode === 'custom' && (
                  <textarea value={customTask} onChange={e => setCustomTask(e.target.value.slice(0, 200))}
                    placeholder="What would you like them to do?"
                    rows={3}
                    className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-purple-500/40 transition resize-none text-white" />
                )}

                {/* Shared fields */}
                {requestMode && (
                  <>
                    <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))}
                      placeholder="Your name"
                      className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                    <div className="relative">
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                        placeholder={`Your offer (min ${requestMode === 'task' && selectedTask
                          ? Math.max(selectedTask.min_amount || 0, globalMin)
                          : globalMin})`}
                        readOnly={requestMode === 'task' && !!selectedTask?.suggested_amount}
                        className={`w-full border rounded-xl px-4 py-3 pr-16 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white ${
                          requestMode === 'task' && selectedTask?.suggested_amount
                            ? 'bg-white/[0.03] border-white/[0.04] cursor-not-allowed text-white/30'
                            : 'bg-[#08080C] border-white/[0.08]'
                        }`} />
                      <span className="absolute right-4 top-3 text-white/25 text-sm">{currency}</span>
                    </div>
                    <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))}
                      placeholder="Message (optional)"
                      className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* No session — show disabled request zone */
          <div className="rounded-2xl border border-white/[0.04] bg-[#111117]/50 px-5 py-4 flex items-center gap-3 opacity-50">
            <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg">🎯</div>
            <div>
              <p className="font-semibold text-sm text-white/50">Requests unavailable</p>
              <p className="text-white/20 text-xs mt-0.5">Creator is not in an active session</p>
            </div>
          </div>
        )}

        {/* Join as fan CTA */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm font-medium">New to TipTask?</p>
            <p className="text-white/25 text-xs mt-0.5">Join as a fan — track history, follow creators</p>
          </div>
          <a href={`/fan/register?ref=${params.username}`}
            className="shrink-0 bg-white/[0.07] hover:bg-white/[0.10] border border-white/[0.08] text-white/60 hover:text-white text-xs font-semibold px-4 py-2 rounded-xl transition">
            Join free →
          </a>
        </div>

        {error && <p className="text-red-400 text-sm px-1">{error}</p>}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#08080C] via-[#08080C]/95 to-transparent pt-8 z-20">
        <div className="max-w-md mx-auto">
          <button
            onClick={activeZone === 'tip' ? handleTipSubmit : handleRequestSubmit}
            disabled={submitting || !canSubmit}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-30 bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF] active:scale-[0.98]">
            {submitting ? 'Processing...' :
             !canSubmit ? 'Select an option above' :
             activeZone === 'tip'
               ? `💸 Send tip · ${amount || '0'} ${currency}`
               : `🎯 Send request · ${amount || '0'} ${currency}`}
          </button>
          <p className="text-center text-white/15 text-xs mt-2">
            {activeZone === 'tip'
              ? 'Charged immediately · no refunds'
              : 'Full refund if declined · Stripe secured'}
          </p>
        </div>
      </div>

      {showHistory && session && (
        <FanHistory
          sessionId={session.id}
          requesterName={name}
          requestIds={myRequestIds}
          onClose={() => setShowHistory(false)}
        />
      )}
    </main>
  )
}
