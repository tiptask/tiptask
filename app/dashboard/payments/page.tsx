'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

const PLANS = [
  { id: 'free', name: 'Free', fee: 0.15, price: null, priceLabel: 'Free forever', desc: '15% platform fee' },
  { id: 'promoter', name: 'Premium A', fee: 0.10, price: 'PREMIUM_A', priceLabel: '$16/mo', desc: '10% platform fee' },
  { id: 'premium', name: 'Premium B', fee: 0.05, price: 'PREMIUM_B', priceLabel: '$28/mo', desc: '5% platform fee' },
]

function PaymentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'info' | 'error', msg: string } | null>(null)

  useEffect(() => {
    const sub = searchParams.get('subscription')
    const stripeParam = searchParams.get('stripe')
    if (sub === 'success') setNotice({ type: 'success', msg: '🎉 Subscription activated! Your plan has been upgraded.' })
    if (sub === 'cancelled') setNotice({ type: 'info', msg: 'Subscription cancelled — no charge made.' })
    if (stripeParam === 'success') setNotice({ type: 'success', msg: '✓ Stripe account connected!' })
  }, [searchParams])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const stripeParam = searchParams.get('stripe')
      if (stripeParam === 'success') {
        await supabase.from('users').update({ stripe_onboarded: true }).eq('id', user.id)
      }

      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      setProfile(p)
      setLoading(false)
    }
    load()
  }, [router, searchParams])

  async function connectStripe() {
    if (!profile) return
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id, return_url: window.location.href.split('?')[0] }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch (err: any) {
      setNotice({ type: 'error', msg: err.message })
      setConnecting(false)
    }
  }

  async function upgradePlan(planKey: string) {
    if (!profile) return
    const priceId = planKey === 'PREMIUM_A'
      ? process.env.NEXT_PUBLIC_STRIPE_PREMIUM_A_PRICE_ID
      : process.env.NEXT_PUBLIC_STRIPE_PREMIUM_B_PRICE_ID

    setUpgrading(planKey)
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id, price_id: priceId, return_url: window.location.href.split('?')[0] }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch (err: any) {
      setNotice({ type: 'error', msg: err.message })
      setUpgrading(null)
    }
  }

  async function cancelSubscription() {
    if (!profile?.stripe_subscription_id) return
    setCancelling(true)
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id }),
      })
      const data = await res.json()
      if (data.success) {
        setNotice({ type: 'info', msg: `Plan will stay active until ${new Date(data.period_end).toLocaleDateString()}, then revert to Free.` })
        const { data: p } = await supabase.from('users').select('*').eq('id', profile.id).single()
        setProfile(p)
      }
    } catch (err: any) {
      setNotice({ type: 'error', msg: err.message })
    }
    setCancelling(false)
  }

  const currentTier = profile?.tier || 'free'
  const commissionRate = profile?.custom_commission_rate ?? 0.15
  const isPremiumExpiring = profile?.premium_expires_at && currentTier !== 'free'

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
      <div className="max-w-xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <BackButton href="/dashboard" />
          <h1 className="text-2xl font-bold text-white">Payments</h1>
        </div>

        {notice && (
          <div className={`rounded-2xl px-5 py-4 mb-5 border ${
            notice.type === 'success' ? 'bg-[#4AFFD4]/[0.08] border-[#4AFFD4]/20 text-[#4AFFD4]' :
            notice.type === 'error' ? 'bg-red-500/[0.08] border-red-500/20 text-red-400' :
            'bg-white/[0.06] border-white/[0.08] text-white/60'
          }`}>
            <p className="text-sm font-medium">{notice.msg}</p>
          </div>
        )}

        {/* Stripe Connect */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Stripe Account</h2>
            <span className={`text-sm font-semibold ${profile?.stripe_onboarded ? 'text-[#4AFFD4]' : 'text-amber-400'}`}>
              {profile?.stripe_onboarded ? '✓ Connected' : 'Not connected'}
            </span>
          </div>
          <p className="text-white/40 text-sm mb-4">
            {profile?.stripe_onboarded
              ? `Account: ${profile.stripe_account_id}`
              : 'Connect Stripe to receive tips and payments.'}
          </p>
          <button onClick={connectStripe} disabled={connecting}
            className="w-full bg-[#4AFFD4] text-[#08080C] py-3.5 rounded-2xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
            {connecting ? 'Connecting...' : profile?.stripe_onboarded ? 'Manage Stripe Account' : 'Connect Stripe Account'}
          </button>
        </div>

        {/* Plans */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-5">
          <h2 className="font-bold text-white mb-1">Your Plan</h2>
          <p className="text-white/30 text-sm mb-5">Current fee: <span className="text-[#4AFFD4] font-bold">{Math.round(commissionRate * 100)}%</span> per transaction</p>

          <div className="space-y-3">
            {PLANS.map(plan => {
              const isCurrent = currentTier === plan.id
              const isUpgrade = plan.id !== 'free' && !isCurrent
              const priceKey = plan.price

              return (
                <div key={plan.id} className={`rounded-2xl border p-4 transition ${
                  isCurrent ? 'border-[#4AFFD4]/30 bg-[#4AFFD4]/[0.05]' : 'border-white/[0.06] bg-[#08080C]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold">{plan.name}</p>
                      {isCurrent && <span className="bg-[#4AFFD4]/10 text-[#4AFFD4] text-xs px-2 py-0.5 rounded-full font-semibold">Current</span>}
                    </div>
                    <p className="text-white font-bold">{plan.priceLabel}</p>
                  </div>
                  <p className="text-white/40 text-sm mb-3">{plan.desc}</p>

                  {/* Example earnings */}
                  <div className="bg-white/[0.03] rounded-xl px-3 py-2 mb-3">
                    <p className="text-white/25 text-xs">On 1,000 RON earned → you keep <span className="text-white/60 font-semibold">{(1000 * (1 - plan.fee)).toFixed(0)} RON</span></p>
                  </div>

                  {isUpgrade && (
                    <button
                      onClick={() => priceKey && upgradePlan(priceKey)}
                      disabled={upgrading === priceKey}
                      className="w-full bg-white/[0.07] hover:bg-white/[0.10] text-white py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 border border-white/[0.08]">
                      {upgrading === priceKey ? 'Redirecting...' : `Upgrade to ${plan.name} →`}
                    </button>
                  )}

                  {isCurrent && plan.id !== 'free' && (
                    <div className="space-y-2">
                      {isPremiumExpiring && profile?.premium_expires_at && (
                        <p className="text-white/30 text-xs text-center">
                          Active until {new Date(profile.premium_expires_at).toLocaleDateString()}
                        </p>
                      )}
                      {profile?.stripe_subscription_id && (
                        <button onClick={cancelSubscription} disabled={cancelling}
                          className="w-full border border-red-500/20 text-red-400/60 hover:text-red-400 py-2 rounded-xl text-xs transition disabled:opacity-50">
                          {cancelling ? 'Cancelling...' : 'Cancel subscription'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="font-bold text-white mb-3">How fees work</h2>
          <div className="space-y-2 text-sm text-white/40">
            <p>• TipTask takes <span className="text-white/60">{Math.round(commissionRate * 100)}%</span> of each transaction</p>
            <p>• Stripe processing fee (~2.9% + 30¢) is <span className="text-white/60">optional</span> for the viewer to cover</p>
            <p>• If viewer doesn't cover it, it's deducted from the tip amount</p>
            <p>• You receive payouts automatically via Stripe Connect</p>
            <p>• No monthly minimums on the Free plan</p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function PaymentsPage() {
  return (
    <>
      <TopNav />
      <Suspense fallback={<main className="min-h-screen bg-[#08080C] pt-14" />}>
        <PaymentsContent />
      </Suspense>
      <BottomNav />
    </>
  )
}
