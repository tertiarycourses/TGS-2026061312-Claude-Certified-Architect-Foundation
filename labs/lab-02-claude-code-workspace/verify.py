#!/usr/bin/env python3
import json
from pathlib import Path
r=Path("workspace/.claude/rules/python.md").read_text(); s=Path("workspace/.claude/skills/review/SKILL.md").read_text(); c=Path("workspace/CLAUDE.md").read_text()
m=json.loads(Path("workspace/.mcp.json").read_text())
assert "paths:" in r and "src/**/*.py" in r
assert "Verification:" in s and "Inputs:" in s
assert "plan mode" in c and m["mcpServers"]["ticketing"]["env"]["TICKETING_TOKEN"]=="${TICKETING_TOKEN}"
print("PASS: scoped instructions, reusable skill, plan gate and secret-safe MCP config verified")
