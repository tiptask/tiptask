import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#08080C] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#4AFFD4] opacity-[0.03] blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full text-center space-y-10 relative z-10">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-3">
            Tip<span className="text-[#4AFFD4]">Task</span>
          </h1>
          <p className="text-white/40 text-lg">Your audience pays you to do things live</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/register"
            className="block w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-bold text-lg hover:bg-[#6FFFDF] transition"
          >
            Get started for free
          </Link>
          <Link
            href="/auth/login"
            className="block w-full border border-white/10 text-white/70 py-4 rounded-2xl font-semibold text-lg hover:border-white/20 hover:text-white transition"
          >
            Sign in
          </Link>
        </div>

        <p className="text-white/20 text-sm">
          0% commission for 6 months · Automatic refund on decline
        </p>
      </div>
    </main>
  )
}
