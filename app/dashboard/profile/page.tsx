'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type CustomLink = { label: string; url: string }

export default function ProfileEditorPage() {
  const router = useRouter()
  const [creator, setCreator] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    display_name: '', bio: '',
    instagram: '', tiktok: '', youtube: '', twitch: '', website: '',
  })
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: c } = await supabase.from('creators').select('*').eq('id', user.id).single()
      if (c) {
        setCreator(c)
        setForm({
          display_name: c.display_name ?? '',
          bio: c.bio ?? '',
          instagram: c.instagram ?? '',
          tiktok: c.tiktok ?? '',
          youtube: c.youtube ?? '',
          twitch: c.twitch ?? '',
          website: c.website ?? '',
        })
        setCustomLinks(c.custom_links ?? [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function save() {
    if (!creator) return
    setSaving(true)
    await supabase.from('creators').update({
      ...form,
      custom_links: customLinks.filter(l => l.label && l.url),
    }).eq('id', creator.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function addLink() {
    setCustomLinks(prev => [...prev, { label: '', url: '' }])
  }

  function updateLink(i: number, field: 'label' | 'url', val: string) {
    setCustomLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  function removeLink(i: number) {
    setCustomLinks(prev => prev.filter((_, idx) => idx !== i))
  }

  const Field = ({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string
  }) => (
    <div>
      <label className="block text-white/40 text-xs mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"
      />
    </div>
  )

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] p-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
        </div>

        <div className="space-y-6">

          {/* Basic info */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <p className="text-white/50 text-xs uppercase tracking-widest">Basic</p>
            <Field label="Display name" value={form.display_name} onChange={v => setForm(p => ({ ...p, display_name: v }))} placeholder="Your name" />
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                placeholder="Tell viewers what you do..."
                rows={3}
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition resize-none"
              />
            </div>
          </div>

          {/* Social links */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <p className="text-white/50 text-xs uppercase tracking-widest">Social links</p>
            <Field label="Instagram" value={form.instagram} onChange={v => setForm(p => ({ ...p, instagram: v }))} placeholder="@username" />
            <Field label="TikTok" value={form.tiktok} onChange={v => setForm(p => ({ ...p, tiktok: v }))} placeholder="@username" />
            <Field label="YouTube" value={form.youtube} onChange={v => setForm(p => ({ ...p, youtube: v }))} placeholder="@channel" />
            <Field label="Twitch" value={form.twitch} onChange={v => setForm(p => ({ ...p, twitch: v }))} placeholder="username" />
            <Field label="Website" value={form.website} onChange={v => setForm(p => ({ ...p, website: v }))} placeholder="https://yoursite.com" />
          </div>

          {/* Custom links */}
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/50 text-xs uppercase tracking-widest">Custom links</p>
              <button onClick={addLink}
                className="text-xs text-[#4AFFD4] hover:text-[#6FFFDF] transition font-semibold">
                + Add link
              </button>
            </div>
            {customLinks.length === 0 && (
              <p className="text-white/20 text-sm text-center py-3">No custom links yet</p>
            )}
            <div className="space-y-3">
              {customLinks.map((link, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <input
                      value={link.label}
                      onChange={e => updateLink(i, 'label', e.target.value)}
                      placeholder="Label (e.g. My Mixtape)"
                      className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"
                    />
                    <input
                      value={link.url}
                      onChange={e => updateLink(i, 'url', e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"
                    />
                  </div>
                  <button onClick={() => removeLink(i)}
                    className="mt-1 text-white/20 hover:text-red-400 transition text-lg leading-none pt-2">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <button onClick={save} disabled={saving}
            className={`w-full py-4 rounded-2xl font-extrabold text-lg transition ${saved ? 'bg-[#4AFFD4]/20 text-[#4AFFD4] border border-[#4AFFD4]/30' : 'bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF]'} disabled:opacity-50`}>
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save profile'}
          </button>

          {/* Preview link */}
          {creator?.username && (
            <p className="text-center text-white/20 text-xs">
              Preview: <a href={`/${creator.username}`} target="_blank" className="text-white/40 hover:text-white/60 transition underline">/{creator.username}</a>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
