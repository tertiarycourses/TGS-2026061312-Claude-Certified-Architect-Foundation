---
paths:
  - "**/*.test.js"
---
# Testing rules (load only when a test file is in play)

- One `describe` per exported function; test names start with "returns" or "throws".
- Every money test checks cents, never dollars.
- No network or clock in tests: inject them.
