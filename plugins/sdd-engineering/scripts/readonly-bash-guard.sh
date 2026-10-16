#!/bin/bash
# PreToolUse(Bash) guard for the plan-verifier agent.
# Allowlist: test runners and type checkers, read-only git, plain read utilities. Everything else is
# denied. Chaining, redirects and command substitution are denied so that an allowed prefix cannot
# smuggle a write; quoted arguments (a jq filter with `|`, `git grep -e 'a|b'`) are not chaining.

source "$(dirname "$0")/guard-lib.sh"
only_for plan-verifier

cmd=$(field '.tool_input.command')

# Walk the command the way the shell quotes it. `unquoted` keeps only characters outside quotes;
# `live` also keeps double-quoted ones, where `$(` and backticks still run.
unquoted='' live='' state=none
for ((i = 0; i < ${#cmd}; i++)); do
  c=${cmd:i:1}
  case $state in
    single) [[ $c == "'" ]] && state=none ;;
    double)
      if [[ $c == '\' ]]; then ((i++)); live+='_'
      elif [[ $c == '"' ]]; then state=none
      else live+=$c; fi ;;
    none)
      if [[ $c == '\' ]]; then ((i++)); unquoted+='_'; live+='_'
      elif [[ $c == "'" ]]; then state=single
      elif [[ $c == '"' ]]; then state=double
      else unquoted+=$c; live+=$c; fi ;;
  esac
done
if [[ $state != none ]]; then
  decide deny "plan-verifier runs single read-only commands: unbalanced quotes."
fi
if grep -Eq '`|\$\(' <<<"$live"; then
  decide deny "plan-verifier runs single read-only commands: no command substitution."
fi
if grep -Eq '[;&|<>]' <<<"$unquoted" || [[ $unquoted == *$'\n'* ]]; then
  decide deny "plan-verifier runs single read-only commands: no chaining, pipes or redirects. Use 'git -C <dir>' or 'npm --prefix <dir>' instead of 'cd <dir> &&'."
fi

pm='(npm|pnpm|yarn|bun)\s+((--prefix|-C|--cwd|--dir)\s+\S+\s+)?(test|run\s+(test|typecheck|type-check|lint|check)[[:alnum:]:_-]*)'
bins='((npx|pnpm\s+exec|yarn|bunx)\s+|(\S*/)?node_modules/\.bin/)(vitest\s+(run|related)|jest|tsc\s+(--noEmit|-p\s+\S+\s+--noEmit)|eslint|playwright\s+test)'
other='(pytest|python3?\s+-m\s+pytest|go\s+(test|vet)|cargo\s+(test|check|clippy))'
git_ro='git\s+(-C\s+\S+\s+)?(diff|status|log|show|ls-files|rev-parse|grep|merge-base|blame)'

if grep -Eq "^\s*(${pm}|${bins}|${other}|${git_ro}|ls|cat|wc|jq|head|tail)\b" <<<"$cmd"; then
  if grep -Eq '\bgit\b.*\s--output\b' <<<"$cmd"; then
    decide deny "git --output writes a file."
  fi
  if grep -Eq '\bgit\s+(-C\s+\S+\s+)?grep\b.*\s(-O|--open-files-in-pager)\b' <<<"$cmd"; then
    decide deny "git grep -O runs a pager command."
  fi
  if grep -Eq '\b(vitest|jest)\b.*\s(-u|--update|--updateSnapshot|--watch)\b' <<<"$cmd"; then
    decide deny "Snapshot updates rewrite files; watch mode never ends."
  fi
  if grep -Eq '\beslint\b.*\s--fix\b' <<<"$cmd"; then
    decide deny "eslint --fix writes files."
  fi
  decide allow "Read-only verification command."
fi

decide deny "plan-verifier may only run test runners and type checkers (npm/pnpm/yarn/bun test or run test|typecheck|lint|check scripts, vitest run/related, jest, tsc --noEmit, eslint, playwright test, pytest, go test/vet, cargo test/check/clippy), read-only git, ls, cat, wc, jq, head, tail. Report anything else as not verified."
