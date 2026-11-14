# Lab 39: Write the tool description Claude actually reads

> Extra code build (optional, not in the deck) · Topic 2: Tool Design & MCP Integration · Task statements 2.1, 2.3 · Code lab · Claude Haiku 5.5

**Same tools, same questions: vague descriptions got 2 of 4 wrong, clear ones got 0. Then take control with tool_choice.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab (Day 1 runs there live in your browser). This lab's guide online: [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-39-tool-design-and-tool-choice.html](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-39-tool-design-and-tool-choice.html).

## What you'll do

Measure how tool descriptions change which tool Claude picks, then use tool_choice to decide who decides: Claude (auto), any tool (any) or one named tool (tool).

## What's in this folder

| File | What it is |
|---|---|
| `tool_design.py` | two tools, vague vs clear descriptions, four questions |
| `tool_choice.py` | one question under auto, any and tool |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-39-tool-design-and-tool-choice`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Run the description test and count the WRONG lines in each block.

```
uv run tool_design.py
```

**Step 2.** Run the tool_choice test. Watch stop_reason and which tools are called under each setting.

```
uv run tool_choice.py
```

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `VAGUE descriptions ... wrong picks: 2 of 4`
- `CLEAR descriptions ... wrong picks: 0 of 4`
- `tool_choice=tool  stop_reason=tool_use  tool calls: [extract_complaint(...)]`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `tool_design.py`, look for the `KEY` comments:

- **KEY 1.** Vague names and descriptions overlap, so Claude has to guess which tool fits.
- **KEY 2.** A clear description says what the tool does, what input it takes, when to use it and when NOT to.

In `tool_choice.py`, look for the `KEY` comments:

- **KEY 1.** auto (the default): Claude decides whether to call a tool at all.
- **KEY 2.** any: Claude must call a tool, but picks which one.
- **KEY 3.** tool + disable_parallel_tool_use: Claude must call exactly this tool, once. Use it to guarantee structured output.

## The code: `tool_design.py`

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 39, part 1: tool descriptions decide which tool Claude picks.
Same two tools, same questions, two sets of descriptions. Count the wrong picks.
Run:  uv run tool_design.py"""
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"

SCHEMA = {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}

VAGUE = [  # KEY 1: names and descriptions that overlap: Claude has to guess
    {"name": "get_info", "description": "Gets information.", "input_schema": SCHEMA},
    {"name": "fetch_data", "description": "Fetches data for the user.", "input_schema": SCHEMA},
]
CLEAR = [  # KEY 2: what it does, what input it takes, when to use it, and when NOT to
    {"name": "get_info",
     "description": ("Look up a CUSTOMER account by email address or customer ID (CUS-NNNN). Returns name, tier and "
                     "verification status. Use it for questions about who the customer is. Not for orders or shipments."),
     "input_schema": SCHEMA},
    {"name": "fetch_data",
     "description": ("Look up an ORDER by order ID (ORD-NNNN). Returns items, amount, shipping status and delivery date. "
                     "Use it for questions about a purchase or a delivery. Not for account details."),
     "input_schema": SCHEMA},
]

QUESTIONS = {  # question -> the tool that should be picked
    "Where is my parcel for ORD-5501?": "fetch_data",
    "Is jane@example.com a Gold tier member?": "get_info",
    "How much did I pay for ORD-5502?": "fetch_data",
    "Is account CUS-0042 verified yet?": "get_info",
}

for label, tools in (("VAGUE descriptions", VAGUE), ("CLEAR descriptions", CLEAR)):
    wrong = 0
```

```python
    print(f"\n== {label}")
    for question, expected in QUESTIONS.items():
        r = client.messages.create(model=MODEL, max_tokens=1024, tools=tools,
                                   tool_choice={"type": "any"},  # must call a tool: we only test WHICH one
                                   messages=[{"role": "user", "content": question}])
        picked = next(b.name for b in r.content if b.type == "tool_use")
        wrong += picked != expected
        print(f"   {'OK   ' if picked == expected else 'WRONG'} {picked:<10} <- {question}")
    print(f"   wrong picks: {wrong} of {len(QUESTIONS)}")
```

## Try this

Add a third tool with a name close to an existing one (get_order_info) and see whether the clear descriptions still keep the picks right.

## How this shows up in the exam

Task 2.1: fix a misrouted tool by rewriting its description first. Task 2.3: fewer, focused tools per agent; forced tool_choice when you need a guaranteed call. Note (13 Nov 2026): Haiku 5.5 answered tool_choice 'none' with an empty turn; for a text-only reply, send the request without tools.
