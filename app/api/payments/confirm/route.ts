import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { task_request_id } = await req.json()

    if (!task_request_id) {
      return NextResponse.json({ error: 'Missing task_request_id' }, { status: 400 })
    }

    // Fetch full record from DB
    const { data: request, error } = await supabase
      .from('task_requests')
      .select('*')
      .eq('id', task_request_id)
      .single()

    if (error || !request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Determine type from DB fields (never trust client-side)
    const isFreeTip = !request.task_id && !request.custom_task_text
    const newStatus = isFreeTip ? 'accepted' : 'pending'

    const { error: updateError } = await supabase
      .from('task_requests')
      .update({ status: newStatus })
      .eq('id', task_request_id)
      .eq('status', 'draft') // only update if still draft

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err) {
    console.error('Confirm error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
