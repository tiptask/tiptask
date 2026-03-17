import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.NEXT_PUBLIC_STRIPE_RISING_PRICE_ID || '']: 'rising',
  [process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '']: 'pro',
  [process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID || '']: 'elite',
}

const TIER_FEES: Record<string, number> = {
  rising: 0.12,
  pro: 0.10,
  elite: 0.08,
}

// Compute what tier the user earns from lifetime earnings alone
function earnedTier(lifetimeEarned: number): string {
  if (lifetimeEarned >= 100000) return 'partner'
  if (lifetimeEarned >= 20000) return 'elite'
  if (lifetimeEarned >= 5000) return 'pro'
  if (lifetimeEarned >= 1000) return 'rising'
  return 'starter'
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  console.log('[webhook] Event:', event.type)

  try {
    switch (event.type) {

      // ─── SUBSCRIPTION CREATED/ACTIVATED via Checkout ────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.user_id
        const priceId = session.metadata?.price_id
        if (!userId || !priceId) break

        const subId = session.subscription as string
        const sub = await stripe.subscriptions.retrieve(subId)
        const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()
        const tier = PRICE_TO_TIER[priceId]
        if (!tier) break

        await supabase.from('users').update({
          stripe_subscription_id: subId,
          tier,
          custom_commission_rate: TIER_FEES[tier],
          sub_expires_at: periodEnd,
        }).eq('id', userId)

        console.log('[webhook] Subscription activated:', userId, tier)
        break
      }

      // ─── SUBSCRIPTION RENEWED ────────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break

        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
        const sub = await stripe.subscriptions.retrieve(subId)
        const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString()
        const priceId = (sub as any).items?.data?.[0]?.price?.id
        const tier = PRICE_TO_TIER[priceId]
        if (!tier) break

        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const { data: user } = await supabase.from('users').select('id').eq('stripe_customer_id', customerId).single()
        if (!user) break

        await supabase.from('users').update({
          tier,
          custom_commission_rate: TIER_FEES[tier],
          sub_expires_at: periodEnd,
        }).eq('id', user.id)

        console.log('[webhook] Subscription renewed:', user.id, tier)
        break
      }

      // ─── SUBSCRIPTION CANCELLED/EXPIRED → downgrade ─────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

        const { data: user } = await supabase.from('users').select('*').eq('stripe_customer_id', customerId).single()
        if (!user) break

        // Revert to what they earned organically
        const fallbackTier = earnedTier(user.lifetime_earned || 0)
        const fallbackFee = TIER_FEES[fallbackTier] ?? 0.15

        await supabase.from('users').update({
          tier: fallbackTier,
          custom_commission_rate: fallbackFee,
          stripe_subscription_id: null,
          sub_expires_at: null,
        }).eq('id', user.id)

        console.log('[webhook] Subscription cancelled, reverted to:', user.id, fallbackTier)
        break
      }

      // ─── TASKS: card authorized → pending ────────────────────────────────────
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests').select('id, status').eq('stripe_payment_intent_id', pi.id).single()
        if (!req) break
        if (req.status === 'draft') {
          await supabase.from('task_requests').update({ status: 'pending' }).eq('id', req.id)
          console.log('[webhook] Draft → pending:', req.id)
        }
        break
      }

      // ─── TIPS: auto-capture succeeded ────────────────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests').select('id, status, task_id, custom_task_text').eq('stripe_payment_intent_id', pi.id).single()
        if (!req) break
        const isTip = !req.task_id && !req.custom_task_text
        if ((isTip || !isTip) && req.status === 'accepted') {
          await supabase.from('task_requests').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            total_charged: pi.amount_received / 100,
          }).eq('id', req.id).neq('status', 'completed')
          console.log('[webhook] Payment completed:', req.id)
        }
        break
      }

      // ─── PAYMENT FAILED ───────────────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests').select('id, status').eq('stripe_payment_intent_id', pi.id).single()
        if (!req) break
        if (['pending', 'accepted'].includes(req.status)) {
          await supabase.from('task_requests').update({ status: 'declined' }).eq('id', req.id)
        }
        break
      }

      // ─── PAYMENT CANCELED ─────────────────────────────────────────────────────
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests').select('id, status').eq('stripe_payment_intent_id', pi.id).single()
        if (!req) break
        if (['pending', 'accepted'].includes(req.status)) {
          await supabase.from('task_requests').update({ status: 'declined' }).eq('id', req.id)
        }
        break
      }

      // ─── REFUND ───────────────────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (!piId) break
        const { data: req } = await supabase
          .from('task_requests').select('id, status').eq('stripe_payment_intent_id', piId).single()
        if (!req) break
        await supabase.from('task_requests').update({ status: 'refunded' }).eq('id', req.id).neq('status', 'refunded')
        break
      }

      // ─── DISPUTE ──────────────────────────────────────────────────────────────
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const charge = await stripe.charges.retrieve(dispute.charge as string)
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (!piId) break
        const { data: req } = await supabase
          .from('task_requests').select('id').eq('stripe_payment_intent_id', piId).single()
        if (!req) break
        await supabase.from('task_requests').update({ status: 'refunded' }).eq('id', req.id)
        console.warn('[webhook] Dispute created:', req.id, dispute.id)
        break
      }

      default:
        console.log('[webhook] Unhandled event type:', event.type)
    }
  } catch (err: any) {
    console.error('[webhook] Handler error:', err.message)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
