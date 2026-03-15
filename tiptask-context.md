# TipTask — Project Context
_Last updated: 2026-03-15 | Git tag: `pre-redesign-v1`_

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
| `obs-profile-v1` | OBS overlay + linktree profile + auto referral + tip session rename |
| `pre-redesign-v1` | Last stable before major Tips/Requests separation redesign ← CURRENT |

---

## ⚠️ MAJOR REDESIGN PLANNED — Architecture Below

---

## Core Concept After Redesign

### Tips vs Requests — Fully Separated

**TIPS**
- Always available, no session needed
- Creator QR/link is permanently active for tips
- Automatic Stripe capture
- Anonymous or fan tippers
- Tracked separately from requests everywhere

**REQUESTS**
- Session-based only (creator must start a session)
- Manual Stripe capture (held until creator completes)
- Show in creator dashboard during active session
- Tracked separately from tips everywhere

---

## User Types

### Creator
- Has a permanent profile page at `tiptask.me/[username]`
- Can start/end "Request Sessions" (tips always work regardless)
- Sees tips and requests in separate sections of dashboard
- Gets paid via Stripe Connect

### Fan (registered tipper)
- Optional account for tippers
- Benefits vs anonymous:
  - Saved payment methods
  - Follow creators
  - Push/email notifications when followed creator starts a session
  - Full history of tips and requests across sessions
  - Per-session contribution tracking

### Anonymous tipper
- No account needed
- Can tip or send requests
- No history after session ends
- No notifications

---

## Session Logic (Redesigned)

```
Creator starts Request Session
  ↓
Session has start time + end time
  ↓
Tipper visits during Session A:
  → contributions accumulate for Session A
  → if same tipper visits while Session A still active = same session, counts continue
  → if creator ends Session A and starts Session B = new session, tipper counts reset
  ↓
Tips are NEVER session-gated — always work
```

**Session stats to track:**
- Total tips received (count + amount)
- Total requests received (count + amount)
- Total earned (tips + completed requests)
- Unique tippers
- Per-tipper breakdown (for fans: named; for anonymous: by device/cookie)

---

## Auto-Referral — Every Landing Point

Every page a new user can land on must show "Join TipTask" with the creator auto-attributed as referrer:

- `tiptask.me/[username]` — profile page
- `tiptask.me/tip/[username]` — tip/request form
- `tiptask.me/tip/[username]/success` — post-payment success page

Implementation: `localStorage.setItem('tiptask_ref', username)` on every landing page.
Register page reads `?ref=` URL param first, falls back to localStorage.

---

## Database Schema (Current + Planned Changes)

### creators (existing)
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

### sessions (existing — rename to request_sessions conceptually)
```sql
id, creator_id, title, is_active,
show_tasks, allow_custom_tasks,
-- REMOVE: allow_free_tips, free_tip_min_amount (tips always on now)
use_landing_page,
started_at, ended_at
-- ADD: total_tips_count, total_tips_amount
-- ADD: total_requests_count, total_requests_amount
-- ADD: unique_tippers_count
```

### tasks (existing)
```sql
id, creator_id, title, description,
suggested_amount, min_amount, category,
is_active, created_at
```

### task_requests (existing — for REQUESTS only)
```sql
id, session_id, creator_id,
task_id (nullable), custom_task_text (nullable), message,
requester_name, fan_id (nullable, fk → fans),
amount, currency,
platform_fee, stripe_fee, total_charged,
status (draft→pending→accepted→completed/declined/refunded),
stripe_payment_intent_id, stripe_account_id,
responded_at, completed_at, expires_at,
created_at
```

### tips (NEW TABLE — separate from task_requests)
```sql
id, creator_id,
session_id (nullable — tip can exist without session),
fan_id (nullable),
tipper_name, message,
amount, currency,
platform_fee, stripe_fee, total_charged,
stripe_payment_intent_id,
status (draft→completed),
created_at
```

### fans (NEW TABLE)
```sql
id, email, display_name,
stripe_customer_id (for saved payment methods),
referred_by,
created_at
```

### fan_follows (NEW TABLE)
```sql
id, fan_id, creator_id,
notify_on_session_start (boolean),
created_at
```

### referral_earnings (existing)
```sql
id, referrer_id, referred_id, task_request_id,
transaction_amount, platform_fee, referral_cut (5% of fee),
paid_out, paid_out_at, created_at
```

---

## App Structure (After Redesign)

```
app/
├── [username]/page.tsx             ← Linktree profile, always shows tip button
│                                      Shows "Session active" badge if session running
│                                      Shows "Join as Fan" for new users
│                                      Auto-sets localStorage ref
├── tip/[username]/
│   ├── page.tsx                    ← TWO ZONES: Tips (always) + Requests (if session active)
│   ├── checkout.tsx                ← Handles both tip and request payment
│   ├── success.tsx                 ← Shows "Join TipTask as a fan" CTA
│   └── history.tsx                 ← Fan history (if logged in as fan)
├── ref/[code]/page.tsx             ← Referral redirect
├── overlay/[username]/
│   ├── page.tsx                    ← OBS overlay
│   └── layout.tsx
├── fan/
│   ├── register/page.tsx           ← Fan registration (separate from creator registration)
│   ├── login/page.tsx
│   └── dashboard/page.tsx          ← Fan: followed creators, tip history, request history
├── auth/
│   ├── login/page.tsx              ← Creator login
│   └── register/page.tsx           ← Creator registration
├── dashboard/
│   ├── page.tsx                    ← Creator dashboard
│   ├── live/page.tsx               ← Start/end request session
│   ├── tips/page.tsx               ← All tips received (lifetime)
│   ├── tasks/page.tsx              ← CRUD predefined tasks
│   ├── requests/page.tsx           ← Incoming requests (session-based)
│   ├── sessions/page.tsx           ← Session history + stats
│   ├── payments/page.tsx           ← Stripe Connect + earnings
│   ├── profile/page.tsx            ← Edit profile
│   └── referrals/page.tsx          ← Referral hub
└── api/
    ├── tips/
    │   └── create/route.ts         ← Create tip PaymentIntent
    └── payments/
        ├── create-intent/route.ts  ← Create request PaymentIntent
        ├── confirm/route.ts        ← Confirm payment, update status
        ├── respond/route.ts        ← Creator accept/decline
        ├── complete/route.ts       ← Creator marks done
        ├── extend/route.ts
        ├── refund/route.ts
        └── referral-hook.ts
```

---

## Fee Structure
| Plan | Fee |
|------|-----|
| Free | 15% |
| Promoter | Custom |
| Premium | 10% to 5% |

---

## Payment Flows

### Tip Flow
```
Tipper fills tip form (no session required)
  ↓ POST /api/tips/create → Stripe PaymentIntent (automatic capture)
  ↓ tips row inserted: status = 'draft'
  ↓ Stripe confirms payment automatically
  ↓ POST /api/payments/confirm → status: 'completed'
  ↓ Creator sees tip in dashboard immediately
```

### Request Flow
```
Tipper fills request form (session must be active)
  ↓ POST /api/payments/create-intent → Stripe PaymentIntent (manual capture)
  ↓ task_requests row inserted: status = 'draft'
  ↓ POST /api/payments/confirm → status: 'pending'
  ↓ Creator accepts → status: 'accepted'
  ↓ Creator completes → Stripe capture → status: 'completed'
```

---

## OBS Overlay
URL: `tiptask.me/overlay/[username]`

OBS Browser Source: Width 600, Height 800 (portrait)
Custom CSS: `body { background-color: rgba(0,0,0,0) !important; }`

URL params: `?qr=0` `?active=0` `?alerts=0` `?qrsize=220` `?label=text` `?colw=52vw`

Layout: Last tip + Highest tip (top) → Alerts (middle) → Active requests + QR (bottom)

---

## Supabase Notes
- REPLICA IDENTITY FULL required: `ALTER TABLE task_requests REPLICA IDENTITY FULL;`
- Also run for new tips table: `ALTER TABLE tips REPLICA IDENTITY FULL;`
- Auth: email confirmation OFF (Supabase Dashboard → Authentication → Sign In/Providers)
- Free plan: 4 signup emails/hour limit

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
```

---

## Vercel / Domain
- Live at: tiptask.vercel.app
- Domain: tiptask.me (DNS in progress — Vercel nameservers set in Namecheap)
- Stripe webhook: https://tiptask.me/api/webhooks/stripe (test mode)

---

## Pending Before Redesign Build
- [ ] Confirm tiptask.me DNS resolves correctly
- [ ] Switch to Stripe live keys when ready
- [ ] Wire createReferralEarning() into complete/route.ts

---

## Build Order for Redesign
1. SQL migrations (tips table, fans table, fan_follows table, update sessions table)
2. API routes (tips/create, update confirm route)  
3. Tip form UI (separated from requests)
4. Creator dashboard (separated tips/requests sections)
5. Fan registration + login
6. Fan dashboard (history, follows)
7. Session stats page
8. Notifications (fan → creator session start)
9. OBS overlay updates (show tips separately)
