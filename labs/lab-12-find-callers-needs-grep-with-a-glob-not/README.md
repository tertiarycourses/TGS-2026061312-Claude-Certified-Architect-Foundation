# Lab 12: /find-callers needs Grep with a glob, not Bash
> Day 1 · Topic 2: Tool Design & MCP Integration · Task statement 2.5 · Simulator 4: Developer Productivity with Claude · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 2.5: **Select and apply built-in tools (Read, Write, Edit, Bash, Grep, Glob) effectively.** You answer one exam-style question, then run the Developer Productivity with Claude simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=12](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=12), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim4?lab=12](http://localhost:8765/sim4?lab=12).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run explorer.py --case UC-37` from `simulators/simulator-4-developer-productivity`.
- **The code it runs:** [simulators/simulator-4-developer-productivity/explorer.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-4-developer-productivity/explorer.py), with the case file [simulators/simulator-4-developer-productivity/cases/UC-37.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-4-developer-productivity/cases/UC-37.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building developer productivity tools using the Claude Agent SDK. The agent helps engineers explore unfamiliar codebases, understand legacy systems, generate boilerplate code, and automate repetitive tasks. It uses the built-in tools (Read, Write, Bash, Grep, Glob) and integrates with Model Context Protocol (MCP) servers.

## The question
A payments platform's developer-productivity team is adding a /find-callers command that should locate every reference to a renamed helper function, limit the search to TypeScript source files, and return enough context for a developer to jump directly to each match. Which Claude Code built-in tool configuration should the command use?

- **A.** Use Glob with pattern **/helperName.ts , sort the returned paths, and treat matching file names as caller locations.
- **B.** Use Grep with the helper name as pattern, scope it with glob **/*.ts , and set output_mode: "content" for match lines.
- **C.** Use Glob with pattern **/*.ts , then Read each file and load all contents into the conversation for scanning.
- **D.** Use Bash to run grep -r helperName --include=*.ts , then parse stdout as caller locations.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **4. Developer Productivity with Claude**.
3. Click **Lab 12** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-4-developer-productivity
uv run explorer.py --case UC-37
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 12` from the `labs` folder.

## What you will see
What to look for: One Grep call for calculate_total, scoped to Python files (a *.py glob or type py) with output_mode content, returning file, line and match. No grep through Bash, no whole-file reads. Three PASS lines confirm it.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 27 available
Turn 1: sending the conversation to Claude
  -> list_catalog({})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: { "server": "orderly-docs", "resources": [ { "uri": "docs://architecture", "name": "Architecture overview", "summary": "Billing module: …
Turn 2: sending the conversation to Claude, with the tool results appended
  claude: The catalogue points at `invoice.py` and `validation.py`, but the search below covers all Python files rather than assuming those are the o…
  -> Grep({"pattern": "calculate_total", "glob": "*.py", "output_mode": "content", "-n": true, "head_limit": 0})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: src/billing/validation.py:2:from .invoice import calculate_total src/billing/validation.py:6: computed = calculate_total(lines) src/lega…
Turn 3: sending the conversation to Claude, with the tool results appended
  claude: Five hits across four files. Now I'll append the findings to the scratchpad so a later session can resume from here.
...
  PASS - Grep used with pattern == helper name
  PASS - Grep scoped to Python files (a *.py glob or type py) with output_mode content
  PASS - no Bash grep and fewer than 3 Read calls
Estimated API cost: US$0.0028 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
Callers of calculate_total are text inside files, so only a content search finds them. The built-in Grep tool searches contents, its glob parameter narrows the search to *.py, and output_mode "content" returns each match with its file and line number in a single call. Glob matches only file names, and Bash grep would push the same search through Bash permissions and leave you parsing raw stdout.

## Check your answer
**The answer is B.** Use Grep with the helper name as pattern, scope it with glob **/*.ts , and set output_mode: "content" for match lines.

Grep is the built-in tool for searching file contents such as function names, error messages and imports. Callers of a helper are content inside files. Glob finds files by path or name pattern (for example **/*.test.ts ). Grep with output_mode: "content" returns matching lines with file and line number, and its glob filter limits the search to TypeScript. The built-in Grep tool is not the same as shell grep through Bash, which goes through Bash permissions.

- **A** falls short: Matches file names . A file called helperName.ts is the definition, not its callers.
- **C** falls short: Loads every file into context, which is wasteful and pointless when Grep exists.
- **D** falls short: Works, but bypasses the purpose-built tool, depends on Bash permissions, and leaves fragile output parsing.

## Try this
Edit the prompt_template in this lab's file under cases/, rerun with --case, and check tool_log.jsonl for what changed.

## How the exam tests this
Map the job to the tool: file contents mean Grep, file names or paths mean Glob. Reject Glob on **/helperName.ts, which finds the definition rather than its callers, and reject Bash grep, which works but bypasses the purpose-built tool.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-4-developer-productivity/evidence/`.
