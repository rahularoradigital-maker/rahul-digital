# docs/ — where to look (canonical index)

New engineer? Read these, in order. Everything else in `docs/` is historical or topic-specific detail.

## Start here (canonical)
- **`MASTER-ARCHITECTURE-AUDIT-2026-09-03.md`** — the current architecture + product audit (system map, data flow, security, performance, the 10X workflow matrix, target architecture, phased roadmap, scorecard, and the phase-by-phase execution log). **This is the canonical audit.**
- **`../CHANGELOG.md`** (repo root) — what changed, newest first, with commit hashes.
- **`DECISIONS.md`** — the architectural decision log (why things are the way they are). `D-audit-*`, `D-rollups`, `D-verify` cover the recent instant-app + self-proving work.
- **`TECH-HANDOFF.md`** — one-page "what is this product, what's built, what's left, where we need judgment."
- **`../.claude/MULTI-CHAT-PROTOCOL.md`** + **`../.claude/WIP.md`** — several Claude sessions work in this tree at once; claim hot files before editing.

## How the gate works (read before pushing)
- `npm run check` — the FAST parallel gate (`scripts/run-checks.mjs`): runs every `scripts/check-*.ts` correctness assertion in ~2s. It is the same set as `check:all` (the serial chain, kept as a fallback). CI (`.github/workflows/ci.yml`) runs `tsc` → `build` → `npm run check` on every push. **Red must never reach the branch.**
- Golden invariants: `check:golden` + `check:shadow-benchmark` are the contract for the scoring money-path — any refactor there must be output-identical.

## Topic detail (read when working in that area)
- `10X-PROGRAM.md` — the cross-session "10x levers" division + status.
- `system-design.md`, `ADR-SCALE-CEILINGS.md`, `production-readiness.md` — scale/infra (note: the product is pre-launch; scale work is deliberately deferred — see the master audit §0).
- `intelligence/*` — the §110 Output Contract + decision-chain design.
- `CREATIVE-STUDIO-GUIDE.md`, `COMPETITOR-INTELLIGENCE-ARCHITECTURE.md`, etc. — per-feature detail.

## Historical (kept, not canonical)
- `PHASE-0-AUDIT-2026-09-02.md` and earlier audits — superseded by the master audit above.
