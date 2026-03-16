'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [admin, setAdmin] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (pathname === '/admin/login') { setLoading(false); return }
    fetch('/api/admin/verify').then(r => r.json()).then(data => {
      if (data.error) { router.push('/admin/login'); return }
      setAdmin(data.admin)
      setLoading(false)
    })
  }, [pathname, router])

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  if (pathname === '/admin/login') return <>{children}</>
  if (loading) return <main className="min-h-screen bg-[#08080C] flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main>

  const navItems = [
    { href: '/admin', label: '📊 Dashboard', exact: true },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/invites', label: '🎟 Invites' },
    { href: '/admin/sessions', label: '🔴 Live Sessions' },
  ]

  return (
    <div className="min-h-screen bg-[#08080C] text-white flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0D0D12] border-r border-white/[0.05] flex flex-col fixed left-0 top-0 bottom-0">
        <div className="p-5 border-b border-white/[0.05]">
          <p className="font-extrabold text-white">Tip<span className="text-[#4AFFD4]">Task</span></p>
          <p className="text-white/30 text-xs mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition ${active ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] font-semibold' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-white/[0.05]">
          <p className="text-white/40 text-xs mb-1">{admin?.name}</p>
          <p className="text-white/20 text-xs mb-3">{admin?.role}</p>
          <button onClick={logout} className="w-full text-left text-white/30 hover:text-white/60 text-xs transition">Sign out →</button>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 ml-56 p-8">{children}</main>
    </div>
  )
}
