# Lab 15: Testing rules for test files spread across every folder
> Day 1 · Topic 3: Claude Code Configuration & Workflows · Task statement 3.3 · Simulator 3: Multi-Agent Research System · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 3.3: **Apply path-specific rules for conditional convention loading.** You answer one exam-style question, then run the Multi-Agent Research System simulator once and watch the right answer work with a real Claude call.

## The scenario
You are building a multi-agent research system using the Claude Agent SDK. A coordinator agent delegates to specialized subagents: one searches the web, one analyzes documents, one synthesizes findings, and one generates reports. The system researches topics and produces comprehensive, cited reports.

## The question
This team uses Claude Code to maintain the research system's TypeScript repository. Citation-verification tests, report-rendering tests, and orchestration tests live beside implementation files across multiple top-level folders. The team wants the same testing guidance to apply only when Claude Code is working on test files, without duplicating guidance in every package. What should they do?

- **A.** Create .claude/rules/testing.md without frontmatter, then rely on the file name to limit it to test files.
- **B.** Place the testing guidance in the root CLAUDE.md file so every Claude Code session receives the same instructions.
- **C.** Add a CLAUDE.md file in each directory that contains tests, then repeat the same testing guidance in each file.
- **D.** Create .claude/rules/testing.md with paths frontmatter matching the test-file patterns, then place the testing guidance below it.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **3. Multi-Agent Research System**.
3. Click **Lab 15** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-3-multi-agent-research
uv run rules_sim.py D
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 15` from the `labs` folder.

## What you will see
What to look for: The rule loads for the test edit only, from one copy.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 23 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "repo-rules/orche…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: 1 import { plan } from './orchestrator'; 2 3 test('plans four sectors', () => { 4 expect(plan('AI')).toHaveLength(4); 5 }); 6
Turn 2: sending the conversation to Claude, with the tool results appended
  -> Edit({"replace_all": false, "file_path": "labs/simulators/simulator-3-multi-agent-res…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: The file repo-rules/orchestration/orchestrator.test.ts has been updated successfu…
Turn 3: sending the conversation to Claude, with the tool results appended
  claude: TESTING-GUIDANCE-LOADED, from `.claude/rules/testing.md`. I added `expect(plan('AI')[0]).toContain('music');` with a one-line comment to th…
  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends
...
variant | guidance placed in                      | copies | test edit | impl edit
   D    | .claude/rules/testing.md, paths: **/*.test.ts |   1    |   yes     |   no
Estimated API cost: US$0.0079 for 2 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
A rule file in .claude/rules/ with paths frontmatter loads only when Claude works on a file matching those globs. The lab plants a marker, TESTING-GUIDANCE-LOADED, in the guidance: variant D shows it on the test edit and not on the renderer.ts implementation edit, from a single copy. Root CLAUDE.md and an unscoped rule load every time, and per-folder CLAUDE.md files need three copies to reach the same tests.

## Check your answer
**The answer is D.** Create .claude/rules/testing.md with paths frontmatter matching the test-file patterns, then place the testing guidance below it.

Claude Code separates broad project memory ( CLAUDE.md or .claude/CLAUDE.md ) from topic rules in .claude/rules/ . A rule file can carry YAML frontmatter with a paths field of glob patterns (for example "**/*.test.ts" ), so one rule matches files by extension, directory or both. That fits conventions that cut across the tree, such as tests placed beside their code.

- **A** falls short: A file name does not scope a rule. Without paths the rule loads unconditionally.
- **B** falls short: Avoids duplication but applies the guidance far more broadly than needed.
- **C** falls short: Directory CLAUDE.md files suit guidance that follows directory boundaries. Here they mean duplication and drift, which the team explicitly wants to avoid.

## Try this
In fixtures/sources.json replace the visual-arts TIMEOUT with [] and rerun: a valid empty result must not read as a failure.

## How the exam tests this
Guidance that follows a file pattern across the tree, such as tests beside their code, belongs in one .claude/rules/ file with a paths glob like "**/*.test.ts". A file name alone scopes nothing, so option A loads everywhere; root CLAUDE.md is too broad, and per-directory copies drift.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-3-multi-agent-research/evidence/`.
