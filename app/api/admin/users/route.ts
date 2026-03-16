import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) throw new Error('Not authenticated')
  const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
  const { payload } = await jwtVerify(token, secret)
  return payload
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req)
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const tier = searchParams.get('tier') || ''
    const sort = searchParams.get('sort') || 'created_at'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const offset = (page - 1) * limit

    let query = supabase.from('users').select('*', { count: 'exact' })
    if (search) query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`)
    if (tier) query = query.eq('tier', tier)
    query = query.order(sort, { ascending: false }).range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data, total: count, page, pages: Math.ceil((count || 0) / limit) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req)
    const { user_id, updates } = await req.json()
    const allowed = ['tier', 'custom_commission_rate', 'accepts_tips', 'is_featured', 'admin_notes', 'sub_tier', 'sub_expires_at', 'promo_expires_at']
    const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)))
    const { error } = await supabase.from('users').update(filtered).eq('id', user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Recalculate tier if needed
    if (updates.lifetime_earned !== undefined || updates.sub_tier !== undefined) {
      await supabase.rpc('recalculate_user_tier', { p_user_id: user_id })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}
