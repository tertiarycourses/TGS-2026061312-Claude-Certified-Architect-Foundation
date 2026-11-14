# Lab 35: Vibe-code a multi-agent research team

> Day 2 · Bonus Topic B · Scenario 3: Multi-Agent Research System · Task statements 1.2, 1.3, 5.3 · Vibe-coding lab · Claude Haiku 5.5 · 60 minutes

**Be the manager of your own AI research department. In 60 minutes you vibe-code a coordinator that splits "Impact of AI on creative industries" into sectors, sends a search agent to every sector at once (four or more), has another read the internal PDFs, and hands everything to a writer agent that cites every number. Then you feed it the narrow plan from the exam question and watch every agent succeed while the report misses three sectors.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab. Copy the prompts from [this lab's prompt page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-35.html) (one Copy button per prompt), or from `prompts.html` in this folder.

## Day 2: two bonus topics

| Lab | You build | Exam tasks |
|---|---|---|
| 31–34 | **Bonus Topic A:** one customer resolution agent, then its MCP server and its two hooks | 1.1, 1.4, 1.5, 2.1, 2.2, 2.4 |
| **35 (this lab)** | **Bonus Topic B:** a coordinator and three kinds of subagent, run in parallel, with a live test | 1.2, 1.3, 5.3 |

This is a **new project**, not the Orderly agent. Make a fresh folder for it.

## What you'll build

```
  "Impact of AI on creative industries"
        |
        v
  research.py -- the coordinator (claude-haiku-5-5). It never searches: it delegates.
        |
        |  one turn, run in parallel:
        +--> search agent: music          --+
        +--> search agent: writing          |   one per sector, four or more
        +--> search agent: film (times out) |   (the coordinator may add more);
        +--> search agent: visual arts      |   each one: a fresh conversation,
        +--> ...                            |   only its own tool, only its task
        +--> documents agent: 2 PDFs      --+
        |
        |  next turn:
        +--> synthesis agent: every finding + source + gap pasted into its task
        |
        v
  report.json + report.md (every claim cited), and a coverage check in code
```

On Day 1 you watched these failures in Lab 2 (a narrow plan), Lab 3 (searches that ran one by one), Lab 27 (a timeout hidden as success) and Lab 30 (a vendor number treated like a peer-reviewed one). Today you build the system that avoids all four.

## What's in this folder

| File | What it is |
|---|---|
| `starter/sources.json` | the research sandbox: web results for four sectors (film always times out) and two internal PDFs. Every name, number and URL is invented. Prompt 1 downloads it into your project. |
| `starter/.env.example` | the one line your `.env` needs |
| `prompts.html` | every prompt below, each with a Copy button |
| `solution/` | our finished code, for your trainer. You don't need it: build your own with the prompts. |
| `sample-output.txt` | a live run of `solution/research.py` and then `test_research.py` with 8/8 checks |

## Before you start (5 minutes)

- **1. Open your AI coding tool in a new, empty folder** called `research-team` (a new folder, not `orderly-agent`). In VS Code, Cursor, Windsurf or Antigravity: **File → Open Folder → New Folder**. Claude Code or Codex in a terminal: start it from that folder. Any agent that can create files and run terminal commands works; the prompts use no tool-specific feature.
- **2. Have your Anthropic API key ready.** It starts with `sk-ant-`. You'll paste it into a file in Step 1, never into the chat.

That's all. **Prompt 1 does the rest of the set-up:** it installs uv (the Python tool) if your computer doesn't have it, downloads the lab's data file and creates the project.

One full research run makes about eight Claude calls with `claude-haiku-5-5`: a few US cents at most.

**Tested on 14 Nov 2026.** We pasted these exact six prompts, in one conversation, into Claude Code 2.1.325 and Codex 0.167.0, four runs each. All 8 builds passed `test_research.py` 8/8 on a fresh re-run (6 to 8 minutes of tool time per run). We ran them again after Prompt 1 took over the set-up and Prompt 4 gained the provenance check: 8 of 8 passed 8/8 again, and with uv removed from the computer, Prompt 1 installed it. Not a benchmark: your tool, model and wording will differ. Antigravity has no headless mode, so we couldn't machine-test it; the prompts use no tool-specific features.

## Step 1 · Set up the project (5 minutes)

### Prompt 1

```text
Set up this folder as a new Python project for a multi-agent research team. Do each step, then tell me what you did.

1. Check uv with `uv --version`. If uv is missing, install it with its official installer:
   macOS or Linux: curl -LsSf https://astral.sh/uv/install.sh | sh
   Windows (PowerShell): powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   If uv is still not found after installing, use its full path (~/.local/bin/uv, or %USERPROFILE%\.local\bin\uv.exe
   on Windows) for the rest of this chat.
2. If sources.json is not in this folder, download it into this folder from
   https://raw.githubusercontent.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/master/labs/lab-35-build-a-multi-agent-research-team/starter/sources.json
3. Run `uv init --bare`, then `uv add anthropic python-dotenv`. (uv installs Python itself if it needs to.)
4. Create .gitignore with: .env, .venv/, __pycache__/, report.json, report.md
5. Create .env.example with one line: ANTHROPIC_API_KEY=paste-your-key-here
   If .env does not exist yet, create it with that same line. After that, never open, print or ask me for .env or my key.
6. Create AGENTS.md with these project rules for any AI coding assistant:
   - Claude model: claude-haiku-5-5 through the official anthropic Python SDK, max_tokens 8000.
   - All research data comes from sources.json, a fictional sandbox. Never invent a source, URL or number.
   - A subagent sees only its task text. Never pass one agent's message history to another agent.
   - Run Python with `uv run`.
   - Never open, print or ask for .env or the API key.
7. Create CLAUDE.md containing the single line @AGENTS.md so Claude Code reads the same rules.

Then show me the file tree, and tell me to open .env in the editor and replace paste-your-key-here with my API key.
```

**Checkpoint.** You see `pyproject.toml`, `uv.lock`, `.gitignore`, `.env.example`, `AGENTS.md`, `CLAUDE.md` and `sources.json`.

**Now the one thing you type yourself:** open `.env` in your editor, replace `paste-your-key-here` with your API key and save. Never paste the key into the AI chat: anything you type there is sent to the coding tool's servers. If Prompt 1 installed uv, restart your coding tool's terminal before you run commands yourself.

## Step 2 · Write the two tools (10 minutes)

### Prompt 2

```text
Read AGENTS.md and sources.json. Create research_tools.py with the research team's two tools. Both read sources.json.

1. sector_of(text): return the first sector in sources.json "sectors" (in file order) whose keyword appears in the
   lower-cased text, or None.
2. search_web(query): find the query's sector with sector_of. No sector: return {"query", "sector": None, "results": []}.
   If that sector's "web" entry is a list, return {"query", "sector", "results": the list}. If it is an object with
   "error", raise ToolFailure("timeout", ...) carrying sector, attempted_query and its partial_results.
3. read_document(name): return the document from "documents" whose name matches (ignore case). Unknown name: raise
   ToolFailure("not_found", ...) carrying the list of available names.

- Give both tools a one-line docstring that says what they do and when to use them; read_document's tool description
  also lists the available document names.
- ToolFailure is an exception carrying errorCategory, isRetryable (false), message and any extra fields.
- Add TOOLS: a dict from tool name to its Anthropic tool definition (name, description, input_schema).
- Add run_tool(name, args) that returns (result, is_error). On ToolFailure it returns the error fields and True.

Then run a quick check with uv: search_web "AI in music production", search_web "AI in film production",
sector_of "AI in graphic design", and read_document "BrightCanvas-Customer-Benchmark-2026.pdf". Show me the results.
```

**Checkpoint.** Music returns two results. Film returns `is_error True` with `errorCategory: timeout` **and** one `partial_results` hit: a failure that still tells you what it found (Day 1, Lab 27). Graphic design maps to `visual_arts`.

## Step 3 · Write the three subagents (15 minutes)

### Prompt 3

```text
Create agents.py with three subagents and one function that runs any of them. Follow AGENTS.md.

- AGENTS is a dict: agent name -> {"tools": [tool names], "system": its system prompt}. Use these exactly:
  "search", tools ["search_web"], system:
    "You are a web-search subagent. Research only the sector named in your task, with at most two search_web calls.
    Return ONLY a JSON object: {"sector": str, "findings": [{"claim": str, "source_url": str, "source_title": str, "published": str}], "gaps": [str]}.
    Every claim must come from a search result; copy its url exactly. The search index is a small curated sandbox: treat its
    results as authoritative and do not comment on the sources. "gaps" lists only searches that failed or found nothing: if a
    search fails, keep any partial_results as findings and add a gap that says what failed and for which query. Never invent a source."
  "documents", tools ["read_document"], system:
    "You are a document-analysis subagent. Read every document named in your task with read_document.
    Return ONLY a JSON object: {"findings": [{"claim": str, "source": "<file name>, p.<page>", "evidence": "<kind of document and its method>"}], "gaps": [str]}.
    Say which findings are peer-reviewed and which come from a vendor. "gaps" lists only documents you could not read.
    Never invent a source."
  "synthesis", no tools, system:
    "You are a synthesis subagent. Write a short research report using ONLY the findings in your task.
    Return ONLY a JSON object: {"title": str, "summary": str, "findings": [{"sector": str, "claim": str, "source": str}], "gaps": [str]}.
    Summary under 80 words. One finding per source, and every finding keeps its source (url or document reference) exactly
    as given: never a finding without a source. "gaps" lists, one line each, the failed searches, the searches that found
    nothing and the unreadable documents you were told about."
- run_subagent(agent, task): a FRESH agentic loop whose first and only user message is the task text. Pass only that
  agent's own tools (send no tools parameter when it has none). Same loop rules as Lab 31: append the whole
  response.content, all tool_result blocks in ONE user message with is_error, stop when stop_reason is not "tool_use"
  or after 6 turns. Refuse any tool that is not in the agent's list with an error tool_result.
  Return {"agent", "task", "text": the final text, "json": the JSON object parsed from the text (strip ``` fences;
  None if it does not parse), "calls": every tool call with tool, input, result and is_error}.
- agents.py run directly: uv run agents.py <agent> "<task>" prints each tool call, then the final text.

Run: uv run agents.py search "Research how AI is affecting the film sector."
```

**Checkpoint.** The film search agent makes one or two `search_web` calls, both `timeout`. Its JSON still holds the Indie Screen Council finding from `partial_results`, plus a gap saying the film search timed out. It didn't crash, and it didn't pretend the search worked.

## Step 4 · Write the coordinator (15 minutes)

### Prompt 4

```text
Create research.py, the coordinator. It never searches or reads documents itself: it delegates to the subagents.

- One tool for Claude, "delegate", with input {agent: one of the AGENTS names (enum), task: string}. Description:
  "Give one task to a subagent and get its result back. agent: 'search' (web search on one sector), 'documents' (reads
  the internal PDFs), 'synthesis' (writes the final report from the findings you paste in). The subagent sees ONLY the
  task text, never this conversation."
- Use this system prompt exactly (SYSTEM), and keep its rule 1 in its own constant RULE_1:
  "You are the coordinator of a research team. You never search or read documents yourself: you delegate.
  1. Decompose the topic into the distinct sectors it spans. For creative industries, cover at least music, writing,
     film and visual arts. Breadth first: a narrow plan makes a narrow report.
  2. In ONE turn, delegate one "search" task per sector (they run in parallel), plus one "documents" task that names
     both internal documents: Halden-Rao-2026-Journal-of-Creative-Economies.pdf and BrightCanvas-Customer-Benchmark-2026.pdf.
  3. Subagents see nothing but their task text. Put everything a subagent needs in its task.
  4. When the results are back, delegate ONE "synthesis" task. Paste into it every finding with its exact source and
     every gap the subagents reported.
  5. Then reply with a two-sentence summary for the user."
- run_research(topic, plan=None): the coordinator's agentic loop (claude-haiku-5-5, max 8 turns), user message
  "Research topic: <topic>". If plan is given, replace RULE_1 in the system prompt with
  "1. Follow exactly this research plan, one search task per subtask and nothing else: <plan>".
  Run ALL the delegate calls from one turn AT THE SAME TIME with a ThreadPoolExecutor, then send every subagent's
  final text back as the tool_result blocks in ONE user message. Record each delegation (run_subagent's dict plus the
  coordinator turn number).
- coverage(delegations): the sectors that a search_web call actually hit (the result's sector, or sector_of the query
  when it failed) and the sectors in sources.json that were never searched.
- check_provenance(report), a gate in code: a finding whose source contains no URL or document name from
  sources.json is removed from findings and added to gaps as "Unsourced claim removed: <claim>". Print each one.
- run_research returns {"topic", "summary": the coordinator's final text, "report": the last synthesis JSON after
  check_provenance (or {}), "delegations", "searched", "missing"}.
- research.py run directly: uv run research.py "<topic>" [--plan "<a; b; c>"]. Print each coordinator turn with its
  stop_reason and number of delegations, each delegation with its agent, the first 90 characters of its task and its
  tool calls (ok or the error category), and how many seconds the turn's subagents took. Write report.json and
  report.md (title, summary, one bullet per finding with its source, then the gaps). Print report.md, then
  "Coverage: searched ...; never searched: ...", then the coordinator's summary.

Run: uv run research.py "Impact of AI on creative industries"
```

**Checkpoint.** Coordinator turn 1 sends **five or more delegations at once**: one search per sector and one documents task. They finish in roughly the time of the slowest one, not the sum (Day 1, Lab 3). Turn 2 is one synthesis. Turn 3 is `end_turn`. `report.md` cites a URL or PDF page for every claim (the provenance check removes any claim without one), flags BrightCanvas as a vendor poll, lists the film timeout under **Gaps**, and the last line says `never searched: none`.

## Step 5 · Replay the exam question's plan (5 minutes, no code change)

### Prompt 5

```text
Do not change any code. Run the narrow plan from the exam question and show me the output:
uv run research.py "Impact of AI on creative industries" --plan "AI in digital art creation; AI in graphic design; AI in photography"
Then compare it with the last run in three sentences: did any subagent fail, what is missing from the report, and
which agent caused it?
```

**Checkpoint.** Every subagent succeeds. The report is tidy, cited and confident, and it covers only visual arts. The coverage line says `never searched: film, music, writing`. No subagent did anything wrong: **the coordinator's decomposition was too narrow** (Day 1, Lab 2, answer B). That's why the coverage check lives in code. A report can look complete without being complete.

## Step 6 · Prove it with live tests (10 minutes)

### Prompt 6

```text
Write test_research.py. It imports run_research from research.py, does two live runs, prints PASS or FAIL for each
check, prints "N/8 checks passed" and exits 1 if any check fails. Check the recorded delegations and tool calls,
not Claude's wording.

Run A: run_research("Impact of AI on creative industries")
  1. a search ran for every sector: music, writing, film, visual arts (nothing in "missing")
  2. two or more search delegations ran in the same coordinator turn (parallel)
  3. every subagent used only its own tools (search: search_web; documents: read_document; synthesis: none)
  4. the synthesis task carried the findings: at least 3 URLs from sources.json appear in its task text
  5. every finding's source in the report contains a URL or document name from sources.json
  6. the report's findings cite URLs from at least 3 different sectors
  7. one of the report's gaps mentions film
Run B: run_research("Impact of AI on creative industries",
                    plan="AI in digital art creation; AI in graphic design; AI in photography")
  8. "missing" includes music, writing and film

Run `uv run test_research.py`. If a check fails, show me why and fix research.py or agents.py, not the test. Then run
it again.
```

**Checkpoint.** `8/8 checks passed`. Take a screenshot of the final lines: that's your evidence for Bonus Topic B.

## Run it

From your project folder. Run them yourself in a terminal, or paste one into your coding tool's chat as "Run: <command> and show me the output."

| What | Command |
|---|---|
| The whole team on the topic | `uv run research.py "Impact of AI on creative industries"` |
| The exam question's narrow plan | `uv run research.py "Impact of AI on creative industries" --plan "AI in digital art creation; AI in graphic design; AI in photography"` |
| One subagent on its own | `uv run agents.py search "Research how AI is affecting the music sector."` |
| The live tests: two runs, eight checks | `uv run test_research.py` |
| The last report | open `report.md` |

 Our run is in `sample-output.txt`.

## Stretch · The same team in the Claude Agent SDK

```text
Make sdk_team.py: the same research team built with the Claude Agent SDK (uv add claude-agent-sdk), model
claude-haiku-5-5. Define "search", "documents" and "synthesis" as AgentDefinition subagents with the same system
prompts, expose search_web and read_document through an in-process SDK MCP server, give each subagent only its own
tool, and let the coordinator spawn them with the Task tool. Run it on "Impact of AI on creative industries".
```

Compare the two. The SDK runs the loops and the Task tool for you, but the rules don't change: a subagent knows only what its prompt says, and the coordinator owns the plan.

## Explain it back (with your trainer)

- **1.** In run B every subagent succeeded. Which agent caused the missing sectors, and which line of `research.py` would you change? (Day 1, Lab 2.)
- **2.** The synthesis agent never saw the search agents' work. How did the findings reach it? What happens if the coordinator writes only "write the report"?
- **3.** Why do `coverage()` and `check_provenance()` live in code instead of asking Claude whether the report is complete and cited?
- **4.** The film search failed, yet one film finding reached the report. Where did it come from, and why is it marked as a gap too? (Day 1, Lab 27.)

## Troubleshooting

| You see | Fix prompt |
|---|---|
| The delegations run one after another (turn time = the sum) | "Run every delegate call from one coordinator turn at the same time with a ThreadPoolExecutor." |
| The coordinator searches one sector per turn | "Rule 2 says delegate every search in ONE turn. Keep the system prompt exactly as given." |
| `report.json` is `{}` | "The synthesis agent's reply must parse as JSON: strip ``` fences, and set max_tokens to 8000." |
| A report URL isn't in sources.json | "The synthesis task must paste every finding with its exact source URL; the agents must never invent a source." |
| Run B still searches music | "With --plan, replace RULE_1 in the system prompt; don't add the plan to the user message." |
| The film timeout disappears | "On a failed search, keep partial_results as findings and add a gap; never return an empty success." |
| `tool_use ids were found without tool_result blocks` | "Send every delegate tool_result in one user message right after the coordinator turn." |
