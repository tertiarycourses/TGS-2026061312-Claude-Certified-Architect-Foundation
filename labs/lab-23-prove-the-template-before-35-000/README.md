# Lab 23: Prove the template before 35,000 transcripts
> Day 1 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.5 · Simulator 1: Customer Support Resolution Agent · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 4.5: **Design efficient batch processing strategies.** You answer one exam-style question, then run the Customer Support Resolution Agent simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs, the two Day 2 bonus topics (Labs 31–35) and the practice exam, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=23](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=23), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim1?lab=23](http://localhost:8765/sim1?lab=23).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run triage.py --pilot` from `simulators/simulator-1-customer-support`.
- **The code it runs:** [simulators/simulator-1-customer-support/triage.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-1-customer-support/triage.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to your backend systems through custom Model Context Protocol (MCP) tools (get_customer, lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact resolution while knowing when to escalate.

## The question
Before enabling overnight processing of 35,000 archived support transcripts through the Message Batches API, a pilot of 30 transcripts shows inconsistent disposition decisions and missing rationale fields in some outputs. A product manager proposes running the full archive now and resubmitting bad rows the next day. What should this team do next?

- **A.** Submit the full archive as one batch, review the ended results, and resubmit rows whose disposition or fields are wrong.
- **B.** Run the prompt improver once on the current template, accept the revised prompt, and start the full overnight batch.
- **C.** Add stricter JSON output constraints, keep the current instructions, and use the batch results to discover decision errors.
- **D.** Create a representative evaluation set, refine the templated prompt against clear criteria, and rerun it before submitting the full batch.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **1. Customer Support Resolution Agent**.
3. Click **Lab 23** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-1-customer-support
uv run triage.py --pilot
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 23` from the `labs` folder.

## What you will see
What to look for: The refined template reports it is ready for the overnight batch.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: StructuredOutput
Turn 1: sending the conversation to Claude
  -> StructuredOutput({"transcript_id": "T-001", "disposition": "resolved", "rationale": "The customer reported that order ORD-5501…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: Structured output provided successfully
  connected: claude-haiku-5-5, tools: StructuredOutput
Turn 1: sending the conversation to Claude
  -> StructuredOutput({"transcript_id": "T-002", "disposition": "resolved", "rationale": "The agent confirmed the duplicate $45 cha…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: Structured output provided successfully
  connected: claude-haiku-5-5, tools: StructuredOutput
Turn 1: sending the conversation to Claude
...
ok  T-003 disposition=escalated refund_total=0 attempts=1
ok  T-004 disposition=escalated refund_total=0 attempts=1
ok  T-005 disposition=escalated refund_total=0 attempts=1
ok  T-006 disposition=unresolved refund_total=0 attempts=1
ok  T-007 disposition=resolved refund_total=0 attempts=1
ok  T-008 disposition=resolved refund_total=0 attempts=1
ok  T-009 disposition=resolved refund_total=0 attempts=1
ok  T-010 disposition=resolved refund_total=165 attempts=1
first-pass success 10/10 · disposition accuracy 90.0% · refund accuracy 90.0% · cost $0.005
ready for the overnight batch
Estimated API cost: US$0.0051 for 10 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
The pilot showed systematic defects, so the script measures the template against a representative evaluation set before anything reaches the 35,000-item batch. Batch requests run independently and you only see results after processing ends, which makes the batch a slow and costly place to find a prompt bug. The refined triage_template beats v0 on first-pass rate, and only it reports ready_for_batch true.

## Check your answer
**The answer is D.** Create a representative evaluation set, refine the templated prompt against clear criteria, and rerun it before submitting the full batch.

For a large asynchronous workload the goal is to maximise first-pass success before scale. The video frames prompt engineering as an evaluation loop: define success criteria, build tests that mirror real inputs (routine returns, billing disputes, explicit requests for a human, policy edge cases, messy customer language), iterate on the prompt, validate, then ship. Prompt templates separate fixed instructions from variables such as transcript , customer_history and policy_excerpt , and Console evaluations let you compare prompt versions across test cases. Batch requests are processed independently and asynchronously, so a batch is a poor place to discover preventable prompt defects at full volume. Structured outputs help format reliability, but semantic correctness still needs evaluation.

- **A** falls short: Uses the 35,000-item batch as the test harness. The pilot already shows systematic defects, so most of the rework is preventable; resubmitting failures by custom_id is for residual errors, not known prompt problems.
- **B** falls short: One unvalidated pass of the prompt improver, accepted without testing against criteria, gives no evidence that the disposition inconsistency is fixed.
- **C** falls short: JSON constraints may fix the missing fields (format), but not the inconsistent decisions (semantics), and errors are still discovered only after the full run.

## Try this
Copy a file in cases/ to a new CS id, change the customer's message and expected disposition, rerun with --case, then score it with evaluate.py.

## How the exam tests this
When a pilot already shows inconsistent decisions, fix the prompt against an evaluation set first and batch second. Reject "run it all tonight and resubmit bad rows by custom_id": resubmission mops up residual errors, not known prompt defects.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-1-customer-support/evidence/`.
