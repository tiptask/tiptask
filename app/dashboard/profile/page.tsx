'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'

type CustomLink = { label: string; url: string }

const CURRENCIES = [
  'RON','EUR','USD','GBP','CHF','SEK','NOK','DKK','PLN',
  'HUF','CZK','BGN','CAD','AUD','NZD','SGD','HKD','JPY','BRL','MXN'
]

const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [convertingCurrency, setConvertingCurrency] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [currency, setCurrency] = useState('RON')
  const [originalCurrency, setOriginalCurrency] = useState('RON')
  const [instagram, setInstagram] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [youtube, setYoutube] = useState('')
  const [twitch, setTwitch] = useState('')
  const [website, setWebsite] = useState('')
  const [acceptsTips, setAcceptsTips] = useState(false)
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (p) {
        setProfile(p)
        setDisplayName(p.display_name ?? '')
        setBio(p.bio ?? '')
        setCurrency(p.currency ?? 'RON')
        setOriginalCurrency(p.currency ?? 'RON')
        setInstagram(p.instagram ?? '')
        setTiktok(p.tiktok ?? '')
        setYoutube(p.youtube ?? '')
        setTwitch(p.twitch ?? '')
        setWebsite(p.website ?? '')
        setAcceptsTips(p.accepts_tips ?? false)
        setCustomLinks(p.custom_links ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function save() {
    if (!profile) return
    setSaving(true)
    setConvertError(null)

    // If currency changed, convert all existing records first
    if (currency !== originalCurrency) {
      setConvertingCurrency(true)
      try {
        const res = await fetch('/api/currency/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.id, fromCurrency: originalCurrency, toCurrency: currency }),
        })
        const data = await res.json()
        if (!res.ok) {
          setConvertError(data.error || 'Currency conversion failed')
          setSaving(false)
          setConvertingCurrency(false)
          return
        }
      } catch (err: any) {
        setConvertError(err.message || 'Currency conversion failed')
        setSaving(false)
        setConvertingCurrency(false)
        return
      }
      setConvertingCurrency(false)
    }

    await supabase.from('users').update({
      display_name: displayName,
      bio, currency, instagram, tiktok, youtube, twitch, website,
      accepts_tips: acceptsTips,
      custom_links: customLinks.filter(l => l.label && l.url),
    }).eq('id', profile.id)

    setOriginalCurrency(currency)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function updateLink(i: number, field: 'label' | 'url', val: string) {
    setCustomLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  const currencyChanged = currency !== originalCurrency

  if (loading) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14">
        <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
      </main>
    </>
  )

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
                  <p className="text-white/35 text-sm mt-0.5">Enable your tip page and get paid</p>
                </div>
                <button
                  onClick={() => setAcceptsTips(p => !p)}
                  className={`w-12 h-6 rounded-full transition-colors shrink-0 ${acceptsTips ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${acceptsTips ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              {acceptsTips && !profile?.stripe_onboarded && (
                <div className="mt-3 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-amber-400 text-xs">⚠️ Connect Stripe to receive payments. <a href="/dashboard/payments" className="underline">Set up →</a></p>
                </div>
              )}
              {acceptsTips && profile?.stripe_onboarded && (
                <div className="mt-3 bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/15 rounded-xl px-4 py-3">
                  <p className="text-[#4AFFD4] text-xs">✓ Stripe connected · <a href={`/${profile?.username}`} className="underline">tiptask.me/{profile?.username}</a></p>
                </div>
              )}
            </div>

            {/* Basic */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-4">
              <p className="text-white/50 text-xs uppercase tracking-widest">Basic</p>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Display name</label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell people what you do..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className={inputCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {/* Warning when currency changed */}
                {currencyChanged && (
                  <div className="mt-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-3 py-2.5">
                    <p className="text-amber-400 text-xs">
                      ⚠️ Changing from <strong>{originalCurrency}</strong> to <strong>{currency}</strong> will convert all your existing tips and requests using today's exchange rate.
                    </p>
                  </div>
                )}
                {convertError && (
                  <div className="mt-2 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-3 py-2.5">
                    <p className="text-red-400 text-xs">❌ {convertError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Social */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-4">
              <p className="text-white/50 text-xs uppercase tracking-widest">Social links</p>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Instagram</label>
                <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">TikTok</label>
                <input value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="@username" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">YouTube</label>
                <input value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="@channel" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Twitch</label>
                <input value={twitch} onChange={e => setTwitch(e.target.value)} placeholder="username" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Website</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yoursite.com" className={inputCls} />
              </div>
            </div>

            {/* Custom links */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/50 text-xs uppercase tracking-widest">Custom links</p>
                <button
                  onClick={() => setCustomLinks(p => [...p, { label: '', url: '' }])}
                  className="text-xs text-[#4AFFD4] hover:text-[#6FFFDF] transition font-semibold">
                  + Add
                </button>
              </div>
              {customLinks.length === 0 && <p className="text-white/20 text-sm text-center py-2">No custom links yet</p>}
              <div className="space-y-3">
                {customLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1.5">
                      <input
                        value={link.label}
                        onChange={e => updateLink(i, 'label', e.target.value)}
                        placeholder="Label"
                        className={inputCls}
                      />
                      <input
                        value={link.url}
                        onChange={e => updateLink(i, 'url', e.target.value)}
                        placeholder="https://..."
                        className={inputCls}
                      />
                    </div>
                    <button
                      onClick={() => setCustomLinks(p => p.filter((_, idx) => idx !== i))}
                      className="mt-1 text-white/20 hover:text-red-400 transition text-lg pt-2">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className={`w-full py-4 rounded-2xl font-extrabold text-lg transition ${saved ? 'bg-[#4AFFD4]/20 text-[#4AFFD4] border border-[#4AFFD4]/30' : 'bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF]'} disabled:opacity-50`}>
              {convertingCurrency ? '⟳ Converting currency...' : saved ? '✓ Saved' : saving ? 'Saving...' : 'Save settings'}
            </button>

            <button
              onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
              className="w-full py-3 rounded-2xl border border-white/[0.06] text-white/30 hover:text-white/60 hover:border-white/[0.10] transition text-sm">
              Sign out
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
