import Link from 'next/link'
import { TopNav } from '@/components/nav'

export default function HomePage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-[#08080C] text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#4AFFD4] opacity-[0.04] blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-lg">
          <p className="text-[#4AFFD4] text-sm font-bold uppercase tracking-widest mb-4">TipTask</p>
          <h1 className="text-5xl font-extrabold leading-tight mb-4">Tip creators.<br />Request anything.</h1>
          <p className="text-white/40 text-lg mb-10">The live monetization platform for streamers, DJs, and creators.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/auth/register" className="bg-[#4AFFD4] text-[#08080C] px-8 py-4 rounded-2xl font-extrabold text-lg hover:bg-[#6FFFDF] transition">Get started free →</Link>
            <Link href="/discover" className="bg-white/[0.07] text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-white/[0.10] transition border border-white/[0.08]">Discover creators</Link>
          </div>
        </div>
      </main>
    </>
  )
}
