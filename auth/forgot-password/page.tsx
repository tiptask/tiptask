'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  if (sent) return (
    <main className="min-h-screen bg-[#08080C] flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#4AFFD4]/10 border-2 border-[#4AFFD4]/40 flex items-center justify-center mx-auto text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-white">Check your email</h1>
        <p className="text-white/40">
          We sent a reset link to <span className="text-white font-medium">{email}</span>
        </p>
        <p className="text-white/20 text-sm">Didn't get it? Check your spam folder or try again.</p>
        <button onClick={() => setSent(false)}
          className="text-sm text-white/30 hover:text-white/60 transition underline">
          Try a different email
        </button>
        <div>
          <Link href="/auth/login" className="text-sm text-white/30 hover:text-white/60 transition">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-extrabold tracking-tight">
            Tip<span className="text-[#4AFFD4]">Task</span>
          </Link>
          <p className="text-white/40 mt-2">Reset your password</p>
        </div>

        <div className="bg-[#111117] rounded-3xl border border-white/[0.06] p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/50 transition"
                placeholder="you@example.com" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-[#4AFFD4] text-[#08080C] py-3 rounded-xl font-bold hover:bg-[#6FFFDF] transition disabled:opacity-50">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-sm">
          <Link href="/auth/login" className="text-[#4AFFD4] font-medium hover:text-[#6FFFDF] transition">← Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}
