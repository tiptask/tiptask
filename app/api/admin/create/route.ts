import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret) as any
    if (payload.role !== 'super') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, password, name, role } = await req.json()
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash(password, 12)
    const { error } = await supabase.from('admins').insert({ email, password_hash: hash, name, role: role || 'support' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
