# ADR-0001: Background processing model for Phase 1 ad ingestion (incl. full video analysis)

**Status:** Proposed
**Date:** 2026-08-25
**Deciders:** Rahul (owner), Claude (implementer)

## Context

Phase 1 ingests competitor ads and analyzes them. Per brand-run the pipeline is:

1. Scrape ads (Apify Ad Library via Monid), ~10-30s per run.
2. For each ad: Claude vision on the creative image + copy.
3. For each **video** ad (owner chose full video analysis): download the video, run
   ffmpeg to extract ~3-5 key frames, transcribe the audio (ElevenLabs
   speech-to-text, accepts a video URL), then Claude vision over the frames + transcript.
4. Write triples to the Brand Brain, then generate a ranked test plan.

This is minutes of wall-clock work with external API calls and a native binary
(ffmpeg). It cannot run inside a single HTTP request. So we must decide **where and
how the long-running work executes**.

Forces at play:
- **Non-technical owner.** Fewer moving parts and deployment surfaces is a hard priority.
- **Low-ops / managed.** No server to patch or babysit.
- **Cost.** Strong preference for free tier; small paid steps acceptable if justified.
- **Low concurrency.** A handful of first users, a few brand-runs per day.
- **Native dependency.** ffmpeg is required for frame extraction; no managed
  "video to frames" endpoint exists (confirmed via Monid discovery).
- **Reliability.** One bad video must not fail the whole batch; work must survive a
  crash or timeout and retry.

Phase 0 is a single Next.js app on Vercel + Supabase. We want to stay as close to
that as possible.

## Decision

Adopt a **queue-driven, per-ad serverless pipeline on the existing Next.js/Vercel app**,
with a `jobs` table in Supabase as the source of truth for status and a managed
message queue (Upstash QStash) driving one short function invocation per ad.

Concretely:
- A `jobs` row is created when a brand-run starts (status: `queued`).
- The scrape runs, writes `competitor_ads` rows, then enqueues **one QStash message
  per ad** pointing at an internal route (`/api/ingest/process-ad`).
- Each message processes exactly one ad end to end (vision, and for video:
  download + ffmpeg frames + ElevenLabs transcript + vision) inside a single function
  invocation. One short-lived video per invocation keeps runtime well under the
  function timeout.
- ffmpeg ships as the `ffmpeg-static` binary bundled with the function (fits Vercel's
  function size limit).
- QStash provides retries, rate limiting, and delivery guarantees for free at our volume.
- When the last ad completes, a finalize message generates the test plan and flips the
  job to `done`. The dashboard polls the `jobs` row for progress.

This keeps **one codebase, one deploy, no standalone worker**, stays on free/low tiers,
and isolates failure to a single ad.

## Options Considered

### Option A: One long-running Vercel function per brand-run
Process the entire batch (all ads, all videos) inside a single background function.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Free (until timeout forces Pro) |
| Scalability | Poor (one big task, all-or-nothing) |
| Team familiarity | High (plain Next.js) |

**Pros:** Simplest to write; no queue.
**Cons:** A whole run of videos easily exceeds function max duration; a single crash or
timeout loses the entire batch; no natural retry; one bad video fails everything.

### Option B: Queue-driven per-ad serverless on Vercel (CHOSEN)
Fan out to one short invocation per ad via a managed queue.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Free at MVP volume (QStash free tier; Vercel Hobby) |
| Scalability | Good (per-ad parallelism, retries, backpressure) |
| Team familiarity | High (still one Next.js codebase) |

**Pros:** Each unit is small and well under any timeout; retries and isolation come from
the queue; no separate server; stays free; scales naturally if volume grows.
**Cons:** Adds one managed dependency (QStash) and the concept of a job/queue; slightly
more code than Option A.

### Option C: Dedicated worker service (Railway/Render/Fly) + queue
Run a standalone Node worker for the heavy pipeline.

| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Cost | ~$5-7/mo minimum (or free tier that sleeps) |
| Scalability | Excellent |
| Team familiarity | Lower (second deploy, second runtime to manage) |

**Pros:** No serverless timeout worries; ffmpeg and long jobs are natural; best for scale.
**Cons:** A second deployment surface and bill; contradicts the low-ops, one-codebase
priority. Overkill for a handful of users.

### Option D: Avoid ffmpeg — thumbnail + transcript only
Drop multi-frame extraction; analyze the scraper's thumbnail image + ElevenLabs transcript.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Cost | Free (no ffmpeg/worker) |
| Scalability | Good |
| Team familiarity | High |

**Pros:** No native binary, no worker, fully managed; could even run inline.
**Cons:** Not the "full video analysis" the owner explicitly chose; misses mid-roll
visuals (demo, CTA card) that a single thumbnail cannot capture.

## Trade-off Analysis

The core tension is **owner intent (full video, multi-frame)** vs **low-ops/free**.
Option D is cheapest but was explicitly rejected by the owner. Option C fully satisfies
the pipeline but violates the one-codebase, low-ops priority and adds a bill. Option A is
simplest but its all-or-nothing failure mode is unacceptable for a paid external pipeline
where one malformed video would sink a whole run.

Option B threads the needle: by making the unit of work **a single ad**, the heavy parts
(one short video, a few frames, one transcript) comfortably fit one serverless invocation,
so we keep Vercel's free tier and one codebase while gaining retries and per-ad isolation
from a managed queue. It preserves full video analysis without a standalone server.

## Consequences

- **Easier:** stays one codebase/one deploy; failures isolated per ad; retries free;
  progress is a simple `jobs` row the UI polls; scales without redesign.
- **Harder:** introduces a queue (QStash) and job orchestration; ffmpeg must be bundled
  and validated in the Vercel Node runtime; the pipeline is now multi-step (more surface
  to test).
- **Revisit when:** video volume per run grows large, per-ad runtime approaches the
  function limit, or concurrency rises — at which point promote the same per-ad handler
  into a dedicated worker (Option C) with no change to the queue contract.

## Open items to validate during implementation

1. Confirm the Apify scraper output includes a usable **video file URL** (not only a
   thumbnail). If it returns only thumbnails, add a resolve step or fall back to Option D
   for frames while keeping the ElevenLabs transcript.
2. Verify `ffmpeg-static` runs in the Vercel Node runtime and the bundled size stays under
   the function limit.
3. Confirm current Vercel Hobby function **max duration** covers one-video processing; if
   marginal, shorten per-ad work (fewer frames) before considering Pro.

## Action Items

1. [ ] Add `jobs` table + status enum to the schema (migration `0002`).
2. [ ] Add QStash (or equivalent managed queue) env vars and a signed-request verifier.
3. [ ] Build `/api/ingest/start` (scrape + enqueue per-ad messages).
4. [ ] Build `/api/ingest/process-ad` (single-ad pipeline: vision, video frames, transcript, triples).
5. [ ] Build `/api/ingest/finalize` (generate test plan, mark job done).
6. [ ] Bundle `ffmpeg-static`; add a 1-video runnable check.
7. [ ] Validate the three open items above before wiring the UI.
