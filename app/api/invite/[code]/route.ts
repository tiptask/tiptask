import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const { data } = await supabase.from('promo_invites').select('id,code,note,duration_days,used_by_user_id,is_revoked').eq('code', params.code).single()
  if (!data || data.used_by_user_id || data.is_revoked) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 })
  return NextResponse.json({ invite: data })
}
