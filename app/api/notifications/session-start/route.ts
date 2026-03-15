import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { creator_id, session_id } = await req.json()
    if (!creator_id) return NextResponse.json({ error: 'Missing creator_id' }, { status: 400 })

    // Get creator info
    const { data: creator } = await supabase
      .from('creators').select('display_name, username').eq('id', creator_id).single()
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 })

    // Get all fans following this creator with notifications enabled
    const { data: follows } = await supabase
      .from('fan_follows')
      .select('fan_id, fans(email, display_name)')
      .eq('creator_id', creator_id)
      .eq('notify_on_session_start', true)

    if (!follows || follows.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    // Send emails via Resend
    const tipUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://tiptask.me'}/tip/${creator.username}`
    const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://tiptask.me'}/${creator.username}`

    let sent = 0
    for (const follow of follows) {
      const fan = (follow as any).fans
      if (!fan?.email) continue

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'TipTask <notifications@tiptask.me>',
            to: fan.email,
            subject: `🔴 ${creator.display_name} just went live on TipTask`,
            html: `
<!DOCTYPE html>
<html>
<body style="background:#08080C;color:white;font-family:-apple-system,sans-serif;margin:0;padding:0;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <p style="color:#4AFFD4;font-weight:800;font-size:18px;letter-spacing:2px;margin:0 0 32px;">TIPTASK</p>
    <div style="background:#111117;border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:32px;">
      <div style="width:48px;height:48px;border-radius:50%;background:rgba(74,255,212,0.1);border:2px solid rgba(74,255,212,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:20px;font-weight:800;color:#4AFFD4;text-align:center;line-height:48px;">
        ${creator.display_name[0].toUpperCase()}
      </div>
      <h1 style="color:white;font-size:22px;font-weight:800;text-align:center;margin:0 0 8px;">
        ${creator.display_name} is live!
      </h1>
      <p style="color:rgba(255,255,255,0.4);text-align:center;font-size:14px;margin:0 0 28px;">
        Hey ${fan.display_name} — a session just started. Send a tip or request now.
      </p>
      <a href="${tipUrl}" style="display:block;background:#4AFFD4;color:#08080C;text-align:center;padding:16px;border-radius:14px;font-weight:800;font-size:16px;text-decoration:none;margin-bottom:12px;">
        💸 Send a tip or request
      </a>
      <a href="${profileUrl}" style="display:block;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);text-align:center;padding:12px;border-radius:14px;font-weight:600;font-size:14px;text-decoration:none;">
        View profile
      </a>
    </div>
    <p style="color:rgba(255,255,255,0.15);text-align:center;font-size:12px;margin-top:24px;">
      You're getting this because you follow ${creator.display_name} on TipTask.<br/>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://tiptask.me'}/fan/dashboard" style="color:rgba(255,255,255,0.25);">Manage notifications</a>
    </p>
  </div>
</body>
</html>
            `,
          }),
        })
        sent++
      } catch (err) {
        console.error('Email send error:', err)
      }
    }

    return NextResponse.json({ success: true, sent })
  } catch (err: any) {
    console.error('Notify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
