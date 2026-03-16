# TipTask Context — v2 (post-polish session)
**Date:** 2026-03-16
**Live:** https://tiptask.me
**Repo:** github.com/tiptask/tiptask
**Local:** ~/Documents/tiptask

## Start Commands
```bash
cd ~/Documents/tiptask && npm run dev
# Terminal 2:
stripe listen --forward-to localhost:3002/api/webhooks/stripe
```

## Stack
Next.js 15, Supabase, Stripe Connect, Tailwind v4, Resend, bcryptjs, jose, react-qr-code

## Git Tags
| Tag | Description |
|-----|-------------|
| polish-v1 | Full platform baseline |
| (current) | Realtime, two-col session, auto-decline, tier system |

## Tier System
| Tier | Rate | How |
|------|------|-----|
| starter | 15% | Default |
| rising | 12% | $1k lifetime OR $9/mo (price_1TBPU9RP9yV1IeibNm3hz0pX) |
| pro | 10% | $5k lifetime OR $19/mo (price_1TBPUARP9yV1Ieibm8uNg2AD) |
| elite | 8% | $20k lifetime OR $39/mo (price_1TBPUBRP9yV1IeibhSEQmC9z) |
| partner | 5% | $100k lifetime + manual approval |
| promo | 0% | Invite-only, X days, via /invite/[code] |

## Fee Logic (Option D)
- Below $5 / 25 RON: Stripe fee FORCED on payer
- Above: toggle OFF by default, payer can choose
- Creator always receives: amount - platform_fee
- Auto-decline: expired pending requests auto-cancelled + Stripe refund

## DB Tables
users, sessions, tasks, task_requests, tips, follows,
referral_earnings, promo_invites, admins

## Key DB Notes
- REPLICA IDENTITY FULL: tips, task_requests, sessions, follows
- Trigger: recalculate_user_tier() on tip/request completion
- Trigger: sync_user_live_status() on session start/end
- users_tier_check: starter/rising/pro/elite/partner/promo/free/promoter/premium
- Auto-decline: /api/payments/auto-decline (POST) - called on page load + every 4s poll

## App Pages
```
/ — Home (rotating taglines, fee stats)
/discover — Live now, featured, top tipped/requested/tippers
/[username] — Profile (realtime session badge, follow, tip CTA)
/tip/[username] — Tip + request form (fee toggle, self-tip blocked, realtime status)
/invite/[code] — Promo invite registration (0% tier, auto accepts_tips=true)
/auth/login, /auth/register — Unified auth
/dashboard — Main (realtime stats, pending alert)
/dashboard/live — Start/end session + QR + OBS
/dashboard/requests — TWO COLUMN: requests (70%, soonest expiry first) + tips feed (30%), mobile tabs
/dashboard/tips — Tips feed with session/today/all + net earnings breakdown (week/month/total)
/dashboard/tasks — Manage task list
/dashboard/following — Followed creators + notify toggle
/dashboard/history — Tips sent + requests sent
/dashboard/payments — Tier system, Stripe connect, subscription upgrade
/dashboard/referrals — Referral link + earnings
/dashboard/profile — Settings (bio, social, currency, accepts_tips toggle)
/dashboard/sessions — MISSING - needs rebuild
/overlay/[username] — OBS overlay (transparent bg, 600x800)
/admin/login — JWT admin login
/admin — Stats dashboard (charts, top creators, recent transactions)
/admin/users — User management + edit modal (tier, featured, notes)
/admin/invites — Create/manage promo invite links
/admin/sessions — Live sessions monitor
```

## Key API Routes
```
/api/auth/register — Bypasses Supabase email via admin API, handles promo_code
/api/admin/login,logout,verify,stats,users,invites,sessions
/api/invite/[code] — Validate promo invite
/api/tips/create — Tip PaymentIntent (auto capture), cover_fee logic
/api/payments/create-intent — Request PaymentIntent (manual capture)
/api/payments/confirm — Confirm tip or request
/api/payments/respond — Accept/decline request
/api/payments/complete — Mark done + capture (handles already-captured gracefully)
/api/payments/extend — +5 min timer
/api/payments/auto-decline — Auto-decline expired pending requests + Stripe cancel
/api/payments/refund — Cancel + refund
/api/stripe/connect — Stripe Connect onboarding
/api/stripe/subscribe — Stripe Checkout for subscriptions
/api/stripe/cancel — Cancel subscription (keeps until period end)
/api/webhooks/stripe — checkout.session.completed, subscription events
/api/notifications/session-start — Email followers via Resend
```

## Realtime Strategy
All key pages use: Supabase channel subscription + setInterval polling (3-5s fallback)
- Uses useRef for sessionId/userId to avoid stale closure in intervals
- Tip page: polls request status by ID every 3s after payment
- Requests page: polls every 4s, auto-decline on each poll
- Dashboard: polls every 5s for stats refresh

## Users
| Username | Email | Tier | Notes |
|----------|-------|------|-------|
| marius | marius@bitson.ro | promoter | is_admin=true |
| mh_disco | marius.holeiciuc@gmail.com | free | creator test account |
| anamaria | office@bitson.ro | free | test account |

## Admin
- URL: tiptask.me/admin/login
- Email: marius.holeiciuc@gmail.com, role: super
- JWT stored in cookie, 24h expiry

## Env Vars Needed
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (legacy key from Supabase)
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_RISING_PRICE_ID + NEXT_PUBLIC_ version
STRIPE_PRO_PRICE_ID + NEXT_PUBLIC_ version
STRIPE_ELITE_PRICE_ID + NEXT_PUBLIC_ version
RESEND_API_KEY
NEXT_PUBLIC_APP_URL=https://tiptask.me
ADMIN_JWT_SECRET
```

## OBS Overlay
- URL: tiptask.me/overlay/[username]
- Width: 600, Height: 800
- Custom CSS: body { background-color: rgba(0,0,0,0) !important; }
- Has own layout.tsx bypassing root layout

## Pending Next Session
- [ ] Sessions history page (/dashboard/sessions) - rebuild
- [ ] Webhook: map new price IDs to tiers (rising/pro/elite)
- [ ] Test OBS overlay with live session
- [ ] Referral earnings flow end-to-end test
- [ ] Resend domain verify (tiptask.me) for branded emails
- [ ] Test promo invite full flow
- [ ] Switch to Stripe live keys
- [ ] Mobile polish on profile page
- [ ] Admin: sessions page shows expired requests count
- [ ] Consider: sessions tab showing per-session earnings history
