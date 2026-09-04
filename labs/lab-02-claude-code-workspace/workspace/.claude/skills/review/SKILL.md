---
name: review
description: Review a bounded change against its acceptance criteria.
---
# Review

Inputs: changed paths and acceptance criteria.

1. Inspect the diff and relevant tests.
2. Identify correctness, security, and maintainability defects.
3. Return findings with file, line, severity, evidence, and remediation.
4. If no actionable defect exists, return `PASS`.

Verification: every finding must cite observable code or test evidence.
