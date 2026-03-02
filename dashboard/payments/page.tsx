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
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
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
    <main className="min-h-screen bg-[#08080C] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
        </div>

        {status === 'success' && (
          <div className="bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/20 rounded-2xl p-4 mb-6">
            <p className="text-[#4AFFD4] font-semibold">Stripe connected successfully!</p>
            <p className="text-[#4AFFD4]/60 text-sm mt-1">You can now receive payments from viewers.</p>
          </div>
        )}
        {status === 'refresh' && (
          <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-4 mb-6">
            <p className="text-amber-400 font-semibold">Onboarding incomplete</p>
            <p className="text-amber-400/60 text-sm mt-1">Please complete your Stripe setup to receive payments.</p>
          </div>
        )}

        {/* Stripe account */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg text-white">Stripe Account</h2>
            {creator?.stripe_onboarded
              ? <span className="text-[#4AFFD4] text-sm font-medium">Connected</span>
              : <span className="text-amber-400 text-sm font-medium">Not connected</span>}
          </div>
          {creator?.stripe_onboarded ? (
            <div className="space-y-2">
              <p className="text-white/40 text-sm">Your Stripe account is connected and ready to receive payments.</p>
              <p className="text-white/20 text-xs font-mono">{creator.stripe_account_id}</p>
              <button onClick={connectStripe} disabled={connecting}
                className="mt-2 text-sm text-white/30 hover:text-white/60 transition underline">
                Reconnect or update account
              </button>
            </div>
          ) : (
            <div>
              <p className="text-white/40 text-sm mb-4">
                Connect your Stripe account to receive payments. You will need to complete Stripe verification.
              </p>
              <button onClick={connectStripe} disabled={connecting}
                className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
                {connecting ? 'Redirecting to Stripe...' : 'Connect Stripe Account'}
              </button>
            </div>
          )}
        </div>

        {/* Plan */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-6 mb-4">
          <h2 className="font-semibold text-lg mb-4 text-white">Your Plan</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-white">{tierLabel[creator?.tier || 'free']}</p>
              <p className="text-white/40 text-sm mt-0.5">
                Platform fee: {(feeRate * 100).toFixed(0)}% per transaction
              </p>
            </div>
            <span className="text-xs text-white/30 bg-white/[0.04] px-3 py-1 rounded-full">Current plan</span>
          </div>

          {(creator?.tier === 'free' || !creator?.tier) && (
            <div className="space-y-3 mt-4 pt-4 border-t border-white/[0.04]">
              <p className="text-white/40 text-sm mb-3">Upgrade to reduce your platform fee:</p>
              <div className="bg-[#08080C] rounded-xl p-4 border border-white/[0.06]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-white">Premium A</p>
                    <p className="text-white/40 text-sm">Max 10% platform fee</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">$16<span className="text-white/25 text-sm font-normal">/mo</span></p>
                    <p className="text-xs text-white/20 mt-1">Coming soon</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#08080C] rounded-xl p-4 border border-white/[0.06]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-white">Premium B</p>
                    <p className="text-white/40 text-sm">Max 5% platform fee</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">$28<span className="text-white/25 text-sm font-normal">/mo</span></p>
                    <p className="text-xs text-white/20 mt-1">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* How fees work */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-6">
          <h2 className="font-semibold text-lg mb-3 text-white">How fees work</h2>
          <div className="space-y-2 text-sm text-white/35">
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
      <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
      </main>
    }>
      <PaymentsContent />
    </Suspense>
  )
}
