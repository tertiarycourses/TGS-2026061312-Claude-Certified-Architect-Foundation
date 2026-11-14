# Lab 19: "Only high confidence" didn't quiet the reviewer
> Day 1 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.1 · Simulator 5: Claude Code for Continuous Integration · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 4.1: **Design prompts with explicit criteria to improve precision and reduce false positives.** You answer one exam-style question, then run the Claude Code for Continuous Integration simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs, the two Day 2 bonus topics (Labs 31–35) and the practice exam, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=19](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=19), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim5?lab=19](http://localhost:8765/sim5?lab=19).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run casekit.py --case UC-39` from `simulators/simulator-5-ci-cd`.
- **The code it runs:** [simulators/simulator-5-ci-cd/casekit.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-5-ci-cd/casekit.py), with the case file [simulators/simulator-5-ci-cd/cases/UC-39.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-5-ci-cd/cases/UC-39.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are integrating Claude Code into your Continuous Integration/Continuous Deployment (CI/CD) pipeline. The system runs automated code reviews, generates test cases, and provides feedback on pull requests. You need to design prompts that provide actionable feedback and minimize false positives.

## The question
After several weeks, developers say the reviewer is noisy. Examples show comments about variable names, preferred assertion styles, and missing tests mixed with a few real null dereferences and authorization bypasses. The current prompt says, “Report only issues you are highly confident about.” What prompt change would most directly improve review usefulness?

- **A.** Define testable report-and-skip rules that focus comments on production bugs, security flaws, broken edge cases, and subtle regressions.
- **B.** Expand the checklist to include naming, formatting, test coverage, and architecture preferences so comments feel more comprehensive.
- **C.** Move every automated finding into a single non-blocking summary comment so developers can scan the noise separately.
- **D.** Keep the broad review scope and require each inline comment to include a numerical confidence score and short rationale.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **5. Claude Code for Continuous Integration**.
3. Click **Lab 19** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-5-ci-cd
uv run casekit.py --case UC-39
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 19` from the `labs` folder.

## What you will see
What to look for: Vague prompt: comments on names. Criteria: the None dereference in getPrice, nothing on naming.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 26 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "<temp copy>/repo/stock/pricing.py"})
  -> Read({"file_path": "<temp copy>/repo/prompts/review-cr…)
  -> Glob({"pattern": "**/finding.schema.json", "path": "/private/var/folders/h_/vs1_c0bd0kn_fms0n071g0gr0000gn/T/UC-39…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: 1 """Price lookups for the stock API (added in PR 418).""" 2 import logging 3 4 logger = logging.getLogger(__name__) 5 CATALOG = {"A1": …
  !! tool error: File does not exist. Note: your current working directory is <temp copy>/repo.
  <- result: No files found
Turn 2: sending the conversation to Claude, with the tool results appended
  -> StructuredOutput({"pass": "per-file", "findings": [{"file": "stock/pricing.py", "line": 12, "severity": "medium", "category": …)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
...
   UC-39 t1: success  $0.01
   UC-39 t2: success  $0.00
   PASS - with categorical criteria the None dereference in getPrice is reported as a bug
   PASS - with categorical criteria no naming or style comment appears
   PASS - compare both outputs: the vague prompt is allowed to return style/naming categories and usually does  (reviewed against the expected answer)
Estimated API cost: US$0.0098 for 2 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
"Report only issues you are highly confident about" draws no line between bugs and taste, and Claude can be confident that a variable name breaks local style. Categorical criteria (report production bugs, security flaws, broken edge cases and regressions; skip naming and style) give the model a testable rule. On stock/pricing.py that rule surfaces the None dereference in getPrice and drops the comments on names.

## Check your answer
**The answer is A.** Define testable report-and-skip rules that focus comments on production bugs, security flaws, broken edge cases, and subtle regressions.

The failure is not missing confidence metadata. The prompt draws no clear line between actionable correctness findings and preference comments. “High confidence” is subjective: a model can be very confident that a variable name breaks local style. Claude Code Code Review is calibrated by default for correctness (bugs that would break production), not formatting or missing tests. Make the boundary concrete: report production breakage, security risk, mishandled edge cases and regressions, and skip style, naming and preference unless the team has made them review objectives.

- **B** falls short: Adds more of the noise developers are complaining about.
- **C** falls short: Repackages the noise without reducing it, and buries the real bugs.
- **D** falls short: Confidence scores do not define what is worth reporting, and self-reported confidence is unreliable.

## Try this
Fix the loop in repo/stock/totals.py and the caller in repo/stock/jobs.py, rerun, and watch the blocking count fall.

## How the exam tests this
When a reviewer is noisy, define what to report and what to skip instead of asking for more confidence. Option D's numeric confidence score is the trap: self-reported confidence is unreliable, and it still says nothing about what deserves a comment.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-5-ci-cd/evidence/`.
