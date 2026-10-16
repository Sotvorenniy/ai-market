#!/usr/bin/env bash
# Find INSIGHTS.md entries related to a candidate, so a near-duplicate is never
# appended. Searches the package file and the root file, and reports which entry
# each match belongs to.
#
#   find-related.sh <pkg-dir|root> "<key terms>"
#   find-related.sh --list
#
#   <pkg-dir>    the package directory, relative to the repository root (for
#                example `api` or `packages/web`); `root` searches the root file
#                only
#   <key terms>  space-separated; a match on ANY term is reported
#   --list       print every INSIGHTS.md in the repository (package discovery)
#
# The repository root is taken from `git rev-parse --show-toplevel` in the
# current directory (falling back to the current directory), so run it from
# inside the project. The script itself may live anywhere (a plugin cache).
#
# Exit codes: 0 no matches (safe to add) · 1 matches found (judge before adding)
#             2 bad usage. A missing INSIGHTS.md is reported, not fatal —
#             an absent file simply has nothing to duplicate.

set -uo pipefail

usage() {
  echo "usage: find-related.sh <pkg-dir|root> \"<key terms>\"" >&2
  echo "       find-related.sh --list" >&2
  exit 2
}

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [ $# -eq 1 ] && [ "$1" = "--list" ]; then
  # Tracked and untracked (but not ignored) files; outside git, a plain find.
  if git -C "$repo_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$repo_root" ls-files --cached --others --exclude-standard \
      -- 'INSIGHTS.md' '*/INSIGHTS.md' | sort -u
  else
    (cd -- "$repo_root" && find . -name INSIGHTS.md -not -path '*/node_modules/*' \
      -not -path '*/.git/*' | sed 's|^\./||' | sort)
  fi
  exit 0
fi

[ $# -eq 2 ] || usage

pkg=${1%/}
terms=$2

[ -n "$pkg" ] || usage
case "$pkg" in
  /*|*..*) echo "package must be a path relative to the repository root: $pkg" >&2; usage ;;
esac
if [ "$pkg" != "root" ] && [ ! -d "$repo_root/$pkg" ]; then
  echo "no such package directory: $pkg (relative to $repo_root)" >&2
  usage
fi

[ -n "${terms// /}" ] || { echo "no key terms given" >&2; usage; }

files=("$repo_root/INSIGHTS.md")
[ "$pkg" != "root" ] && [ "$pkg" != "." ] && files+=("$repo_root/$pkg/INSIGHTS.md")

# Build a case-insensitive alternation from the terms.
pattern=$(printf '%s' "$terms" | tr -s ' ' '|')

found=0

for file in "${files[@]}"; do
  rel=${file#"$repo_root"/}

  if [ ! -f "$file" ]; then
    echo "-- $rel: not found (nothing to duplicate)"
    continue
  fi

  matches=$(
    awk -v pat="$pattern" '
      /^## /  { section = substr($0, 4); entry = ""; next }
      /^### / { entry   = substr($0, 5);             next }
      tolower($0) ~ tolower(pat) {
        printf "%d\t%s\t%s\t%s\n", NR, (section == "" ? "-" : section),
               (entry == "" ? "(no entry — file preamble)" : entry), $0
      }
    ' "$file"
  )

  if [ -z "$matches" ]; then
    echo "-- $rel: no related entries"
    continue
  fi

  found=1
  echo "-- $rel: related entries found"
  # Report each owning entry once, with the first matching line as the reason.
  printf '%s\n' "$matches" | awk -F'\t' '
    !seen[$3]++ {
      printf "   %s:%s\n", $2, $3
      printf "     line %s: %s\n", $1, substr($4, 1, 100)
    }
  '
done

if [ "$found" -eq 1 ]; then
  echo
  echo "Related entries exist. Enrich one, correct one, or drop the candidate."
  echo "Do NOT append a near-duplicate, and do NOT remove what is already there."
  exit 1
fi

echo
echo "No related entries. Safe to add under the fitting section."
exit 0
