#!/usr/bin/env bash
# Onion Architecture gate. Exit 0 = no NEW violations, 1 = violations, 2 = setup problem.
#   1. dependency-cruiser with the frozen baseline (--ignore-known)
#   2. a grep for direct database access through the container (`container.db` by default)
#      in module files other than repositories, which dependency-cruiser cannot see
#      (it is property access, not an import)
#
# Usage (run from the backend package root, i.e. the directory that holds node_modules/
# and the dependency-cruiser config):
#   "${CLAUDE_SKILL_DIR}/scripts/check.sh" [SRC_DIR]
#
#   SRC_DIR   source directory to check (default: src)
#
# Environment overrides:
#   ONION_CONFIG       dependency-cruiser config file      (default: .dependency-cruiser.cjs)
#   ONION_MODULES_DIR  folder holding one folder per module (default: $SRC_DIR/modules)
#   ONION_DB_PATTERN   extended regex for direct DB access  (default: container\.db\b)
#   ONION_KNOWN_DB     allowlist of files that already match the pattern, one path per line,
#                      relative to the current directory; '#' starts a comment. Remove a line
#                      when you fix that file; never add one.  (default: .onion-known-db-access)
#
# A baseline of existing dependency-cruiser violations, if any, is read by dependency-cruiser
# itself from .dependency-cruiser-known-violations.json (see --ignore-known).
set -u

usage() { sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'; }

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
esac

SRC_DIR="${1:-src}"
CONFIG="${ONION_CONFIG:-.dependency-cruiser.cjs}"
MODULES_DIR="${ONION_MODULES_DIR:-$SRC_DIR/modules}"
DB_PATTERN="${ONION_DB_PATTERN:-container\.db\b}"
KNOWN_DB="${ONION_KNOWN_DB:-.onion-known-db-access}"

if [ ! -d "$SRC_DIR" ]; then
  echo "source directory '$SRC_DIR' not found (run from the backend package root, or pass SRC_DIR)" >&2
  exit 2
fi

if [ -x ./node_modules/.bin/depcruise ]; then
  DEPCRUISE=./node_modules/.bin/depcruise
elif command -v depcruise >/dev/null 2>&1; then
  DEPCRUISE=depcruise
else
  echo "dependency-cruiser not found — install it as a dev dependency (npm i -D dependency-cruiser)" >&2
  exit 2
fi

if [ ! -f "$CONFIG" ]; then
  echo "dependency-cruiser config '$CONFIG' not found — start from the skill's templates/dependency-cruiser.cjs.tmpl" >&2
  exit 2
fi

status=0

echo "── dependency-cruiser ($CONFIG, known violations ignored)"
"$DEPCRUISE" "$SRC_DIR" --config "$CONFIG" --ignore-known --output-type err || status=1

echo "── direct DB access outside repositories (pattern: $DB_PATTERN)"
if [ ! -d "$MODULES_DIR" ]; then
  echo "  skipped: modules directory '$MODULES_DIR' not found (set ONION_MODULES_DIR)"
  exit $status
fi

new_hits=0
hits="$(grep -rlE "$DB_PATTERN" "$MODULES_DIR" 2>/dev/null | sort)"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  case "$f" in
    */repository.ts|*/repository/*|*.repo.ts) continue ;;
  esac
  if [ -f "$KNOWN_DB" ] && sed 's/#.*//; s/[[:space:]]*$//' "$KNOWN_DB" | grep -Fxq "$f"; then
    continue
  fi
  new_hits=1
  grep -nE "$DB_PATTERN" "$f" | sed "s|^|  error db-access-outside-repository: $f:|"
done <<EOF
$hits
EOF

if [ "$new_hits" -eq 1 ]; then
  status=1
else
  echo "✔ no new direct DB access"
fi

exit $status
