'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const TIERS = ['starter','rising','pro','elite','partner','promo']
const TIER_RATES: Record<string, number> = { starter: 0.15, rising: 0.12, pro: 0.10, elite: 0.08, partner: 0.05, promo: 0.00 }
const tierColors: Record<string, string> = { starter: 'bg-white/10 text-white/40', rising: 'bg-blue-500/10 text-blue-400', pro: 'bg-purple-500/10 text-purple-400', elite: 'bg-amber-500/10 text-amber-400', partner: 'bg-[#4AFFD4]/10 text-[#4AFFD4]', promo: 'bg-pink-500/10 text-pink-400' }

function UsersContent() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [tierFilter, setTierFilter] = useState(searchParams.get('tier') || '')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  async function loadUsers(p = 1) {
    setLoading(true)
    const params = new URLSearchParams({ page: p.toString(), ...(search && { search }), ...(tierFilter && { tier: tierFilter }) })
    const res = await fetch(`/api/admin/users?${params}`)
    const data = await res.json()
    setUsers(data.users || [])
    setTotal(data.total || 0)
    setPages(data.pages || 1)
    setPage(p)
    setLoading(false)
  }

  useEffect(() => { loadUsers(1) }, [search, tierFilter])

  async function saveUser() {
    if (!editing) return
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: editing.id,
        updates: {
          tier: editing.tier,
          custom_commission_rate: TIER_RATES[editing.tier],
          accepts_tips: editing.accepts_tips,
          is_featured: editing.is_featured,
          admin_notes: editing.admin_notes,
        }
      })
    })
    setSaving(false)
    setEditing(null)
    loadUsers(page)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold text-white">Users</h1><p className="text-white/30 mt-0.5">{total} total</p></div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username, email, name..."
          className="flex-1 bg-[#111117] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition" />
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
          className="bg-[#111117] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#4AFFD4]/40 transition">
          <option value="">All tiers</option>
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/[0.06]">
                <tr className="text-white/30 text-xs uppercase tracking-widest">
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Tier</th>
                  <th className="text-right px-4 py-3">Lifetime</th>
                  <th className="text-right px-4 py-3">Tips rcvd</th>
                  <th className="text-center px-4 py-3">Creator</th>
                  <th className="text-center px-4 py-3">Live</th>
                  <th className="text-left px-4 py-3">Promo exp</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium text-sm">{u.display_name}</p>
                        <p className="text-white/30 text-xs">@{u.username} · {u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tierColors[u.tier] || 'bg-white/10 text-white/40'}`}>{u.tier || 'starter'}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-white/60 text-sm">${(u.lifetime_earned||0).toFixed(0)}</td>
                    <td className="px-4 py-3 text-right text-white/60 text-sm">{u.total_tips_received_count || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs ${u.accepts_tips ? 'text-[#4AFFD4]' : 'text-white/20'}`}>{u.accepts_tips ? '✓' : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs ${u.is_live ? 'text-red-400' : 'text-white/20'}`}>{u.is_live ? '🔴' : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs">
                      {u.promo_expires_at ? new Date(u.promo_expires_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setEditing({...u})} className="text-white/30 hover:text-[#4AFFD4] transition text-xs">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
            <p className="text-white/30 text-xs">{total} users</p>
            <div className="flex gap-2">
              <button onClick={() => loadUsers(page-1)} disabled={page <= 1} className="text-white/30 hover:text-white/60 disabled:opacity-30 text-sm">← Prev</button>
              <span className="text-white/40 text-sm">{page}/{pages}</span>
              <button onClick={() => loadUsers(page+1)} disabled={page >= pages} className="text-white/30 hover:text-white/60 disabled:opacity-30 text-sm">Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-[#111117] border border-white/[0.10] rounded-3xl p-8 max-w-md w-full space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit User</h2>
              <button onClick={() => setEditing(null)} className="text-white/30 hover:text-white/60 transition text-xl">×</button>
            </div>

            <div>
              <p className="text-white font-medium">{editing.display_name}</p>
              <p className="text-white/30 text-sm">@{editing.username} · {editing.email}</p>
            </div>

            <div>
              <label className="block text-white/40 text-xs mb-1.5">Tier</label>
              <select value={editing.tier || 'starter'} onChange={e => setEditing((p: any) => ({...p, tier: e.target.value}))}
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#4AFFD4]/40 transition">
                {TIERS.map(t => <option key={t} value={t}>{t} ({Math.round((TIER_RATES[t]||0.15)*100)}%)</option>)}
              </select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.accepts_tips} onChange={e => setEditing((p: any) => ({...p, accepts_tips: e.target.checked}))} className="rounded" />
                <span className="text-white/60 text-sm">Accepts tips</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editing.is_featured} onChange={e => setEditing((p: any) => ({...p, is_featured: e.target.checked}))} className="rounded" />
                <span className="text-white/60 text-sm">Featured</span>
              </label>
            </div>

            <div>
              <label className="block text-white/40 text-xs mb-1.5">Admin notes</label>
              <textarea value={editing.admin_notes || ''} onChange={e => setEditing((p: any) => ({...p, admin_notes: e.target.value}))} rows={3}
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition resize-none"
                placeholder="Internal notes..." />
            </div>

            <div className="text-xs text-white/25 space-y-1">
              <p>Lifetime earned: ${(editing.lifetime_earned||0).toFixed(2)}</p>
              <p>Joined: {new Date(editing.created_at).toLocaleDateString()}</p>
              {editing.promo_expires_at && <p>Promo expires: {new Date(editing.promo_expires_at).toLocaleDateString()}</p>}
            </div>

            <div className="flex gap-3">
              <button onClick={saveUser} disabled={saving} className="flex-1 bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button onClick={() => setEditing(null)} className="px-5 py-3 rounded-xl border border-white/[0.08] text-white/40 hover:text-white/60 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return <Suspense fallback={<div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></div>}><UsersContent /></Suspense>
}
