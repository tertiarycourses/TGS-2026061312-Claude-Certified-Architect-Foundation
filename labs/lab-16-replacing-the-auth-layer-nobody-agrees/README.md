# Lab 16: Replacing the auth layer: nobody agrees on the boundary, so plan
> Day 1 · Topic 3: Claude Code Configuration & Workflows · Task statement 3.4 · Simulator 2: Code Generation with Claude Code · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 3.4: **Determine when to use plan mode vs direct execution.** You answer one exam-style question, then run the Code Generation with Claude Code simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=16](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=16), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim2?lab=16](http://localhost:8765/sim2?lab=16).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run casekit.py --case UC-8` from `simulators/simulator-2-code-generation`.
- **The code it runs:** [simulators/simulator-2-code-generation/casekit.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/casekit.py), with the case file [simulators/simulator-2-code-generation/cases/UC-8.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/cases/UC-8.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are using Claude Code to accelerate software development. Your team uses it for code generation, refactoring, debugging, and documentation. You need to integrate it into your development workflow with custom slash commands, CLAUDE.md configurations, and understand when to use plan mode vs direct execution.

## The question
A payments platform team is replacing its homegrown authorization layer with a policy engine across API handlers, middleware, and tests. Engineers disagree about where the policy boundary should live, and the developer assigned to it is unfamiliar with several affected packages. Which workflow should they choose before implementation?

- **A.** Run a custom slash command that instructs Claude Code to avoid asking questions during the refactor.
- **B.** Use direct execution so Claude Code starts editing immediately and discovers the architecture through test failures.
- **C.** Select the opus model alias and let Claude Code complete the refactor through direct execution.
- **D.** Enter plan mode so Claude Code researches the codebase and proposes changes for approval before editing files.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **2. Code Generation with Claude Code**.
3. Click **Lab 16** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-2-code-generation
uv run casekit.py --case UC-8
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 16` from the `labs` folder.

## What you will see
What to look for: Files hash the same before and after: a plan, with no edits.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 26 available
Turn 1: sending the conversation to Claude
  claude: I'll keep the research short: find the current authorization layer, its callers, and the tests.
  -> Bash({"command": "ls -la && cat src/middleware/authorize.js 2>/dev/null; echo \"---\"; git ls-files | head -200", …)
  -> Grep({"pattern": "authorize|requirePermission|can\\(|hasRole|permission|role", "path": "/private/var/folders/h_/vs…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: src/api/orders.js:2:import { authorize } from "../middleware/authorize.js"; src/api/orders.js:9: if (!authorize(req.user, "orders:read")…
  <- result: total 48 drwxr-xr-x@ 14 you staff 448 Nov 14 00:11 . drwx------@ 3 you staff 96 Nov 14 00:11 .. drwxr-xr-x@ 5 you staff 160 Nov 13 23:51…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> Bash({"command": "cat src/api/orders.js; echo \"--- rules/api-handlers.md\"; cat .claude/rules/api-handlers.md; ec…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: import moment from "moment"; import { authorize } from "../middleware/authorize.js"; import { OrderRepository } from "../db/orderReposit…
...
   UC-8 t1: success  $0.01
   PASS - plan mode edited no files
   PASS - the output is a plan that names the authorization boundary
   PASS - the plan references the real callers found by research
Estimated API cost: US$0.0062 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
Plan mode lets Claude read, search and propose, but blocks file edits until you approve the plan. The lab hashes every file before and after the run, so identical hashes prove Claude studied src/middleware/authorize.js and its callers without changing a line. You get a design to argue over before any code moves.

## Check your answer
**The answer is D.** Enter plan mode so Claude Code researches the codebase and proposes changes for approval before editing files.

Plan mode separates investigation from implementation. It is a documented permission mode in which Claude researches the codebase, may run exploratory shell commands under the normal permission flow, and writes a plan. Source files are not edited until the plan is approved. Anthropic's best practices recommend planning when the approach is uncertain, the change spans multiple files, or the developer is unfamiliar with the code. All three apply here.

- **A** falls short: Suppressing questions removes exactly the clarification needed when engineers disagree about the design.
- **B** falls short: Discovering an authorization architecture through test failures invites broad, risky rework. Direct execution suits small fixes.
- **C** falls short: A stronger model may reason better, but model choice does not replace the approval boundary that plan mode provides.

## Try this
Rerun it and compare with the saved evidence/ copy: Claude's wording changes from run to run, the decision should not.

## How the exam tests this
Three triggers point to plan mode: an uncertain design, a change across many files, and a developer new to the code. Reject "start editing and discover the architecture through test failures", and ignore the pull of the opus alias, because a stronger model adds no approval boundary.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-2-code-generation/evidence/`.
