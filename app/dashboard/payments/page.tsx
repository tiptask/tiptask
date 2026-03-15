'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

function PaymentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<any>(null)
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
        body: JSON.stringify({
          user_id: profile.id,
          return_url: window.location.href.split('?')[0],
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error)
    } catch (err: any) {
      console.error(err)
      setConnecting(false)
    }
  }

  const commissionRate = profile?.custom_commission_rate
    ?? (profile?.tier === 'premium' ? 0.10 : 0.15)

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

        {status === 'success' && (
          <div className="bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 rounded-2xl px-5 py-4 mb-5">
            <p className="text-[#4AFFD4] font-semibold">✓ Stripe account connected!</p>
            <p className="text-white/40 text-sm mt-0.5">You can now receive tips and payments.</p>
          </div>
        )}

        {/* Stripe connection */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Stripe Account</h2>
            <span className={`text-sm font-semibold ${profile?.stripe_onboarded ? 'text-[#4AFFD4]' : 'text-amber-400'}`}>
              {profile?.stripe_onboarded ? '✓ Connected' : 'Not connected'}
            </span>
          </div>
          <p className="text-white/40 text-sm mb-4">
            {profile?.stripe_onboarded
              ? 'Your Stripe account is connected and ready to receive payments.'
              : 'Connect your Stripe account to receive payments. You will need to complete Stripe verification.'}
          </p>
          {profile?.stripe_onboarded && profile?.stripe_account_id && (
            <p className="text-white/20 text-xs font-mono mb-4">{profile.stripe_account_id}</p>
          )}
          <button onClick={connectStripe} disabled={connecting}
            className="w-full bg-[#4AFFD4] text-[#08080C] py-3.5 rounded-2xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
            {connecting ? 'Connecting...' : profile?.stripe_onboarded ? 'Manage Stripe Account' : 'Connect Stripe Account'}
          </button>
        </div>

        {/* Plan */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-5">
          <h2 className="font-bold text-white mb-4">Your Plan</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-semibold capitalize">{profile?.tier || 'Free'}</p>
              <p className="text-white/40 text-sm">Platform fee: {Math.round(commissionRate * 100)}% per transaction</p>
            </div>
            <span className="bg-white/[0.06] text-white/40 text-xs px-3 py-1.5 rounded-full">Current plan</span>
          </div>
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-white/40 text-sm mb-3">Upgrade to reduce your platform fee:</p>
            <div className="space-y-2">
              {[{ name: 'Premium A', fee: '10%', price: '$16' }, { name: 'Premium B', fee: '5%', price: '$28' }].map(plan => (
                <div key={plan.name} className="flex items-center justify-between bg-[#08080C] border border-white/[0.06] rounded-xl px-4 py-3">
                  <div><p className="text-white font-semibold text-sm">{plan.name}</p><p className="text-white/30 text-xs">Max {plan.fee} platform fee</p></div>
                  <div className="text-right"><p className="text-white font-bold text-sm">{plan.price}<span className="text-white/30 text-xs">/mo</span></p><p className="text-white/20 text-xs">Coming soon</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How fees work */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="font-bold text-white mb-3">How fees work</h2>
          <div className="space-y-2 text-sm text-white/40">
            <p>• TipTask takes {Math.round(commissionRate * 100)}% of each transaction as a platform fee</p>
            <p>• Stripe charges ~2.9% + 30¢ per transaction (passed to viewer)</p>
            <p>• You receive the full amount minus only the platform fee</p>
            <p>• Payouts are handled automatically by Stripe Connect</p>
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
