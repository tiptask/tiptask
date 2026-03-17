'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TopNav, BackButton, BottomNav } from '@/components/nav'
import QRCode from 'react-qr-code'

const STYLES = [
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Clean white card',
    bg: '#ffffff',
    card: '#ffffff',
    text: '#08080C',
    sub: '#666',
    border: '1px solid #e5e7eb',
    accent: '#08080C',
    qrFg: '#08080C',
    qrBg: '#ffffff',
  },
  {
    id: 'dark',
    label: 'Dark',
    desc: 'Sleek black card',
    bg: '#08080C',
    card: '#111117',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
    accent: '#4AFFD4',
    qrFg: '#ffffff',
    qrBg: '#111117',
  },
  {
    id: 'neon',
    label: 'Neon',
    desc: 'Bold teal accent',
    bg: '#08080C',
    card: '#0a1a16',
    text: '#4AFFD4',
    sub: 'rgba(74,255,212,0.5)',
    border: '1px solid rgba(74,255,212,0.2)',
    accent: '#4AFFD4',
    qrFg: '#4AFFD4',
    qrBg: '#08080C',
  },
  {
    id: 'gold',
    label: 'Gold',
    desc: 'Premium amber style',
    bg: '#0a0800',
    card: '#1a1400',
    text: '#FBBF24',
    sub: 'rgba(251,191,36,0.5)',
    border: '1px solid rgba(251,191,36,0.2)',
    accent: '#FBBF24',
    qrFg: '#FBBF24',
    qrBg: '#0a0800',
  },
  {
    id: 'gradient',
    label: 'Gradient',
    desc: 'Purple to teal',
    bg: 'linear-gradient(135deg, #1a0533 0%, #08080C 50%, #001a14 100%)',
    card: 'transparent',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    accent: '#C084FC',
    qrFg: '#C084FC',
    qrBg: 'transparent',
  },
  {
    id: 'print',
    label: 'Print',
    desc: 'Black & white for printing',
    bg: '#ffffff',
    card: '#ffffff',
    text: '#000000',
    sub: '#555555',
    border: '2px solid #000000',
    accent: '#000000',
    qrFg: '#000000',
    qrBg: '#ffffff',
  },
]

const SIZES = [
  { id: 'small', label: 'Small', px: 120, desc: 'Business card' },
  { id: 'medium', label: 'Medium', px: 180, desc: 'A6 flyer' },
  { id: 'large', label: 'Large', px: 240, desc: 'A5 poster' },
  { id: 'xl', label: 'XL', px: 300, desc: 'A4 poster' },
]

export default function QRPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStyle, setSelectedStyle] = useState('minimal')
  const [selectedSize, setSelectedSize] = useState('medium')
  const [customLabel, setCustomLabel] = useState('Tip me live!')
  const [showUrl, setShowUrl] = useState(true)
  const [showBranding, setShowBranding] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('users').select('*').eq('id', user.id).single()
      if (!p) { router.push('/auth/login'); return }
      setProfile(p)
      setLoading(false)
    }
    load()
  }, [router])

  const style = STYLES.find(s => s.id === selectedStyle) || STYLES[0]
  const size = SIZES.find(s => s.id === selectedSize) || SIZES[1]
  const tipUrl = profile ? `tiptask.me/${profile.username}` : ''
  const fullUrl = `https://${tipUrl}`

  function handlePrint() {
    window.print()
  }

  if (loading) return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] flex items-center justify-center pt-14">
        <div className="w-5 h-5 border-2 border-white/[0.08] border-t-[#4AFFD4] rounded-full animate-spin" />
      </main>
    </>
  )

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] pt-14 pb-24 print:bg-white print:pt-0 print:pb-0">
        <style>{`
          @media print {
            nav, header, .no-print { display: none !important; }
            .print-only { display: flex !important; }
            body { background: white; }
            main { padding: 0; min-height: auto; }
          }
          .print-only { display: none; }
        `}</style>

        <div className="max-w-2xl mx-auto p-6 no-print">
          <div className="flex items-center gap-4 mb-8">
            <BackButton href="/dashboard" />
            <h1 className="text-2xl font-bold text-white">QR Code</h1>
          </div>

          <div className="space-y-5">

            {/* Preview */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-6 flex items-center justify-center min-h-[320px]">
              <div
                ref={printRef}
                style={{
                  background: style.bg,
                  border: style.border,
                  borderRadius: 16,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                  minWidth: size.px + 48,
                  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                }}
              >
                {showBranding && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: style.text }}>Tip</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: style.accent }}>Task</span>
                  </div>
                )}

                {customLabel && (
                  <p style={{ fontSize: 14, fontWeight: 700, color: style.text, textAlign: 'center', margin: 0 }}>{customLabel}</p>
                )}

                <div style={{ background: style.qrBg, borderRadius: 10, padding: 8, border: style.id === 'print' ? '1px solid #ddd' : 'none' }}>
                  <QRCode value={fullUrl} size={size.px} fgColor={style.qrFg} bgColor={style.id === 'gradient' ? '#1a0533' : style.qrBg} />
                </div>

                {showUrl && (
                  <p style={{ fontSize: 11, fontWeight: 600, color: style.sub, textAlign: 'center', margin: 0, letterSpacing: '0.02em' }}>{tipUrl}</p>
                )}
              </div>
            </div>

            {/* Style picker */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Style</p>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                    className={`rounded-xl p-3 border text-left transition ${selectedStyle === s.id ? 'border-[#4AFFD4]/40 bg-[#4AFFD4]/[0.06]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                    <div className="w-8 h-8 rounded-lg mb-2 flex items-center justify-center" style={{ background: s.bg, border: s.border }}>
                      <div style={{ width: 16, height: 16, background: s.qrFg, borderRadius: 2, opacity: 0.8 }} />
                    </div>
                    <p className="text-white text-xs font-semibold">{s.label}</p>
                    <p className="text-white/30 text-xs">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Size picker */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5">
              <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Size</p>
              <div className="grid grid-cols-4 gap-2">
                {SIZES.map(s => (
                  <button key={s.id} onClick={() => setSelectedSize(s.id)}
                    className={`rounded-xl p-3 border text-center transition ${selectedSize === s.id ? 'border-[#4AFFD4]/40 bg-[#4AFFD4]/[0.06]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                    <p className="text-white text-xs font-semibold">{s.label}</p>
                    <p className="text-white/30 text-xs">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-5 space-y-4">
              <p className="text-white/50 text-xs uppercase tracking-widest">Options</p>
              <div>
                <label className="block text-white/40 text-xs mb-1.5">Custom label</label>
                <input
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  placeholder="Tip me live!"
                  className="w-full bg-[#08080C] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4AFFD4]/40 transition"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Show URL</p>
                  <p className="text-white/30 text-xs">Display tiptask.me/{profile?.username}</p>
                </div>
                <button onClick={() => setShowUrl(v => !v)}
                  className={`w-12 h-6 rounded-full transition-colors shrink-0 ${showUrl ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${showUrl ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">Show TipTask branding</p>
                  <p className="text-white/30 text-xs">Display TipTask logo on card</p>
                </div>
                <button onClick={() => setShowBranding(v => !v)}
                  className={`w-12 h-6 rounded-full transition-colors shrink-0 ${showBranding ? 'bg-[#4AFFD4]' : 'bg-white/10'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 shadow-sm ${showBranding ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <button onClick={handlePrint}
              className="w-full py-4 rounded-2xl font-extrabold text-lg bg-[#4AFFD4] text-[#08080C] hover:bg-[#6FFFDF] transition">
              🖨️ Print / Save as PDF
            </button>

            <div className="bg-[#111117] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-white/40 text-xs mb-1">Your tip link</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-white text-sm font-mono">{tipUrl}</p>
                <button onClick={() => navigator.clipboard.writeText(fullUrl)}
                  className="text-[#4AFFD4] text-xs font-semibold hover:text-[#6FFFDF] transition shrink-0">
                  Copy link
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Print view */}
        <div className="print-only items-center justify-center w-full h-full fixed inset-0 bg-white">
          <div
            style={{
              background: style.bg,
              border: style.border,
              borderRadius: 16,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {showBranding && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: style.text }}>Tip</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: style.accent }}>Task</span>
              </div>
            )}
            {customLabel && (
              <p style={{ fontSize: 18, fontWeight: 700, color: style.text, textAlign: 'center', margin: 0 }}>{customLabel}</p>
            )}
            <div style={{ background: style.qrBg, borderRadius: 12, padding: 10 }}>
              <QRCode value={fullUrl} size={size.px} fgColor={style.qrFg} bgColor={style.qrBg} />
            </div>
            {showUrl && (
              <p style={{ fontSize: 14, fontWeight: 600, color: style.sub, textAlign: 'center', margin: 0 }}>{tipUrl}</p>
            )}
          </div>
        </div>

      </main>
      <BottomNav />
    </>
  )
}
