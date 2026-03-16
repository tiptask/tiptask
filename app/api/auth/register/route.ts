import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { email, password, username, display_name, referred_by, promo_code } = await req.json()
    if (!email || !password || !display_name || !username)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    // Check username
    const { data: existing } = await supabaseAdmin.from('users').select('username').eq('username', username.toLowerCase()).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 400 })

    // Validate promo code if provided
    let promoInvite: any = null
    if (promo_code) {
      const { data: invite } = await supabaseAdmin.from('promo_invites')
        .select('*').eq('code', promo_code).single()
      if (invite && !invite.used_by_user_id && !invite.is_revoked) {
        promoInvite = invite
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name },
    })
    if (authError || !authData.user)
      return NextResponse.json({ error: authError?.message || 'Failed to create user', details: JSON.stringify(authError) }, { status: 500 })

    const userId = authData.user.id

    // Determine initial tier
    let tier = 'starter'
    let commission_rate = null
    let promo_expires_at = null
    let promo_invite_id = null

    if (promoInvite) {
      tier = 'promo'
      commission_rate = 0.00
      promo_expires_at = new Date(Date.now() + promoInvite.duration_days * 24 * 60 * 60 * 1000).toISOString()
      promo_invite_id = promoInvite.id
    }

    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: userId, email,
      username: username.toLowerCase(),
      display_name,
      referral_code: username.toLowerCase(),
      referred_by: referred_by || null,
      tier,
      custom_commission_rate: commission_rate,
      promo_expires_at,
      promo_invite_id,
      accepts_tips: promoInvite ? true : false, // auto-enable tips for promo users
    })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Mark invite as used
    if (promoInvite) {
      await supabaseAdmin.from('promo_invites').update({
        used_by_user_id: userId,
        used_at: new Date().toISOString(),
        promo_expires_at,
      }).eq('id', promoInvite.id)
    }

    return NextResponse.json({ success: true, is_promo: !!promoInvite })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
