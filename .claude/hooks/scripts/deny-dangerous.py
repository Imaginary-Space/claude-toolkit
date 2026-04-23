#!/usr/bin/env python3
"""PreToolUse hook: deny clearly destructive Bash commands (stdin JSON from Claude Code)."""
from __future__ import annotations

import json
import re
import sys

DENY_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\brm\s+(-[^\s]+\s+)*-rf\b"), "rm -rf"),
    (re.compile(r"\brm\s+(-[^\s]+\s+)*-fr\b"), "rm -fr"),
    (re.compile(r"\bdd\s+.*\bif=/dev/"), "dd from block device"),
    (re.compile(r"\bmkfs\b"), "mkfs"),
    (re.compile(r":\s*>\s*/dev/"), "clobbering device file"),
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    cmd = ""
    tool_input = payload.get("tool_input") or {}
    if isinstance(tool_input, dict):
        cmd = str(tool_input.get("command") or "")

    for pat, reason in DENY_PATTERNS:
        if pat.search(cmd):
            out = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Blocked ({reason}) by claude-toolkit hook.",
                }
            }
            sys.stdout.write(json.dumps(out))
            return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
