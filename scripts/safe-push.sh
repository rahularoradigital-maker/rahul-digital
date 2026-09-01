#!/usr/bin/env bash
# safe-push: get YOUR commit onto the shared validation-v0-v1 branch without clobbering sibling sessions.
# Commit only YOUR files first (git reset -q; git add <paths>; verify git diff --cached), then run this.
#   usage: scripts/safe-push.sh [branch]   (default: validation-v0-v1)
set -euo pipefail
branch="${1:-validation-v0-v1}"

# 1) Try a plain fast-forward push FIRST. In the shared tree our commit's parent is usually origin's tip, so
#    this succeeds with ZERO risk to anyone's uncommitted work - no stash, no rebase. (Also a no-op "up to
#    date" if our commit already landed.) Only if origin has genuinely moved do we fall through.
if git push origin "HEAD:$branch" 2>/tmp/safe-push-err; then
  echo "safe-push: fast-forward push OK (no stash/rebase needed)."
  exit 0
fi
if ! grep -qiE "fetch first|non-fast-forward|rejected" /tmp/safe-push-err; then
  cat /tmp/safe-push-err >&2   # a real error (auth/network), not a divergence - surface it
  exit 1
fi

echo "safe-push: origin/$branch moved; a plain push was rejected. Integrating..."
git fetch origin "$branch"

# 2) Last resort: rebase our commits onto origin. This needs a clean tree, so --autostash sets aside the
#    WHOLE shared dirty tree (which may include OTHER sessions' WIP) and restores it after. DANGER: if that
#    restore conflicts, git KEEPS the stash - a sibling's WIP is then in `git stash list`, not their tree.
echo "safe-push: WARNING - rebasing in a SHARED dirty tree; sibling WIP is autostashed then restored." >&2
if ! git pull --rebase --autostash origin "$branch"; then
  echo "" >&2
  echo "safe-push: STOP. Rebase or autostash-restore hit a conflict. Your commit is NOT pushed." >&2
  echo "  1. Run 'git stash list' - a sibling's WIP was likely autostashed and NOT restored. Recover it" >&2
  echo "     ('git stash pop', resolve keeping THEIR intent) or tell that session it is in the stash." >&2
  echo "  2. Resolve any rebase conflict by hand keeping BOTH intents, then 'git rebase --continue'." >&2
  echo "  Never 'git push --force' this branch. When in doubt, coordinate via ListAgents/SendMessage." >&2
  exit 1
fi
git push origin "HEAD:$branch"
echo "safe-push: rebased onto origin + pushed."
