#!/usr/bin/env sh
# Only needed in managed environments that mount .git read-only.
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec git --git-dir="$repo_root/.git-local" --work-tree="$repo_root" "$@"
