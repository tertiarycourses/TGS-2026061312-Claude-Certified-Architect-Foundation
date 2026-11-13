# Lab 10: Review and test generation fight over one Claude call
> Day 1 · Topic 2: Tool Design & MCP Integration · Task statement 2.3 · Simulator 5: Claude Code for Continuous Integration · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 2.3: **Distribute tools appropriately across agents and configure tool choice.** You answer one exam-style question, then run the Claude Code for Continuous Integration simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=10](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=10), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim5?lab=10](http://localhost:8765/sim5?lab=10).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run casekit.py --case UC-15` from `simulators/simulator-5-ci-cd`.
- **The code it runs:** [simulators/simulator-5-ci-cd/casekit.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-5-ci-cd/casekit.py), with the case file [simulators/simulator-5-ci-cd/cases/UC-15.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-5-ci-cd/cases/UC-15.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are integrating Claude Code into your Continuous Integration/Continuous Deployment (CI/CD) pipeline. The system runs automated code reviews, generates test cases, and provides feedback on pull requests. You need to design prompts that provide actionable feedback and minimize false positives.

## The question
The system uses one Claude call for pull request review, test generation, and PR metadata updates. Logs show the review phase sometimes invokes test-writing tools for non-testable style comments, then returns prose instead of the structured finding object your pipeline expects. What change best improves tool-selection reliability while preserving automated test generation elsewhere in the pipeline?

- **A.** Keep one shared CI step, expose all tools with sharper descriptions, and set tool_choice to "any" for review output.
- **B.** Keep one shared CI step, namespace tool names by category, and leave tool_choice on "auto" for model flexibility.
- **C.** Separate review and test-generation steps, expose only role-specific tools to each step, and force the review step's reporting tool with tool_choice .
- **D.** Expose all CI tools to both steps, set tool_choice to "none" during review, and parse JSON from assistant text.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **5. Claude Code for Continuous Integration**.
3. Click **Lab 10** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-5-ci-cd
uv run casekit.py --case UC-15
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 10` from the `labs` folder.

## What you will see
What to look for: Review gets read-only tools and the finding schema. Tests get their own. No prose comes back.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 26 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "<temp copy>/repo/stock/totals.py"})
  -> Bash({"command": "cat prompts/review-criteria.txt; echo ---; cat finding.schema.json 2>/dev/null || find . -name f…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: 1 """Totals across stock items.""" 2 import logging 3 4 logger = logging.getLogger(__name__) 5 6 7 def total_qty(items: list) -> int: 8 …
  <- result: cat: prompts/review-criteria.txt: No such file or directory ---
Turn 2: sending the conversation to Claude, with the tool results appended
  -> Bash({"command": "ls -la && find . -name 'review-criteria*' -o -name 'finding.schema*' | grep -v node_modules; ls …)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: total 8 drwxr-xr-x@ 8 you staff 256 Nov 13 23:51 . drwx------@ 3 you staff 96 Nov 14 00:11 .. drwxr-xr-x@ 4 you staff 128 Nov 13 23:51 .…
Turn 3: sending the conversation to Claude, with the tool results appended
...
   UC-15 t1: success  $0.01
   UC-15 t2: success  $0.01
   PASS - the review step returned a schema-valid finding object, not prose
   PASS - the review step reported the loop bug and nothing about tests
   PASS - the test step returned its own contract with the duplicate skipped
Estimated API cost: US$0.0132 for 2 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
Each extra tool is another chance of an irrelevant call, so a review step holding test-writing tools sometimes uses them. Give review only read-only tools and force its reporting tool with tool_choice {"type": "tool", "name": ...}, and the step has to return a structured finding. Test generation runs as its own step with its own tools and schema, so neither step returns prose.

## Check your answer
**The answer is C.** Separate review and test-generation steps, expose only role-specific tools to each step, and force the review step's reporting tool with tool_choice .

Scope tool access to the role performing each step. A review step that only produces findings should not hold test-writing or PR-label tools, because every extra tool raises the chance of an irrelevant call. Descriptions are the main steering mechanism, but they are no substitute for removing unrelated tools. tool_choice: {"type": "tool", "name": …} forces the named reporting tool, so the pipeline gets structured findings, while a separate test-generation step keeps its file-writing tools.

- **A** falls short: "any" guarantees a tool call, which could still be a test-writing tool.
- **B** falls short: "auto" still allows prose, and namespacing does not remove the unrelated tools.
- **D** falls short: "none" forbids tools, so findings come back as prose to parse. That gives up the structured output.

## Try this
Fix the loop in repo/stock/totals.py and the caller in repo/stock/jobs.py, rerun, and watch the blocking count fall.

## How the exam tests this
Scope tools by role, then force the reporting tool. Reject tool_choice "any", which guarantees a call but could still pick a test-writing tool, and reject "none", which forces prose you then have to parse.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-5-ci-cd/evidence/`.
