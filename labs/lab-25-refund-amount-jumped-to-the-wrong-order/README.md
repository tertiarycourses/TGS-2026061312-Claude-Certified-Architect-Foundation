# Lab 25: Refund amount jumped to the wrong order
> Day 1 · Topic 5: Context Management & Reliability · Task statement 5.1 · Simulator 1: Customer Support Resolution Agent · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 5.1: **Manage conversation context to preserve critical information across long interactions.** You answer one exam-style question, then run the Customer Support Resolution Agent simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=25](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=25), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim1?lab=25](http://localhost:8765/sim1?lab=25).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run support_agent.py --case CS-12` from `simulators/simulator-1-customer-support`.
- **The code it runs:** [simulators/simulator-1-customer-support/support_agent.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/support_agent.py), with the case file [simulators/simulator-1-customer-support/cases/CS-12.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/cases/CS-12.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to your backend systems through custom Model Context Protocol (MCP) tools (get_customer, lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact resolution while knowing when to escalate.

## The question
Production transcripts from the support resolution agent show that, after long conversations involving multiple orders, the agent sometimes applies a refund amount from one issue to a different order after older turns have been summarized. What change would most effectively preserve the critical issue details across the session?

- **A.** Summarize the complete conversation more frequently and replace prior summaries whenever the context grows large.
- **B.** Maintain a structured case-facts block that is updated after each relevant turn and made available on every relevant turn.
- **C.** Add a system instruction telling the agent to remember all order IDs and refund amounts throughout the case.
- **D.** Place the most recent order-lookup result at the end of the prompt before the agent response.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **1. Customer Support Resolution Agent**.
3. Click **Lab 25** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-1-customer-support
uv run support_agent.py --case CS-12
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 25` from the `labs` folder.

## What you will see
What to look for: After three turns the only refund is $45 on ORD-5503.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: escalate_to_human, get_customer, lookup_order, process_refund, recommend_refund
Turn 1: sending the conversation to Claude
  -> get_customer({"email": "meilin@example.com", "name": "Meilin"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"customer_id": "C-1001", "name": "Mei Lin Tan", "email": "meilin@example.com", "tier": "standard", "created_at": "2026-01-01T00:00:00Z"…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> lookup_order({"order_id": "ORD-5501", "customer_id": "C-1001"})
  -> lookup_order({"order_id": "ORD-5503", "customer_id": "C-1001"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"order_id": "ORD-5501", "customer_id": "C-1001", "amount": 120.0, "item": "Ceramic table lamp", "placed_at": "2026-10-01T00:00:00Z", "s…
  <- result: {"order_id": "ORD-5503", "customer_id": "C-1001", "amount": 45.0, "item": "Desk organiser", "placed_at": "2026-10-24T00:00:00Z", "status…
Turn 3: sending the conversation to Claude, with the tool results appended
...
  refund check: recommend_refund {"order_id": "ORD-5503", "item_adjustments": [{"sku": "WHOLE", "amount": 45}], "shipping_refund": 0, "merchand -> va…
  reply: CASE FACTS | - Customer: C-1001 (Mei Lin Tan) | - ORD-5503: Desk organiser, $45.00, 2 charges (duplicate) | - Refund RF-85579: $45.00 cash, …
Estimated API cost: US$0.0047 for 3 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
Summarising older turns compresses exactly the order IDs and amounts that matter, so refunds drift between orders. The orchestration layer owns a CASE FACTS block, updates it as evidence arrives and opens every turn with it, so Claude reads exact values rather than a lossy summary. After three turns the facts still tie the single $45 refund to ORD-5503.

## Check your answer
**The answer is B.** Maintain a structured case-facts block that is updated after each relevant turn and made available on every relevant turn.

Separate critical case state from the conversational transcript. A structured facts block (customer_id, order_id, disputed amount, refund status, customer statements, policy decisions, open issues) is updated by the orchestration layer as evidence arrives and supplied whenever decisions depend on exact facts. The Agent SDK adds session persistence and automatic compaction, but compaction and summarisation are lossy for precise transactional details. Use summaries for low-value dialogue and keep exact data as structured state your application owns.

- **A** falls short: More frequent summarisation means more lossy compression of exactly the details that are going wrong.
- **C** falls short: An instruction to “remember” adds no durable context layer.
- **D** falls short: A recency trick that covers only the latest lookup. Facts about the other orders are still lost.

## Try this
Copy a file in cases/ to a new CS id, change the customer's message and expected disposition, rerun with --case, then score it with evaluate.py.

## How the exam tests this
Keep transactional facts as structured state your application owns and resends; let summaries cover small talk only. Reject "tell the agent to remember", which adds no durable context, and reject summarising more often, which loses more detail.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-1-customer-support/evidence/`.
