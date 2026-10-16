#!/bin/bash
# PreToolUse(Bash) guard for the implementer agent.
# deny -> committing or pushing, recursive rm, dropping container volumes
# deny -> file writes through the shell (redirects or heredocs into source files, sed -i, perl -i, tee,
#         python/node file writes): edits go through Edit/Write, where the path guard applies
# ask  -> installing, adding or removing dependencies
# otherwise no decision: the normal permission flow applies.
# The guard matches command text, so a script that runs a denied command internally is not caught.

source "$(dirname "$0")/guard-lib.sh"
only_for implementer

cmd=$(field '.tool_input.command')

if grep -Eq '(^|[;&|(]\s*)git\s+(-C\s+\S+\s+)?(commit|push)\b' <<<"$cmd"; then
  decide deny "Agents do not commit or push. Report the changed files; the user commits after review."
fi
if grep -Eq '(^|[;&|(]\s*)rm\s+(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b' <<<"$cmd"; then
  decide deny "Recursive rm is not allowed for agents. Report it as a blocker if a deletion is needed."
fi
if grep -Eq '(^|[;&|(]|\s)docker[ -]compose\s+down\b.*(\s-v\b|\s--volumes\b)' <<<"$cmd"; then
  decide deny "docker compose down -v deletes data volumes. Never run it."
fi

SRC_EXT='(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|md|sql|css|scss|yaml|yml|py|go|rs|java|kt|rb|php|cs|swift|vue|svelte|html)'
if grep -Eq "(^|[^0-9&>])>{1,2}[[:space:]]*[\"']?[^[:space:];&|]+\.${SRC_EXT}\b" <<<"$cmd"; then
  decide deny "Shell redirect into a source file. Use Edit (existing file) or Write (new file); scratch output goes to a temp file."
fi
if grep -Eq '(^|[;&|(]\s*|\s)(sed\s+(-[a-zA-Z]*i|--in-place)|perl\s+-[a-zA-Z]*i|tee)\b' <<<"$cmd"; then
  decide deny "In-place shell edits (sed -i, perl -i, tee) bypass the path guard. Use Edit."
fi
# Heredoc scripts span lines: match on the command flattened to one line.
if tr '\n' ' ' <<<"$cmd" | grep -Eq '(^|[;&|(]\s*)(python3?|node)\b.*(open\([^)]*,\s*["'"'"'][wa]|writeFile|write_text)'; then
  decide deny "File writes through python/node scripts bypass the path guard. Use Edit or Write."
fi

if grep -Eq '(^|[;&|(]\s*)((npm|pnpm|yarn|bun)\s+(i|install|add|remove|rm|uninstall|update|upgrade)\b|pip3?\s+install\b|cargo\s+add\b|go\s+get\b)' <<<"$cmd"; then
  decide ask "Dependency change requested by the implementer. The plan should name every new dependency; approve only if it does."
fi

exit 0
