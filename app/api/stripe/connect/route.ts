import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { creator_id, return_url } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data: creator } = await supabase
      .from('creators').select('*').eq('id', creator_id).single()
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    let accountId = creator.stripe_account_id

    // Create Connect account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        metadata: { creator_id },
      })
      accountId = account.id

      await supabase.from('creators')
        .update({ stripe_account_id: accountId })
        .eq('id', creator_id)
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${return_url}?stripe=refresh`,
      return_url: `${return_url}?stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
