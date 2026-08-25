# ADR-0003: Brand-run execution and job orchestration

**Status:** Proposed
**Date:** 2026-08-25
**Deciders:** Rahul (owner), Claude (implementer)
**Related:** ADR-0001 (superseded — heavier video pipeline); this formalizes the replacement.

## Context

A brand-run executes the prompt chain (`docs/ai/prompt-chain-spec.md`): pull/scrape ads →
Deconstruct each ad (Gemini, per-ad) → Curate → Rules → Strategize. The hard constraint is
**Gemini's free-tier requests-per-minute (RPM) limit**: the per-ad fan-out cannot all fire at
once. A 30-ad run is minutes of paced work, which is longer than a single serverless function
should hold, and it must survive a crash or timeout without losing or duplicating work.

Forces:
- **Serverless (Vercel), low-ops, free** (D2). No standalone worker if avoidable.
- **Gemini free-tier RPM** forces pacing; work must be rate-limited by design.
- **Background, not interactive** — a run taking a few minutes is fine; the dashboard polls.
- **Resumable + idempotent** — a crash mid-run resumes; re-processing an ad does not duplicate
  triples (the Curator dedups).

## Decision

Execute a run as a **cron-drained job queue in Postgres**:
- Two tables: `jobs` (run-level: `brand_id`, `status`, counts) and `job_items` (per unit of
  work: `job_id`, `ad_id`, `stage`, `status`, `attempts`, `error`, `updated_at`).
- On run creation, enqueue one `job_item` per ad (stage = `deconstruct`) plus a terminal
  `finalize` item (stage = rules + strategize).
- A **Vercel Cron** endpoint fires every minute, claims up to **N pending items** where N is the
  per-tick RPM budget, processes them, and marks each done/failed. The run completes over several
  ticks. An immediate first-tick kick on creation avoids a full-minute wait.
- **Resumability:** items started but not finished for > T seconds are reset to pending
  (attempts++). Writes are idempotent (upsert). A run whose items are all done triggers `finalize`.
- **Pacing is structural:** never process more than the RPM budget per tick, so we cannot exceed
  the free-tier limit no matter the ad count.

## Options Considered

### Option A: One long background function per run
`waitUntil` a single function that loops over all ads with sleeps for RPM.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Free (until timeout) |
| Scalability | Poor (one big task) |
| Team familiarity | High |

**Pros:** simplest to write.
**Cons:** a paced 30-ad run exceeds serverless max duration; a crash loses the whole run; no
natural retry; couples run length to one invocation.

### Option B: Cron-drained Postgres job queue (CHOSEN)
Per-item rows drained by Vercel Cron within an RPM budget per tick.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Free (Vercel Cron + existing Supabase) |
| Scalability | Good (more ticks / bigger budget) |
| Team familiarity | High (still one Next.js codebase) |

**Pros:** serverless and free; RPM pacing is built into the per-tick cap; resumable and idempotent;
no external dependency; matches the failure-recovery design (which already assumed a cron drainer
for stalled jobs).
**Cons:** a run spans minutes across ticks (fine for background work); we own the claim/reset logic.

### Option C: External queue (Upstash QStash) fan-out
One message per ad with queue-side rate limiting.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Free tier, then paid |
| Scalability | Excellent |
| Team familiarity | Medium |

**Pros:** managed retries + rate limiting; scales far.
**Cons:** a new dependency and signing/verification surface; the cron-drain achieves the same at
our volume for free. This was ADR-0001's direction, made unnecessary once ffmpeg/video work was
dropped.

### Option D: Client-triggered processing
The browser polls and triggers work.

Rejected: ties background work to an open tab; unreliable; a run should complete whether or not
the user is watching.

## Trade-off Analysis

The tension is **simplicity (A) vs robustness under rate limits (B/C)**. Option A is simplest but
its single-invocation model breaks against both the serverless duration limit and RPM pacing, with
all-or-nothing failure. Option C is robust but adds a vendor we do not need at this volume. Option B
puts the rate limit where it belongs — a per-tick cap — while staying serverless, free, resumable,
and dependency-free. It is also already assumed by the failure-recovery doc (cron resumes stalled
jobs), so it is the coherent choice.

## Consequences

- **Easier:** free and serverless; rate-limit compliance is structural; runs resume after crashes;
  progress is a `jobs` row the UI polls; scaling = bigger budget or more ticks.
- **Harder:** we own item-claim + stale-reset logic; a run is multi-tick, so "instant" is not a goal;
  needs a small idempotency contract on every write.
- **Revisit when:** per-run latency must drop sharply, volume explodes, or Gemini limits change —
  then move the same per-item handler behind QStash (Option C) with no schema change.

## Action Items
1. [ ] `jobs` + `job_items` tables (RLS via brand ownership) in a migration.
2. [ ] Run-creation: enqueue per-ad `deconstruct` items + one `finalize` item; immediate first kick.
3. [ ] Vercel Cron endpoint: claim <= RPM-budget pending items, process, mark done/failed, backoff.
4. [ ] Stale-item reset (started > T seconds -> pending, attempts++); idempotent writes.
5. [ ] `finalize` handler: run Rules + Strategist once all deconstruct items are done.
6. [ ] Surface job progress to the dashboard (counts + status), per the states table.
