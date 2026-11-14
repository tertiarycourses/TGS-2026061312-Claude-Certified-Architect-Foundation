#!/usr/bin/env bash
# Lab 39, step 3: the SAME MCP server, used by Claude Code instead of your own client.
# .mcp.json registers the server; the token comes from your environment, never from the file.
set -e
cd "$(dirname "$0")"
. ../load_env.sh                                  # exports ANTHROPIC_API_KEY from labs/.env
export ORDERS_API_TOKEN="${ORDERS_API_TOKEN:-demo-token}"

claude -p "Look up order ORD-5501, then read the refund policy resource and say whether a 120 refund is allowed. Do not issue it." \
  --model claude-haiku-5-5 \
  --mcp-config .mcp.json --strict-mcp-config \
  --allowedTools "mcp__orders__lookup_order" "ListMcpResourcesTool" "ReadMcpResourceTool" \
  --max-turns 6 < /dev/null
