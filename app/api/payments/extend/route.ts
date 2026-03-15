import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { task_request_id } = await req.json()
    if (!task_request_id) return NextResponse.json({ error: 'Missing task_request_id' }, { status: 400 })

    const { data: request } = await supabase
      .from('task_requests').select('*').eq('id', task_request_id).single()

    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const currentExpiry = request.expires_at ? new Date(request.expires_at) : new Date()
    const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + 5 * 60 * 1000)

    const extensions = [...(request.extensions || []), { extended_at: new Date().toISOString(), new_expiry: newExpiry.toISOString() }]

    await supabase.from('task_requests')
      .update({ expires_at: newExpiry.toISOString(), extensions })
      .eq('id', task_request_id)

    return NextResponse.json({ success: true, new_expiry: newExpiry.toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
