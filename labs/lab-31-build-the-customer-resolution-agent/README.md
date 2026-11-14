# Lab 31: Vibe-code the customer resolution agent with the Python SDK

> Day 2 · Bonus Topic A · Lab 31 of 4 (one agent, built in four steps) · Scenario 1: Customer Support Resolution Agent · Task statements 1.1, 2.1 · Vibe-coding lab · Claude Haiku 5.5 · 45 minutes

**You don't write the code. You write the prompts, read what comes back, and run it. In 45 minutes you have a working support agent that verifies Mei Lin, checks her order and refunds her cracked $120 lamp. Then you watch it make two mistakes that Labs 33 and 34 will fix.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab. Copy the prompts from [this lab's prompt page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-31.html) (one Copy button per prompt), or from `prompts.html` in this folder.

## Bonus Topic A: one agent, four labs

| Lab | You add | Exam tasks |
|---|---|---|
| **31 (this lab)** | the agentic loop and four tools, with the Anthropic Python SDK | 1.1, 2.1 |
| 32 | an MCP server for the tools; the agent becomes an MCP client | 2.4, 2.2 |
| 33 | a PreToolUse hook that blocks refunds above $500 | 1.5, 1.4 |
| 34 | a PostToolUse hook that cleans raw data, and live tests | 1.5 |

Bonus Topic B, Lab 35, builds a multi-agent research team in a project folder of its own.

You build all four labs in **one project folder**. Each lab starts where the last one ended. If you fall behind, each lab starts with a catch-up prompt that downloads the previous lab's finished code.

## What you'll build

```
  customer message
        |
        v
  agent.py -- the agentic loop (claude-haiku-5-5, Anthropic Python SDK)
        |     while stop_reason == "tool_use": run the tools, send the results back
        |
        +-- tools.py: get_customer, lookup_order, process_refund, escalate_to_human
                      (reads backend.json: Orderly's customers and orders)
```

On Day 1 you watched this loop in Lab 1 and saw why tool descriptions matter in Lab 8. Today you build it.

## What's in this folder

| File | What it is |
|---|---|
| `starter/backend.json` | Orderly's customers and orders (Scenario 1). Prompt 1 downloads it into your project. |
| `starter/.env.example` | the one line your `.env` needs |
| `prompts.html` | every prompt below, each with a Copy button |
| `solution/` | our build at the end of this lab, made from these prompts. Peek only when you're stuck. |
| `sample-output.txt` | a live run of `solution/agent.py` on the three customers |

## Before you start (5 minutes)

- **1. Open your AI coding tool in a new, empty folder** called `orderly-agent` (Labs 31 to 34 all happen in this one folder). In VS Code, Cursor, Windsurf or Antigravity: **File → Open Folder → New Folder**. Claude Code or Codex in a terminal: start it from that folder. Any agent that can create files and run terminal commands works; the prompts use no tool-specific feature.
- **2. Have your Anthropic API key ready.** It starts with `sk-ant-`. You'll paste it into a file in Step 1, never into the chat.

That's all. **Prompt 1 does the rest of the set-up:** it installs uv (the Python tool) if your computer doesn't have it, downloads the lab's data file and creates the project.

Every Claude call your agent makes uses `claude-haiku-5-5` and your key: a run costs a fraction of a US cent. Your coding tool's own model is separate.

## How to vibe-code

- Paste **one prompt at a time**, in order. Don't move on until your output matches the **Checkpoint**.
- **Read the code the AI writes.** At the end your trainer asks you to explain it.
- When something is wrong, **paste the error back** and say what you expected, naming the file and the behaviour.
- If your tool can't run commands, run them yourself in a terminal and paste the output back.

**Tested on 14 Nov 2026.** We pasted these exact prompts, all ten across Labs 31 to 34 in one conversation, into Claude Code 2.1.325 and Codex 0.167.0, four runs each. All 8 builds passed `test_agent.py` 9/9 on a fresh re-run (7 to 9 minutes of tool time per run). When Prompt 1 took over the set-up (it installs uv if needed and downloads `backend.json`), we ran the whole series again with no data file provided: 8 of 8 builds passed 9/9 again. Not a benchmark: your tool, model and wording will differ. Antigravity has no headless mode, so we couldn't machine-test it; the prompts use no tool-specific features.

## Step 1 · Set up the project (5 minutes)

### Prompt 1

```text
Set up this folder as a new Python project for a customer support agent. Do each step, then tell me what you did.

1. Check uv with `uv --version`. If uv is missing, install it with its official installer:
   macOS or Linux: curl -LsSf https://astral.sh/uv/install.sh | sh
   Windows (PowerShell): powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   If uv is still not found after installing, use its full path (~/.local/bin/uv, or %USERPROFILE%\.local\bin\uv.exe
   on Windows) for the rest of this chat.
2. If backend.json is not in this folder, download it into this folder from
   https://raw.githubusercontent.com/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/master/labs/lab-31-build-the-customer-resolution-agent/starter/backend.json
3. Run `uv init --bare`, then `uv add anthropic python-dotenv`. (uv installs Python itself if it needs to.)
4. Create .gitignore with: .env, .venv/, __pycache__/, audit.log
5. Create .env.example with one line: ANTHROPIC_API_KEY=paste-your-key-here
   If .env does not exist yet, create it with that same line. After that, never open, print or ask me for .env or my key.
6. Create AGENTS.md with these project rules for any AI coding assistant:
   - Claude model: claude-haiku-5-5 through the official anthropic Python SDK, max_tokens 4096.
   - All data comes from backend.json. Never invent customers or orders.
   - Run Python with `uv run`.
   - Never open, print or ask for .env or the API key.
7. Create CLAUDE.md containing the single line @AGENTS.md so Claude Code reads the same rules.

Then show me the file tree, and tell me to open .env in the editor and replace paste-your-key-here with my API key.
```

**Checkpoint.** You see `pyproject.toml`, `uv.lock`, `.gitignore`, `.env.example`, `AGENTS.md`, `CLAUDE.md` and `backend.json`.

**Now the one thing you type yourself:** open `.env` in your editor, replace `paste-your-key-here` with your API key and save. Never paste the key into the AI chat: anything you type there is sent to the coding tool's servers. If Prompt 1 installed uv, restart your coding tool's terminal before you run commands yourself.

> Why AGENTS.md? It is the shared rules file that Codex, Antigravity, Cursor and most other coding agents read. Claude Code reads CLAUDE.md, and `@AGENTS.md` imports the same rules. Write a rule once and every tool follows it (Day 1, Lab 13).

## Step 2 · Write the four tools (15 minutes)

### Prompt 2

```text
Read AGENTS.md and backend.json. Create tools.py with Orderly's four support tools. Each one reads backend.json.

1. get_customer(email): verify a customer by email. Return customer_id, name, email and tier.
2. lookup_order(order_id, customer_id): return the order exactly as stored in backend.json. Do not clean or convert
   the data. Fail if the order does not belong to that customer.
3. process_refund(order_id, amount, reason): return refund_id, order_id, amount and status "issued".
   Fail if amount <= 0 or more than the order amount. Do NOT add any refund limit.
4. escalate_to_human(customer_id, root_cause, recommended_action, refund_amount, order_ids): return a ticket_id,
   status "queued" and the handoff fields.

- Give every function a clear one-line docstring that says what it does and when to use it.
- On failure, raise a ToolFailure exception that carries errorCategory (not_found, permission or validation),
  isRetryable (false) and message.
- Add TOOLS: the Anthropic tool definitions for all four (name, description from the docstring, input_schema with
  types and required fields).
- Add run_tool(name, args) that calls the right function and returns (result, is_error). On ToolFailure it returns
  the error fields as the result and is_error True.

Then run a quick check with uv: call run_tool for get_customer with meilin@example.com, and for lookup_order with
ORD-5502 and C-1001. Show me both results.
```

**Checkpoint.** `get_customer` returns `C-1001` (Mei Lin Tan). The ORD-5502 lookup returns `is_error True` with `errorCategory: permission`: that order belongs to Arjun, not Mei Lin. You get a structured error, not a crash (Day 1, Lab 9).

## Step 3 · Write the agentic loop (15 minutes)

### Prompt 3

```text
Build agent.py, the customer resolution agent. Follow AGENTS.md.

- Load ANTHROPIC_API_KEY from .env with python-dotenv. Use TOOLS and run_tool from tools.py.
- Write the agentic loop yourself with client.messages.create (model claude-haiku-5-5, max_tokens 4096):
  append the whole response.content as the assistant turn; while stop_reason is "tool_use", run every tool_use block
  with run_tool and send ALL the tool_result blocks back in ONE user message (is_error true when the tool failed).
  Stop when stop_reason is anything else, or after 10 turns.
- Use this system prompt exactly:
  "You are the support resolution agent for Orderly, an online furniture store.
  1. Verify the customer with get_customer (by email) before any order tool.
  2. Use lookup_order for anything about an order; pass the verified customer_id.
  3. Damaged item with photo evidence (damage_photo true): refund the order amount with process_refund.
  4. Escalate with escalate_to_human when the customer asks for a person, when policy does not cover the request,
     or when a tool tells you to. The human cannot see this chat: give customer_id, root_cause, recommended_action,
     refund_amount (0 if none) and order_ids.
  5. Never say a refund happened unless process_refund returned status issued.
  Reply to the customer in under 120 words."
- Print each turn's number and stop_reason, each tool call with its input and result, then the final reply.
- Put the loop in a function run_agent(message) that returns {"text": the reply, "calls": a list of every tool call
  with tool, input, result and is_error}. agent.py takes the customer message as its first argument.

Run: uv run agent.py "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please."
```

**Checkpoint.** About four turns: `get_customer` → `lookup_order` → `process_refund` for **$120** → `stop_reason=end_turn`, then a short reply with a refund ID. The loop, not you, decided each step: `stop_reason` drove it (Day 1, Lab 1).

## Step 4 · Two more customers (10 minutes, no code change)

### Prompt 4

```text
Do not change any code. Run these two and show me the output of each:
uv run agent.py "This is arjun@example.com. The standing desk in ORD-5502 arrived with a bent frame, photos attached. Refund the full amount."
uv run agent.py "meilin@example.com here. Where is my monitor arm, order ORD-5504?"
Then tell me, in two sentences, what went wrong in each run.
```

**Checkpoint.** Two problems, both on purpose:

- **Arjun gets $780 back with no human approval.** Orderly's rule is that a human approves any refund above $500, but that rule is written nowhere, so nothing stops it. **Lab 33** puts it in a PreToolUse hook.
- **Mei Lin gets a vague answer.** `lookup_order` returned `"status": 2` and `"placed_at": 1793318400`, and Claude has to guess what they mean (ours said it "can't translate it into a clear shipping update"). **Lab 34** cleans the data in a PostToolUse hook before Claude reads it.

## Run it

From your project folder. Run them yourself in a terminal, or paste one into your coding tool's chat as "Run: <command> and show me the output."

| What | Command |
|---|---|
| Run the agent on any message | `uv run agent.py "your customer message"` |
| Mei Lin's $120 lamp | `uv run agent.py "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please."` |
| Arjun's $780 desk | `uv run agent.py "This is arjun@example.com. The standing desk in ORD-5502 arrived with a bent frame, photos attached. Refund the full amount."` |
| Mei Lin's monitor arm | `uv run agent.py "meilin@example.com here. Where is my monitor arm, order ORD-5504?"` |

To run our reference build instead, open your coding tool in an empty folder and paste this prompt, then put your key in `.env` and run the same commands:

```text
Replace the code in this folder with the reference solution of Lab 31. Keep my .env and never open it.
1. Get the file list from
   https://api.github.com/repos/tertiarycourses/TGS-2026061312-Claude-Certified-Architect-Foundation/contents/labs/lab-31-build-the-customer-resolution-agent/solution
   and download every file in it (each file's download_url) into this folder, replacing older copies.
2. If .env does not exist, create it with the line ANTHROPIC_API_KEY=paste-your-key-here.
3. Run `uv sync`. If uv is missing, install it first with its official installer (https://docs.astral.sh/uv/).
Then show me the file tree.
```


## Explain it back (with your trainer)

- **1.** Which line in `agent.py` decides whether the loop goes round again? What else stops it?
- **2.** Why does every `tool_result` go back in one user message, and why must a failed tool still send one?
- **3.** Claude called `get_customer` first. Did the system prompt make it do that, or the tool description? Delete one, run it again and see.

## Troubleshooting

| You see | Fix prompt |
|---|---|
| `authentication_error` / 401 | Check `.env` yourself: one line, no quotes, no spaces. Don't paste the key into the chat. |
| `stop_reason=max_tokens` or an empty reply | "Set max_tokens to 4096 (Haiku 5.5 thinks before it answers)." |
| `tool_use ids were found without tool_result blocks` | "Send every tool_result in one user message right after the assistant turn." |
| The loop never stops | "Stop when stop_reason is not tool_use, and after 10 turns at most." |
| Claude invents an order | "Tools must read backend.json only. Check AGENTS.md." |
