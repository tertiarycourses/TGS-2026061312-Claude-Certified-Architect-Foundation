"""Orderly's customer resolution agent: the agentic loop with the Anthropic Python SDK and claude-haiku-5-5.
Run:  uv run agent.py "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please." """
import json
import sys

import anthropic
from dotenv import load_dotenv

from tools import TOOLS, run_tool

load_dotenv()
MODEL = "claude-haiku-5-5"
MAX_TURNS = 10
SYSTEM = """You are the support resolution agent for Orderly, an online furniture store.
1. Verify the customer with get_customer (by email) before any order tool.
2. Use lookup_order for anything about an order; pass the verified customer_id.
3. Damaged item with photo evidence (damage_photo true): refund the order amount with process_refund.
4. Escalate with escalate_to_human when the customer asks for a person, when policy does not cover the request,
   or when a tool tells you to. The human cannot see this chat: give customer_id, root_cause, recommended_action,
   refund_amount (0 if none) and order_ids.
5. Never say a refund happened unless process_refund returned status issued.
Reply to the customer in under 120 words."""


def run_agent(message: str) -> dict:
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": message}]
    calls = []
    for turn in range(1, MAX_TURNS + 1):
        response = client.messages.create(model=MODEL, max_tokens=4096, system=SYSTEM, tools=TOOLS, messages=messages)
        print(f"\nTurn {turn}: stop_reason={response.stop_reason}")
        messages.append({"role": "assistant", "content": response.content})   # the whole turn, thinking included
        if response.stop_reason != "tool_use":                                  # end_turn (or anything else): done
            return {"text": "".join(b.text for b in response.content if b.type == "text"), "calls": calls}
        results = []
        for block in response.content:
            if block.type == "tool_use":
                result, is_error = run_tool(block.name, block.input)
                print(f"  {block.name}({block.input}) -> {'ERROR ' if is_error else ''}{json.dumps(result)[:150]}")
                calls.append({"tool": block.name, "input": block.input, "result": result, "is_error": is_error})
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(result), "is_error": is_error})
        messages.append({"role": "user", "content": results})                 # every result in ONE user message
    return {"text": "(stopped: 10-turn limit)", "calls": calls}


if __name__ == "__main__":
    out = run_agent(sys.argv[1] if len(sys.argv) > 1 else "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Refund please.")
    print("\n=== Reply to the customer ===\n" + out["text"])
