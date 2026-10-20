# Compatibility

What each `sdd-engineering` version was tested with. "Tested" means the check named in the Evidence
column passed on that version; anything else is untested, not known to be broken.

## Claude Code

| sdd-engineering | Claude Code | Evidence |
|---|---|---|
| 1.1.1 | 2.1.301 | CI: `claude plugin validate --strict`, guard hook tests, `install-check` |
| 1.1.1 | 2.1.302 | Eval `version-log-written` passed (1/1), run on the release tree before the version bump |
| 1.1.1 | 2.1.303 | `claude plugin validate --strict` and guard hook tests (41/41), local; evals not run |
| 1.1.0 | 2.1.301 | CI: validate, guard hook tests, `install-check` |
| 1.1.0 | 2.1.302 | Full eval suite, 6/6 cases, including both `spec-check` cases, run on the release tree before the version bump |
| 1.0.0 | 2.1.301 | CI: validate, guard hook tests, `install-check`; behaviour probe ([docs/specs/plugins.md §6](../../docs/specs/plugins.md)) |
| 1.0.0 | 2.1.302 | Full eval suite, 4/4 cases |

Minimum supported: **2.1.301**. Older versions are not tested. CI pins the CLI with
`CLAUDE_CODE_VERSION` in `.github/workflows/marketplace-checks.yml` and `install-from-github.yml`;
this table moves when that pin moves.

### Claude Code behaviour the plugin relies on

If a Claude Code release changes one of these, the plugin needs a fix:

| Behaviour | Used by |
|---|---|
| Plugin `dependencies` with semver ranges are resolved on install | Installing the three dependency plugins |
| Plugin hooks in `hooks/hooks.json` fire for a plugin agent's tool calls, and the hook input carries `agent_type` | All guard hooks |
| `SessionStart` plugin hooks run, and their output does not block the session | Version log |
| An agent with the `Skill` tool can load a skill from another plugin by namespace | `implementation-planner`, `implementer`, `spec-creator` |
| `Agent(<type>, ...)` in an agent's `tools` limits which subagents it may start | `spec-creator` |
| `${CLAUDE_PLUGIN_ROOT}` in hook commands, `${CLAUDE_SKILL_DIR}` in skill content | Hooks, `workflow-retro` |
| `disable-model-invocation: true` keeps a skill manual-only | `workflow-retro` |

Known not to work, and avoided on purpose: `hooks:` in a plugin agent's frontmatter (never fires), and
`${user_config.*}` in agent content (not substituted).

## Dependencies

| sdd-engineering | Range | Tested with |
|---|---|---|
| 1.1.x | `engineering-paved-path ^1.0.0` | 1.0.0, 1.0.1 |
| 1.1.x | `research-tools ^1.0.0` | 1.0.0 |
| 1.1.x | `architecture-review ^1.0.0` | 1.0.0 |
| 1.0.0 | same ranges | `engineering-paved-path` 1.0.0, `research-tools` 1.0.0, `architecture-review` 1.0.0 |

A 2.0.0 of any dependency is outside the range and will not be installed for this plugin until
`sdd-engineering` widens the range in its own release.

## External tools

| Tool | Needed for | Tested with | Without it |
|---|---|---|---|
| `jq` | Guard hooks, version log | 1.7.1 | Guards deny the guarded calls; the version log is skipped |
| `bash` | Hook scripts | macOS and Ubuntu (CI) | Hooks do not run |
| `git` | Planner, verifier, `run-plan` | any recent | Diff-based steps fail |
| `node` | `workflow-retro` | 18+ required; 22 in CI, 20+ for the repository scripts | Only the retro skill fails |

## Platforms

macOS and Linux. Windows is not tested; the hooks are bash scripts and need a bash with `jq` on `PATH`
(for example Git Bash or WSL).

## Updating this file

At every release add rows for the new version: the Claude Code version CI pins, the version the evals
ran on, the dependency versions installed during the eval run (`suite.plugins` in
`evals/results/<run>/aggregate-result.json`) and the result. Keep the old rows.
