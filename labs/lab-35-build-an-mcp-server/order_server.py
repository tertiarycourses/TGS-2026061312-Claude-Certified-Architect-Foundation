# /// script
# requires-python = ">=3.10"
# dependencies = ["mcp>=2.3,<3"]
# ///
"""Lab 35: an MCP server for the support team's order system (stdio transport).
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
