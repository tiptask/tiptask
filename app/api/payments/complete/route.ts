import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { task_request_id, creator_id } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data: taskRequest } = await supabase
      .from('task_requests').select('*')
      .eq('id', task_request_id).eq('creator_id', creator_id).single()

    if (!taskRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (taskRequest.status !== 'accepted')
      return NextResponse.json({ error: 'Not in accepted state' }, { status: 400 })

    // Get actual payment intent to see real Stripe fee
    const paymentIntent = await stripe.paymentIntents.retrieve(
      taskRequest.stripe_payment_intent_id
    )

    // Verify PI is still capturable before attempting
    if (paymentIntent.status !== 'requires_capture') {
      return NextResponse.json({
        error: `Payment authorization expired or invalid (status: ${paymentIntent.status}). The viewer's card hold has lapsed — you cannot charge this request.`
      }, { status: 400 })
    }

    const captureAmount = Math.round(
      (taskRequest.amount + (taskRequest.stripe_fee || 0)) * 100
    )

    await stripe.paymentIntents.capture(
      taskRequest.stripe_payment_intent_id,
      { amount_to_capture: captureAmount }
    )

    await supabase.from('task_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_charged: captureAmount / 100,
      })
      .eq('id', task_request_id)

    return NextResponse.json({ success: true, charged: captureAmount / 100 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
