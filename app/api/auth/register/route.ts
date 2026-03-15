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
    const { email, password, username, display_name, referred_by } = await req.json()
    if (!email || !password || !display_name || !username) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    const { data: existing } = await supabaseAdmin.from('users').select('username').eq('username', username.toLowerCase()).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { display_name },
    })
    if (authError || !authData.user) return NextResponse.json({ error: authError?.message || 'Failed to create user', details: JSON.stringify(authError) }, { status: 500 })
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id, email, username: username.toLowerCase(), display_name,
      referral_code: username.toLowerCase(), referred_by: referred_by || null,
    })
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
