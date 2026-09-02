# The AdScale Intelligence Layer — map

_One place that lists everything in `lib/intelligence/` and how the pieces connect. All files are pure +
gated (a `check:*` each) unless noted; the surfaces that render them are named. The design law is the Output
Contract (§110): every decision walks DATA→TRUST→…→LEARNING or HOLDs honestly._

## Core
| File | Does | Gate |
|---|---|---|
| `output-contract.ts` | The typed contract + `hold()`/`decide()`/`validateOutput()` law (a decision needs ₹ impact + 2nd-order + what-could-be-wrong; never jump DATA→DECISION). | `check:output-contract`, `check:contract-invariants` |
| `collect.ts` | `collectDecisions(data)` → the whole decision picture: per-ad `priorities` (ranked by ₹) + account `accountReads`, each **critic-capped**. | `check:collect` |
| `digest.ts` | `buildDigest()`/`digestSubject()` → the daily brief as text (email/share). | `check:digest` |

## Engine adapters (engine output → contract)
`from-culprit` (money-bleed) · `from-fatigue` · `from-funnel` · `from-winner` (§37 taxonomy) · `from-diversity`
(§36 fragility) · `from-marginal` (§47 scaling). Each is a new file that never edits its engine; each has a
`check:*-contract`. Rendered on: CulpritBanner, ranked plan (ActionList), funnel cards, Leaderboard, diversity
card, budget "Scaling headroom".

## The critic (§53-56)
| File | Does | Gate |
|---|---|---|
| `critic-review.ts` | Deterministic, always-on: caps a decision's confidence to its evidence tier (§56); only ever lowers. Applied inside `collect`. | `check:critic-review` |
| `critic-escalate.ts` | Cost-budgeted planner: spends the AI critic (`lib/judgment/critic.ts`) only on high-stakes, upheld, confident decisions, ranked by ₹, within a call budget (§70). | `check:critic-escalate` |

## The moat (accuracy + learning)
| File | Does | Gate |
|---|---|---|
| `reconcile.ts` | Two independent values for a metric → match / minor-drift / **conflict** + confidence penalty (§6/§93). Second path = the data-layer's `account_rollups` (25) vs a live pull. | `check:reconcile` |
| `outcome.ts` | Learning loop: grade a prediction vs what the metric actually did → hit-rate + false-pos/neg. Grades only keep-spending calls; withholds below MIN_SAMPLE. Persistence = the EXISTING `decision_triples.outcome`. | `check:outcome` |
| `predict.ts` | Bridge: a decided contract → a `Prediction` for the learning loop to grade later. | `check:predict` |
| `system-trust.ts` | Reconciliation + decision accuracy + critic activity → one honest `trusted/watch/shaky` read (a data conflict caps it at shaky). | `check:system-trust` |

## Growth
`lib/growth/attribution-readback.ts` → which Scout content actually drove signups (medium=scout only; never
over-claims organic). `check:attribution-readback`.

## Serving
`app/api/intelligence/today` (GET) → the daily brief (subject + markdown + counts) for the signed-in account,
via `loadCockpit` (own-tenant scope only).

## Still to wire (deployed but latent)
- `outcome`/`predict`: an outcome-writer that records predictions + fills `decision_triples.outcome`, then an
  observer that runs `accuracyStats`. (touches the audit table + a metric read)
- `reconcile`: the drift alarm — 25 feeds rollup-vs-live into `reconcile()` on a headline read.
- `attribution-readback`: the auth flow capturing `utm_*` on signup.
- `critic-escalate`: the AI-call seam + a per-run cost budget before the AI critic goes active.
