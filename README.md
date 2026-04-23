# claude-toolkit

Shared **Claude Code** configuration for imaginary-space: skills, subagents, rules, hooks, routine prompt templates, and small scripts. Designed so [Claude Code Routines](https://code.claude.com/docs/en/routines) can point at this repository and get a consistent agent surface on every run.

## Quick start

### As the routine’s primary repo

1. Create a routine at [claude.ai/code/routines](https://claude.ai/code/routines).
2. Select this repository (`imaginary-space/claude-toolkit`) and the default branch (`main`).
3. Point the routine’s **environment setup** at `./setup.sh` (runs once per cloud session before the agent starts).
4. Paste a prompt from [`routines/`](routines/) (or write your own; keep it self-contained—routines are stateless).
5. In the routine repo settings, enable **Allow unrestricted branch pushes** if agents should push outside `claude/*` (this org chose unrestricted pushes; still prefer `claude/<slug>` branches for PRs—see [`CLAUDE.md`](CLAUDE.md)).

### As a plugin in another repo

Enable the plugin that resolves to this package, or copy `.claude/` into your project. The manifest lives at [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) and reuses paths under `.claude/` so there is a single source of truth.

### Install into a target repo (symlink)

```bash
./scripts/install.sh /path/to/other-repo
```

Use `./scripts/install.sh --dry-run /path/to/other-repo` to preview.

## Repo layout

| Path | Purpose |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Project memory loaded every session |
| [`.claude/skills/`](.claude/skills/) | Skills (also `/command` names when named there) |
| [`.claude/agents/`](.claude/agents/) | Subagent definitions |
| [`.claude/rules/`](.claude/rules/) | Scoped rules |
| [`.claude/hooks/`](.claude/hooks/) | Hook scripts + [`hooks.json`](.claude/hooks/hooks.json) for plugin installs |
| [`routines/`](routines/) | Source-of-truth routine prompts to paste into the web UI |
| [`scripts/`](scripts/) | Validators and installers |

## Prerequisites

- **GitHub CLI**: `gh auth login -h github.com` must succeed before `gh repo create` / push (see [Contributing](docs/contributing.md)).
- **Python 3.11+** for `scripts/validate.py` (stdlib only; also used in CI).

## License

MIT — see [LICENSE](LICENSE).
