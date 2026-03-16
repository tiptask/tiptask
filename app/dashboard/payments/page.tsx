'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

const PLANS = [
  {
    id: 'starter', name: 'Starter', fee: 0.15, sub: null,
    priceLabel: 'Free forever', desc: '15% platform fee',
    how: 'Default tier for all new creators',
    color: 'border-white/[0.06]',
  },
  {
    id: 'rising', name: 'Rising', fee: 0.12, sub: 'RISING',
    priceLabel: '$9/mo', desc: '12% platform fee',
    how: 'Reach $1,000 lifetime earned OR subscribe',
    color: 'border-blue-500/20',
  },
  {
    id: 'pro', name: 'Pro', fee: 0.10, sub: 'PRO',
    priceLabel: '$19/mo', desc: '10% platform fee',
    how: 'Reach $5,000 lifetime earned OR subscribe',
    color: 'border-purple-500/20',
  },
  {
    id: 'elite', name: 'Elite', fee: 0.08, sub: 'ELITE',
    priceLabel: '$39/mo', desc: '8% platform fee',
    how: 'Reach $20,000 lifetime earned OR subscribe',
    color: 'border-amber-500/20',
  },
  {
    id: 'partner', name: 'Partner', fee: 0.05, sub: null,
    priceLabel: 'Invite only', desc: '5% platform fee',
    how: 'Reach $100,000 lifetime earned + manual approval',
    color: 'border-[#4AFFD4]/20',
  },
]

const TIER_COLORS: Record<string, string> = {
  starter: 'text-white/40',
  rising: 'text-blue-400',
  pro: 'text-purple-400',
  elite: 'text-amber-400',
  partner: 'text-[#4AFFD4]',
  promo: 'text-pink-400',
}

const SUB_PRICE_IDS: Record<string, string> = {
  RISING: process.env.NEXT_PUBLIC_STRIPE_RISING_PRICE_ID || '',
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
  ELITE: process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID || '',
}

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id, return_url: window.location.href.split('?')[0] }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch (err: any) { setNotice({ type: 'error', msg: err.message }); setConnecting(false) }
  }

  async function upgradePlan(subKey: string) {
    if (!profile) return
    const priceId = SUB_PRICE_IDS[subKey]
    if (!priceId) { setNotice({ type: 'error', msg: 'Price not configured' }); return }
    setUpgrading(subKey)
    try {
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id, price_id: priceId, return_url: window.location.href.split('?')[0] }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch (err: any) { setNotice({ type: 'error', msg: err.message }); setUpgrading(null) }
  }

  async function cancelSubscription() {
    if (!profile?.stripe_subscription_id) return
    setCancelling(true)
    try {
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id }),
      })
      const data = await res.json()
      if (data.success) {
        setNotice({ type: 'info', msg: `Plan active until ${new Date(data.period_end).toLocaleDateString()}, then reverts to earned tier.` })
        const { data: p } = await supabase.from('users').select('*').eq('id', profile.id).single()
        setProfile(p)
      }
    } catch (err: any) { setNotice({ type: 'error', msg: err.message }) }
    setCancelling(false)
  }

  const currentTier = profile?.tier || 'starter'
  const commissionRate = profile?.custom_commission_rate ?? 0.15
  const lifetimeEarned = profile?.lifetime_earned || 0
  const currency = profile?.currency || 'RON'

  // Progress to next tier
  const tierThresholds = [0, 1000, 5000, 20000, 100000]
  const tierNames = ['starter', 'rising', 'pro', 'elite', 'partner']
  const currentTierIdx = tierNames.indexOf(currentTier.replace('_sub',''))
  const nextThreshold = tierThresholds[Math.min(currentTierIdx + 1, tierThresholds.length - 1)]
  const prevThreshold = tierThresholds[Math.max(currentTierIdx, 0)]
  const progress = nextThreshold > prevThreshold
    ? Math.min(((lifetimeEarned - prevThreshold) / (nextThreshold - prevThreshold)) * 100, 100)
    : 100

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
            {profile?.stripe_onboarded ? `Account: ${profile.stripe_account_id}` : 'Connect Stripe to receive tips and payments.'}
          </p>
          <button onClick={connectStripe} disabled={connecting}
            className="w-full bg-[#4AFFD4] text-[#08080C] py-3.5 rounded-2xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
            {connecting ? 'Connecting...' : profile?.stripe_onboarded ? 'Manage Stripe Account' : 'Connect Stripe Account'}
          </button>
        </div>

        {/* Current status */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Your Tier</h2>
            <span className={`font-bold capitalize text-sm ${TIER_COLORS[currentTier] || 'text-white/40'}`}>
              {currentTier === 'promo' ? '🚀 Promo' : currentTier}
            </span>
          </div>

          {currentTier === 'promo' && profile?.promo_expires_at && (
            <div className="bg-pink-500/[0.08] border border-pink-500/20 rounded-xl px-4 py-3 mb-3">
              <p className="text-pink-400 text-sm font-medium">🚀 0% platform fee active</p>
              <p className="text-white/30 text-xs mt-0.5">Expires {new Date(profile.promo_expires_at).toLocaleDateString()}</p>
            </div>
          )}

          <div className="flex justify-between items-center mb-1">
            <span className="text-white/40 text-sm">Current fee</span>
            <span className="text-[#4AFFD4] font-bold">{Math.round(commissionRate * 100)}%</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-white/40 text-sm">Lifetime earned</span>
            <span className="text-white font-bold">${lifetimeEarned.toFixed(2)}</span>
          </div>

          {/* Progress to next tier */}
          {currentTier !== 'partner' && currentTier !== 'promo' && (
            <div>
              <div className="flex justify-between text-xs text-white/30 mb-1.5">
                <span>Progress to next tier</span>
                <span>${lifetimeEarned.toFixed(0)} / ${nextThreshold.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-[#4AFFD4] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-white/20 text-xs mt-1.5">${(nextThreshold - lifetimeEarned).toFixed(0)} more to unlock next tier automatically</p>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-5">
          <h2 className="font-bold text-white mb-1">All Plans</h2>
          <p className="text-white/30 text-xs mb-5">Earn your way up, or subscribe to skip ahead</p>
          <div className="space-y-3">
            {PLANS.map(plan => {
              const isCurrent = currentTier === plan.id || currentTier === plan.id + '_sub'
              const canSubscribe = plan.sub && !isCurrent && plan.id !== 'partner'
              const isHigher = PLANS.findIndex(p => p.id === plan.id) > PLANS.findIndex(p => p.id === currentTier.replace('_sub',''))

              return (
                <div key={plan.id} className={`rounded-2xl border p-4 transition ${isCurrent ? `${plan.color} bg-white/[0.02]` : 'border-white/[0.04] bg-[#08080C]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold ${isCurrent ? TIER_COLORS[plan.id] : 'text-white/60'}`}>{plan.name}</p>
                      {isCurrent && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold bg-white/[0.06] ${TIER_COLORS[plan.id]}`}>Current</span>}
                    </div>
                    <p className={`font-bold text-sm ${isCurrent ? 'text-white' : 'text-white/40'}`}>{plan.priceLabel}</p>
                  </div>
                  <p className={`text-sm mb-1 ${isCurrent ? 'text-white/60' : 'text-white/30'}`}>{plan.desc}</p>
                  <p className="text-white/20 text-xs mb-3">{plan.how}</p>

                  {/* Earning example */}
                  <div className={`rounded-xl px-3 py-2 mb-3 ${isCurrent ? 'bg-white/[0.04]' : 'bg-white/[0.02]'}`}>
                    <p className="text-white/25 text-xs">
                      On 1,000 {currency} earned → you keep{' '}
                      <span className={`font-bold ${isCurrent ? TIER_COLORS[plan.id] : 'text-white/40'}`}>
                        {(1000 * (1 - plan.fee)).toFixed(0)} {currency}
                      </span>
                    </p>
                  </div>

                  {canSubscribe && isHigher && (
                    <button onClick={() => plan.sub && upgradePlan(plan.sub)} disabled={upgrading === plan.sub}
                      className="w-full bg-white/[0.06] hover:bg-white/[0.10] text-white/70 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 border border-white/[0.08]">
                      {upgrading === plan.sub ? 'Redirecting...' : `Subscribe to ${plan.name} · ${plan.priceLabel} →`}
                    </button>
                  )}

                  {isCurrent && plan.id !== 'starter' && plan.id !== 'partner' && profile?.stripe_subscription_id && (
                    <div className="space-y-2">
                      {profile?.sub_expires_at && (
                        <p className="text-white/25 text-xs text-center">Active until {new Date(profile.sub_expires_at).toLocaleDateString()}</p>
                      )}
                      <button onClick={cancelSubscription} disabled={cancelling}
                        className="w-full border border-red-500/20 text-red-400/60 hover:text-red-400 py-2 rounded-xl text-xs transition disabled:opacity-50">
                        {cancelling ? 'Cancelling...' : 'Cancel subscription'}
                      </button>
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
            <p>• Tips under 25 RON / $5: Stripe fee is required from payer</p>
            <p>• Tips above 25 RON / $5: payer can optionally cover Stripe fee</p>
            <p>• You always receive: tip amount − platform fee</p>
            <p>• Payouts handled automatically via Stripe Connect</p>
            <p>• Tier upgrades are automatic when you hit lifetime earnings thresholds</p>
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
