export type CreatorTier = 'free' | 'promoter' | 'premium_a' | 'premium_b'

export type FeeBreakdown = {
  taskAmount: number      // what creator set
  platformFee: number     // platform's cut
  platformFeeRate: number // e.g. 0.15
  estimatedStripeFee: number  // 2.9% + $0.30
  stripeFeeBuffer: number     // extra $0.50 buffer
  totalAuthorized: number     // what we hold on card
  totalCharged: number        // what viewer actually pays (captured at done)
  creatorReceives: number     // after platform fee
  paymentMethod: 'card' | 'wallet'
}

const STRIPE_FEE_RATE = 0.029
const STRIPE_FEE_FIXED = 0.30
const STRIPE_FEE_BUFFER = 0.50
export const MIN_PAYMENT_AMOUNT = 1.00 // Minimum $1 USD equivalent

export function getPlatformFeeRate(
  tier: CreatorTier,
  customRate?: number | null
): number {
  switch (tier) {
    case 'promoter':
      return customRate != null ? customRate / 100 : 0.15
    case 'free':
      return 0.15
    case 'premium_a':
      return 0.10
    case 'premium_b':
      return 0.05
    default:
      return 0.15
  }
}

export function calculateFees(
  taskAmount: number,
  tier: CreatorTier,
  paymentMethod: 'card' | 'wallet',
  customRate?: number | null
): FeeBreakdown {
  const platformFeeRate = getPlatformFeeRate(tier, customRate)
  const platformFee = Math.round(taskAmount * platformFeeRate * 100) / 100
  const creatorReceives = Math.round((taskAmount - platformFee) * 100) / 100

  if (paymentMethod === 'wallet') {
    // Stripe fee already paid at top-up, viewer just pays task amount
    return {
      taskAmount,
      platformFee,
      platformFeeRate,
      estimatedStripeFee: 0,
      stripeFeeBuffer: 0,
      totalAuthorized: taskAmount,
      totalCharged: taskAmount,
      creatorReceives,
      paymentMethod: 'wallet',
    }
  }

  // Card payment — viewer pays Stripe fee on top
  const estimatedStripeFee = Math.round((taskAmount * STRIPE_FEE_RATE + STRIPE_FEE_FIXED) * 100) / 100
  const totalCharged = Math.round((taskAmount + estimatedStripeFee) * 100) / 100
  const totalAuthorized = Math.round((totalCharged + STRIPE_FEE_BUFFER) * 100) / 100

  return {
    taskAmount,
    platformFee,
    platformFeeRate,
    estimatedStripeFee,
    stripeFeeBuffer: STRIPE_FEE_BUFFER,
    totalAuthorized,
    totalCharged,
    creatorReceives,
    paymentMethod: 'card',
  }
}

// Format for display
export function formatFeeBreakdown(fees: FeeBreakdown, currency = 'USD'): {
  label: string
  value: string
  highlight?: boolean
}[] {
  const fmt = (n: number) => `${currency === 'USD' ? '$' : ''}${n.toFixed(2)}`

  const lines = [
    { label: 'Task amount', value: fmt(fees.taskAmount) },
  ]

  if (fees.paymentMethod === 'card') {
    lines.push({ label: 'Processing fee (est.)', value: fmt(fees.estimatedStripeFee) })
    lines.push({
      label: 'Total charged to card',
      value: fmt(fees.totalCharged),
      highlight: true,
    })
    lines.push({
      label: 'Authorization hold',
      value: fmt(fees.totalAuthorized),
    })
  } else {
    lines.push({ label: 'Paid from wallet', value: fmt(fees.taskAmount), highlight: true })
    lines.push({ label: 'Processing fee', value: 'None (prepaid)' })
  }

  return lines
}

// How much to top up wallet (minimum $5)
export function calculateWalletTopup(amount: number): {
  topupAmount: number
  stripeFee: number
  totalCharged: number
  walletCredit: number
} {
  const topupAmount = Math.max(amount, 5)
  const stripeFee = Math.round((topupAmount * STRIPE_FEE_RATE + STRIPE_FEE_FIXED) * 100) / 100
  const totalCharged = Math.round((topupAmount + stripeFee) * 100) / 100

  return {
    topupAmount,
    stripeFee,
    totalCharged,
    walletCredit: topupAmount, // wallet gets credited the top-up amount, not including stripe fee
  }
}
