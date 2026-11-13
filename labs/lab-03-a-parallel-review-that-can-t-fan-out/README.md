# Lab 3: A /parallel-review that can't fan out because Task isn't allowed
> Day 1 · Topic 1: Agentic Architecture & Orchestration · Task statement 1.3 · Simulator 2: Code Generation with Claude Code · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 1.3: **Configure subagent invocation, context passing, and spawning.** You answer one exam-style question, then run the Code Generation with Claude Code simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=3](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=3), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim2?lab=3](http://localhost:8765/sim2?lab=3).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run casekit.py --case UC-25` from `simulators/simulator-2-code-generation`.
- **The code it runs:** [simulators/simulator-2-code-generation/casekit.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/casekit.py), with the case file [simulators/simulator-2-code-generation/cases/UC-25.json](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/cases/UC-25.json). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are using Claude Code to accelerate software development. Your team uses it for code generation, refactoring, debugging, and documentation. You need to integrate it into your development workflow with custom slash commands, CLAUDE.md configurations, and understand when to use plan mode vs direct execution.

## The question
A custom /parallel-review command starts an SDK run in a repository pinned to a pre-v2.1.63 Claude Code configuration, where subagent delegation is performed with Task . It should fan out across specialized review subagents. The current SDK options auto-approve only Read, Grep, and Glob, and each run pauses at the first attempted subagent delegation with an interactive permission prompt. What should the team change?

- **A.** Remove delegation tools from allowed tools and rely on permission prompts.
- **B.** Add Agent only to the worker subagents' tools list for nested calls.
- **C.** Add Task delegation guidance to CLAUDE.md for the project repository.
- **D.** Add Task to the coordinator SDK run's allowedTools / allowed_tools list.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **2. Code Generation with Claude Code**.
3. Click **Lab 3** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-2-code-generation
uv run casekit.py --case UC-25
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 3` from the `labs` folder.

## What you will see
What to look for: Delegation disallowed: no reviewer spawns. Allowed: the subagent runs and its answer comes back.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 25 available
Turn 1: sending the conversation to Claude
  -> ListAgents({})
  -> ToolSearch({"query": "select:Agent", "max_results": 3})
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: This session is workspace-89 [77ac44] — the name other sessions use to message it (it is not listed below; a message to it would be a me…
  <- result: No matching deferred tools found. Note: these configured MCP servers failed to connect, so their tools are unavailable for this session:…
Turn 2: sending the conversation to Claude, with the tool results appended
  claude: DELEGATION BLOCKED I have no agent-spawning tool in this session, and no peer session is named `style-reviewer`. I did not review `src/util…
  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends
  connected: claude-haiku-5-5, tools: 26 available
Turn 1: sending the conversation to Claude
...
   UC-25 t1: success  $0.00
   UC-25 t2: success  $0.00
   PASS - without the delegation tool the fan-out cannot happen
   PASS - with Agent (Task before v2.1.63) in the allowed list the reviewer's verdict comes back
   PASS - learner can state that allowedTools auto-approves and is not a hard allowlist  (reviewed against the expected answer)
Estimated API cost: US$0.0089 for 3 Claude runs on Claude Haiku 5.5, billed to your Anthropic API key.
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
allowedTools auto-approves only what it lists, so with Read, Grep and Glob alone the first delegation call drops into an interactive permission prompt and the run stalls. Add the delegation tool to the coordinator's list and the subagent spawns, runs and returns its answer. The simulator uses the current tool name, Agent; the exam's pinned pre-v2.1.63 setup calls the same tool Task.

## Check your answer
**The answer is D.** Add Task to the coordinator SDK run's allowedTools / allowed_tools list.

In this legacy configuration delegation goes through Task , so the coordinator run must auto-approve it. The subagents are defined. The problem is that the first delegation is not auto-approved and falls into interactive permission handling. Current docs describe the tool as Agent (renamed from Task in v2.1.63), so current configurations should generally use Agent . Also note that allowedTools auto-approves the listed tools but is not a hard allow-list on its own: unlisted tools fall through to the permission mode or callback unless they are denied.

- **A** falls short: The opposite of the fix: the permission prompts are what stall the run.
- **B** falls short: Wrong tool name for this pinned version, and on the wrong agent: the coordinator is the one doing the delegating.
- **C** falls short: Guidance text grants no permission.

## Try this
Rerun it and compare with the saved evidence/ copy: Claude's wording changes from run to run, the decision should not.

## How the exam tests this
Grant the delegation tool on the coordinator, because the coordinator is the one delegating. Reject CLAUDE.md guidance, which grants no permission, and reject adding Agent to the workers in a configuration that still uses Task.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-2-code-generation/evidence/`.
