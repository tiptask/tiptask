# TipTask — Project Context
**Last updated:** March 17, 2026  
**Stable tag:** `polish-v2`  
**Live URL:** https://tiptask.me  
**Repo:** https://github.com/tiptask/tiptask  
**Local path:** `~/Documents/tiptask`

---

## Stack
- **Frontend:** Next.js 15 (App Router), Tailwind v4
- **Backend:** Supabase (Postgres + Realtime), Next.js API routes
- **Payments:** Stripe Connect (manual capture for tasks, auto-capture for tips)
- **Email:** Resend (domain tiptask.me pending verification)
- **Auth:** bcryptjs + jose (JWT), Supabase Auth
- **Deployment:** Vercel (auto-deploy from main branch)

---

## Primary Markets
Western Europe, USA, UK, Asia Pacific

---

## Architecture

### Users Table (unified)
Single `users` table for all user types. Key fields:
- `tier` — starter | rising | pro | elite | partner | promo
- `custom_commission_rate` — current fee rate (0.15 default)
- `lifetime_earned` — total earnings for automatic tier upgrades
- `stripe_account_id` — Connect account for receiving payments
- `stripe_customer_id` — customer ID for subscriptions
- `stripe_subscription_id` — active subscription ID
- `sub_expires_at` — subscription period end
- `accepts_tips` — creator toggle
- `currency` — creator's display currency
- `custom_links` — JSONB [{label, url}] for profile page
- `referred_by` — referral tracking

### Fee Tiers
| Tier | Fee | How to unlock |
|------|-----|---------------|
| Starter | 15% | Default |
| Rising | 12% | $1,000 lifetime OR $9/mo sub |
| Pro | 10% | $5,000 lifetime OR $19/mo sub |
| Elite | 8% | $20,000 lifetime OR $39/mo sub |
| Partner | 5% | $100,000 lifetime + manual approval |
| Promo | 0% | Invite-only, time-limited |

### Stripe Price IDs (test mode)
- Rising: `price_1TBPU9RP9yV1IeibNm3hz0pX`
- Pro: `price_1TBPUARP9yV1Ieibm8uNg2AD`
- Elite: `price_1TBPUBRP9yV1IeibhSEQmC9z`

### Subscription Flow
1. User clicks Subscribe → `/api/stripe/subscribe` POST → creates Checkout session
2. Stripe redirects back to `/dashboard/payments?subscription=success&session_id=cs_...`
3. Page calls `/api/stripe/subscribe?session_id=cs_...` GET → retrieves session → saves `stripe_subscription_id`, `tier`, `custom_commission_rate`, `sub_expires_at` to DB
4. Cancel: `/api/stripe/cancel` POST → sets `cancel_at_period_end: true` on Stripe
5. Webhook `customer.subscription.deleted` → downgrades tier to earned tier based on `lifetime_earned`

### Webhook Events (at /api/stripe/webhook)
- `payment_intent.amount_capturable_updated` → draft → pending
- `payment_intent.succeeded` → completed
- `payment_intent.payment_failed` → declined
- `payment_intent.canceled` → declined
- `charge.refunded` → refunded
- `charge.dispute.created` → refunded
- `checkout.session.completed` → NOT used (handled via redirect GET instead)
- `invoice.payment_succeeded` → renew sub tier
- `customer.subscription.deleted` → downgrade to earned tier

### Task Request Flow
1. Viewer sends request → PI created with manual capture → status: `draft`
2. Webhook `amount_capturable_updated` → status: `pending`
3. Creator accepts → status: `accepted`
4. Creator marks done → PI captured → status: `completed`
5. Auto-decline: expired pending requests auto-declined via `/api/payments/auto-decline`

---

## Key Pages

### Creator Dashboard (`/dashboard`)
- Session banner (active/inactive)
- Pending requests alert
- Tips received + Requests cards with net earnings + tier/upgrade line
- Tips sent card
- Nav grid with all tools including QR code

### Live Session (`/dashboard/requests`)
- Two-column layout (desktop): requests left, tips sidebar right
- Mobile: tabbed (Requests / Tips)
- Active requests: pending (accept/decline) + accepted (mark done / extend)
- Done/expired: compact single-line rows, latest first
- Realtime + 4s polling

### OBS Overlay (`/overlay/[username]`)
- Transparent background, bypasses root layout
- Single bottom-left column: alerts → last/highest tip → tasks → QR
- QR default size: 280px (override with `?qrsize=N`)
- Tasks: pending (amber) + accepted (teal), oldest first
- Data fetched via `/api/overlay/data?username=X` (service role, bypasses RLS)
- Realtime + 5s polling fallback
- URL: `tiptask.me/overlay/USERNAME`

### Payments (`/dashboard/payments`)
- Stripe Connect setup
- Tier status + progress bar
- All plans with subscribe/cancel buttons
- Fee explanation per current tier
- Cancel: sets `cancel_at_period_end`, shows expiry date

### QR Code (`/dashboard/qr`)
- 6 styles: Minimal, Dark, Neon, Gold, Gradient, Print
- 4 sizes: Small (120px) → XL (300px)
- Custom label, toggle URL + branding
- Print/PDF via browser print dialog

### Profile (`/[username]`)
- Linktree-style public profile
- Social links as full-width cards
- Custom links (JSONB)
- Referral: visiting profile stores username in `localStorage('tiptask_ref')`

### Settings (`/dashboard/profile`)
- Currency change → converts all existing tips + task_requests via `frankfurter.app` API
- Custom links editor
- Social links

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/payments/create-intent` | POST | Create Stripe PI for tip/task |
| `/api/payments/respond` | POST | Accept/decline task request |
| `/api/payments/complete` | POST | Mark task done, capture PI |
| `/api/payments/extend` | POST | Extend task timer +5min |
| `/api/payments/auto-decline` | POST | Auto-decline expired pending |
| `/api/payments/refund` | POST | Refund completed task |
| `/api/stripe/connect` | POST | Stripe Connect onboarding |
| `/api/stripe/subscribe` | POST/GET | Create subscription / activate on redirect |
| `/api/stripe/cancel` | POST | Cancel subscription |
| `/api/stripe/webhook` | POST | Stripe webhook handler |
| `/api/overlay/data` | GET | Public overlay data (bypasses RLS) |
| `/api/currency/convert` | POST | Convert amounts on currency change |
| `/api/auth/register` | POST | User registration |
| `/api/admin/*` | POST/GET | Admin panel routes |

---

## Admin Panel (`/admin`)
- JWT auth, admin account: marius.holeiciuc@gmail.com
- User management, sessions, stats, invite codes
- Promo tier assignment

---

## Referral System
- Visiting `tiptask.me/[username]` stores username in `localStorage('tiptask_ref')`
- Register page reads `?ref=` param or localStorage fallback
- Shows "Invited by [name]" on register
- Saves `referred_by` on account creation
- Referral earnings flow: TODO

---

## OBS Overlay Setup (for creators)
1. Add Browser Source in OBS
2. URL: `https://tiptask.me/overlay/USERNAME`
3. Width: 600, Height: 800
4. Custom CSS: empty
5. Check "Shutdown source when not visible"

---

## Known Issues / Pending
- **Sessions history page** — missing, needs to be built
- **Dashboard/sessions page** — missing
- **Referral earnings flow** — not implemented
- **Stripe live keys** — pending when ready to go live
- **Resend domain** — tiptask.me email domain pending verification
- **Stripe Connect test accounts** — need full onboarding to avoid "capabilities" error on tip page
- **Mobile polish** — ongoing

---

## Environment Variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_RISING_PRICE_ID=price_1TBPU9RP9yV1IeibNm3hz0pX
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1TBPUARP9yV1Ieibm8uNg2AD
NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID=price_1TBPUBRP9yV1IeibhSEQmC9z
RESEND_API_KEY=
ADMIN_SECRET=
```

---

## Git Commands
```bash
# Deploy
cd ~/Documents/tiptask && git add -A && git commit -m "message" && git push

# Tag stable version
git tag -f polish-v2 && git push origin polish-v2 --force

# Rollback to stable
git checkout polish-v2
```
