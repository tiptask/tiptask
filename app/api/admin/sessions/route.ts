import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    await jwtVerify(token, secret)

    const { data } = await supabase.from('sessions')
      .select('*, users(display_name, username, currency, tier)')
      .eq('is_active', true)
      .order('started_at', { ascending: false })

    return NextResponse.json({ sessions: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}
