# Lab 17: Two linked defects go in one detailed request
> Day 1 · Topic 3: Claude Code Configuration & Workflows · Task statement 3.5 · Simulator 3: Multi-Agent Research System · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 3.5: **Apply iterative refinement techniques for progressive improvement.** You answer one exam-style question, then run the Multi-Agent Research System simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=17](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=17), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim3?lab=17](http://localhost:8765/sim3?lab=17).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run plan_request.py` from `simulators/simulator-3-multi-agent-research`.
- **The code it runs:** [simulators/simulator-3-multi-agent-research/plan_request.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-3-multi-agent-research/plan_request.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a multi-agent research system using the Claude Agent SDK. A coordinator agent delegates to specialized subagents: one searches the web, one analyzes documents, one synthesizes findings, and one generates reports. The system researches topics and produces comprehensive, cited reports.

## The question
After a refactor, generated reports show two linked defects: citations render twice in the final report, and some evidence excerpts disappear when the synthesis subagent's output is passed to the report generator. The likely cause spans the claim–source schema, the synthesis prompt, and the report template, and the acceptance test should confirm that each claim appears once with its evidence excerpt and source URL. How should this team use Claude Code to address the defects most effectively?

- **A.** Add a Stop hook that runs the acceptance test and rely on repeated blocks as the main debugging strategy.
- **B.** Enter plan mode and give one detailed request covering both defects, affected areas, constraints, and verification checks before approving edits.
- **C.** Skip planning and ask Claude to fix the report bugs broadly, then inspect the diff after it finishes.
- **D.** Open separate cleared sessions for each defect, ask each session to edit only its assigned file, then merge results.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **3. Multi-Agent Research System**.
3. Click **Lab 17** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-3-multi-agent-research
uv run plan_request.py
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 17` from the `labs` folder.

## What you will see
What to look for: render.py prints the bug first: the citation twice and an empty excerpt line. Then three plan-mode runs: each separate request plans its own fix; the one detailed request plans a single shared claim-source interface across schema.py, synthesis_prompt.md and render.py, ending with an acceptance test. The separate requests cost two sessions of reading the same files.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 20 available
Turn 1: sending the conversation to Claude
  claude: I'll trace the citation rendering path read-only, then write the plan here instead of saving it.
  -> Grep({"pattern": "(?i)citation", "path": "labs/simulators/simulator-3-multi-agent-res…)
  -> Glob({"pattern": "**/*.{py,ts,md,json}", "path": "labs/simulators/simulator-3-multi-a…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: report/schema.py:3:Refactor 2026-10: `excerpt` was renamed to `quote`, and `citation` became a separate field.""" report/schema.py:4:CLA…
  <- result: report/render.py report/schema.py report/synthesis_prompt.md tests/test_render.py README.md
Turn 2: sending the conversation to Claude, with the tool results appended
  -> Read({"file_path": "report-repo/repo…)
  -> Read({"file_path": "report-repo/repo…)
  -> Read({"file_path": "report-repo/repo…)
...
  plan touches: schema, synthesis prompt, report template  ·  acceptance test: yes  ·  9 file reads/searches
  plan touches: schema, synthesis prompt, report template  ·  acceptance test: yes  ·  8 file reads/searches
done: separate plans touched report template, schema, synthesis prompt; the detailed plan touched schema, synthesis prompt, report template with an a…
  PASS  the single detailed plan covers schema, synthesis prompt and report template
  PASS  the single detailed plan ends in an acceptance test
  INFO  separate requests: two sessions, 18 reads/searches and $0.0157, vs 8 and $0.0066 for the one detailed request; compare whether the two plans …
  PASS  plan mode changed no files
Estimated API cost: US$0.0223 for 3 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
Both defects come from one cause: the schema renamed excerpt to quote and split out the citation, but the synthesis prompt and the report template were never updated. Two separate requests start two sessions that each rediscover that cause, and each plan can settle the field names its own way. One detailed request in plan mode names both symptoms, the three files and the acceptance test, so Claude designs a single interface and proves it with one test.

## Check your answer
**The answer is B.** Enter plan mode and give one detailed request covering both defects, affected areas, constraints, and verification checks before approving edits.

Match the workflow to how the work depends on itself. These fixes interact, so splitting them early lets each session assume something different about the shared interface between synthesis and report generation. A strong request describes the symptoms, likely affected areas, constraints, what “fixed” means and how to verify it, and asks Claude to run the checks and iterate. Plan mode is the right start because the change is uncertain and spans several files.

- **A** falls short: Stop hooks strengthen verification, but they complement diagnosis rather than replace it.
- **C** falls short: A broad, unplanned fix across three coupled files is likely to make inconsistent edits.
- **D** falls short: /clear and separate sessions suit unrelated tasks or polluted context, not coupled defects that need a shared mental model.

## Try this
Run 1b again and compare which field name its plan keeps (quote or excerpt) with run 1a's. Then add a third symptom to the run 2 request in plan_request.py.

## How the exam tests this
When linked defects share an interface, choose one detailed plan-mode request that names both symptoms, the shared contract and an acceptance test. Two independent requests, or jumping straight to edits, risk two incompatible fixes to the same schema.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-3-multi-agent-research/evidence/`.
