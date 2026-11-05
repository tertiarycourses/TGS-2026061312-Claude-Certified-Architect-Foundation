---
name: codebase-map
description: Map an unfamiliar area of the Orderly codebase and return a short summary of entry points, data flow and tests. Use before any multi-file change.
context: fork
allowed-tools: Read, Grep, Glob
argument-hint: <directory-or-feature-name>
---
# Codebase map

You run in a forked context so the verbose Grep and Read output stays out of the main conversation.

1. `Glob` the requested area for source and test files.
2. `Grep` for exported symbols, then `Read` only the files that define them.
3. Return at most 25 lines: entry points, the main data flow, external calls, and which tests cover the area.
4. Do not edit anything. If you need to write, stop and report that the task needs the main session.
