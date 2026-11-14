# Project rules for any AI coding assistant

- Claude model: claude-haiku-5-5 through the official anthropic Python SDK, max_tokens 4096.
- All data comes from backend.json. Never invent customers or orders.
- Run Python with `uv run`.
- Never open, print or ask for .env or the API key.
- MCP: the official MCP Python SDK v2 (mcp>=2.3,<3). The server class is MCPServer from mcp.server.mcpserver
  (FastMCP was renamed in v2: never import mcp.server.fastmcp). ToolError is in mcp.server.mcpserver.exceptions.
  The client uses ClientSession and StdioServerParameters from mcp, and stdio_client from mcp.client.stdio;
  in v2, session.list_tools() takes no arguments.
- The MCP server talks JSON-RPC over stdout, so it must never print().
