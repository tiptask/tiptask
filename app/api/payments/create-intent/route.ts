import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'
import { calculateFees } from '@/lib/fees'
import type { CreatorTier } from '@/lib/fees'

// Minimum amounts equivalent to ~1 USD, rounded to sensible values
const MINIMUM_AMOUNTS: Record<string, number> = {
  usd: 1.00,
  eur: 0.95,
  gbp: 0.80,
  ron: 5.00,
  cad: 1.40,
  aud: 1.55,
  chf: 0.90,
  sek: 10.50,
  nok: 10.50,
  dkk: 7.00,
  pln: 4.00,
  huf: 370,
  czk: 23.00,
  bgn: 1.85,
  hrk: 7.00,
  jpy: 150,
  inr: 84,
  brl: 5.00,
  mxn: 17.00,
  sgd: 1.35,
  hkd: 7.80,
  nzd: 1.65,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      session_id, creator_id, task_id, custom_task_text,
      is_free_tip, requester_name, amount, message, currency,
    } = body

    if (!session_id || !creator_id || !amount || !requester_name)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: creator } = await supabase
      .from('creators')
      .select('stripe_account_id, stripe_onboarded, tier, custom_commission_rate, currency')
      .eq('id', creator_id).single()

    if (!creator?.stripe_account_id || !creator?.stripe_onboarded)
      return NextResponse.json({ error: 'Creator has not connected Stripe yet' }, { status: 400 })

    const creatorCurrency = (currency || creator.currency || 'ron').toLowerCase()

    // Enforce minimum amount
    const minAmount = MINIMUM_AMOUNTS[creatorCurrency] ?? 1.00
    if (amount < minAmount) {
      return NextResponse.json(
        { error: `Minimum amount is ${minAmount} ${creatorCurrency.toUpperCase()}` },
        { status: 400 }
      )
    }

    const fees = calculateFees(amount, (creator.tier || 'free') as CreatorTier, 'card', creator.custom_commission_rate)
    const platformFeeInCents = Math.round(fees.platformFee * 100)
    const authorizeAmountInCents = Math.round(fees.totalAuthorized * 100)

    const captureMethod = is_free_tip ? 'automatic' : 'manual'

    const paymentIntent = await stripe.paymentIntents.create({
      amount: authorizeAmountInCents,
      currency: creatorCurrency,
      capture_method: captureMethod,
      application_fee_amount: platformFeeInCents,
      transfer_data: { destination: creator.stripe_account_id },
      metadata: {
        session_id, creator_id, requester_name,
        task_amount: amount.toString(),
        platform_fee: fees.platformFee.toString(),
        is_free_tip: is_free_tip ? 'true' : 'false',
      },
    })

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { data: taskRequest, error: dbError } = await supabase
      .from('task_requests')
      .insert({
        session_id, creator_id,
        task_id: task_id || null,
        custom_task_text: custom_task_text || null,
        requester_name,
        amount,
        currency: creatorCurrency.toUpperCase(),
        platform_fee: fees.platformFee,
        stripe_fee: fees.estimatedStripeFee,
        stripe_fee_buffer: fees.stripeFeeBuffer,
        total_charged: fees.totalAuthorized,
        payment_method: 'card',
        status: is_free_tip ? 'accepted' : 'pending',
        responded_at: is_free_tip ? new Date().toISOString() : null,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_account_id: creator.stripe_account_id,
        message: message || null,
        expires_at: expiresAt,
      })
      .select().single()

    if (dbError) {
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      task_request_id: taskRequest.id,
      is_free_tip,
      fees: {
        task_amount: fees.taskAmount,
        platform_fee: fees.platformFee,
        estimated_stripe_fee: fees.estimatedStripeFee,
        total_authorized: fees.totalAuthorized,
        creator_receives: fees.creatorReceives,
      }
    })

  } catch (error: any) {
    console.error('Payment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
