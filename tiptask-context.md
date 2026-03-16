# TipTask Context — polish-v1
**Date:** 2026-03-16
**Tag:** polish-v1
**Live:** https://tiptask.me
**Repo:** github.com/tiptask/tiptask
**Local:** ~/Documents/tiptask

## Start Commands
```bash
# Terminal 1
cd ~/Documents/tiptask && npm run dev

# Terminal 2 (webhooks)
cd ~/Documents/tiptask && stripe listen --forward-to localhost:3002/api/webhooks/stripe
```

## Stack
- Next.js 15, Supabase, Stripe Connect, Tailwind v4, Resend
- bcryptjs + jose (admin JWT auth)
- react-qr-code

## Git Tags
| Tag | Description |
|-----|-------------|
| best-working-version | First stable baseline |
| obs-profile-v1 | OBS overlay + linktree profile |
| pre-redesign-v1 | Last stable before major redesign |
| redesign-v1 | Tips/requests separated + fan system |
| polish-v1 | Full platform — tiers, admin, promo invites ← CURRENT |

## Database Tables
- users (unified creators + fans)
- sessions
- tasks
- task_requests
- tips
- follows
- referral_earnings
- promo_invites
- admins

## Tier System (Option D)
| Tier | Rate | How |
|------|------|-----|
| starter | 15% | Default |
| rising | 12% | $1k lifetime OR $9/mo |
| pro | 10% | $5k lifetime OR $19/mo |
| elite | 8% | $20k lifetime OR $39/mo |
| partner | 5% | $100k lifetime + approval |
| promo | 0% | Invite only, X days |

## Stripe Price IDs (TEST MODE)
- Rising $9/mo: price_1TBPU9RP9yV1IeibNm3hz0pX
- Pro $19/mo: price_1TBPUARP9yV1Ieibm8uNg2AD
- Elite $39/mo: price_1TBPUBRP9yV1IeibhSEQmC9z

## Fee Logic (Option D)
- Below $5 / 25 RON: Stripe fee FORCED on payer
- Above $5 / 25 RON: fee toggle OFF by default, payer can choose
- Creator always receives: amount - platform_fee
- Platform absorbs Stripe fee from its cut when viewer doesn't cover

## App Structure
```
app/
├── page.tsx                    ← Home with rotating taglines
├── discover/page.tsx           ← Live, featured, top tipped/requested/tippers
├── [username]/page.tsx         ← Public profile + follow + tip CTA
├── tip/[username]/page.tsx     ← Tip + request form with fee toggle
├── auth/login, register/       ← Unified auth (one page for all)
├── invite/[code]/page.tsx      ← Promo invite registration
├── ref/[code]/page.tsx         ← Referral redirect
├── overlay/[username]/         ← OBS overlay (transparent bg)
├── dashboard/
│   ├── page.tsx                ← Main dashboard
│   ├── live/page.tsx           ← Start/end session + QR + OBS
│   ├── tips/page.tsx           ← Tips feed (session/today/all)
│   ├── requests/page.tsx       ← Requests (pending/accepted/done) + extend
│   ├── tasks/page.tsx          ← Manage task list
│   ├── following/page.tsx      ← Followed creators + notify toggle
│   ├── history/page.tsx        ← Tips sent + requests sent
│   ├── payments/page.tsx       ← Stripe connect + tier upgrade
│   ├── referrals/page.tsx      ← Referral link + earnings
│   └── profile/page.tsx        ← Settings: bio, social, currency, accepts_tips
├── admin/
│   ├── login/page.tsx          ← Admin JWT login (separate from Supabase)
│   ├── layout.tsx              ← Sidebar nav + auth check
│   ├── page.tsx                ← Stats dashboard + charts
│   ├── users/page.tsx          ← User management + edit modal
│   ├── invites/page.tsx        ← Create/manage promo invite links
│   └── sessions/page.tsx       ← Live sessions monitor
└── api/
    ├── auth/register/          ← Bypasses Supabase email via admin API
    ├── admin/login,logout,verify,stats,users,invites,sessions/
    ├── invite/[code]/          ← Validate promo invite
    ├── tips/create/            ← Create tip PaymentIntent
    ├── payments/
    │   ├── create-intent/      ← Create request PaymentIntent (manual capture)
    │   ├── confirm/            ← Confirm tip or request payment
    │   ├── respond/            ← Accept/decline request
    │   ├── complete/           ← Mark done + capture payment
    │   ├── extend/             ← Extend request timer +5min
    │   └── refund/             ← Cancel + refund
    ├── stripe/
    │   ├── connect/            ← Stripe Connect onboarding
    │   ├── subscribe/          ← Stripe Checkout for subscriptions
    │   └── cancel/             ← Cancel subscription (keeps until period end)
    ├── webhooks/stripe/        ← Handles checkout.session.completed, subscription events
    └── notifications/session-start/  ← Email followers via Resend

## Key Env Vars
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_RISING_PRICE_ID
STRIPE_PRO_PRICE_ID
STRIPE_ELITE_PRICE_ID
NEXT_PUBLIC_STRIPE_RISING_PRICE_ID
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID
RESEND_API_KEY
NEXT_PUBLIC_APP_URL=https://tiptask.me
ADMIN_JWT_SECRET
```

## Admin Panel
- URL: tiptask.me/admin
- Auth: separate JWT, stored in admins table (bcrypt passwords)
- Admin account: marius.holeiciuc@gmail.com, role: super

## Users
| Username | Email | Tier | Notes |
|----------|-------|------|-------|
| marius | marius@bitson.ro | promoter | is_admin=true |
| mh_disco | marius.holeiciuc@gmail.com | free | main creator test account |
| anamaria | office@bitson.ro | free | test account |

## OBS Overlay
- URL: tiptask.me/overlay/[username]
- OBS: Width 600, Height 800
- Custom CSS: body { background-color: rgba(0,0,0,0) !important; }
- Params: ?qr=0 ?active=0 ?alerts=0 ?qrsize=220

## Known Issues / Pending for Next Session
- [ ] Test admin panel fully (stats, user edit, invite creation)
- [ ] Test promo invite flow end-to-end
- [ ] Test tier upgrade via Stripe (Rising/Pro/Elite)
- [ ] Test fee toggle on tip page (forced below 25 RON, optional above)
- [ ] Test OBS overlay realtime updates
- [ ] Verify webhook handles all subscription events correctly
- [ ] Sessions history page (/dashboard/sessions) needs rebuild
- [ ] Webhook: update to handle new tier names (rising/pro/elite vs promoter/premium)
- [ ] Stripe webhook: map new price IDs to correct tiers
- [ ] Test referral earnings flow
- [ ] Test follow + session start notification email
- [ ] Fix: tiptask.me domain redirect (should connect to Production not www redirect)

## Supabase Notes
- REPLICA IDENTITY FULL on: tips, task_requests, sessions, follows
- Email confirmation: OFF
- Auth trigger removed: on_auth_user_created_wallet (was causing 500 errors)
- Auto tier recalculation trigger on tips + task_requests completion

## Payment Flow
**Tip:** POST /api/tips/create → PaymentIntent (auto capture) → confirm → completed
**Request:** POST /api/payments/create-intent → PaymentIntent (manual capture) → pending → accept → complete → capture

## Component: nav.tsx
- TopNav: shows account dropdown when logged in (all dashboard links + tier + logout)
- authReady state prevents flash of logged-out state
- BottomNav: mobile only, shows when logged in
- BackButton: uses router.back() or href
