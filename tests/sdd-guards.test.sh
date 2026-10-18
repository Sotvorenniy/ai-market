#!/bin/bash
# Tests for the sdd-engineering guard hooks: feeds sample PreToolUse inputs and checks each decision.
# Usage: bash tests/sdd-guards.test.sh   (needs jq)
set -u

SCRIPTS="$(cd "$(dirname "$0")/../plugins/sdd-engineering/scripts" && pwd)"
export CLAUDE_PROJECT_DIR=/tmp/sdd-guard-test
fail=0 pass=0

check() {
  local script=$1 agent=$2 tool=$3 arg=$4 expected=$5 input actual
  if [[ $tool == Bash ]]; then
    input=$(jq -n --arg a "$agent" --arg c "$arg" '{agent_type: $a, tool_name: "Bash", tool_input: {command: $c}, cwd: env.CLAUDE_PROJECT_DIR}')
  else
    input=$(jq -n --arg a "$agent" --arg t "$tool" --arg p "$CLAUDE_PROJECT_DIR/$arg" '{agent_type: $a, tool_name: $t, tool_input: {file_path: $p}, cwd: env.CLAUDE_PROJECT_DIR}')
  fi
  actual=$("$SCRIPTS/$script" <<<"$input" | jq -r '.hookSpecificOutput.permissionDecision // empty')
  actual=${actual:-none}
  if [[ $actual == "$expected" ]]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAIL $script [$agent] $tool '$arg': expected $expected, got $actual"
  fi
}

S=sdd-engineering
check spec-creator-path-guard.sh $S:spec-creator Write specs/2026-10-16-x.md allow
check spec-creator-path-guard.sh $S:spec-creator Write server/specs/x.md allow
check spec-creator-path-guard.sh spec-creator Write specs/x.md allow
check spec-creator-path-guard.sh $S:spec-creator Write specs/README.md deny
check spec-creator-path-guard.sh $S:spec-creator Write specs/sub/x.md deny
check spec-creator-path-guard.sh $S:spec-creator Write specs/../src/x.md deny
check spec-creator-path-guard.sh $S:spec-creator Write src/app.ts deny
check spec-creator-path-guard.sh $S:implementer Write src/app.ts none
check spec-creator-path-guard.sh "" Write src/app.ts none

check planner-path-guard.sh $S:implementation-planner Write .claude/plans/feat.md allow
check planner-path-guard.sh $S:implementation-planner Write .claude/plans/feat/state.json deny
check planner-path-guard.sh $S:implementation-planner Write src/a.ts deny
check planner-path-guard.sh "" Write src/a.ts none

check implementer-path-guard.sh $S:implementer Write src/new.test.ts deny
check implementer-path-guard.sh $S:implementer Write src/__tests__/a.ts deny
check implementer-path-guard.sh $S:implementer Edit package-lock.json deny
check implementer-path-guard.sh $S:implementer Edit .claude/plans/feat.md deny
check implementer-path-guard.sh $S:implementer Edit specs/x.md deny
check implementer-path-guard.sh $S:implementer Write src/feature.ts none
check implementer-path-guard.sh $S:plan-verifier Write src/new.test.ts none

check implementer-bash-guard.sh $S:implementer Bash "git commit -m x" deny
check implementer-bash-guard.sh $S:implementer Bash "git -C app push" deny
check implementer-bash-guard.sh $S:implementer Bash "rm -rf build" deny
check implementer-bash-guard.sh $S:implementer Bash "cat > src/a.ts <<EOF" deny
check implementer-bash-guard.sh $S:implementer Bash "sed -i s/a/b/ src/a.ts" deny
check implementer-bash-guard.sh $S:implementer Bash "npm install lodash" ask
check implementer-bash-guard.sh $S:implementer Bash "npm test" none
check implementer-bash-guard.sh $S:spec-creator Bash "git push" none

check readonly-bash-guard.sh $S:plan-verifier Bash "npm --prefix server test" allow
check readonly-bash-guard.sh $S:plan-verifier Bash "pnpm run typecheck" allow
check readonly-bash-guard.sh $S:plan-verifier Bash "npx vitest run src/a.test.ts" allow
check readonly-bash-guard.sh $S:plan-verifier Bash "git -C . diff --stat" allow
check readonly-bash-guard.sh $S:plan-verifier Bash "git grep -n -e 'a|b' -- src" allow
check readonly-bash-guard.sh $S:plan-verifier Bash "cd server && npm test" deny
check readonly-bash-guard.sh $S:plan-verifier Bash "rm -rf x" deny
check readonly-bash-guard.sh $S:plan-verifier Bash "npx vitest run -u" deny
check readonly-bash-guard.sh $S:plan-verifier Bash "npx eslint src --fix" deny
check readonly-bash-guard.sh $S:plan-verifier Bash 'echo $(whoami)' deny
check readonly-bash-guard.sh $S:implementer Bash "rm -rf x" none

# Version log: one line per session, with the version from plugin.json and the marketplace from the path.
log_test() {
  local root=$1 expected_marketplace=$2 line
  rm -rf "$CLAUDE_PROJECT_DIR"
  CLAUDE_PLUGIN_ROOT=$root "$SCRIPTS/session-version-log.sh" <<<'{"session_id":"s1","source":"startup"}' >/tmp/sdd-log-out
  line=$(tail -n 1 "$CLAUDE_PROJECT_DIR/.claude/cache/sdd-engineering/sessions.jsonl" 2>/dev/null)
  if [[ ! -s /tmp/sdd-log-out ]] &&
    jq -e --arg v "$(jq -r .version "$root/.claude-plugin/plugin.json")" --arg m "$expected_marketplace" \
      '.version == $v and .marketplace == $m and .session_id == "s1" and .source == "startup"' <<<"$line" >/dev/null 2>&1; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAIL session-version-log.sh [$expected_marketplace]: got '$line'"
  fi
}
log_test "$SCRIPTS/.." local
fake=$(mktemp -d)/.claude/plugins/cache/ai-market-stable/sdd-engineering/1.0.0
mkdir -p "$fake" && cp -R "$SCRIPTS/../.claude-plugin" "$fake/"
log_test "$fake" ai-market-stable

echo "$pass passed, $fail failed"
exit $((fail > 0))
