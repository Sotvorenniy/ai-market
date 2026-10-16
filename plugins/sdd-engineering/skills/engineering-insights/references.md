# References

## Sources

- **The learnings-loop pattern** — the seven-section schema, the wrap-up flow,
  the vague-vs-useful bar, and the trigger tradeoffs:
  `mindstudio.ai/blog/self-learning-ai-skill-system-learnings-md-wrap-up`
- **Session lifecycle hooks** — why a Stop hook is what makes capture dependable:
  `mindstudio.ai/blog/compounding-knowledge-loop-claude-code`
- **Skill authoring** — frontmatter limits, progressive disclosure, degrees of
  freedom, evaluation-driven development:
  `platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices`
- **How skills are used at Anthropic** — skills as folders of scripts and
  resources, dynamic hooks, and *"the highest-signal content in any skill is the
  Gotchas section"*:
  `claude.dev/blog/lessons-from-building-claude-code-how-we-use-skills/`
- **A comparable implementation** — `glebis/claude-skills`, the `retrospective`
  skill. The depth check, the ranked five-candidate cap, and the
  single-multi-select approval are adapted from it.

## Design decisions worth remembering

**Why `INSIGHTS.md` and not `LEARNINGS.md`.** The source material names
`LEARNINGS.md`. `INSIGHTS.md` sits next to a package's `AGENTS.md`, which can
route to it, so the read side is wired by one line in the project's docs. One
name across every package means one place to look.

**Why no separate wrap-up command.** The article predates user-invocable
skills. The skill itself is invocable; a command file would be a second copy of
the same instructions to keep in sync.

**Why the dedup check is a script.** A deterministic detector beats model
judgment for a mechanical comparison, and it costs no context.

**Why the cap is 40 entries, not 200.** Phase 0 reads the whole file every
session, so length is a running cost rather than mere clutter. These are also
per-package files, not one global file.

---

## Optional — a Stop hook

**Not shipped with this plugin.** A project that wants dependable capture can
add it itself.

By default the skill fires from its description plus a manual invocation. That
is honest but unreliable — if capture needs a human trigger, it does not happen
consistently enough to compound. A `Stop` hook fires when the session ends,
with no human in the loop.

Add to the project's `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/insights-wrap-up.sh"
          }
        ]
      }
    ]
  }
}
```

`scripts/insights-wrap-up.sh` is the project's own script (the path is an
example). It should run Phase 2's depth check and exit silently when the
session was shallow, so an always-on hook stays quiet most of the time.

### Why not a skill-registered dynamic hook

A skill can register hooks that live only while it is active. Anthropic's stated
use for those is *situational* constraints — `/careful` blocking `rm -rf` and
force-push, `/freeze` blocking edits outside a directory — where *"you only want
this when you know you're touching prod; having it always on would drive you
insane."*

Capture is the opposite: it should always be on. So the hook belongs in the
project's `settings.json`, not in the skill.