import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const MINIMUM_AMOUNTS: Record<string, number> = {
  usd: 100, eur: 95, gbp: 80, ron: 500, cad: 140, aud: 155, chf: 90,
  sek: 1050, nok: 1050, dkk: 700, pln: 400, huf: 37000, czk: 2300,
  bgn: 185, jpy: 15000, inr: 8400, brl: 500, mxn: 1700, sgd: 135, hkd: 780, nzd: 165,
}

export async function POST(req: Request) {
  try {
    const { receiver_username, sender_name, message, amount, currency, sender_id } = await req.json()
    if (!receiver_username || !sender_name || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: receiver } = await supabase.from('users').select('*').eq('username', receiver_username).single()
    if (!receiver || !receiver.stripe_account_id || !receiver.stripe_onboarded) return NextResponse.json({ error: 'Creator not set up for payments' }, { status: 400 })

    const commissionRate = receiver.custom_commission_rate ?? (receiver.tier === 'premium' ? 0.10 : 0.15)
    const amountInSmallest = Math.round(amount * 100)
    const platformFee = Math.round(amountInSmallest * commissionRate)
    const stripeFee = Math.round(amountInSmallest * 0.029 + 30)
    const totalCharged = amountInSmallest + stripeFee

    const currencyLower = (currency || 'ron').toLowerCase()
    const minAmount = MINIMUM_AMOUNTS[currencyLower] ?? 100
    if (totalCharged < minAmount) return NextResponse.json({ error: `Minimum amount is ${minAmount / 100} ${currency}` }, { status: 400 })

    const { data: session } = await supabase.from('sessions').select('id').eq('user_id', receiver.id).eq('is_active', true).single()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCharged,
      currency: currencyLower,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFee,
      transfer_data: { destination: receiver.stripe_account_id },
      metadata: { type: 'tip', receiver_id: receiver.id, sender_name, session_id: session?.id || '' },
    })

    const { data: tip } = await supabase.from('tips').insert({
      receiver_id: receiver.id,
      sender_id: sender_id || null,
      session_id: session?.id || null,
      sender_name, message: message || null,
      amount, currency: currency || 'RON',
      platform_fee: platformFee / 100, stripe_fee: stripeFee / 100, total_charged: totalCharged / 100,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_account_id: receiver.stripe_account_id,
      status: 'draft',
    }).select().single()

    return NextResponse.json({ client_secret: paymentIntent.client_secret, tip_id: tip?.id, amount, total_charged: totalCharged / 100 })
  } catch (err: any) {
    console.error('Tips create error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
