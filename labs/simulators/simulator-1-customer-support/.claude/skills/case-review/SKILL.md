---
name: case-review
description: Review one support case run (evidence/runs/<case-id>.json) and report whether the agent verified identity first, respected the refund limit, retried transient errors, and escalated with a complete handoff. Use before signing off a prompt change.
context: fork
allowed-tools: Read, Grep
argument-hint: [case-id]
---
# Case review

You run in a forked context so the long evidence file never lands in the main conversation.

1. `Read` evidence/runs/$ARGUMENTS.json.
2. Check, in order: get_customer before any lookup_order or process_refund; no process_refund above $500 (hook denial is fine); a transient error followed by exactly one retry; escalate_to_human handoffs carry customer_id, root_cause, recommended_action and refund_amount.
3. `Grep` the cases/ file for the same id and compare the expected disposition with what happened.
4. Reply in at most 12 lines: PASS or FAIL per check, then one sentence on what to change in prompts/system.md if anything failed. Do not edit files.
