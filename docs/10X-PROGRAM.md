# AdBrain 10x Program — division across the parallel chats

_Rahul asked all chats to "fix all 10" of the 10x levers together. This is the proposed division by LANE
(not session name — sessions rotate). Grab an item in your lane, claim it in `.claude/WIP.md`, follow the
multi-chat protocol (new files / no hot-file clobber / safe staging). Update the Status here when you take one._

| # | Lever | Suggested lane | Status |
|---|---|---|---|
| 1 | **Self-proving accuracy** — AdBrain-vs-Meta reconciliation + drift alarms (§6/§93) | data-layer lane owns the two independent paths; **intelligence (5a/f3) owns the pure diff+drift engine** | 🟢 pure engine DONE (`lib/intelligence/reconcile.ts`, b837666); data-layer wires the second path next |
| 2 | **Close the learning loop** — recommendation→action→outcome→was-it-right (§111/§112) | **intelligence (me)** | 🟢 core DONE (`lib/intelligence/outcome.ts`, 477ff84; @46's rigor adopted). Persistence = fill EXISTING decision_triples.outcome (NO migration). Writer+observer next. |
| 3 | **Contribution economics via Shopify** (§61) | integrations lane | 🔴 needs Rahul's Shopify token; new adapter |
| 4 | **AI Critic to production** (§53) | whoever owns `feat/ai-critic` | 🔴 open — merge feat/ai-critic |
| 5 | **Instant app** — background precompute + materialized rollups | data-layer lane | 🔴 rollup tables on sync; read from rollups |
| 6 | **Daily decision brief** — one ranked "today: 3 things to fix" view + email | **intelligence (me)** | 🟢 DONE: aggregator (me) + in-app today-card LIVE (58) + digest generator (me, 6fe6b26). Only the email SEND is gated on Rahul's email provider. |
| 7 | **Creative Studio that makes usable ads** | studio lane | 🟡 owned by studio lane (71); still needs Rahul to confirm OpenAI renders a real product |
| 8 | **Time-to-first-insight < 2 min** — frictionless onboarding | onboarding lane | 🟡 46: slice 1 shipped — first-run stage machine (`lib/onboarding/stage.ts`) + `/api/onboarding/status` (names the silent post-setup "syncing" gap). Next: client progress island + 1-line mount in page.tsx (coord b6). + design audit (fb) |
| 9 | **Scout → real distribution + attribution** | growth lane | 🟠 needs Rahul to pick a publish channel |
| 10 | **Inspectable confidence on every number** (§122) | **intelligence (me)** | 🟡 me (logic) + fb folds 'confidence surface' into the design system |

**Intelligence (me) owns: #2, #6, #10, and the pure engine of #1.** The rest are routed to their lanes; #3/#7/#9
need Rahul's inputs. Reconcile drift, learning outcomes, and the AI Critic are the moat — do those first.

## Cross-lane asks (unblock other lanes)
- **deep-analysis lane:** expose a small read of the Creative-DNA distribution (funnel/scene/mood share per brand) so Studio's `findAngleGaps` can wire the Concepts diversity banner (71).
- **data-layer lane (#1/#5):** provide a per-product Meta ROAS+fatigue join `{productId,bestRoas,fatiguing,spendRs}`; Studio's recommendations route has the seam ready, and it's the same join #1 reconcile + #5 rollups need (71).
