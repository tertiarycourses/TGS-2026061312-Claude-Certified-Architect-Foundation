# Lab 7: Two attempts, one analysis: fork the session, checkpoint the files
> Day 1 · Topic 1: Agentic Architecture & Orchestration · Task statement 1.7 · Simulator 2: Code Generation with Claude Code · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 1.7: **Manage session state, resumption, and forking.** You answer one exam-style question, then run the Code Generation with Claude Code simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs, the two Day 2 bonus topics (Labs 31–35) and the practice exam, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=7](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=7), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim2?lab=7](http://localhost:8765/sim2?lab=7).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run casekit.py --case UC-5` from `simulators/simulator-2-code-generation`.
- **The code it runs:** [simulators/simulator-2-code-generation/casekit.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/casekit.py), with the case file [simulators/simulator-2-code-generation/cases/UC-5.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/cases/UC-5.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are using Claude Code to accelerate software development. Your team uses it for code generation, refactoring, debugging, and documentation. You need to integrate it into your development workflow with custom slash commands, CLAUDE.md configurations, and understand when to use plan mode vs direct execution.

## The question
After a long plan-mode investigation, a developer saves the session ID before making changes. They want to test a minimal patch and a larger refactor from the same analysed context, but both attempts will touch overlapping files in the same working directory. Which approach best supports independent exploration without confusing conversation history with file state?

- **A.** Fork the saved session once and run both attempts in the same working directory as isolated file branches.
- **B.** Use --continue twice from the project directory and rely on Claude Code to select the baseline automatically.
- **C.** Resume the saved session ID twice without forking and ask Claude to keep each attempt separate.
- **D.** Resume the saved session ID with the fork option for each attempt and checkpoint files before edits.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **2. Code Generation with Claude Code**.
3. Click **Lab 7** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-2-code-generation
uv run casekit.py --case UC-5
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 7` from the `labs` folder.

## What you will see
What to look for: Three session ids. Attempt B starts from restored files, so attempt A never leaks in.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 26 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "<temp copy>/workspace/src/utils/for…)
  -> Grep({"pattern": "formatDate", "path": "<temp copy>/wor…)
  -> Glob({"pattern": "src/**/*.{js,ts}", "path": "/private/var/folders/h_/vs1_c0bd0kn_fms0n071g0gr0000gn/T/UC-5-25tukj…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: 1 // Formats an order date for the invoice export. 2 // Bug report T1: "TypeError: Cannot read properties of null (reading 'toISOString'…
  <- result: src/services/report.ts:1:import { formatDate } from "../utils/formatDate.js"; src/services/report.ts:4: return `${label}: ${formatDate(w…
  <- result: src/api/orders.js src/db/orderRepository.js src/middleware/authorize.js src/services/invoice.ts src/services/report.ts src/utils/formatD…
Turn 2: sending the conversation to Claude, with the tool results appended
  -> Read({"file_path": "<temp copy>/workspace/src/api/order…)
  -> Read({"file_path": "<temp copy>/workspace/src/services/…)
...
   UC-5 t0: success  $0.00
   UC-5 t1: success  $0.00
   UC-5 t2: success  $0.01
   PASS - both attempts resume the baseline with --fork-session and get new session ids
   PASS - attempt A changed only formatDate.js
   PASS - files were checkpointed (restored) before attempt B, so a fork is not a filesystem snapshot
   PASS - attempt B touched callers as well
Estimated API cost: US$0.0191 for 3 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
Resuming the saved session ID with the fork option copies the conversation into a new session with its own ID, which is why you count three IDs. A fork copies history, not files, so both attempts would see each other's edits in a shared working directory. Restoring the checkpoint before attempt B is what keeps attempt A's changes out.

## Check your answer
**The answer is D.** Resume the saved session ID with the fork option for each attempt and checkpoint files before edits.

Forking fits when the valuable asset is the prior conversation: prompts, tool calls, results and Claude's analysis. A fork starts a new session (with its own ID) from a copy of the existing history, and the original stays unchanged. The boundary to remember is that a session is not a file-system snapshot . Forks editing the same working directory change the real files, which every session using that directory then sees. To revert, use file checkpointing, which tracks the file-editing tools (Write, Edit, NotebookEdit) but not arbitrary changes made through shell commands. Use resume for a specific earlier session ID, and fork when you need an independent branch. (For reference: claude --resume <id> --fork-session in the CLI, fork_session in the exam guide.)

- **A** falls short: One fork shared by two attempts is not two branches, and a fork never isolates files.
- **B** falls short: --continue resumes the most recent conversation in the directory, not necessarily the saved baseline. Running it twice does not create independent branches.
- **C** falls short: Without forking, both attempts append to the same history. Asking in plain language to “keep them separate” does not create isolation.

## Try this
Rerun it and compare with the saved evidence/ copy: Claude's wording changes from run to run, the decision should not.

## How the exam tests this
Fork each attempt from the saved ID and checkpoint files before edits. Reject --continue and a plain double resume: neither creates independent branches, and no session option isolates file state.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-2-code-generation/evidence/`.
