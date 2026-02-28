import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

// Required: disable Next.js body parsing so we get raw bytes for signature verification
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('[webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  console.log('[webhook] Event:', event.type)

  try {
    switch (event.type) {

      // ─── TASKS: card authorized, promote draft → pending ──────────────────────
      // This fires when a manual-capture PI is confirmed (card auth succeeded)
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests')
          .select('id, status')
          .eq('stripe_payment_intent_id', pi.id)
          .single()

        if (!req) break

        if (req.status === 'draft') {
          await supabase.from('task_requests')
            .update({ status: 'pending' })
            .eq('id', req.id)
          console.log('[webhook] Draft → pending:', req.id)
        }
        break
      }

      // ─── TIPS: auto-capture succeeded = money is real ───────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests')
          .select('id, status, task_id, custom_task_text')
          .eq('stripe_payment_intent_id', pi.id)
          .single()

        if (!req) break

        const isTip = !req.task_id && !req.custom_task_text

        if (isTip && req.status === 'accepted') {
          // Tip was auto-captured — confirm it's truly paid
          await supabase.from('task_requests')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              total_charged: pi.amount_received / 100,
            })
            .eq('id', req.id)
          console.log('[webhook] Tip completed:', req.id)
        } else if (!isTip && req.status === 'accepted') {
          // Task was manually captured by creator clicking Done
          // Our complete/route.ts already updated status — this is just a safety net
          await supabase.from('task_requests')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              total_charged: pi.amount_received / 100,
            })
            .eq('id', req.id)
            .neq('status', 'completed') // don't overwrite if already set
          console.log('[webhook] Task capture confirmed:', req.id)
        }
        break
      }

      // ─── PAYMENT FAILED (card declined after authorization) ─────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests')
          .select('id, status')
          .eq('stripe_payment_intent_id', pi.id)
          .single()

        if (!req) break

        if (req.status === 'pending' || req.status === 'accepted') {
          await supabase.from('task_requests')
            .update({ status: 'declined' })
            .eq('id', req.id)
          console.log('[webhook] Payment failed, declined:', req.id)
        }
        break
      }

      // ─── CANCELED (creator declined, or 10min expiry pg_cron) ───────────────
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: req } = await supabase
          .from('task_requests')
          .select('id, status')
          .eq('stripe_payment_intent_id', pi.id)
          .single()

        if (!req) break

        if (req.status === 'pending' || req.status === 'accepted') {
          await supabase.from('task_requests')
            .update({ status: 'declined' })
            .eq('id', req.id)
          console.log('[webhook] PI canceled, declined:', req.id)
        }
        break
      }

      // ─── REFUND (creator clicked ↩, or Stripe dashboard refund) ────────────
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id

        if (!piId) break

        const { data: req } = await supabase
          .from('task_requests')
          .select('id, status')
          .eq('stripe_payment_intent_id', piId)
          .single()

        if (!req) break

        await supabase.from('task_requests')
          .update({ status: 'refunded' })
          .eq('id', req.id)
          .neq('status', 'refunded') // idempotent
        console.log('[webhook] Charge refunded:', req.id)
        break
      }

      // ─── DISPUTE CREATED ────────────────────────────────────────────────────
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const charge = await stripe.charges.retrieve(dispute.charge as string)
        const piId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id

        if (!piId) break

        const { data: req } = await supabase
          .from('task_requests')
          .select('id')
          .eq('stripe_payment_intent_id', piId)
          .single()

        if (!req) break

        // Flag it — add a disputed field or just log for now
        await supabase.from('task_requests')
          .update({ status: 'refunded' }) // treat dispute as refund
          .eq('id', req.id)
        console.warn('[webhook] Dispute created for request:', req.id, dispute.id)
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
