# AdBrain Architecture

Start here to understand the system, then follow the links. This doc is a map, not a
copy — details live in the linked docs.

## What it is
An own-account "action cockpit" for Meta/Google ad teams: connect your ad account, pull your
performance, and get one verdict plus a ranked "do this today" queue, each with the working
shown. Full product bet: [product-strategy-canvas](strategy/product-strategy-canvas.md).
Core spec: [phase-1-account-cockpit-design](superpowers/specs/2026-08-25-phase-1-account-cockpit-design.md).

## High-level design

```
                Browser
   public marketing  |  cockpit (behind auth)
          |          |
          v          v
+---------------------------------------------+       +------------------------+
|            Next.js 16 on Vercel             |       |  External services     |
|  - marketing pages   - cockpit UI           |       |  - Meta Marketing API  |
|  - auth (login/signup) + proxy.ts (gate)    |<----->|  - Google Ads API      |
|  - API routes: OAuth callback, ingest/cron  |       |  - ScrapeCreators (comp)|
|  - Vercel Cron (job drainer, ADR-0003)      |       |  - Gemini (AI)         |
+---------------------------------------------+       +------------------------+
          |  (server-only)                                   ^
          v                                                  |
+---------------------------------------------+              |
|                 Supabase                    |     intelligence pipeline
|  Auth  |  Postgres (RLS, owner-scoped)      |     (ADR-0003 + prompt-chain):
|  tables: brands, ad_accounts,               |     per ad -> Deconstruct(Gemini)
|  oauth_tokens(encrypted), ad_metrics,       |     -> Curate -> Rules(code)
|  triples(Brand Brain), jobs/job_items,      |     -> Strategize(Gemini)
|  recommendations, changes                   |     -> Explain/Validate
+---------------------------------------------+
```

## Layers
- **App (Next.js/Vercel):** marketing + auth + cockpit + API routes + `proxy.ts` gate + Cron.
  Next 16 uses `proxy.ts` (not middleware) and async `cookies()`.
- **Data/auth (Supabase):** Postgres with row-level security scoped to the owner; auth.
- **External:** Meta/Google (own-account data, OAuth), ScrapeCreators (competitor ads), Gemini (AI).
- **Intelligence pipeline:** a cron-drained job queue runs the agent chain per brand-run.

## Data flow
1. **Connect** an ad account (server-side OAuth) → token encrypted → `oauth_tokens`
   ([ADR-0002](adr/ADR-0002-account-connection-token-security.md)).
2. **Sync** ad performance incrementally via Cron → `ad_metrics` (upsert by `(ad_id,date)`).
3. **Run** the pipeline as an RPM-paced, resumable job queue
   ([ADR-0003](adr/ADR-0003-brand-run-execution.md)): Deconstruct → Curate → Rules → Strategize.
4. **Store** learned facts as triples (the Brand Brain) + `recommendations`.
5. **Cockpit** renders the verdict + queue; user approves/denies.
6. **Apply** is manual by default; every change logs to `changes`
   (never auto-apply — [DECISIONS D12](DECISIONS.md)).

## Key decisions & security
- Decision log (do not re-litigate): [DECISIONS.md](DECISIONS.md).
- Architecture records: [ADR-0001](adr/ADR-0001-video-ingestion-processing.md) (superseded),
  [ADR-0002](adr/ADR-0002-account-connection-token-security.md) (tokens),
  [ADR-0003](adr/ADR-0003-brand-run-execution.md) (run execution).
- Security posture + current gaps: [intended-vs-implemented audit](audits/intended-vs-implemented-2026-08-25.md).
- The load-bearing rule everywhere: **the rules engine computes numbers; AI only narrates and
  must cite evidence; the Validator vetoes anything unverifiable.**

## Documentation map
**Product & strategy:** [strategy canvas](strategy/product-strategy-canvas.md) ·
[feature/scope analysis](discovery/feature-request-analysis.md)
**Specs & plans:** [MVP design](superpowers/specs/2026-08-25-adbrain-mvp-design.md) ·
[Phase 0 plan](superpowers/plans/2026-08-25-phase-0-foundation.md) ·
[Phase 1 cockpit spec](superpowers/specs/2026-08-25-phase-1-account-cockpit-design.md) ·
[Phase 1 competitor spec (superseded)](superpowers/specs/2026-08-25-phase-1-competitor-intel-design.md)
**Architecture:** this doc · [ADRs](adr/) · [DECISIONS](DECISIONS.md) · [GOVERNANCE](GOVERNANCE.md)
**Design:** [DESIGN.md](../DESIGN.md) (system + principles) · [cockpit mockup](mockups/cockpit-v1.html)
**AI layer:** [agent roles](agents/agent-roles.md) · [failure recovery](agents/failure-recovery.md) ·
[chain-of-thought](ai/chain-of-thought-design.md) · [context engineering](ai/context-engineering.md) ·
[prompt chain](ai/prompt-chain-spec.md) · [Strategist prompt v1](ai/prompts/strategist-v1.md) ·
[prompt versioning](ai/prompts/VERSIONING.md)
**UX & quality:** [interaction spec](ux/cockpit-interaction-spec.md) ·
[heuristic eval](audits/heuristic-evaluation-cockpit-2026-08-25.md) ·
[ability spectrum](audits/ability-spectrum-map-2026-08-25.md) ·
[persona stress test](persona/stress-test-2026-08-25.md)
**Ops:** [SETUP](../SETUP.md) · [deploy checklist](deploy-checklist.md)

## Current status
- **Built (Phase 0):** marketing site, auth, DB schema (`0001`), Claude health check, build green.
- **Built (Phase 1 foundation, dormant):** `lib/crypto.ts` (+test), `ad_accounts`/`oauth_tokens`
  (`0002`), `lib/ad-source.ts` interface.
- **Specified, not built:** the cockpit, OAuth routes, sync, the rules engine, the AI agents/pipeline.
- **Not started:** deployment (blocked on owner SETUP.md steps).
- **Known drift:** docs target Gemini + warm-paper; code still Claude + indigo (Phase 1 swap).
  See the audit.
