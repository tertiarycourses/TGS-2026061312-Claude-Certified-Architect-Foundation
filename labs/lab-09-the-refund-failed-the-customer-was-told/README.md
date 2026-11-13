# Lab 9: The refund failed. The customer was told it worked.
> Day 1 · Topic 2: Tool Design & MCP Integration · Task statement 2.2 · Simulator 1: Customer Support Resolution Agent · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 2.2: **Implement structured error responses for MCP tools.** You answer one exam-style question, then run the Customer Support Resolution Agent simulator once and watch the right answer work with a real Claude call.

## The scenario
You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to your backend systems through custom Model Context Protocol (MCP) tools (get_customer, lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact resolution while knowing when to escalate.

## The question
A refund operation sometimes fails because the order is outside the return window, but the agent treats the MCP response as a successful refund and tells the customer it was completed. What change should this team make to communicate the tool failure correctly?

- **A.** Return a normal tool result containing an error field and ask the agent to infer failure from the content.
- **B.** Return a CallToolResult with isError: true and include structured failure details in the result content.
- **C.** Return a CallToolResult with isError: false and include structured failure details in the result content.
- **D.** Raise a protocol-level server exception and include structured failure details in the exception message.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **1. Customer Support Resolution Agent**.
3. Click **Lab 9** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-1-customer-support
uv run support_agent.py --case CS-11
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 9` from the `labs` folder.

## What you will see
What to look for: The refund on ORD-5508 is never issued, and the reply never claims it was.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: escalate_to_human, get_customer, lookup_order, process_refund, recommend_refund
Turn 1: sending the conversation to Claude
  -> get_customer({"email": "sofia@example.com", "name": "Sofia"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"customer_id": "C-1003", "name": "Sofia Alvarez", "email": "sofia@example.com", "tier": "standard", "created_at": "2026-07-01T00:00:00Z…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> lookup_order({"order_id": "ORD-5508", "customer_id": "C-1003"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"order_id": "ORD-5508", "customer_id": "C-1003", "amount": 140.0, "item": "Bookshelf", "placed_at": "2026-08-05T00:00:00Z", "status": "…
Turn 3: sending the conversation to Claude, with the tool results appended
  claude: CASE FACTS - Customer: C-1003 (Sofia Alvarez), verified - Order: ORD-5508, Bookshelf, $140.00 - Placed: 2026-08-05; delivered (eta 2026-08-…
  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends
...
  reply: CASE FACTS | - Customer: C-1003 (Sofia Alvarez), verified | - Order: ORD-5508, Bookshelf, $140.00 | - Placed: 2026-08-05; delivered (eta 202…
Estimated API cost: US$0.0007 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
```

How to read the output:

| Output line | What it means |
|---|---|
| `connected: claude-haiku-5-5, tools: …` | The run started on Claude Haiku 5.5 and lists the tools Claude may call. |
| `Turn N: sending the conversation to Claude` | One trip round the agent loop: the whole conversation so far goes to the Claude API. |
| `-> tool_name({...})` | Claude asked to call a tool, with these inputs. |
| `<- result: …` / `!! tool error: …` | The tool's answer, appended to the conversation for Claude's next turn. `!!` marks an error or a hook that blocked the call. |
| `stop_reason: tool_use` / `end_turn` | Why Claude stopped: `tool_use` means run the tool and loop again; `end_turn` means Claude has finished. |
| `(subagent)` | The line came from a subagent working in its own context, not the main conversation. |
| `PASS` / `FAIL` | The simulator's automatic checks on what Claude actually did. |
| `Estimated API cost` | What the run cost on your API key at Haiku 5.5 prices. |

## Why it happens
The tool now returns a CallToolResult with isError: true and structured details when ORD-5508 falls outside the return window. That flag tells the agent the business action failed even though the MCP call itself succeeded, so the agent cannot read the response as a completed refund. Whether it refuses from policy or calls process_refund and reads the error, no refund is issued.

## Check your answer
**The answer is B.** Return a CallToolResult with isError: true and include structured failure details in the result content.

In MCP a tool call can succeed at the protocol level yet fail at the business-logic level. The pattern is to return a CallToolResult with isError: true and put useful recovery context in the content. Failures differ (policy violation, invalid date, missing order, permission denied), and structured details let the agent pick the next step: explain the rule, correct the input, retry a transient error, or escalate. Spelling and value both matter: camelCase isError , set to true .

- **A** falls short: Not the documented MCP error signal. The response still looks like a success.
- **C** falls short: isError: false explicitly signals success.
- **D** falls short: Protocol errors are for protocol failures. A business-rule failure belongs in the result, where the agent can reason about recovery.

## Try this
Copy a file in cases/ to a new CS id, change the customer's message and expected disposition, rerun with --case, then score it with evaluate.py.

## How the exam tests this
Signal a business failure with isError: true inside the result. An error field buried in a normal result still looks like success, and a protocol-level exception is the wrong layer for a policy rule.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-1-customer-support/evidence/`.
