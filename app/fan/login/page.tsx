'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function FanLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/fan/dashboard')
  }

  return (
    <main className="min-h-screen bg-[#08080C] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#4AFFD4] opacity-[0.04] blur-[100px] pointer-events-none" />
      <div className="max-w-md w-full space-y-6 relative z-10">
        <div className="text-center">
          <Link href="/" className="text-3xl font-extrabold tracking-tight text-white">
            Tip<span className="text-[#4AFFD4]">Task</span>
          </Link>
          <p className="text-white/40 mt-2 text-sm">Sign in to your fan account</p>
        </div>

        <div className="bg-[#111117] rounded-3xl border border-white/[0.06] p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
                placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
                placeholder="Your password" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="text-center space-y-2">
          <p className="text-white/30 text-sm">
            New here?{' '}
            <Link href="/fan/register" className="text-[#4AFFD4] font-medium hover:text-[#6FFFDF] transition">Create fan account</Link>
          </p>
          <p className="text-white/20 text-xs">
            Creator account?{' '}
            <Link href="/auth/login" className="text-white/40 hover:text-white/60 transition">Creator login →</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
