import Link from 'next/link'
import { TopNav } from '@/components/nav'
import RotatingTagline from './rotating-tagline'

export default function HomePage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white flex flex-col items-center justify-center px-6 pt-20 pb-10 text-center relative overflow-hidden">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[#4AFFD4] opacity-[0.05] blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-md w-full">
          <div className="inline-flex items-center gap-2 bg-[#4AFFD4]/10 border border-[#4AFFD4]/20 px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-[#4AFFD4] rounded-full animate-pulse" />
            <span className="text-[#4AFFD4] text-xs font-bold uppercase tracking-widest">Live now</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
            Earn more.<br />Keep more.
          </h1>

          <RotatingTagline />

          <p className="text-white/25 text-sm mb-10">
            Lowest fees online — only 15%, down to 5% on premium.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <Link href="/auth/register"
              className="w-full bg-[#4AFFD4] text-[#08080C] px-8 py-4 rounded-2xl font-extrabold text-lg hover:bg-[#6FFFDF] transition active:scale-[0.98]">
              Get started free →
            </Link>
            <Link href="/discover"
              className="w-full bg-white/[0.06] text-white/70 px-8 py-4 rounded-2xl font-bold text-base hover:bg-white/[0.09] transition border border-white/[0.08]">
              Discover creators
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[#4AFFD4] font-black text-2xl">5%</p>
              <p className="text-white/30 text-xs mt-0.5">Min platform fee</p>
            </div>
            <div>
              <p className="text-[#4AFFD4] font-black text-2xl">∞</p>
              <p className="text-white/30 text-xs mt-0.5">No payout limits</p>
            </div>
            <div>
              <p className="text-[#4AFFD4] font-black text-2xl">Live</p>
              <p className="text-white/30 text-xs mt-0.5">Real-time payments</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
