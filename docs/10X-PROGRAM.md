# AdBrain 10x Program — division across the parallel chats

_Rahul asked all chats to "fix all 10" of the 10x levers together. This is the proposed division by LANE
(not session name — sessions rotate). Grab an item in your lane, claim it in `.claude/WIP.md`, follow the
multi-chat protocol (new files / no hot-file clobber / safe staging). Update the Status here when you take one._

| # | Lever | Suggested lane | Status |
|---|---|---|---|
| 1 | **Self-proving accuracy** — AdBrain-vs-Meta reconciliation + drift alarms (§6/§93) | data-layer lane owns the two independent paths; **intelligence (5a/f3) owns the pure diff+drift engine** | intelligence building the pure `lib/intelligence/reconcile.ts` engine; data-layer wires the second path |
| 2 | **Close the learning loop** — recommendation→action→outcome→was-it-right (§111/§112) | **intelligence (me)** | 🟡 IN PROGRESS — pure `lib/intelligence/outcome.ts` evaluator now; persistence = a gated migration (needs Rahul) |
| 3 | **Contribution economics via Shopify** (§61) | integrations lane | 🔴 needs Rahul's Shopify token; new adapter |
| 4 | **AI Critic to production** (§53) | whoever owns `feat/ai-critic` | 🔴 merge + shadow-test + promote |
| 5 | **Instant app** — background precompute + materialized rollups | data-layer lane | 🔴 rollup tables on sync; read from rollups |
| 6 | **Daily decision brief** — one ranked "today: 3 things to fix" view + email | **intelligence (me)** | 🟡 aggregator `collectDecisions` done; a "Today/Priorities" view next |
| 7 | **Creative Studio that makes usable ads** | studio lane | 🟠 needs Rahul to confirm OpenAI image gen works on a real product |
| 8 | **Time-to-first-insight < 2 min** — frictionless onboarding | onboarding lane | 🔴 account multi-select + sync friction + guided first-run |
| 9 | **Scout → real distribution + attribution** | growth lane | 🟠 needs Rahul to pick a publish channel |
| 10 | **Inspectable confidence on every number** (§122) | **intelligence (me)** | 🔴 extend the ReasoningTrace pattern to KPI tiles |

**Intelligence (me) owns: #2, #6, #10, and the pure engine of #1.** The rest are routed to their lanes; #3/#7/#9
need Rahul's inputs. Reconcile drift, learning outcomes, and the AI Critic are the moat — do those first.
