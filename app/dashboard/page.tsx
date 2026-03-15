'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const router = useRouter()
  const [creator, setCreator] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [recentTips, setRecentTips] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalTips: 0, totalTipsAmount: 0,
    totalRequests: 0, totalRequestsAmount: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: c } = await supabase.from('creators').select('*').eq('id', user.id).single()
      if (!c) { router.push('/auth/login'); return }
      setCreator(c)

      const { data: s } = await supabase.from('sessions').select('*')
        .eq('creator_id', user.id).eq('is_active', true).single()
      setSession(s ?? null)

      // Recent tips
      const { data: tipsData } = await supabase.from('tips').select('*')
        .eq('creator_id', user.id).eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(5)
      setRecentTips(tipsData || [])

      // Pending requests (current session only)
      if (s) {
        const { data: reqData } = await supabase.from('task_requests').select('*, tasks(*)')
          .eq('session_id', s.id).eq('status', 'pending')
          .order('created_at', { ascending: false }).limit(5)
        setPendingRequests(reqData || [])
      }

      // Lifetime stats
      const { data: allTips } = await supabase.from('tips').select('amount')
        .eq('creator_id', user.id).eq('status', 'completed')
      const { data: allReqs } = await supabase.from('task_requests').select('amount')
        .eq('creator_id', user.id).eq('status', 'completed')

      setStats({
        totalTips: allTips?.length || 0,
        totalTipsAmount: allTips?.reduce((s, t) => s + t.amount, 0) || 0,
        totalRequests: allReqs?.length || 0,
        totalRequestsAmount: allReqs?.reduce((s, r) => s + r.amount, 0) || 0,
      })

      setLoading(false)
    }
    load()
  }, [router])

  const currency = creator?.currency?.toUpperCase() ?? 'RON'

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] p-6">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#4AFFD4] opacity-[0.02] blur-[120px] pointer-events-none" />
      <div className="max-w-2xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-white/30 text-xs uppercase tracking-widest">TipTask</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{creator?.display_name}</h1>
          </div>
          <Link href="/dashboard/profile"
            className="w-10 h-10 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center text-[#4AFFD4] font-bold hover:bg-[#4AFFD4]/15 transition">
            {creator?.display_name?.[0]}
          </Link>
        </div>

        {/* Session banner */}
        <div className={`rounded-2xl border p-4 mb-6 ${
          session
            ? 'bg-[#4AFFD4]/[0.06] border-[#4AFFD4]/20'
            : 'bg-[#111117] border-white/[0.06]'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {session ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4AFFD4]" />
                  </span>
                  <div>
                    <p className="text-[#4AFFD4] font-semibold text-sm">Session active</p>
                    <p className="text-white/30 text-xs">Requests enabled · Tips always on</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <div>
                    <p className="text-white/60 font-semibold text-sm">No active session</p>
                    <p className="text-white/25 text-xs">Tips still work · Requests disabled</p>
                  </div>
                </>
              )}
            </div>
            <Link href="/dashboard/live"
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                session
                  ? 'bg-white/[0.07] text-white/60 hover:bg-white/[0.10]'
                  : 'bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF]'
              }`}>
              {session ? 'Manage →' : 'Start session →'}
            </Link>
          </div>
        </div>

        {/* Stats — Tips vs Requests */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/dashboard/tips" className="bg-[#111117] border border-white/[0.06] hover:border-amber-500/20 rounded-2xl p-4 transition group">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💸</span>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Tips</p>
            </div>
            <p className="text-amber-400 font-black text-2xl">{stats.totalTipsAmount.toFixed(0)}</p>
            <p className="text-white/20 text-xs">{currency} · {stats.totalTips} tips</p>
          </Link>
          <Link href="/dashboard/requests" className="bg-[#111117] border border-white/[0.06] hover:border-[#4AFFD4]/20 rounded-2xl p-4 transition group">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🎯</span>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Requests</p>
            </div>
            <p className="text-[#4AFFD4] font-black text-2xl">{stats.totalRequestsAmount.toFixed(0)}</p>
            <p className="text-white/20 text-xs">{currency} · {stats.totalRequests} completed</p>
          </Link>
        </div>

        {/* Pending requests alert */}
        {pendingRequests.length > 0 && (
          <Link href="/dashboard/requests"
            className="flex items-center justify-between bg-amber-500/[0.08] border border-amber-500/20 rounded-2xl px-5 py-4 mb-4 hover:bg-amber-500/[0.12] transition">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <div>
                <p className="text-amber-300 font-semibold text-sm">{pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}</p>
                <p className="text-amber-400/50 text-xs">Tap to accept or decline</p>
              </div>
            </div>
            <span className="text-amber-400/50 text-sm">→</span>
          </Link>
        )}

        {/* Recent tips */}
        {recentTips.length > 0 && (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Recent tips</p>
              <Link href="/dashboard/tips" className="text-white/25 text-xs hover:text-white/50 transition">See all →</Link>
            </div>
            <div className="space-y-2">
              {recentTips.map(tip => (
                <div key={tip.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">💸</span>
                    <span className="text-white/60 text-sm truncate">{tip.tipper_name}</span>
                    {tip.message && <span className="text-white/25 text-xs italic truncate">"{tip.message}"</span>}
                  </div>
                  <span className="text-amber-400 font-bold text-sm shrink-0 ml-2">{tip.amount} {currency}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nav grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/dashboard/live', icon: '🔴', label: 'Session', sub: session ? 'Active' : 'Start one' },
            { href: '/dashboard/requests', icon: '🎯', label: 'Requests', sub: pendingRequests.length > 0 ? `${pendingRequests.length} pending` : 'Manage' },
            { href: '/dashboard/tips', icon: '💸', label: 'Tips', sub: 'Live feed' },
            { href: '/dashboard/sessions', icon: '📊', label: 'Sessions', sub: 'Stats & history' },
            { href: '/dashboard/tasks', icon: '📋', label: 'Tasks', sub: 'Manage list' },
            { href: '/dashboard/payments', icon: '💳', label: 'Payments', sub: 'Stripe' },
            { href: '/dashboard/referrals', icon: '🔗', label: 'Referrals', sub: 'Earn 5%' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="bg-[#111117] border border-white/[0.06] hover:border-white/[0.10] rounded-2xl p-4 transition">
              <p className="text-xl mb-2">{item.icon}</p>
              <p className="font-semibold text-white text-sm">{item.label}</p>
              <p className="text-white/30 text-xs mt-0.5">{item.sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
