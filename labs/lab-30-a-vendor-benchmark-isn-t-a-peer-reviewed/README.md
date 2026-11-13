# Lab 30: A vendor benchmark isn't a peer-reviewed study
> Day 1 · Topic 5: Context Management & Reliability · Task statement 5.6 · Simulator 3: Multi-Agent Research System · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 5.6: **Preserve information provenance and handle uncertainty in multi-source synthesis.** You answer one exam-style question, then run the Multi-Agent Research System simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=30](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=30), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim3?lab=30](http://localhost:8765/sim3?lab=30).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run research_system.py --case UC-24` from `simulators/simulator-3-multi-agent-research`.
- **The code it runs:** [simulators/simulator-3-multi-agent-research/research_system.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-3-multi-agent-research/research_system.py), with the case file [simulators/simulator-3-multi-agent-research/cases/UC-24.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-3-multi-agent-research/cases/UC-24.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are building a multi-agent research system using the Claude Agent SDK. A coordinator agent delegates to specialized subagents: one searches the web, one analyzes documents, one synthesizes findings, and one generates reports. The system researches topics and produces comprehensive, cited reports.

## The question
During evaluation, the final report cites sources but sometimes treats a peer-reviewed study, a vendor benchmark, and an internal survey as equivalent evidence for the same claim. The search and document-analysis subagents currently return concise finding summaries plus a general list of sources consulted. What change best supports accurate downstream synthesis?

- **A.** Add a report-generation pass that expands the final narrative with a separate bibliography and citation appendix.
- **B.** Ask the coordinator to retain full subagent transcripts and have the synthesizer infer provenance from prior work.
- **C.** Require each subagent to return structured claim records with source location, publication date, evidence excerpt, and methodology notes.
- **D.** Give each subagent broader tool access so it can inspect all available sources before summarizing its findings.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **3. Multi-Agent Research System**.
3. Click **Lab 30** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-3-multi-agent-research
uv run research_system.py --case UC-24
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 30` from the `labs` folder.

## What you will see
What to look for: Each finding carries document, page, date and method note. 41% and 55% stay side by side.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 28 available
Turn 1: sending the conversation to Claude
  claude: I'll start the four sector searches and the internal-document analysis in parallel.
  -> Agent({"description": "Web research: AI in music", "subagent_type": "web-search", "prompt": "Overall topic: Impact …)
  -> search_web({"query": "AI impact on music industry survey 2026"})  (subagent)
  -> Agent({"description": "Web research: AI in writing and publishing", "subagent_type": "web-search", "prompt": "Overa…)
  -> search_web({"query": "AI music licensing royalties 2026"})  (subagent)
  -> search_web({"query": "AI music production labor revenue report"})  (subagent)
  -> Agent({"description": "Web research: AI in film and TV", "subagent_type": "web-search", "prompt": "Overall topic: I…)
  -> search_web({"query": "generative AI authors publishers survey 2026"})  (subagent)
  -> search_web({"query": "AI translation audiobooks publishing copyright lawsuit 2026"})  (subagent)
  -> search_web({"query": "AI journalism copywriting disclosure rules 2026"})  (subagent)
...
[result] success turns=8 cost=$0.0165
  PASS - document-analysis result parses as JSON with a findings list
  PASS - every finding has document, page, published and methodology_note
  PASS - the two SME adoption findings are both present with conflict_with set
Estimated API cost: US$0.0165 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
The synthesiser knows only what the handoff carries, and a prose summary plus a general source list drops which claim came from where. Document-analysis now returns structured claim records with document, page, date and a methodology note. With that metadata in hand, the report keeps the conflicting 41% and 55% figures side by side with their sources instead of blending them into one claim.

## Check your answer
**The answer is C.** Require each subagent to return structured claim records with source location, publication date, evidence excerpt, and methodology notes.

Provenance is an interface contract. Downstream agents can rely only on what is explicitly returned in the handoff. Non-fork subagents start with a fresh context and don't share the parent's history. Structured claim records (claim, evidence excerpt, URL or document location, publication or collection date, methodology notes) stop the synthesiser from treating incomparable evidence as interchangeable. This is not just a citation-formatting preference, and it follows the guidance to return high-signal fields.

- **A** falls short: Formatting at the end cannot recover distinctions already lost upstream.
- **B** falls short: Full transcripts bloat the context, and inferring provenance is unreliable.
- **D** falls short: Inspecting more sources does not help when the handoff still drops the metadata.

## Try this
In fixtures/sources.json replace the visual-arts TIMEOUT with [] and rerun: a valid empty result must not read as a failure.

## How the exam tests this
Treat provenance as an interface contract: pick structured claim records from each subagent. Reject a bibliography pass at the end, which cannot recover distinctions lost upstream, and reject asking the synthesiser to infer provenance from full transcripts.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-3-multi-agent-research/evidence/`.
