'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TopNav, BottomNav } from '@/components/nav'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [recentTips, setRecentTips] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [stats, setStats] = useState({ tipsReceivedAmount: 0, tipsReceivedCount: 0, requestsAmount: 0, requestsCount: 0, tipsSentAmount: 0, tipsSentCount: 0 })
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      setProfile(p)

      if (p.accepts_tips) {
        const { data: s } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).single()
        setSession(s ?? null)
        if (s) {
          const { data: reqs } = await supabase.from('task_requests').select('*').eq('session_id', s.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(5)
          setPendingRequests(reqs || [])
        }
        const { data: tips } = await supabase.from('tips').select('*').eq('receiver_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(5)
        setRecentTips(tips || [])
      }

      userIdRef.current = user.id

      // Stats
      const [{ data: tipsRec }, { data: reqs }, { data: tipsSent }] = await Promise.all([
        supabase.from('tips').select('amount').eq('receiver_id', user.id).eq('status', 'completed'),
        supabase.from('task_requests').select('amount').eq('receiver_id', user.id).eq('status', 'completed'),
        supabase.from('tips').select('amount').eq('sender_id', user.id).eq('status', 'completed'),
      ])
      setStats({
        tipsReceivedAmount: tipsRec?.reduce((s, t) => s + t.amount, 0) || 0,
        tipsReceivedCount: tipsRec?.length || 0,
        requestsAmount: reqs?.reduce((s, r) => s + r.amount, 0) || 0,
        requestsCount: reqs?.length || 0,
        tipsSentAmount: tipsSent?.reduce((s, t) => s + t.amount, 0) || 0,
        tipsSentCount: tipsSent?.length || 0,
      })
      setLoading(false)
    }
    load()
  }, [router])

  // Realtime + polling — reload dashboard every 5s
  useEffect(() => {
    if (!userIdRef.current) return
    const uid = userIdRef.current

    async function refresh() {
      const [{ data: tipsRec }, { data: reqs }, { data: tipsSent }, { data: s }] = await Promise.all([
        supabase.from('tips').select('amount').eq('receiver_id', uid).eq('status', 'completed'),
        supabase.from('task_requests').select('amount').eq('receiver_id', uid).eq('status', 'completed'),
        supabase.from('tips').select('amount').eq('sender_id', uid).eq('status', 'completed'),
        supabase.from('sessions').select('*').eq('user_id', uid).eq('is_active', true).single(),
      ])
      setStats({
        tipsReceivedAmount: tipsRec?.reduce((s, t) => s + t.amount, 0) || 0,
        tipsReceivedCount: tipsRec?.length || 0,
        requestsAmount: reqs?.reduce((s, r) => s + r.amount, 0) || 0,
        requestsCount: reqs?.length || 0,
        tipsSentAmount: tipsSent?.reduce((s, t) => s + t.amount, 0) || 0,
        tipsSentCount: tipsSent?.length || 0,
      })
      setSession(s ?? null)

      if (s) {
        const { data: recentReqs } = await supabase.from('task_requests').select('*')
          .eq('session_id', s.id).eq('status', 'pending')
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .order('created_at', { ascending: false }).limit(5)
        setPendingRequests(recentReqs || [])
        const { data: tips } = await supabase.from('tips').select('*')
          .eq('receiver_id', uid).eq('status', 'completed')
          .order('created_at', { ascending: false }).limit(5)
        setRecentTips(tips || [])
      }
    }

    const tipsChannel = supabase.channel(`dash-tips-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tips', filter: `receiver_id=eq.${uid}` }, refresh)
      .subscribe()
    const reqsChannel = supabase.channel(`dash-reqs-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests', filter: `receiver_id=eq.${uid}` }, refresh)
      .subscribe()
    const poll = setInterval(refresh, 5000)

    return () => {
      supabase.removeChannel(tipsChannel)
      supabase.removeChannel(reqsChannel)
      clearInterval(poll)
    }
  }, [loading]) // runs after initial load completes

  const currency = profile?.currency?.toUpperCase() ?? 'RON'

  if (loading) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14">
        <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
      </main>
    </>
  )

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="fixed top-14 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#4AFFD4] opacity-[0.02] blur-[120px] pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <p className="text-white/30 text-xs uppercase tracking-widest">Dashboard</p>
              <h1 className="text-2xl font-bold text-white mt-0.5">{profile?.display_name}</h1>
            </div>
            <Link href={`/${profile?.username}`}
              className="w-10 h-10 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center text-[#4AFFD4] font-bold hover:bg-[#4AFFD4]/15 transition">
              {profile?.display_name?.[0]}
            </Link>
          </div>

          {/* Creator section — only if accepts_tips */}
          {profile?.accepts_tips && (
            <>
              {/* Session banner */}
              <div className={`rounded-2xl border p-4 mb-5 ${session ? 'bg-[#4AFFD4]/[0.06] border-[#4AFFD4]/20' : 'bg-[#111117] border-white/[0.06]'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {session ? (
                      <><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4AFFD4]" /></span>
                      <div><p className="text-[#4AFFD4] font-semibold text-sm">Session active</p><p className="text-white/30 text-xs">Requests enabled</p></div></>
                    ) : (
                      <><span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                      <div><p className="text-white/60 font-semibold text-sm">No active session</p><p className="text-white/25 text-xs">Tips still work</p></div></>
                    )}
                  </div>
                  <Link href="/dashboard/live" className={`px-4 py-2 rounded-xl text-sm font-bold transition ${session ? 'bg-white/[0.07] text-white/60 hover:bg-white/[0.10]' : 'bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF]'}`}>
                    {session ? 'Manage →' : 'Start session →'}
                  </Link>
                </div>
              </div>

              {/* Pending requests alert */}
              {pendingRequests.length > 0 && (
                <Link href="/dashboard/requests" className="flex items-center justify-between bg-amber-500/[0.08] border border-amber-500/20 rounded-2xl px-5 py-4 mb-5 hover:bg-amber-500/[0.12] transition">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" /></span>
                    <div><p className="text-amber-300 font-semibold text-sm">{pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}</p><p className="text-amber-400/50 text-xs">Tap to accept or decline</p></div>
                  </div>
                  <span className="text-amber-400/50">→</span>
                </Link>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <Link href="/dashboard/tips" className="bg-[#111117] border border-white/[0.06] hover:border-amber-500/20 rounded-2xl p-4 transition">
                  <div className="flex items-center gap-2 mb-2"><span>💸</span><p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Tips received</p></div>
                  <p className="text-amber-400 font-black text-2xl">{stats.tipsReceivedAmount.toFixed(0)}</p>
                  <p className="text-white/20 text-xs">{currency} · {stats.tipsReceivedCount} tips</p>
                </Link>
                <Link href="/dashboard/requests" className="bg-[#111117] border border-white/[0.06] hover:border-[#4AFFD4]/20 rounded-2xl p-4 transition">
                  <div className="flex items-center gap-2 mb-2"><span>🎯</span><p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Requests</p></div>
                  <p className="text-[#4AFFD4] font-black text-2xl">{stats.requestsAmount.toFixed(0)}</p>
                  <p className="text-white/20 text-xs">{currency} · {stats.requestsCount} done</p>
                </Link>
              </div>

              {/* Recent tips */}
              {recentTips.length > 0 && (
                <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Recent tips</p>
                    <Link href="/dashboard/tips" className="text-white/25 text-xs hover:text-white/50 transition">See all →</Link>
                  </div>
                  <div className="space-y-2">
                    {recentTips.map(tip => (
                      <div key={tip.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0"><span>💸</span><span className="text-white/60 text-sm truncate">{tip.sender_name}</span>{tip.message && <span className="text-white/25 text-xs italic truncate">"{tip.message}"</span>}</div>
                        <span className="text-amber-400 font-bold text-sm shrink-0 ml-2">{tip.amount} {currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tips sent (everyone) */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-2"><span>🎁</span><p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Tips sent</p></div>
            <p className="text-white font-black text-2xl">{stats.tipsSentAmount.toFixed(0)}</p>
            <p className="text-white/20 text-xs">{currency} · {stats.tipsSentCount} tips sent</p>
          </div>

          {/* Nav grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: `/${profile?.username}`, icon: '👤', label: 'My profile', sub: 'Public page' },
              { href: '/dashboard/following', icon: '❤️', label: 'Following', sub: 'Creators I follow' },
              { href: '/dashboard/history', icon: '📜', label: 'History', sub: 'Tips & requests sent' },
              { href: '/dashboard/profile', icon: '⚙️', label: 'Settings', sub: 'Profile & tips setup' },
              ...(profile?.accepts_tips ? [
                { href: '/dashboard/live', icon: '🔴', label: 'Session', sub: session ? 'Active' : 'Start one' },
                { href: '/dashboard/tasks', icon: '📋', label: 'Tasks', sub: 'Manage list' },
                { href: '/dashboard/sessions', icon: '📊', label: 'Sessions', sub: 'Stats & history' },
                { href: '/dashboard/payments', icon: '💳', label: 'Payments', sub: 'Stripe' },
              ] : [
                { href: '/dashboard/profile', icon: '💰', label: 'Enable tips', sub: 'Get tipped too' },
              ]),
              { href: '/dashboard/referrals', icon: '🔗', label: 'Referrals', sub: 'Earn 5%' },
            ].map(item => (
              <Link key={item.href + item.label} href={item.href}
                className="bg-[#111117] border border-white/[0.06] hover:border-white/[0.10] rounded-2xl p-4 transition">
                <p className="text-xl mb-2">{item.icon}</p>
                <p className="font-semibold text-white text-sm">{item.label}</p>
                <p className="text-white/30 text-xs mt-0.5">{item.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
