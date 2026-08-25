# ADR-0004: Scale architecture for 10k users/day (design-for-scale, provision-for-now)

**Status:** Accepted
**Date:** 2026-08-25
**Deciders:** Rahul (owner, approved), Claude
**Supersedes for scale:** ADR-0003 (MVP cron-queue) and the free-tier parts of `docs/system-design.md`.
**Full plan:** the approved plan (10k users/day) — this ADR records the durable decisions.

## Context
AdBrain ships as a live web product targeting 10k daily active users, each with a connected Meta
account. Naive load = ~600k ad-day rows/day and ~750k Gemini calls/day — the free-tier MVP fails at
~20 users. We need a scale architecture, but must not over-build before there are users.

## Decision
**Design for 10k, provision for now.** Build the MVP behind clean seams so each scale migration is a
swap/config change, not a rewrite. Key durable choices:
1. **Fingerprint-once** (artifact [05], keyed by `content_hash`) is the primary cost control —
   deconstruct each creative once, reuse across daily runs. ~10x Gemini-call reduction.
2. **Managed queue + worker fleet** (QStash/SQS + containers) for heavy pipeline work at scale,
   replacing ADR-0003's cron-drained Postgres queue. Behind a `lib/queue.ts` interface so the
   cron-drain impl now and the managed impl later share one contract.
3. **Cache seam** (`lib/cache.ts`) — in-memory now, Redis/edge later, same contract. Caches
   fingerprints, prompt prefixes, and computed rule outputs.
4. **Data tier at scale:** connection pooling (Supavisor/pgBouncer), partition daily fact tables by
   date + retention, read replicas for dashboards, materialized rollups (compute on sync, not on view).
5. **Cost + fairness:** paid Gemini with per-tenant token quotas; per-tenant rate limiting + queue
   priority (noisy-neighbor control); per-tenant cost tracking; price must cover $/account/day.
6. **Production gates:** `docs/production-readiness.md` (security, privacy/legal, observability) is
   blocking before public launch.

## Options considered
- **A: Build 10k infra now.** Rejected — over-building before validation/users; wasted spend.
- **B: Ship MVP free-tier, rewrite later.** Rejected — the rewrite (queue, DB, cost) is exactly the
  expensive thing; seams avoid it.
- **C (chosen): Design-for-scale, provision-for-now.** MVP behind interfaces (queue/cache/AdSource);
  swap implementations as scale triggers hit. Cheap now, no rewrite later.

## Consequences
- Easier: scaling is config/impl swaps; fingerprint-once caps the dominant cost from day one.
- Harder: we must build the seams (queue/cache interfaces) up front even though MVP impls are trivial;
  discipline needed to route heavy work through them, not inline.
- Revisit: exact provider choices (QStash vs SQS, Redis host) at P1; cost model as real usage lands.

## Action items
1. [ ] `lib/queue.ts` interface (cron-drain impl now; managed impl at P1).
2. [ ] `lib/cache.ts` interface + in-memory impl (Redis at P1) + runnable check.
3. [ ] Fingerprint-once cache keyed by `content_hash` when the creative pipeline is built.
4. [ ] Rollup tables + partitioning in the warehouse schema migrations (P1/P2).
5. [ ] Per-tenant quota + cost tracking before paid scale.
6. [ ] Add artifacts [29] Legal/Privacy/Compliance and [30] Production Ops to the master plan.
