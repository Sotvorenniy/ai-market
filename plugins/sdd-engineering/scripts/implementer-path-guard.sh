#!/bin/bash
# PreToolUse(Edit|Write) guard for the implementer agent.
# deny -> creating a NEW test file (editing an existing test that the change broke stays allowed)
# deny -> lockfiles, migrations folders, specs, the plans folder, dependency folders
# otherwise no decision: the normal permission flow applies.
# Project-specific do-not-touch paths come from the plan (§2); the agent follows them.

source "$(dirname "$0")/guard-lib.sh"
only_for implementer

tool=$(field '.tool_name')
path=$(field '.tool_input.file_path')
rel=$(relative_path)

case "$rel" in
  *..*) decide deny "Path traversal is not allowed." ;;
  "$PLANS_DIR"/*) decide deny "The plan is read-only for the implementer. Report a wrong step as a deviation." ;;
  specs/*|*/specs/*.md) decide deny "Specs belong to spec-creator. Report a spec gap in the Implementation Report." ;;
  node_modules/*|*/node_modules/*) decide deny "Dependency folders are never edited." ;;
  *package-lock.json|*pnpm-lock.yaml|*yarn.lock|*bun.lock|*bun.lockb|*Cargo.lock|*poetry.lock|*go.sum)
    decide deny "Lockfiles are never edited by agents." ;;
esac

if [[ $tool == Edit || -e $path ]]; then
  case "$rel" in
    */migrations/*|migrations/*)
      decide deny "Applied migrations are never edited. Generate a new one with the project's migration tool." ;;
  esac
fi

if [[ $tool == Write && ! -e $path ]]; then
  case "$rel" in
    *.test.*|*.spec.*|*_test.*|test_*.py|*/__tests__/*)
      decide deny "New tests are not the implementer's job (plan §5 names who writes them). Leave the seams the plan names and list the test under 'Not run / unverified'." ;;
  esac
fi

exit 0
