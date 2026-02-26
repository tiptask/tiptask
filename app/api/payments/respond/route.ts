import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { task_request_id, action, creator_id } = await req.json()
    if (!task_request_id || !action || !creator_id)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: taskRequest } = await supabase
      .from('task_requests').select('*')
      .eq('id', task_request_id).eq('creator_id', creator_id).single()

    if (!taskRequest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (taskRequest.status !== 'pending')
      return NextResponse.json({ error: 'Already responded' }, { status: 400 })

    if (action === 'accept') {
      // Just mark as accepted — do NOT capture yet
      // Payment will be captured when creator clicks Done
      await supabase.from('task_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', task_request_id)

    } else if (action === 'decline') {
      // Cancel payment intent — full refund to viewer
      await stripe.paymentIntents.cancel(taskRequest.stripe_payment_intent_id)
      await supabase.from('task_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', task_request_id)
    }

    return NextResponse.json({ success: true, action })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
