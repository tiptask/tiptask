'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { TopNav, BackButton, BottomNav } from '@/components/nav'
import QRCode from 'react-qr-code'

export default function ReferralsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [earnings, setEarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      setProfile(p)
      const { data: e } = await supabase.from('referral_earnings').select('*').eq('referrer_id', user.id).order('created_at', { ascending: false })
      setEarnings(e || [])
      setLoading(false)
    }
    load()
  }, [router])

  const referralUrl = profile ? `${origin}/${profile.username}` : ''
  const total = earnings.reduce((s, e) => s + (e.referral_cut || 0), 0)
  const unpaid = earnings.filter(e => !e.paid_out).reduce((s, e) => s + (e.referral_cut || 0), 0)

  if (loading) return (<><TopNav /><main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14"><div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" /></main></>)

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24">
        <div className="max-w-xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6"><BackButton href="/dashboard" /><h1 className="text-2xl font-bold text-white">Referrals</h1></div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5"><p className="text-white/30 text-xs mb-1">Total earned</p><p className="text-white font-bold text-2xl">{total.toFixed(2)}</p></div>
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5"><p className="text-white/30 text-xs mb-1">Unpaid</p><p className="text-[#4AFFD4] font-bold text-2xl">{unpaid.toFixed(2)}</p></div>
          </div>
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-4">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Your referral link</p>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 font-mono text-sm text-white/40 truncate">{referralUrl}</div>
              <button onClick={() => { navigator.clipboard.writeText(referralUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) }}
                className={`shrink-0 px-4 py-3 rounded-xl text-sm font-semibold transition ${copied ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.06] text-white/60 border border-white/[0.06]'}`}>
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
            <div className="flex justify-center"><div className="bg-white rounded-xl p-3"><QRCode value={referralUrl} size={120} /></div></div>
            <p className="text-white/20 text-xs text-center mt-3">Anyone who visits your profile and signs up earns you 5% of their platform fees forever</p>
          </div>
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-white/50 text-xs uppercase tracking-widest mb-4">Earnings history</p>
            {earnings.length === 0 ? <p className="text-white/20 text-sm text-center py-4">No earnings yet</p> : (
              <div className="space-y-2">
                {earnings.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div><p className="text-white text-sm">{e.referral_cut?.toFixed(2)}</p><p className="text-white/30 text-xs">{new Date(e.created_at).toLocaleDateString()}</p></div>
                    <span className={`text-xs px-2 py-1 rounded-full ${e.paid_out ? 'bg-white/[0.06] text-white/30' : 'bg-[#4AFFD4]/10 text-[#4AFFD4]'}`}>{e.paid_out ? 'Paid' : 'Pending'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  )
}
