'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TaskRequest } from '@/types'

type Props = {
  sessionId: string
  requesterName: string
  requestIds?: string[]
  onClose: () => void
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'text-amber-400',   dot: 'bg-amber-400 animate-pulse',  bg: 'bg-amber-500/[0.06] border-amber-500/15' },
  accepted:  { label: 'Accepted',  color: 'text-[#4AFFD4]',   dot: 'bg-[#4AFFD4] animate-pulse',  bg: 'bg-[#4AFFD4]/[0.06] border-[#4AFFD4]/15' },
  completed: { label: 'Done',      color: 'text-[#4AFFD4]',   dot: 'bg-[#4AFFD4]',               bg: 'bg-[#4AFFD4]/[0.04] border-[#4AFFD4]/10' },
  declined:  { label: 'Declined',  color: 'text-red-400',     dot: 'bg-red-400',                  bg: 'bg-red-500/[0.04] border-red-500/10' },
  refunded:  { label: 'Refunded',  color: 'text-white/30',    dot: 'bg-white/15',                 bg: 'bg-white/[0.03] border-white/[0.06]' },
}

export function FanHistory({ sessionId, requesterName, requestIds, onClose }: Props) {
  const [requests, setRequests] = useState<TaskRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPaid, setTotalPaid] = useState(0)

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('task_requests')
        .select('*, tasks(*)')
        .order('created_at', { ascending: false })

      if (requestIds && requestIds.length > 0) {
        query = query.in('id', requestIds)
      } else {
        query = query.eq('session_id', sessionId).eq('requester_name', requesterName)
      }

      const { data } = await query

      const items = data || []
      setRequests(items)
      setTotalPaid(
        items
          .filter(r => r.status === 'completed')
          .reduce((sum, r) => sum + (r.amount || 0), 0)
      )
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('fan-history-' + sessionId + '-' + requesterName)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'task_requests',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const updated = payload.new as TaskRequest
        if (updated.requester_name === requesterName) {
          setRequests(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
          if (updated.status === 'completed') {
            setTotalPaid(prev => prev + (updated.amount || 0))
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, requesterName])

  function getLabel(req: TaskRequest) {
    if (req.tasks?.title) return req.tasks.title
    if (req.custom_task_text) return req.custom_task_text
    return 'Free tip'
  }

  function getType(req: TaskRequest) {
    if (req.custom_task_text) return { icon: '✏️', label: 'Custom' }
    if (req.task_id) return { icon: '🎯', label: 'Task' }
    return { icon: '💸', label: 'Tip' }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col justify-end">
      <div className="bg-[#0D0D12] rounded-t-3xl border-t border-white/[0.06] max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
          <div>
            <h2 className="font-bold text-lg text-white">My requests</h2>
            <p className="text-white/25 text-xs mt-0.5">Sent by {requesterName}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition text-sm text-white/40">
            ✕
          </button>
        </div>

        {/* Stats */}
        {requests.length > 0 && (
          <div className="flex gap-3 px-6 py-4 border-b border-white/[0.04]">
            <div className="flex-1 bg-white/[0.04] rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-white">{requests.length}</p>
              <p className="text-white/25 text-xs mt-0.5">Sent</p>
            </div>
            <div className="flex-1 bg-white/[0.04] rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-white">{requests.filter(r => r.status === 'completed').length}</p>
              <p className="text-white/25 text-xs mt-0.5">Completed</p>
            </div>
            {totalPaid > 0 && (
              <div className="flex-1 bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/15 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-[#4AFFD4]">
                  {totalPaid} {requests[0]?.currency}
                </p>
                <p className="text-white/25 text-xs mt-0.5">Paid</p>
              </div>
            )}
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
            </div>
          )}

          {!loading && requests.length === 0 && (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-white/25 text-sm">No requests yet this session</p>
            </div>
          )}

          {requests.map(req => {
            const sc = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
            const type = getType(req)
            return (
              <div key={req.id} className={`rounded-2xl p-4 border ${sc.bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="text-lg shrink-0 mt-0.5">{type.icon}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug text-white">{getLabel(req)}</p>
                      {req.message && (
                        <p className="text-white/25 text-xs mt-1 italic truncate">"{req.message}"</p>
                      )}
                      <p className="text-white/20 text-xs mt-1">{timeAgo(req.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-white">{req.amount} {req.currency}</p>
                    <div className="flex items-center gap-1.5 justify-end mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      <span className={`text-xs ${sc.color}`}>{sc.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-6 pb-6 pt-2">
          <button onClick={onClose}
            className="w-full border border-white/[0.08] text-white/35 py-3 rounded-2xl text-sm hover:border-white/15 hover:text-white/55 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
