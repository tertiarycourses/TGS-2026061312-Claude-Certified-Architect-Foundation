# Lab 31: From one API call to a working agent loop

> Day 2 · Topic 1: Agentic Architecture & Orchestration · Task statement 1.1 · Code lab · Claude Haiku 5.5

**Ten lines of loop are the whole agent. Write them yourself and watch stop_reason drive every turn.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab (Day 1 runs there live in your browser). This lab's guide online: [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-31-first-api-call-to-agent-loop.html](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-31-first-api-call-to-agent-loop.html).

## What you'll do

Call Claude Haiku 5.5 three ways (curl, Python, TypeScript), read stop_reason, then write the agentic loop by hand: tool_use means run the tool and go round again, end_turn means stop.

## What's in this folder

| File | What it is |
|---|---|
| `call_claude.sh` | curl: the raw HTTP request |
| `call_claude.py` | the same call with the Python SDK |
| `typescript/call_claude.ts` | the same call with the TypeScript SDK |
| `agent_loop.py` | a two-tool refund agent with a hand-written loop |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-31-first-api-call-to-agent-loop`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Make the call with nothing but curl. Look at stop_reason, usage and the content block types.

```
./call_claude.sh
```

**Step 2.** Make the same call with the Python SDK. Same fields, now as Python objects.

```
uv run call_claude.py
```

**Step 3.** Give Claude only 20 tokens. The answer stops mid-thought and stop_reason says max_tokens.

```
uv run call_claude.py "Explain the agent loop" 20
```

**Step 4.** Optional: the TypeScript SDK (Node.js 20+).

```
cd typescript && npm install && npm start
```

**Step 5.** Run the agent loop. Claude asks for lookup_order, then check_refund_policy, then answers.

```
uv run agent_loop.py
```

**Step 6.** Run it on an order outside the 30-day window and check that the answer follows the tool result.

```
uv run agent_loop.py "Order ORD-5502 arrived broken. Can I get my money back?"
```

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `Turn 1: stop_reason=tool_use  ->  lookup_order({"order_id": "ORD-5501"})`
- `Turn 2: stop_reason=tool_use  ->  check_refund_policy({"amount": 120.0, "days_since_delivery": 4})`
- `Turn 3: stop_reason=end_turn  ->  "Yes, you're eligible for a refund..."`
- `With max_tokens 20: stop_reason max_tokens and content blocks ['thinking']: no text at all.`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `agent_loop.py`, look for the `KEY` comments:

- **KEY 1.** messages is the whole memory. The API is stateless, so your code keeps and resends the history.
- **KEY 2.** A turn cap. A confused loop stops at 8 turns instead of running up your bill.
- **KEY 3.** Append Claude's entire turn (thinking and tool_use blocks included), not just the text.
- **KEY 4.** The only exit test: stop_reason. tool_use means continue; end_turn (or max_tokens) means stop.
- **KEY 5.** Every tool_result goes back in ONE user message, matched to its tool_use_id.

## The code: `agent_loop.py`

```python
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


```

```python
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
```

## Try this

Delete the line that appends the tool results and run again. Claude asks for the same tool over and over: it never saw the answer.

## How this shows up in the exam

Task 1.1: continue on tool_use, stop on end_turn, append every result. Parsing Claude's text for 'done' or capping iterations as the main stop rule are the tempting wrong answers.
