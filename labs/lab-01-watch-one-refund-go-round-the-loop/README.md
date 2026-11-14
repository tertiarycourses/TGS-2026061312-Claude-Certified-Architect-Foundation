# Lab 1: Watch one refund go round the loop
> Day 1 · Topic 1: Agentic Architecture & Orchestration · Task statement 1.1 · Simulator 1: Customer Support Resolution Agent · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 1.1: **Design and implement agentic loops for autonomous task execution.** You answer one exam-style question, then run the Customer Support Resolution Agent simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=1](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=1), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim1?lab=1](http://localhost:8765/sim1?lab=1).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run support_agent.py --case CS-01` from `simulators/simulator-1-customer-support`.
- **The code it runs:** [simulators/simulator-1-customer-support/support_agent.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/support_agent.py), with the case file [simulators/simulator-1-customer-support/cases/CS-01.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/cases/CS-01.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to your backend systems through custom Model Context Protocol (MCP) tools (get_customer, lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact resolution while knowing when to escalate.

## The question
A customer writes in: the ceramic lamp in ORD-5501 arrived cracked, and they want a refund. Your agent has its tools and a loop that keeps calling Claude. When should that loop stop?

- **A.** Stop as soon as the model writes something that sounds finished.
- **B.** Continue while stop_reason is tool_use, appending every tool result, and stop when stop_reason is end_turn.
- **C.** Stop after a fixed three iterations, whatever stop_reason comes back, to cap cost.
- **D.** Stop as soon as the first tool returns a result, and send that result to the customer.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **1. Customer Support Resolution Agent**.
3. Click **Lab 1** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-1-customer-support
uv run support_agent.py --case CS-01
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 1` from the `labs` folder.

## What you will see
What to look for: Real stop_reason on every turn: tool_use after get_customer, lookup_order, recommend_refund and process_refund, each result appended, then end_turn stops the loop with a $120 refund.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: escalate_to_human, get_customer, lookup_order, process_refund, recommend_refund
Turn 1: sending the conversation to Claude
  -> get_customer({"email": "meilin@example.com", "name": "Meilin"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"customer_id": "C-1001", "name": "Mei Lin Tan", "email": "meilin@example.com", "tier": "standard", "created_at": "2026-01-01T00:00:00Z"…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> lookup_order({"order_id": "ORD-5501", "customer_id": "C-1001"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"order_id": "ORD-5501", "customer_id": "C-1001", "amount": 120.0, "item": "Ceramic table lamp", "placed_at": "2026-10-01T00:00:00Z", "s…
Turn 3: sending the conversation to Claude, with the tool results appended
  -> recommend_refund({"order_id": "ORD-5501", "item_adjustments": [{"sku": "WHOLE", "amount": 120}], "shipping_refund": 0, "mercha…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
...
  refund check: recommend_refund {"order_id": "ORD-5501", "item_adjustments": [{"sku": "WHOLE", "amount": 120}], "shipping_refund": 0, "merchan -> va…
  reply: CASE FACTS | - Customer: C-1001 (Mei Lin Tan), verified | - Order: ORD-5501, ceramic table lamp, $120.00, delivered, placed 2026-10-01, dama…
Estimated API cost: US$0.0010 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
The loop reads stop_reason, not the wording of the reply. Each tool_use turn means Claude wants a tool run, so the loop executes get_customer, lookup_order, recommend_refund and process_refund in turn and appends every result before calling Claude again. Only when Claude returns end_turn does the loop stop, which is why the $120 refund lands before the run ends.

## Check your answer
**The answer is B.** Continue while stop_reason is tool_use, appending every tool result, and stop when stop_reason is end_turn.

stop_reason is the loop's control signal: tool_use means run the tool and call Claude again with the result appended; end_turn means Claude has finished.

- **A** falls short: Wording is not a control signal; a reply can sound finished while Claude still wants a tool.
- **C** falls short: A fixed iteration cap cuts the refund off mid-task; caps are a safety net, not the stop condition.
- **D** falls short: The first tool result is only an input to Claude's next turn; the task is not done until end_turn.

## Try this
Copy a file in cases/ to a new CS id, change the customer's message and expected disposition, rerun with --case, then score it with evaluate.py.

## How the exam tests this
Pick the option that continues on tool_use and stops on end_turn. Reject any loop that stops when the text "sounds finished": natural-language cues are not a control signal.

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-1-customer-support/evidence/`.
