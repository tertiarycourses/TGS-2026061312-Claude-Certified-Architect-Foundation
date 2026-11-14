# Lab 34: Vibe-code a PostToolUse hook that cleans the data, then prove the agent works

> Day 2 · Lab 34 of 4 (one agent, built in four steps) · Scenario 1: Customer Support Resolution Agent · Task statement 1.5 · Vibe-coding lab · Claude Haiku 5.5 · 45 minutes

**In Lab 31, Mei Lin asked where her monitor arm was, and Claude got `"status": 2` and a Unix timestamp. It had to guess. Clean every tool result in code before Claude reads it, log every hook decision, then prove the whole agent with nine live checks.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab. Copy the prompts from [this lab's prompt page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-34.html), or from `prompts.html` in this folder.

## Day 2: one agent, four labs

| Lab | You add | Exam tasks |
|---|---|---|
| 31 | the agentic loop and four tools, with the Anthropic Python SDK | 1.1, 2.1 |
| 32 | an MCP server for the tools; the agent becomes an MCP client | 2.4, 2.2 |
| 33 | a PreToolUse hook that blocks refunds above $500 | 1.5, 1.4 |
| **34 (this lab)** | a PostToolUse hook that cleans raw data, and live tests | 1.5 |

## What you'll build

```
  customer message
        |
        v
  agent.py -- the agentic loop (claude-haiku-5-5), MCP client
        |
        +-- PreToolUse hook (hooks.py): BEFORE every tool call
        |     process_refund above $500 -> DENY, escalate instead
        |
        +-- MCP client == stdio ==> support_server.py (4 tools, raw backend.json data)
        |
        +-- PostToolUse hook (hooks.py): AFTER every tool call, BEFORE Claude reads it
        |     placed_at 1793318400 -> "2026-10-30T00:00:00Z", status 2 -> "shipped"
        |
        +-- audit.log: one JSON line per hook decision
```

This is the finished agent, the one you watched on Day 1 in Labs 1, 4 and 5, now built by you.

## What's in this folder

| File | What it is |
|---|---|
| `prompts.html` | every prompt below, each with a Copy button |
| `solution/` | the finished agent: `tools.py`, `support_server.py`, `hooks.py`, `agent.py`, `test_agent.py` |
| `sample-output.txt` | a live run from `solution/`: the ORD-5504 case, `audit.log`, then `test_agent.py` with 9/9 checks |

## Before you start

Keep working in your project folder from Lab 33: the $780 refund must be denied and escalated. Didn't finish? Copy everything from Lab 33's `solution/` folder into an empty folder, add your `.env`, and start here.

## Step 1 · Add the PostToolUse hook and an audit log (20 minutes)

### Prompt 1

```text
Add a PostToolUse hook to hooks.py and wire it into agent.py.

- post_tool_use(tool_name, tool_input, result) runs after every successful tool call, BEFORE Claude sees the result.
  It returns (clean_result, changes), where changes is a list of what it changed.
- Normalise: a numeric placed_at (Unix seconds) becomes an ISO 8601 UTC string such as 2026-10-01T00:00:00Z;
  a numeric status becomes text (1 pending, 2 shipped, 3 delivered).
- In agent.py, send Claude the clean result (not the raw one), keep the clean result in the calls list, and print
  each change, for example "PostToolUse normalised status 2 -> shipped".
- Both hooks also append one JSON line per decision to audit.log: time, hook name, tool, input, and the decision
  or the changes.

Run: uv run agent.py "meilin@example.com here. Where is my monitor arm, order ORD-5504?"
Show me the output, then the last 4 lines of audit.log.
```

**Checkpoint.** `PostToolUse normalised placed_at 1793318400 -> 2026-10-30T00:00:00Z` and `status 2 -> shipped`. This time the reply says the monitor arm has **shipped**, with an ETA of 18 November 2026: no guessing. `audit.log` has a PreToolUse line and a PostToolUse line for every tool call.

## Step 2 · Prove it with live tests (25 minutes)

### Prompt 2

```text
Write test_agent.py. It imports run_agent from agent.py, runs three live cases, prints PASS or FAIL for each check,
and prints a total. Check behaviour from the recorded tool calls, not from Claude's wording (it changes every run).

Case A: "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Please refund it."
  - get_customer was called before lookup_order
  - the lookup_order result Claude saw has status "delivered" (the PostToolUse hook ran)
  - exactly one refund of 120 was issued
Case B: "This is arjun@example.com. The standing desk in ORD-5502 arrived with a bent frame, photos attached. Refund the full amount."
  - no refund was issued
  - escalate_to_human was called with refund_amount 780
  - every denied process_refund call was above 500
Case C: "meilin@example.com here. Where is my monitor arm, order ORD-5504?"
  - lookup_order was called
  - the reply says the order has shipped
  - no refund and no escalation

Run `uv run test_agent.py`. If a check fails, show me why and fix agent.py or hooks.py, not the test. Then run it again.
```

**Checkpoint.** `9/9 checks passed`. Take a screenshot of the final lines: that is your evidence for Day 2. In our tests (14 Nov 2026), Claude Code and Codex each reached 9/9 in 4 out of 4 runs of the full Lab 31–34 prompt series. Not a benchmark.

## Run it

From your project folder:

| What | Command |
|---|---|
| The whole test suite: three live cases, nine checks | `uv run test_agent.py` |
| Any one customer | `uv run agent.py "your customer message"` |
| See what the hooks decided | `tail -n 20 audit.log` (Windows PowerShell: `Get-Content audit.log -Tail 20`) |
| Check the MCP server on its own | `uv run check_server.py` |

To run the finished reference agent, go into `solution/`, copy `.env.example` to `.env`, add your key, then run `uv run test_agent.py`. Our run is in `sample-output.txt`.

## Stretch · The same hooks in the Claude Agent SDK (Bonus Lab 36)

```text
Make agent_sdk.py: the same agent built with the Claude Agent SDK (uv add claude-agent-sdk), model claude-haiku-5-5.
Connect support_server.py as an external stdio MCP server, and register the two rules from hooks.py as a PreToolUse
HookMatcher (deny process_refund above 500) and a PostToolUse HookMatcher (normalise placed_at and status).
Run it on the Arjun $780 case and show me the output.
```

Compare the two: the SDK runs the loop for you, but the hook contract is the same. Deny before the call, rewrite after it.

## Explain it back (with your trainer)

- **1.** Why clean `placed_at` and `status` in a hook instead of in the server? (Hint: you may not own the server, and Claude Code reads it raw.)
- **2.** Your AI wrote all the code. How do you know it works? Point to the check that proves each behaviour.
- **3.** Why do the tests check tool calls and not Claude's exact words?

## Troubleshooting

| You see | Fix prompt |
|---|---|
| Claude still says "status 2" | "Send Claude the clean result from post_tool_use, not the raw text from the server." |
| `audit.log` is empty | "Both hooks must append to audit.log on every call, allowed or denied." |
| A test fails on Claude's wording | "Check the recorded tool calls, not the reply text, except for the 'shipped' check." |
| `RuntimeError: asyncio.run() cannot be called from a running event loop` | "test_agent.py must await run_agent inside one asyncio.run(main())." |
| Case B fails because Claude escalated without trying the refund | That's a pass for safety. "Every denied call was above 500" is still true when nothing was denied. |
