'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { getPlatformFeeRate } from '@/lib/fees'
import type { Creator } from '@/types'
import type { CreatorTier } from '@/lib/fees'

function PaymentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'refresh'>('idle')

  useEffect(() => {
    const stripeParam = searchParams.get('stripe')
    if (stripeParam === 'success') setStatus('success')
    if (stripeParam === 'refresh') setStatus('refresh')
  }, [searchParams])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const stripeParam = searchParams.get('stripe')
      if (stripeParam === 'success') {
        await supabase.from('creators')
          .update({ stripe_onboarded: true })
          .eq('id', user.id)
      }

      const { data } = await supabase
        .from('creators').select('*').eq('id', user.id).single()
      setCreator(data)
      setLoading(false)
    }
    load()
  }, [router, searchParams])

  async function connectStripe() {
    if (!creator) return
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: creator.id,
          return_url: window.location.origin + '/dashboard/payments',
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err: any) {
      alert(err.message)
      setConnecting(false)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </main>
  )

  const feeRate = getPlatformFeeRate(
    (creator?.tier || 'free') as CreatorTier,
    creator?.custom_commission_rate
  )

  const tierLabel: Record<string, string> = {
    free: 'Free', promoter: 'Promoter', premium_a: 'Premium A', premium_b: 'Premium B',
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition">
            Back
          </button>
          <h1 className="text-2xl font-bold">Payments</h1>
        </div>

        {status === 'success' && (
          <div className="bg-green-900/30 border border-green-700 rounded-2xl p-4 mb-6">
            <p className="text-green-400 font-semibold">Stripe connected successfully!</p>
            <p className="text-green-600 text-sm mt-1">You can now receive payments from viewers.</p>
          </div>
        )}
        {status === 'refresh' && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-2xl p-4 mb-6">
            <p className="text-yellow-400 font-semibold">Onboarding incomplete</p>
            <p className="text-yellow-600 text-sm mt-1">Please complete your Stripe setup to receive payments.</p>
          </div>
        )}

        <div className="bg-gray-900 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Stripe Account</h2>
            {creator?.stripe_onboarded
              ? <span className="text-green-400 text-sm font-medium">Connected</span>
              : <span className="text-yellow-400 text-sm font-medium">Not connected</span>}
          </div>
          {creator?.stripe_onboarded ? (
            <div className="space-y-2">
              <p className="text-gray-400 text-sm">Your Stripe account is connected and ready to receive payments.</p>
              <p className="text-gray-600 text-xs font-mono">{creator.stripe_account_id}</p>
              <button onClick={connectStripe} disabled={connecting}
                className="mt-2 text-sm text-gray-500 hover:text-gray-300 transition underline">
                Reconnect or update account
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-4">
                Connect your Stripe account to receive payments. You will need to complete Stripe verification.
              </p>
              <button onClick={connectStripe} disabled={connecting}
                className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-100 transition disabled:opacity-50">
                {connecting ? 'Redirecting to Stripe...' : 'Connect Stripe Account'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-lg mb-4">Your Plan</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium">{tierLabel[creator?.tier || 'free']}</p>
              <p className="text-gray-400 text-sm mt-0.5">
                Platform fee: {(feeRate * 100).toFixed(0)}% per transaction
              </p>
            </div>
            <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">Current plan</span>
          </div>

          {(creator?.tier === 'free' || !creator?.tier) && (
            <div className="space-y-3 mt-4 pt-4 border-t border-gray-800">
              <p className="text-gray-400 text-sm mb-3">Upgrade to reduce your platform fee:</p>
              <div className="bg-black rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">Premium A</p>
                    <p className="text-gray-400 text-sm">Max 10% platform fee</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">$16<span className="text-gray-500 text-sm font-normal">/mo</span></p>
                    <p className="text-xs text-gray-600 mt-1">Coming soon</p>
                  </div>
                </div>
              </div>
              <div className="bg-black rounded-xl p-4 border border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">Premium B</p>
                    <p className="text-gray-400 text-sm">Max 5% platform fee</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">$28<span className="text-gray-500 text-sm font-normal">/mo</span></p>
                    <p className="text-xs text-gray-600 mt-1">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-3">How fees work</h2>
          <div className="space-y-2 text-sm text-gray-400">
            <p>Viewers pay the Stripe processing fee on top of the task amount</p>
            <p>Platform fee ({(feeRate * 100).toFixed(0)}%) is deducted from the task amount</p>
            <p>You receive the task amount minus the platform fee</p>
            <p>Wallet payments have no per-transaction Stripe fee</p>
            <p>You are responsible for any payment disputes via Stripe</p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    }>
      <PaymentsContent />
    </Suspense>
  )
}
