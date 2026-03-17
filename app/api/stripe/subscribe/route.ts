import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.NEXT_PUBLIC_STRIPE_RISING_PRICE_ID || '']: 'rising',
  [process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '']: 'pro',
  [process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID || '']: 'elite',
}

const TIER_FEES: Record<string, number> = {
  rising: 0.12,
  pro: 0.10,
  elite: 0.08,
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, price_id, return_url } = await req.json()
    if (!user_id || !price_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: user } = await supabase.from('users').select('*').eq('id', user_id).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.display_name,
        metadata: { user_id },
      })
      customerId = customer.id
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user_id)
    }

    // Cancel existing subscription if any
    if (user.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(user.stripe_subscription_id, { cancel_at_period_end: true })
      } catch (e) { console.error('Cancel existing sub error:', e) }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${return_url}?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${return_url}?subscription=cancelled`,
      metadata: { user_id, price_id },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Called after successful checkout to activate the subscription in DB
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    const userId = session.metadata?.user_id
    const priceId = session.metadata?.price_id
    if (!userId || !priceId) return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })

    const sub = session.subscription as Stripe.Subscription
    if (!sub || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    const tier = PRICE_TO_TIER[priceId]
    if (!tier) return NextResponse.json({ error: 'Unknown price' }, { status: 400 })

    const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()

    await supabase.from('users').update({
      stripe_subscription_id: sub.id,
      tier,
      custom_commission_rate: TIER_FEES[tier],
      sub_expires_at: periodEnd,
    }).eq('id', userId)

    return NextResponse.json({ ok: true, tier, sub_id: sub.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
