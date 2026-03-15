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

    const { data: request } = await supabase
      .from('task_requests').select('*').eq('id', task_request_id).single()

    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await stripe.paymentIntents.cancel(request.stripe_payment_intent_id)
    await supabase.from('task_requests')
      .update({ status: 'refunded' })
      .eq('id', task_request_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
