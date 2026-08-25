# AdBrain System Design

High-level design is in [ARCHITECTURE.md](ARCHITECTURE.md); this goes deeper on the data
model, API contracts, and — the part not done anywhere else — **scale and reliability against
the free-tier bet.** Numbers are estimates; verify current provider limits before relying on them.

## 1. Requirements (brief)
- **Functional:** connect ad account → sync metrics → run the AI pipeline → cockpit verdict +
  approve/deny queue. Full spec: [cockpit spec](superpowers/specs/2026-08-25-phase-1-account-cockpit-design.md).
- **Non-functional:** background analysis (minutes OK, not interactive); near-zero cost at MVP;
  resumable; owner-scoped data isolation; honest/auditable outputs.
- **Constraints:** solo non-technical owner; managed/low-ops; Next.js + Supabase + Vercel + Gemini
  (D2, DECISIONS.md).

## 2. Consolidated data model
Owner-scoped via RLS on every table (see [ADR-0002](adr/ADR-0002-account-connection-token-security.md)).

```
auth.users (Supabase)
 └─ brands (user_id)                         niche, objectives
     ├─ ad_accounts (platform, external_id)  status, last_synced_at
     │   └─ oauth_tokens (1:1, ENCRYPTED)    server-only, RLS deny-by-default
     ├─ competitors ─ competitor_ads         source, creative_url, active_status
     ├─ campaigns ─ ad_sets ─ ads            external_id, creative_url, media_type
     │                        └─ ad_metrics  (ad_id,date) daily: spend,imps,clicks,rev,freq
     ├─ triples (Brand Brain)                subject,predicate,object,confidence,source
     ├─ jobs ─ job_items                     run status; per-ad stage/attempts (ADR-0003)
     ├─ recommendations                      kind,outcome,money_impact,state,evidence_triple_ids
     └─ changes                              applied changes log (actor, delta)
```
Key indexes: `ad_metrics(ad_id,date)` unique (incremental upsert), `triples(brand_id)`,
`job_items(status)` (cron claim), `*_ (brand_id)` on all children. Hot path = the cron claim on
`job_items` and the retrieval query on `triples` — both indexed.

## 3. API contracts (route surface)
| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/auth/callback` | GET | session | OAuth code exchange (Supabase) |
| `/api/connect/[platform]/authorize` | GET | user | start ad-account OAuth |
| `/api/connect/[platform]/callback` | GET | user | exchange, encrypt, store token |
| `/api/ingest/run` | POST | user | create a brand-run (enqueue job_items) |
| `/api/cron/drain` | GET | cron secret | claim <=RPM-budget items, process, mark done (ADR-0003) |
| `/api/cron/sync` | GET | cron secret | incremental metrics pull |
| `/api/health/*` | GET | none | liveness (Claude now, Gemini later) |
Cron routes require a shared secret header; never user-triggerable. Token endpoints are Tier-2
sensitive (encrypt on write, never return tokens).

## 4. Deep dive: queue, caching, retries
- **Queue:** cron-drained `job_items` ([ADR-0003](adr/ADR-0003-brand-run-execution.md)) — RPM
  pacing is structural (per-tick cap). Retries: per-item `attempts`, stale-reset after T seconds.
- **Caching:** stable Gemini prompt prefix cached across per-ad calls
  ([context-engineering](ai/context-engineering.md)); `ad_metrics` is the cache of external data
  (sync incrementally, never re-pull per view).
- **Error handling:** per-item isolation + fail-closed Validator
  ([failure-recovery](agents/failure-recovery.md)).

## 5. Scale & reliability — load estimation vs free-tier ceilings
Model: **20 first users**, 1 Meta account each, ~60 active ads, one brand-run/week.
- Metrics rows: 20 x 60/day = 1,200/day ≈ 36k/month of tiny rows → a few MB. Fine for months.
- Gemini calls/run: ~60 deconstruct + 1 strategize + ~6 explain + ~6 validate ≈ **~75 calls/run**.
  20 runs/week ≈ 1,500 calls/week (~215/day averaged).

### Breaking points the free-first bet hides (real findings)
1. **Gemini single free key = one shared RPM/RPD budget.** A 60-ad run paced at ~15 RPM already
   takes ~4+ min. If many users run the same morning, ~1,500 calls collide against one key's daily
   cap and serialize → runs queue for a long time. **Breaks around ~20 concurrent-ish users.**
   Mitigation: paid Gemini tier, or per-tenant keys, or spread runs across the week.
2. **ScrapeCreators free tier is ~100 credits TOTAL, not monthly.** Competitor SOV/Concepts consume
   credits per pull → the free allotment is exhausted almost immediately once those features run.
   **Breaks on first real competitor usage.** Mitigation: gate competitor features, or buy the
   $47/25k tier when they turn on.
3. **Vercel Hobby Cron granularity.** ADR-0003 assumes a ~per-minute drainer. Hobby cron is
   coarse (often daily). **The job drainer likely needs Vercel Pro (~$20/mo) OR a free external
   cron** (e.g. a scheduler pinging `/api/cron/drain`). This is the first real bill or the first
   external dependency.
4. **Supabase free tier auto-pauses on inactivity.** A low-traffic MVP's DB pauses after ~a week
   idle → the next request errors/cold-starts. Mitigation: a cheap keep-alive ping, or accept a
   slow first request, or upgrade when there are real users.

### Reliability
- Failover: stateless app (Vercel), managed DB (Supabase) — no custom HA needed at MVP.
- Resumability: DB-backed jobs resume after any crash (ADR-0003).
- **Monitoring gap (honest):** there is none yet. Minimum to add before real users: job
  success/failure counts, Validator `cannot_verify` rate, sync failures, and a Gemini/ScrapeCreators
  quota alarm. Without these we are blind to breaking points 1-2 in production.

## 6. Trade-offs & what to revisit
- **Free-first is real but has ceilings** (section 5). It holds for a genuine MVP (a handful of
  users, weekly runs) but not for growth. The honest read: budget for ~$20-70/mo (Vercel Pro +
  ScrapeCreators + maybe Gemini) the moment there are ~10-20 active users OR competitor features ship.
- **Single shared Gemini key** is the first thing to revisit; per-tenant keys or a paid tier.
- **Cron granularity** forces an early call: Vercel Pro vs an external free scheduler.
- Revisit the whole queue-vs-QStash choice (ADR-0003) only if per-run latency or volume demands it.
```
