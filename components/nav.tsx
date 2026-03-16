'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const DASHBOARD_MENU = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/dashboard/tips', icon: '💸', label: 'Tips' },
  { href: '/dashboard/requests', icon: '🎯', label: 'Requests' },
  { href: '/dashboard/following', icon: '❤️', label: 'Following' },
  { href: '/dashboard/history', icon: '📜', label: 'History' },
  { href: '/dashboard/live', icon: '🔴', label: 'Session' },
  { href: '/dashboard/tasks', icon: '📋', label: 'Tasks' },
  { href: '/dashboard/payments', icon: '💳', label: 'Payments' },
  { href: '/dashboard/referrals', icon: '🔗', label: 'Referrals' },
  { href: '/dashboard/profile', icon: '⚙️', label: 'Settings' },
]

const TIER_COLORS: Record<string, string> = {
  starter: 'text-white/30', rising: 'text-blue-400', pro: 'text-purple-400',
  elite: 'text-amber-400', partner: 'text-[#4AFFD4]', promo: 'text-pink-400',
}

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
      if (session?.user) {
        supabase.from('users').select('display_name,username,tier').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setProfile(data) }).catch(() => {})
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
      if (session?.user) {
        supabase.from('users').select('display_name,username,tier').eq('id', session.user.id).single()
          .then(({ data }) => { if (data) setProfile(data) }).catch(() => {})
      } else { setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#08080C]/90 backdrop-blur-md border-b border-white/[0.05]">
      <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="font-extrabold text-base tracking-tight text-white">
          Tip<span className="text-[#4AFFD4]">Task</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/discover"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              pathname === '/discover' ? 'text-white bg-white/[0.07]' : 'text-white/40 hover:text-white/70'
            }`}>
            Discover
          </Link>
          {!authReady ? (
            <div className="w-7 h-7 rounded-full bg-white/[0.04] animate-pulse" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition ml-1 ${
                  menuOpen ? 'border-[#4AFFD4] bg-[#4AFFD4]/10 text-[#4AFFD4]'
                  : 'border-white/[0.12] bg-white/[0.05] text-white/60 hover:border-white/[0.25] hover:text-white'
                }`}>
                {profile?.display_name?.[0]?.toUpperCase() || '?'}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 w-52 bg-[#111117] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                  style={{ maxHeight: 'calc(100vh - 60px)' }}>
                  {/* User info */}
                  <div className="px-3 py-2.5 border-b border-white/[0.06] shrink-0">
                    <p className="text-white font-semibold text-xs">{profile?.display_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-white/30 text-xs">@{profile?.username}</p>
                      {profile?.tier && (
                        <span className={`text-xs font-semibold ${TIER_COLORS[profile.tier] || 'text-white/30'}`}>
                          · {profile.tier}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scrollable menu */}
                  <div className="overflow-y-auto py-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {DASHBOARD_MENU.map(item => (
                      <Link key={item.href} href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 text-xs transition ${
                          pathname === item.href
                            ? 'text-[#4AFFD4] bg-[#4AFFD4]/[0.06]'
                            : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                        }`}>
                        <span className="text-sm w-4 text-center">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-white/[0.06] mt-1 pt-1">
                      <Link href={`/${profile?.username}`}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs text-white/50 hover:text-white hover:bg-white/[0.04] transition">
                        <span className="text-sm w-4 text-center">👤</span>
                        My profile
                      </Link>
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.04] transition">
                        <span className="text-sm w-4 text-center">→</span>
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="px-2.5 py-1 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 transition">Sign in</Link>
              <Link href="/auth/register" className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF] transition">Join free</Link>
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
    <button onClick={() => href ? router.push(href) : router.back()}
      className="text-white/30 hover:text-white/60 transition text-xs flex items-center gap-1">
      {label}
    </button>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!authReady || !user) return null

  const items = [
    { href: '/', icon: '🏠', label: 'Home' },
    { href: '/discover', icon: '🔍', label: 'Discover' },
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/dashboard/profile', icon: '👤', label: 'Profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#08080C]/95 backdrop-blur-md border-t border-white/[0.05] md:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {items.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition ${
              pathname === item.href ? 'text-[#4AFFD4]' : 'text-white/30 hover:text-white/60'
            }`}>
            <span className="text-lg">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
