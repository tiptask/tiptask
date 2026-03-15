'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

export default function RequestsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [pending, setPending] = useState<any[]>([])
  const [accepted, setAccepted] = useState<any[]>([])
  const [done, setDone] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      setProfile(p)
      const { data: s } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).single()
      setSession(s ?? null)
      if (!s) { setLoading(false); return }
      await loadRequests(s.id)
      setLoading(false)
      const channel = supabase.channel('requests-' + user.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests', filter: `receiver_id=eq.${user.id}` }, async () => { if (s) await loadRequests(s.id) })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [router])

  async function loadRequests(sessionId: string) {
    const { data } = await supabase.from('task_requests').select('*, tasks(title)').eq('session_id', sessionId).order('created_at', { ascending: false })
    if (data) {
      setPending(data.filter(r => r.status === 'pending'))
      setAccepted(data.filter(r => r.status === 'accepted'))
      setDone(data.filter(r => ['completed','declined','refunded'].includes(r.status)))
    }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    setActing(id)
    await fetch('/api/payments/respond', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_request_id: id, action }) })
    setActing(null)
  }

  async function complete(id: string) {
    setActing(id)
    await fetch('/api/payments/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_request_id: id }) })
    setActing(null)
  }

  const currency = profile?.currency?.toUpperCase() ?? 'RON'

  const Card = ({ req, showActions }: { req: any, showActions: boolean }) => {
    const isCustom = !!req.custom_task_text
    const label = req.tasks?.title || req.custom_task_text || 'Request'
    return (
      <div className={`rounded-2xl border p-4 ${showActions ? 'border-[#4AFFD4]/20 bg-[#4AFFD4]/[0.04]' : 'border-white/[0.06] bg-[#111117]'}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0"><span>{isCustom ? '✏️' : '🎯'}</span><div className="min-w-0"><p className="font-semibold text-white text-sm truncate">{label}</p><p className="text-white/40 text-xs">by {req.sender_name}</p></div></div>
          <p className="text-white font-bold shrink-0">{req.amount} {currency}</p>
        </div>
        {req.message && <p className="text-white/35 text-xs italic mb-3">"{req.message}"</p>}
        {showActions && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => respond(req.id, 'accept')} disabled={acting === req.id} className="flex-1 bg-[#4AFFD4] text-[#08080C] py-2 rounded-xl text-sm font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">Accept</button>
            <button onClick={() => respond(req.id, 'decline')} disabled={acting === req.id} className="flex-1 border border-red-500/20 text-red-400 py-2 rounded-xl text-sm hover:bg-red-500/[0.06] transition disabled:opacity-50">Decline</button>
          </div>
        )}
        {!showActions && req.status === 'accepted' && (
          <button onClick={() => complete(req.id)} disabled={acting === req.id} className="w-full mt-3 bg-white/[0.07] hover:bg-white/[0.10] text-white py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">✓ Mark done</button>
        )}
      </div>
    )
  }

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <BackButton href="/dashboard" />
            <h1 className="text-2xl font-bold text-white">Requests</h1>
            {session && <div className="ml-auto flex items-center gap-1.5 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 px-3 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" /><span className="text-[#4AFFD4] text-xs font-semibold">Live</span></div>}
          </div>
          {!session ? (
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
              <p className="text-white/40 text-sm">No active session</p>
              <button onClick={() => router.push('/dashboard/live')} className="mt-4 bg-[#4AFFD4] text-[#08080C] px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#6FFFDF] transition">Start session →</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3"><h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest">Pending</h2>{pending.length > 0 && <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold">{pending.length}</span>}</div>
                {pending.length === 0 ? <p className="text-white/20 text-sm">No pending requests</p> : <div className="space-y-3">{pending.map(r => <Card key={r.id} req={r} showActions={true} />)}</div>}
              </div>
              {accepted.length > 0 && (<div><h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">In Progress</h2><div className="space-y-3">{accepted.map(r => <Card key={r.id} req={r} showActions={false} />)}</div></div>)}
              {done.length > 0 && (
                <div>
                  <h2 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">Done</h2>
                  <div className="space-y-2">
                    {done.slice(0, 10).map(r => (
                      <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-[#111117] border border-white/[0.04] rounded-xl">
                        <div className="flex items-center gap-2 min-w-0"><span>{r.custom_task_text ? '✏️' : '🎯'}</span><span className="text-white/40 text-sm truncate">{r.tasks?.title || r.custom_task_text}</span></div>
                        <div className="flex items-center gap-2 shrink-0"><span className="text-white/50 text-sm">{r.amount} {currency}</span><span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'completed' ? 'bg-[#4AFFD4]/10 text-[#4AFFD4]' : r.status === 'declined' ? 'bg-red-500/10 text-red-400' : 'bg-white/[0.06] text-white/30'}`}>{r.status}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
