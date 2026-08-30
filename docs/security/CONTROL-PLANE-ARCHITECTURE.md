# AdBrain — Control-Plane Architecture & Security Roadmap

_Grounded in a 5-plane audit of the real repo (2026-08-30). This is the north-star architecture and the
honest, phased path to it — not a claim that it is all built. See
`AdBrain-Control-Plane-Gap-Assessment.xlsx` for the 32-requirement row-by-row status._

## Principle

Design for a 100-engineer / 10k-customer future; **provision for now**. AdBrain today is a pre-launch,
single-developer MVP. Building the full enterprise control plane now would be over-engineering that freezes
the product. So: decide every boundary now, build the high-value security foundation now, and phase the rest
so each later piece is a slot-in, not a rewrite.

## The five planes

| Plane | Contains | Today | Boundary |
|---|---|---|---|
| **Customer / Product** | Cockpit, creative, market, influencer, settings (`app/app/*`), customer APIs, the Judge agent | Built | The only plane customers touch |
| **Control** | Admin, user/org mgmt, billing/credit admin, AI governance, prompt/rule/formula/agent registries, connectors, security ops, audit, feature flags, kill switches, health, incidents | **Not built** — no `/admin`, no admin API | Internal only; separate authz at every level |
| **Data** | Supabase Postgres: product data, usage events, AI records, (future) ledger + billing, audit records | Built (per-user/-org scoped) | RLS + app-level tenant scoping |
| **Secrets** | API keys, OAuth refresh tokens, encryption keys, webhook/payment secrets | **Strong** — env + AES-256-GCM encrypted tokens, no client leaks | Never normal app data; never reaches the client |
| **Observability** | Logs, metrics, traces, alerts, uptime, cost, security events | Partial — health probe + AI-budget alert + Notification Center | Feeds ops, not customers |

## What is built now (this foundation)

- **Immutable audit log** (`0015_audit_log.sql`, `lib/security/audit-log.ts`) — append-only, a DB trigger
  blocks UPDATE/DELETE so history cannot be rewritten even with the service key; RLS deny-by-default;
  secret-scrubbed before write. Wired into `credential.store` (Meta connect) and `judgment.label` (RLEF).
- **Kill switches + feature flags** (`0016_system_flags.sql`, `lib/security/flags.ts`) — env var is the
  guaranteed brake (`KILL_AI=1` halts every AI call, wired into `lib/ai/router.ts`); the DB layer allows a
  no-redeploy flip.
- **RBAC catalog** (`lib/security/rbac.ts`) — 24 granular permissions + a role matrix; **platform powers
  (credits, refunds, publishing, kill switch, credential rotation) are granted to no tenant role**, reserved
  for a future control-plane admin identity.
- **Data classification** (`lib/security/classification.ts`) — every table mapped to one of five tiers, and
  the tier dictates encryption / loggability / access / retention.
- **Plane-boundary guard** (`scripts/check-plane-boundary.ts`) — fails the build if a secret could reach the
  browser or a client file imports the admin plane. Scans clean today.
- **Governance bug fix** — the Judge agent no longer serves the 991 `planned` corpus rules as if in force;
  only `shipped`/`partly` rules can back a live verdict.

Five runnable checks (121 assertions) enforce these in `check:all`.

## What is deliberately NOT built now (and why)

These need external services and your decisions; building them for a zero-customer MVP is premature:

- **SSO / MFA / hardware keys, step-up auth** — needs an identity provider choice.
- **Stripe billing + credit ledger** — no payments exist yet; build when you charge.
- **A real secret-manager service** (vs env) — env + envelope encryption is sufficient at this stage.
- **Break-glass, incident-management, four-eyes approval UI** — team-scale controls; you are a team of one.
- **A separate `admin.example.com` deployment** — build the control plane as routes first, split later.

## Roadmap

- **Now (done):** audit log, kill switches, RBAC model, classification, plane guard, security checks.
- **P1 (before real customers):** apply migrations `0015`/`0016`; a seeded cross-tenant isolation test; enforce
  `requirePermission` on write paths; timing-safe cron compare; secret rotation/revocation; structured AI
  prompt layers; data-export + account-deletion flows; wire security events to notifications; red-team pass.
- **P2 (at scale):** separate control-plane deployment + admin auth (SSO/MFA); four-eyes; incident + break-glass
  systems; prompt/rule/formula publish lifecycle with immutable version pinning on every decision.

## Immediate operational note

Migrations `0015`/`0016` are **files, not yet applied** to the live DB (applying schema is a dangerous write —
it needs your go-ahead). The code is best-effort and no-ops safely until they are applied, so nothing breaks
in the meantime.
