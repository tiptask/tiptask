import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: Request) {
  try {
    const { user_id, session_id } = await req.json()
    const { data: user } = await supabase.from('users').select('display_name,username').eq('id', user_id).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: follows } = await supabase.from('follows')
      .select('follower_id, users!follows_follower_id_fkey(email,display_name)')
      .eq('following_id', user_id).eq('notify_on_session_start', true)

    if (!follows?.length) return NextResponse.json({ success: true, sent: 0 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tiptask.me'
    let sent = 0
    for (const follow of follows) {
      const fan = (follow as any).users
      if (!fan?.email) continue
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'TipTask <notifications@tiptask.me>',
            to: fan.email,
            subject: `🔴 ${user.display_name} just went live on TipTask`,
            html: `<div style="background:#08080C;color:white;font-family:sans-serif;padding:40px 24px;max-width:480px;margin:0 auto;"><p style="color:#4AFFD4;font-weight:800;font-size:18px;letter-spacing:2px;">TIPTASK</p><h1 style="font-size:22px;margin:20px 0 8px;">${user.display_name} is live!</h1><p style="color:rgba(255,255,255,0.5);margin-bottom:28px;">Hey ${fan.display_name} — send a tip or request now.</p><a href="${appUrl}/tip/${user.username}" style="display:block;background:#4AFFD4;color:#08080C;text-align:center;padding:16px;border-radius:14px;font-weight:800;text-decoration:none;">💸 Send a tip or request</a><p style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:24px;text-align:center;"><a href="${appUrl}/dashboard/following" style="color:rgba(255,255,255,0.3);">Manage notifications</a></p></div>`,
          }),
        })
        sent++
      } catch (err) { console.error('Email error:', err) }
    }
    return NextResponse.json({ success: true, sent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
