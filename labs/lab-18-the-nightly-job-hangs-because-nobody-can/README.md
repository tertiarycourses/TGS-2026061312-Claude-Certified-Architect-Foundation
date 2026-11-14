# Lab 18: The nightly job hangs because nobody can press Enter
> Day 1 · Topic 3: Claude Code Configuration & Workflows · Task statement 3.6 · Simulator 5: Claude Code for Continuous Integration · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 3.6: **Integrate Claude Code into CI/CD pipelines.** You answer one exam-style question, then run the Claude Code for Continuous Integration simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=18](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=18), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim5?lab=18](http://localhost:8765/sim5?lab=18).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run casekit.py --case UC-18` from `simulators/simulator-5-ci-cd`.
- **The code it runs:** [simulators/simulator-5-ci-cd/casekit.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-5-ci-cd/casekit.py), with the case file [simulators/simulator-5-ci-cd/cases/UC-18.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-5-ci-cd/cases/UC-18.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are integrating Claude Code into your Continuous Integration/Continuous Deployment (CI/CD) pipeline. The system runs automated code reviews, generates test cases, and provides feedback on pull requests. You need to design prompts that provide actionable feedback and minimize false positives.

## The question
Your CI job runs a nightly support-triage check and needs Claude Code to process a prompt, write the result to standard output, and exit without waiting for a developer. The current job launches Claude Code and intermittently hangs in the runner. What change best fits this automated workflow?

- **A.** Invoke Claude Code with claude -p (or claude --print ) in the job.
- **B.** Launch plain claude and add an instruction telling Claude to exit after answering.
- **C.** Add --output-format json to plain claude and parse the response from stdout.
- **D.** Wrap the interactive claude command in a timeout and retry the job on failure.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **5. Claude Code for Continuous Integration**.
3. Click **Lab 18** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-5-ci-cd
uv run casekit.py --case UC-18
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 18` from the `labs` folder.

## What you will see
What to look for: One JSON envelope on stdout, and the process exits well inside the job timeout.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 25 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "<temp copy>/repo/stock/jobs.py"})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: 1 """Nightly stock sync job.""" 2 import logging 3 4 from stock import api 5 6 logger = logging.getLogger(__name__) 7 8 9 def sync(skus:…
Turn 2: sending the conversation to Claude, with the tool results appended
  claude: Yes, if `api.get_stock` raises for an unknown SKU. `sync` has no lookup or try/except of its own, so any exception from `api.get_stock` pro…
  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends
...
   UC-18 t1: success  $0.00
   PASS - the job exited on its own with a JSON envelope (session_id present)
   PASS - it returned inside a CI-friendly time budget
   PASS - learner can explain why timeouts, retries or 'please exit' instructions do not change the execution mode  (reviewed against the expected an…
Estimated API cost: US$0.0050 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
claude -p processes one prompt, writes the result to stdout and exits, so the runner never waits on a terminal. The evidence shows the run finishing in 6.7 seconds with exit code 0 and a single JSON envelope carrying a session_id, because the job pairs -p with --output-format json. The JSON flag shapes the output; -p is what makes the run non-interactive.

## Check your answer
**The answer is A.** Invoke Claude Code with claude -p (or claude --print ) in the job.

The key distinction is between an interactive session and print mode. claude -p "query" runs the request non-interactively and then exits, which suits scripts and CI/CD. It behaves like a Unix tool, reading stdin and writing stdout. If the job later needs machine-readable output, combine print mode with --output-format json . Structured output does not replace non-interactive mode.

- **B** falls short: A prompt instruction does not change the CLI's execution mode.
- **C** falls short: Output format does not make an interactive session non-interactive.
- **D** falls short: Timeouts and retries hide the hang and waste runner time. The job still depends on a human-in-the-loop mode.

## Try this
Fix the loop in repo/stock/totals.py and the caller in repo/stock/jobs.py, rerun, and watch the blocking count fall.

## How the exam tests this
A CI job that hangs with no one at the keyboard is stuck in interactive mode, so fix the mode with -p. Option C tempts most: --output-format json on plain claude still leaves an interactive session, and timeouts, retries or "please exit" instructions only hide the hang.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-5-ci-cd/evidence/`.
