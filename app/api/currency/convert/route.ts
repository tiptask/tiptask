import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, fromCurrency, toCurrency } = await req.json()

    if (!userId || !fromCurrency || !toCurrency) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }

    if (fromCurrency === toCurrency) {
      return NextResponse.json({ ok: true, rate: 1 })
    }

    // Fetch exchange rate from frankfurter.app (free, no key)
    const rateRes = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`)
    if (!rateRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: 502 })
    }
    const rateData = await rateRes.json()
    const rate = rateData.rates?.[toCurrency]
    if (!rate) {
      return NextResponse.json({ error: `No rate found for ${fromCurrency} → ${toCurrency}` }, { status: 400 })
    }

    // Convert tips (receiver side)
    const { data: tips, error: tipsErr } = await supabaseAdmin
      .from('tips')
      .select('id, amount, platform_fee')
      .eq('receiver_id', userId)
      .eq('status', 'completed')

    if (tipsErr) return NextResponse.json({ error: tipsErr.message }, { status: 500 })

    if (tips && tips.length > 0) {
      const tipsUpdates = tips.map(t => ({
        id: t.id,
        amount: Math.round(t.amount * rate * 100) / 100,
        platform_fee: t.platform_fee != null ? Math.round(t.platform_fee * rate * 100) / 100 : null,
      }))
      for (const t of tipsUpdates) {
        await supabaseAdmin.from('tips').update({ amount: t.amount, platform_fee: t.platform_fee }).eq('id', t.id)
      }
    }

    // Convert task_requests (receiver side)
    const { data: requests, error: reqsErr } = await supabaseAdmin
      .from('task_requests')
      .select('id, amount, platform_fee')
      .eq('receiver_id', userId)
      .in('status', ['completed', 'pending', 'accepted', 'declined', 'refunded'])

    if (reqsErr) return NextResponse.json({ error: reqsErr.message }, { status: 500 })

    if (requests && requests.length > 0) {
      for (const r of requests) {
        await supabaseAdmin.from('task_requests').update({
          amount: Math.round(r.amount * rate * 100) / 100,
          platform_fee: r.platform_fee != null ? Math.round(r.platform_fee * rate * 100) / 100 : null,
        }).eq('id', r.id)
      }
    }

    return NextResponse.json({ ok: true, rate, converted: { tips: tips?.length ?? 0, requests: requests?.length ?? 0 } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
