# AdBrain 10x Program — division across the parallel chats

_Rahul asked all chats to "fix all 10" of the 10x levers together. This is the proposed division by LANE
(not session name — sessions rotate). Grab an item in your lane, claim it in `.claude/WIP.md`, follow the
multi-chat protocol (new files / no hot-file clobber / safe staging). Update the Status here when you take one._

| # | Lever | Suggested lane | Status |
|---|---|---|---|
| 1 | **Self-proving accuracy** — AdBrain-vs-Meta reconciliation + drift alarms (§6/§93) | pure engine = intelligence; **the two-path wiring = 25 (data-layer)** | 🟢 END-TO-END: `GET /api/account/verify` (25) diffs the stored rollup (our store) vs a FRESH live Meta pull (`fetchScopeInsights`) via the reconcile engine → match/drift/conflict + trustworthy; logged to `account_verifications` (migration 0037) as a TREND (clean-streak); latest verdict surfaced on `/api/account/summary.trust` (no Meta call) and conflicts on `/api/health`. Fails honest (502, no verdict) when Meta is unreachable. |
| 2 | **Close the learning loop** — recommendation→action→outcome→was-it-right (§111/§112) | **intelligence (me)** | 🟢 WIRED END-TO-END: core (`outcome.ts`) + `predict.ts` (contract→prediction) + `grade-store.ts` (pure grader) + **`POST /api/intelligence/grade` (3c273ad)** — grades ripe (≥7d) predictions vs current cockpit ROAS, writes the audit Outcome shape into the empty `decision_triples.outcome`, returns live hit-rate + false-pos/neg. NO migration. Needs a schedule (cron) to accumulate + live verification. |
| 3 | **Contribution economics via Shopify** (§61) | integrations lane | 🔴 needs Rahul's Shopify token; new adapter |
| 4 | **AI Critic to production** (§53) | **intelligence (me)** | 🟢 SHADOW-MERGED to prod (974e902): 3 critic files, dormant (nothing calls critique() yet). Validate on real verdicts → then wire. |
| 5 | **Instant app** — background precompute + materialized rollups | **25 (data-layer)** | 🟢 slices 1+2 DONE: `account_rollups` (migration 0035, applied live) + `lib/rollups/{account,pure}.ts` compute-on-sync (reuses `computeScopes`, identical math) + reconcile reads one row with self-heal fallback + populate hooks on ingest/run & cron/sync (on res.complete) + `GET /api/account/summary` instant headline (unblocks 46's onboarding sub-minute poll). Verified live: whole-account 90d = 11.96M spend / 45.76M rev / 3.83 ROAS over 1018 ads. NOW ALSO: creative rollups (`creative_rollups` 0036) w/ own-average winner/wasting flag + `GET /api/account/creatives?flag=`; `/api/account/summary?verify=1` staleness self-check; `GET/POST` admin backfill (`/api/admin/rollups`) + `/api/cron/rollups`; health rollup coverage; `check:rollups`/`check:creative-rollups`/`check:rollup-wiring` in check:all. Remaining: wire the rollup into the cockpit first-paint (golden-guarded). |
| 6 | **Daily decision brief** — one ranked "today: 3 things to fix" view + email | **intelligence (me)** | 🟢 DONE: aggregator (me) + in-app today-card LIVE (58) + digest generator (me, 6fe6b26). Only the email SEND is gated on Rahul's email provider. |
| 7 | **Creative Studio that makes usable ads** | studio lane | 🟡 owned by studio lane (71); still needs Rahul to confirm OpenAI renders a real product |
| 8 | **Time-to-first-insight < 2 min** — frictionless onboarding | onboarding lane | 🟢 46: slices 1+2 shipped — stage machine (`lib/onboarding/stage.ts`) + `/api/onboarding/status` + `first-run-progress.tsx` island (turns the silent "Still syncing" screen into guided progress that auto-advances when data lands; 4bc8b26). + design audit (fb). Remaining friction: account multi-select at connect + sub-minute cold-pull (needs data-layer/#5 rollups). |
| 9 | **Scout → real distribution + attribution** | growth lane | 🟠 needs Rahul to pick a publish channel |
| 10 | **Inspectable confidence on every number** (§122) | **intelligence (me)** | 🟡 me (logic) + fb folds 'confidence surface' into the design system |

**Intelligence (me) owns: #2, #6, #10, and the pure engine of #1.** The rest are routed to their lanes; #3/#7/#9
need Rahul's inputs. Reconcile drift, learning outcomes, and the AI Critic are the moat — do those first.

## Cross-lane asks (unblock other lanes)
- **deep-analysis lane:** expose a small read of the Creative-DNA distribution (funnel/scene/mood share per brand) so Studio's `findAngleGaps` can wire the Concepts diversity banner (71).
- **data-layer lane (#1/#5):** provide a per-product Meta ROAS+fatigue join `{productId,bestRoas,fatiguing,spendRs}`; Studio's recommendations route has the seam ready, and it's the same join #1 reconcile + #5 rollups need (71).
