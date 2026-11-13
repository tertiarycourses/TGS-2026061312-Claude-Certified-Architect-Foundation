# Lab 34: Build an MCP server once, plug it into any agent

> Day 2 · Topic 2: Tool Design & MCP Integration · Task statement 2.4 · Code lab · Claude Haiku 5.5

**Write the order system's tools as an MCP server, then use it from your own Python agent AND from Claude Code without changing a line.**

## What you'll do

Build a stdio MCP server with two tools, one resource and structured errors; connect to it from a Python MCP client that drives Claude; then register it in .mcp.json for Claude Code.

## What's in this folder

| File | What it is |
|---|---|
| `order_server.py` | the MCP server: lookup_order, process_refund, policy://refunds |
| `mcp_agent.py` | your own MCP client: discovers the tools and runs the Claude loop |
| `.mcp.json` | project registration for Claude Code; the token comes from the environment |
| `run_claude_code.sh` | Claude Code using the same server |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-34-build-an-mcp-server`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts, Claude Code (`claude`) for the shell scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Read order_server.py: two tools, one resource, and the fail() helper that returns structured errors.

**Step 2.** Run your own agent. It starts the server, lists its tools and refunds the lamp.

```
uv run mcp_agent.py
```

**Step 3.** Ask for a refund that hits a timeout. Watch Claude retry once (isRetryable: true), then tell the truth.

```
uv run mcp_agent.py "Please refund my wool rug, order ORD-5508, 480 dollars."
```

**Step 4.** Use the same server from Claude Code. It reads the policy resource but is only allowed lookup_order.

```
./run_claude_code.sh
```

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `MCP tools: ['lookup_order', 'process_refund']`
- `process_refund(...) -> ERROR {"errorCategory": "transient", "isRetryable": true, ...}`
- `"I haven't been able to process your $480.00 refund... no refund has been issued."`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `order_server.py`, look for the `KEY` comments:

- **KEY 1.** MCPServer('orders') names the server. Claude Code shows its tools as `mcp__orders__<tool>`.
- **KEY 2.** Secrets come from the environment. .mcp.json is committed; the token never is.
- **KEY 3.** A structured error: category, isRetryable and a message the agent can act on.
- **KEY 4.** A resource is read-only context the client can load; a tool is an action.
- **KEY 5.** stdio transport: the client starts the server as a child process and talks over stdin/stdout.

In `mcp_agent.py`, look for the `KEY` comments:

- **KEY 1.** How to start the server, and the environment it gets.
- **KEY 2.** list_tools() discovers the tools at run time; nothing is hard-coded.
- **KEY 3.** Claude asks for a tool; the MCP session runs it on the server.
- **KEY 4.** Pass the server's error flag through as is_error, so Claude knows the call failed.

## The code: `order_server.py`

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["mcp>=2.3,<3"]
# ///
"""Lab 34: an MCP server for the support team's order system (stdio transport).
Any MCP client can use these tools: Claude Code, Claude Desktop, or your own agent (mcp_agent.py).
Run it through a client, not on its own: it talks JSON-RPC over stdin/stdout."""
import json
import logging
import os
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

logging.disable(logging.INFO)                            # keep the server quiet: the client prints what matters
mcp = MCPServer("orders")                                   # KEY 1: the server name clients see

ORDERS = {"ORD-5501": {"customer": "CUS-0042", "item": "Ceramic lamp", "amount": 120.0, "status": "delivered", "refunded": False},
          "ORD-5508": {"customer": "CUS-0042", "item": "Wool rug", "amount": 480.0, "status": "delivered", "refunded": False}}
TOKEN = os.environ.get("ORDERS_API_TOKEN", "")           # KEY 2: secrets come from the environment, never the code


def fail(category, message, retryable):
    """KEY 3: a structured error the agent can act on, not 'Operation failed'."""
    raise ToolError(json.dumps({"errorCategory": category, "isRetryable": retryable, "message": message}))


@mcp.tool()
def lookup_order(order_id: str) -> dict:
    """Look up one order by ID (format ORD-NNNN). Returns customer, item, amount, status and whether it was refunded."""
    if order_id not in ORDERS:
        fail("not_found", f"No order {order_id}. Ask the customer to check the ID.", retryable=False)
    return {"order_id": order_id, **ORDERS[order_id]}


@mcp.tool()
def process_refund(order_id: str, amount: float) -> dict:
    """Refund an order, in full or in part. Amounts above 500 need a human: the tool refuses them."""
    if not TOKEN:
        fail("auth", "ORDERS_API_TOKEN is not set for this server.", retryable=False)
    if amount > 500:
```

```python
        fail("business_rule", "Refunds above 500 need a human approver. Escalate.", retryable=False)
    if order_id == "ORD-5508":
        fail("transient", "Payments service timed out. Safe to retry once.", retryable=True)
    ORDERS[order_id]["refunded"] = True
    return {"order_id": order_id, "refunded": amount, "status": "refund issued"}


@mcp.resource("policy://refunds")                          # KEY 4: a resource is read-only context, not an action
def refund_policy() -> str:
    return "Refunds within 30 days of delivery. Above 500: human approval. Never promise a refund before it succeeds."


if __name__ == "__main__":
    mcp.run()                                              # KEY 5: stdio by default
```

## Try this

Change process_refund so the timeout has isRetryable: false and run the ORD-5508 request again. Claude should stop retrying at once.

## How this shows up in the exam

Task 2.4: shared servers go in the project's .mcp.json with ${ENV_VAR} for secrets; personal ones in ~/.claude.json. Task 2.2's structured errors travel through MCP as isError plus a readable payload.
