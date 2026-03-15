import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { user_id, return_url } = await req.json()

    const { data: user } = await supabase.from('users').select('*').eq('id', user_id).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    let accountId = user.stripe_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { user_id },
      })
      accountId = account.id
      await supabase.from('users').update({ stripe_account_id: accountId }).eq('id', user_id)
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${return_url}?stripe=refresh`,
      return_url: `${return_url}?stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: any) {
    console.error('Stripe connect error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
