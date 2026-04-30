# claude-toolkit

This repository is the **shared Claude Code surface** for imaginary-space: skills, subagents, rules, hooks, and small scripts. Agents (including cloud **Routines**) should treat it as the system-of-record for how we work.

## Cloud routines

Routine **prompts** and triggers live in the [Claude Routines UI](https://claude.ai/code/routines), not in this repo. Each run is **stateless**: a fresh clone of the default branch (`main`). Nothing persists between runs unless you push commits or open PRs.

- **Do not** put `./setup.sh` in the **cloud environment** setup script (that runs before the repo is on `PATH`/`PWD` — use empty or global tools only). Repo setup runs in cloud via **SessionStart** → [`run-remote-setup.sh`](.claude/hooks/scripts/run-remote-setup.sh) → [`setup.sh`](setup.sh) when `CLAUDE_CODE_REMOTE=true`.
- **Discovery**: Claude Code loads `.claude/skills/`, `.claude/agents/`, `.claude/rules/`, `.claude/output-styles/`, and project [`settings.json`](.claude/settings.json) from this repo when it is the selected repository.
- **Thin UI prompts**: name skills/scripts and connectors in the saved prompt; keep heavy instructions in git (see [`docs/routines.md`](docs/routines.md)).
- **Branching**: Prefer `claude/<short-slug>` for agent work branches and PRs even when unrestricted pushes are enabled—keeps history readable.
- **Safety**: Routines do not show permission prompts. `permissions.deny` in settings is a soft guard; **hooks** (see `.claude/settings.json`) enforce destructive-command blocks.

## Skill index (seed)

| Skill | When to use |
| --- | --- |
| `pr-workflow` | Branching, commits, PRs, lightweight triage |
| `safe-shell` | Before running shell that could be destructive |
| `skill-author` | Adding or editing a skill in this repo |
| `weekly-sync-deck` | Weekly client/management deck from Linear + Supabase → Marp PDF → Drive |
| `presentation-kit-deck` | Rich React client deck from Linear + IMS ops Supabase → presentation-kit PDF → Drive |
| `fal-presentation-images` | Generate presentation-kit cover/closing images with FAL before rendering |
| `meeting-hourly-sweep` | Hourly Read.ai → Supabase meeting queue sweep (standalone routine) |
| `content-ideas-extractor` | Downstream Read.ai meeting content mining after meeting processing succeeds |
| `vercel-comments-digest` | Daily Slack #vercel-pings → weekly Linear holding epics + Vercel thread replies |
| `repo-bootstrap` | Installing this toolkit into another repository |

## Subagents (seed)

| Agent | Role |
| --- | --- |
| `code-reviewer` | Focused diff / design review |
| `test-runner` | Run tests and report failures crisply |
| `pr-babysitter` | Keep a PR merge-ready (comments, CI, conflicts) |

## Further reading

- [`docs/routines.md`](docs/routines.md) — how cloud routines use this repo
- [`docs/presentations.md`](docs/presentations.md) — Marp decks and weekly sync format
- [`docs/architecture.md`](docs/architecture.md) — hybrid project + plugin layout
- [`docs/conventions.md`](docs/conventions.md) — naming, frontmatter, size limits
- [`docs/contributing.md`](docs/contributing.md) — PR flow and validation
