# Parallel development — how to run 3-4 chats at once without breaking the app

**The problem this solves:** two chats editing the same folder on the same branch overwrite each other
(you saw `package.json` change mid-edit). The fix: each chat gets its **own folder (a git "worktree") on
its own branch ("lane")**. Chats never touch each other's files; when a lane is done, it **merges** into
the shared integration branch. Git combines changes to *different* files automatically.

## The model (one integration branch + short-lived lanes)

- **`validation-v0-v1`** is the **integration branch**. It is the source of truth. **No chat edits it
  directly** — everything merges into it.
- Each feature area is a **lane** = a branch `lane/<name>` in its own folder under
  `/Users/lyxelflamingo/adbrain-worktrees/<name>`.
- A chat opens in a lane folder, builds + verifies there, commits to its lane branch.
- **I (or the integration chat) merge lanes into `validation-v0-v1` one at a time, running the full gate
  (`npm run build` + `npm run check:all`) after each.** A broken lane never reaches the app.

## The lanes and who owns which files (this is what prevents conflicts)

Conflicts only happen when two chats edit the **same lines of the same file**. Keep each chat inside its
own files and merges stay clean.

| Lane (folder) | Owns these files | Purpose |
|---|---|---|
| **ingestion** | `lib/ingest/*`, `lib/meta-source.ts`, `lib/meta-sync.ts`, `lib/app/cockpit-data.ts`, `app/api/ingest/*`, `app/api/cron/*` | The day-wise data pipeline + Stage 2b (app reads the store) |
| **shopify** | `lib/creative-production/*`, `app/api/creative-production/*` | Shopify → concepts → AI static-ad Studio |
| **competitors** | `lib/competitors/*`, `lib/creative/*`, `components/app/market/*`, `app/api/brand/*`, `app/api/competitors/*`, `app/api/market/*` | Competitors, ICP, content pillars, brand |
| **scoring** | `lib/scoring/*`, `lib/rules/*`, `lib/cockpit/*`, `components/cockpit/*`, `components/app/media/*`, `components/app/analytics/*` | Ranking, verdicts, cockpit + KPI screens |

**Shared files (edit sparingly, expect tiny conflicts):** `package.json` (the check list), `components/app/topbar.tsx`, `docs/*`, and the DB migrations. When two lanes must both touch one of these, do it in **one** lane and tell the others.

## The rules that keep this from becoming a future mess (❌ if broken)

1. **No chat works directly on `validation-v0-v1`.** Always a lane. ❌ Direct edits = the original problem returns.
2. **Merge lanes back FREQUENTLY** (at least daily). ❌ A lane left for weeks drifts far from the others and becomes a painful merge.
3. **Gate green before merge:** `npm run build` + `npm run check:all` must pass on the lane. ❌ Merging red poisons everyone.
4. **Stay in your lane's files.** If you must touch another lane's file, say so in the chat so we sequence it.
5. **One merger.** I merge lanes in order + run the gate, so nobody merges over a half-finished lane.
6. **Clean up finished lanes** with `git worktree remove <folder>` + delete the branch. ❌ Stale worktrees pile up.

## How to use (per chat)

Open a Claude Code chat **inside the lane's folder**, e.g. `/Users/lyxelflamingo/adbrain-worktrees/competitors`,
and tell it what to build. It only sees + edits its own lane. It builds/verifies there. When done, tell me
"merge the competitors lane" and I run the gate + merge into `validation-v0-v1`.

Each lane folder has **its own `node_modules`** (installed once with `npm ci`; ~1GB per lane — Next 16's
Turbopack rejects a shared/symlinked `node_modules`, so it must be real). `.env.local` is linked from the
main project so secrets are shared. After a lane pulls dependency changes, re-run `npm ci` in that folder.
