# TipTask — Project Context
_Last updated: 2026-03-03 | Git tag: `profile-referral-v1`_

---

## What is TipTask
A live streaming monetization platform. Creators (DJs, streamers, fitness instructors) go live and their audience can send real-time tips and task requests via QR code. Payments are held by Stripe until the creator accepts/completes the request.

---

## Tech Stack
- **Frontend/Backend:** Next.js 15 (App Router)
- **Database:** Supabase (Postgres + RLS + Realtime)
- **Payments:** Stripe Connect (manual capture for tasks, automatic for tips)
- **Styling:** Tailwind v4 + Arctic dark theme
- **Font:** Plus Jakarta Sans
- **QR:** react-qr-code

---

## Arctic Theme
- Background: `#08080C`
- Cards: `#111117`
- Accent: `#4AFFD4` (cyan)
- Text primary: `white`
- Text muted: `white/30–60`
- Buttons: `bg-[#4AFFD4] text-[#08080C]`
- Border: `border-white/[0.06]`
- Glow: `bg-[#4AFFD4] opacity-[0.03] blur-[120px]`

---

## Project Location
```
~/Documents/tiptask
```

---

## Git Tags
| Tag | Description |
|-----|-------------|
| `best-working-version` | Last stable before Arctic theme |
| `profile-referral-v1` | Arctic theme + profile pages + referral system ✅ |

---

## Database Schema

### creators
```sql
id, email, username, display_name, currency,
bio, instagram, tiktok, youtube, twitch, website,
referral_code (= username), referred_by,
stripe_account_id, plan (free/promoter/premium),
created_at
```

### sessions
```sql
id, creator_id, title, is_active,
show_tasks, allow_custom_tasks, allow_free_tips,
free_tip_min_amount, use_landing_page,
started_at, ended_at
```

### tasks
```sql
id, creator_id, title, description, price, is_active, created_at
```

### task_requests
```sql
id, session_id, creator_id,
task_id (nullable), custom_task_text (nullable), message,
requester_name, amount, currency,
status (pending/accepted/completed/declined/refunded),
stripe_payment_intent_id, stripe_captured,
created_at
```

### referral_earnings
```sql
id, referrer_id, referred_id, task_request_id,
transaction_amount, platform_fee, referral_cut (5% of fee),
paid_out, paid_out_at, created_at
```

---

## Fee Structure
| Plan | Fee |
|------|-----|
| Free | 15% |
| Promoter | Custom |
| Premium | 10% → 5% |

---

## App Structure
```
app/
├── [username]/page.tsx          ← Public profile landing page
├── ref/[code]/page.tsx          ← Referral redirect → /auth/register?ref=CODE
├── tip/[username]/
│   ├── page.tsx                 ← Tip form (Stripe Elements)
│   ├── checkout.tsx             ← Payment processing
│   ├── success.tsx              ← Post-payment confirmation
│   └── history.tsx              ← Tip history
├── auth/
│   ├── login/page.tsx
│   └── register/page.tsx        ← Captures ?ref= param, saves referred_by
├── dashboard/
│   ├── page.tsx                 ← Main dashboard + referral teaser + quick nav
│   ├── live/page.tsx            ← Start/manage session + landing page toggle
│   ├── tasks/page.tsx           ← CRUD predefined tasks
│   ├── requests/page.tsx        ← Accept/decline/complete requests
│   ├── payments/page.tsx        ← Stripe Connect onboarding + earnings
│   ├── profile/page.tsx         ← Edit bio + social links
│   └── referrals/page.tsx       ← Referral hub: link, QR, earnings, payout request
└── api/
    ├── payments/
    │   ├── create-intent/route.ts
    │   ├── capture/route.ts      ← Call createReferralEarning() here after capture
    │   ├── refund/route.ts
    │   └── referral-hook.ts      ← createReferralEarning() utility
    └── webhooks/stripe/route.ts
```

---

## Key Flows

### QR → Tip flow
```
QR points to tiptask.io/[username]
  ↓
[username]/page.tsx checks session.use_landing_page
  → true  = show profile page → viewer taps "Tip me" → /tip/[username]
  → false = redirect immediately to /tip/[username]
  → no session = show offline state
```

### Referral flow
```
Creator shares tiptask.io/ref/djsanto
  ↓
ref/[code]/page.tsx → redirect to /auth/register?ref=djsanto
  ↓
Register page captures ref param → creators.referred_by = 'djsanto'
  ↓
Every payment capture → referral-hook.ts → referral_earnings row (5% of platform fee)
  ↓
Referrer sees earnings in /dashboard/referrals → requests manual payout
```

### Payment capture (task request)
```
Viewer submits request → Stripe PaymentIntent created (manual capture)
Creator accepts → PaymentIntent captured → createReferralEarning() called
Creator declines → PaymentIntent cancelled → automatic refund
```

---

## Referral Hook — Integration Point
In `app/api/payments/capture/route.ts`, after successful Stripe capture:
```ts
import { createReferralEarning } from '../referral-hook'

await createReferralEarning({
  creatorId: creator.id,
  taskRequestId: request.id,
  transactionAmount: amount,
  platformFee: fee,
})
```

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        ← needed for referral-hook.ts (admin client)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Known Working State
- Arctic theme fully deployed across all pages
- Stripe payment flow working (tip form, checkout, success)
- Sessions with QR code generation
- Landing page toggle in live session config
- Profile editor (bio + socials)
- Referral system: tracking, earnings, payout requests
- Dashboard shows referral teaser + quick copy link

## Pending / Next Steps
- Wire `createReferralEarning()` into the actual capture API route
- Payments page: show referral earnings summary alongside main earnings
- Email notifications (new request, payout processed)
- OBS overlay page (`/overlay/[username]`)
- Analytics dashboard (earnings over time chart)
