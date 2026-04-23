# Routine prompt templates

These Markdown files are **source-of-truth prompts** for [Claude Code Routines](https://code.claude.com/docs/en/routines). Routines themselves are configured in the Claude Code web UI; paste the **Prompt** section from each file into your routine.

## Checklist for every routine

1. Select repository **`imaginary-space/claude-toolkit`** and branch **`main`** (unless you intentionally fork).
2. Set **environment setup** to `./setup.sh`.
3. Attach the smallest set of **connectors** (MCP) the routine truly needs.
4. Keep the saved prompt **self-contained**—assume **no memory** between runs.
5. If you need unrestricted pushes, enable that in the routine repo settings (org policy).

See also [`docs/routines.md`](../docs/routines.md).
