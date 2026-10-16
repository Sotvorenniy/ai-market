#!/bin/bash
# Shared helpers for the sdd-engineering guard hooks (sourced, not executed).
#
# Plugin agents cannot declare hooks in their frontmatter, so every guard is a plugin-level
# PreToolUse hook in hooks/hooks.json. Each guard first checks `agent_type` from the hook input
# and does nothing for other agents or the main session.

GUARD_INPUT=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  # Fail closed: without jq the guard cannot read the call, so it cannot allow it safely.
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"sdd-engineering guards need jq. Install jq (https://jqlang.org) and retry."}}'
  exit 0
fi

field() {
  jq -r "$1 // \"\"" <<<"$GUARD_INPUT"
}

# Exits silently unless the call comes from one of the named agents (plugin-namespaced or bare).
only_for() {
  local agent
  agent=$(field '.agent_type')
  for name in "$@"; do
    [[ $agent == "sdd-engineering:$name" || $agent == "$name" ]] && return 0
  done
  exit 0
}

decide() {
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
  exit 0
}

# Path of the tool call relative to the project root.
relative_path() {
  local path cwd root
  path=$(field '.tool_input.file_path')
  cwd=$(field '.cwd')
  root="${CLAUDE_PROJECT_DIR:-$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$cwd")}"
  printf '%s' "${path#"$root"/}"
}

PLANS_DIR="${SDD_PLANS_DIR:-.claude/plans}"
PLANS_DIR="${PLANS_DIR%/}"
