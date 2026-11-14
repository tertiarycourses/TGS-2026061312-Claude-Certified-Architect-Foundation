"""Start support_server.py over stdio as an MCP client, list its tools and call two of them. Run: uv run check_server.py"""
import asyncio
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SERVER = StdioServerParameters(command=sys.executable, args=["support_server.py"])


async def main():
    async with stdio_client(SERVER) as (read, write), ClientSession(read, write) as session:
        await session.initialize()
        listed = await session.list_tools()
        print("MCP tools:", ", ".join(t.name for t in listed.tools))
        for name, args in [("get_customer", {"email": "meilin@example.com"}),
                           ("lookup_order", {"order_id": "ORD-5501", "customer_id": "C-1001"}),
                           ("lookup_order", {"order_id": "ORD-5502", "customer_id": "C-1001"})]:
            out = await session.call_tool(name, args)
            text = " ".join("".join(c.text for c in out.content if c.type == "text").split())
            print(f"{name}({args}) -> {'ERROR ' if out.is_error else ''}{text}")


asyncio.run(main())
