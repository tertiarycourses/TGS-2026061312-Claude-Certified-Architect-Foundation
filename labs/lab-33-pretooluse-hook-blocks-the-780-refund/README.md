# Lab 33: Vibe-code a PreToolUse hook that blocks the $780 refund

> Day 2 · Bonus Topic A · Lab 33 of 4 (one agent, built in four steps) · Scenario 1: Customer Support Resolution Agent · Task statements 1.5, 1.4 · Vibe-coding lab · Claude Haiku 5.5 · 30 minutes

**In Lab 31 your agent paid Arjun $780 with nobody's approval. You could add "refunds above $500 need a human" to the prompt, and one edit later it's gone (Day 1, Lab 5). Put the rule in code that runs before every tool call, and no prompt edit can remove it.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab. Copy the prompts from [this lab's prompt page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-33.html), or from `prompts.html` in this folder.

## Bonus Topic A: one agent, four labs

| Lab | You add | Exam tasks |
|---|---|---|
| 31 | the agentic loop and four tools, with the Anthropic Python SDK | 1.1, 2.1 |
| 32 | an MCP server for the tools; the agent becomes an MCP client | 2.4, 2.2 |
| **33 (this lab)** | a PreToolUse hook that blocks refunds above $500 | 1.5, 1.4 |
| 34 | a PostToolUse hook that cleans raw data, and live tests | 1.5 |

Bonus Topic B, Lab 35, builds a multi-agent research team in a project folder of its own.

## What you'll build

```
  agent.py -- the agentic loop, MCP client
        |
        +-- PreToolUse hook (hooks.py): runs BEFORE every tool call
        |     process_refund above $500 -> DENY: the tool never runs,
        |     Claude reads the reason and calls escalate_to_human instead
        |
        +-- MCP client == stdio ==> support_server.py (4 tools)
```

The $500 limit lives in `hooks.py` only: not in the system prompt, not in the tool descriptions and not in the server. The hook decides, every time, whatever the model thinks.

## What's in this folder

| File | What it is |
|---|---|
| `prompts.html` | every prompt below, each with a Copy button |
| `solution/` | our finished code, for your trainer. You don't need it: build your own with the prompts. |
| `sample-output.txt` | a live run of the $780 case from `solution/` |

## Before you start

Keep working in your project folder from Lab 32: `agent.py` must list the MCP tools and refund Mei Lin's $120 lamp. Stuck? Ask your trainer.

## Step 1 · Watch it go wrong first (5 minutes, no code change)

### Prompt 1

```text
Do not change any code. Run this and show me the output:
uv run agent.py "This is arjun@example.com. The standing desk in ORD-5502 arrived with a bent frame, photos attached. Refund the full amount."
Then tell me how much money left the company and who approved it.
```

**Checkpoint.** `process_refund` runs for **$780**. Nobody approved it. This is Day 1 Lab 5, Phase 1, now in your own code.

## Step 2 · Add the PreToolUse hook (25 minutes)

### Prompt 2

```text
Create hooks.py with a PreToolUse hook and wire it into agent.py.

- pre_tool_use(tool_name, tool_input) runs before EVERY tool call. It returns {"decision": "allow"} or
  {"decision": "deny", "reason": "..."}.
- The rule: if tool_name is process_refund and amount > 500, deny with this reason:
  "Policy: refunds above $500 need human approval. Do not retry process_refund. Call escalate_to_human with refund_amount=<amount> instead."
- In agent.py, call pre_tool_use before session.call_tool. On deny, do NOT call the tool: send back a tool_result with
  is_error true and the reason as its content, add the call to the calls list with "denied": True, and print
  "PreToolUse DENY <tool>(<input>): <reason>".
- Keep the $500 limit in hooks.py only. Do not add it to the system prompt, the tool descriptions or the server.

Run the Arjun $780 case again and show me the output.
```

**Checkpoint.** `PreToolUse DENY process_refund(... 780 ...)`. On the next turn Claude calls `escalate_to_human` with `refund_amount` **780**, and the reply says a human will approve the refund. No refund is issued. If Claude escalates without trying the refund first, that's safe too: the hook simply had nothing to block. Run it again to see the deny.

Now run Mei Lin's $120 lamp: it still goes through. The hook only stops what breaks the rule.

## Run it

From your project folder. Run them yourself in a terminal, or paste one into your coding tool's chat as "Run: <command> and show me the output."

| What | Command |
|---|---|
| Arjun's $780 desk: denied, then escalated | `uv run agent.py "This is arjun@example.com. The standing desk in ORD-5502 arrived with a bent frame, photos attached. Refund the full amount."` |
| Mei Lin's $120 lamp: still allowed | `uv run agent.py "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please."` |

## Stretch · An identity gate (Day 1, Lab 4)

```text
Add a second rule to pre_tool_use in hooks.py: deny lookup_order, process_refund and escalate_to_human until
get_customer has succeeded in this conversation. The deny reason should tell Claude to verify the customer by email first.
Run: uv run agent.py "Where is order ORD-5504?" and show me the output.
```

Claude can't skip verification any more, however the customer words the request.

## Explain it back (with your trainer)

- **1.** Why does a PreToolUse hook hold the $500 rule when a line in the prompt doesn't?
- **2.** What does Claude see when the hook denies a call, and why does the reason tell it what to do next?
- **3.** Could a PostToolUse hook do the same job? (Hint: when does it run?)

## Troubleshooting

| You see | Fix prompt |
|---|---|
| The $780 refund still goes through | "pre_tool_use must run before session.call_tool, and a deny must skip the call." |
| `tool_use ids were found without tool_result blocks` | "A denied call still needs a tool_result, in the same user message as the others." |
| Claude retries process_refund again and again | "Send the deny reason as the tool_result content with is_error true." |
| Mei Lin's $120 refund is blocked too | "Deny only when amount > 500." |
