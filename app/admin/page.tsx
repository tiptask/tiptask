'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></div>

  const s = data?.stats || {}
  const totalRevenue = ((s.total_tips_revenue || 0) + (s.total_requests_revenue || 0)).toFixed(2)
  const totalVolume = ((s.total_tips_volume || 0) + (s.total_requests_volume || 0)).toFixed(2)

  const StatCard = ({ icon, label, value, sub, color = 'text-white' }: any) => (
    <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3"><span className="text-xl">{icon}</span><p className="text-white/40 text-xs uppercase tracking-widest">{label}</p></div>
      <p className={`font-black text-3xl ${color}`}>{value}</p>
      {sub && <p className="text-white/25 text-xs mt-1">{sub}</p>}
    </div>
  )

  const tierColors: Record<string, string> = { starter: 'bg-white/10 text-white/40', rising: 'bg-blue-500/10 text-blue-400', pro: 'bg-purple-500/10 text-purple-400', elite: 'bg-amber-500/10 text-amber-400', partner: 'bg-[#4AFFD4]/10 text-[#4AFFD4]', promo: 'bg-pink-500/10 text-pink-400' }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Dashboard</h1>
        <p className="text-white/30 mt-1">Platform overview · live data</p>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💰" label="Total Revenue" value={`$${totalRevenue}`} sub="Platform fees collected" color="text-[#4AFFD4]" />
        <StatCard icon="📊" label="Total Volume" value={`$${totalVolume}`} sub="Tips + requests" />
        <StatCard icon="👥" label="Total Users" value={s.total_users || 0} sub={`${s.total_creators || 0} creators`} />
        <StatCard icon="🔴" label="Live Now" value={s.live_now || 0} sub={`${s.active_sessions || 0} active sessions`} color="text-red-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💸" label="Tips" value={s.total_tips || 0} sub={`$${(s.total_tips_volume||0).toFixed(2)} volume`} />
        <StatCard icon="🎯" label="Requests" value={s.total_requests || 0} sub={`$${(s.total_requests_volume||0).toFixed(2)} volume`} />
        <StatCard icon="🎟" label="Active Promos" value={s.active_promos || 0} sub={`${s.unused_invites || 0} unused invites`} color="text-pink-400" />
        <StatCard icon="❤️" label="Total Follows" value={s.total_follows || 0} sub="Creator follows" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly chart */}
        <div className="lg:col-span-2 bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-4">Last 7 Days</p>
          <div className="space-y-2">
            {data?.weeklyChart?.map((day: any) => {
              const maxRevenue = Math.max(...(data.weeklyChart.map((d: any) => d.revenue)), 1)
              const pct = (day.revenue / maxRevenue) * 100
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-white/30 text-xs w-20 shrink-0">{new Date(day.date).toLocaleDateString('en', {weekday:'short', month:'short', day:'numeric'})}</span>
                  <div className="flex-1 bg-white/[0.04] rounded-full h-2">
                    <div className="h-2 bg-[#4AFFD4] rounded-full transition-all" style={{width: `${Math.max(pct, 2)}%`}} />
                  </div>
                  <span className="text-[#4AFFD4] text-xs font-bold w-16 text-right">${day.revenue.toFixed(2)}</span>
                  <span className="text-white/20 text-xs w-16 text-right">{day.tips > 0 ? `$${day.tips.toFixed(0)}` : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tier distribution */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-4">Creator Tiers</p>
          <div className="space-y-2">
            {Object.entries(data?.tierDistribution || {}).map(([tier, count]: any) => (
              <div key={tier} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tierColors[tier] || 'bg-white/10 text-white/40'}`}>{tier}</span>
                <span className="text-white/60 text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top creators */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/50 text-xs uppercase tracking-widest">Top Creators</p>
            <Link href="/admin/users?sort=lifetime_earned" className="text-white/25 text-xs hover:text-white/50 transition">See all →</Link>
          </div>
          <div className="space-y-3">
            {data?.topCreators?.map((u: any, i: number) => (
              <Link key={u.id} href={`/admin/users?search=${u.username}`} className="flex items-center justify-between hover:bg-white/[0.02] rounded-xl px-2 py-1.5 transition">
                <div className="flex items-center gap-3">
                  <span className="text-white/20 text-xs w-4">#{i+1}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{u.display_name}</p>
                    <p className="text-white/30 text-xs">@{u.username}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#4AFFD4] text-sm font-bold">${(u.lifetime_earned||0).toFixed(0)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tierColors[u.tier] || 'bg-white/10 text-white/40'}`}>{u.tier}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-4">Recent Transactions</p>
          <div className="space-y-2">
            {[...(data?.recentTips||[]).map((t: any) => ({...t, type:'tip'})), ...(data?.recentRequests||[]).map((r: any) => ({...r, type:'request'}))]
              .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0,10)
              .map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{tx.type === 'tip' ? '💸' : '🎯'}</span>
                  <div className="min-w-0">
                    <p className="text-white/60 text-xs truncate">{tx.sender_name} → {tx.users?.display_name}</p>
                    <p className="text-white/20 text-xs">{new Date(tx.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-white text-xs font-bold">{tx.amount} {tx.currency}</p>
                  <p className="text-[#4AFFD4] text-xs">fee: {tx.platform_fee}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
