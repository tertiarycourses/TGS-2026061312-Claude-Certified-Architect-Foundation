# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 31, step 2: the agentic loop, written by hand.
Claude asks for tools; your code runs them and appends every result; the loop stops on end_turn.
Run:  uv run agent_loop.py
      uv run agent_loop.py "Order ORD-5502 arrived broken. Can I get my money back?" """
import json
import sys
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"

ORDERS = {"ORD-5501": {"item": "Ceramic lamp", "amount": 120.0, "status": "delivered", "days_since_delivery": 4},
          "ORD-5502": {"item": "Standing desk", "amount": 640.0, "status": "delivered", "days_since_delivery": 41}}

TOOLS = [
    {"name": "lookup_order",
     "description": "Get one order by its ID (format ORD-NNNN): item, amount, status, days since delivery.",
     "input_schema": {"type": "object", "properties": {"order_id": {"type": "string"}}, "required": ["order_id"]}},
    {"name": "check_refund_policy",
     "description": "Check whether an order amount and age qualify for a refund. Call after lookup_order.",
     "input_schema": {"type": "object", "properties": {"amount": {"type": "number"}, "days_since_delivery": {"type": "integer"}},
                      "required": ["amount", "days_since_delivery"]}},
]


def run_tool(name, args):
    if name == "lookup_order":
        return ORDERS.get(args["order_id"], {"error": f"No order {args['order_id']}"})
    if name == "check_refund_policy":
        ok = args["days_since_delivery"] <= 30
        return {"eligible": ok, "reason": "within 30 days" if ok else "outside the 30-day window"}
    return {"error": f"unknown tool {name}"}


question = sys.argv[1] if len(sys.argv) > 1 else "My lamp from order ORD-5501 arrived cracked. Can I get a refund?"
messages = [{"role": "user", "content": question}]          # KEY 1: the API is stateless; you keep the history

for turn in range(1, 9):                                     # KEY 2: a turn cap, so a confused loop can't run forever
    response = client.messages.create(model=MODEL, max_tokens=2048, tools=TOOLS, messages=messages)
    print(f"Turn {turn}: stop_reason={response.stop_reason}")
    messages.append({"role": "assistant", "content": response.content})   # KEY 3: append Claude's whole turn

    if response.stop_reason != "tool_use":                   # KEY 4: end_turn (or anything else) ends the loop
        print("\n" + "".join(b.text for b in response.content if b.type == "text"))
        break

    results = []
    for block in response.content:
        if block.type == "tool_use":
            output = run_tool(block.name, block.input)
            print(f"   tool {block.name}({json.dumps(block.input)}) -> {json.dumps(output)}")
            results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(output)})
    messages.append({"role": "user", "content": results})    # KEY 5: every result goes back, in one user message
