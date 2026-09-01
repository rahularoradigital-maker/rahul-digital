# AdBrain — Product Completion Matrix (Phase 0 baseline)

The living classification for the Permanent Product Completion Loop (20 SaaS systems). Status is
evidence-based, never "looks finished" (charter Phase 43). 🟢 exists + works + verified · 🟠 exists but
defects/edge-cases/UX-gaps/not-live-verified · 🔴 missing or materially broken · ⬜ UNKNOWN (not yet
verifiable). Baseline scan 2026-09-01 (code presence + spine reads); LIVE verification still owed on
most 🟢 code items, so they sit at 🟠 until proven on prod.

Loop: AUDIT → classify → keep green → fix highest-value gap → test → attack → deploy → live-verify →
regress → update memory → re-audit → repeat. Continue autonomously on the obvious safe next gap; ASK
only for the GATED items (payment model, destructive data ops, legal/privacy interpretation, major
architecture, or a new external service needing Rahul's account/keys).

| # | System | Status | Evidence | Gap / work | Gated? |
|---|---|---|---|---|---|
| 1 | Onboarding | 🟠 | `app/integrations/meta/page.tsx` (connect), brand discover/profile; no guided first-run / time-to-value flow | Add a minimal first-run: what-it-is → connect Meta → first insight. Track signup→first_value | no |
| 2 | Sign up / log in | 🟠 | `app/(auth)/{login,signup}/page.tsx`, Supabase auth | Live-test happy+fail; audit rate-limit, error copy, multi-tab, expired session, email-enumeration | no |
| 3 | Email verification | ⬜ | No explicit verify page; Supabase project handles confirmation email | Confirm Supabase email-confirm setting + verified/pending/expired UX | no (config) |
| 4 | Password reset | 🟠 | `components/forgot-password-form.tsx` (resetPasswordForEmail), `reset-password-form.tsx` (updateUser + recovery-session + expired-link) — REAL | Live-test the full email→reset→login loop; the old "no pw-reset" note is STALE | no |
| 5 | Account deletion | 🔴 | Only `app/data-deletion/page.tsx` (22-line Meta-compliance INFO page); no delete API/server action | Build a real, audited, idempotent deletion workflow over all user-owned data | **YES (destructive)** |
| 6 | User permissions | 🟠→🟢 | `lib/app/access.ts` (default-deny gate), `lib/security/rbac.ts`, audit-row, tenancy (mig 0009), access_state (0022) | Strong. Owe the cross-user isolation live-test (Phase 36) | no |
| 7 | Empty states | 🟠 | Some exist (influencer "no creators", cockpit "still syncing"); not systematic | Systematic pass: every screen defines no-data/not-connected/no-access/first-use | no |
| 8 | Loading states | 🟢 | `loading.tsx` for ~every `/app/*` screen + route-level | Broad coverage. Spot-check component-level vs full-page | no |
| 9 | Error states | 🟠 | `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` exist; per-flow copy varies | Human-readable + retry + "is my data safe" across mutations; no raw stack traces | no |
| 10 | Network states | 🟠 | Cockpit cold-pull timeout → "Still syncing"; no systematic offline/timeout/retry UX | Timeout/429/5xx/offline handling; no auto-retry on destructive ops without idempotency | no |
| 11 | Data persistence | 🟠→🟢 | `cockpit_cache`, day-wise store, growth drafts, influencer runs stored | Verify refresh/multi-tab/return-later; draft/save-status UX where users create work | no |
| 12 | Payment | 🔴 | Token metering (`lib/billing/{plans,meter}.ts`) + `app/pricing` exist; NO Stripe/checkout/entitlement-from-payment | Wire a real checkout + webhook-driven entitlement (server is authority) | **YES (business)** |
| 13 | Notifications | 🟠 | `lib/notifications/*`, Notification Center, dedupe unique (mig 0014) | Verify delivery/read-state/severity UX; anti-spam | no |
| 14 | Analytics | 🔴 | No product-event analytics (no track/posthog/@vercel/analytics); `ai_usage`/metering is cost only | Instrument the ~13 charter events (signup→first_value→...); pick a sink | **partial** (vendor/key) |
| 15 | Crash reporting | 🟠 | `lib/observability.ts` `captureError(err, ctx)` foundation; no external sink/alerting | Wire a production sink (Sentry free tier) + alerts; safe context only | **partial** (DSN/account) |
| 16 | Privacy setup | 🟠 | `app/{privacy,terms,data-deletion}/page.tsx` exist (short, real content) | Legal review; cookie/consent; GDPR/CCPA data-subject + export | **YES (legal)** |
| 17 | Accessibility | ⬜ | shadcn + semantic components + design system; no a11y audit run | Run axe/keyboard/contrast/focus/reduced-motion audit; fix top issues | no |
| 18 | Responsiveness | ⬜ | Tailwind responsive + shadcn | Verify mobile/tablet for tables/charts/dialogs/forms/billing | no |
| 19 | End-to-end flows | 🔴 | No e2e tests (no Playwright); 115 `check-*.ts` logic checks only | Add e2e for signup/verify/login/reset/access/connect/dashboard/logout (happy+fail) | no |
| 20 | Beta tester system | 🟠→🟢 | access_state WAITLIST→APPROVED, `app/waitlist`, admin approve panel, org invites (mig 0011) | Confirm SUSPENDED/REVOKED states + feedback capture (Phase 24) | no |

## Summary
- 🔴 materially missing: **account deletion (5), payment checkout (12), e2e tests (19), product analytics (14)**.
- 🟠 exists-but-unproven/partial: onboarding, auth, reset, error/empty/network states, persistence, notifications, crash sink, privacy, beta.
- ⬜ unaudited: email-verify config, accessibility, responsiveness.
- 🟢 strong: loading states, permissions foundation (owe isolation live-test).

## Prioritization (charter Phase 30: impact × failure × security × revenue × support ÷ effort)
GATED (need Rahul before build): **account deletion** (destructive + legal/Meta requirement),
**payment checkout** (business model + Stripe account), **privacy/legal** (interpretation), and the
**analytics/crash sinks** (need his vendor choice + DSN/keys).
SAFE autonomous, highest-value first: **error/empty/network state hardening (7,9,10)** → then **e2e
tests for the auth spine (19)** → then **onboarding first-run (1)** → then **a11y/responsive audit
(17,18)**. These are pure UX/robustness, use the existing design system (Phase 38), add no external
service, and directly cut "broken states" (the North Star).

## Owed live verifications (charter Phase 35) before any 🟠→🟢 promotion
Auth happy+fail, password-reset full loop, cross-user isolation, refresh/multi-tab persistence,
notifications delivery. None claimed 🟢 without live proof.
