# Lab 13: Which instructions actually reached Claude?
> Day 1 · Topic 3: Claude Code Configuration & Workflows · Task statement 3.1 · Simulator 2: Code Generation with Claude Code · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 3.1: **Configure CLAUDE.md files with appropriate hierarchy, scoping, and modular organization.** You answer one exam-style question, then run the Code Generation with Claude Code simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=13](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=13), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim2?lab=13](http://localhost:8765/sim2?lab=13).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run simulator.py 1` from `simulators/simulator-2-code-generation`.
- **The code it runs:** [simulators/simulator-2-code-generation/simulator.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/simulator.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are using Claude Code to accelerate software development. Your team uses it for code generation, refactoring, debugging, and documentation. You need to integrate it into your development workflow with custom slash commands, CLAUDE.md configurations, and understand when to use plan mode vs direct execution.

## The question
A teammate says Claude keeps ignoring the test conventions. How do you organise the instructions, and how do you find out which ones reached Claude for a test file?

- **A.** Put every convention into one large CLAUDE.md, or into your own ~/.claude/CLAUDE.md.
- **B.** Paste the test conventions into each prompt that touches a test file.
- **C.** Keep shared standards in the project CLAUDE.md with @imports, put area conventions in .claude/rules/ files that load by path, and ask Claude which rules it loaded for the test file.
- **D.** Move the test conventions into a skill so they load automatically whenever a test file is opened.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **2. Code Generation with Claude Code**.
3. Click **Lab 13** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-2-code-generation
uv run simulator.py 1
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 13` from the `labs` folder.

## What you will see
What to look for: Claude quotes the imported standard and names the rule files in context.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 24 available
Turn 1: sending the conversation to Claude
  claude: Every bug fix ships with a regression test that fails before the fix.
  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends
  connected: claude-haiku-5-5, tools: 24 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "workspace/src/compone…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: 1 describe("Button", () => { it("renders label when given text", () => {}); }); 2
Turn 2: sending the conversation to Claude, with the tool results appended
  claude: tests.md, react-components.md
  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends
...
   quote: Every bug fix ships with a regression test that fails before the fix.
   src/components/Button.test.tsx: ['react-components.md', 'tests.md']
   src/api/orders.js: ['api-handlers.md']
Estimated API cost: US$0.0059 for 3 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
The project CLAUDE.md pulls in docs/standards/testing.md through an @import, so Claude can quote its first bullet word for word: "Every bug fix ships with a regression test that fails before the fix." Files in .claude/rules/ load by path: reading Button.test.tsx brings in tests.md and react-components.md, while reading src/api/orders.js brings in only api-handlers.md. Asking Claude to name its loaded rule files tells you exactly which instructions reached it for that file.

## Check your answer
**The answer is C.** Keep shared standards in the project CLAUDE.md with @imports, put area conventions in .claude/rules/ files that load by path, and ask Claude which rules it loaded for the test file.

The project CLAUDE.md and its @imports reach everyone through git, path-scoped rules load only for matching files, and asking Claude to name its loaded rules shows what actually reached it.

- **A** falls short: One giant file loads everything everywhere; the home-folder file reaches only you, never your teammates.
- **B** falls short: Manual pasting depends on each developer remembering and is not shared configuration.
- **D** falls short: Skills load on demand when invoked, not automatically by file path; path-scoped rules do that.

## Try this
Rerun it and compare with the saved evidence/ copy: Claude's wording changes from run to run, the decision should not.

## How the exam tests this
Organise shared instructions in the project CLAUDE.md with @imports, and put area conventions in .claude/rules/ files that load by path. Reject the single giant file, which loads everything everywhere, and the home-folder ~/.claude/CLAUDE.md, which teammates never receive.

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-2-code-generation/evidence/`.
