'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'react-qr-code'

export default function LivePage() {
  const router = useRouter()
  const [creator, setCreator] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [step, setStep] = useState<'setup' | 'live'>('setup')
  const [config, setConfig] = useState({
    show_tasks: true, allow_custom_tasks: true, allow_free_tips: true,
    free_tip_min_amount: '5', use_landing_page: true,
  })
  const [copiedObs, setCopiedObs] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: c } = await supabase.from('creators').select('*').eq('id', user.id).single()
      setCreator(c)
      const { data: t } = await supabase.from('tasks').select('*').eq('creator_id', user.id).eq('is_active', true)
      setTasks(t || [])
      const { data: s } = await supabase.from('sessions').select('*').eq('creator_id', user.id).eq('is_active', true).single()
      if (s) { setSession(s); setStep('live') }
      setLoading(false)
    }
    load()
  }, [router])

  async function startLive() {
    if (!creator) return
    setStarting(true)
    const { data, error } = await supabase.from('sessions').insert({
      creator_id: creator.id, title: 'Tip Session', is_active: true,
      show_tasks: config.show_tasks, allow_custom_tasks: config.allow_custom_tasks,
      allow_free_tips: config.allow_free_tips,
      free_tip_min_amount: parseFloat(config.free_tip_min_amount) || 5,
      use_landing_page: config.use_landing_page,
    }).select().single()
    if (!error) { setSession(data); setStep('live') }
    setStarting(false)
  }

  async function endLive() {
    if (!session) return
    await supabase.from('sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', session.id)
    setSession(null); setStep('setup')
  }

  const currency = creator?.currency?.toUpperCase() ?? 'RON'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const profileUrl = creator ? `${origin}/${creator.username}` : ''
  const tipUrl = creator ? `${origin}/tip/${creator.username}` : ''
  const overlayUrl = creator ? `${origin}/overlay/${creator.username}` : ''

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button onClick={toggle} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
      <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${on ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  )

  if (step === 'live' && session) {
    const liveQr = session.use_landing_page !== false ? profileUrl : tipUrl
    return (
      <main className="min-h-screen bg-[#08080C] p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
            <h1 className="text-2xl font-bold text-white">Tip Session</h1>
          </div>

          {/* Live badge */}
          <div className="bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/20 rounded-2xl p-4 text-center mb-6">
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4AFFD4]"></span>
              </span>
              <p className="text-[#4AFFD4] font-semibold">Session active — accepting tips</p>
            </div>
          </div>

          {/* QR */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-3xl p-8 flex flex-col items-center gap-4 mb-4">
            <div className="bg-white rounded-2xl p-4"><QRCode value={liveQr} size={200} /></div>
            <p className="text-white/30 font-mono text-sm break-all text-center">{liveQr}</p>
            <span className={`text-xs px-3 py-1 rounded-full ${session.use_landing_page !== false ? 'bg-[#4AFFD4]/10 text-[#4AFFD4]' : 'bg-white/[0.06] text-white/40'}`}>
              {session.use_landing_page !== false ? '🖼 Profile landing page' : '⚡ Direct tip form'}
            </span>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <a href={`/${creator?.username}`} target="_blank" rel="noopener noreferrer"
              className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-left hover:border-white/10 transition">
              <p className="font-semibold mb-1 text-white">👁 Preview profile</p>
              <p className="text-white/30 text-sm">See your landing page</p>
            </a>
            <button onClick={() => router.push('/dashboard/requests')}
              className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-left hover:border-white/10 transition">
              <p className="font-semibold mb-1 text-white">📨 Requests</p>
              <p className="text-white/30 text-sm">Manage incoming tips</p>
            </button>
          </div>

          {/* OBS Overlay section */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl overflow-hidden mb-4">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
              <span className="text-lg">🖥</span>
              <div>
                <p className="font-semibold text-white">OBS Overlay</p>
                <p className="text-white/30 text-sm">Add to OBS as a Browser Source</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* URL copy */}
              <div>
                <p className="text-white/40 text-xs mb-2">Browser Source URL</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 font-mono text-sm text-white/50 truncate">
                    {overlayUrl}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(overlayUrl); setCopiedObs(true); setTimeout(() => setCopiedObs(false), 2500) }}
                    className={`shrink-0 px-4 py-3 rounded-xl text-sm font-semibold transition ${copiedObs ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.09] border border-white/[0.06]'}`}>
                    {copiedObs ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* OBS setup steps */}
              <div className="bg-[#08080C] rounded-xl px-4 py-4 space-y-2.5 text-sm">
                <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Setup in OBS</p>
                {[
                  ['1', 'Sources → + → Browser Source'],
                  ['2', 'Paste the URL above'],
                  ['3', 'Set Width: 1920 · Height: 1080'],
                  ['4', 'Check "Shutdown source when not visible"'],
                  ['5', 'In Custom CSS add:', 'body { background-color: rgba(0,0,0,0) !important; }'],
                ].map(([num, text, code]) => (
                  <div key={num} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-white/[0.06] text-white/30 text-xs flex items-center justify-center shrink-0 mt-0.5">{num}</span>
                    <div>
                      <p className="text-white/50">{text}</p>
                      {code && <p className="font-mono text-xs text-[#4AFFD4]/70 mt-1 bg-[#4AFFD4]/[0.05] px-2 py-1 rounded-lg">{code}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* What the overlay shows */}
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: '🔔', label: 'Request alerts' },
                  { icon: '🎯', label: 'Active task' },
                  { icon: '💸', label: 'Tip alerts' },
                  { icon: '📱', label: 'QR code' },
                ].map(item => (
                  <span key={item.label} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-full text-xs text-white/40">
                    {item.icon} {item.label}
                  </span>
                ))}
              </div>

              {/* Optional params */}
              <details className="group">
                <summary className="text-white/25 text-xs cursor-pointer hover:text-white/40 transition list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span> Customize with URL params
                </summary>
                <div className="mt-3 bg-[#08080C] rounded-xl px-4 py-3 font-mono text-xs space-y-1.5 text-white/35">
                  <p><span className="text-[#4AFFD4]/60">?qr=0</span>      — hide QR code</p>
                  <p><span className="text-[#4AFFD4]/60">?active=0</span>   — hide active task bar</p>
                  <p><span className="text-[#4AFFD4]/60">?alerts=0</span>   — hide alert popups</p>
                </div>
              </details>
            </div>
          </div>

          <button onClick={endLive} className="w-full border border-red-500/20 text-red-400 py-3 rounded-2xl hover:bg-red-500/[0.06] transition">
            End Tip Session
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#08080C] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Start Tip Session</h1>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-white">Profile landing page</p>
                <p className="text-white/35 text-sm">QR links to your profile first, viewers tap to tip</p>
              </div>
              <Toggle on={config.use_landing_page} toggle={() => setConfig(p => ({ ...p, use_landing_page: !p.use_landing_page }))} />
            </div>
            <div className={`rounded-xl px-4 py-3 text-xs ${config.use_landing_page ? 'bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/15 text-[#4AFFD4]/80' : 'bg-white/[0.03] border border-white/[0.06] text-white/30'}`}>
              {config.use_landing_page
                ? '✓ Recommended for live streams (Twitch, TikTok, YouTube) — platforms that block direct payment links'
                : '⚡ Direct tip form — for physical locations, events, or displays you control'}
            </div>
          </div>

          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-semibold text-white">Show task list</p>
                <p className="text-white/35 text-sm">Viewers pick from your predefined tasks</p>
              </div>
              <Toggle on={config.show_tasks} toggle={() => setConfig(p => ({ ...p, show_tasks: !p.show_tasks }))} />
            </div>
            {config.show_tasks && tasks.length === 0 && (
              <p className="text-amber-400 text-xs mt-2">No active tasks. <button onClick={() => router.push('/dashboard/tasks')} className="underline">Add tasks →</button></p>
            )}
            {config.show_tasks && tasks.length > 0 && (
              <p className="text-white/20 text-xs mt-2">{tasks.length} active task{tasks.length !== 1 ? 's' : ''} will be shown</p>
            )}
          </div>

          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Allow custom task requests</p>
              <p className="text-white/35 text-sm">Viewers describe their own task</p>
            </div>
            <Toggle on={config.allow_custom_tasks} toggle={() => setConfig(p => ({ ...p, allow_custom_tasks: !p.allow_custom_tasks }))} />
          </div>

          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-white">Allow free tips</p>
                <p className="text-white/35 text-sm">Viewers send a tip without a specific task</p>
              </div>
              <Toggle on={config.allow_free_tips} toggle={() => setConfig(p => ({ ...p, allow_free_tips: !p.allow_free_tips }))} />
            </div>
            {config.allow_free_tips && (
              <div className="relative">
                <input type="number" value={config.free_tip_min_amount}
                  onChange={e => setConfig(p => ({ ...p, free_tip_min_amount: e.target.value }))}
                  placeholder="Minimum tip amount" min="1"
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition pr-24" />
                <span className="absolute right-4 top-3 text-white/20 text-sm">{currency} min</span>
              </div>
            )}
          </div>
        </div>

        {!config.show_tasks && !config.allow_custom_tasks && !config.allow_free_tips && (
          <p className="text-amber-400 text-sm text-center mb-4">⚠ Enable at least one option</p>
        )}

        <button onClick={startLive} disabled={starting || (!config.show_tasks && !config.allow_custom_tasks && !config.allow_free_tips)}
          className="w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-extrabold text-xl hover:bg-[#6FFFDF] transition disabled:opacity-50">
          {starting ? 'Starting session...' : '🔴 Start Session'}
        </button>
      </div>
    </main>
  )
}
