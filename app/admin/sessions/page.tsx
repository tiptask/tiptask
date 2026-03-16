'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/admin/sessions')
    const data = await res.json()
    setSessions(data.sessions || [])
    setLoading(false)
  }

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i) }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Live Sessions</h1>
          <p className="text-white/30 mt-0.5">Auto-refreshes every 10 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4AFFD4]" /></span>
          <span className="text-[#4AFFD4] text-sm font-semibold">{sessions.length} active</span>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></div> :
        sessions.length === 0 ? (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-12 text-center">
            <p className="text-white/40">No active sessions right now</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map(s => (
              <div key={s.id} className="bg-[#111117] border border-[#4AFFD4]/20 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#4AFFD4]" /></span>
                      <p className="text-white font-bold">{s.users?.display_name}</p>
                      <p className="text-white/30 text-sm">@{s.users?.username}</p>
                    </div>
                    <p className="text-white/30 text-xs">Started {new Date(s.started_at).toLocaleTimeString()}</p>
                  </div>
                  <Link href={`/${s.users?.username}`} target="_blank" className="text-[#4AFFD4] text-xs hover:text-[#6FFFDF] transition">View page ↗</Link>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="bg-[#08080C] rounded-xl px-3 py-2">
                    <p className="text-white/30 text-xs">Tips</p>
                    <p className="text-white font-bold">{s.total_tips_count || 0}</p>
                    <p className="text-amber-400 text-xs">{(s.total_tips_amount||0).toFixed(0)} {s.users?.currency}</p>
                  </div>
                  <div className="bg-[#08080C] rounded-xl px-3 py-2">
                    <p className="text-white/30 text-xs">Requests</p>
                    <p className="text-white font-bold">{s.total_requests_count || 0}</p>
                    <p className="text-[#4AFFD4] text-xs">{(s.total_requests_amount||0).toFixed(0)} {s.users?.currency}</p>
                  </div>
                  <div className="bg-[#08080C] rounded-xl px-3 py-2">
                    <p className="text-white/30 text-xs">Tippers</p>
                    <p className="text-white font-bold">{s.unique_tippers_count || 0}</p>
                  </div>
                  <div className="bg-[#08080C] rounded-xl px-3 py-2">
                    <p className="text-white/30 text-xs">Tier</p>
                    <p className="text-white font-bold text-xs">{s.users?.tier || 'starter'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
