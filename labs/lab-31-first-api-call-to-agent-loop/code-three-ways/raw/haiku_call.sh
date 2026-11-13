#!/usr/bin/env bash
# One POST to the Claude Messages API with curl, signed in with Anthropic OAuth.
# Prints the raw JSON reply, then reads stop_reason, stop_details, content and usage out of it.
#
# Usage:  ./haiku_call.sh                          # default prompt, max_tokens 1024
#         ./haiku_call.sh "Your prompt" 20         # small max_tokens -> stop_reason "max_tokens"
# Needs:  ant (Anthropic CLI, signed in with `ant auth login`), curl, jq
set -euo pipefail

MODEL="claude-haiku-5-5"
PROMPT="${1:-In two sentences, explain what stop_reason tells an agent loop to do next.}"
MAX_TOKENS="${2:-1024}"

for tool in ant curl jq; do
  command -v "$tool" >/dev/null || { echo "Missing: $tool. See ../README.md for the install line." >&2; exit 1; }
done

# OAuth: ask the ant CLI for a short-lived access token from the `ant auth login` profile.
# --access-token prints the bare token (no flag prints the whole credentials JSON).
if ! TOKEN="$(ant auth print-credentials --access-token 2>/dev/null)" || [ -z "$TOKEN" ]; then
  echo "Not signed in to the Claude API. Run: ant auth login" >&2
  exit 1
fi

# Build the request body with jq so quotes in the prompt can't break the JSON.
BODY="$(jq -n --arg model "$MODEL" --arg prompt "$PROMPT" --argjson max "$MAX_TOKENS" \
  '{model: $model, max_tokens: $max, messages: [{role: "user", content: $prompt}]}')"

echo "== Request: POST https://api.anthropic.com/v1/messages"
echo "$BODY" | jq .

# OAuth tokens go in "Authorization: Bearer", not "x-api-key", and need the oauth beta header.
HTTP_CODE="$(curl -sS -X POST https://api.anthropic.com/v1/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "anthropic-version: 2026-10-21" \
  -H "anthropic-beta: oauth-2025-04-20" \
  -H "content-type: application/json" \
  -d "$BODY" \
  -o response.json -w '%{http_code}')"

echo
echo "== Raw response (HTTP $HTTP_CODE, also saved to response.json)"
jq . response.json

if [ "$HTTP_CODE" != "200" ]; then
  echo
  echo "The API refused the call: $(jq -r '.error.type + ": " + .error.message' response.json)" >&2
  exit 1
fi

echo
echo "== What the agent loop reads"
jq -r '
  "id            : \(.id)",
  "model         : \(.model)",
  "stop_reason   : \(.stop_reason)",
  "stop_sequence : \(.stop_sequence)",
  "stop_details  : \(.stop_details)",
  "input_tokens  : \(.usage.input_tokens)",
  "output_tokens : \(.usage.output_tokens)",
  "content blocks: \([.content[].type] | join(", "))"
' response.json

echo
echo "== Text Claude wrote"
# Read every text block, not .content[0]: a thinking block can come first.
jq -r '.content[] | select(.type == "text") | .text' response.json

echo
case "$(jq -r .stop_reason response.json)" in
  end_turn)      echo "end_turn: Claude finished. The loop stops and shows the answer." ;;
  max_tokens)    echo "max_tokens: cut off at $MAX_TOKENS tokens. Raise max_tokens or continue the turn." ;;
  stop_sequence) echo "stop_sequence: a stop sequence you set was hit." ;;
  tool_use)      echo "tool_use: Claude wants a tool. Run it and send back a tool_result." ;;
  pause_turn)    echo "pause_turn: a server tool paused. Send the reply back to let it continue." ;;
  refusal)       echo "refusal: declined. Read stop_details.category; don't use the content." ;;
  *)             echo "Unexpected stop_reason. Check the raw response above." ;;
esac
