import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { task_request_id } = await req.json()
    if (!task_request_id) return NextResponse.json({ error: 'Missing task_request_id' }, { status: 400 })

    const { data: request, error: fetchError } = await supabase
      .from('task_requests').select('*').eq('id', task_request_id).single()

    if (fetchError || !request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    // Allow completing accepted OR expired-accepted requests
    if (!['accepted'].includes(request.status)) {
      return NextResponse.json({ error: `Cannot complete request with status: ${request.status}` }, { status: 400 })
    }

    // Capture the Stripe payment
    try {
      await stripe.paymentIntents.capture(request.stripe_payment_intent_id)
    } catch (stripeErr: any) {
      console.error('Stripe capture error:', stripeErr)
      // If already captured or cancelled, still mark as completed
      if (!stripeErr.message?.includes('already captured') && !stripeErr.message?.includes('not in a capturable state')) {
        return NextResponse.json({ error: 'Payment capture failed: ' + stripeErr.message }, { status: 500 })
      }
    }

    const { error: updateError } = await supabase.from('task_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', task_request_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Update session stats
    if (request.session_id) {
      try {
        await supabase.rpc('update_session_request_stats', {
          p_session_id: request.session_id,
          p_amount: request.amount,
        })
      } catch (e) { console.error('RPC error:', e) }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Complete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
