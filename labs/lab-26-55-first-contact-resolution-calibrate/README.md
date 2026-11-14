# Lab 26: 55% first-contact resolution: calibrate with criteria and examples
> Day 1 · Topic 5: Context Management & Reliability · Task statement 5.2 · Simulator 1: Customer Support Resolution Agent · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 5.2: **Design effective escalation and ambiguity resolution patterns.** You answer one exam-style question, then run the Customer Support Resolution Agent simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=26](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=26), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim1?lab=26](http://localhost:8765/sim1?lab=26).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run support_agent.py --case CS-08` from `simulators/simulator-1-customer-support`.
- **The code it runs:** [simulators/simulator-1-customer-support/support_agent.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/support_agent.py), with the case file [simulators/simulator-1-customer-support/cases/CS-08.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/cases/CS-08.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to your backend systems through custom Model Context Protocol (MCP) tools (get_customer, lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact resolution while knowing when to escalate.

## The question
Your agent achieves 55% first-contact resolution, well below the 80% target. Logs show it escalates straightforward cases (standard damage replacements with photo evidence) while attempting to autonomously handle complex situations requiring policy exceptions. What's the most effective way to improve escalation calibration?

- **A.** Add explicit escalation criteria to your system prompt with few-shot examples demonstrating when to escalate versus resolve autonomously.
- **B.** Have the agent self-report a confidence score (1-10) before each response and automatically route requests to humans when confidence falls below a threshold.
- **C.** Deploy a separate classifier model trained on historical tickets to predict which requests need escalation before the main agent begins processing.
- **D.** Implement sentiment analysis to detect customer frustration levels and automatically escalate when negative sentiment exceeds a threshold.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **1. Customer Support Resolution Agent**.
3. Click **Lab 26** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-1-customer-support
uv run support_agent.py --case CS-08
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 26` from the `labs` folder.

## What you will see
What to look for: The competitor price match on ORD-5507 is a policy gap, so the agent calls escalate_to_human (ticket HS-0001) and refunds $0 instead of improvising a discount.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: escalate_to_human, get_customer, lookup_order, process_refund, recommend_refund
Turn 1: sending the conversation to Claude
  -> get_customer({"email": "arjun@example.com", "name": "Arjun"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"customer_id": "C-1002", "name": "Arjun Rao", "email": "arjun@example.com", "tier": "plus", "created_at": "2023-11-02T08:15:00Z", "stat…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> escalate_to_human({"customer_id": "C-1002", "root_cause": "Customer requests competitor price matching: says the ergonomic keyb…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: {"ticket_id": "HS-0001", "handoff": {"customer_id": "C-1002", "root_cause": "Customer requests competitor price matching: says the ergon…
Turn 3: sending the conversation to Claude, with the tool results appended
  claude: CASE FACTS - Customer ID: C-1002 (Arjun Rao, Plus tier, active) - Order: ORD-5507 (ergonomic keyboard, $210 paid per customer; not verified…
  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends
...
  reply: CASE FACTS | - Customer ID: C-1002 (Arjun Rao, Plus tier, active) | - Order: ORD-5507 (ergonomic keyboard, $210 paid per customer; not verif…
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
The system prompt spells out escalation criteria and pairs each with a short example, so Claude decides on case type rather than tone. CS-05's explicit request for a human escalates at once, CS-08's price match escalates because policy is silent on it, and CS-09's two Sofia Alvarez records trigger a request for another identifier. CS-10 sounds angry, yet ORD-5501 is routine, so the agent acknowledges the frustration and resolves it.

## Check your answer
**The answer is A.** Add explicit escalation criteria to your system prompt with few-shot examples demonstrating when to escalate versus resolve autonomously.

Adding explicit escalation criteria with few-shot examples directly addresses the root cause: unclear decision boundaries. This is the proportionate first response before adding infrastructure. Option B fails because LLM self-reported confidence is poorly calibrated—the agent is already incorrectly confident on hard cases. Option C is over-engineered, requiring labeled data and ML infrastructure when prompt optimization hasn't been tried. Option D solves a different problem entirely; sentiment doesn't correlate with case complexity, which is the actual issue.

- **B** falls short: Self-reported confidence is poorly calibrated; the agent is already confident on the hard cases.
- **C** falls short: Over-engineered: needs labelled data and ML infrastructure before prompt fixes have been tried.
- **D** falls short: Sentiment does not track case complexity, which is the real problem.

## Try this
Copy a file in cases/ to a new CS id, change the customer's message and expected disposition, rerun with --case, then score it with evaluate.py.

## How the exam tests this
Unclear decision boundaries call for explicit criteria plus few-shot examples, the proportionate first fix. Reject sentiment triggers (anger does not mean complexity) and self-reported confidence scores, because the agent is already confidently wrong on the hard cases.

The question is an official sample question from the exam guide. Evidence from your run is saved in `labs/simulators/simulator-1-customer-support/evidence/`.
