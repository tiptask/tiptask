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
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-900/40 border-2 border-green-500 flex items-center justify-center mx-auto text-2xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-gray-400">
          We sent a password reset link to <span className="text-white font-medium">{email}</span>
        </p>
        <p className="text-gray-600 text-sm">Didn't get it? Check your spam folder or try again.</p>
        <button onClick={() => setSent(false)}
          className="text-sm text-white/50 hover:text-white transition underline">
          Try a different email
        </button>
        <div>
          <Link href="/auth/login" className="text-sm text-white/50 hover:text-white transition">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold">TipTask</Link>
          <p className="text-gray-400 mt-2">Reset your password</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition"
              placeholder="you@example.com" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white text-black py-3 rounded-xl font-semibold hover:bg-gray-100 transition disabled:opacity-50">
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <p className="text-center text-gray-500 text-sm">
          <Link href="/auth/login" className="text-white hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </main>
  )
}
