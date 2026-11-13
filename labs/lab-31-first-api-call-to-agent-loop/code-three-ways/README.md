# Topic 1 code: one Claude call, three ways

Every agent loop starts by reading `stop_reason`. Make the same call to **Claude Haiku 5.5** (`claude-haiku-5-5`) three ways and watch the same fields come back each time.

| Folder | How it calls Claude | Run it |
|---|---|---|
| `raw/` | `curl -X POST` to `https://api.anthropic.com/v1/messages` | `./haiku_call.sh` |
| `python_sdk/` | Anthropic Python SDK (`anthropic` 2.x) | `uv run haiku_call.py` |
| `typescript_sdk/` | Anthropic TypeScript SDK (`@anthropic-ai/sdk` 1.x) | `npm install` then `npm start` |

Each script prints the full response, then the fields your loop reads: `id`, `model`, `stop_reason`, `stop_sequence`, `stop_details`, `usage` and the type of every content block. It ends by saying what a loop does with that `stop_reason`.

## Sign in once with Anthropic OAuth (no API key)

1. Install the Anthropic CLI, `ant`:
   - Mac: `brew install anthropics/tap/ant`
   - Windows or Linux: `go install github.com/anthropics/anthropic-cli/v2/cmd/ant@latest`, or a zip from https://github.com/anthropics/anthropic-cli/releases
2. Sign in: `ant auth login`. Approve the page in your browser and pick your Console organization and workspace.
3. Check: `ant auth status` shows `(active) * Profile (user_oauth)`.

The sign-in is a Claude Console (API) account, billed to that organization. A claude.ai Pro or Max plan does not include API usage.

How each script uses the sign-in:

- **raw:** gets a short-lived token with `ant auth print-credentials --access-token` and sends it as `Authorization: Bearer <token>` with the header `anthropic-beta: oauth-2025-04-20`. An OAuth token never goes in `x-api-key`.
- **Python and TypeScript:** `Anthropic()` / `new Anthropic()` with no key. The SDK finds the `ant auth login` profile by itself.

If `ANTHROPIC_API_KEY` is set in your shell, it overrides the OAuth sign-in. Run `unset ANTHROPIC_API_KEY` (PowerShell: `Remove-Item Env:ANTHROPIC_API_KEY`) first.

## Try these

- **`end_turn`:** run any script with no arguments.
- **`max_tokens`:** pass a tiny budget, for example `./haiku_call.sh "Explain the agent loop" 20`, `uv run haiku_call.py "Explain the agent loop" 20` or `npm start -- "Explain the agent loop" 20`. The answer stops mid-sentence and `stop_reason` says so.
- **Content blocks:** Haiku 5.5 thinks adaptively by default, so `content` can start with a `thinking` block (its text is empty by default). Each script reads every `text` block instead of `content[0].text`.
- **Compare:** the three outputs carry the same fields. The SDKs just give them to you as typed objects.

## Run from the terminal, not the editor's Run button

The VS Code Run button runs plain `python haiku_call.py` with whatever interpreter is selected, so the `anthropic` package may be missing. When the folder path has spaces, it can also wrap the path in two sets of quotes (`'"…"'`), so the file isn't found. Open a terminal in the folder and use the commands in the table above.

## Requirements

- raw: `curl` and `jq` (Windows: use Git Bash and `winget install jqlang.jq`)
- python_sdk: [uv](https://docs.astral.sh/uv/). `uv run` installs the `anthropic` package from the script header.
- typescript_sdk: Node.js 20 or later
