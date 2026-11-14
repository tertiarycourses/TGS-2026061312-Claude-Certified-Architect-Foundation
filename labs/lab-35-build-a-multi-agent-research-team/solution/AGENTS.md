# Project rules for any AI coding assistant

- Claude model: claude-haiku-5-5 through the official anthropic Python SDK, max_tokens 8000.
- All research data comes from sources.json, a fictional sandbox. Never invent a source, URL or number.
- A subagent sees only its task text. Never pass one agent's message history to another agent.
- Run Python with `uv run`.
- Never open, print or ask for .env or the API key.
