'use client'
import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutForm({ tipId, taskRequestId, onSuccess }: { tipId: string; taskRequestId: string; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setPaying(true); setError('')
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) { setError(error.message || 'Payment failed'); setPaying(false); return }
    try {
      await fetch('/api/payments/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipId ? { tip_id: tipId } : { task_request_id: taskRequestId }),
      })
    } catch (err) { console.error('Confirm error:', err) }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={!stripe || paying} className="w-full bg-[#4AFFD4] text-[#08080C] py-4 rounded-2xl font-bold text-lg hover:bg-[#6FFFDF] transition disabled:opacity-50">
        {paying ? 'Processing...' : 'Confirm Payment'}
      </button>
      <p className="text-center text-white/20 text-xs">Secured by Stripe</p>
    </form>
  )
}

export function StripeCheckout({ clientSecret, tipId, taskRequestId, onSuccess }: { clientSecret: string; tipId: string; taskRequestId: string; onSuccess: () => void }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
      <CheckoutForm tipId={tipId} taskRequestId={taskRequestId} onSuccess={onSuccess} />
    </Elements>
  )
}
