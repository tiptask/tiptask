import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Call this after every successful payment capture.
 * Checks if the earning creator was referred, and creates a referral_earnings row.
 *
 * Usage in your complete/capture API route:
 *   import { createReferralEarning } from './referral-hook'
 *   await createReferralEarning({ creatorId, taskRequestId, transactionAmount, platformFee })
 */
export async function createReferralEarning({
  creatorId,
  taskRequestId,
  transactionAmount,
  platformFee,
}: {
  creatorId: string
  taskRequestId: string
  transactionAmount: number
  platformFee: number
}) {
  try {
    const { data: creator } = await supabaseAdmin
      .from('creators').select('referred_by').eq('id', creatorId).single()
    if (!creator?.referred_by) return

    const { data: referrer } = await supabaseAdmin
      .from('creators').select('id').eq('referral_code', creator.referred_by).single()
    if (!referrer) return

    const referralCut = Math.round(platformFee * 0.05 * 100) / 100
    if (referralCut <= 0) return

    await supabaseAdmin.from('referral_earnings').insert({
      referrer_id: referrer.id,
      referred_id: creatorId,
      task_request_id: taskRequestId,
      transaction_amount: transactionAmount,
      platform_fee: platformFee,
      referral_cut: referralCut,
      paid_out: false,
    })
  } catch (err) {
    console.error('Referral earning creation failed (non-critical):', err)
  }
}
