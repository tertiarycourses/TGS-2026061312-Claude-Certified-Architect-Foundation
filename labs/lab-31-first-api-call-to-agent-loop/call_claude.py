# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 31, step 1: one call to Claude Haiku 5.5 with the Anthropic Python SDK.
Run:  uv run call_claude.py                        -> stop_reason end_turn
      uv run call_claude.py "Explain the agent loop" 20   -> stop_reason max_tokens"""
import sys
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))          # KEY 1: ANTHROPIC_API_KEY comes from labs/.env
client = anthropic.Anthropic()                  # reads ANTHROPIC_API_KEY from the environment
MODEL = "claude-haiku-5-5"

prompt = sys.argv[1] if len(sys.argv) > 1 else "In two sentences, what does stop_reason tell an agent loop?"
max_tokens = int(sys.argv[2]) if len(sys.argv) > 2 else 1024

message = client.messages.create(               # KEY 2: one POST to /v1/messages
    model=MODEL,
    max_tokens=max_tokens,
    messages=[{"role": "user", "content": prompt}],
)

print("stop_reason   :", message.stop_reason)   # KEY 3: the field your loop branches on
print("usage         :", message.usage.input_tokens, "in /", message.usage.output_tokens, "out")
print("content blocks:", [block.type for block in message.content])
for block in message.content:                   # KEY 4: read every text block, not content[0]
    if block.type == "text":
        print("\n" + block.text)
