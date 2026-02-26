import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { task_request_id, creator_id } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data: taskRequest } = await supabase
      .from('task_requests')
      .select('*')
      .eq('id', task_request_id)
      .eq('creator_id', creator_id)
      .single()

    if (!taskRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Cancel the payment intent (refunds authorization)
    await stripe.paymentIntents.cancel(taskRequest.stripe_payment_intent_id)

    await supabase.from('task_requests')
      .update({ status: 'refunded', responded_at: new Date().toISOString() })
      .eq('id', task_request_id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
