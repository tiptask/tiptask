import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.tip_id) {
      const { error } = await supabase.from('tips').update({ status: 'completed' }).eq('id', body.tip_id).eq('status', 'draft')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const { data: tip } = await supabase.from('tips').select('*').eq('id', body.tip_id).single()
      if (tip?.session_id) {
        await supabase.from('sessions').update({ total_tips_count: supabase.rpc as any }).eq('id', tip.session_id)
        await supabase.rpc('update_session_tip_stats', { p_session_id: tip.session_id, p_amount: tip.amount })
      }
      return NextResponse.json({ success: true, type: 'tip' })
    }

    if (body.task_request_id) {
      const { data: request } = await supabase.from('task_requests').select('*').eq('id', body.task_request_id).single()
      if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
      await supabase.from('task_requests').update({ status: 'pending' }).eq('id', body.task_request_id).eq('status', 'draft')
      return NextResponse.json({ success: true, type: 'request', status: 'pending' })
    }

    return NextResponse.json({ error: 'Missing tip_id or task_request_id' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
