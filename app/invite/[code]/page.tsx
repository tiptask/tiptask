'use client'
import React from 'react'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav } from '@/components/nav'
import Link from 'next/link'

export default function InvitePage({ params: paramsPromise }: { params: Promise<{ code: string }> }) {
  const params = React.use(paramsPromise)
  const router = useRouter()
  const [invite, setInvite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/invite/${params.code}`)
      const data = await res.json()
      if (!res.ok || !data.invite) { setInvalid(true); setLoading(false); return }
      setInvite(data.invite)
      setLoading(false)
    }
    load()
  }, [params.code])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email, password: form.password,
          username: form.username.toLowerCase(),
          display_name: form.displayName,
          promo_code: params.code,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setSubmitting(false); return }
      await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      router.push('/dashboard')
    } catch (err: any) { setError(err.message); setSubmitting(false) }
  }

  const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  if (invalid) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold mb-2">Invalid invite link</h1>
          <p className="text-white/40 text-sm mb-6">This link has already been used, revoked, or doesn't exist.</p>
          <Link href="/auth/register" className="text-[#4AFFD4] text-sm hover:text-[#6FFFDF] transition">Register without invite →</Link>
        </div>
      </main>
    </>
  )

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-20 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 px-4 py-2 rounded-full mb-4">
              <span className="text-[#4AFFD4] text-sm font-bold">🎉 You're invited!</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white">Join TipTask</h1>
            <p className="text-white/40 mt-1 text-sm">You've been given a special promo access</p>
          </div>

          <div className="bg-[#4AFFD4]/[0.06] border border-[#4AFFD4]/20 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4AFFD4]/10 flex items-center justify-center text-xl">🚀</div>
              <div>
                <p className="text-[#4AFFD4] font-bold">0% platform fee for {invite?.duration_days} days</p>
                <p className="text-white/35 text-xs mt-0.5">Keep 100% of every tip (only Stripe fees apply)</p>
              </div>
            </div>
            {invite?.note && <p className="text-white/30 text-xs mt-3 italic">"{invite.note}"</p>}
          </div>

          <div className="bg-[#111117] border border-white/[0.06] rounded-3xl p-8">
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Display name</label>
                <input value={form.displayName} onChange={e => setForm(p => ({...p, displayName: e.target.value}))} required placeholder="Your name" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-white/20 text-sm">tiptask.me/</span>
                  <input value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value.replace(/[^a-z0-9_]/g,'')}))} required placeholder="yourname" className={`${inputCls} pl-24`} />
                </div>
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required placeholder="you@example.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required minLength={8} placeholder="Min. 8 characters" className={inputCls} />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={submitting} className="w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-extrabold hover:bg-[#6FFFDF] transition disabled:opacity-50">
                {submitting ? 'Creating account...' : `Activate ${invite?.duration_days}-day promo →`}
              </button>
            </form>
          </div>
          <p className="text-center text-white/20 text-xs">Already have an account? <Link href="/auth/login" className="text-white/40 hover:text-white/60 transition">Sign in</Link></p>
        </div>
      </main>
    </>
  )
}
