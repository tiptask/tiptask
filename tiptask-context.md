# TipTask — Project Context
_Last updated: 2026-03-03 | Git tag: `requests-fix-v1`_

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
- Text muted: `white/30-60`
- Buttons: `bg-[#4AFFD4] text-[#08080C]`
- Border: `border-white/[0.06]`
- Glow: `bg-[#4AFFD4] opacity-[0.03] blur-[120px]`
- Base font size: 112.5% (set on `html` in globals.css)

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
| `profile-referral-v1` | Arctic theme + profile pages + referral system |
| `requests-fix-v1` | Requests now appear for creator after payment confirmed |

---

## Database Schema

### creators
```sql
id, email, username, display_name, currency,
bio, instagram, tiktok, youtube, twitch, website,
referral_code (= username), referred_by,
stripe_account_id, stripe_onboarded,
tier (free/promoter/premium), custom_commission_rate,
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
id, creator_id, title, description,
suggested_amount, min_amount, category,
is_active, created_at
```

### task_requests
```sql
id, session_id, creator_id,
task_id (nullable), custom_task_text (nullable), message,
requester_name, amount, currency,
platform_fee, stripe_fee, stripe_fee_buffer, total_charged,
payment_method,
status (draft → pending → accepted → completed/declined/refunded),
stripe_payment_intent_id, stripe_account_id,
responded_at, completed_at, expires_at,
extensions (array),
created_at

NOTE: is_free_tip is NOT a DB column. Determined at runtime by:
  !task_id && !custom_task_text = free tip
  task_id set                   = predefined task
  custom_task_text set          = custom request
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
| Premium | 10% to 5% |

---

## App Structure
```
app/
├── [username]/page.tsx             ← Public profile landing page
├── ref/[code]/page.tsx             ← Referral redirect to /auth/register?ref=CODE
├── tip/[username]/
│   ├── page.tsx                    ← Tip form (Stripe Elements)
│   ├── checkout.tsx                ← Stripe payment + calls /api/payments/confirm after success
│   ├── success.tsx                 ← Post-payment confirmation screen
│   └── history.tsx                 ← Viewer's request history
├── auth/
│   ├── login/page.tsx
│   └── register/page.tsx           ← Captures ?ref= param, saves referred_by
├── dashboard/
│   ├── page.tsx                    ← Main dashboard + referral teaser + quick nav
│   ├── live/page.tsx               ← Start/manage session + landing page toggle
│   ├── tasks/page.tsx              ← CRUD predefined tasks
│   ├── requests/page.tsx           ← Accept/decline/complete incoming requests
│   ├── payments/page.tsx           ← Stripe Connect onboarding + earnings
│   ├── profile/page.tsx            ← Edit display name, bio, social links
│   └── referrals/page.tsx          ← Referral hub: link, QR, earnings, payout request
└── api/
    └── payments/
        ├── create-intent/route.ts  ← Creates Stripe PaymentIntent + draft DB record
        ├── confirm/route.ts        ← draft→pending (tasks) or draft→accepted (tips)
        ├── respond/route.ts        ← Creator accept/decline pending request
        ├── complete/route.ts       ← Creator marks done, Stripe capture fires
        ├── extend/route.ts         ← Extends expiry timer by +5 min
        ├── refund/route.ts         ← Cancel PaymentIntent + refund viewer
        └── referral-hook.ts        ← createReferralEarning() utility function
```

---

## Critical Payment Flow

```
1. Viewer fills form → POST /api/payments/create-intent
   → Stripe PaymentIntent created
      - manual capture for tasks/custom requests
      - automatic capture for free tips
   → task_request inserted with status: 'draft'
   → Returns client_secret to frontend

2. Viewer confirms payment in Stripe Elements (checkout.tsx)
   → stripe.confirmPayment() succeeds
   → POST /api/payments/confirm called with task_request_id
   → DB updated: draft → pending (tasks) or draft → accepted (tips)

3. Creator sees request in /dashboard/requests via Supabase realtime
   → Accept → POST /api/payments/respond → status: accepted
   → Decline → POST /api/payments/respond → status: declined + auto refund

4. Creator completes task
   → POST /api/payments/complete → Stripe manual capture → status: completed
   → createReferralEarning() should be called here (NOT YET WIRED)
```

---

## QR / Landing Page Flow
```
QR points to tiptask.io/[username]
  ↓
[username]/page.tsx checks session.use_landing_page
  → true  = profile page shown → viewer taps "Tip me" → /tip/[username]
  → false = redirect immediately to /tip/[username]
  → no active session = offline state shown
```

---

## Referral Flow
```
Creator shares tiptask.io/ref/djsanto
  ↓
ref/[code]/page.tsx → redirects to /auth/register?ref=djsanto
  ↓
Register page saves creators.referred_by = 'djsanto'
  ↓
After payment capture → referral-hook.ts → referral_earnings row (5% of platform fee)
  ↓ (NOT YET WIRED into complete/route.ts)
Referrer sees earnings in /dashboard/referrals → manual payout request
```

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY           ← required in all API routes (admin client)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Known Working State (requests-fix-v1)
- Arctic theme across all pages, font size 112.5%
- Full payment flow working end to end
- Requests correctly appear for creator after viewer pays
- Free tips auto-accepted, task/custom requests go to pending queue
- Sessions with QR code + landing page toggle (stream-safe vs direct)
- Profile editor (bio + social links)
- Referral system: link, QR, earnings tracking, payout requests
- Dashboard: live session banner, referral teaser, quick nav

## Pending / Next Steps
- Wire createReferralEarning() into complete/route.ts
- Add Stripe webhook handler (payment_intent.succeeded) as backup confirm
- Payments page: show referral earnings summary
- Email notifications (new request received, payout processed)
- OBS overlay page (/overlay/[username])
- Analytics dashboard (earnings over time)
