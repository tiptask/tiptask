'use client'
import React from 'react'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StripeCheckout } from './checkout'
import { SuccessScreen } from './success'
import { FanHistory } from './history'
import type { Creator, Session, Task } from '@/types'

type ActiveMode = 'task' | 'custom' | 'tip' | null

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
  const [activeMode, setActiveMode] = useState<ActiveMode>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [customTask, setCustomTask] = useState('')
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [taskRequestId, setTaskRequestId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isTip, setIsTip] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [myRequestIds, setMyRequestIds] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: creatorData } = await supabase
        .from('creators').select('*').eq('username', params.username).single()
      if (!creatorData) { setLoading(false); return }
      setCreator(creatorData)

      const { data: sessionData } = await supabase
        .from('sessions').select('*')
        .eq('creator_id', creatorData.id).eq('is_active', true).single()
      setSession(sessionData)

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

  function toggleMode(mode: ActiveMode) {
    if (activeMode === mode) { setActiveMode(null); return }
    setActiveMode(mode)
    setSelectedTask(null)
    setAmount('')
    if (mode === 'tip') setAmount(Math.max(session?.free_tip_min_amount || 5, globalMin).toString())
  }

  function selectTask(task: Task) {
    setSelectedTask(task)
    if (task.suggested_amount) setAmount(task.suggested_amount.toString())
    else if (task.min_amount && task.min_amount > globalMin) setAmount(task.min_amount.toString())
    else setAmount(globalMin.toString())
  }

  async function handleSubmit() {
    if (!creator || !session) return
    if (!name.trim()) { setError('Enter your name'); return }
    if (activeMode === 'task' && !selectedTask) { setError('Select a task'); return }
    if (activeMode === 'custom' && !customTask.trim()) { setError('Describe your task'); return }

    const amountNum = parseFloat(amount)

    let minAmount = globalMin
    if (activeMode === 'tip') {
      minAmount = Math.max(session.free_tip_min_amount || 5, globalMin)
    } else if (activeMode === 'task' && selectedTask) {
      minAmount = Math.max(selectedTask.min_amount || 0, globalMin)
      if (selectedTask.suggested_amount) minAmount = selectedTask.suggested_amount
    } else if (activeMode === 'custom') {
      minAmount = globalMin
    }

    if (!amountNum || amountNum < minAmount) {
      setError(`Minimum amount is ${minAmount} ${currency}`)
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
          custom_task_text: activeMode === 'custom' ? customTask : null,
          is_free_tip: activeMode === 'tip',
          requester_name: name,
          amount: amountNum,
          message,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.client_secret)
      setTaskRequestId(data.task_request_id)
      setIsTip(data.is_free_tip === true)
      setMyRequestIds(prev => [...prev, data.task_request_id])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function resetAll() {
    setSuccess(false)
    setTaskRequestId(null)
    setClientSecret(null)
    setIsTip(false)
    setShowHistory(false)
    setActiveMode(null)
    setSelectedTask(null)
    setCustomTask('')
    setAmount('')
    setMessage('')
    setName('')
    setError('')
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

  if (!session) return (
    <main className="min-h-screen bg-[#08080C] text-white flex flex-col items-center justify-center p-8 text-center">
      <p className="text-5xl mb-5">😴</p>
      <h2 className="text-xl font-semibold mb-2">{creator.display_name} is offline</h2>
      <p className="text-white/40 text-sm">Check back when they go live</p>
    </main>
  )

  if (success && taskRequestId) return (
    <>
      <SuccessScreen
        taskRequestId={taskRequestId}
        creatorName={creator.display_name}
        taskLabel={activeMode === 'tip' ? 'Free tip' : selectedTask?.title || customTask}
        amount={parseFloat(amount)}
        currency={currency}
        isTip={isTip}
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

  if (clientSecret) return (
    <>
      <main className="min-h-screen bg-[#08080C] text-white p-6">
        <div className="max-w-md mx-auto pt-8">
          <div className="text-center mb-8">
            <p className="text-white/35 text-sm mb-1">{creator.display_name}</p>
            <h1 className="text-2xl font-bold text-white">
              {activeMode === 'tip' ? 'Free tip' : selectedTask?.title || customTask}
            </h1>
            <p className="text-white/40 mt-1">{amount} {currency} · from {name}</p>
          </div>
          <div className="bg-[#111117] rounded-2xl p-6 border border-white/[0.06]">
            <StripeCheckout clientSecret={clientSecret} onSuccess={() => setSuccess(true)} />
          </div>
          <button onClick={() => setClientSecret(null)}
            className="w-full text-white/20 text-sm py-4 hover:text-white/40 transition mt-2">
            ← Go back
          </button>
        </div>
      </main>
      {showHistory && session && (
        <FanHistory
          sessionId={session.id}
          requesterName={name}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )

  const minTip = Math.max(session.free_tip_min_amount || 5, globalMin)

  return (
    <main className="min-h-screen bg-[#08080C] text-white pb-40">
      {/* Subtle glow top */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-[#4AFFD4] opacity-[0.03] blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="pt-10 pb-6 px-6 text-center border-b border-white/[0.05] bg-[#0D0D12] relative z-10">
        <div className="w-14 h-14 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center mx-auto mb-3 text-xl font-bold text-[#4AFFD4]">
          {creator.display_name[0]}
        </div>
        <h1 className="text-lg font-semibold text-white">{creator.display_name}</h1>
        <div className="flex items-center justify-center gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" />
            <span className="text-[#4AFFD4] text-xs font-medium">Session active</span>
          </div>
          {name && session && (
            <button onClick={() => setShowHistory(true)}
              className="text-white/25 text-xs hover:text-white/50 transition underline">
              My requests
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-2 relative z-10">

        {/* Tasks */}
        {session.show_tasks && tasks.length > 0 && (
          <div className={`rounded-2xl border transition-all duration-200 overflow-hidden bg-[#111117] ${
            activeMode === 'task' ? 'border-[#4AFFD4]/30' : 'border-white/[0.06]'
          }`}>
            <button
              onClick={() => toggleMode('task')}
              className="w-full px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🎯</span>
                <div className="text-left">
                  <p className="font-semibold text-sm text-white">Request a task</p>
                  <p className="text-white/30 text-xs mt-0.5">{tasks.length} tasks available</p>
                </div>
              </div>
              <span className={`text-white/25 transition-transform duration-200 ${activeMode === 'task' ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {activeMode === 'task' && (
              <div className="px-5 pb-5 space-y-4">
                <div className="space-y-2">
                  {tasks.map(task => (
                    <button key={task.id} onClick={() => selectTask(task)}
                      className={`w-full rounded-xl p-3.5 text-left transition-all border ${
                        selectedTask?.id === task.id
                          ? 'bg-[#4AFFD4] text-[#08080C] border-[#4AFFD4]'
                          : 'bg-[#08080C] hover:bg-white/[0.04] text-white border-white/[0.06]'
                      }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{task.title}</span>
                        <span className={`text-xs ${selectedTask?.id === task.id ? 'text-[#08080C]/60' : 'text-white/25'}`}>
                          {task.suggested_amount ? `${task.suggested_amount} ${currency}` :
                           task.min_amount && task.min_amount > globalMin ? `min ${task.min_amount} ${currency}` : `min ${globalMin} ${currency}`}
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

                {selectedTask && (
                  <div className="space-y-3 pt-1">
                    <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))}
                      placeholder="Your name"
                      className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder={`Amount (min ${Math.max(selectedTask.min_amount || 0, globalMin)} ${currency})`}
                      readOnly={!!selectedTask.suggested_amount}
                      className={`w-full border rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white ${
                        selectedTask.suggested_amount ? 'bg-white/[0.03] border-white/[0.04] cursor-not-allowed text-white/30' : 'bg-[#08080C] border-white/[0.08]'
                      }`} />
                    <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))}
                      placeholder="Message (optional)"
                      className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom task */}
        {session.allow_custom_tasks && (
          <div className={`rounded-2xl border transition-all duration-200 overflow-hidden bg-[#111117] ${
            activeMode === 'custom' ? 'border-[#4AFFD4]/30' : 'border-white/[0.06]'
          }`}>
            <button
              onClick={() => toggleMode('custom')}
              className="w-full px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">✏️</span>
                <div className="text-left">
                  <p className="font-semibold text-sm text-white">Custom request</p>
                  <p className="text-white/30 text-xs mt-0.5">Describe anything you want · min {globalMin} {currency}</p>
                </div>
              </div>
              <span className={`text-white/25 transition-transform duration-200 ${activeMode === 'custom' ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {activeMode === 'custom' && (
              <div className="px-5 pb-5 space-y-3">
                <textarea value={customTask} onChange={e => setCustomTask(e.target.value.slice(0, 200))}
                  placeholder="What would you like them to do?"
                  rows={3}
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition resize-none text-white" />
                <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))}
                  placeholder="Your name"
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder={`Your offer (min ${globalMin} ${currency})`}
                  min={globalMin}
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))}
                  placeholder="Message (optional)"
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
              </div>
            )}
          </div>
        )}

        {/* Free tip */}
        {session.allow_free_tips && (
          <div className={`rounded-2xl border transition-all duration-200 overflow-hidden bg-[#111117] ${
            activeMode === 'tip' ? 'border-[#4AFFD4]/30' : 'border-white/[0.06]'
          }`}>
            <button
              onClick={() => toggleMode('tip')}
              className="w-full px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💸</span>
                <div className="text-left">
                  <p className="font-semibold text-sm text-white">Send a tip</p>
                  <p className="text-white/30 text-xs mt-0.5">Support without a specific task · min {minTip} {currency}</p>
                </div>
              </div>
              <span className={`text-white/25 transition-transform duration-200 ${activeMode === 'tip' ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {activeMode === 'tip' && (
              <div className="px-5 pb-5 space-y-3">
                <input type="text" value={name} onChange={e => setName(e.target.value.slice(0, 30))}
                  placeholder="Your name"
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder={`Amount (min ${minTip} ${currency})`}
                  min={minTip}
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
                <input type="text" value={message} onChange={e => setMessage(e.target.value.slice(0, 120))}
                  placeholder="Message (optional)"
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition text-white" />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm px-1">{error}</p>}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#08080C] via-[#08080C] to-transparent pt-8 z-20">
        <div className="max-w-md mx-auto">
          <button onClick={handleSubmit} disabled={submitting || activeMode === null}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-30 bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF] active:scale-[0.98]">
            {submitting ? 'Processing...' :
             activeMode === null ? 'Select an option above' :
             `Continue → ${amount ? `${amount} ${currency}` : ''}`}
          </button>
          <p className="text-center text-white/20 text-xs mt-2">Full refund if declined · Stripe secured</p>
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
