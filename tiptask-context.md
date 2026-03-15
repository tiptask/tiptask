# TipTask — Project Context
_Last updated: 2026-03-15 | Git tag: `redesign-v1`_

---

## Start the Project

```bash
# Terminal 1 — Next.js
cd ~/Documents/tiptask && npm run dev

# Terminal 2 — Stripe webhook listener
cd ~/Documents/tiptask && stripe listen --forward-to localhost:3002/api/webhooks/stripe
```

---

## Tech Stack
- **Frontend/Backend:** Next.js 15 (App Router)
- **Database:** Supabase (Postgres + RLS + Realtime)
- **Payments:** Stripe Connect (manual capture for requests, automatic for tips)
- **Email:** Resend (fan notifications)
- **Styling:** Tailwind v4 + Arctic dark theme
- **Font:** Plus Jakarta Sans
- **QR:** react-qr-code
- **Hosting:** Vercel (tiptask.vercel.app, tiptask.me pending DNS)
- **Repo:** github.com/tiptask/tiptask

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

## Git Tags
| Tag | Description |
|-----|-------------|
| `best-working-version` | First stable baseline |
| `profile-referral-v1` | Arctic theme + profile pages + referral system |
| `requests-fix-v1` | Requests correctly appear after payment confirmed |
| `obs-profile-v1` | OBS overlay + linktree profile + auto referral |
| `pre-redesign-v1` | Last stable before major redesign |
| `redesign-v1` | Tips/requests separated + fan system + notifications ← CURRENT |

---

## Core Concept

### Tips vs Requests — Fully Separated

**TIPS**
- Always available, no session needed
- Creator QR/link permanently active for tips
- Automatic Stripe capture
- Stored in `tips` table
- Tracked separately from requests everywhere

**REQUESTS**
- Session-based only (creator must start a session)
- Manual Stripe capture (held until creator completes)
- Stored in `task_requests` table
- Tracked separately from tips everywhere

---

## User Types

### Creator
- Account at `/auth/register`
- Profile page at `tiptask.me/[username]`
- Starts/ends "Request Sessions" (tips always work regardless)
- Paid via Stripe Connect

### Fan (registered tipper)
- Account at `/fan/register`
- Benefits: saved history, follow creators, session notifications
- Dashboard at `/fan/dashboard`

### Anonymous tipper
- No account needed
- Can tip or send requests
- No history tracking

---

## Session Logic
```
Tips: ALWAYS work, no session required
Requests: Only when creator has active session

Session tracks:
- total_tips_count, total_tips_amount
- total_requests_count, total_requests_amount
- unique_tippers_count
```

---

## Auto-Referral
Every page stores creator username in localStorage:
```js
localStorage.setItem('tiptask_ref', username)
```
Register pages read `?ref=` URL param first, fallback to localStorage.
Applied on: profile page, tip page, success page.

---

## Database Schema

### creators
```sql
id, email, username, display_name, currency,
bio, instagram, tiktok, youtube, twitch, website,
custom_links (jsonb, default '[]'),
referral_code (= username), referred_by,
stripe_account_id, stripe_onboarded,
tier (free/promoter/premium), custom_commission_rate,
avatar_url, completion_rate, total_earned, total_requests,
is_premium, premium_expires_at, created_at
```

### sessions
```sql
id, creator_id, title, is_active,
show_tasks, allow_custom_tasks, allow_free_tips,
free_tip_min_amount, use_landing_page,
total_tips_count, total_tips_amount,
total_requests_count, total_requests_amount,
unique_tippers_count,
started_at, ended_at
```

### tasks
```sql
id, creator_id, title, description,
suggested_amount, min_amount, category,
is_active, created_at
```

### task_requests (REQUESTS only — no tips here)
```sql
id, session_id, creator_id,
task_id (nullable), custom_task_text (nullable), message,
requester_name, fan_id (nullable),
amount, currency,
platform_fee, stripe_fee, total_charged,
status (draft→pending→accepted→completed/declined/refunded),
stripe_payment_intent_id, stripe_account_id,
responded_at, completed_at, expires_at,
created_at

NOTE: is_free_tip is NO LONGER USED — tips go to tips table
```

### tips (NEW — separate table)
```sql
id, creator_id,
session_id (nullable — tip works without session),
fan_id (nullable),
tipper_name, message,
amount, currency,
platform_fee, stripe_fee, total_charged,
stripe_payment_intent_id, stripe_account_id,
status (draft→completed→refunded),
created_at

REPLICA IDENTITY FULL set
```

### fans (NEW)
```sql
id, email, display_name,
stripe_customer_id,
referred_by,
created_at
```

### fan_follows (NEW)
```sql
id, fan_id, creator_id,
notify_on_session_start (boolean default true),
created_at
UNIQUE(fan_id, creator_id)
```

### referral_earnings
```sql
id, referrer_id, referred_id, task_request_id,
transaction_amount, platform_fee, referral_cut (5%),
paid_out, paid_out_at, created_at
```

---

## App Structure

```
app/
├── [username]/page.tsx             ← Linktree profile
│                                      Follow button (fans only)
│                                      "Join as fan" CTA (non-fans)
│                                      Tip CTA always visible
│                                      Auto-sets localStorage ref
├── tip/[username]/
│   ├── page.tsx                    ← TWO ZONES: Tips (always) + Requests (session only)
│   ├── checkout.tsx                ← Handles tip_id OR task_request_id
│   ├── success.tsx                 ← Post-payment + "Join as fan" CTA
│   └── history.tsx                 ← Fan history
├── fan/
│   ├── register/page.tsx           ← Fan signup, captures ref
│   ├── login/page.tsx
│   └── dashboard/page.tsx          ← Tips history, requests history, following
├── ref/[code]/page.tsx             ← Referral redirect
├── overlay/[username]/
│   ├── page.tsx                    ← OBS overlay
│   └── layout.tsx                  ← Transparent background
├── auth/
│   ├── login/page.tsx              ← Creator login
│   └── register/page.tsx           ← Creator signup, captures ref
├── dashboard/
│   ├── page.tsx                    ← Main dashboard (tips + requests stats)
│   ├── live/page.tsx               ← Start/end session + OBS instructions
│   ├── tips/page.tsx               ← Tips live feed (session/today/all)
│   ├── tasks/page.tsx              ← CRUD predefined tasks
│   ├── requests/page.tsx           ← Requests (pending/accepted/done)
│   ├── sessions/page.tsx           ← Session history + per-session stats
│   ├── payments/page.tsx           ← Stripe Connect + earnings
│   ├── profile/page.tsx            ← Edit bio, social links, custom links
│   └── referrals/page.tsx          ← Referral hub
└── api/
    ├── tips/
    │   └── create/route.ts         ← Create tip PaymentIntent → tips table
    ├── notifications/
    │   └── session-start/route.ts  ← Email fans via Resend when session starts
    └── payments/
        ├── create-intent/route.ts  ← Create request PaymentIntent
        ├── confirm/route.ts        ← Handles tip_id OR task_request_id
        ├── respond/route.ts        ← Creator accept/decline
        ├── complete/route.ts       ← Stripe capture + completed
        ├── extend/route.ts
        ├── refund/route.ts
        └── referral-hook.ts
```

---

## Payment Flows

### Tip Flow
```
POST /api/tips/create
  → Stripe PaymentIntent (automatic capture)
  → tips row: status = 'draft'
  → Stripe confirms automatically
  → POST /api/payments/confirm { tip_id }
  → tips row: status = 'completed'
  → Creator sees in /dashboard/tips instantly
```

### Request Flow
```
POST /api/payments/create-intent
  → Stripe PaymentIntent (manual capture)
  → task_requests row: status = 'draft'
  → POST /api/payments/confirm { task_request_id }
  → status: 'pending'
  → Creator accepts → 'accepted'
  → Creator completes → Stripe capture → 'completed'
```

---

## OBS Overlay
URL: `tiptask.me/overlay/[username]`
OBS: Width 600, Height 800 (portrait)
Custom CSS: `body { background-color: rgba(0,0,0,0) !important; }`
Params: `?qr=0` `?active=0` `?alerts=0` `?qrsize=220` `?label=text`

Layout:
1. Last tip / Highest tip — top, no border
2. Incoming alerts — stack, 30s tasks / 10s tips
3. Active requests list + QR — bottom

---

## Notifications (Resend)
- Triggered: when creator starts a session
- Recipients: fans following creator with notify_on_session_start = true
- API route: POST /api/notifications/session-start { creator_id, session_id }
- From: notifications@tiptask.me (needs Resend domain verification)
- Fans manage in: /fan/dashboard → Following tab

---

## Fee Structure
| Plan | Fee |
|------|-----|
| Free | 15% |
| Promoter | Custom |
| Premium | 10% to 5% |

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
NEXT_PUBLIC_APP_URL = https://tiptask.me
```

---

## Vercel / Domain
- Live: tiptask.vercel.app
- Domain: tiptask.me (Vercel nameservers set in Namecheap)
- Stripe webhook: https://tiptask.me/api/webhooks/stripe (test mode)

---

## Supabase Notes
```sql
-- Must be set for realtime to work
ALTER TABLE task_requests REPLICA IDENTITY FULL;
ALTER TABLE tips REPLICA IDENTITY FULL;
-- Auth: email confirmation OFF
-- Free plan: 4 signup emails/hour
```

---

## Pending / Next Steps
- Verify tiptask.me domain in Resend for branded emails
- Wire createReferralEarning() into complete/route.ts
- Add Stripe webhook as backup for confirm route
- Switch to Stripe live keys when ready
- Test full flow end to end on tiptask.vercel.app
