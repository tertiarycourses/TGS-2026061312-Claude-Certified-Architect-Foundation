---
paths:
  - "**/*.test.*"
---
# Test file conventions (apply wherever the test lives)
- Name tests `it("<verb> <expected outcome> when <condition>")`.
- One `describe` block per exported symbol.
- Use `vi.useFakeTimers()` for anything time-dependent; no real sleeps.
