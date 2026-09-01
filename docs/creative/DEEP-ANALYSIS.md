# Deep creative analysis (video motion) - how it works, limits, and cost

A free-plan trial that reads the top-spending creatives in DEPTH: real video **motion** for videos (not just
the cover frame), full image read for images. Built to be honest and cost-safe.

## What it does
- Selects the account's **top 10 ads by spend** over the last 90 days (`listTopSpendingAds`, spend-descending).
- For each **video**: fetches the playable `source` from Meta (`GET /{video_id}?fields=source`), inlines it
  to Gemini, and reads what CHANGES across the video (hook, sequence, pace) plus scene / setting / palette /
  mood / subject. For each **image**: reads the real asset.
- Shows the user **exactly which creatives were used** (name, format, spend) + the read + a video "Motion:"
  line, and a deterministic synthesis ("what your top spenders look like") + a fragility "test next" nudge.
- **Upgrades the shared Creative DNA cache** (`creative_semantics`) with the richer read, so the normal DNA
  view reflects it going forward. The shallow cover-frame pass skips content hashes that already have a
  visual read, so a deep read is never overwritten by a later shallow one.

## Guardrails (why it is cost-safe)
- **One free run per user**, **max 10 creatives**, top spenders only. The entitlement is
  **server-authoritative** - one `deep_analysis_run` row per run - so it cannot be looped from the browser.
- Videos over **18 MB** are skipped (Gemini inline limit) and fall back to the cover-frame read.
- Every read degrades to `null` on failure and is recorded as **"could not read"** - never fabricated.
- Tenant-safe: `readToken(account, user)` only returns a token for an account the user owns.

## Data model (migration 0028, applied to prod)
- `deep_analysis_run` (id, user_id, account_external_id, created_at, creatives_analyzed, plan) - one per run.
- `deep_creative_read` (user_id, content_hash PK, ad_id, ad_name, format, spend_rs, scene/setting/palette/
  visual_mood/content_subject, motion_summary, model) - the manifest, reused (fingerprint-once).

## Files
- `lib/creative/deep-decode.ts` - fetch video source + inline to Gemini (I/O).
- `lib/creative/deep-analysis.ts` - orchestration + entitlement + selection + storage (server-only).
- `lib/creative/deep-analysis-pure.ts` - pure logic (read validity, video-only motion, entitlement,
  manifest mapping, synthesis, nudge, text export) - exercised by `scripts/check-deep-analysis.ts`.
- `app/api/creative/deep-analysis/route.ts` - GET status / POST run (auth-gated).
- `components/app/creative/deep-analysis-card.tsx` - the UI (Creative -> Diversity tab).

## Honest limits (what it does NOT do yet)
- The normal (non-deep) Creative DNA still reads only **image cover frames** for videos - deep motion is
  the trial's job, not the default pipeline.
- Uses the **free-tier Gemini** model already wired; the vision model is quota-constrained, which is exactly
  why this is bounded to 10-once. A paid tier + a per-tenant video budget would let it run on more creatives.
- Cost is tracked via `recordSpend`/`ai_usage`; there is no per-tenant VIDEO budget cap yet (the 10-once
  bound is the control). Add one before opening this beyond the free trial.
- The Meta `source` URL can expire / be unavailable; those creatives are marked "could not read".

## Cost note
One run = at most 10 Gemini calls (some video, some image), once per free user. Video tokens cost more than
image tokens, so a run is materially more than a normal decode - the 10-once bound keeps it small. Watch
`ai_usage` after the first real runs before widening the limit.
