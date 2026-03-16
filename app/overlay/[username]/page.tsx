'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import QRCode from 'react-qr-code'

type TipInfo = { id: string; name: string; amount: number; currency: string; message?: string } | null
type ActiveTask = { id: string; type: 'task' | 'custom'; label: string; name: string; amount: number; currency: string; status: 'pending' | 'accepted' }

export default function OverlayPage({ params: paramsPromise }: { params: Promise<{ username: string }> }) {
  const params = React.use(paramsPromise)
  const [lastTip, setLastTip] = useState<TipInfo>(null)
  const [highTip, setHighTip] = useState<TipInfo>(null)
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const showQR = sp?.get('qr') !== '0'
  const qrSize = parseInt(sp?.get('qrsize') || '200')
  const qrLabel = sp?.get('label') || 'scan to tip'

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setAlerts(p => p.filter(a => a.expiresAt > t))
    }, 500)
    return () => clearInterval(i)
  }, [])

  async function fetchOverlayData() {
    const res = await fetch(`/api/overlay/data?username=${params.username}`)
    if (!res.ok) return null
    const json = await res.json()
    if (json.sessionId) setSessionId(json.sessionId)

    // Pending first (oldest), then accepted (oldest, max 5)
    const mapTask = (r: any, status: 'pending' | 'accepted'): ActiveTask => ({
      id: r.id,
      type: r.custom_task_text ? 'custom' : 'task',
      label: r.tasks?.title || r.custom_task_text || 'Task',
      name: r.sender_name,
      amount: r.amount,
      currency: r.currency,
      status,
    })
    setActiveTasks([
      ...(json.pending || []).map((r: any) => mapTask(r, 'pending')),
      ...(json.accepted || []).map((r: any) => mapTask(r, 'accepted')),
    ])

    // Tips
    const tips = json.tips || []
    if (tips.length > 0) {
      setLastTip({ id: tips[0].id, name: tips[0].sender_name, amount: tips[0].amount, currency: tips[0].currency, message: tips[0].message })
      const high = tips.reduce((a: any, b: any) => b.amount > a.amount ? b : a)
      setHighTip({ id: high.id, name: high.sender_name, amount: high.amount, currency: high.currency, message: high.message })
    }

    return json.sessionId as string | null
  }

  useEffect(() => {
    let channel: any = null
    let pollInterval: any = null

    async function load() {
      const sid = await fetchOverlayData()
      if (!sid) return

      const { data: profile } = await supabase.from('users').select('id').eq('username', params.username).single()
      if (!profile) return

      pollInterval = setInterval(fetchOverlayData, 5000)

      channel = supabase.channel(`overlay-${profile.id}-${Date.now()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tips', filter: `receiver_id=eq.${profile.id}` }, async (p) => {
          if (p.new.status === 'completed') {
            const { data } = await supabase.from('tips').select('*').eq('id', p.new.id).single()
            if (data) {
              addAlert({ type: 'tip', name: data.sender_name, amount: data.amount, currency: data.currency, message: data.message, duration: 10000 })
            }
            await fetchOverlayData()
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests', filter: `receiver_id=eq.${profile.id}` }, async (p) => {
          if (p.new.status === 'pending') {
            const { data } = await supabase.from('task_requests').select('*, tasks(title)').eq('id', p.new.id).single()
            if (data) {
              addAlert({
                type: data.custom_task_text ? 'custom' : 'task',
                name: data.sender_name,
                amount: data.amount,
                currency: data.currency,
                label: data.tasks?.title || data.custom_task_text,
                message: data.message,
                duration: 30000,
              })
            }
          }
          await fetchOverlayData()
        })
        .subscribe()
    }

    load()
    return () => {
      if (channel) supabase.removeChannel(channel)
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [params.username])

  function addAlert(a: any) {
    setAlerts(p => [...p, { ...a, id: a.name + Date.now(), expiresAt: Date.now() + a.duration }])
  }

  const tipUrl = `${origin}/${params.username}`
  const dotColor: Record<string, string> = { tip: '#FBBF24', task: '#4AFFD4', custom: '#A855F7' }

  const TipRow = ({ label, tip }: { label: string; tip: TipInfo }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(251,191,36,0.45)', minWidth: 72 }}>{label}</span>
      {tip ? (
        <>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>{tip.name}</span>
          {tip.message && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{tip.message}"
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 800, color: '#FBBF24', marginLeft: 'auto', paddingLeft: 8, whiteSpace: 'nowrap' }}>
            {tip.amount} <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.28)' }}>{tip.currency}</span>
          </span>
        </>
      ) : (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
      )}
    </div>
  )

  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: 'transparent', backgroundColor: 'transparent' }}>
      <style>{`
        html,body{background:transparent!important;background-color:transparent!important;overflow:hidden;}
        *{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-sizing:border-box;}
        @keyframes slideDown{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes pulseDot{0%,100%{opacity:.5}50%{opacity:1}}
        .slide-in{animation:slideDown .22s ease-out forwards}
        .pulse-dot{animation:pulseDot 1.5s ease-in-out infinite}
      `}</style>

      <div style={{ position: 'absolute', left: 16, top: 16, bottom: 16, width: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Last tip / Highest tip */}
        {(lastTip || highTip) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(10,10,16,0.70)', backdropFilter: 'blur(16px)' }}>
            <TipRow label="Last tip:" tip={lastTip} />
            <div style={{ height: 1, background: 'rgba(251,191,36,0.08)' }} />
            <TipRow label="Highest tip:" tip={highTip} />
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: '40%', overflow: 'hidden' }}>
            {alerts.map(a => {
              const progress = Math.max(0, (a.expiresAt - now) / a.duration)
              const secs = Math.ceil((a.expiresAt - now) / 1000)
              return (
                <div key={a.id} className="slide-in" style={{ borderRadius: 8, overflow: 'hidden', background: 'rgba(10,10,16,0.84)', backdropFilter: 'blur(16px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor[a.type] || '#4AFFD4', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0, fontWeight: 600 }}>{a.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.label || 'Tip'}{a.message ? ` — ${a.message}` : ''}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: dotColor[a.type] || '#4AFFD4', flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 6 }}>
                      {a.amount} <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.28)' }}>{a.currency}</span>
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', flexShrink: 0, marginLeft: 4 }}>{secs}s</span>
                    <button onClick={() => setAlerts(p => p.filter(x => x.id !== a.id))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.18)', fontSize: 10, cursor: 'pointer', flexShrink: 0, padding: 0 }}>✕</button>
                  </div>
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ height: '100%', width: `${progress * 100}%`, background: dotColor[a.type] || '#4AFFD4', transition: 'width .5s linear' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Bottom row: QR + tasks */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
          {showQR && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ background: 'white', borderRadius: 10, padding: 7 }}>
                <QRCode value={tipUrl} size={qrSize} />
              </div>
              {qrLabel && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textAlign: 'center' }}>{qrLabel}</span>
              )}
            </div>
          )}

          {activeTasks.length > 0 && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#4AFFD4' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(74,255,212,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Tasks · {activeTasks.filter(t => t.status === 'accepted').length} in progress · {activeTasks.filter(t => t.status === 'pending').length} pending
                </span>
              </div>
              {activeTasks.map(t => {
                const isPending = t.status === 'pending'
                const accentColor = isPending ? '#FBBF24' : (t.type === 'custom' ? '#A855F7' : '#4AFFD4')
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'baseline', gap: 5, padding: '5px 8px', borderRadius: 7, background: isPending ? 'rgba(251,191,36,0.07)' : 'rgba(10,10,16,0.82)', backdropFilter: 'blur(16px)', borderLeft: `2px solid ${accentColor}30` }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor, flexShrink: 0, marginBottom: 1 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: accentColor, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {t.amount} <span style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.25)' }}>{t.currency}</span>
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 400, whiteSpace: 'nowrap' }}>by {t.name}</span>
                    {isPending && <span style={{ fontSize: 9, color: 'rgba(251,191,36,0.5)', fontWeight: 600, whiteSpace: 'nowrap' }}>pending</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
