'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutForm({ taskRequestId, onSuccess }: { taskRequestId: string; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    setError('')

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      setError(error.message || 'Payment failed')
      setPaying(false)
      return
    }

    // Confirm payment in DB — moves status from draft → pending (tasks) or draft → accepted (tips)
    try {
      await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_request_id: taskRequestId }),
      })
    } catch (err) {
      console.error('Confirm error:', err)
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || paying}
        className="w-full bg-white text-black py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition disabled:opacity-50"
      >
        {paying ? 'Processing...' : 'Confirm Payment'}
      </button>
      <p className="text-center text-gray-600 text-xs">Full refund if declined · Powered by Stripe</p>
    </form>
  )
}

export function StripeCheckout({ clientSecret, taskRequestId, onSuccess }: {
  clientSecret: string
  taskRequestId: string
  onSuccess: () => void
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
      <CheckoutForm taskRequestId={taskRequestId} onSuccess={onSuccess} />
    </Elements>
  )
}
