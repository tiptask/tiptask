'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { TopNav, BottomNav } from '@/components/nav'

export default function DiscoverPage() {
  const [liveNow, setLiveNow] = useState<any[]>([])
  const [topTipped, setTopTipped] = useState<any[]>([])
  const [topRequested, setTopRequested] = useState<any[]>([])
  const [topTippers, setTopTippers] = useState<any[]>([])
  const [featured, setFeatured] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [live, tipped, requested, tippers, feat] = await Promise.all([
        supabase.from('users').select('id,username,display_name,avatar_url,bio').eq('is_live', true).eq('accepts_tips', true).limit(10),
        supabase.from('weekly_top_tipped').select('*').limit(5),
        supabase.from('weekly_top_requested').select('*').limit(5),
        supabase.from('weekly_top_tippers').select('*').limit(5),
        supabase.from('users').select('id,username,display_name,avatar_url,bio,is_live').eq('is_featured', true).eq('accepts_tips', true).limit(6),
      ])
      setLiveNow(live.data || [])
      setTopTipped(tipped.data || [])
      setTopRequested(requested.data || [])
      setTopTippers(tippers.data || [])
      setFeatured(feat.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const UserCard = ({ user, rank, stat, statLabel }: { user: any, rank?: number, stat?: string, statLabel?: string }) => (
    <Link href={`/${user.username}`} className="flex items-center gap-3 bg-[#111117] border border-white/[0.06] hover:border-[#4AFFD4]/20 rounded-2xl px-4 py-3 transition group">
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 flex items-center justify-center text-sm font-bold text-[#4AFFD4]">
          {user.display_name?.[0]?.toUpperCase()}
        </div>
        {user.is_live && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#4AFFD4] rounded-full border-2 border-[#08080C]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm group-hover:text-[#4AFFD4] transition truncate">{user.display_name}</p>
        <p className="text-white/30 text-xs">@{user.username}</p>
      </div>
      {rank && <span className="text-white/20 text-sm font-bold shrink-0">#{rank}</span>}
      {stat && <div className="text-right shrink-0"><p className="text-[#4AFFD4] font-bold text-sm">{stat}</p><p className="text-white/25 text-xs">{statLabel}</p></div>}
    </Link>
  )

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-20 pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-extrabold text-white mb-1">Discover</h1>
          <p className="text-white/40 mb-8">Find creators, see who's live, explore top tippers</p>
          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></div>
          ) : (
            <>
              {liveNow.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4AFFD4] opacity-60" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4AFFD4]" /></span>
                    <h2 className="text-white font-bold">Live now</h2>
                    <span className="bg-[#4AFFD4]/10 text-[#4AFFD4] text-xs px-2 py-0.5 rounded-full font-semibold">{liveNow.length}</span>
                  </div>
                  <div className="space-y-2">{liveNow.map(u => <UserCard key={u.id} user={u} />)}</div>
                </div>
              )}
              {featured.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3"><span className="text-lg">⭐</span><h2 className="text-white font-bold">Featured</h2></div>
                  <div className="space-y-2">{featured.map(u => <UserCard key={u.id} user={u} />)}</div>
                </div>
              )}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3"><span className="text-lg">💸</span><h2 className="text-white font-bold">Top tipped this week</h2></div>
                {topTipped.length === 0 ? <p className="text-white/20 text-sm">No tips this week yet</p> :
                  <div className="space-y-2">{topTipped.map((u, i) => <UserCard key={u.id} user={u} rank={i+1} stat={`${Math.round(u.tips_amount)} ${u.currency}`} statLabel={`${u.tips_count} tips`} />)}</div>}
              </div>
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3"><span className="text-lg">🎯</span><h2 className="text-white font-bold">Top requested this week</h2></div>
                {topRequested.length === 0 ? <p className="text-white/20 text-sm">No requests this week yet</p> :
                  <div className="space-y-2">{topRequested.map((u, i) => <UserCard key={u.id} user={u} rank={i+1} stat={`${Math.round(u.requests_amount)} ${u.currency}`} statLabel={`${u.requests_count} done`} />)}</div>}
              </div>
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3"><span className="text-lg">🏆</span><h2 className="text-white font-bold">Top tippers this week</h2></div>
                {topTippers.length === 0 ? <p className="text-white/20 text-sm">No tippers this week yet</p> :
                  <div className="space-y-2">{topTippers.map((u, i) => <UserCard key={u.id} user={u} rank={i+1} stat={`${Math.round(u.tips_amount)}`} statLabel={`${u.tips_count} tips sent`} />)}</div>}
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
