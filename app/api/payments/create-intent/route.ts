import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const MINIMUMS: Record<string, number> = {
  usd: 100, eur: 100, gbp: 100, ron: 500, cad: 100,
  aud: 100, chf: 100, sek: 1000, nok: 1000, dkk: 700,
  pln: 400, huf: 37000, czk: 2300, bgn: 200, jpy: 15000,
  inr: 8400, brl: 500, mxn: 1700, sgd: 100, hkd: 780, nzd: 100,
}

export async function POST(req: Request) {
  try {
    const { session_id, receiver_id, task_id, custom_task_text, sender_name, sender_id, amount, message, cover_fee } = await req.json()
    if (!session_id || !receiver_id || !sender_name || !amount)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: session } = await supabase
      .from('sessions').select('*').eq('id', session_id).eq('is_active', true).single()
    if (!session) return NextResponse.json({ error: 'Session not active' }, { status: 400 })

    const { data: receiver } = await supabase
      .from('users').select('*').eq('id', receiver_id).single()
    if (!receiver || !receiver.stripe_account_id)
      return NextResponse.json({ error: 'Creator not set up' }, { status: 400 })

    const commissionRate = receiver.custom_commission_rate ?? 0.15
    const currencyLower = (receiver.currency || 'RON').toLowerCase()
    const amountInSmallest = Math.round(amount * 100)

    const stripeFee = Math.round(amountInSmallest * 0.029 + 30)
    const platformFee = Math.round(amountInSmallest * commissionRate)
    const totalCharged = cover_fee ? amountInSmallest + stripeFee : amountInSmallest

    const minAmount = MINIMUMS[currencyLower] ?? 100
    if (totalCharged < minAmount)
      return NextResponse.json({ error: `Minimum amount is ${minAmount / 100} ${receiver.currency}` }, { status: 400 })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCharged,
      currency: currencyLower,
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFee,
      transfer_data: { destination: receiver.stripe_account_id },
      metadata: { type: 'request', session_id, receiver_id, sender_name },
    })

    const { data: taskRequest } = await supabase.from('task_requests').insert({
      session_id,
      receiver_id,
      sender_id: sender_id || null,
      task_id: task_id || null,
      custom_task_text: custom_task_text || null,
      sender_name,
      message: message || null,
      amount,
      currency: receiver.currency || 'RON',
      platform_fee: platformFee / 100,
      stripe_fee: stripeFee / 100,
      total_charged: totalCharged / 100,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_account_id: receiver.stripe_account_id,
      status: 'draft',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }).select().single()

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      task_request_id: taskRequest?.id,
      amount,
      total_charged: totalCharged / 100,
      stripe_fee: stripeFee / 100,
      cover_fee: !!cover_fee,
    })
  } catch (err: any) {
    console.error('Create intent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
