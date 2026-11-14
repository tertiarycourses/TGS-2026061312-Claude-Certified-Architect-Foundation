# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 39, part 2: tool_choice decides WHO decides whether a tool is called.
One question, three settings. (For a text-only turn, send the request without `tools`:
on 13 Nov 2026 Haiku 5.5 answered tool_choice "none" with an empty turn, see README.) Watch stop_reason and the content blocks change.
Run:  uv run tool_choice.py"""
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"

TOOLS = [
    {"name": "lookup_order", "description": "Look up an order by ID (ORD-NNNN): status and amount.",
     "input_schema": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}},
    {"name": "extract_complaint", "description": "Record a complaint as structured fields.",
     "input_schema": {"type": "object", "properties": {"order_id": {"type": "string"}, "issue": {"type": "string"},
                                                       "wants": {"type": "string", "enum": ["refund", "replacement", "unclear"]}},
                      "required": ["order_id", "issue", "wants"]}},
]
SYSTEM = "You are a support assistant. Opening hours are 9am-9pm daily. When you cannot call a tool, answer in plain text."
QUESTION = "Hi! Quick one: what are your opening hours? Also, my order ORD-5501 lamp came cracked."

SETTINGS = {
    "auto": {"type": "auto"},                                  # KEY 1: Claude decides (the default)
    "any": {"type": "any"},                                    # KEY 2: must call SOME tool
    "tool": {"type": "tool", "name": "extract_complaint",      # KEY 3: must call THIS tool: guaranteed structured output
             "disable_parallel_tool_use": True},              # ...and only this one
}

for label, choice in SETTINGS.items():
    r = client.messages.create(model=MODEL, max_tokens=1024, tools=TOOLS, tool_choice=choice,
                               system=SYSTEM,
                               messages=[{"role": "user", "content": QUESTION}])
    calls = [f"{b.name}({b.input})" for b in r.content if b.type == "tool_use"]
    text = " ".join(b.text for b in r.content if b.type == "text").replace("\n", " ")
    print(f"\ntool_choice={label:<5} stop_reason={r.stop_reason}")
    print("   tool calls:", calls or "none")
    print("   text      :", text[:160] if text else f"(no text: content blocks were {[b.type for b in r.content]})")
