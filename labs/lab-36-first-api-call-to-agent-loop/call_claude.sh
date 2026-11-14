#!/usr/bin/env bash
# Lab 36, step 1: one POST to the Claude Messages API with curl and your API key. No SDK at all.
# Usage:  ./call_claude.sh                        -> stop_reason end_turn
#         ./call_claude.sh "Explain the agent loop" 20   -> stop_reason max_tokens
set -euo pipefail
cd "$(dirname "$0")"
. ../load_env.sh                                       # exports ANTHROPIC_API_KEY from labs/.env

PROMPT="${1:-In two sentences, what does stop_reason tell an agent loop?}"
MAX_TOKENS="${2:-1024}"
BODY=$(printf '{"model":"claude-haiku-5-5","max_tokens":%s,"messages":[{"role":"user","content":"%s"}]}' \
  "$MAX_TOKENS" "${PROMPT//\"/\\\"}")                   # KEY 1: model, max_tokens, messages: the three required fields

curl -sS https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2026-10-21" \
  -H "content-type: application/json" \
  -d "$BODY" -o response.json                          # KEY 2: the API key goes in x-api-key

if command -v jq >/dev/null; then                      # KEY 3: the same fields the SDK gives you as objects
  jq '{stop_reason, usage, blocks: [.content[].type], text: [.content[] | select(.type=="text") | .text] | join("")}' response.json
else
  cat response.json; echo
fi
