import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: admin } = await supabase
      .from('admins').select('*').eq('email', email).single()
    if (!admin) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    const token = await new SignJWT({ id: admin.id, email: admin.email, role: admin.role, name: admin.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(secret)

    const res = NextResponse.json({ success: true, name: admin.name, role: admin.role })
    res.cookies.set('admin_token', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400, path: '/admin' })
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
