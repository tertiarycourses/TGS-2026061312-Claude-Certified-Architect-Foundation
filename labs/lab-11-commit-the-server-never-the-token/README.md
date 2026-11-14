# Lab 11: Commit the server, never the token
> Day 1 · Topic 2: Tool Design & MCP Integration · Task statement 2.4 · Simulator 2: Code Generation with Claude Code · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 2.4: **Integrate MCP servers into Claude Code and agent workflows.** You answer one exam-style question, then run the Code Generation with Claude Code simulator once and watch the right answer work with a real Claude call.

## Open this lab

- **The main lab page:** [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/). It lists all 30 Day 1 labs and the 11 Day 2 builds, and holds the API key box.
- **Run it live in your browser (nothing to install):** open [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=11](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab.html?n=11), paste your Anthropic API key into the sidebar once, then press **Simulate it live**. Every call uses `claude-haiku-5-5`.
- **Or on the local Python simulator:** start it (double-click `labs/start-labs.command` on Mac or `labs\start-labs.cmd` on Windows), then open [http://localhost:8765/sim2?lab=11](http://localhost:8765/sim2?lab=11).
- **In a terminal, one click:** double-click `run-lab.command` (Mac) or `run-lab.cmd` (Windows) in this folder. It runs `uv run simulator.py 5` from `simulators/simulator-2-code-generation`.
- **The code it runs:** [simulators/simulator-2-code-generation/simulator.py](https://github.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/blob/master/labs/simulators/simulator-2-code-generation/simulator.py). The lab folder holds the instructions; the simulator folder holds the code, so all its labs share one working system.

## The scenario
You are using Claude Code to accelerate software development. Your team uses it for code generation, refactoring, debugging, and documentation. You need to integrate it into your development workflow with custom slash commands, CLAUDE.md configurations, and understand when to use plan mode vs direct execution.

## The question
Your team needs the same GitHub and docs MCP servers, but each token is personal. Where does the configuration go?

- **A.** Commit .mcp.json with each server's token pasted in, or keep the servers in your own ~/.claude.json.
- **B.** Write the servers into the project CLAUDE.md so Claude reads the connection details on every request.
- **C.** Ask each developer to add the servers by hand in user scope, and share the tokens in the team chat.
- **D.** Commit both servers to the project .mcp.json with ${GITHUB_TOKEN}-style variables, and keep personal experiments in user scope.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **2. Code Generation with Claude Code**.
3. Click **Lab 11** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-2-code-generation
uv run simulator.py 5
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 11` from the `labs` folder.

## What you will see
What to look for: First the scan: .mcp.json holds only ${GITHUB_TOKEN} and ${DOCS_API_KEY} placeholders. Then, live, Claude adds a team 'sentry' server to .mcp.json with "SENTRY_TOKEN": "${SENTRY_TOKEN}", greps the project to prove the token string is in no file, and leaves your user-scope servers in ~/.claude.json alone. Four PASS lines confirm it.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 23 available
Turn 1: sending the conversation to Claude
  -> Glob({"pattern": "**/*", "path": "<temp copy>/works…)
  -> Glob({"pattern": ".*", "path": "<temp copy>/workspa…)
  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again
  <- result: .claude/commands/find-callers.md .claude/commands/review.md .claude/commands/task.md .claude/rules/api-handlers.md .claude/rules/db-mode…
  <- result: .gitignore .mcp.json
Turn 2: sending the conversation to Claude, with the tool results appended
  claude: There's already a `.mcp.json` and a `.gitignore`. I'll read both, plus the README and the example user config, before changing anything.
  -> Read({"file_path": "<temp copy>/workspace/.mcp.json…)
  -> Read({"file_path": "<temp copy>/workspace/.gitignor…)
  -> Read({"file_path": "<temp copy>/workspace/README.md…)
...
   sentry server: {"command": "npx", "args": ["-y", "@sentry/mcp-server"], "env": {"SENTRY_TOKEN": "${SENTRY_TOKEN}"}}
   PASS  the project .mcp.json now has a 'sentry' server
   PASS  its token is the ${SENTRY_TOKEN} placeholder
   PASS  the personal token is in no file git would commit (committed: none; git-ignored: none)
   PASS  your user-scope MCP servers in ~/.claude.json are unchanged
Estimated API cost: US$0.0043 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
.mcp.json is project scope, so git carries it to every teammate; personal servers live in user scope (~/.claude.json). Claude Code expands ${GITHUB_TOKEN} and ${DOCS_API_KEY} from each developer's own environment when it loads the file, so the committed text never holds a secret. The lab's scan finds those two placeholders and zero literal tokens, makes no API call and never writes to your real ~/.claude.json.

## Check your answer
**The answer is D.** Commit both servers to the project .mcp.json with ${GITHUB_TOKEN}-style variables, and keep personal experiments in user scope.

Project-scope .mcp.json travels with git so everyone gets the same servers, and ${VAR} expansion reads each developer's own token at load time.

- **A** falls short: A literal token in a committed file leaks a secret; a server in one person's ~/.claude.json never reaches teammates.
- **B** falls short: CLAUDE.md holds instructions, not MCP server configuration; Claude Code does not start servers from it.
- **C** falls short: Hand configuration drifts between machines, and sharing tokens in chat is a credential leak.

## Try this
Rerun it and compare with the saved evidence/ copy: Claude's wording changes from run to run, the decision should not.

## How the exam tests this
Shared server, personal credential: commit the server to .mcp.json with ${VAR} expansion and keep solo experiments in user scope. Reject any option that pastes a literal token into the shared file, or parks a team server in one person's ~/.claude.json where teammates never see it.

The question is written for this course from the exam guide's task statement. Evidence from your run is saved in `labs/simulators/simulator-2-code-generation/evidence/`.
