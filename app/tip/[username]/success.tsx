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
    <main className="min-h-screen bg-black text-white flex flex-col p-6">
      <div className="max-w-md mx-auto w-full pt-12 flex-1">

        {isTip && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💸</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
            <p className="text-gray-400">{creatorName} received your tip</p>
            <p className="text-green-400 text-sm mt-2 font-medium">{amount} {currency} — Payment processed</p>
          </div>
        )}

        {!isTip && (status === 'pending' || status === 'draft') && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full border-4 border-yellow-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-3xl">⏳</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Request sent!</h1>
            <p className="text-gray-400">Waiting for {creatorName} to accept</p>
            {timeLeft && timeLeft !== 'Expired' && (
              <div className="mt-4 inline-flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-full">
                <span className="text-gray-400 text-sm">Expires in</span>
                <span className="font-mono font-bold text-yellow-400">{timeLeft}</span>
              </div>
            )}
            {timeLeft === 'Expired' && (
              <div className="mt-4 inline-flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-full">
                <span className="text-gray-400 text-sm">Request expired — you won't be charged</span>
              </div>
            )}
          </div>
        )}

        {!isTip && status === 'accepted' && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-green-900/40 border-4 border-green-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-green-400">Accepted!</h1>
            <p className="text-gray-400">{creatorName} is on it</p>
            <p className="text-gray-600 text-sm mt-2">You'll be charged when they mark it done</p>
          </div>
        )}

        {!isTip && status === 'completed' && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Done!</h1>
            <p className="text-gray-400">{creatorName} completed your request</p>
            <p className="text-green-400 text-sm mt-2 font-medium">{amount} {currency} charged</p>
          </div>
        )}

        {!isTip && (status === 'declined' || status === 'refunded') && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-gray-900 border-4 border-gray-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">↩</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Declined</h1>
            <p className="text-gray-400">{creatorName} couldn't do this one</p>
            <p className="text-green-400 text-sm mt-2">Full refund — you were not charged</p>
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl p-5 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Your request</p>
              <p className="font-medium">{taskLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Amount</p>
              <p className="font-bold">{amount} {currency}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isTip || status === 'completed' ? 'bg-green-500' :
              status === 'accepted' ? 'bg-green-500 animate-pulse' :
              status === 'pending' || status === 'draft' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
            }`} />
            <span className="text-sm text-gray-400 capitalize">
              {isTip ? 'Paid' : status === 'draft' ? 'Processing...' : status}
            </span>
          </div>
        </div>

        {showSendAnother && (
          <button onClick={onSendAnother}
            className="w-full bg-white text-black py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition mb-3">
            Send another request
          </button>
        )}

        {!isTip && (status === 'pending' || status === 'draft') && (
          <button onClick={onSendAnother}
            className="w-full border border-gray-700 text-gray-400 py-3 rounded-2xl font-medium hover:border-gray-500 transition">
            + Send another request
          </button>
        )}

        {onViewHistory && (
          <button onClick={onViewHistory}
            className="w-full text-white/30 text-sm py-2 hover:text-white/60 transition mt-1">
            📋 View my requests this session
          </button>
        )}
        <p className="text-center text-gray-600 text-xs mt-4">Powered by TipTask · Secured by Stripe</p>
      </div>
    </main>
  )
}
