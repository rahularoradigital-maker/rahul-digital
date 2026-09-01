#!/usr/bin/env bash
# safe-push: integrate sibling sessions' pushed work BEFORE pushing your own, so concurrent chats never
# clobber each other on the shared validation-v0-v1 branch. Commit only YOUR files first, then run this.
#   usage: scripts/safe-push.sh [branch]   (default branch: validation-v0-v1)
set -euo pipefail
branch="${1:-validation-v0-v1}"

echo "safe-push: fetching origin/$branch ..."
git fetch origin "$branch"

# Rebase our local commits on top of origin's latest. --autostash safely sets aside any uncommitted changes
# in the shared working tree (a sibling's WIP) and restores them afterward, so we never rebase over dirty work.
if ! git pull --rebase --autostash origin "$branch"; then
  echo "" >&2
  echo "safe-push: STOP. A sibling changed the same lines - the rebase could not auto-merge." >&2
  echo "  Resolve by hand: 'git status', edit the conflicts to keep BOTH intents, then 'git rebase --continue'." >&2
  echo "  Do NOT 'git push --force' - that would erase the sibling's work." >&2
  exit 1
fi

# Fast-forward now (our commits sit on top of origin). Never force.
git push origin "HEAD:$branch"
echo "safe-push: done - pushed onto origin/$branch without clobbering any sibling's work."
