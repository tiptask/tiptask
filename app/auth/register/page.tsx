'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopNav } from '@/components/nav'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [referredBy, setReferredBy] = useState<string | null>(null)
  const [referrerName, setReferrerName] = useState<string | null>(null)

  useEffect(() => {
    const ref = searchParams.get('ref') || localStorage.getItem('tiptask_ref')
    if (ref) {
      setReferredBy(ref)
      supabase.from('users').select('display_name').eq('username', ref).single()
        .then(({ data }) => { if (data) setReferrerName(data.display_name) })
    }
  }, [searchParams])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, username: form.username.toLowerCase(), display_name: form.displayName, referred_by: referredBy }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      localStorage.removeItem('tiptask_ref')
      router.push('/dashboard')
    } catch (err: any) { setError(err.message); setLoading(false) }
  }

  const f = (k: string) => ({ value: (form as any)[k], onChange: (e: any) => setForm(p => ({ ...p, [k]: e.target.value })) })
  const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"

  return (
    <main className="min-h-screen bg-[#08080C] pt-20 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white">Create your account</h1>
          <p className="text-white/40 mt-1 text-sm">Tip creators, follow, get tipped — all in one place</p>
        </div>
        {referrerName && (
          <div className="bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 rounded-2xl px-5 py-3 text-center">
            <p className="text-[#4AFFD4] text-sm font-medium">🎉 Invited by <span className="font-bold">{referrerName}</span></p>
          </div>
        )}
        <div className="bg-[#111117] rounded-3xl border border-white/[0.06] p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div><label className="block text-sm font-medium text-white/60 mb-1.5">Display name</label><input type="text" {...f('displayName')} required className={inputCls} placeholder="Your name" /></div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-white/20 text-sm">tiptask.me/</span>
                <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value.replace(/[^a-z0-9_]/g, '') }))} required className={`${inputCls} pl-24`} placeholder="yourname" />
              </div>
            </div>
            <div><label className="block text-sm font-medium text-white/60 mb-1.5">Email</label><input type="email" {...f('email')} required className={inputCls} placeholder="you@example.com" /></div>
            <div><label className="block text-sm font-medium text-white/60 mb-1.5">Password</label><input type="password" {...f('password')} required minLength={8} className={inputCls} placeholder="Min. 8 characters" /></div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">{loading ? 'Creating...' : 'Create account →'}</button>
          </form>
        </div>
        <p className="text-center text-white/30 text-sm">Already have an account? <Link href="/auth/login" className="text-[#4AFFD4] font-medium hover:text-[#6FFFDF] transition">Sign in</Link></p>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (<><TopNav /><Suspense fallback={<main className="min-h-screen bg-[#08080C]" />}><RegisterForm /></Suspense></>)
}
