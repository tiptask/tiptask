import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-5xl font-bold text-white mb-2">TipTask</h1>
          <p className="text-gray-400 text-lg">Your audience pays you to do things live</p>
        </div>
        
        <div className="space-y-4">
          <Link 
            href="/auth/register"
            className="block w-full bg-white text-black py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition"
          >
            Get started for free
          </Link>
          <Link 
            href="/auth/login"
            className="block w-full border border-gray-700 text-white py-4 rounded-xl font-semibold text-lg hover:border-gray-500 transition"
          >
            Sign in
          </Link>
        </div>

        <p className="text-gray-600 text-sm">
          0% commission for 6 months · Automatic refund on decline
        </p>
      </div>
    </main>
  )
}