'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'react-qr-code'

type ReferredCreator = { id: string; display_name: string; username: string; created_at: string; total_earned: number }

export default function ReferralsPage() {
  const router = useRouter()
  const [creator, setCreator] = useState<any>(null)
  const [referred, setReferred] = useState<ReferredCreator[]>([])
  const [earnings, setEarnings] = useState({ total_lifetime: 0, total_unpaid: 0, total_paid: 0 })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: c } = await supabase.from('creators').select('*').eq('id', user.id).single()
      if (!c) { router.push('/auth/login'); return }
      if (!c.referral_code) {
        await supabase.from('creators').update({ referral_code: c.username }).eq('id', user.id)
        c.referral_code = c.username
      }
      setCreator(c)

      const { data: refData } = await supabase
        .from('creators').select('id, display_name, username, created_at')
        .eq('referred_by', c.referral_code).order('created_at', { ascending: false })

      const withEarnings: ReferredCreator[] = []
      for (const ref of refData || []) {
        const { data: e } = await supabase.from('referral_earnings')
          .select('referral_cut').eq('referred_id', ref.id).eq('referrer_id', c.id)
        withEarnings.push({ ...ref, total_earned: (e || []).reduce((s: number, r: any) => s + (r.referral_cut || 0), 0) })
      }
      setReferred(withEarnings)

      const { data: allE } = await supabase.from('referral_earnings')
        .select('referral_cut, paid_out').eq('referrer_id', c.id)
      if (allE) {
        const unpaid = allE.filter((e: any) => !e.paid_out).reduce((s: number, e: any) => s + (e.referral_cut || 0), 0)
        const paid = allE.filter((e: any) => e.paid_out).reduce((s: number, e: any) => s + (e.referral_cut || 0), 0)
        setEarnings({ total_unpaid: Math.round(unpaid * 100) / 100, total_paid: Math.round(paid * 100) / 100, total_lifetime: Math.round((unpaid + paid) * 100) / 100 })
      }
      setLoading(false)
    }
    load()
  }, [router])

  const refUrl = typeof window !== 'undefined' && creator ? `${window.location.origin}/ref/${creator.referral_code}` : ''
  const currency = creator?.currency?.toUpperCase() ?? 'RON'

  function timeAgo(d: string) {
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'
    if (days < 30) return `${days}d ago`; return `${Math.floor(days / 30)}mo ago`
  }

  if (loading) return (
    <main className="min-h-screen bg-[#08080C] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#08080C] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm">← Back</button>
          <h1 className="text-2xl font-bold text-white">Referrals</h1>
        </div>

        <div className="bg-[#4AFFD4]/[0.04] border border-[#4AFFD4]/15 rounded-2xl px-5 py-4 mb-6">
          <p className="text-[#4AFFD4] text-sm font-semibold mb-1">Earn 5% from every creator you refer</p>
          <p className="text-white/35 text-sm">When someone joins TipTask through your link and earns money, you get 5% of the platform fee on every transaction — forever.</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: `${currency} unpaid`, value: earnings.total_unpaid.toFixed(2), accent: true },
            { label: 'Creators referred', value: referred.length, accent: false },
            { label: `${currency} lifetime`, value: earnings.total_lifetime.toFixed(2), accent: false },
          ].map(s => (
            <div key={s.label} className="bg-[#111117] border border-white/[0.06] rounded-2xl px-4 py-4 text-center">
              <p className={`text-2xl font-bold ${s.accent ? 'text-[#4AFFD4]' : 'text-white'}`}>{s.value}</p>
              <p className="text-white/30 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {earnings.total_unpaid > 0 && (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Request payout</p>
                <p className="text-white/35 text-sm mt-0.5">{earnings.total_unpaid.toFixed(2)} {currency} available</p>
              </div>
              <button onClick={() => setRequestSent(true)} disabled={requestSent}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition ${requestSent ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF]'} disabled:opacity-50`}>
                {requestSent ? '✓ Requested' : 'Request payout'}
              </button>
            </div>
            {requestSent && <p className="text-white/25 text-xs mt-3">We'll process your payout within 3–5 business days via Stripe.</p>}
          </div>
        )}

        <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 mb-4">
          <p className="text-sm font-medium text-white/60 mb-3">Your referral link</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 font-mono text-sm text-white/50 truncate">{refUrl}</div>
            <button onClick={() => { navigator.clipboard.writeText(refUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) }}
              className={`shrink-0 px-4 py-3 rounded-xl text-sm font-semibold transition ${copied ? 'bg-[#4AFFD4]/10 text-[#4AFFD4] border border-[#4AFFD4]/20' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.09] border border-white/[0.06]'}`}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={() => setShowQR(!showQR)} className="text-sm text-white/30 hover:text-white/60 transition">
            {showQR ? '↑ Hide QR code' : '↓ Show QR code'}
          </button>
          {showQR && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="bg-white rounded-2xl p-4"><QRCode value={refUrl} size={180} /></div>
              <p className="text-white/20 text-xs">Share this QR to recruit creators</p>
            </div>
          )}
        </div>

        {referred.length > 0 ? (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.04]">
              <p className="text-sm font-medium text-white/60">Referred creators</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {referred.map(ref => (
                <div key={ref.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#4AFFD4]/10 border border-[#4AFFD4]/15 flex items-center justify-center text-sm font-bold text-[#4AFFD4]">
                      {ref.display_name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{ref.display_name}</p>
                      <p className="text-white/25 text-xs">@{ref.username} · joined {timeAgo(ref.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#4AFFD4] text-sm font-semibold">+{ref.total_earned.toFixed(2)} {currency}</p>
                    <p className="text-white/20 text-xs">earned for you</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#111117] border border-white/[0.06] rounded-2xl px-5 py-10 text-center">
            <p className="text-3xl mb-3">🤝</p>
            <p className="text-white/30 text-sm">No referrals yet</p>
            <p className="text-white/15 text-xs mt-1">Share your link with other streamers and creators</p>
          </div>
        )}
      </div>
    </main>
  )
}
