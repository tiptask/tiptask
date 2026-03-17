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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    // Retrieve session
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const userId = session.metadata?.user_id
    const priceId = session.metadata?.price_id
    if (!userId || !priceId) return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })

    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (!subId) return NextResponse.json({ error: 'No subscription found' }, { status: 400 })

    // Fetch subscription separately to get full object
    const sub = await stripe.subscriptions.retrieve(subId)

    const tier = PRICE_TO_TIER[priceId]
    if (!tier) return NextResponse.json({ error: `Unknown price: ${priceId}` }, { status: 400 })

    // current_period_end is a unix timestamp number
    const periodEndTs = (sub as any).current_period_end
    const periodEnd = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null

    await supabase.from('users').update({
      stripe_subscription_id: sub.id,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      tier,
      custom_commission_rate: TIER_FEES[tier],
      sub_expires_at: periodEnd,
    }).eq('id', userId)

    return NextResponse.json({ ok: true, tier, sub_id: sub.id, period_end: periodEnd })
  } catch (err: any) {
    console.error('Subscribe GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
