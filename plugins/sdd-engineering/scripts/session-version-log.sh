#!/bin/bash
# SessionStart hook: appends one JSON line per session to .claude/cache/sdd-engineering/sessions.jsonl
# in the project, with the plugin version that is active and the marketplace it was installed from.
# It answers "which sdd-engineering ran here?" after an update or a switch to the stable channel.
#
# Prints nothing, so it adds no model context. Never blocks the session: every failure exits 0.
# Turn it off with SDD_VERSION_LOG=off.

[[ ${SDD_VERSION_LOG:-} == off ]] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)
jq -e 'type == "object"' <<<"$input" >/dev/null 2>&1 || input='{}'
root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
project="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd // empty' <<<"$input")}"
[[ -n $project ]] || exit 0

version=$(jq -r '.version // "unknown"' "$root/.claude-plugin/plugin.json" 2>/dev/null) || version=unknown

# Installed plugins live in ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>; anything else is a
# local --plugin-dir checkout.
marketplace=local
if [[ $root == */plugins/cache/*/sdd-engineering/* ]]; then
  marketplace=${root#*/plugins/cache/}
  marketplace=${marketplace%%/*}
fi

log_dir="$project/.claude/cache/sdd-engineering"
mkdir -p "$log_dir" 2>/dev/null || exit 0
jq -cn \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg version "$version" \
  --arg marketplace "$marketplace" \
  --arg root "$root" \
  --argjson input "$input" \
  '{ts: $ts, event: "session_start", plugin: "sdd-engineering", version: $version, marketplace: $marketplace,
    source: ($input.source // null), session_id: ($input.session_id // null), plugin_root: $root}' \
  >>"$log_dir/sessions.jsonl" 2>/dev/null
exit 0
