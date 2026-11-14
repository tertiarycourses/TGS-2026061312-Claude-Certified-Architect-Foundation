# Lab 20: "Clean this up" means three things: show which one you mean
> Day 1 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.2 · Simulator 2: Code Generation with Claude Code · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 4.2: **Apply few-shot prompting to improve output consistency and quality.** You answer one exam-style question, then run the Code Generation with Claude Code simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=20](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=20), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim2?lab=20](http://localhost:8765/sim2?lab=20).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run casekit.py --case UC-23` from `simulators/simulator-2-code-generation`.
- **The code it runs:** [simulators/simulator-2-code-generation/casekit.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/casekit.py), with the case file [simulators/simulator-2-code-generation/cases/UC-23.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/cases/UC-23.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are using Claude Code to accelerate software development. Your team uses it for code generation, refactoring, debugging, and documentation. You need to integrate it into your development workflow with custom slash commands, CLAUDE.md configurations, and understand when to use plan mode vs direct execution.

## The question
Your team's Claude Code skill (custom slash command), invoked as /task , is meant to decide whether to investigate, plan, or modify code. In evals, ambiguous requests such as “clean this up”, “look into this error”, and “can you improve this module” produce inconsistent behavior. Detailed written criteria have not stabilized the boundary. What should you change next?

- **A.** Add a stronger instruction that direct file edits must be avoided whenever the developer's request could imply planning.
- **B.** Add a large collection of untagged past transcripts so Claude can infer the team's preferred behavior from volume.
- **C.** Add two to four tagged examples showing similar ambiguous requests, the selected response path, and concise reasoning against plausible alternatives.
- **D.** Add a longer checklist that enumerates every phrase that should trigger investigation, planning, or code modification.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **2. Code Generation with Claude Code**.
3. Click **Lab 20** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-2-code-generation
uv run casekit.py --case UC-23
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 20` from the `labs` folder.

## What you will see
What to look for: The three ambiguous requests classify as investigate, plan and modify.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 27 available
Turn 1: sending the conversation to Claude
  claude: This is a diagnosis request, so I'll investigate before changing anything. Starting with a search for `formatDate`.
  -> Grep({"pattern": "formatDate", "path": "<temp copy>/wo…)
  -> Bash({"command": "git status --short && git log --oneline | head -5 && ls -la", "description": "Check repo state a…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: src/services/report.ts:1:import { formatDate } from "../utils/formatDate.js"; src/services/report.ts:4: return `${label}: ${formatDate(w…
  <- result: 36aa29e baseline total 48 drwxr-xr-x@ 14 you staff 448 Nov 14 00:00 . drwx------@ 3 you staff 96 Nov 14 00:00 .. drwxr-xr-x@ 5 you staff…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> Read({"file_path": "<temp copy>/workspace/src/utils/fo…)
  -> Read({"file_path": "<temp copy>/workspace/src/api/orde…)
  -> Grep({"pattern": "formatDate|shippedAt", "path": "/private/var/folders/h_/vs1_c0bd0kn_fms0n071g0gr0000gn/T/UC-23-7…)
...
   UC-23 t1: success  $0.01
   UC-23 t2: success  $0.00
   UC-23 t3: success  $0.00
   PASS - 'look into this error' -> investigate  (value='investigate')
   PASS - 'can you improve this module' -> plan  (value='plan')
   PASS - 'clean this up' with a named file -> modify  (value='modify')
Estimated API cost: US$0.0106 for 3 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
Written criteria describe a boundary in the abstract; tagged examples show Claude where it falls on requests that look alike. With three <example> blocks in .claude/commands/task.md, each giving a request, the chosen path and why the alternatives lose, the run classifies "look into this error" as investigate, "can you improve this module" as plan and "clean this up" on a named file as modify. The tags keep the examples apart from the live input, so Claude treats them as guidance, not as the request in front of it.

## Check your answer
**The answer is C.** Add two to four tagged examples showing similar ambiguous requests, the selected response path, and concise reasoning against plausible alternatives.

When a prompt fails at an ambiguous decision boundary, targeted examples usually beat more abstract instructions. The useful pattern shows why one action was chosen over a plausible alternative, such as planning instead of editing. Examples should mirror real requests, be relevant and diverse, and sit in their own tags so Claude can tell reusable guidance apart from the live input.

- **A** falls short: A blanket “avoid edits” rule over-blocks useful work.
- **B** falls short: Untagged transcripts can teach accidental patterns, and they cost context.
- **D** falls short: Phrase checklists are brittle, and written criteria have already failed here.

## Try this
Rerun it and compare with the saved evidence/ copy: Claude's wording changes from run to run, the decision should not.

## How the exam tests this
Detailed criteria have already failed in this stem, so the next move is two to four tagged examples with reasoning against the plausible alternative. Reject option C's pile of untagged transcripts, which teaches accidental patterns and eats context, and D's phrase checklist, which repeats the approach that failed.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-2-code-generation/evidence/`.
