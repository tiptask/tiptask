'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function FanDashboardPage() {
  const router = useRouter()
  const [fan, setFan] = useState<any>(null)
  const [follows, setFollows] = useState<any[]>([])
  const [tips, setTips] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tips' | 'requests' | 'following'>('tips')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/fan/login'); return }

      const { data: fanData } = await supabase.from('fans').select('*').eq('id', user.id).single()
      if (!fanData) { router.push('/fan/login'); return }
      setFan(fanData)

      // Followed creators with their active session status
      const { data: followData } = await supabase
        .from('fan_follows')
        .select('*, creators(id, username, display_name, currency)')
        .eq('fan_id', user.id)
        .order('created_at', { ascending: false })
      setFollows(followData || [])

      // Tip history
      const { data: tipsData } = await supabase.from('tips').select('*, creators(display_name, username)')
        .eq('fan_id', user.id).eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(20)
      setTips(tipsData || [])

      // Request history
      const { data: reqData } = await supabase.from('task_requests').select('*, creators(display_name, username), tasks(title)')
        .eq('fan_id', user.id)
        .order('created_at', { ascending: false }).limit(20)
      setRequests(reqData || [])

      setLoading(false)
    }
    load()
  }, [router])

  async function unfollow(creatorId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('fan_follows').delete().eq('fan_id', user.id).eq('creator_id', creatorId)
    setFollows(prev => prev.filter(f => f.creator_id !== creatorId))
  }

  async function toggleNotify(followId: string, current: boolean) {
    await supabase.from('fan_follows').update({ notify_on_session_start: !current }).eq('id', followId)
    setFollows(prev => prev.map(f => f.id === followId ? { ...f, notify_on_session_start: !current } : f))
  }

  const totalTipped = tips.reduce((s, t) => s + t.amount, 0)

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-white/30 text-xs uppercase tracking-widest">Fan Dashboard</p>
            <h1 className="text-xl font-bold text-white mt-0.5">{fan?.display_name}</h1>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/fan/login') }}
            className="text-white/25 text-xs hover:text-white/50 transition">Sign out</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-center">
            <p className="text-amber-400 font-black text-xl">{tips.length}</p>
            <p className="text-white/30 text-xs mt-1">Tips sent</p>
          </div>
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-center">
            <p className="text-[#4AFFD4] font-black text-xl">{totalTipped.toFixed(0)}</p>
            <p className="text-white/30 text-xs mt-1">Total tipped</p>
          </div>
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-center">
            <p className="text-purple-400 font-black text-xl">{follows.length}</p>
            <p className="text-white/30 text-xs mt-1">Following</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'tips', label: '💸 Tips' },
            { key: 'requests', label: '🎯 Requests' },
            { key: 'following', label: '❤️ Following' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20'
                  : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.07]'
              }`}>{tab.label}</button>
          ))}
        </div>

        {/* Tips tab */}
        {activeTab === 'tips' && (
          <div className="space-y-2">
            {tips.length === 0 ? (
              <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
                <p className="text-white/30 text-sm">No tips yet</p>
                <p className="text-white/20 text-xs mt-1">Your tips will appear here</p>
              </div>
            ) : tips.map(tip => (
              <div key={tip.id} className="flex items-center justify-between bg-[#111117] border border-white/[0.06] rounded-2xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium">💸 {tip.creators?.display_name}</p>
                  {tip.message && <p className="text-white/35 text-xs italic truncate">"{tip.message}"</p>}
                  <p className="text-white/20 text-xs">{new Date(tip.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-amber-400 font-bold shrink-0 ml-3">{tip.amount} {tip.currency}</p>
              </div>
            ))}
          </div>
        )}

        {/* Requests tab */}
        {activeTab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
                <p className="text-white/30 text-sm">No requests yet</p>
              </div>
            ) : requests.map(req => (
              <div key={req.id} className="flex items-center justify-between bg-[#111117] border border-white/[0.06] rounded-2xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{req.tasks?.title || req.custom_task_text || 'Request'}</p>
                  <p className="text-white/35 text-xs">{req.creators?.display_name}</p>
                  <p className="text-white/20 text-xs">{new Date(req.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-[#4AFFD4] font-bold">{req.amount} {req.currency}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    req.status === 'completed' ? 'bg-[#4AFFD4]/10 text-[#4AFFD4]' :
                    req.status === 'accepted' ? 'bg-blue-500/10 text-blue-400' :
                    req.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-white/[0.06] text-white/30'
                  }`}>{req.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Following tab */}
        {activeTab === 'following' && (
          <div className="space-y-3">
            {follows.length === 0 ? (
              <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-8 text-center">
                <p className="text-white/30 text-sm">Not following anyone yet</p>
                <p className="text-white/20 text-xs mt-1">Visit a creator's page and tap Follow</p>
              </div>
            ) : follows.map(f => (
              <div key={f.id} className="bg-[#111117] border border-white/[0.06] rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between">
                  <Link href={`/${f.creators?.username}`} className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center text-sm font-bold text-[#4AFFD4]">
                      {f.creators?.display_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm">{f.creators?.display_name}</p>
                      <p className="text-white/30 text-xs">@{f.creators?.username}</p>
                    </div>
                  </Link>
                  <button onClick={() => unfollow(f.creator_id)}
                    className="text-white/20 hover:text-red-400 transition text-xs">Unfollow</button>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                  <span className="text-white/30 text-xs">Notify when session starts</span>
                  <button onClick={() => toggleNotify(f.id, f.notify_on_session_start)}
                    className={`w-10 h-5 rounded-full transition-colors ${f.notify_on_session_start ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${f.notify_on_session_start ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
