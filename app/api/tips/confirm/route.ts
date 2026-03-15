import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { tip_id } = await req.json()
    if (!tip_id) return NextResponse.json({ error: 'Missing tip_id' }, { status: 400 })

    const { error } = await supabase
      .from('tips')
      .update({ status: 'completed' })
      .eq('id', tip_id)
      .eq('status', 'draft')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update session stats if tip has a session
    const { data: tip } = await supabase.from('tips').select('*').eq('id', tip_id).single()
    if (tip?.session_id) {
      await supabase.rpc('increment_session_tip_stats', {
        p_session_id: tip.session_id,
        p_amount: tip.amount,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
