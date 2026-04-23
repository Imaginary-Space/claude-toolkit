# Architecture

## Hybrid layout

`claude-toolkit` is simultaneously:

1. **A Claude Code project** — committed `.claude/` is auto-discovered when this repository is the working tree (including cloud **Routines** that clone it).
2. **A Claude Code plugin** — [`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json) re-exports the same `.claude/` paths so other repositories can enable the plugin without duplicating files.

## Discovery order (high level)

Claude Code loads project configuration from the repository root and `.claude/` according to the upstream [`.claude` directory reference](https://code.claude.com/docs/en/claude-directory.md). Skills under `.claude/skills/*/SKILL.md` are the primary workflow surface (slash commands merged into skills).

## Hooks

- **Project hooks** live in [`.claude/settings.json`](../.claude/settings.json) and merge at runtime.
- **Plugin hooks** for installs are mirrored in [`.claude/hooks/hooks.json`](../.claude/hooks/hooks.json) so enabling the plugin still registers the same safety handlers.

## Routines vs local sessions

| Aspect | Routine (cloud) | Local interactive |
| --- | --- | --- |
| Filesystem | Fresh clone of selected repos | Your working tree |
| Memory | None between runs | Session + CLAUDE.md + auto memory |
| Permissions | No interactive prompts | Prompts / modes |
| Safety | Hooks + prompt discipline | Hooks + settings + prompts |

See [`docs/routines.md`](routines.md).
