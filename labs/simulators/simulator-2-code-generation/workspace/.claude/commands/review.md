---
description: Run the team's standard code review checklist on the current diff
argument-hint: [base-branch]
allowed-tools: Bash(git diff:*), Bash(git log:*), Read, Grep, Glob
---
Review the diff against `$ARGUMENTS` (default `main`) using `docs/standards/review-criteria.md`.

1. List each changed file and its purpose in one line.
2. Report only correctness, security and data-loss findings, each with file, line, evidence and a suggested fix.
3. Confirm the tests in `docs/standards/testing.md` are present for every bug fix.
4. End with `VERDICT: approve` or `VERDICT: request-changes`.
