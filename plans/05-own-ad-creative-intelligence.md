# [plan-05] Own-Ad Creative Intelligence — wire fingerprint-once → diversity → production queue

## Defect

The competitor pipeline runs the multi-agent Gemini analysis on *competitor* creatives, but the
same intelligence is **not applied to the account's own ads**. The deterministic own-ad
fingerprint + diversity engines are built and tested, the `fetchAdCreatives` Meta pull exists, and
the `own_creative_fingerprints` cache table is created — but the Gemini semantic layer, the
fingerprint-once cache read/write, and the cockpit surface are not connected. So there is no
own-ad hook/angle/persona intel, no white-space, and no production queue.

## Symptoms

- `own_creative_fingerprints` table exists but is never written or read.
- `lib/creative/fingerprint.ts` + `lib/creative/diversity.ts` are tested but unwired to the cockpit.
- `fetchAdCreatives` (in `meta-source.ts`) is committed as scaffolding, called by nothing.
- No "produce more of X" queue, no own-creative diversity/concentration read, no white-space.

## Fix sequence

1. In `meta-sync`, call `fetchAdCreatives` for the analyzed ads → `CreativeAsset[]`.
2. Fingerprint-once: for each asset's `contentHash` not in `own_creative_fingerprints`, run
   `analyzeCreative` (reuse the competitor agents) and upsert; else reuse cached attributes.
   Cost is per NEW creative, not per run.
3. Map attributes → `CreativeRecord[]`, run `assessDiversity`, surface a "Creative DNA" cockpit
   card: format/angle/persona mix, concentration, white-space, and the production queue.
4. Cap new-Gemini-per-run (e.g. 15) so a first run on a large account does not spike cost;
   `log`/label what was deferred to the next run.

## Test matrix

| Run | New creatives | Cached creatives | Gemini calls | Card |
|---|---|---|---|---|
| first (cold) | ≤ cap analyzed | 0 | ≤ cap | partial coverage, honestly labeled |
| steady | only changed | reused from hash | ~0 | full diversity + production queue |

## Out of scope

Video DNA (frame-level) and landing-page intelligence — separate tracks once still-image
fingerprinting is proven and revenue (plan-04) grounds the "which to produce" ranking.
