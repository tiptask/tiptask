import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

  const { data: profile } = await supabase.from('users').select('id').eq('username', username).single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: session } = await supabase.from('sessions').select('id').eq('user_id', profile.id).eq('is_active', true).single()
  if (!session) return NextResponse.json({ sessionId: null, tasks: [], tips: [] })

  const [{ data: tasks }, { data: tips }, { data: allTasks }] = await Promise.all([
    supabase.from('task_requests').select('*, tasks(title)').eq('session_id', session.id).eq('status', 'accepted').order('updated_at', { ascending: true }).limit(5),
    supabase.from('tips').select('*').eq('session_id', session.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(50),
    supabase.from('task_requests').select('id, status, session_id, amount').eq('receiver_id', profile.id).order('created_at', { ascending: false }).limit(10),
  ])

  return NextResponse.json({ sessionId: session.id, tasks: tasks || [], tips: tips || [], debug_all_tasks: allTasks || [] })
}
