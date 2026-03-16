'use client'
import { useEffect, useState } from 'react'

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ note: '', duration_days: '30' })
  const [newInvite, setNewInvite] = useState<any>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function loadInvites() {
    const res = await fetch('/api/admin/invites')
    const data = await res.json()
    setInvites(data.invites || [])
    setLoading(false)
  }

  useEffect(() => { loadInvites() }, [])

  async function createInvite() {
    setCreating(true)
    const res = await fetch('/api/admin/invites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: form.note, duration_days: parseInt(form.duration_days) }),
    })
    const data = await res.json()
    setNewInvite(data)
    setForm({ note: '', duration_days: '30' })
    setCreating(false)
    loadInvites()
  }

  async function revokeInvite(id: string) {
    if (!confirm('Revoke this invite? The user will lose their promo tier.')) return
    await fetch('/api/admin/invites', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: id, action: 'revoke' }),
    })
    loadInvites()
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2500)
  }

  const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Promo Invites</h1>
        <p className="text-white/30 mt-0.5">Single-use invite links with 0% platform fee for X days</p>
      </div>

      {/* Create new */}
      <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-6">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-4">Create Invite</p>
        <div className="space-y-3">
          <div>
            <label className="block text-white/40 text-xs mb-1.5">Note (for your reference)</label>
            <input value={form.note} onChange={e => setForm(p => ({...p, note: e.target.value}))} placeholder="e.g. DJ Marco - TikTok promo" className={inputCls} />
          </div>
          <div>
            <label className="block text-white/40 text-xs mb-1.5">Promo duration (days)</label>
            <div className="flex gap-2">
              {['7','14','30','60','90'].map(d => (
                <button key={d} onClick={() => setForm(p => ({...p, duration_days: d}))}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${form.duration_days === d ? 'bg-[#4AFFD4] text-[#08080C]' : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08]'}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <button onClick={createInvite} disabled={creating}
            className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
            {creating ? 'Creating...' : `Generate ${form.duration_days}-day invite →`}
          </button>
        </div>

        {newInvite && (
          <div className="mt-4 bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 rounded-xl p-4">
            <p className="text-[#4AFFD4] font-semibold text-sm mb-2">✓ Invite created!</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-white/60 text-xs break-all">{newInvite.url}</code>
              <button onClick={() => copy(newInvite.url, 'new')}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${copied === 'new' ? 'bg-[#4AFFD4]/20 text-[#4AFFD4]' : 'bg-white/[0.08] text-white/50'}`}>
                {copied === 'new' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invites list */}
      <div className="space-y-3">
        <p className="text-white/50 text-xs uppercase tracking-widest">All Invites ({invites.length})</p>
        {loading ? <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></div> :
          invites.map(invite => {
            const used = !!invite.used_by_user_id
            const revoked = invite.is_revoked
            const expired = invite.promo_expires_at && new Date(invite.promo_expires_at) < new Date()
            const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://tiptask.me'}/invite/${invite.code}`

            return (
              <div key={invite.id} className={`bg-[#111117] border rounded-2xl p-4 ${revoked ? 'border-red-500/20 opacity-60' : used ? 'border-white/[0.04]' : 'border-[#4AFFD4]/20'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <code className="text-white font-mono text-sm">{invite.code}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        revoked ? 'bg-red-500/10 text-red-400' :
                        used && expired ? 'bg-white/[0.06] text-white/30' :
                        used ? 'bg-blue-500/10 text-blue-400' :
                        'bg-[#4AFFD4]/10 text-[#4AFFD4]'
                      }`}>
                        {revoked ? 'Revoked' : used && expired ? 'Expired' : used ? 'Active' : 'Unused'}
                      </span>
                      <span className="bg-white/[0.06] text-white/30 text-xs px-2 py-0.5 rounded-full">{invite.duration_days}d promo</span>
                    </div>
                    {invite.note && <p className="text-white/40 text-xs mb-1">"{invite.note}"</p>}
                    {used && invite.users && (
                      <p className="text-white/40 text-xs">Used by <span className="text-white/60 font-medium">{invite.users.display_name}</span> (@{invite.users.username}) on {new Date(invite.used_at).toLocaleDateString()}</p>
                    )}
                    {used && invite.promo_expires_at && (
                      <p className="text-white/30 text-xs mt-0.5">Promo {expired ? 'expired' : 'expires'}: {new Date(invite.promo_expires_at).toLocaleDateString()}</p>
                    )}
                    {!used && <p className="text-white/25 text-xs">Created {new Date(invite.created_at).toLocaleDateString()} by {invite.created_by}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!used && !revoked && (
                      <button onClick={() => copy(inviteUrl, invite.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${copied === invite.id ? 'bg-[#4AFFD4]/20 text-[#4AFFD4]' : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.10]'}`}>
                        {copied === invite.id ? '✓' : 'Copy link'}
                      </button>
                    )}
                    {!revoked && (
                      <button onClick={() => revokeInvite(invite.id)}
                        className="px-3 py-1.5 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] transition">
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
