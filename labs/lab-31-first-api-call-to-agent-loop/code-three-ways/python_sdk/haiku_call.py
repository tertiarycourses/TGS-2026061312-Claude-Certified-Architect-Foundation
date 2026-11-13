# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0.0"]
# ///
"""One call to Claude Haiku 5.5 with the Anthropic Python SDK, signed in with Anthropic OAuth.
Prints the full response, then reads stop_reason, stop_details, content and usage out of it.

Usage:  uv run haiku_call.py                       # default prompt, max_tokens 1024
        uv run haiku_call.py "Your prompt" 20      # small max_tokens -> stop_reason "max_tokens"
Needs:  `ant auth login` once. The SDK finds that OAuth profile by itself: no API key."""
import os
import sys

import anthropic

MODEL = "claude-haiku-5-5"
prompt = sys.argv[1] if len(sys.argv) > 1 else "In two sentences, explain what stop_reason tells an agent loop to do next."
max_tokens = int(sys.argv[2]) if len(sys.argv) > 2 else 1024

if os.environ.get("ANTHROPIC_API_KEY"):
    print("Note: ANTHROPIC_API_KEY is set, so it overrides your OAuth sign-in. Unset it to use OAuth.", file=sys.stderr)

# No api_key argument: the client reads the `ant auth login` OAuth profile from ~/.config/anthropic.
client = anthropic.Anthropic()

try:
    message = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
except anthropic.AuthenticationError:
    sys.exit("Not signed in, or the sign-in ran out. Run: ant auth login")
except anthropic.RateLimitError as e:
    sys.exit(f"Rate limited (429). Wait and retry. {e.message}")
except anthropic.APIStatusError as e:
    sys.exit(f"The API refused the call ({e.status_code} {e.type}): {e.message}")
except anthropic.APIConnectionError as e:
    sys.exit(f"Could not reach the API: {e}")
except TypeError as e:
    # The SDK raises this before sending anything when it finds no key and no OAuth profile.
    if "Could not resolve authentication method" in str(e):
        sys.exit("Not signed in to the Claude API. Run: ant auth login")
    raise

print("== Full response object")
print(message.model_dump_json(indent=2))

print("\n== What the agent loop reads")
print(f"id            : {message.id}")
print(f"model         : {message.model}")
print(f"stop_reason   : {message.stop_reason}")
print(f"stop_sequence : {message.stop_sequence}")
print(f"stop_details  : {getattr(message, 'stop_details', None)}")
print(f"input_tokens  : {message.usage.input_tokens}")
print(f"output_tokens : {message.usage.output_tokens}")
print(f"content blocks: {', '.join(block.type for block in message.content)}")

print("\n== Text Claude wrote")
# Read every text block, not content[0]: a thinking block can come first.
for block in message.content:
    if block.type == "text":
        print(block.text)

print()
match message.stop_reason:
    case "end_turn":
        print("end_turn: Claude finished. The loop stops and shows the answer.")
    case "max_tokens":
        print(f"max_tokens: cut off at {max_tokens} tokens. Raise max_tokens or continue the turn.")
    case "stop_sequence":
        print("stop_sequence: a stop sequence you set was hit.")
    case "tool_use":
        print("tool_use: Claude wants a tool. Run it and send back a tool_result.")
    case "pause_turn":
        print("pause_turn: a server tool paused. Send the reply back to let it continue.")
    case "refusal":
        print(f"refusal: declined ({message.stop_details}). Don't use the content.")
    case other:
        print(f"Unexpected stop_reason {other!r}. Check the full response above.")
