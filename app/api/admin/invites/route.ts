import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) throw new Error('Not authenticated')
  const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
  const { payload } = await jwtVerify(token, secret) as any
  return payload
}

function generateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 12; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req)
    const { data, error } = await supabase.from('promo_invites')
      .select('*, users!promo_invites_used_by_user_id_fkey(username,display_name,email)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invites: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req) as any
    const { note, duration_days } = await req.json()
    const code = generateCode()
    const { data, error } = await supabase.from('promo_invites').insert({
      code, note: note || null, duration_days: duration_days || 30,
      created_by: admin.email,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invite: data, url: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${code}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req)
    const { invite_id, action, reason } = await req.json()
    if (action === 'revoke') {
      await supabase.from('promo_invites').update({ is_revoked: true, revoked_at: new Date().toISOString(), revoke_reason: reason || null }).eq('id', invite_id)
      // Also recalculate tier for the user who used this invite
      const { data: invite } = await supabase.from('promo_invites').select('used_by_user_id').eq('id', invite_id).single()
      if (invite?.used_by_user_id) {
        await supabase.rpc('recalculate_user_tier', { p_user_id: invite.used_by_user_id })
      }
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}
