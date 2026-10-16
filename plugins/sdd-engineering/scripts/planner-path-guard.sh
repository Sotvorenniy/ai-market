#!/bin/bash
# PreToolUse(Edit|Write) guard for the implementation-planner agent.
# allow -> one plan file directly in the plans folder (default .claude/plans/, override with SDD_PLANS_DIR)
# deny  -> everything else

source "$(dirname "$0")/guard-lib.sh"
only_for implementation-planner

rel=$(relative_path)

case "$rel" in
  *..*) decide deny "Path traversal is not allowed." ;;
  "$PLANS_DIR"/*/*) ;;
  "$PLANS_DIR"/*.md) decide allow "implementation-planner writes its plan file." ;;
esac

decide deny "implementation-planner writes only $PLANS_DIR/<task-slug>.md ($rel is not one). Specs belong to spec-creator; code to implementer."
