'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function TopNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#08080C]/90 backdrop-blur-md border-b border-white/[0.05]">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-lg tracking-tight text-white">Tip<span className="text-[#4AFFD4]">Task</span></Link>
        <div className="flex items-center gap-1">
          <Link href="/discover" className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${pathname === '/discover' ? 'text-white bg-white/[0.07]' : 'text-white/40 hover:text-white/70'}`}>Discover</Link>
          {user ? (
            <Link href="/dashboard" className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${pathname?.startsWith('/dashboard') ? 'text-[#4AFFD4] bg-[#4AFFD4]/10' : 'text-white/40 hover:text-white/70'}`}>Dashboard</Link>
          ) : (
            <>
              <Link href="/auth/login" className="px-3 py-1.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 transition">Sign in</Link>
              <Link href="/auth/register" className="px-3 py-1.5 rounded-xl text-sm font-bold bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF] transition">Join free</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export function BackButton({ href, label = '← Back' }: { href?: string; label?: string }) {
  const router = useRouter()
  return (
    <button onClick={() => href ? router.push(href) : router.back()} className="text-white/30 hover:text-white/60 transition text-sm">
      {label}
    </button>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUser(user)) }, [])
  if (!user) return null
  const items = [
    { href: '/', icon: '🏠', label: 'Home' },
    { href: '/discover', icon: '🔍', label: 'Discover' },
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/dashboard/profile', icon: '👤', label: 'Profile' },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#08080C]/95 backdrop-blur-md border-t border-white/[0.05] md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map(item => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition ${pathname === item.href ? 'text-[#4AFFD4]' : 'text-white/30 hover:text-white/60'}`}>
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
