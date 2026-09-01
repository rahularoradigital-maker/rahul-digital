# Phase 0 — Discovery Audit Plan (finite, finish-lined)

Per the Master Charter (§155-§158): produce the 20 discovery deliverables BEFORE any feature coding.
This plan turns that into finite batches with explicit finish lines, and reuses existing docs instead
of duplicating them. No production code changes in Phase 0. Status legend: [ ] not started · [~] in
progress · [x] done + committed.

STOP CONDITION for Phase 0: all 20 deliverables exist, each committed, each ending in an honest
"what we do NOT yet know" section. Then Rahul reviews and greenlights Phase 1 (Correctness).

## Reuse map (extend these, do not recreate)
- Architecture map (#2) -> extend `docs/ARCHITECTURE.md`
- Formula inventory (#5) -> extend `docs/FORMULA-RIGOR-AUDIT.md`
- Security/data/AI risks (#10-#13) -> extend `docs/production-readiness.md`
- Change-impact/competitor philosophy -> `docs/COMPETITOR-INTELLIGENCE-ARCHITECTURE.md`, `ai-audit-architecture.md`
- Regression lessons -> `REGRESSION-LOG.md` (create if missing)

## Batches (each is one finish-lined unit of work)

### Batch A — Maps (deliverables 1, 2, 3, 4)  [ ]
Read the whole repo (routes, lib calc engines, ingestion/sync, AI routing, migrations, checks, deploy
config). Produce/extend: `SYSTEM-MAP.md` (source->ingestion->db->normalization->calc->decision->AI->UI
->action->outcome + failure paths/caches/queues/cron/APIs/auth/RLS/tenancy), data-flow map,
`BUSINESS-LOGIC.md`. Finish line: a reader can trace any user-visible number back to its source table
and formula. Reconcile docs-vs-code as MATCH/DRIFT/UNKNOWN (§8) inline.

### Batch B — Inventories (deliverables 5, 6, 7, 8)  [ ]
Formula inventory (extend FORMULA-RIGOR-AUDIT.md), decision inventory (every recommendation -> rule ID,
§11), failure-mode inventory, tech-debt inventory. Finish line: every deterministic calc and every
recommendation in the app has a row with source/formula/assumptions/confidence/known-failure.

### Batch C — Risk registers (deliverables 9, 10, 11, 12, 13, 14, 15, 16)  [ ]
Performance bottlenecks, security, data-quality, AI, creative-intelligence, tenancy, scale, SEO/public
-site risks. Extend production-readiness.md. Finish line: each risk has impact + likelihood + evidence
(file:line or live observation) + proposed P-level, no hand-waving.

### Batch D — 500-logic discovery (deliverables 17, 18)  [ ]
`500-LOGIC-INVENTORY.md`: >=500 CANDIDATE rules across the ~70 charter domains, each a Logic Card (§17)
with EVIDENCE LEVEL A/B/C/D (§15) and function type (§16). Then the prioritization matrix (§101):
(Impact x Frequency x Confidence x Actionability x Learning) / Cost -> BUILD NOW/NEXT/SHADOW/RESEARCH/
DEFER/REJECT. Finish line: >=500 candidates catalogued (NOT built) + a ranked shortlist. Research is
classified by source tier (§14); T4/T5 never promoted to hard rules.

### Batch E — Plans (deliverables 19, 20)  [ ]
Proposed phase plan (Phases 1-7 with §157 finish lines) + release/verification plan (§134 gate). Finish
line: Rahul can greenlight Phase 1 with a clear scope and stop condition.

## Master libraries (§102-§106), seeded during the batches
`DECISION-LIBRARY.md` · `FORMULA-LIBRARY.md` · `SIGNAL-LIBRARY.md` · `RECOMMENDATION-LIBRARY.md` ·
`UNKNOWN-LIBRARY.md`. These accrete as Batches A-D produce content; they are not separate work.

## Honest scope note
This is a multi-session program, not a one-turn output. A real "read the ENTIRE repository" audit
(§7) of an app this size is large; producing shallow versions of all 20 in one pass would violate the
charter's own "do not hide unfinished work" and "finite plans" rules. Execution approach is Rahul's
call (start highest-impact batch now / run a multi-agent workflow to parallelise the full read /
proceed batch-by-batch across turns).
