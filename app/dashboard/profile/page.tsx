'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [creatorId, setCreatorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [form, setForm] = useState({
    display_name: '', bio: '', instagram: '', tiktok: '', youtube: '', twitch: '', website: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('creators').select('*').eq('id', user.id).single()
      if (data) {
        setCreatorId(data.id)
        setUsername(data.username)
        setForm({
          display_name: data.display_name || '',
          bio: data.bio || '',
          instagram: data.instagram || '',
          tiktok: data.tiktok || '',
          youtube: data.youtube || '',
          twitch: data.twitch || '',
          website: data.website || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function save() {
    if (!form.display_name.trim()) { setError('Display name is required'); return }
    setSaving(true); setError('')
    const { error: updateError } = await supabase.from('creators').update({
      display_name: form.display_name.trim(),
      bio: form.bio.trim() || null,
      instagram: form.instagram.trim().replace('@', '') || null,
      tiktok: form.tiktok.trim().replace('@', '') || null,
      youtube: form.youtube.trim().replace('@', '') || null,
      twitch: form.twitch.trim().replace('@', '') || null,
      website: form.website.trim() || null,
    }).eq('id', creatorId)
    if (updateError) { setError(updateError.message) }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/${username}` : ''

  return (
    <main className="min-h-screen bg-[#08080C] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Public Profile</h1>
          <a href={`/${username}`} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs text-[#4AFFD4]/60 hover:text-[#4AFFD4] transition font-mono">↗ Preview</a>
        </div>

        <div className="bg-[#4AFFD4]/[0.04] border border-[#4AFFD4]/15 rounded-2xl px-5 py-4 mb-6">
          <p className="text-[#4AFFD4]/80 text-sm font-medium mb-1">Your profile page</p>
          <p className="text-white/40 font-mono text-sm">{profileUrl}</p>
          <p className="text-white/25 text-xs mt-2">This is where your QR code points when landing page is enabled.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <label className="block text-sm font-medium text-white/60 mb-1.5">Display name *</label>
            <input type="text" value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
              placeholder="Your name or stage name" maxLength={50}
              className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition" />
          </div>

          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <label className="block text-sm font-medium text-white/60 mb-1.5">Bio <span className="text-white/20 font-normal">(optional)</span></label>
            <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value.slice(0, 200) }))}
              placeholder="Tell your audience who you are..." rows={3}
              className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition resize-none" />
            <p className="text-white/20 text-xs mt-1 text-right">{form.bio.length}/200</p>
          </div>

          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <p className="text-sm font-medium text-white/60 mb-3">Social links <span className="text-white/20 font-normal">(optional)</span></p>
            {[
              { key: 'instagram', icon: '📸', label: 'Instagram', placeholder: 'yourhandle' },
              { key: 'tiktok',    icon: '🎵', label: 'TikTok',    placeholder: 'yourhandle' },
              { key: 'youtube',   icon: '▶️', label: 'YouTube',   placeholder: 'yourchannel' },
              { key: 'twitch',    icon: '🟣', label: 'Twitch',    placeholder: 'yourchannel' },
              { key: 'website',   icon: '🌐', label: 'Website',   placeholder: 'https://yoursite.com' },
            ].map(({ key, icon, placeholder }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-lg w-7 shrink-0 text-center">{icon}</span>
                <div className="flex-1 relative">
                  {key !== 'website' && <span className="absolute left-4 top-3 text-white/20 text-sm">@</span>}
                  <input type="text" value={form[key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={`w-full bg-[#08080C] border border-white/[0.08] rounded-xl py-3 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition text-sm ${key !== 'website' ? 'pl-8' : 'pl-4'}`} />
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm px-1">{error}</p>}

          <button onClick={save} disabled={saving}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition ${saved ? 'bg-[#4AFFD4]/20 text-[#4AFFD4] border border-[#4AFFD4]/30' : 'bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF]'} disabled:opacity-50`}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save profile'}
          </button>
        </div>
      </div>
    </main>
  )
}
