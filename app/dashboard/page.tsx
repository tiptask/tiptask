'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from "@/lib/supabase"
import type { Creator, Session, TaskRequest } from '@/types'

export default function DashboardPage() {
  const router = useRouter()

  const [creator, setCreator] = useState<Creator | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [pendingRequests, setPendingRequests] = useState<TaskRequest[]>([])
  const [stats, setStats] = useState({ totalEarned: 0, completionRate: 100, totalRequests: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: creatorData } = await supabase
        .from('creators')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!creatorData) { router.push('/auth/login'); return }
      setCreator(creatorData)

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('creator_id', user.id)
        .eq('is_active', true)
        .single()

      setSession(sessionData ?? null)

      if (sessionData) {
        const { data: requestsData } = await supabase
          .from('task_requests')
          .select('*')
          .eq('session_id', sessionData.id)
          .in('status', ['pending', 'accepted'])
          .order('created_at', { ascending: false })
          .limit(5)

        setPendingRequests(requestsData ?? [])
      }

      const { data: allRequests } = await supabase
        .from('task_requests')
        .select('status, amount')
        .eq('creator_id', user.id)

      if (allRequests && allRequests.length > 0) {
        const completed = allRequests.filter(r => r.status === 'completed')
        const totalEarned = completed.reduce((sum, r) => sum + (r.amount || 0), 0)
        const completionRate = Math.round((completed.length / allRequests.length) * 100)
        setStats({ totalEarned, completionRate, totalRequests: allRequests.length })
      }

      setLoading(false)
    }

    load()
  }, [])

  useEffect(() => {
    if (!creator) return

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `creator_id=eq.${creator.id}`,
      }, async () => {
        const { data } = await supabase
          .from('sessions')
          .select('*')
          .eq('creator_id', creator.id)
          .eq('is_active', true)
          .single()
        setSession(data ?? null)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_requests',
        filter: `creator_id=eq.${creator.id}`,
      }, async () => {
        if (!session) return
        const { data } = await supabase
          .from('task_requests')
          .select('*')
          .eq('session_id', session.id)
          .in('status', ['pending', 'accepted'])
          .order('created_at', { ascending: false })
          .limit(5)
        setPendingRequests(data ?? [])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [creator, session])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    )
  }

  const pendingCount = pendingRequests.filter(r => r.status === 'pending').length
  const acceptedCount = pendingRequests.filter(r => r.status === 'accepted').length

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex items-center justify-between px-6 py-5 max-w-4xl mx-auto">
        <span className="text-xl font-bold tracking-tight">TipTask</span>
        <button
          onClick={handleSignOut}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-16 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {creator?.display_name} 👋
          </h1>
          <p className="text-white/40 text-sm mt-1">
            tiptask.io/{creator?.username}
          </p>
        </div>

        {session ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <div>
                <p className="font-semibold text-green-400 text-sm">Session Live</p>
                <p className="text-white/50 text-xs mt-0.5">
                  {pendingCount > 0
                    ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''} waiting`
                    : acceptedCount > 0
                    ? `${acceptedCount} accepted request${acceptedCount > 1 ? 's' : ''} in progress`
                    : 'No requests yet — share your link!'}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/live"
              className="text-sm text-green-400 font-medium hover:text-green-300 transition-colors"
            >
              Manage →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-white/20"></span>
              <div>
                <p className="font-semibold text-white/60 text-sm">No active session</p>
                <p className="text-white/30 text-xs mt-0.5">Start a session to receive requests</p>
              </div>
            </div>
            <Link
              href="/dashboard/live"
              className="text-sm text-white/50 font-medium hover:text-white transition-colors"
            >
              Start Live →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total earned', value: `${stats.totalEarned} ${creator?.currency ?? 'USD'}` },
            { label: 'Completion rate', value: `${stats.completionRate}%` },
            { label: 'Total requests', value: stats.totalRequests },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-[#0d1117] border border-white/5 px-5 py-5">
              <p className="text-white/40 text-sm">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {session && pendingRequests.length > 0 && (
          <div className="rounded-2xl bg-[#0d1117] border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="font-semibold text-sm">Incoming Requests</h2>
              <Link
                href="/dashboard/requests"
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {pendingRequests.map((req) => {
                const typeColor =
                  req.task_id ? 'bg-blue-500/20 text-blue-300'
                  : req.custom_task_text ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-yellow-500/20 text-yellow-300'

                const typeLabel =
                  req.task_id ? '🎯 Task'
                  : req.custom_task_text ? '✏️ Custom'
                  : '💸 Tip'

                const statusColor =
                  req.status === 'pending' ? 'text-yellow-400' : 'text-green-400'

                return (
                  <div key={req.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeColor}`}>
                        {typeLabel}
                      </span>
                      <span className="text-sm text-white/70 truncate">
                        {req.requester_name ?? 'Anonymous'}
                        {req.custom_task_text
                          ? ` — ${req.custom_task_text}`
                          : req.message
                          ? ` — ${req.message}`
                          : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-sm font-semibold">
                        {req.amount} {req.currency}
                      </span>
                      <span className={`text-xs capitalize ${statusColor}`}>
                        {req.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 border-t border-white/5">
              <Link
                href="/dashboard/requests"
                className="block w-full text-center text-sm font-medium text-white bg-white/10 hover:bg-white/15 transition-colors rounded-xl py-2.5"
              >
                Manage Requests
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/dashboard/live"
            className={`rounded-2xl px-5 py-5 border transition-colors ${
              session
                ? 'bg-white text-black border-white hover:bg-white/90'
                : 'bg-[#0d1117] border-white/5 hover:border-white/15'
            }`}
          >
            <p className="text-lg">🔴</p>
            <p className="font-semibold mt-2">{session ? 'Live Session' : 'Start Live'}</p>
            <p className={`text-sm mt-0.5 ${session ? 'text-black/60' : 'text-white/40'}`}>
              {session ? 'Session is live' : 'Generate QR and go live'}
            </p>
          </Link>

          <Link
            href="/dashboard/tasks"
            className="rounded-2xl bg-[#0d1117] border border-white/5 hover:border-white/15 transition-colors px-5 py-5"
          >
            <p className="text-lg">📋</p>
            <p className="font-semibold mt-2">My Tasks</p>
            <p className="text-sm text-white/40 mt-0.5">Manage your task list</p>
          </Link>

          <Link
            href="/dashboard/payments"
            className="rounded-2xl bg-[#0d1117] border border-white/5 hover:border-white/15 transition-colors px-5 py-5"
          >
            <p className="text-lg">💳</p>
            <p className="font-semibold mt-2">Payments</p>
            <p className="text-sm text-white/40 mt-0.5">Connect Stripe to get paid</p>
          </Link>

          <Link
            href="/dashboard/requests"
            className="rounded-2xl bg-[#0d1117] border border-white/5 hover:border-white/15 transition-colors px-5 py-5 relative"
          >
            {pendingCount > 0 && (
              <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
            <p className="text-lg">📬</p>
            <p className="font-semibold mt-2">Requests</p>
            <p className="text-sm text-white/40 mt-0.5">
              {pendingCount > 0 ? `${pendingCount} waiting for you` : 'View all requests'}
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
