'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TopNav } from '@/components/nav'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  const inputCls = "w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-20 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center"><h1 className="text-2xl font-extrabold text-white">Welcome back</h1><p className="text-white/40 mt-1 text-sm">Sign in to your TipTask account</p></div>
          <div className="bg-[#111117] rounded-3xl border border-white/[0.06] p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div><label className="block text-sm font-medium text-white/60 mb-1.5">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls} placeholder="you@example.com" /></div>
              <div><label className="block text-sm font-medium text-white/60 mb-1.5">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={inputCls} placeholder="Your password" /></div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">{loading ? 'Signing in...' : 'Sign in →'}</button>
            </form>
          </div>
          <p className="text-center text-white/30 text-sm">No account? <Link href="/auth/register" className="text-[#4AFFD4] font-medium hover:text-[#6FFFDF] transition">Create one free</Link></p>
        </div>
      </main>
    </>
  )
}
