import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

const EXTENSION_MINUTES = 5
const EXTENSION_FEE_RATE = 0.10 // 10% of task amount, kept by platform

export async function POST(req: NextRequest) {
  try {
    const { task_request_id, creator_id } = await req.json()
    if (!task_request_id || !creator_id)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: taskRequest } = await supabase
      .from('task_requests')
      .select('*')
      .eq('id', task_request_id)
      .eq('creator_id', creator_id)
      .single()

    if (!taskRequest)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (taskRequest.status !== 'pending')
      return NextResponse.json({ error: 'Can only extend pending requests' }, { status: 400 })

    // Verify Stripe PI is still valid
    const pi = await stripe.paymentIntents.retrieve(taskRequest.stripe_payment_intent_id)
    if (pi.status !== 'requires_capture') {
      // PI expired — cancel in our DB too
      await supabase.from('task_requests')
        .update({ status: 'declined' })
        .eq('id', task_request_id)
      return NextResponse.json({
        error: 'Payment authorization has expired — the viewer must submit a new request'
      }, { status: 400 })
    }

    if (taskRequest.custom_task_text === null && taskRequest.task_id === null)
      return NextResponse.json({ error: 'Cannot extend free tips' }, { status: 400 })

    // Calculate extension fee (10% of task amount)
    const extensionFee = Math.round(taskRequest.amount * EXTENSION_FEE_RATE * 100) / 100

    // Extend expires_at by 5 minutes from NOW (not from current expiry, so even expired tasks can be extended)
    const currentExpiry = new Date(taskRequest.expires_at)
    const now = new Date()
    const baseTime = currentExpiry > now ? currentExpiry : now
    const newExpiry = new Date(baseTime.getTime() + EXTENSION_MINUTES * 60 * 1000)

    // Track extensions as JSON array on the task_request
    const existingExtensions = taskRequest.extensions || []
    const newExtension = {
      extended_at: now.toISOString(),
      new_expiry: newExpiry.toISOString(),
      fee: extensionFee,
    }

    const { error: updateError } = await supabase
      .from('task_requests')
      .update({
        expires_at: newExpiry.toISOString(),
        extensions: [...existingExtensions, newExtension],
        // Increase platform_fee to include extension fee
        platform_fee: (taskRequest.platform_fee || 0) + extensionFee,
      })
      .eq('id', task_request_id)

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      new_expiry: newExpiry.toISOString(),
      extension_fee: extensionFee,
      extensions_count: existingExtensions.length + 1,
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
