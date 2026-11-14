# Lab 24: 14 files, shallow comments: split the review
> Day 1 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.6 · Simulator 5: Claude Code for Continuous Integration · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 4.6: **Design multi-instance and multi-pass review architectures.** You answer one exam-style question, then run the Claude Code for Continuous Integration simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=24](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=24), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim5?lab=24](http://localhost:8765/sim5?lab=24).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run ci_review.py` from `simulators/simulator-5-ci-cd`.
- **The code it runs:** [simulators/simulator-5-ci-cd/ci_review.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-5-ci-cd/ci_review.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are integrating Claude Code into your Continuous Integration/Continuous Deployment (CI/CD) pipeline. The system runs automated code reviews, generates test cases, and provides feedback on pull requests. You need to design prompts that provide actionable feedback and minimize false positives.

## The question
A pull request modifies 14 files across the stock tracking module. Your single-pass review analyzing all files together produces inconsistent results: detailed feedback for some files but superficial comments for others, obvious bugs missed, and contradictory feedback—flagging a pattern as problematic in one file while approving identical code elsewhere in the same PR. How should you restructure the review?

- **A.** Split into focused passes: analyze each file individually for local issues, then run a separate integration-focused pass examining cross-file data flow.
- **B.** Require developers to split large PRs into smaller submissions of 3-4 files before the automated review runs.
- **C.** Switch to a higher-tier model with a larger context window to give all 14 files adequate attention in one pass.
- **D.** Run three independent review passes on the full PR and only flag issues that appear in at least two of the three runs.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **5. Claude Code for Continuous Integration**.
3. Click **Lab 24** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-5-ci-cd
uv run ci_review.py
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 24` from the `labs` folder.

## What you will see
What to look for: Only the integration pass finds the jobs.py call with the old signature.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 26 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "repo/stock/repository.py"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: 1 """Stock repository: reads quantities from the warehouse database.""" 2 import os 3 import sys 4 5 from stock.db import get_cursor 6 7…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> StructuredOutput({"pass": "per-file", "findings": [{"file": "stock/repository.py", "line": 11, "severity": "critical", "catego…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: Structured output provided successfully
Turn 3: sending the conversation to Claude, with the tool results appended
  connected: claude-haiku-5-5, tools: 26 available
Turn 1: sending the conversation to Claude
...
== routing: pre-merge review -> synchronous Messages API; technical debt report -> Message Batches API; weekly test-gap audit -> Message Batches API
== gate: 4 blocking finding(s) -> exit 1   cost US$0.03 over 7 calls
Estimated API cost: US$0.0265 for 7 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
Each per-file pass sees one file, so stock/jobs.py looks clean on its own and its review returns no findings. The broken contract spans two files: PR 418 added a required warehouse parameter to api.get_stock, while jobs.sync still calls it with only sku. Only the integration pass reads across file boundaries, so only it flags the TypeError that would crash the nightly sync on its first SKU.

## Check your answer
**The answer is A.** Split into focused passes: analyze each file individually for local issues, then run a separate integration-focused pass examining cross-file data flow.

Splitting reviews into focused passes directly addresses the root cause: attention dilution when processing many files at once. File-by-file analysis ensures consistent depth, while a separate integration pass catches cross-file issues. Option B shifts burden to developers without improving the system. Option C misunderstands that larger context windows don't solve attention quality issues. Option D would actually suppress detection of real bugs by requiring consensus on issues that may only be caught intermittently.

- **B** falls short: Pushes the problem onto developers without fixing the review design.
- **C** falls short: A bigger context window does not fix attention spread across 14 files.
- **D** falls short: Requiring two of three runs to agree suppresses real bugs that are caught intermittently.

## Try this
Fix the loop in repo/stock/totals.py and the caller in repo/stock/jobs.py, rerun, and watch the blocking count fall.

## How the exam tests this
Fourteen files with uneven depth and contradictory comments point to attention dilution, so split into per-file passes plus one cross-file pass. Reject the bigger context window, and reject two-of-three voting, which hides bugs that show up only intermittently.

The question is an official sample question from the exam guide. Evidence from your run is saved in `labs/simulators/simulator-5-ci-cd/evidence/`.
