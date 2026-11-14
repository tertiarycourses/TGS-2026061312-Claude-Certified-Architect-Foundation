# Lab 32: Vibe-code an MCP server for the agent's tools

> Day 2 · Bonus Topic A · Lab 32 of 4 (one agent, built in four steps) · Scenario 1: Customer Support Resolution Agent · Task statements 2.4, 2.2 · Vibe-coding lab · Claude Haiku 5.5 · 30 minutes

**Your four tools are stuck inside one Python program. Put them behind an MCP server and any agent can use them: your own, Claude Code, Codex or Antigravity. The agent's behaviour stays exactly the same: only where the tools live changes.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab. Copy the prompts from [this lab's prompt page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/lab-32.html), or from `prompts.html` in this folder.

## Bonus Topic A: one agent, four labs

| Lab | You add | Exam tasks |
|---|---|---|
| 31 | the agentic loop and four tools, with the Anthropic Python SDK | 1.1, 2.1 |
| **32 (this lab)** | an MCP server for the tools; the agent becomes an MCP client | 2.4, 2.2 |
| 33 | a PreToolUse hook that blocks refunds above $500 | 1.5, 1.4 |
| 34 | a PostToolUse hook that cleans raw data, and live tests | 1.5 |

Bonus Topic B, Lab 35, builds a multi-agent research team in a project folder of its own.

## What you'll build

```
  agent.py -- the agentic loop (unchanged), now an MCP client
        |
        +-- MCP client == stdio ==> support_server.py (MCP server "orderly-support")
                                      4 tools: get_customer, lookup_order,
                                      process_refund, escalate_to_human
                                      (each wraps the same function in tools.py)
```

The agent no longer imports the tools. It starts the server, asks it which tools exist (`list_tools`) and hands that list to Claude. A new tool on the server shows up in the agent with no change to `agent.py`.

## What's in this folder

| File | What it is |
|---|---|
| `prompts.html` | every prompt below, each with a Copy button |
| `solution/` | our build at the end of this lab. Copy it in if you didn't finish Lab 31. |
| `sample-output.txt` | a live run of `check_server.py` and `agent.py` from `solution/` |

## Before you start

Keep working in your project folder from Lab 31. You need `tools.py` and `agent.py` working, and Mei Lin's $120 lamp refund passing. Didn't finish? Copy everything from Lab 31's `solution/` folder into an empty folder, add your `.env`, and start here.

## Step 1 · Wrap the tools in an MCP server (15 minutes)

### Prompt 1

```text
Add an MCP server for the four tools in tools.py. Follow AGENTS.md.

1. Run `uv add "mcp>=2.3,<3"`.
2. Add these rules to AGENTS.md:
   - MCP: the official MCP Python SDK v2 (mcp>=2.3,<3). The server class is MCPServer from mcp.server.mcpserver
     (FastMCP was renamed in v2: never import mcp.server.fastmcp). ToolError is in mcp.server.mcpserver.exceptions.
     The client uses ClientSession and StdioServerParameters from mcp, and stdio_client from mcp.client.stdio;
     in v2, session.list_tools() takes no arguments.
   - The MCP server talks JSON-RPC over stdout, so it must never print().
3. Create support_server.py: an MCP server named "orderly-support" using the stdio transport. Expose the four tools
   with the same names, typed parameters and docstrings. Each one calls the matching function in tools.py:
   keep the logic in tools.py, don't copy it. When tools.py raises ToolFailure, raise ToolError with the error
   fields as a JSON string.
4. Create check_server.py: an MCP client that starts support_server.py over stdio (command = sys.executable),
   lists the tools, then calls get_customer with meilin@example.com, lookup_order with ORD-5501 and C-1001,
   and lookup_order with ORD-5502 and C-1001. Print each result on one line.

Run `uv run check_server.py` and show me the output.
```

**Checkpoint.**

- `MCP tools: get_customer, lookup_order, process_refund, escalate_to_human`.
- `get_customer` returns `C-1001`. `lookup_order ORD-5501` returns the raw order (`"status": 3`).
- `ORD-5502` with `C-1001` comes back as an error carrying `"errorCategory": "permission"`, not a crash (Day 1, Lab 9).

> If you see `No module named 'mcp.server.fastmcp'`, your AI wrote MCP v1 code. Reply: "Use MCPServer from mcp.server.mcpserver (MCP SDK v2). Check AGENTS.md."

## Step 2 · Make the agent an MCP client (15 minutes)

### Prompt 2

```text
Change agent.py so it gets its tools from the MCP server instead of importing tools.py. Follow AGENTS.md.

- Make run_agent(message) async. It starts support_server.py over stdio (StdioServerParameters, command = sys.executable),
  initialises a ClientSession, calls list_tools, and turns each tool into an Anthropic tool definition
  {name, description, input_schema}. Print "MCP tools:" and their names.
- In the loop, run every tool_use block with session.call_tool. Join the text content of the result; pass the
  result's is_error flag through to the tool_result. Parse successful results from JSON for the calls list.
- agent.py must not import tools.py any more. Keep the system prompt, the 10-turn cap, the printing and the return
  value {"text", "calls"} exactly as they are. Run it with asyncio.run when started from the command line.

Run: uv run agent.py "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please."
```

**Checkpoint.** The first line is `MCP tools: get_customer, lookup_order, process_refund, escalate_to_human`. The rest matches Lab 31: `get_customer` → `lookup_order` → `process_refund` **$120** → `end_turn`. Same behaviour, new plumbing.

## Run it

From your project folder:

| What | Command |
|---|---|
| Check the server on its own | `uv run check_server.py` |
| Run the agent (it starts the server for you) | `uv run agent.py "your customer message"` |
| Mei Lin's $120 lamp | `uv run agent.py "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please."` |

You never start `support_server.py` by hand: the client starts it and talks to it over stdin and stdout. Run on its own, it just sits waiting for JSON-RPC (press Ctrl+C).

To run our reference build, go into `solution/`, copy `.env.example` to `.env`, add your key, then run the same commands.

## Stretch · Plug the same server into your coding tool (Day 1, Lab 11)

Same server, no code change. In your project folder, run the command for your tool:

- Claude Code: `claude mcp add orderly -- uv run --directory "$PWD" support_server.py`
- Codex: `codex mcp add orderly -- uv run --directory "$PWD" support_server.py`
- Antigravity, Cursor and other IDEs: open the tool's MCP settings and add the server to its `mcpServers` JSON: `"orderly": {"command": "uv", "args": ["run", "--directory", "/full/path/to/orderly-agent", "support_server.py"]}`

Then ask your coding tool:

```text
Use the orderly MCP tools to verify meilin@example.com and tell me the status of order ORD-5504.
```

Your coding tool now calls the same four tools your agent uses. It reads the raw `"status": 2`: cleaning that up is Lab 34's job, and it will live in your agent, not in the server.

## Explain it back (with your trainer)

- **1.** What did `agent.py` lose, and what did it gain? Why is that worth it when a second team builds a second agent?
- **2.** Why must an MCP stdio server never `print()`?
- **3.** A tool fails. What does Claude receive, and how does `errorCategory` help it decide what to do next?

## Troubleshooting

| You see | Fix prompt |
|---|---|
| `No module named 'mcp.server.fastmcp'` | "Use MCPServer from mcp.server.mcpserver: this is MCP SDK v2. Check AGENTS.md." |
| `list_tools() got an unexpected keyword argument 'cursor'` | "This is MCP SDK v2: call session.list_tools() with no arguments." |
| The agent hangs on start-up or the JSON is garbled | "support_server.py must never print to stdout. Remove the print calls." |
| `ModuleNotFoundError: No module named 'mcp'` | "Run uv add "mcp>=2.3,<3" and start everything with uv run." |
| Tool errors arrive as a crash, not a tool_result | "Catch ToolFailure in support_server.py and raise ToolError with the JSON fields." |
