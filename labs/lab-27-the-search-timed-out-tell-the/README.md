# Lab 27: The search timed out: tell the coordinator everything
> Day 1 · Topic 5: Context Management & Reliability · Task statement 5.3 · Simulator 3: Multi-Agent Research System · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 5.3: **Implement error propagation strategies across multi-agent systems.** You answer one exam-style question, then run the Multi-Agent Research System simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=27](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=27), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`. The scenario board above the code shows this lab's story as it runs. The run **stops after the first method** and shows you its outcome; press **Proceed** to run the fix, then read the two **side by side** under The observation explained.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim3?lab=27](http://localhost:8765/sim3?lab=27).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run research_system.py` from `simulators/simulator-3-multi-agent-research`.
- **The code it runs:** [simulators/simulator-3-multi-agent-research/research_system.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-3-multi-agent-research/research_system.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a multi-agent research system using the Claude Agent SDK. A coordinator agent delegates to specialized subagents: one searches the web, one analyzes documents, one synthesizes findings, and one generates reports. The system researches topics and produces comprehensive, cited reports.

## The question
The web search subagent times out while researching a complex topic. You need to design how this failure information flows back to the coordinator agent. Which error propagation approach best enables intelligent recovery?

- **A.** Return structured error context to the coordinator including the failure type, the attempted query, any partial results, and potential alternative approaches.
- **B.** Implement automatic retry logic with exponential backoff within the subagent, returning a generic "search unavailable" status only after all retries are exhausted.
- **C.** Catch the timeout within the subagent and return an empty result set marked as successful.
- **D.** Propagate the timeout exception directly to a top-level handler that terminates the entire research workflow.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **3. Multi-Agent Research System**.
3. Click **Lab 27** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-3-multi-agent-research
uv run research_system.py
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 27` from the `labs` folder.

## What you will see
What to look for: The run finishes, and the report names visual arts as a coverage gap.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 28 available
Turn 1: sending the conversation to Claude
  claude: I'll split this into four sector searches (music, writing/publishing, film/TV, visual arts) and one pass over the two internal PDFs, launch…
  -> Agent({"description": "Web search: AI in music", "subagent_type": "web-search", "prompt": "Research sub-topic: Impa…)
  -> Agent({"description": "Web search: AI in writing and publishing", "subagent_type": "web-search", "prompt": "Researc…)
  -> search_web({"query": "AI impact on music sector 2026 generation tools royalties licensing streaming policy"})  (subagent)
  -> search_web({"query": "AI music copyright disputes labels lawsuits Suno Udio licensing 2026"})  (subagent)
  -> search_web({"query": "music industry AI adoption survey musicians jobs income 2026"})  (subagent)
  -> Agent({"description": "Web search: AI in film and TV", "subagent_type": "web-search", "prompt": "Research sub-topic…)
  -> search_web({"query": "AI impact on book publishing and self-publishing volumes AI-generated books 2026"})  (subagent)
  -> search_web({"query": "authors lawsuits AI training licensing deals publishers 2026 writing industry"})  (subagent)
  -> search_web({"query": "AI audiobook narration translation editorial copywriting survey writers publishers 2026"})  (subagent)
...
[result] success turns=8 cost=$0.0184
Estimated API cost: US$0.0184 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
The search tool does not swallow the visual-arts timeout. It returns failure_type, the attempted query, partial_results and suggested alternatives, including reporting the topic as a coverage gap. The coordinator reads that structure, decides to proceed with what it has and carries the gap into the final report, so the run finishes instead of crashing or claiming full coverage.

## Check your answer
**The answer is A.** Return structured error context to the coordinator including the failure type, the attempted query, any partial results, and potential alternative approaches.

Structured error context gives the coordinator the information it needs to make intelligent recovery decisions—whether to retry with a modified query, try an alternative approach, or proceed with partial results. Option B's generic status hides valuable context from the coordinator, preventing informed decisions. Option C suppresses the error by marking failure as success, which prevents any recovery and risks incomplete research outputs. Option D terminates the entire workflow unnecessarily when recovery strategies could succeed.

- **B** falls short: A generic status after silent retries hides the context the coordinator needs to recover.
- **C** falls short: Marking a failure as success suppresses the error and leaves a silent gap in the report.
- **D** falls short: Terminating the whole workflow throws away recoverable work.

## Try this
In fixtures/sources.json replace the visual-arts TIMEOUT with [] and rerun: a valid empty result must not read as a failure.

## How the exam tests this
Choose structured error context that lets the coordinator choose to retry, rephrase or report a gap. Reject an empty result marked as success, which hides the failure, and reject a generic "search unavailable", which strips out the details recovery needs.

The question is an official sample question from the exam guide. Evidence from your run is saved in `labs/simulators/simulator-3-multi-agent-research/evidence/`.
