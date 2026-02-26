export type Creator = {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url?: string
  stripe_account_id?: string
  stripe_onboarded: boolean
  tier: 'free' | 'promoter' | 'premium_a' | 'premium_b'
  custom_commission_rate?: number | null
  currency: string
  completion_rate?: number
  total_earned?: number
  commission_rate?: number
  is_premium?: boolean
  premium_expires_at?: string
  created_at: string
}

export type Session = {
  id: string
  creator_id: string
  qr_code?: string
  title?: string
  is_active: boolean
  allow_custom_tasks: boolean
  allow_free_tips: boolean
  free_tip_min_amount: number
  show_tasks: boolean
  min_tip_amount?: number
  max_tip_amount?: number
  currency?: string
  started_at?: string
  ended_at?: string
}

export type Task = {
  id: string
  creator_id: string
  title: string
  description?: string
  suggested_amount?: number
  min_amount?: number
  category: string
  is_active: boolean
  times_requested?: number
  created_at: string
}

export type TaskRequest = {
  id: string
  session_id: string
  creator_id: string
  task_id?: string
  custom_task_text?: string
  requester_name: string
  requester_email?: string
  amount: number
  currency: string
  platform_fee?: number
  stripe_fee?: number
  stripe_fee_buffer?: number
  total_charged?: number
  payment_method?: 'card' | 'wallet'
  status: 'pending' | 'accepted' | 'completed' | 'declined' | 'refunded'
  stripe_payment_intent_id?: string
  stripe_account_id?: string
  message?: string
  expires_at: string
  responded_at?: string
  completed_at?: string
  created_at: string
  tasks?: Task
  extensions?: { extended_at: string, new_expiry: string, fee: number }[]
}
