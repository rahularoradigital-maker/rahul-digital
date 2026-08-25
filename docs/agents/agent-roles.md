# AdBrain Intelligence Layer — Agent Roles

How AdBrain's "brains" are organized. The hard rule that shapes every role:
**the rules engine computes numbers; AI agents only narrate them; only the human
applies changes to a live ad account.** (Governs: DESIGN.md principle #2 and #6,
DECISIONS.md D12.)

Two non-agent components everything leans on:
- **Rules Engine (deterministic, NOT an agent):** pure functions over `ad_metrics`
  that compute fatigue, waste buckets, will-break forecasts, funnel grade, and the
  health score. Testable with fixtures. AI never computes these numbers.
- **Ingest Worker (deterministic pipeline step):** pulls from `AdSource` (Meta/Google)
  and ScrapeCreators, upserts `ad_metrics` / `competitor_ads`. See ADR-0002.

---

## Role cards

### 1. Orchestrator
- **Purpose:** run a brand-run end to end and assemble the cockpit.
- **Capabilities:** sequence steps (ingest → deconstruct → curate → rules → strategist/
  concept → explainer → validator → assemble); manage the `jobs` row + status; retry per-ad.
- **Knowledge scope:** the job graph and each agent's contract. Not the domain logic itself.
- **Authority:** decides ordering, retries, and when a run is done. Cannot change numbers or
  apply account changes.
- **Boundaries:** does no analysis itself; delegates everything.
- **Success:** every run reaches `done` or a clean error; no step runs out of order.

### 2. Deconstructor (Gemini)
- **Purpose:** turn one creative (image/video + copy) into structured attributes and triples.
- **Capabilities:** vision/video analysis → hook, angle, format, emotional driver, claim; emit
  candidate triples with a confidence.
- **Knowledge scope:** the single ad it is given. No cross-ad or account context.
- **Authority:** proposes triples; does not write them (the Curator does).
- **Boundaries:** one ad at a time; no ranking, no recommendations, no numbers from `ad_metrics`.
- **Success:** attributes match what a human sees in the ad; triples are specific, not generic.

### 3. Brand Brain Curator (light AI + deterministic)
- **Purpose:** the single writer to the `triples` knowledge graph.
- **Capabilities:** dedup candidate triples (unique subject/predicate/object per brand), merge
  confidence, link evidence (`source_id`), attach real results from `ad_metrics`.
- **Knowledge scope:** the whole graph for one brand.
- **Authority:** sole authority to insert/update/retire triples.
- **Boundaries:** does not deconstruct or recommend; only curates.
- **Success:** no duplicate triples; every triple cites its evidence; graph grows, not bloats.

### 4. Strategist / Verdict (Gemini)
- **Purpose:** produce the one-sentence verdict and the ranked "Do this today" recommendations.
- **Capabilities:** read the graph + Rules Engine outputs → scale/stop/continue items with
  outcome, why, money impact (from rules), and confidence.
- **Knowledge scope:** the brand's triples + all Rules Engine numbers. Read-only.
- **Authority:** propose recommendations. **No authority to change a computed number or apply
  anything to the account.**
- **Boundaries:** does not invent metrics; money/impact figures come from the Rules Engine.
- **Success:** every recommendation cites evidence triples + a rules number; verdict matches
  the queue.

### 5. Concept (Gemini)
- **Purpose:** "what to make next" — shoot-ready creative concepts.
- **Capabilities:** from winners (own account) + competitor gaps (SOV) + Brand Brain, emit
  recipes (sku/format/concept/offer/landing) with expected ROAS and source weights.
- **Knowledge scope:** graph, own winners, competitor SOV output.
- **Authority:** propose concepts; nothing is produced or published automatically.
- **Boundaries:** does not generate final assets in v1; produces the recipe/brief only.
- **Success:** each concept is specific enough to shoot and ties to a real gap or winner.

### 6. Competitor / SOV (Gemini + ScrapeCreators)
- **Purpose:** compute competitor share of voice and format gaps.
- **Capabilities:** pull competitor ads, classify formats/angles, compute SOV and the gap the
  brand is missing.
- **Knowledge scope:** competitor ads + the brand's own format mix.
- **Authority:** produce the SOV section + feed the Concept agent.
- **Boundaries:** competitor data only; does not touch own-account recommendations.
- **Success:** SOV reconciles to the pulled ads; the named gap is real and actionable.

### 7. Explainer / "Show the working" (Gemini)
- **Purpose:** turn any number or recommendation + its evidence into the drawer's
  source → formula → reason → example → next step.
- **Capabilities:** narrate provided evidence in plain language.
- **Knowledge scope:** only the evidence handed to it (rule inputs, formula, triples).
- **Authority:** none over content of the number; it explains, never decides.
- **Boundaries:** **must not introduce any figure not in the evidence.** If evidence is missing,
  it says so.
- **Success:** a skeptical user reading the drawer agrees the number is justified.

### 8. Validator / Honesty Guardrail (deterministic checks + light AI)
- **Purpose:** enforce "show the working" before anything reaches the user.
- **Capabilities:** reject any shipped number lacking source+formula+reason; verify recommendation
  figures match Rules Engine outputs; ensure forecasts are labeled estimates; block fabricated values.
- **Knowledge scope:** all agent outputs + rules outputs for the run.
- **Authority:** **veto.** Can send an item back or mark it "cannot verify" so it does not ship.
- **Boundaries:** does not rewrite content; it passes or fails it.
- **Success:** nothing ships that can't be traced; zero fabricated numbers reach the cockpit.

---

## Authority hierarchy (who can do what without a human)

```
Human (owner)   ── only actor who APPLIES changes to a live ad account (approve + confirm)
   ▲
Validator       ── can VETO any agent output (honesty gate)
   ▲
Orchestrator    ── controls ordering/retries; no domain authority
   ▲
Rules Engine    ── sole source of computed numbers
   ▲
Curator         ── sole writer to the triples graph
   ▲
Deconstructor / Strategist / Concept / SOV / Explainer  ── propose only, read-only on data
```

No agent applies changes to the ad account. Ever. (D12 / principle #6.)

## Interaction matrix (who feeds whom)

| From → To | Curator | Rules | Strategist | Concept | SOV | Explainer | Validator |
|---|---|---|---|---|---|---|---|
| Ingest Worker | — | ✓ | — | — | ✓ | — | — |
| Deconstructor | ✓ | — | — | — | — | — | — |
| Curator | — | — | ✓ | ✓ | — | ✓ | — |
| Rules Engine | — | — | ✓ | ✓ | — | ✓ | ✓ |
| SOV | — | — | — | ✓ | — | ✓ | — |
| Strategist / Concept | — | — | — | — | — | ✓ | ✓ |
| Explainer | — | — | — | — | — | — | ✓ |

## Conflict resolution rules

- **Numbers vs narrative:** if a Gemini agent's stated figure differs from the Rules Engine,
  the Rules Engine wins; the Validator flags the agent output.
- **Two agents want to write triples:** impossible by design — only the Curator writes.
- **Validator vs any agent:** Validator wins (veto). Vetoed items are re-run once, then shown as
  "cannot verify" rather than dropped silently.
- **Ordering disputes / retries:** Orchestrator decides; it never overrides a veto or a number.
- **Human vs system:** the human always wins; approve/deny/Apply is the only path to the live account.

## Design artefacts checklist
- [x] Role cards (8) — above
- [x] Authority hierarchy — above
- [x] Interaction matrix — above
- [x] Conflict resolution rules — above
