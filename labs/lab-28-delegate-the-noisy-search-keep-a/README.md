# Lab 28: Delegate the noisy search, keep a scratchpad
> Day 1 · Topic 5: Context Management & Reliability · Task statement 5.4 · Simulator 4: Developer Productivity with Claude · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 5.4: **Manage context effectively in large codebase exploration.** You answer one exam-style question, then run the Developer Productivity with Claude simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=28](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=28), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim4?lab=28](http://localhost:8765/sim4?lab=28).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run explorer.py --case UC-D3` from `simulators/simulator-4-developer-productivity`.
- **The code it runs:** [simulators/simulator-4-developer-productivity/explorer.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-4-developer-productivity/explorer.py), with the case file [simulators/simulator-4-developer-productivity/cases/UC-D3.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-4-developer-productivity/cases/UC-D3.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building developer productivity tools using the Claude Agent SDK. The agent helps engineers explore unfamiliar codebases, understand legacy systems, generate boilerplate code, and automate repetitive tasks. It uses the built-in tools (Read, Write, Bash, Grep, Glob) and integrates with Model Context Protocol (MCP) servers.

## The question
You need every caller of a function, but a wide search would flood your main session. How do you find them and keep your session usable?

- **A.** Delegate the caller search to an explore subagent and write its findings to a NOTES.md scratchpad.
- **B.** Read every file in the main thread so nothing is missed.
- **C.** Raise max_tokens so the main session can hold all the search output.
- **D.** Run /compact after the search so the noisy output is summarised away.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **4. Developer Productivity with Claude**.
3. Click **Lab 28** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-4-developer-productivity
uv run explorer.py --case UC-D3
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 28` from the `labs` folder.

## What you will see
What to look for: An explore subagent runs, and NOTES.md names calculate_total and report.py.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 27 available
Turn 1: sending the conversation to Claude
  claude: I'll start with the orderly-docs catalogue, as the house rules require, before exploring any files.
  -> list_catalog({})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: { "server": "orderly-docs", "resources": [ { "uri": "docs://architecture", "name": "Architecture overview", "summary": "Billing module: …
Turn 2: sending the conversation to Claude, with the tool results appended
  -> read_resource({"uri": "docs://architecture"})
  -> Grep({"pattern": "calculate_total|def main|__main__", "path": "labs/simulators/simula…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: Billing module: invoice.py computes totals; validation.py compares against stated totals. Legacy report.py wraps calculate_total for the…
  <- result: src/billing/validation.py:2:from .invoice import calculate_total src/billing/validation.py:6: computed = calculate_total(lines) src/bill…
...
  PASS - explore subagent spawned
  PASS - tool rows with agent=explore exist
  PASS - NOTES.md mentions calculate_total and a caller
Estimated API cost: US$0.0091 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
The caller search runs in an explore subagent with its own context window, so the main session never sees the raw grep hits and file reads, only the returned summary. The main agent then writes the conclusions to NOTES.md, which names calculate_total and its caller in src/legacy/report.py. Your session stays short, and the scratchpad keeps the findings safe from later context degradation.

## Check your answer
**The answer is A.** Delegate the caller search to an explore subagent and write its findings to a NOTES.md scratchpad.

A subagent's own context absorbs the noisy reads and returns only a summary, and the scratchpad keeps the findings safe from later context degradation.

- **B** falls short: Verbose output floods the main context and pushes out earlier specifics.
- **C** falls short: max_tokens limits the reply length, not how much context the session holds.
- **D** falls short: Compacting after the fact can lose exactly the file-and-line details you needed.

## Try this
Edit the prompt_template in this lab's file under cases/, rerun with --case, and check tool_log.jsonl for what changed.

## How the exam tests this
Delegate noisy discovery to a subagent and persist its findings in a scratchpad file. Reject reading everything in the main thread: verbose output crowds out the specifics you found earlier.

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-4-developer-productivity/evidence/`.
