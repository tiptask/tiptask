'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'
import QRCode from 'react-qr-code'

export default function LivePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [copiedObs, setCopiedObs] = useState(false)
  const [step, setStep] = useState<'setup' | 'live'>('setup')
  const [config, setConfig] = useState({ show_tasks: true, allow_custom_tasks: true, use_landing_page: true })
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      if (!p.accepts_tips) { router.push('/dashboard/profile'); return }
      setProfile(p)
      const { data: t } = await supabase.from('tasks').select('*').eq('user_id', user.id).eq('is_active', true)
      setTasks(t || [])
      const { data: s } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).single()
      if (s) { setSession(s); setStep('live') }
      setLoading(false)
    }
    load()
  }, [router])

  async function startSession() {
    if (!profile) return
    setStarting(true)
    const { data, error } = await supabase.from('sessions').insert({
      user_id: profile.id, is_active: true,
      show_tasks: config.show_tasks, allow_custom_tasks: config.allow_custom_tasks, use_landing_page: config.use_landing_page,
    }).select().single()
    if (!error && data) {
      setSession(data); setStep('live')
      fetch('/api/notifications/session-start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id, session_id: data.id }),
      }).catch(console.error)
    }
    setStarting(false)
  }

  async function endSession() {
    if (!session) return
    await supabase.from('sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', session.id)
    setSession(null); setStep('setup')
  }

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button onClick={toggle} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
      <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${on ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  )

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  const profileUrl = `${origin}/${profile?.username}`
  const tipUrl = `${origin}/tip/${profile?.username}`
  const overlayUrl = `${origin}/overlay/${profile?.username}`
  const liveQr = session?.use_landing_page !== false ? profileUrl : tipUrl

  if (step === 'live' && session) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6"><BackButton href="/dashboard" /><h1 className="text-2xl font-bold text-white">Tip Session</h1></div>

          <div className="bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/20 rounded-2xl p-4 text-center mb-5">
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4AFFD4]" /></span>
              <p className="text-[#4AFFD4] font-semibold">Session active — accepting tips & requests</p>
            </div>
          </div>

          <div className="bg-[#111117] border border-white/[0.06] rounded-3xl p-6 flex flex-col items-center gap-4 mb-4">
            <div className="bg-white rounded-2xl p-4"><QRCode value={liveQr} size={180} /></div>
            <p className="text-white/30 font-mono text-xs break-all text-center">{liveQr}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <a href={`/${profile?.username}`} target="_blank" rel="noopener noreferrer" className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 hover:border-white/10 transition">
              <p className="font-semibold mb-1 text-white">👁 Profile</p><p className="text-white/30 text-sm">View your page</p>
            </a>
            <button onClick={() => router.push('/dashboard/requests')} className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-left hover:border-white/10 transition">
              <p className="font-semibold mb-1 text-white">📨 Requests</p><p className="text-white/30 text-sm">Manage incoming</p>
            </button>
          </div>

          {/* OBS section */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl overflow-hidden mb-4">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
              <span className="text-lg">🖥</span><div><p className="font-semibold text-white">OBS Overlay</p><p className="text-white/30 text-sm">Add as Browser Source</p></div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-2.5 font-mono text-sm text-white/40 truncate">{overlayUrl}</div>
                <button onClick={() => { navigator.clipboard.writeText(overlayUrl); setCopiedObs(true); setTimeout(() => setCopiedObs(false), 2500) }}
                  className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${copiedObs ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.06] text-white/60 border border-white/[0.06]'}`}>
                  {copiedObs ? '✓' : 'Copy'}
                </button>
              </div>
              <div className="bg-[#08080C] rounded-xl px-4 py-3 text-xs space-y-1.5 text-white/35">
                <p className="text-white/50 text-xs uppercase tracking-widest mb-2">OBS Setup</p>
                {[['1','Sources → + → Browser Source'],['2','Paste the URL above'],['3','Width: 600 · Height: 800'],['4','Custom CSS: body { background-color: rgba(0,0,0,0) !important; }']].map(([n,t]) => (
                  <div key={n} className="flex gap-2"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-white/30 flex items-center justify-center shrink-0 mt-0.5 text-xs">{n}</span><p>{t}</p></div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={endSession} className="w-full border border-red-500/20 text-red-400 py-3 rounded-2xl hover:bg-red-500/[0.06] transition">End Session</button>
        </div>
      </main>
      <BottomNav />
    </>
  )

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-8"><BackButton href="/dashboard" /><h1 className="text-2xl font-bold text-white">Start Session</h1></div>
          <div className="space-y-4 mb-8">
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3"><div><p className="font-semibold text-white">Profile landing page</p><p className="text-white/35 text-sm">QR links to your profile first</p></div><Toggle on={config.use_landing_page} toggle={() => setConfig(p => ({ ...p, use_landing_page: !p.use_landing_page }))} /></div>
              <div className={`rounded-xl px-4 py-3 text-xs ${config.use_landing_page ? 'bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/15 text-[#4AFFD4]/80' : 'bg-white/[0.03] border border-white/[0.06] text-white/30'}`}>
                {config.use_landing_page ? '✓ Recommended for live streams (Twitch, TikTok, YouTube)' : '⚡ Direct tip form'}
              </div>
            </div>
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1"><div><p className="font-semibold text-white">Show task list</p><p className="text-white/35 text-sm">Viewers pick from predefined tasks</p></div><Toggle on={config.show_tasks} toggle={() => setConfig(p => ({ ...p, show_tasks: !p.show_tasks }))} /></div>
              {config.show_tasks && tasks.length === 0 && <p className="text-amber-400 text-xs mt-2">No active tasks. <button onClick={() => router.push('/dashboard/tasks')} className="underline">Add tasks →</button></p>}
              {config.show_tasks && tasks.length > 0 && <p className="text-white/20 text-xs mt-2">{tasks.length} active task{tasks.length !== 1 ? 's' : ''}</p>}
            </div>
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
              <div><p className="font-semibold text-white">Allow custom requests</p><p className="text-white/35 text-sm">Viewers describe their own task</p></div>
              <Toggle on={config.allow_custom_tasks} toggle={() => setConfig(p => ({ ...p, allow_custom_tasks: !p.allow_custom_tasks }))} />
            </div>
          </div>
          <button onClick={startSession} disabled={starting} className="w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-extrabold text-xl hover:bg-[#6FFFDF] transition disabled:opacity-50">
            {starting ? 'Starting...' : '🔴 Start Session'}
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
