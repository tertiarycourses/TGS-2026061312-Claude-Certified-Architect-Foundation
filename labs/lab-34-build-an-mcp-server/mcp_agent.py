# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0", "mcp>=2.3,<3"]
# ///
"""Lab 34: your own MCP client. Start the server, list its tools, hand them to Claude, run the loop.
Run:  uv run mcp_agent.py
      uv run mcp_agent.py "Please refund my wool rug, order ORD-5508, 480 dollars." """
import asyncio
import os
import sys
import anthropic
from dotenv import find_dotenv, load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"
SERVER = StdioServerParameters(command="uv", args=["run", "-q", "order_server.py"],     # KEY 1: how to start the server
                               env={**os.environ, "ORDERS_API_TOKEN": os.environ.get("ORDERS_API_TOKEN", "demo-token")})


async def main(question):
    async with stdio_client(SERVER) as (read, write), ClientSession(read, write) as session:
        await session.initialize()
        listed = await session.list_tools()                                          # KEY 2: discover, don't hard-code
        tools = [{"name": t.name, "description": t.description, "input_schema": t.input_schema} for t in listed.tools]
        print("MCP tools:", [t["name"] for t in tools])

        messages = [{"role": "user", "content": question}]
        for turn in range(1, 9):
            r = client.messages.create(model=MODEL, max_tokens=2048, tools=tools, messages=messages,
                                       system="You are a support agent. Only tell the customer a refund happened if the tool says so.")
            print(f"Turn {turn}: stop_reason={r.stop_reason}")
            messages.append({"role": "assistant", "content": r.content})
            if r.stop_reason != "tool_use":
                print("\n" + "".join(b.text for b in r.content if b.type == "text"))
                return
            results = []
            for b in r.content:
                if b.type == "tool_use":
                    out = await session.call_tool(b.name, b.input)                    # KEY 3: Claude asks, MCP runs it
                    text = "".join(c.text for c in out.content if c.type == "text")
                    shown = " ".join(text.split())[:150]
                    print(f"   {b.name}({b.input}) -> {'ERROR ' if out.is_error else ''}{shown}")
                    results.append({"type": "tool_result", "tool_use_id": b.id, "content": text,
                                    "is_error": out.is_error})                         # KEY 4: pass the error flag through
            messages.append({"role": "user", "content": results})


asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "My lamp in ORD-5501 came cracked. Please refund the 120 dollars."))
