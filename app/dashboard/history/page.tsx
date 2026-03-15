'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

export default function HistoryPage() {
  const router = useRouter()
  const [tips, setTips] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [tab, setTab] = useState<'tips' | 'requests'>('tips')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const [{ data: t }, { data: r }] = await Promise.all([
        supabase.from('tips').select('*, users!tips_receiver_id_fkey(display_name,username)').eq('sender_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }).limit(50),
        supabase.from('task_requests').select('*, users!task_requests_receiver_id_fkey(display_name,username), tasks(title)').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(50),
      ])
      setTips(t || [])
      setRequests(r || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6"><BackButton href="/dashboard" /><h1 className="text-2xl font-bold text-white">History</h1></div>
          <div className="flex gap-2 mb-5">
            {(['tips', 'requests'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${tab === t ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}>
                {t === 'tips' ? `💸 Tips (${tips.length})` : `🎯 Requests (${requests.length})`}
              </button>
            ))}
          </div>

          {tab === 'tips' && (
            <div className="space-y-2">
              {tips.length === 0 ? <p className="text-white/20 text-sm text-center py-8">No tips sent yet</p> :
                tips.map(tip => (
                  <div key={tip.id} className="flex items-center justify-between bg-[#111117] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium">💸 <Link href={`/${tip.users?.username}`} className="hover:text-[#4AFFD4] transition">{tip.users?.display_name}</Link></p>
                      {tip.message && <p className="text-white/35 text-xs italic truncate">"{tip.message}"</p>}
                      <p className="text-white/20 text-xs">{new Date(tip.created_at).toLocaleDateString()}</p>
                    </div>
                    <p className="text-amber-400 font-bold shrink-0 ml-3">{tip.amount} {tip.currency}</p>
                  </div>
                ))
              }
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-2">
              {requests.length === 0 ? <p className="text-white/20 text-sm text-center py-8">No requests sent yet</p> :
                requests.map(req => (
                  <div key={req.id} className="flex items-center justify-between bg-[#111117] border border-white/[0.06] rounded-2xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{req.tasks?.title || req.custom_task_text || 'Request'}</p>
                      <p className="text-white/35 text-xs"><Link href={`/${req.users?.username}`} className="hover:text-[#4AFFD4] transition">{req.users?.display_name}</Link></p>
                      <p className="text-white/20 text-xs">{new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[#4AFFD4] font-bold">{req.amount} {req.currency}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${req.status === 'completed' ? 'bg-[#4AFFD4]/10 text-[#4AFFD4]' : req.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/[0.06] text-white/30'}`}>{req.status}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
