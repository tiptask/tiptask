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

    const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()
    await supabase.from('users').update({ premium_expires_at: periodEnd }).eq('id', user_id)

    return NextResponse.json({ success: true, period_end: periodEnd })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
