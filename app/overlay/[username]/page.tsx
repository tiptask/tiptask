'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import QRCode from 'react-qr-code'

type AlertData = {
  id: string
  type: 'task' | 'custom' | 'tip'
  name: string
  amount: number
  currency: string
  label: string
  message?: string
  duration: number
  expiresAt: number
}

type ActiveTask = {
  id: string
  type: 'task' | 'custom'
  label: string
  name: string
  amount: number
  currency: string
  respondedAt: string
}

type TipInfo = {
  id: string
  name: string
  amount: number
  currency: string
  message?: string
} | null

export default function OverlayPage({ params: paramsPromise }: { params: Promise<{ username: string }> }) {
  const params = React.use(paramsPromise)
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
  const [lastTip, setLastTip] = useState<TipInfo>(null)
  const [highTip, setHighTip] = useState<TipInfo>(null)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const showQR     = sp?.get('qr')     !== '0'
  const showActive = sp?.get('active') !== '0'
  const showAlerts = sp?.get('alerts') !== '0'
  const qrLabel    = sp?.get('label')  || 'scan to tip'
  const qrSize     = parseInt(sp?.get('qrsize') || '220')
  const colW       = sp?.get('colw')   || 'calc(100vw - 32px)'

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setAlerts(prev => prev.filter(a => a.expiresAt > t))
    }, 500)
    return () => clearInterval(i)
  }, [])

  async function reloadTasks(sid: string) {
    const { data } = await supabase
      .from('task_requests').select('*, tasks(*)')
      .eq('session_id', sid)
      .eq('status', 'accepted')
      .or('task_id.not.is.null,custom_task_text.not.is.null')
      .order('responded_at', { ascending: true })
      .limit(5)
    if (data) {
      setActiveTasks(data.map(r => ({
        id: r.id,
        type: r.custom_task_text ? 'custom' : 'task',
        label: r.tasks?.title || r.custom_task_text || 'Task',
        name: r.requester_name,
        amount: r.amount,
        currency: r.currency,
        respondedAt: r.responded_at,
      })))
    }
  }

  async function reloadTips(sid: string) {
    const { data } = await supabase
      .from('task_requests').select('*')
      .eq('session_id', sid)
      .eq('status', 'accepted')
      .is('task_id', null)
      .is('custom_task_text', null)
      .order('responded_at', { ascending: false })

    if (!data?.length) return

    // Last tip = most recent
    const last = data[0]
    setLastTip({ id: last.id, name: last.requester_name, amount: last.amount, currency: last.currency, message: last.message || undefined })

    // Highest tip = max amount
    const high = data.reduce((a, b) => b.amount > a.amount ? b : a, data[0])
    setHighTip({ id: high.id, name: high.requester_name, amount: high.amount, currency: high.currency, message: high.message || undefined })
  }

  useEffect(() => {
    async function load() {
      const { data: creatorData } = await supabase
        .from('creators').select('*').eq('username', params.username).single()
      if (!creatorData) return

      const { data: sessionData } = await supabase
        .from('sessions').select('*')
        .eq('creator_id', creatorData.id).eq('is_active', true).single()
      if (!sessionData) return

      await reloadTasks(sessionData.id)
      await reloadTips(sessionData.id)

      supabase.channel(`overlay-${creatorData.id}-${Date.now()}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'task_requests',
          filter: `creator_id=eq.${creatorData.id}`,
        }, async (payload) => {
          const req = payload.new as any

          // Always fetch full record — don't trust payload.new fields (REPLICA IDENTITY may not be FULL)
          if (['pending', 'accepted'].includes(req.status)) {
            const { data } = await supabase
              .from('task_requests').select('*, tasks(*)')
              .eq('id', req.id).single()
            if (data) {
              const reallyFreeTip = !data.task_id && !data.custom_task_text
              // Alert: pending tasks/requests, or accepted free tips
              if (data.status === 'pending' || (data.status === 'accepted' && reallyFreeTip)) {
                addAlert(data)
              }
            }
          }

          if (['accepted', 'completed', 'declined', 'refunded'].includes(req.status)) {
            await reloadTasks(sessionData.id)
            await reloadTips(sessionData.id)
          }
        })
        .subscribe()
    }
    load()
  }, [params.username])

  function addAlert(req: any) {
    const isFreeTip = !req.task_id && !req.custom_task_text
    const duration = isFreeTip ? 10000 : 30000
    setAlerts(prev => [...prev, {
      id: req.id + '-' + Date.now(),
      type: isFreeTip ? 'tip' : req.custom_task_text ? 'custom' : 'task',
      name: req.requester_name || 'Someone',
      amount: req.amount,
      currency: req.currency,
      label: req.tasks?.title || req.custom_task_text || 'Free tip',
      message: req.message || undefined,
      duration,
      expiresAt: Date.now() + duration,
    }])
  }

  function dismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  const tipUrl = `${origin}/tip/${params.username}`
  const dotColor = { tip: '#FBBF24', task: '#4AFFD4', custom: '#A855F7' }
  const amtColor = { tip: '#FBBF24', task: '#4AFFD4', custom: '#C084FC' }

  const TipRow = ({ label, tip }: { label: string, tip: TipInfo }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(251,191,36,0.45)', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 72 }}>{label}</span>
      {tip ? (
        <>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)', flexShrink: 0 }}>{tip.name}</span>
          {tip.message && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{tip.message}"
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 800, color: '#FBBF24', flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 'auto', paddingLeft: 8 }}>
            {tip.amount} <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.28)' }}>{tip.currency}</span>
          </span>
        </>
      ) : (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
      )}
    </div>
  )

  const TaskRow = ({ type, label, amount, currency, name }: {
    type: 'task' | 'custom', label: string, amount: number, currency: string, name: string
  }) => (
    <div style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(10,10,16,0.82)', backdropFilter: 'blur(16px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor[type], flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: amtColor[type], flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 6 }}>
          {amount} <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.28)' }}>{currency}</span>
        </span>
      </div>
      <div style={{ paddingLeft: 11, marginTop: 1 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>by {name}</span>
      </div>
    </div>
  )

  return (
    <div className="w-screen h-screen overflow-hidden relative"
      style={{ background: 'transparent', backgroundColor: 'transparent' }}>
      <style>{`
        html, body { background: transparent !important; background-color: transparent !important; overflow: hidden; }
        * { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-sizing: border-box; }
        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .slide-in  { animation: slideDown 0.22s ease-out forwards; }
        .pulse-dot { animation: pulseDot 1.5s ease-in-out infinite; }
      `}</style>

      <div style={{
        position: 'absolute', left: 16, top: 16, bottom: 16,
        width: colW,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>

        {/* ── TIPS — top, no border, two rows ── */}
        {(lastTip || highTip) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(10,10,16,0.70)', backdropFilter: 'blur(16px)' }}>
            <TipRow label="Last tip:" tip={lastTip} />
            <div style={{ height: 1, background: 'rgba(251,191,36,0.08)' }} />
            <TipRow label="Highest tip:" tip={highTip} />
          </div>
        )}

        {/* ── ALERTS ── */}
        {showAlerts && alerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: '40%', overflow: 'hidden' }}>
            {alerts.map((a) => {
              const progress = Math.max(0, (a.expiresAt - now) / a.duration)
              const secs = Math.ceil((a.expiresAt - now) / 1000)
              return (
                <div key={a.id} className="slide-in"
                  style={{ borderRadius: 8, overflow: 'hidden', background: 'rgba(10,10,16,0.84)', backdropFilter: 'blur(16px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor[a.type], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0, fontWeight: 600 }}>{a.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.label}{a.message ? ` — ${a.message}` : ''}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: amtColor[a.type], flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 6 }}>
                      {a.amount} <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.28)' }}>{a.currency}</span>
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', flexShrink: 0, marginLeft: 4 }}>{secs}s</span>
                    <button onClick={() => dismiss(a.id)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.18)', fontSize: 10, cursor: 'pointer', flexShrink: 0, padding: 0 }}>✕</button>
                  </div>
                  <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ height: '100%', width: `${progress * 100}%`, background: dotColor[a.type], transition: 'width 0.5s linear' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* ── BOTTOM: QR + task list ── */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>

          {showQR && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ background: 'white', borderRadius: 10, padding: 7 }}>
                <QRCode value={tipUrl} size={qrSize} />
              </div>
              {qrLabel && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.04em', textAlign: 'center', maxWidth: qrSize + 14 }}>
                  {qrLabel}
                </span>
              )}
            </div>
          )}

          {showActive && activeTasks.length > 0 && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, paddingLeft: 2 }}>
                <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#4AFFD4' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(74,255,212,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  In Progress · {activeTasks.length}
                </span>
              </div>
              {activeTasks.map((t) => (
                <TaskRow key={t.id} type={t.type} label={t.label} amount={t.amount} currency={t.currency} name={t.name} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
