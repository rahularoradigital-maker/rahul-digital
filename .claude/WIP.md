# WIP ledger (live) - who is editing what, right now

Follow `.claude/MULTI-CHAT-PROTOCOL.md`. Append/update your row before editing and when you finish. Keep it
honest and current so other chats can trust it. Status: WIP (editing now) | DONE (committed) | PENDING (left).

| Session | Area / files | Status | Note |
|---|---|---|---|
| rahul-linkedin-2-e9 | UI/UX: shadcn adoption app-wide; creative action-filters (Fatigue+Diversity+home card) + money-at-stake | DONE | commits 2bdf958, bb8ea00, 66e9b93, 47fa09b, d47af3d, aef0f6a, 7e5617a (pushed) |
| rahul-linkedin-2-e9 | Deep creative analysis (video-motion, free one-time top-10): `supabase/migrations/0028_deep_creative_analysis.sql`, `lib/creative/deep-decode.ts`, `lib/creative/deep-analysis.ts` (new), `app/api/creative/deep-analysis/route.ts` (new), a new creative-tab UI component | WIP | building now; NEW files only; will NOT edit meta-sync/from-store/analyze. Migration 0028 needs Rahul's go-ahead to apply to prod. |
| rahul-linkedin-2-04 | Creative Studio module: `components/app/creative-production/studio.tsx` (HOT — I edit it often), `app/api/creative-production/*`, `lib/creative-production/*`, `scripts/check-cp-*`, RPCs 0025 (product types) + 0026 (opportunities). Shipped: search / category chips / load-more / recommend / product-DNA panel / edit-copy / batch-generate / PNG + ZIP(+manifest) export / full Brand Control Panel / selection-persistence / search-sanitizer. | DONE | all pushed + deployed. `studio.tsx` claimed as hot — ping me before editing it. Also made ONE isolated fix to `lib/growth/quality.ts` (brand-mention guard → also match "AdScale"; committed 2d28c1b) to unblock check-quality-gate — @rahul-linkedin-2-e9 if you prefer the adscale-only version, yours wins, no objection. Not touching data-layer or any `lib/creative/deep-*` files. |

| rahul-linkedin-2 (creative/fatigue) | `components/app/creative/fatigue-list.tsx` — sort critical-first (money-at-stake) + add objective selector (reuse ObjectiveCardSelect) | WIP | Rahul asked; additive to e9's money-at-stake work; not touching hot data-layer files |

| rahul-linkedin-2-82 | Influencer Hunt: Phase1/2 filters + authenticity engine + reach-adjusted plausibility (`lib/influencer/*`, `components/app/creators/*`) | DONE | committed + live-verified |
| rahul-linkedin-2-82 | Rules codified: Build Loop #1 + Decision Chain #2 + Master Charter + Product Completion Loop (`CLAUDE.md`, `docs/intelligence/*`, `adbrain-engineering-os` skill) | DONE | committed |
| rahul-linkedin-2-82 | Product cleanup #1-#5: migration-trust guard + moved `0022_*_down.sql` to `supabase/rollbacks/`; doc honesty (`docs/ARCHITECTURE.md`); demo/stub gating (`lib/demo-mode.ts`, `lib/google/cockpit.ts`, creative `registry.ts` + generate route); durable queue (`lib/queue-postgres.ts`, `lib/queue-memory.ts`, `supabase/migrations/0027_jobs.sql`); server-rendered usage-meter | DONE | committed; **migration 0027 needs Rahul to apply to prod** (separate from e9's 0028) |
| rahul-linkedin-2-82 | Account-deletion foundation: manifest + anti-orphan guard (`lib/account/deletion-manifest.ts`, `scripts/check-account-deletion.ts`) — NO executor/endpoint yet (gated) | DONE | committed; executor is a later gated increment |
| rahul-linkedin-2-82 | Empty-state unify + topbar switcher retry + onboarding checklist (`components/app/{market/brand-section,account-switcher,brand-switcher,onboarding-checklist}.tsx`, funnel/changes/reconcile pages) | DONE | committed + live-verified |

<!-- Other chats: add your rows here. Claim the hot files (meta-sync, from-store, cockpit-data, analyze,
     decision, studio, app/app/page) before editing them so we stop colliding. -->
