---
name: review
description: Review one source file against this repo's conventions and report findings as a short table. Use when asked to review a file or a change.
allowed-tools: Read, Grep, Glob
---
Review the file given in $ARGUMENTS.

1. Read the file and CLAUDE.md.
2. Check each convention in CLAUDE.md, plus correctness bugs.
3. Report a table: line | severity (high/medium/low) | finding | fix. At most 5 rows. High only for wrong results or money errors.
4. End with one line: VERDICT: PASS (no high findings) or VERDICT: FAIL.
