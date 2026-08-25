# Phase 1 — Competitor Intel to AI Test Plan (Design)

**Date:** 2026-08-25
**Status:** SUPERSEDED (2026-08-25) by `2026-08-25-phase-1-account-cockpit-design.md`

> Repointed to own-account-first after the owner supplied an action-cockpit reference
> and directed "connect account first, then pull data." Competitor intel (ScrapeCreators)
> is retained but demoted to the Share-of-Voice section of the cockpit. ScrapeCreators +
> Gemini + the triples Brand Brain decisions from this doc still hold; the flow and primary
> data source changed. Kept for history.
**Depends on:** Phase 0 (foundation) complete
**Supersedes:** ADR-0001's heavy video pipeline (see §Provider + architecture change)

---

## 1. What we are building

The MVP feature loop:

1. User creates a **Brand** and adds competitors (Facebook Page/company) and/or a niche keyword.
2. AdBrain **scans** competitor ads from the Meta Ad Library via ScrapeCreators.
3. **Gemini** analyzes each ad (image or video, natively) and writes subject-predicate-object
   **triples** into the Brand Brain.
4. **Gemini** reads the triples graph plus the winning signal and produces a **ranked weekly
   test plan** with a hypothesis, rationale, confidence, and cited evidence per item.
5. The dashboard shows the plan, the competitor ads behind it, and the growing graph.

## 2. Constraints (from the owner)

| Constraint | Consequence |
|---|---|
| Free tools as much as possible | ScrapeCreators free tier + Gemini free tier. Pay only when outgrown. |
| All-Google AI | Gemini does all analysis and reasoning. **Claude is dropped from the project.** |
| Non-technical owner, low-ops | One codebase, no ffmpeg, no separate worker, no external queue. |
| Full video analysis | Achieved via Gemini native video input (no frame extraction, no transcription service). |

## 3. Architecture

### 3.1 Data ingestion — ScrapeCreators (the one non-Google piece)
Meta owns Ad Library data, so it cannot come from a Google product. ScrapeCreators
`GET /v1/facebook-ad-library` (free tier: 100 credits, no card; ~1 credit/request) is the
single external data source.
- Query by **company/advertiser** (`/company/ads`) and/or **keyword** (`/search/ads`);
  `/search/companies` resolves a name to an advertiser first.
- Returns: ad copy, image URLs, **video URLs**, advertiser, active status, platforms, countries.
- Server-only API key (never reaches the browser).

### 3.2 Analysis — Gemini (all-Google, native multimodal)
Gemini (via Google AI Studio, free tier) analyzes each ad directly:
- **Image ads:** send the creative image + copy to Gemini.
- **Video ads:** download the video from ScrapeCreators' `video_url`, upload to the Gemini
  **File API**, then analyze. No ffmpeg, no separate transcription. Gemini sees the whole video.
- Gemini returns structured attributes AND triples for the Brand Brain, validated against a
  schema; malformed output is retried.

### 3.3 Processing model — simplified jobs table
A brand-run is minutes of work, so it runs in the background, but without the heavy pipeline
ADR-0001 anticipated:
- A `jobs` row is created (`queued`), the scrape runs and writes `competitor_ads`.
- A Vercel background function processes ads in small batches, **one Gemini call per ad**,
  writing triples. Status advances `queued -> scraping -> analyzing -> done`.
- No external queue at MVP volume. If a run is large, the function drains the remaining ads in
  the next batch (a simple `status`/`processed_at` scan). Vercel Cron can act as the drainer.
- The dashboard polls the `jobs` row for progress.

### 3.4 Test plan — Gemini
Gemini queries the brand's triples plus the winning signal and returns a ranked list of test
items: `hypothesis`, `rationale`, `confidence`, `evidence_triple_ids`. Written to
`test_plans` / `test_plan_items` (already exist from Phase 0).

## 4. The winning signal (which ads to learn from)

Primary: **longevity + impressions** (long-running, high-impression ads are proven winners).
- ScrapeCreators exposes active status; start-date/impressions availability is unconfirmed.
- **Fallback if date/impressions are missing:** rank by (a) still-active, and (b) number of
  active variants an advertiser is running on a theme (heavy variant testing signals investment,
  i.e. it is working). This keeps the "what works" premise even without spend data.

## 5. Data model additions

Extend `competitor_ads` (Phase 0) with: `media_type` (image|video), `image_url`, `video_url`,
`active_status`, `days_running` (nullable), `variant_group` (nullable), `analyzed_at`.

New table `jobs`:
```
jobs   id, brand_id, status, total_ads, processed_ads, error, created_at, updated_at
```
RLS: `jobs` scoped to the owning brand's user, matching the Phase 0 pattern.

## 6. Error handling

- Each ad is processed independently; one failed ad (bad video, Gemini error) is logged on the
  ad row and skipped, never failing the batch. Retried once.
- ScrapeCreators/Gemini rate limits: exponential backoff; the job pauses and resumes rather than
  failing.
- Per-run caps (max ads per brand) to protect free-tier credits; surfaced to the user before a run.

## 7. Testing

- One live validation call to ScrapeCreators (1 request) to lock the real output shape and confirm
  whether start-date/impressions are present. Confirm with the owner before spending a credit.
- One live Gemini call each for an image ad and a video ad to confirm the analysis + triple schema.
- Fixture-based runnable checks: triple dedup (no duplicate subject/predicate/object per brand),
  test-plan output cites real triple ids, winning-signal ranking falls back correctly when
  date/impressions are absent.

## 8. Open items to validate during implementation

1. ScrapeCreators: does one credit return one ad or a page of ads, and does it include start-date /
   impressions? (Decides the winning signal.)
2. Gemini video: confirm the download-then-File-API path works for Meta CDN video URLs within a
   serverless function's time/size limits.
3. Gemini free-tier rate limits (requests/minute/day) vs batch size; tune batch size accordingly.

## 9. Provider + architecture change (record)

- **Claude is removed** from the project. The Phase 0 Claude health-check route
  (`app/api/health/claude`), `lib/anthropic.ts`, and the `check:claude` script are replaced by a
  Gemini equivalent (`lib/gemini.ts`, `app/api/health/gemini`, `check:gemini`) during Phase 1.
- **ADR-0001 is superseded:** Gemini native video removes ffmpeg, ElevenLabs, and the QStash queue.
  ADR-0001 is marked Superseded with a pointer to this spec.

## 10. Out of scope (YAGNI)

- Live Meta/Google account OAuth (Phase 2).
- Creative generation (Phase 3).
- Multi-frame ffmpeg extraction / separate transcription (obviated by Gemini).
- External message queue / dedicated worker (revisit only if volume outgrows batched functions).
