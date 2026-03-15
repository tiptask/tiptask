'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

type CustomLink = { label: string; url: string }

const CURRENCIES = [
  { code: 'RON', label: 'Romanian Leu' },
  { code: 'EUR', label: 'Euro' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'SEK', label: 'Swedish Krona' },
  { code: 'NOK', label: 'Norwegian Krone' },
  { code: 'DKK', label: 'Danish Krone' },
  { code: 'PLN', label: 'Polish Zloty' },
  { code: 'HUF', label: 'Hungarian Forint' },
  { code: 'CZK', label: 'Czech Koruna' },
  { code: 'BGN', label: 'Bulgarian Lev' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'MXN', label: 'Mexican Peso' },
]

const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"

const Field = ({ label, value, onChange, placeholder }: any) => (
  <div><label className="block text-white/40 text-xs mb-1.5">{label}</label><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} /></div>
)

const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
  <button onClick={toggle} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
    <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${on ? 'translate-x-6' : 'translate-x-0'}`} />
  </button>
)

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ display_name: '', bio: '', currency: 'RON', instagram: '', tiktok: '', youtube: '', twitch: '', website: '', accepts_tips: false })
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (p) {
        setProfile(p)
        setForm({ display_name: p.display_name ?? '', bio: p.bio ?? '', currency: p.currency ?? 'RON', instagram: p.instagram ?? '', tiktok: p.tiktok ?? '', youtube: p.youtube ?? '', twitch: p.twitch ?? '', website: p.website ?? '', accepts_tips: p.accepts_tips ?? false })
        setCustomLinks(p.custom_links ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function save() {
    if (!profile) return
    setSaving(true)
    await supabase.from('users').update({ ...form, custom_links: customLinks.filter(l => l.label && l.url) }).eq('id', profile.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }


const Field = ({ label, value, onChange, placeholder }: any) => (
    <div><label className="block text-white/40 text-xs mb-1.5">{label}</label><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} /></div>
  )
const Toggle = ({ on, toggle }: { on: boolean; toggle: () => void }) => (
    <button onClick={toggle} className={`w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
      <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${on ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  )

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-8">
            <BackButton href="/dashboard" />
            <h1 className="text-2xl font-bold text-white">Settings</h1>
          </div>
          <div className="space-y-5">

            {/* Accept tips toggle */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">Accept tips & requests</p>
                  <p className="text-white/35 text-sm mt-0.5">Enable your tip page and get paid by your audience</p>
                </div>
                <Toggle on={form.accepts_tips} toggle={() => setForm(p => ({ ...p, accepts_tips: !p.accepts_tips }))} />
              </div>
              {form.accepts_tips && !profile?.stripe_onboarded && (
                <div className="mt-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-amber-400 text-xs">⚠️ You need to connect Stripe to receive payments. <a href="/dashboard/payments" className="underline">Set up payments →</a></p>
                </div>
              )}
              {form.accepts_tips && profile?.stripe_onboarded && (
                <div className="mt-3 bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/15 rounded-xl px-4 py-3">
                  <p className="text-[#4AFFD4] text-xs">✓ Stripe connected · your tip page is at <a href={`/${profile?.username}`} className="underline">tiptask.me/{profile?.username}</a></p>
                </div>
              )}
            </div>

            {/* Basic */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-4">
              <p className="text-white/50 text-xs uppercase tracking-widest">Basic</p>
              <Field label="Display name" value={form.display_name} onChange={(v: string) => setForm(p => ({ ...p, display_name: v }))} placeholder="Your name" />
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Bio</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Tell people what you do..." rows={3} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Currency</label>
                <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#4AFFD4]/40 transition">
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Social */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-4">
              <p className="text-white/50 text-xs uppercase tracking-widest">Social links</p>
              <Field label="Instagram" value={form.instagram} onChange={(v: string) => setForm(p => ({ ...p, instagram: v }))} placeholder="@username" />
              <Field label="TikTok" value={form.tiktok} onChange={(v: string) => setForm(p => ({ ...p, tiktok: v }))} placeholder="@username" />
              <Field label="YouTube" value={form.youtube} onChange={(v: string) => setForm(p => ({ ...p, youtube: v }))} placeholder="@channel" />
              <Field label="Twitch" value={form.twitch} onChange={(v: string) => setForm(p => ({ ...p, twitch: v }))} placeholder="username" />
              <Field label="Website" value={form.website} onChange={(v: string) => setForm(p => ({ ...p, website: v }))} placeholder="https://yoursite.com" />
            </div>

            {/* Custom links */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/50 text-xs uppercase tracking-widest">Custom links</p>
                <button onClick={() => setCustomLinks(p => [...p, { label: '', url: '' }])} className="text-xs text-[#4AFFD4] hover:text-[#6FFFDF] transition font-semibold">+ Add</button>
              </div>
              {customLinks.length === 0 && <p className="text-white/20 text-sm text-center py-2">No custom links yet</p>}
              <div className="space-y-3">
                {customLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <input value={link.label} onChange={e => setCustomLinks(p => p.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))} placeholder="Label" className={inputCls} />
                      <input value={link.url} onChange={e => setCustomLinks(p => p.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))} placeholder="https://..." className={inputCls} />
                    </div>
                    <button onClick={() => setCustomLinks(p => p.filter((_, idx) => idx !== i))} className="mt-1 text-white/20 hover:text-red-400 transition text-lg pt-2">×</button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={save} disabled={saving}
              className={`w-full py-4 rounded-2xl font-extrabold text-lg transition ${saved ? 'bg-[#4AFFD4]/20 text-[#4AFFD4] border border-[#4AFFD4]/30' : 'bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF]'} disabled:opacity-50`}>
              {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save settings'}
            </button>

            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="w-full py-3 rounded-2xl border border-white/[0.06] text-white/30 hover:text-white/60 hover:border-white/[0.10] transition text-sm">
              Sign out
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
