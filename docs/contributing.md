# Contributing

## Prerequisites

- Python **3.11+** (`scripts/validate.py` uses the stdlib only)
- **GitHub CLI** authenticated (`gh auth login -h github.com`) if you will create repos or push from automation

## Local validation

```bash
./setup.sh
python3 scripts/validate.py
```

## Pull requests

- Use the **`pr-workflow`** skill conventions (`claude/<slug>` branches, clear commits).
- Keep changes scoped; this repository is meant to be low-churn and high-trust.

## Adding a skill

```bash
./scripts/new-skill.sh my-skill
# edit .claude/skills/my-skill/SKILL.md
python3 scripts/validate.py
```

## Security

- Never commit tokens or private keys.
- If a hook or script could block legitimate workflows, document the escape hatch in `CLAUDE.md` and the skill that owns the behavior.
