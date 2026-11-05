# Orderly web app

Monorepo for the Orderly storefront: React front end, Node API, Postgres models.

## Universal standards (always loaded)
- Run `npm test -- --changed` before you report a change as done.
- Never commit secrets. Tokens come from environment variables only.
- Prefer small, reviewable diffs. Explain any public-interface change in the PR body.

@docs/standards/testing.md
@docs/standards/review-criteria.md

## Where the rest lives
- Area-specific conventions: `.claude/rules/` (loaded only when you edit matching paths).
- Team slash commands: `.claude/commands/`.
- Reusable skills: `.claude/skills/`.
- Shared MCP servers: `.mcp.json` (tokens expand from the environment).
