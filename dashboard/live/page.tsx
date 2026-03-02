'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'react-qr-code'
import type { Creator, Session, Task } from '@/types'

type SessionConfig = {
  show_tasks: boolean
  allow_custom_tasks: boolean
  allow_free_tips: boolean
  free_tip_min_amount: string
}

export default function LivePage() {
  const router = useRouter()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [step, setStep] = useState<'setup' | 'live'>('setup')
  const [config, setConfig] = useState<SessionConfig>({
    show_tasks: true,
    allow_custom_tasks: true,
    allow_free_tips: true,
    free_tip_min_amount: '5',
  })

  const tipUrl = typeof window !== 'undefined' && creator
    ? `${window.location.origin}/tip/${creator.username}`
    : ''

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: creatorData } = await supabase
        .from('creators').select('*').eq('id', user.id).single()
      setCreator(creatorData)

      const { data: tasksData } = await supabase
        .from('tasks').select('*').eq('creator_id', user.id).eq('is_active', true)
      setTasks(tasksData || [])

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('creator_id', user.id)
        .eq('is_active', true)
        .single()

      if (sessionData) {
        setSession(sessionData)
        setStep('live')
      }

      setLoading(false)
    }
    load()
  }, [router])

  async function startLive() {
    if (!creator) return
    setStarting(true)
    const { data, error } = await supabase.from('sessions').insert({
      creator_id: creator.id,
      title: 'Live Session',
      is_active: true,
      show_tasks: config.show_tasks,
      allow_custom_tasks: config.allow_custom_tasks,
      allow_free_tips: config.allow_free_tips,
      free_tip_min_amount: parseFloat(config.free_tip_min_amount) || 5,
    }).select().single()

    if (!error) {
      setSession(data)
      setStep('live')
    }
    setStarting(false)
  }

  async function endLive() {
    if (!session) return
    await supabase.from('sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', session.id)
    setSession(null)
    setStep('setup')
  }

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  if (step === 'live' && session) return (
    <main className="min-h-screen bg-[#08080C] p-8 relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-[#4AFFD4] opacity-[0.03] blur-[100px] pointer-events-none" />
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Live Session</h1>
        </div>

        {/* Live badge */}
        <div className="bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/20 rounded-2xl p-4 text-center mb-6">
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4AFFD4]"></span>
            </span>
            <p className="text-[#4AFFD4] font-semibold">Live — accepting requests</p>
          </div>
        </div>

        {/* QR code */}
        <div className="bg-[#111117] border border-white/[0.06] rounded-3xl p-8 flex flex-col items-center gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4">
            <QRCode value={tipUrl} size={200} />
          </div>
          <p className="text-white/30 font-mono text-sm">{tipUrl}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <button onClick={() => window.open(`/overlay/${creator?.username}`, '_blank')}
            className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-left hover:border-white/10 transition">
            <p className="font-semibold mb-1 text-white">🖥 OBS Overlay</p>
            <p className="text-white/30 text-sm">Browser source URL</p>
          </button>
          <button onClick={() => window.open(`/tip/${creator?.username}`, '_blank')}
            className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 text-left hover:border-white/10 transition">
            <p className="font-semibold mb-1 text-white">👁 Preview</p>
            <p className="text-white/30 text-sm">See what viewers see</p>
          </button>
        </div>

        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4 mb-4 text-sm text-white/30 space-y-1">
          <p>{config.show_tasks && tasks.length > 0 ? `✓ ${tasks.length} tasks visible` : '○ No tasks shown'}</p>
          <p>{config.allow_custom_tasks ? '✓ Custom tasks allowed' : '○ Custom tasks disabled'}</p>
          <p>{config.allow_free_tips ? `✓ Free tips allowed (min ${config.free_tip_min_amount} ${creator?.currency?.toUpperCase() ?? "RON"})` : '○ Free tips disabled'}</p>
        </div>

        <button
          onClick={() => router.push('/dashboard/requests')}
          className="w-full bg-[#111117] border border-white/[0.06] text-white py-3 rounded-2xl font-semibold hover:border-white/10 transition mb-3"
        >
          📨 Incoming Requests
        </button>

        <button onClick={endLive}
          className="w-full border border-red-500/20 text-red-400 py-3 rounded-2xl hover:bg-red-500/[0.06] transition">
          End Live Session
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] p-8 relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-[#4AFFD4] opacity-[0.025] blur-[100px] pointer-events-none" />
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Start Live</h1>
        </div>

        <div className="space-y-4 mb-8">

          {/* Tasks toggle */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-semibold text-white">Show task list</p>
                <p className="text-white/35 text-sm">Viewers can pick from your predefined tasks</p>
              </div>
              <button
                onClick={() => setConfig(p => ({ ...p, show_tasks: !p.show_tasks }))}
                className={`w-12 h-6 rounded-full transition-colors ${config.show_tasks ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${config.show_tasks ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            {config.show_tasks && tasks.length === 0 && (
              <p className="text-amber-400 text-xs mt-2">
                You have no active tasks. <button onClick={() => router.push('/dashboard/tasks')} className="underline">Add tasks →</button>
              </p>
            )}
            {config.show_tasks && tasks.length > 0 && (
              <p className="text-white/20 text-xs mt-2">{tasks.length} active task{tasks.length !== 1 ? 's' : ''} will be shown</p>
            )}
          </div>

          {/* Custom tasks toggle */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Allow custom task requests</p>
              <p className="text-white/35 text-sm">Viewers can describe their own task</p>
            </div>
            <button
              onClick={() => setConfig(p => ({ ...p, allow_custom_tasks: !p.allow_custom_tasks }))}
              className={`w-12 h-6 rounded-full transition-colors ${config.allow_custom_tasks ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${config.allow_custom_tasks ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Free tips toggle */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-white">Allow free tips</p>
                <p className="text-white/35 text-sm">Viewers can send a tip without a task</p>
              </div>
              <button
                onClick={() => setConfig(p => ({ ...p, allow_free_tips: !p.allow_free_tips }))}
                className={`w-12 h-6 rounded-full transition-colors ${config.allow_free_tips ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${config.allow_free_tips ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            {config.allow_free_tips && (
              <div className="relative">
                <input
                  type="number"
                  value={config.free_tip_min_amount}
                  onChange={e => setConfig(p => ({ ...p, free_tip_min_amount: e.target.value }))}
                  placeholder="Minimum tip amount"
                  min="1"
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition pr-16"
                />
                <span className="absolute right-4 top-3 text-white/20 text-sm">RON min</span>
              </div>
            )}
          </div>

        </div>

        {!config.show_tasks && !config.allow_custom_tasks && !config.allow_free_tips && (
          <p className="text-amber-400 text-sm text-center mb-4">⚠ Enable at least one option so viewers can interact</p>
        )}

        <button
          onClick={startLive}
          disabled={starting || (!config.show_tasks && !config.allow_custom_tasks && !config.allow_free_tips)}
          className="w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-extrabold text-xl hover:bg-[#6FFFDF] transition disabled:opacity-50"
        >
          {starting ? 'Starting...' : '🔴 Go Live'}
        </button>
      </div>
    </main>
  )
}
