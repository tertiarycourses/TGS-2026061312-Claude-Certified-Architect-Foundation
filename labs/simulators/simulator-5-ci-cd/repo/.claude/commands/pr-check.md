---
description: Nightly PR check for refund and escalation logic
argument-hint: <pr-number>
allowed-tools: Read, Grep, Glob
---
Review pull request $ARGUMENTS in this repository. Read stock/api.py and stock/jobs.py, apply prompts/review-criteria.txt from the lab folder if present, and answer with at most five lines: the files inspected and the single most serious finding.
