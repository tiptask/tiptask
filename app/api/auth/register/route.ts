import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { email, password, username, display_name, referred_by, user_type } = await req.json()

    if (!email || !password || !display_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check username taken (creators only)
    if (username && user_type !== 'fan') {
      const { data: existing } = await supabaseAdmin
        .from('creators').select('username').eq('username', username.toLowerCase()).single()
      if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
      }
    }

    // Create auth user via admin API — bypasses email sending entirely
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm, no email needed
      user_metadata: { display_name, user_type: user_type || 'creator' },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 500 })
    }

    const userId = authData.user.id

    if (user_type === 'fan') {
      // Insert fan record
      const { error: fanError } = await supabaseAdmin.from('fans').insert({
        id: userId,
        email,
        display_name,
        referred_by: referred_by || null,
      })
      if (fanError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: fanError.message }, { status: 500 })
      }
    } else {
      // Insert creator record
      const { error: creatorError } = await supabaseAdmin.from('creators').insert({
        id: userId,
        email,
        username: username.toLowerCase(),
        display_name,
        referral_code: username.toLowerCase(),
        referred_by: referred_by || null,
      })
      if (creatorError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json({ error: creatorError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, user_id: userId })
  } catch (err: any) {
    console.error('Register error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
