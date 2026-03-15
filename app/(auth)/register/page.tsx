'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: existing } = await supabase
      .from('creators')
      .select('username')
      .eq('username', username.toLowerCase())
      .single()

    if (existing) {
      setError('Username already taken. Please choose another.')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError || !data.user) {
      setError(signUpError?.message || 'Something went wrong')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('creators').insert({
      id: data.user.id,
      email,
      username: username.toLowerCase(),
      display_name: displayName,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold">TipTask</Link>
          <p className="text-gray-400 mt-2">Create your creator account</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Display name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition"
              placeholder="DJ Shadow" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-500">tiptask.me/</span>
              <input type="text" value={username} onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/g, ''))} required
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-24 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition"
                placeholder="djshadow" />
            </div>
            <p className="text-gray-600 text-xs mt-1">Lowercase letters, numbers, underscores only</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition"
              placeholder="Min. 8 characters" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-white text-black py-3 rounded-xl font-semibold hover:bg-gray-100 transition disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-gray-500 text-sm">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-white hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
