'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [referredBy, setReferredBy] = useState<string | null>(null)
  const [referrerName, setReferrerName] = useState<string | null>(null)

  useEffect(() => {
    const ref = searchParams.get('ref') || (typeof window !== 'undefined' ? localStorage.getItem('tiptask_ref') : null)
    if (ref) {
      setReferredBy(ref)
      supabase.from('creators').select('display_name').eq('referral_code', ref).single()
        .then(({ data }) => { if (data) setReferrerName(data.display_name) })
    }
  }, [searchParams])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Step 1: Create user via our API (bypasses Supabase email rate limits)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          username: username.toLowerCase(),
          display_name: displayName,
          referred_by: referredBy || null,
          user_type: 'creator',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      // Step 2: Sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Account created but sign in failed. Please go to login.')
        setLoading(false)
        return
      }

      if (typeof window !== 'undefined') localStorage.removeItem('tiptask_ref')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#08080C] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#4AFFD4] opacity-[0.04] blur-[100px] pointer-events-none" />
      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="text-center">
          <Link href="/" className="text-3xl font-extrabold tracking-tight text-white">
            Tip<span className="text-[#4AFFD4]">Task</span>
          </Link>
          <p className="text-white/40 mt-2">Create your creator account</p>
        </div>

        {referrerName && (
          <div className="bg-[#4AFFD4]/[0.08] border border-[#4AFFD4]/20 rounded-2xl px-5 py-3 text-center">
            <p className="text-[#4AFFD4] text-sm font-medium">
              🎉 Invited by <span className="font-bold">{referrerName}</span>
            </p>
            <p className="text-white/30 text-xs mt-0.5">You're joining through their referral link</p>
          </div>
        )}

        <div className="bg-[#111117] rounded-3xl border border-white/[0.06] p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Display name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
                placeholder="DJ Shadow" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-white/20 text-sm">tiptask.me/</span>
                <input type="text" value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/g, ''))} required
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl pl-24 pr-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
                  placeholder="djshadow" />
              </div>
              <p className="text-white/20 text-xs mt-1">Lowercase letters, numbers, underscores only</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
                placeholder="Min. 8 characters" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#4AFFD4] font-medium hover:text-[#6FFFDF] transition">Sign in</Link>
        </p>
        <p className="text-center text-white/20 text-xs">
          Want to tip creators instead?{' '}
          <Link href="/fan/register" className="text-white/40 hover:text-white/60 transition">Join as fan →</Link>
        </p>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
      </main>
    }>
      <RegisterForm />
    </Suspense>
  )
}
