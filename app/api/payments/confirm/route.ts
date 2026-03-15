import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Handle tip confirmation
    if (body.tip_id) {
      const { error } = await supabase
        .from('tips')
        .update({ status: 'completed' })
        .eq('id', body.tip_id)
        .eq('status', 'draft')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Update session tip stats
      const { data: tip } = await supabase.from('tips').select('*').eq('id', body.tip_id).single()
      if (tip?.session_id) {
        await supabase
          .from('sessions')
          .update({
            total_tips_count: supabase.rpc('increment', { x: 1 }),
            total_tips_amount: supabase.rpc('increment', { x: tip.amount }),
          })
          .eq('id', tip.session_id)
      }

      return NextResponse.json({ success: true, type: 'tip', status: 'completed' })
    }

    // Handle request confirmation
    if (body.task_request_id) {
      const { data: request, error } = await supabase
        .from('task_requests').select('*').eq('id', body.task_request_id).single()
      if (error || !request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

      const isFreeTip = !request.task_id && !request.custom_task_text
      const newStatus = isFreeTip ? 'accepted' : 'pending'

      await supabase
        .from('task_requests')
        .update({ status: newStatus })
        .eq('id', body.task_request_id)
        .eq('status', 'draft')

      return NextResponse.json({ success: true, type: 'request', status: newStatus })
    }

    return NextResponse.json({ error: 'Missing tip_id or task_request_id' }, { status: 400 })
  } catch (err: any) {
    console.error('Confirm error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
