#!/usr/bin/env python3
"""Validate claude-toolkit SKILL.md, agent markdown, and plugin manifest (stdlib only)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL_MAX_LINES = 500
NAME_MAX = 64
DESC_MAX = 1024


def split_frontmatter(text: str) -> tuple[dict[str, str], str] | tuple[None, str]:
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return None, text
    fm_raw = text[4:end]
    body = text[end + 5 :]
    return _parse_simple_yaml(fm_raw), body


def _parse_simple_yaml(block: str) -> dict[str, str]:
    """Parse a tiny subset of YAML used in our frontmatter (scalars and >- blocks)."""
    data: dict[str, str] = {}
    lines = block.splitlines()
    i = 0
    key_re = re.compile(r"^([A-Za-z0-9_-]+):\s*(.*)$")
    while i < len(lines):
        raw = lines[i]
        if not raw.strip():
            i += 1
            continue
        m = key_re.match(raw)
        if not m:
            i += 1
            continue
        key, rest = m.group(1), m.group(2).strip()
        if rest in (">-", ">", "|"):
            i += 1
            chunks: list[str] = []
            while i < len(lines) and lines[i].startswith((" ", "\t")):
                chunks.append(lines[i].strip())
                i += 1
            data[key] = " ".join(chunks).strip()
            continue
        val = rest
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        data[key] = val
        i += 1
    return data


def err(path: Path, msg: str) -> None:
    print(f"{path.relative_to(ROOT)}: {msg}", file=sys.stderr)


def validate_skill(path: Path) -> list[str]:
    issues: list[str] = []
    text = path.read_text(encoding="utf-8")
    fm, body = split_frontmatter(text)
    if fm is None:
        issues.append("missing or malformed YAML frontmatter (expected leading --- block)")
        return issues
    name = fm.get("name")
    desc = fm.get("description")
    if not name:
        issues.append("missing frontmatter 'name'")
    else:
        if len(name) > NAME_MAX:
            issues.append(f"name longer than {NAME_MAX} chars")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name):
            issues.append("name must be lowercase kebab-case")
    if not desc:
        issues.append("missing frontmatter 'description'")
    elif len(desc) > DESC_MAX:
        issues.append(f"description longer than {DESC_MAX} chars")
    line_count = len(body.splitlines())
    if line_count > SKILL_MAX_LINES:
        issues.append(f"body exceeds {SKILL_MAX_LINES} lines ({line_count})")
    return issues


def validate_agent(path: Path) -> list[str]:
    issues: list[str] = []
    text = path.read_text(encoding="utf-8")
    fm, _body = split_frontmatter(text)
    if fm is None:
        issues.append("missing or malformed YAML frontmatter")
        return issues
    for key in ("name", "description"):
        if not fm.get(key):
            issues.append(f"missing frontmatter '{key}'")
    return issues


def validate_output_style(path: Path) -> list[str]:
    """output-styles use the same frontmatter pattern as skills for name/description."""
    return validate_skill(path)


def validate_plugin_manifest(path: Path) -> list[str]:
    issues: list[str] = []
    data = json.loads(path.read_text(encoding="utf-8"))
    for key in ("name", "version"):
        if key not in data:
            issues.append(f"missing '{key}' in plugin.json")
    return issues


def main() -> int:
    bad = False

    skills_root = ROOT / ".claude" / "skills"
    for skill_md in sorted(skills_root.glob("*/SKILL.md")):
        probs = validate_skill(skill_md)
        if probs:
            bad = True
            for p in probs:
                err(skill_md, p)

    agents_dir = ROOT / ".claude" / "agents"
    for agent_md in sorted(agents_dir.glob("*.md")):
        probs = validate_agent(agent_md)
        if probs:
            bad = True
            for p in probs:
                err(agent_md, p)

    styles_dir = ROOT / ".claude" / "output-styles"
    for style_md in sorted(styles_dir.glob("*.md")):
        probs = validate_output_style(style_md)
        if probs:
            bad = True
            for p in probs:
                err(style_md, p)

    plugin = ROOT / ".claude-plugin" / "plugin.json"
    if plugin.exists():
        try:
            probs = validate_plugin_manifest(plugin)
        except json.JSONDecodeError as exc:
            bad = True
            err(plugin, f"invalid JSON: {exc}")
        else:
            if probs:
                bad = True
                for p in probs:
                    err(plugin, p)

    if bad:
        return 1
    print("validate.py: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
