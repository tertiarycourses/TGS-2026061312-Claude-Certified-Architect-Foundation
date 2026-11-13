# Lab 2: Every subagent succeeds, and the report still misses half the topic
> Day 1 · Topic 1: Agentic Architecture & Orchestration · Task statement 1.2 · Simulator 3: Multi-Agent Research System · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 1.2: **Orchestrate multi-agent systems with coordinator-subagent patterns.** You answer one exam-style question, then run the Multi-Agent Research System simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=2](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=2), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim3?lab=2](http://localhost:8765/sim3?lab=2).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run research_system.py` from `simulators/simulator-3-multi-agent-research`.
- **The code it runs:** [simulators/simulator-3-multi-agent-research/research_system.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-3-multi-agent-research/research_system.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a multi-agent research system using the Claude Agent SDK. A coordinator agent delegates to specialized subagents: one searches the web, one analyzes documents, one synthesizes findings, and one generates reports. The system researches topics and produces comprehensive, cited reports.

## The question
After running the system on the topic "impact of AI on creative industries," you observe that each subagent completes successfully: the web search agent finds relevant articles, the document analysis agent summarizes papers correctly, and the synthesis agent produces coherent output. However, the final reports cover only visual arts, completely missing music, writing, and film production. When you examine the coordinator's logs, you see it decomposed the topic into three subtasks: "AI in digital art creation," "AI in graphic design," and "AI in photography." What is the most likely root cause?

- **A.** The synthesis agent lacks instructions for identifying coverage gaps in the findings it receives from other agents.
- **B.** The coordinator agent's task decomposition is too narrow, resulting in subagent assignments that don't cover all relevant domains of the topic.
- **C.** The web search agent's queries are not comprehensive enough and need to be expanded to cover more creative industry sectors.
- **D.** The document analysis agent is filtering out sources related to non-visual creative industries due to overly restrictive relevance criteria.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **3. Multi-Agent Research System**.
3. Click **Lab 2** in the row of lab buttons. You can also pick it from **Jump to any lab**.
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

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 2` from the `labs` folder.

## What you will see
What to look for: The broad plan searches music, writing, film and visual arts, and the report names any gap.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 28 available
Turn 1: sending the conversation to Claude
  -> Agent({"subagent_type": "web-search", "description": "Music sector AI impact research", "prompt": "Goal: research t…)
  -> Agent({"subagent_type": "web-search", "description": "Writing and publishing AI impact research", "prompt": "Goal: …)
  -> search_web({"query": "AI impact on music industry recording production streaming 2026"})  (subagent)
  -> search_web({"query": "AI-generated music streaming platforms licensing disputes rights 2025 2026 music sector"})  (subagent)
  -> Agent({"subagent_type": "web-search", "description": "Film and TV AI impact research", "prompt": "Goal: research th…)
  -> search_web({"query": "AI impact on book publishing and authors income 2025 2026"})  (subagent)
  -> search_web({"query": "AI translation and editing jobs publishing sector 2025 2026"})  (subagent)
  -> search_web({"query": "AI-generated music uploads streaming platforms royalties labor music sector 2025"})  (subagent)
  -> search_web({"query": "publishers AI training data licensing deals authors lawsuits 2025 2026"})  (subagent)
  -> Agent({"subagent_type": "web-search", "description": "Visual arts AI impact research", "prompt": "Goal: research th…)
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
Subagents only research what the coordinator hands them. When the plan splits "creative industries" into digital art, graphic design and photography, every subagent succeeds and the report still misses music, writing and film. A broad decomposition fixes coverage at the source, and the report then flags any gap it finds.

## Check your answer
**The answer is B.** The coordinator agent's task decomposition is too narrow, resulting in subagent assignments that don't cover all relevant domains of the topic.

The coordinator's logs reveal the root cause directly: it decomposed "creative industries" into only visual arts subtasks (digital art, graphic design, photography), completely omitting music, writing, and film. The subagents executed their assigned tasks correctly—the problem is what they were assigned. Options A, C, and D incorrectly blame downstream agents that are working correctly within their assigned scope.

- **A** falls short: The synthesis agent worked correctly on what it was given; the gap was created upstream.
- **C** falls short: The search agent searched exactly the subtasks it was assigned.
- **D** falls short: Document analysis filtered nothing out; it never received non-visual topics.

## Try this
In fixtures/sources.json replace the visual-arts TIMEOUT with [] and rerun: a valid empty result must not read as a failure.

## How the exam tests this
When every subagent works but coverage is narrow, blame the coordinator's decomposition. Reject options that point at the search, document or synthesis agent: the logs show they did exactly what they were assigned.

The question is an official sample question from the exam guide. Evidence from your run is saved in `labs/simulators/simulator-3-multi-agent-research/evidence/`.
