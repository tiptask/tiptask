import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return NextResponse.json({ admin: payload })
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
