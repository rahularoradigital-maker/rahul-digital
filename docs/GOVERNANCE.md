# AdBrain Governance (deliberately tiny)

One owner (Rahul) + Claude. Governance exists to reduce friction and prevent overreach,
nothing more. If a step ever costs more than it saves, delete it.

## Decision rights (three tiers)

**Tier 0 — Claude decides and proceeds (no approval).**
Reversible work that stays inside the settled rails.
- Code structure, file layout, minimal diffs, refactors of Claude's own mess.
- Writing/updating docs, specs, ADR *drafts*, tests, runnable checks.
- Anything consistent with `docs/DECISIONS.md`, `DESIGN.md`, and its principles, with the
  build gate green.
Do it, then report. Do NOT ask permission for these.

**Tier 1 — Claude proposes, Rahul approves (one clear yes).**
Reversible-but-consequential, or steering-level.
- Product scope changes; reopening a logged decision.
- New dependency, vendor, or a real cost (e.g. a paid data tier).
- Deploying/publishing; changing account settings; a new persistent config.
- Any one-way door that is still undoable-with-effort.

**Tier 2 — Rahul only; Claude never acts, only directs.**
Irreversible, money, or credentials (the hard boundary).
- Entering credentials/keys; connecting real accounts via OAuth.
- Moving money; applying changes to a live ad account; auto-optimize.
- Deleting production data; accepting ToS/consent; sending on the owner's behalf.
Claude explains and hands off; it does not perform these.

## Forums (checkpoints, not meetings — there is one person)
- **Build gate** — `node build-check` / `npm run build` green + relevant `check:*` scripts,
  before any commit or deploy. Automated. Non-negotiable.
- **Decision log** (`docs/DECISIONS.md`) — the async steering record. Durable decisions land
  here at the moment they are made; reopening needs a status change + a reason.
- **ADRs** (`docs/adr/`) — one per architecture fork.
- **Review skills** (plan/design/eng review, audits) — on-demand quality forums, invoked when
  the stakes justify the tokens, not on a schedule.

## Decision classification (how fast, who's consulted)
Pair with the tiers above.
- **Type 2 (reversible) → move fast, delegate.** Most calls. Decide at the lowest capable level
  (usually Claude, Tier 0), disagree-and-commit, don't agonize. Speed beats perfection.
- **Type 1 (irreversible / one-way / hard-to-undo) → slow down, one named Approver, consult
  deliberately.** Money moves, brand commitment, data-model migrations, external publishing.
- **DACI, lightweight:** Driver = whoever proposes (often Claude). Approver = ONE person (Rahul
  for Tier 1/2; no committees). Contributors = review skills / ADRs where stakes warrant.
  Informed = the decision log.
- **Record + don't reopen:** log the call + rationale in DECISIONS.md; reopening needs NEW
  information, not a change of mood.

## Cadence
Event-driven, never calendar-driven.
- Build gate: every change. Decision log: at decision time. ADR: per architecture fork.
- Reviews/audits: per phase or before a ship, by judgment. No standing meetings.

## Escalation thresholds (what forces a stop-and-ask)
Escalate to Rahul (Tier 1/2) when a change touches any of:
money · credentials · external publish/send · a new vendor or cost · reopening a logged
decision · irreversible/one-way · security-sensitive · or Claude is genuinely stuck after a
reasonable attempt (Confusion Protocol). Everything below the line is Tier 0 — just do it.

## Lightness test (what we deliberately do NOT do)
No standing meetings. No sign-off committees. No RACI matrix. No status reports to an
audience of nobody. No approval for reversible in-rails work. If a governance step is not
earning its friction, this doc is wrong and should be cut.

## Review the governance itself
Re-read this when it feels heavy. Governance tends to grow; prune it.
