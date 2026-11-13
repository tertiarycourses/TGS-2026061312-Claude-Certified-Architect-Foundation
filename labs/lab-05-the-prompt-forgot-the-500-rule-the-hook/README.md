# Lab 5: The prompt forgot the $500 rule. The hook did not.
> Day 1 · Topic 1: Agentic Architecture & Orchestration · Task statement 1.5 · Simulator 1: Customer Support Resolution Agent · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 1.5: **Apply Agent SDK hooks for tool call interception and data normalization.** You answer one exam-style question, then run the Customer Support Resolution Agent simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=5](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=5), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim1?lab=5](http://localhost:8765/sim1?lab=5).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run support_agent.py --case CS-02 --prompt prompts/system-noguard.md --tag noguard` from `simulators/simulator-1-customer-support`.
- **The code it runs:** [simulators/simulator-1-customer-support/support_agent.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/support_agent.py), with the case file [simulators/simulator-1-customer-support/cases/CS-02.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/cases/CS-02.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to your backend systems through custom Model Context Protocol (MCP) tools (get_customer, lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact resolution while knowing when to escalate.

## The question
Arjun wants a full refund on a $780 standing desk. Automatic refunds stop at $500. Someone has edited the system prompt, and the $500 rule is gone. What still stops the refund?

- **A.** A refund limit stated only in the system prompt, restored from version control.
- **B.** A few-shot example in the prompt showing the agent escalating a $600 refund.
- **C.** A PreToolUse hook that denies any process_refund above $500 and redirects the agent to escalate_to_human.
- **D.** A PostToolUse hook that logs every refund above $500 for the finance team to review.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **1. Customer Support Resolution Agent**.
3. Click **Lab 5** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-1-customer-support
uv run support_agent.py --case CS-02 --prompt prompts/system-noguard.md --tag noguard
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 5` from the `labs` folder.

## What you will see
What to look for: The prompt has lost its $500 rule, so the model tries $780. The hook denies it.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: escalate_to_human, get_customer, lookup_order, process_refund, recommend_refund
Turn 1: sending the conversation to Claude
  -> get_customer({"email": "arjun@example.com", "name": "Arjun"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"customer_id": "C-1002", "name": "Arjun Rao", "email": "arjun@example.com", "tier": "plus", "created_at": "2023-11-02T08:15:00Z", "stat…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> lookup_order({"order_id": "ORD-5502", "customer_id": "C-1002"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"order_id": "ORD-5502", "customer_id": "C-1002", "amount": 780.0, "item": "Standing desk", "placed_at": "2026-10-20T10:00:00Z", "status…
Turn 3: sending the conversation to Claude, with the tool results appended
  claude: Verified customer C-1002. ORD-5502 shows a damage photo on file, one charge, and a $780.00 amount. Next I'll validate the full refund.
  -> recommend_refund({"order_id": "ORD-5502", "item_adjustments": [{"sku": "WHOLE", "amount": 780}], "shipping_refund": 0, "mercha…)
...
  refund check: recommend_refund {"order_id": "ORD-5502", "item_adjustments": [{"sku": "WHOLE", "amount": 780}], "shipping_refund": 0, "merchan -> va…
  reply: CASE FACTS | - Customer: C-1002 (Arjun Rao, Plus, active) | - Order: ORD-5502, standing desk, $780.00, delivered, ETA 2026-10-25 | - Damage …
Estimated API cost: US$0.0016 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
The no-guard prompt has lost the $500 line, so the model goes ahead and requests process_refund for $780. The PreToolUse hook checks the amount in code, denies the call and tells the agent to call escalate_to_human instead. Arjun gets an escalation ticket, not a refund, because the limit never depended on the prompt.

## Check your answer
**The answer is C.** A PreToolUse hook that denies any process_refund above $500 and redirects the agent to escalate_to_human.

Only code that runs before the tool call can guarantee the limit; a PreToolUse hook enforces it even when the prompt has been edited.

- **A** falls short: A prompt-only rule disappears the moment someone edits the prompt, which is exactly what happened here.
- **B** falls short: Examples steer behaviour probabilistically; they are still prompt text and give no guarantee.
- **D** falls short: A PostToolUse hook runs after the refund has already been issued; logging it does not stop it.

## Try this
Copy a file in cases/ to a new CS id, change the customer's message and expected disposition, rerun with --case, then score it with evaluate.py.

## How the exam tests this
When a rule must hold even after someone edits the prompt, choose the PreToolUse hook. A refund cap that lives only in the system prompt fails the moment that line disappears.

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-1-customer-support/evidence/`.
