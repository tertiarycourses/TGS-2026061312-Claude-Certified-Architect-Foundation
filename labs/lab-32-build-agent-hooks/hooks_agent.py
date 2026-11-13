# /// script
# requires-python = ">=3.10"
# dependencies = ["claude-agent-sdk>=0.2", "python-dotenv>=1.0"]
# ///
"""Lab 32: build PreToolUse and PostToolUse hooks with the Claude Agent SDK (Python).
  PreToolUse  runs BEFORE a tool: it can block the call. Here: refunds above $500 are denied, so Claude escalates.
  PostToolUse runs AFTER a tool: it can rewrite the result. Here: raw backend data is normalised before Claude reads it.
Run:  uv run hooks_agent.py              (ORD-5501, $120: allowed, dates normalised)
      uv run hooks_agent.py ORD-5502     ($780: the PreToolUse hook blocks the refund)"""
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from dotenv import find_dotenv, load_dotenv
from claude_agent_sdk import (AssistantMessage, ClaudeAgentOptions, ClaudeSDKClient, HookMatcher, ResultMessage,
                              TextBlock, ToolUseBlock, create_sdk_mcp_server, tool)

load_dotenv(find_dotenv(usecwd=True))
os.environ.pop("CLAUDECODE", None)
MODEL = "claude-haiku-5-5"
LIMIT = 500
STATUS = {1: "pending", 2: "shipped", 3: "delivered"}
ORDERS = {  # raw backend data: a Unix timestamp and a status code in one order, ISO and text in the other
    "ORD-5501": {"order_id": "ORD-5501", "item": "Ceramic table lamp", "amount": 120.0, "placed_at": 1790812800, "status": 3, "damage_photo": True},
    "ORD-5502": {"order_id": "ORD-5502", "item": "Standing desk", "amount": 780.0, "placed_at": "2026-10-20T10:00:00Z", "status": "delivered", "damage_photo": True},
}
LOG = []


def reply(data):
    return {"content": [{"type": "text", "text": json.dumps(data)}]}


@tool("lookup_order", "Look up one order by ID (ORD-NNNN): item, amount, placed_at, status, damage_photo.", {"order_id": str})
async def lookup_order(args):
    return reply(ORDERS.get(args["order_id"].upper(), {"error": "not found"}))


@tool("process_refund", "Refund an order to the original payment method. Input: order_id, amount.", {"order_id": str, "amount": float})
async def process_refund(args):
    return reply({"refund_id": "RF-20481", "order_id": args["order_id"], "amount": args["amount"], "status": "issued"})


@tool("escalate_to_human", "Hand the case to a human approver with a reason and the amount.", {"reason": str, "amount": float})
async def escalate_to_human(args):
    return reply({"ticket_id": "HS-0007", "status": "queued", **args})


async def pre_tool(input_data, tool_use_id, context):                          # KEY 1: runs BEFORE the tool
    name, args = input_data["tool_name"].split("__")[-1], input_data["tool_input"]
    if name == "process_refund" and float(args.get("amount", 0)) > LIMIT:      # KEY 2: a rule in code, not in the prompt
        reason = f"Refunds above ${LIMIT} need human approval. Call escalate_to_human instead."
        LOG.append(f"PreToolUse  DENY  {name}({args})  -> {reason}")
        return {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                       "permissionDecision": "deny", "permissionDecisionReason": reason}}
    LOG.append(f"PreToolUse  allow {name}({args})")
    return {}


async def post_tool(input_data, tool_use_id, context):                         # KEY 3: runs AFTER the tool
    name = input_data["tool_name"].split("__")[-1]
    resp = input_data.get("tool_response")
    content = resp.get("content", resp) if isinstance(resp, dict) else resp      # MCP tools: a list of content blocks
    text = content[0].get("text") if isinstance(content, list) and content and isinstance(content[0], dict) else None
    raw = json.loads(text) if text else None
    if name != "lookup_order" or not raw or "error" in raw:
        return {}
    clean = dict(raw)
    if isinstance(clean["placed_at"], (int, float)):                            # KEY 4: one format for every order
        clean["placed_at"] = datetime.fromtimestamp(clean["placed_at"], timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    clean["status"] = STATUS.get(clean["status"], clean["status"])
    LOG.append(f"PostToolUse normalise {name}: placed_at {raw['placed_at']!r} -> {clean['placed_at']!r}, status {raw['status']!r} -> {clean['status']!r}")
    return {"hookSpecificOutput": {"hookEventName": "PostToolUse",
                                   "updatedToolOutput": {"content": [{"type": "text", "text": json.dumps(clean)}]}}}


async def main(order_id):
    server = create_sdk_mcp_server(name="shop", version="1.0.0", tools=[lookup_order, process_refund, escalate_to_human])
    options = ClaudeAgentOptions(
        model=MODEL,
        system_prompt="You are a refund agent. Look up the order, then refund damaged items with a photo in full.",
        mcp_servers={"shop": server}, tools=[],
        allowed_tools=["mcp__shop__lookup_order", "mcp__shop__process_refund", "mcp__shop__escalate_to_human"],
        hooks={"PreToolUse": [HookMatcher(matcher="^mcp__shop__", hooks=[pre_tool])],     # KEY 5: register the hooks
               "PostToolUse": [HookMatcher(matcher="^mcp__shop__", hooks=[post_tool])]},
        permission_mode="bypassPermissions", max_turns=8, setting_sources=[],
        env={"ENABLE_CLAUDEAI_MCP_SERVERS": "false", "ENABLE_TOOL_SEARCH": "false"}, extra_args={"strict-mcp-config": None},
    )
    async with ClaudeSDKClient(options=options) as client:
        await client.query(f"Order {order_id} arrived damaged; the photo is attached. Please refund it.")
        async for m in client.receive_response():
            if isinstance(m, AssistantMessage):
                for b in m.content:
                    if isinstance(b, ToolUseBlock):
                        print(f"Claude -> {b.name.split('__')[-1]}({b.input})")
                    elif isinstance(b, TextBlock) and b.text.strip():
                        print(f"Claude: {b.text.strip()}")
            elif isinstance(m, ResultMessage):
                print(f"\n{m.num_turns} turns, cost ${m.total_cost_usd or 0:.4f}, stop: {m.subtype}")
    print("\n== Hook log")
    for line in LOG:
        print(line)


asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "ORD-5501"))
