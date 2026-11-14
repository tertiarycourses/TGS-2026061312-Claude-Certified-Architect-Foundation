"""Orderly's four support tools as an MCP server (stdio). Any MCP client can use them: agent.py, Claude Code, Codex, Antigravity.
Started by a client, not by hand: it talks JSON-RPC over stdin/stdout."""
import json
import logging

from mcp.server.mcpserver import MCPServer                 # MCP SDK v2 (FastMCP was renamed MCPServer)
from mcp.server.mcpserver.exceptions import ToolError

import tools

logging.disable(logging.INFO)                               # stdout belongs to JSON-RPC: never print() here
mcp = MCPServer("orderly-support")


def call(fn, **args):
    try:
        return fn(**args)
    except tools.ToolFailure as e:                          # the same structured error, now as an MCP tool error
        raise ToolError(json.dumps(e.info))


@mcp.tool()
def get_customer(email: str) -> dict:
    """Verify a customer by email. Returns customer_id, name, email and tier. Call this before any order tool."""
    return call(tools.get_customer, email=email)


@mcp.tool()
def lookup_order(order_id: str, customer_id: str) -> dict:
    """Fetch one order (format ORD-####) for a verified customer_id: item, amount, placed_at, status, damage_photo, eta."""
    return call(tools.lookup_order, order_id=order_id, customer_id=customer_id)


@mcp.tool()
def process_refund(order_id: str, amount: float, reason: str) -> dict:
    """Issue a cash refund to the original payment method for one order."""
    return call(tools.process_refund, order_id=order_id, amount=amount, reason=reason)


@mcp.tool()
def escalate_to_human(customer_id: str, root_cause: str, recommended_action: str, refund_amount: float, order_ids: list[str]) -> dict:
    """Hand the case to a human agent, who cannot see this conversation: give a complete handoff."""
    return call(tools.escalate_to_human, customer_id=customer_id, root_cause=root_cause,
                recommended_action=recommended_action, refund_amount=refund_amount, order_ids=order_ids)


if __name__ == "__main__":
    mcp.run()                                               # stdio transport by default
