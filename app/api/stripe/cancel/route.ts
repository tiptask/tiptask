import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json()
    const { data: user } = await supabase.from('users').select('*').eq('id', user_id).single()
    if (!user?.stripe_subscription_id) return NextResponse.json({ error: 'No active subscription' }, { status: 400 })

    const sub = await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // current_period_end is a unix timestamp
    const periodEndTs = (sub as any).current_period_end
    const periodEnd = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null

    await supabase.from('users').update({ sub_expires_at: periodEnd }).eq('id', user_id)

    return NextResponse.json({ success: true, period_end: periodEnd })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
