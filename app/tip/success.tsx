'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  taskRequestId: string
  creatorName: string
  taskLabel: string
  amount: number
  currency: string
  isTip?: boolean
  onSendAnother: () => void
  onViewHistory?: () => void
}

export function SuccessScreen({ taskRequestId, creatorName, taskLabel, amount, currency, isTip, onSendAnother, onViewHistory }: Props) {
  const [status, setStatus] = useState<'draft' | 'pending' | 'accepted' | 'declined' | 'completed' | 'refunded'>(
    isTip ? 'completed' : 'draft'
  )
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('task_requests')
        .select('status, expires_at')
        .eq('id', taskRequestId)
        .single()
      if (data) {
        setExpiresAt(data.expires_at)
        if (!isTip) setStatus(data.status)
      }
    }
    load()

    if (isTip) return

    const channel = supabase
      .channel('request-status-' + taskRequestId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'task_requests',
        filter: `id=eq.${taskRequestId}`,
      }, (payload) => {
        setStatus(payload.new.status)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskRequestId, isTip])

  useEffect(() => {
    if (!expiresAt || status !== 'pending' || isTip) return
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Expired'); clearInterval(interval); return }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, status, isTip])

  const showSendAnother = isTip || status === 'declined' || status === 'refunded' || status === 'completed' || timeLeft === 'Expired'

  return (
    <main className="min-h-screen bg-[#08080C] text-white flex flex-col p-6">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#4AFFD4] opacity-[0.03] blur-[100px] pointer-events-none" />

      <div className="max-w-md mx-auto w-full pt-12 flex-1 relative z-10">

        {isTip && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-[#4AFFD4]/10 border-2 border-[#4AFFD4]/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💸</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
            <p className="text-white/40">{creatorName} received your tip</p>
            <p className="text-[#4AFFD4] text-sm mt-2 font-medium">{amount} {currency} — Payment processed</p>
          </div>
        )}

        {!isTip && (status === 'pending' || status === 'draft') && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full border-4 border-amber-400/40 bg-amber-500/[0.06] flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-3xl">⏳</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Request sent!</h1>
            <p className="text-white/40">Waiting for {creatorName} to accept</p>
            {timeLeft && timeLeft !== 'Expired' && (
              <div className="mt-4 inline-flex items-center gap-2 bg-[#111117] border border-white/[0.08] px-4 py-2 rounded-full">
                <span className="text-white/35 text-sm">Expires in</span>
                <span className="font-mono font-bold text-amber-400">{timeLeft}</span>
              </div>
            )}
            {timeLeft === 'Expired' && (
              <div className="mt-4 inline-flex items-center gap-2 bg-[#111117] border border-white/[0.08] px-4 py-2 rounded-full">
                <span className="text-white/35 text-sm">Request expired — you won't be charged</span>
              </div>
            )}
          </div>
        )}

        {!isTip && status === 'accepted' && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-[#4AFFD4]/10 border-4 border-[#4AFFD4]/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-[#4AFFD4]">Accepted!</h1>
            <p className="text-white/40">{creatorName} is on it</p>
            <p className="text-white/25 text-sm mt-2">You'll be charged when they mark it done</p>
          </div>
        )}

        {!isTip && status === 'completed' && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-[#4AFFD4]/10 border-4 border-[#4AFFD4]/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Done!</h1>
            <p className="text-white/40">{creatorName} completed your request</p>
            <p className="text-[#4AFFD4] text-sm mt-2 font-medium">{amount} {currency} charged</p>
          </div>
        )}

        {!isTip && (status === 'declined' || status === 'refunded') && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-white/[0.04] border-4 border-white/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">↩</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Declined</h1>
            <p className="text-white/40">{creatorName} couldn't do this one</p>
            <p className="text-[#4AFFD4] text-sm mt-2">Full refund — you were not charged</p>
          </div>
        )}

        {/* Request card */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/25 text-xs uppercase tracking-wider mb-1">Your request</p>
              <p className="font-medium text-white">{taskLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-white/25 text-xs uppercase tracking-wider mb-1">Amount</p>
              <p className="font-bold text-white">{amount} {currency}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isTip || status === 'completed' ? 'bg-[#4AFFD4]' :
              status === 'accepted' ? 'bg-[#4AFFD4] animate-pulse' :
              status === 'pending' || status === 'draft' ? 'bg-amber-400 animate-pulse' : 'bg-white/10'
            }`} />
            <span className="text-sm text-white/35 capitalize">
              {isTip ? 'Paid' : status === 'draft' ? 'Processing...' : status}
            </span>
          </div>
        </div>

        {showSendAnother && (
          <button onClick={onSendAnother}
            className="w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-bold text-lg hover:bg-[#6FFFDF] transition mb-3">
            Send another request
          </button>
        )}

        {!isTip && (status === 'pending' || status === 'draft') && (
          <button onClick={onSendAnother}
            className="w-full border border-white/[0.08] text-white/40 py-3 rounded-2xl font-medium hover:border-white/15 transition">
            + Send another request
          </button>
        )}

        {onViewHistory && (
          <button onClick={onViewHistory}
            className="w-full text-white/25 text-sm py-2 hover:text-white/45 transition mt-1">
            📋 View my requests this session
          </button>
        )}
        <p className="text-center text-white/15 text-xs mt-4">Powered by TipTask · Secured by Stripe</p>
      </div>
    </main>
  )
}
