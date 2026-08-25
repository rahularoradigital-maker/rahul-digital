# Prompt Chain Spec — Brand-Run Intelligence Pipeline

The concrete assembly of `agent-roles.md` + `chain-of-thought-design.md` +
`context-engineering.md` into a buildable chain. End goal: turn a brand's ad data into the
cockpit **verdict + ranked "do this today" recommendations**, each auditable.

## Step 1 — Why not one prompt
A single prompt can't: analyze each creative (multimodal, per-ad), hold the growing knowledge
graph, keep the AI OFF the numbers (rules engine owns those), and stay verifiable. The chain
separates concerns so each step is small, cited, and independently checkable.

## Chain overview

```
per ad ─▶ [1 Deconstruct (Gemini)] ─▶ candidate triples
                                         │
                    [2 Curate (code)] ◀──┘  writes/dedups triples in the graph
                                         │
        ad_metrics ─▶ [3 Rules (code)] ─▶ fatigue/waste/roas/money numbers (authoritative)
                                         │
   graph query + rules numbers ─▶ [4 Strategize (Gemini, branching)] ─▶ verdict + recs
                                         │
              per rec ─▶ [5 Explain (Gemini, no-chain)] ─▶ drawer rows (on demand)
                                         │
            every AI output ─▶ [6 Validate (Gemini+code, fail-closed)] ─▶ pass | cannot_verify
```

Steps 2 and 3 are deterministic bridges (not prompts). Prompt steps: 1, 4, 5, 6.

## Prompt steps

### Step 1 — Deconstruct (linear)
- **Input:** one ad `{creative (image/video), copy}` + the fixed taxonomy.
- **Output schema:** `{attributes:{hook,angle,format,emotional_driver,claim}, triples:[{s,p,o,confidence}]}`
- **Template** (fixed text + `{{vars}}`):
  ```
  You classify ONE ad. Describe only what is present; do not judge performance
  (you have no metrics). Taxonomy: {{taxonomy}}.
  Steps (reason internally): observe -> classify -> flag anything below 0.6 confidence.
  Output ONLY this JSON: {{schema}}.
  AD COPY: {{copy}}
  CREATIVE: {{creative}}
  ```
- **Constraints:** no performance claims; mark low confidence; JSON only.
- **Example:** copy "7 days on one charge" + earbuds image →
  `{attributes:{hook:"spec-claim",format:"static",emotional_driver:"reliability",...},
  triples:[{s:"ad_42",p:"uses_hook",o:"spec-claim",confidence:0.9},
  {s:"spec-claim",p:"format",o:"static",confidence:0.8}]}`
- **Budget:** image ad ~1-2k tokens; video ad ~5-10k (native video).

### Step 4 — Strategize (branching)
- **Input:** brand profile + retrieved triples (top-K) + rules numbers for top-N ads.
- **Output schema:** `{verdict:string, recommendations:[{kind,outcome,rationale,money_impact,confidence,evidence_triple_ids}]}`
- **Template:**
  ```
  You are AdBrain's strategist. Rules: narrate, never compute. Copy money_impact
  verbatim from the provided numbers. If a needed number is missing, output
  insufficient_data. Cite evidence_triple_ids for every recommendation.
  BRAND: {{brand_profile}}
  EVIDENCE (triples): {{triples}}
  --- AUTHORITATIVE NUMBERS (copy these) ---
  {{rules_numbers}}
  TASK: write a one-sentence verdict, then rank the moves. Reason internally.
  Output ONLY: {{schema}}
  ```
  (Note: authoritative numbers sit adjacent to the task, per context-engineering.)
- **Constraints:** money_impact must equal a provided value; every rec cites >=1 triple;
  verdict is one plain sentence, no jargon; no em dashes.
- **Example:** rules say `{ad_42: {fatigue:0.88, waste_rs:182000, action_hint:"stop"}}` →
  `{verdict:"Scale 2 winners, stop 3 dying ads, shoot 3 concepts.",
  recommendations:[{kind:"stop",outcome:"Turn off ad_42, past half life",
  money_impact:182000,confidence:"high",evidence_triple_ids:["t_991"]}]}`
- **Budget:** ~4-5k tokens (triples + numbers + output).

### Step 5 — Explain (no chain)
- **Input:** one number `{value, source, formula, inputs}`.
- **Output schema:** `{rows:[{label,value}]}` (source, formula, logic, example, next step).
- **Template:**
  ```
  Restate the provided facts in plain language for a drawer. Introduce NO new number.
  If a field is missing, its row value is "source unavailable".
  DATA: {{number_data}}. Output ONLY: {{schema}}
  ```
- **Budget:** <1k tokens.

### Step 6 — Validate (debate, fail-closed)
- **Input:** an AI output + the evidence it cites + the authoritative numbers.
- **Output schema:** `{verdict:"pass"|"cannot_verify", reasons:[string]}`
- **Template:**
  ```
  Argue both sides: is every figure traceable to a provided number, and does every
  claim cite a real triple id present in EVIDENCE? Then decide. On any doubt or
  missing trace, return cannot_verify.
  OUTPUT UNDER TEST: {{item}} EVIDENCE: {{evidence}} NUMBERS: {{numbers}}
  Return ONLY: {{schema}}
  ```
- **Also (code):** byte-match every output number against `{{numbers}}`; a mismatch is an
  automatic `cannot_verify` regardless of the model's opinion.
- **Budget:** ~0.5-1k tokens.

## Templates: fixed vs variable
Fixed (cache as prefix): role text, guardrails, taxonomy, output schemas.
Variable (per call): `{{copy}}`, `{{creative}}`, `{{brand_profile}}`, `{{triples}}`,
`{{rules_numbers}}`, `{{number_data}}`, `{{item}}`, `{{evidence}}`.
Output of step 1 (`triples`) → curated → becomes `{{triples}}` input to step 4 via the graph
query. Output of step 3 (`rules_numbers`) → `{{rules_numbers}}` in step 4 and `{{numbers}}`
in step 6. Output of step 4 (each rec's number) → `{{number_data}}` in step 5.

## Context flow (DB-mediated, not raw text hand-off)
Steps hand off through Postgres (triples, ad_metrics), not by pasting prior prompt text. So:
- Step 1 → 2: candidate triples written to the graph (deduped by Curator).
- Step 4 pulls context via the retrieval query (context-engineering): triples about the ads in
  scope + top-K niche winners/losers, capped at K, plus the rules numbers.
- Nothing carries the full conversation; each step gets a fresh, selected context. Stable prefix
  cached across the many step-1 calls.

## Worked example (end to end)
1. Ad_42 (earbuds, "past half life") → Deconstruct → triples `t_991: ad_42 uses_hook spec-claim (0.9)`.
2. Curator writes t_991.
3. Rules: ad_42 fatigue 0.88, waste Rs 1,82,000, hint "stop".
4. Strategist retrieves t_991 + the numbers → rec: stop ad_42, money_impact 182000 (copied),
   cites t_991, verdict sentence.
5. Explainer turns {value:182000, source:"ad_metrics", formula:"daily_spend x days_past_halflife"}
   into drawer rows.
6. Validator: 182000 matches the provided number, t_991 exists → pass.

## Failure handling / quality gates

| Between | Gate | On failure |
|---|---|---|
| after step 1 | schema valid? | retry once stricter, then skip that ad (isolated) |
| step 1 → 4 | any triples at all? | thin graph → verdict "insufficient data yet" (empty state) |
| after step 4 | schema valid + every rec cites a triple? | retry once; drop uncited recs |
| step 4 → 6 | number byte-match | mismatch → cannot_verify, item withheld |
| step 6 | pass or cannot_verify | cannot_verify items shown as "cannot verify", never dropped silently |
| any Gemini call | rate limit / error | backoff + requeue (per-item isolation); job resumes |

## Token budget (rough, per run)
- Deconstruct: ~1.5k/ad (image) — 30 ads ≈ 45k (video ads higher; prefix cached).
- Strategize: ~5k (once).
- Explain: ~1k × recs (say 6) ≈ 6k (on demand).
- Validate: ~1k × outputs ≈ 5k.
- **Total ≈ 60k tokens/run** before prefix caching; well within free-tier per-run limits,
  though free-tier RPM means the per-ad fan-out is paced (see failure-recovery rate-limit path).
