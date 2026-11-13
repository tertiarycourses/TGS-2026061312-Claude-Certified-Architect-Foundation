# Lab 14: Keep a noisy case review out of your main session
> Day 1 · Topic 3: Claude Code Configuration & Workflows · Task statement 3.2 · Simulator 1: Customer Support Resolution Agent · About 15 minutes · Claude Haiku 5.5

## Goal
Task statement 3.2: **Create and configure custom slash commands and skills.** You answer one exam-style question, then run the Customer Support Resolution Agent simulator once and watch the right answer work with a real Claude call.

## The scenario
You are building a customer support resolution agent using the Claude Agent SDK. The agent handles high-ambiguity requests like returns, billing disputes, and account issues. It has access to your backend systems through custom Model Context Protocol (MCP) tools (get_customer, lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact resolution while knowing when to escalate.

## The question
This team wants an on-demand Claude Code workflow named /case_review for support engineers. The workflow produces lengthy exploratory notes, should run outside the main conversation context, should let Claude read and search project files without repeated permission prompts, and should show the expected case ID when developers invoke it. Which setup best fits these requirements?

- **A.** Create .claude/skills/case_review/SKILL.md with context: main , allowed-tools for Read and Grep, and an argument-hint for the case ID.
- **B.** Create .claude/skills/case_review.md with context: fork , allowed-tools for Read and Grep, and an argument-hint for the case ID.
- **C.** Create .claude/skills/case_review/SKILL.md with context: fork , allowed-tools for Read and Grep, and an argument-hint for the case ID.
- **D.** Create .claude/skills/case_review/SKILL.md with context: fork , allowed-tools as an exclusive allow-list, and argument-hint as a validator.

Pick your answer before you run anything. The answer and the reasoning are at the end, under **Check your answer**.

## Before you start (once per laptop)
- The course folder is on your laptop (Day 1 setup), and you have an Anthropic API key. It starts with `sk-ant-`.
- The simulators are running. **Windows:** double-click `labs\start-labs.cmd`. **Mac:** double-click `labs/start-labs.command`. The first time, the window asks for your API key and saves it to `labs/.env`. Keep that window open during class.
- Your browser opens the simulators at http://localhost:8765. If that port is busy the window prints another address, such as http://localhost:8766.

## Steps in the simulator website
1. Look at the left sidebar. It should say **Anthropic API key saved**. If it says **No API key yet: paste it here**, paste your key into the **Anthropic API key** box and press **Save key**.
2. In the left menu, click **1. Customer Support Resolution Agent**.
3. Click **Lab 14** in the row of lab buttons. You can also pick it from **Jump to any lab**.
4. Read the question and click the answer you chose. The page tells you at once whether it is right, and why. Open **Why the other answers fall short** to see each distractor's flaw.
5. Under **Watch the right answer work**, open **See the code this lab runs** if you want to read the script first.
6. Press **▶ Simulate it live**. The output box fills line by line while Claude Haiku 5.5 works. The run takes from a few seconds to about a minute.
7. When it finishes, read **Read your result**: what this run showed, **What to look for**, **Why it happens** and the **Exam tip**.

## Or run it from a terminal
Open a terminal in the `labs` folder. **Windows:** in File Explorer, open `labs`, click the address bar, type `powershell` and press Enter. **Mac:** right-click the `labs` folder and choose **New Terminal at Folder**. Then:

```
cd simulators/simulator-1-customer-support
uv run case_review.py CS-02
```

Or let the course tool print the question, run the command and show the reasoning in one go: `uv run run_lab.py 14` from the `labs` folder.

## What you will see
What to look for: The review returns as a summary. The evidence JSON stays out of the session.

These lines are from our own run of this lab on Claude Haiku 5.5. Your wording will differ, because Claude writes each reply fresh; the tool calls, decisions and checks should match.

```
  connected: claude-haiku-5-5, tools: 25 available
Turn 1: sending the conversation to Claude
  -> Read({"file_path": "evidence/runs/CS-02.…)  (subagent)
  -> Grep({"pattern": "CS-02", "path": "cases…)  (subagent)
  -> Read({"file_path": "cases/CS-02.json"})  (subagent)
  claude: CS-02 review: all four checks pass; no prompt change needed. - PASS: get_customer ran before lookup_order (ToolSearch first, which is harml…
  <- result: 1 { 2 "case_id": "CS-02", 3 "title": "Damaged item above the $500 auto-approval limit", 4 "message": "The standing desk in ORD-5502 arri…
  <- result: cases/CS-02.json-1-{ cases/CS-02.json:2: "case_id": "CS-02", cases/CS-02.json-3- "title": "Damaged item above the $500 auto-approval lim…
  <- result: 1 { 2 "case_id": "CS-02", 3 "title": "Damaged item above the $500 auto-approval limit", 4 "exam_task": "1.5 hook blocks policy-violating…
Estimated API cost: US$0.0064 for 1 Claude run on Claude Haiku 5.5, billed to your Anthropic API key.
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
The SKILL.md frontmatter sets context: fork, so Claude runs the review in an isolated subagent context and hands back only its summary. The long evidence/runs/CS-02.json file is read inside that fork and never lands in your main conversation. allowed-tools: Read, Grep pre-approves the reads so the skill never stops to ask, and argument-hint: [case-id] shows the expected argument in autocomplete.

## Check your answer
**The answer is C.** Create .claude/skills/case_review/SKILL.md with context: fork , allowed-tools for Read and Grep, and an argument-hint for the case ID.

Skills are directories containing a required SKILL.md with YAML frontmatter and Markdown instructions. A project skill under .claude/skills/<name>/SKILL.md can be invoked as /<name> . context: fork is the key setting, because it runs the exploratory work in an isolated subagent context instead of cluttering the main conversation. allowed-tools pre-approves Read and Grep while the skill runs. argument-hint shows the expected argument during autocomplete. It is not a schema validator, so argument validation must happen elsewhere.

- **A** falls short: context: main keeps the lengthy notes in the main conversation, which is what the team wants to avoid.
- **B** falls short: A loose .md file is not a skill. A skill needs its own directory with a SKILL.md .
- **D** falls short: Misdescribes both fields. argument-hint does not validate anything, and the video says allowed-tools is not a security boundary: use disallowed-tools or permission deny rules to remove tools.

## Try this
Copy a file in cases/ to a new CS id, change the customer's message and expected disposition, rerun with --case, then score it with evaluate.py.

## How the exam tests this
Look for three markers: a directory holding SKILL.md, context: fork for noisy output, and allowed-tools for prompt-free reads. Option A's context: main floods the session, B's loose .md file is not a skill, and D fails because argument-hint validates nothing and allowed-tools is not a security boundary.

The question is a third-party practice question (SkillCertPro, unofficial, reconstructed from a video). Evidence from your run is saved in `labs/simulators/simulator-1-customer-support/evidence/`.
