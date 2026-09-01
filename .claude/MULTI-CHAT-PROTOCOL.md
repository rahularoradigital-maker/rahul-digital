# Multi-chat coordination protocol (BINDING for every chat/session on this repo)

4-5 Claude chats work this repo at once on ONE shared working tree + ONE branch (`validation-v0-v1`).
Without discipline, chats overwrite each other's staged/uncommitted work and clobber files. These rules
prevent that. They are cheap and non-negotiable. (Rahul, 2026-09-01.)

## The one rule that prevents 90% of the damage
**NEVER `git add -A` or `git add -u`. NEVER `git commit -a`.** `git commit` commits the WHOLE index, so
any file another chat left staged rides along in your commit. Instead, every commit is:

```
git reset -q                       # drop anything another chat left staged
git add <your explicit file paths> # ONLY the files YOU changed this turn
git diff --cached --name-only      # VERIFY the staged list is exactly yours
git commit -m "..."
```
If a file you did not touch appears in the staged list, STOP and unstage it.

## Before you START editing
1. Read `.claude/WIP.md`. If a file or area you need is claimed there as WIP by another chat, do NOT edit
   it - pick different work, or message that chat (SendMessage, cross-session) and agree first.
2. Add your claim to `.claude/WIP.md` (append a row: your session name, the files/area, status WIP).
3. Prefer NEW files over editing shared hot files. The hot, contended files are:
   `lib/meta-sync.ts`, `lib/cockpit/from-store.ts`, `lib/app/cockpit-data.ts`, `lib/cockpit/analyze.ts`,
   `lib/scoring/decision.ts`, `components/app/creative-production/studio.tsx`, `app/app/page.tsx`.
   Touch these only when unavoidable, keep the diff to the minimum lines, and commit them FAST to shrink
   the window others can collide with.

## Before you COMMIT
- Stage explicitly (above). Confirm `git diff --cached --name-only` is exactly your files.
- `npx tsc --noEmit` and `npx next build` must be GREEN on the tree you are committing. If the tree is red
  on ANOTHER chat's file (not yours), your commit that excludes that file is still fine to make - say so in
  the report; do NOT try to fix their file.

## Before you PUSH (deploy)
- `git fetch` first. If the remote moved, your local commit still fast-forwards (shared tree), but confirm
  your commit's files still contain your change (another chat may have edited the same file after you read
  it). Re-grep your marker.
- The pushed HEAD must build green. If the tip is red on another chat's committed file, do NOT push over it
  blindly - flag it to Rahul / the owning chat.

## NEVER
- Never `git revert` / `git checkout -- <file>` / overwrite another chat's committed OR uncommitted work
  without checking with that chat (SendMessage) or Rahul first. If you must revert your own bad commit, do
  it as a new commit, never a force-push on the shared branch.
- Never apply a DB migration to prod for another chat's migration file.
- Never claim "done/green" on a file another chat is mid-editing - check `.claude/WIP.md` and report honestly.

## When you FINISH a unit
- Update your `.claude/WIP.md` row to DONE (or PENDING with what is left). Keep the ledger current so others
  can trust it.

## Coordinating live
Use `ListAgents` to see peers and `SendMessage` (cross-session) to coordinate a shared-file edit or a
revert. A listed peer will process your message. Do not ask a peer to do something your own permissions
blocked (permission laundering) - route that back to Rahul.
