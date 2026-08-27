# 00 — Scope Lock

**Audit target:** AdBrain `/app` **Account Cockpit** — the primary logged-in dashboard, plus the app topbar/filter chrome that frames every screen.

**Surfaces in scope (source, static repo — no auth'd running instance):**
- `app/app/page.tsx` — the cockpit (health, KPIs, scaling, funnel, action list, fatigue radar, leaderboard, waste, opportunity, data-quality banner)
- `components/app/topbar.tsx` + `account-switcher.tsx`, `campaign-switcher.tsx`, `objective-switcher.tsx`, `control-styles.ts` — the filter/action chrome
- `components/cockpit/*` — HealthRing, HealthComposition, KpiCard, ActionList, FatigueRadar, FunnelCard, Leaderboard, WhyDrawer, AdLink, styles.ts
- `components/app/sidebar-nav.tsx`, `mobile-nav.tsx` — primary navigation
- `app/globals.css` — design tokens (color, spacing, radius, type)

**Out of scope (this audit):** Market/Competitors, Creative, Media, Settings screens; marketing/login pages; the connect/empty states beyond a glance.

**Primary user:** a DTC performance marketer / media buyer (Rahul's persona) managing live Meta ad accounts.

**Primary task:** on opening the cockpit, decide **what to ship/kill/scale this week** — read account health, see the ranked action list, and trace any call to the exact ad in Ads Manager.

**Constraints:** Next.js 16 + Tailwind; existing token system in `globals.css`; Indian-English, plain, lightly-technical voice; hard rule — no number shown without a real-data-derived formula; no fabricated data.

**Reference:** deepsolv.ai / Imagive.ai (creative intelligence tools) as category peers; Meta Ads Manager as the tool it must reconcile with.

**Method note:** dev server requires Supabase auth, so Visual/Accessibility evidence is read from source (CSS tokens, component markup) and marked INFERRED where a rendered measurement was not possible. Recent user-supplied screenshots of the cockpit are used as rendered evidence where cited.
