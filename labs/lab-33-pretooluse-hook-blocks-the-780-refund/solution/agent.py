"""Orderly's customer resolution agent: claude-haiku-5-5 + the support MCP server over stdio.
Run:  uv run agent.py "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please." """
import asyncio
import json
import sys

import anthropic
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from hooks import pre_tool_use

load_dotenv()
MODEL = "claude-haiku-5-5"
MAX_TURNS = 10
SERVER = StdioServerParameters(command=sys.executable, args=["support_server.py"])   # the client starts the server
SYSTEM = """You are the support resolution agent for Orderly, an online furniture store.
1. Verify the customer with get_customer (by email) before any order tool.
2. Use lookup_order for anything about an order; pass the verified customer_id.
3. Damaged item with photo evidence (damage_photo true): refund the order amount with process_refund.
4. Escalate with escalate_to_human when the customer asks for a person, when policy does not cover the request,
   or when a tool tells you to. The human cannot see this chat: give customer_id, root_cause, recommended_action,
   refund_amount (0 if none) and order_ids.
5. Never say a refund happened unless process_refund returned status issued.
Reply to the customer in under 120 words."""


async def run_agent(message: str) -> dict:
    client = anthropic.Anthropic()
    calls = []
    async with stdio_client(SERVER) as (read, write), ClientSession(read, write) as session:
        await session.initialize()
        listed = await session.list_tools()                         # discover the tools: no hard-coded list any more
        tools = [{"name": t.name, "description": t.description, "input_schema": t.input_schema} for t in listed.tools]
        print("MCP tools:", ", ".join(t["name"] for t in tools))
        messages = [{"role": "user", "content": message}]
        for turn in range(1, MAX_TURNS + 1):
            response = client.messages.create(model=MODEL, max_tokens=4096, system=SYSTEM, tools=tools, messages=messages)
            print(f"\nTurn {turn}: stop_reason={response.stop_reason}")
            messages.append({"role": "assistant", "content": response.content})
            if response.stop_reason != "tool_use":
                return {"text": "".join(b.text for b in response.content if b.type == "text"), "calls": calls}
            results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                pre = pre_tool_use(block.name, block.input)               # PreToolUse: may stop the call
                if pre["decision"] == "deny":
                    print(f"  PreToolUse DENY {block.name}({block.input}): {pre['reason']}")
                    calls.append({"tool": block.name, "input": block.input, "result": pre["reason"], "is_error": True, "denied": True})
                    results.append({"type": "tool_result", "tool_use_id": block.id, "content": pre["reason"], "is_error": True})
                    continue                                              # the tool never runs
                out = await session.call_tool(block.name, block.input)    # Claude asks, the MCP server runs it
                text = "".join(c.text for c in out.content if c.type == "text")
                result = text if out.is_error else json.loads(text)
                shown = text if out.is_error else json.dumps(result)
                print(f"  {block.name}({block.input}) -> {'ERROR ' if out.is_error else ''}{shown[:150]}")
                calls.append({"tool": block.name, "input": block.input, "result": result, "is_error": out.is_error})
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": text, "is_error": out.is_error})
            messages.append({"role": "user", "content": results})
    return {"text": "(stopped: 10-turn limit)", "calls": calls}


if __name__ == "__main__":
    out = asyncio.run(run_agent(sys.argv[1] if len(sys.argv) > 1 else "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please."))
    print("\n=== Reply to the customer ===\n" + out["text"])
