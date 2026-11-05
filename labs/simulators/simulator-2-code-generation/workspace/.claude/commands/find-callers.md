---
description: Locate every reference to a renamed helper in TypeScript source and return jump-to locations
argument-hint: <helper-name>
allowed-tools: Grep
---
Use the Grep tool with pattern `$ARGUMENTS`, glob `**/*.ts` and `output_mode: content` so each match comes back as `path:line: text`.
Do not use Glob (that finds files by name, not callers) and do not run grep through Bash.
Return the matches as a list of `path:line` followed by the matching line, nothing else.
