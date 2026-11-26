#!/usr/bin/env bash
# Commit generated data files and push to main without racing other jobs or pushes from the Mac.
# Usage: bash scripts/commit_data.sh "commit message" path [path ...]
# On each try: fetch the latest main, reset to it, lay this run's freshly generated files on top,
# commit, push. A rejected push (someone else pushed first) just retries on the new tip, so a
# generated file never ends in a rebase conflict. Directories are merged (files are added or
# replaced, never deleted).
set -u
msg="$1"; shift
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
stash=$(mktemp -d)
for f in "$@"; do
  if [ -e "$f" ]; then mkdir -p "$stash/$(dirname "$f")"; cp -R "$f" "$stash/$f"; fi
done
for try in 1 2 3 4 5 6; do
  git fetch -q origin main || { sleep 5; continue; }
  git reset -q --hard origin/main
  for f in "$@"; do
    if [ -d "$stash/$f" ]; then mkdir -p "$f"; cp -R "$stash/$f/." "$f/";
    elif [ -e "$stash/$f" ]; then mkdir -p "$(dirname "$f")"; cp "$stash/$f" "$f"; fi
  done
  git add -A -- "$@"
  if git diff --cached --quiet; then echo "No changes"; exit 0; fi
  git commit -q -m "$msg"
  if git push -q origin HEAD:main; then echo "Pushed on try $try"; exit 0; fi
  echo "Push rejected (try $try), retrying on the new main"
  sleep $(( try * 4 + RANDOM % 6 ))
done
echo "Gave up after 6 tries" >&2
exit 1
