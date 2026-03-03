import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { task_request_id } = await req.json()

    if (!task_request_id)
      return NextResponse.json({ error: 'Missing task_request_id' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: request } = await supabase
      .from('task_requests')
      .select('status, task_id, custom_task_text')
      .eq('id', task_request_id)
      .single()

    if (!request)
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    // Only update if still in draft (idempotent)
    if (request.status !== 'draft') {
      return NextResponse.json({ status: request.status })
    }

    // Free tip = no task_id and no custom_task_text
    const isFreeTip = !request.task_id && !request.custom_task_text
    const newStatus = isFreeTip ? 'accepted' : 'pending'

    const { error } = await supabase
      .from('task_requests')
      .update({
        status: newStatus,
        responded_at: isFreeTip ? new Date().toISOString() : null,
      })
      .eq('id', task_request_id)

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ status: newStatus })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
