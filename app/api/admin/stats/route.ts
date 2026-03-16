import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
export const dynamic = 'force-dynamic'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
  if (!token) throw new Error('Not authenticated')
  const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!)
  const { payload } = await jwtVerify(token, secret)
  return payload
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req)

    const [stats, recentTips, recentRequests, topCreators, tierDist, weeklyTips, weeklyRequests] = await Promise.all([
      supabase.from('admin_stats').select('*').single(),
      supabase.from('tips').select('*, users!tips_receiver_id_fkey(display_name,username)').eq('status','completed').order('created_at',{ascending:false}).limit(10),
      supabase.from('task_requests').select('*, users!task_requests_receiver_id_fkey(display_name,username)').eq('status','completed').order('created_at',{ascending:false}).limit(10),
      supabase.from('users').select('id,username,display_name,tier,lifetime_earned,total_tips_received_amount').eq('accepts_tips',true).order('lifetime_earned',{ascending:false}).limit(10),
      supabase.from('users').select('tier').eq('accepts_tips',true),
      // Weekly tips (last 7 days grouped)
      supabase.from('tips').select('created_at,amount,platform_fee').eq('status','completed').gte('created_at', new Date(Date.now()-7*24*60*60*1000).toISOString()),
      supabase.from('task_requests').select('created_at,amount,platform_fee').eq('status','completed').gte('created_at', new Date(Date.now()-7*24*60*60*1000).toISOString()),
    ])

    // Process weekly data into daily buckets
    const dailyData: Record<string, {tips: number, requests: number, revenue: number}> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i*24*60*60*1000)
      const key = d.toISOString().split('T')[0]
      dailyData[key] = { tips: 0, requests: 0, revenue: 0 }
    }
    weeklyTips.data?.forEach(t => {
      const key = t.created_at.split('T')[0]
      if (dailyData[key]) { dailyData[key].tips += t.amount; dailyData[key].revenue += t.platform_fee || 0 }
    })
    weeklyRequests.data?.forEach(r => {
      const key = r.created_at.split('T')[0]
      if (dailyData[key]) { dailyData[key].requests += r.amount; dailyData[key].revenue += r.platform_fee || 0 }
    })

    // Tier distribution
    const tiers = tierDist.data?.reduce((acc: any, u) => {
      acc[u.tier || 'starter'] = (acc[u.tier || 'starter'] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      stats: stats.data,
      recentTips: recentTips.data || [],
      recentRequests: recentRequests.data || [],
      topCreators: topCreators.data || [],
      tierDistribution: tiers || {},
      weeklyChart: Object.entries(dailyData).map(([date, data]) => ({ date, ...data })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 })
  }
}
