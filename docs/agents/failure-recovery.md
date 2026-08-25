# AdBrain Intelligence Layer — Failure Recovery

Builds on `agent-roles.md`. Two structural facts make recovery tractable:
- **Handoffs go through the database** (`jobs`, `triples`, `ad_metrics`, `competitor_ads`),
  not ephemeral agent memory. A crash mid-pipeline is resumable from the last completed step.
- **Per-ad isolation** — one ad's failure never sinks the batch.

Cross-cutting UX rule: match the failure's visibility to its stakes.
Invisible (single-ad skip) → Transparent (stale data) → Participatory (reconnect) →
Honest (total failure, and ANY money-moving action).

---

## 1. Failure mode inventory + recovery (per component)

### Ingest Worker (Meta / Google / ScrapeCreators)
| Failure | 1st: retry | Fallback | Escalate / worst case | User sees |
|---|---|---|---|---|
| OAuth token expired | refresh token (server) | — | refresh fails → ask user to reconnect | Participatory: "Reconnect your Meta account" |
| Token revoked | — | — | mark account disconnected | Participatory + connect CTA |
| API rate limit (429) | backoff + pause/resume job | — | never fail the job, resume next window | Transparent: "still syncing" |
| API 5xx / timeout | retry x3 backoff | serve last-good sync | banner + retry later | Transparent: "data as of {last sync}" |
| ScrapeCreators quota exhausted | — | suppress SOV/Concepts needing fresh competitor data | keep own-account cockpit working | Transparent: "competitor data paused (credits)" |
| No data at all (nothing pulled) | — | — | honest failure | Honest: "Couldn't pull data. Connect / retry." |

### Deconstructor (Gemini, per ad)
| Failure | 1st | Fallback | Worst case | User sees |
|---|---|---|---|---|
| Malformed/invalid JSON | retry once, stricter prompt | — | mark ad `analyze_failed`, skip | Invisible, but counted |
| Rate limit | backoff + requeue this ad | — | run continues (isolation) | Invisible |
| Video too large/unsupported | — | analyze thumbnail + copy only, note it | skip if still fails | Invisible; note on ad |
| Hallucinated attribute | — | — | caught downstream (Curator confidence + Validator) | n/a |
Batch always reports "analyzed N of M; K skipped" — never a silent partial.

### Brand Brain Curator
| Failure | Recovery |
|---|---|
| Unique (subject,predicate,object) conflict | expected → upsert/merge, not an error |
| DB write error | retry; persistent → job error (escalate) |
Single-writer design removes write coordination failures by construction.

### Rules Engine (deterministic)
| Failure | Recovery |
|---|---|
| Insufficient metrics / thin history | return an "insufficient data" sentinel, NOT a fabricated number → empty state |
| Divide-by-zero / missing field | guarded pure functions return sentinel |
No retry (deterministic → same output). Forecasts on thin data are suppressed or
labeled low-confidence, never shown as fact.

### Strategist / Concept / SOV (Gemini)
| Failure | 1st | Fallback | User sees |
|---|---|---|---|
| Invalid/malformed output | retry once | — | invisible |
| Cites a triple/number that doesn't exist | — | Validator veto (below) | "cannot verify" on that item |
| Nothing to recommend (empty) | — | valid result | warm empty: "Nothing to act on. You are clean." |

### Explainer ("show the working")
| Failure | Recovery |
|---|---|
| Missing evidence for a row | render "source unavailable" for that row; never invent |
| Introduces a figure not in evidence | Validator veto |

### Validator (honesty gate) — FAILS CLOSED
| Failure | Recovery |
|---|---|
| Validator itself errors | **fail closed**: withhold the item, mark "cannot verify" — never ship unvalidated |
| False veto (too strict) | item shows "cannot verify" (acceptable degradation) |
When in doubt, withhold rather than show an unverified number. Honesty > completeness.

### Orchestrator
| Failure | Recovery |
|---|---|
| A step hangs | per-step timeout → mark step failed, continue/skip |
| Job stalls / crashes mid-run | job marked `stalled`; Vercel Cron drainer resumes from last completed step (steps are idempotent via upserts) |

### Apply / write-back (highest stakes — money moves)
| Failure | Recovery |
|---|---|
| (v1) manual-apply | risk deferred: we show the change, the human applies it in Meta |
| (future API write-back) partial apply | **COMPENSATION**: stop the batch immediately, log what applied vs not to `changes`, show it plainly. NEVER blind-retry a money-moving action. |
| Token expires mid-apply | abort remaining changes; ask to reconnect; show applied-so-far |
User sees: always Honest + Participatory here. Never invisible, never auto-retry.

---

## 2. Cascading failure analysis

- **Contained by design:** DB handoffs + per-ad isolation mean a single agent failure degrades
  locally (skip an ad, suppress a section) instead of cascading.
- **The one real cascade:** total Ingest failure → every downstream section has no data.
  Mitigation: serve the **last-good sync** with a staleness banner ("data as of {date}"), keep
  the cockpit usable, and surface a reconnect/retry CTA. (Same lesson as the sibling LinkedIn
  app's stale-data banner.)
- Validator failing closed cannot cascade into shipping bad data — it only ever withholds.

## 3. Recovery strategy summary (limits)

- Transient API errors: retry x3 with exponential backoff, then degrade to last-good + banner.
- Gemini schema errors: retry once (stricter), then skip that unit (isolated).
- Rate limits: pause + resume the job, never hard-fail.
- Money actions: zero blind retries; compensation + honest UX only.
- Everything is resumable: idempotent steps, DB-backed state, cron drainer for stalled jobs.

## 4. Testing protocol (fault injection)

Each is a runnable check with a mocked fault; assert the degradation, not a crash:
- [ ] Meta 429 → job pauses and resumes; no lost ads.
- [ ] Expired token → reconnect prompt, not a 500.
- [ ] Gemini returns malformed JSON → one retry, then ad skipped; batch completes; count correct.
- [ ] Oversized video → thumbnail fallback path taken.
- [ ] Thin-history brand → forecasts suppressed; no fabricated numbers; empty states shown.
- [ ] ScrapeCreators quota = 0 → SOV/Concepts suppressed; own-account cockpit still renders.
- [ ] Validator forced to error → item shows "cannot verify"; nothing unverified ships.
- [ ] Kill the job mid-run → cron resumes from last completed step; no duplicate triples.
- [ ] (write-back, when built) partial apply → batch stops, `changes` shows applied vs not, no retry.
