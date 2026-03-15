import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  try {
    const { creator_username, tipper_name, message, amount, currency, fan_id } = await req.json()

    if (!creator_username || !tipper_name || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get creator
    const { data: creator, error: creatorError } = await supabase
      .from('creators').select('*').eq('username', creator_username).single()
    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }
    if (!creator.stripe_account_id || !creator.stripe_onboarded) {
      return NextResponse.json({ error: 'Creator not set up for payments' }, { status: 400 })
    }

    // Get active session (optional — tip works without one)
    const { data: session } = await supabase
      .from('sessions').select('id')
      .eq('creator_id', creator.id).eq('is_active', true).single()

    // Calculate fees
    const commissionRate = creator.custom_commission_rate
      ?? (creator.tier === 'premium' ? 0.10 : 0.15)
    const amountInSmallestUnit = Math.round(amount * 100)
    const platformFee = Math.round(amountInSmallestUnit * commissionRate)
    const stripeFee = Math.round(amountInSmallestUnit * 0.029 + 30)
    const totalCharged = amountInSmallestUnit + stripeFee

    // Create Stripe PaymentIntent (automatic capture for tips)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCharged,
      currency: currency?.toLowerCase() || 'ron',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFee,
      transfer_data: { destination: creator.stripe_account_id },
      metadata: {
        type: 'tip',
        creator_id: creator.id,
        creator_username,
        tipper_name,
        session_id: session?.id || '',
      },
    })

    // Insert tip record
    const { data: tip, error: tipError } = await supabase.from('tips').insert({
      creator_id: creator.id,
      session_id: session?.id || null,
      fan_id: fan_id || null,
      tipper_name,
      message: message || null,
      amount,
      currency: currency || 'RON',
      platform_fee: platformFee / 100,
      stripe_fee: stripeFee / 100,
      total_charged: totalCharged / 100,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_account_id: creator.stripe_account_id,
      status: 'draft',
    }).select().single()

    if (tipError) {
      return NextResponse.json({ error: tipError.message }, { status: 500 })
    }

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      tip_id: tip.id,
      amount,
      total_charged: totalCharged / 100,
      currency: currency || 'RON',
    })
  } catch (err: any) {
    console.error('Tips create error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
