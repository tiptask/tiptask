import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_PREMIUM_A_PRICE_ID || '']: 'promoter',
  [process.env.STRIPE_PREMIUM_B_PRICE_ID || '']: 'premium',
}

const PRICE_TO_RATE: Record<string, number> = {
  [process.env.STRIPE_PREMIUM_A_PRICE_ID || '']: 0.10,
  [process.env.STRIPE_PREMIUM_B_PRICE_ID || '']: 0.05,
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession
        if (session.mode !== 'subscription') break
        const userId = session.metadata?.user_id
        const priceId = session.metadata?.price_id
        if (!userId || !priceId) break

        const tier = PRICE_TO_TIER[priceId] || 'promoter'
        const rate = PRICE_TO_RATE[priceId] ?? 0.10

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()

        await supabase.from('users').update({
          tier,
          custom_commission_rate: rate,
          stripe_subscription_id: session.subscription,
          premium_expires_at: periodEnd,
        }).eq('id', userId)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const { data: user } = await supabase.from('users').select('id').eq('stripe_customer_id', customerId).single()
        if (!user) break

        const priceId = sub.items.data[0]?.price?.id
        const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()

        if (sub.cancel_at_period_end) {
          // Stays premium until period end
          await supabase.from('users').update({ premium_expires_at: periodEnd }).eq('id', user.id)
        } else {
          const tier = PRICE_TO_TIER[priceId] || 'promoter'
          const rate = PRICE_TO_RATE[priceId] ?? 0.10
          await supabase.from('users').update({
            tier, custom_commission_rate: rate,
            stripe_subscription_id: sub.id,
            premium_expires_at: periodEnd,
          }).eq('id', user.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const { data: user } = await supabase.from('users').select('id,premium_expires_at').eq('stripe_customer_id', customerId).single()
        if (!user) break

        // Only downgrade if premium_expires_at has passed
        const expired = !user.premium_expires_at || new Date(user.premium_expires_at) <= new Date()
        if (expired) {
          await supabase.from('users').update({
            tier: 'free',
            custom_commission_rate: null,
            stripe_subscription_id: null,
          }).eq('id', user.id)
        }
        break
      }
    }
  } catch (err: any) {
    console.error('Webhook handler error:', err)
  }

  return NextResponse.json({ received: true })
}
