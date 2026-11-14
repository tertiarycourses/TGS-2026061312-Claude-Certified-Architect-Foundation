# Lab 38: Valid JSON is the floor: check the meaning yourself

> Day 2 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.3 · Code lab · Claude Haiku 5.5

**The schema guarantees the shape. It cannot tell you the lines don't add up to the total.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab (Day 1 runs there live in your browser). This lab's guide online: [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-38-structured-output.html](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-38-structured-output.html).

## What you'll do

Extract three invoices into one Pydantic schema, first with forced strict tool use, then with messages.parse; then catch a missing field and a wrong total in your own code.

## What's in this folder

| File | What it is |
|---|---|
| `invoices.py` | three messy invoices |
| `extract_invoices.py` | both extraction methods plus the semantic check |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-38-structured-output`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Extract with strict tool use.

```
uv run extract_invoices.py
```

**Step 2.** Extract with messages.parse and a Pydantic model. Same results, no tool.

```
uv run extract_invoices.py --parse
```

**Step 3.** Find the two REVIEW lines and explain why the schema alone didn't catch them.

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `INV-1002  Bright Print  total 229.00  due None  ->  REVIEW: no due date in the source`
- `INV-1003  Nova Cloud Services  total 390.00  ->  REVIEW: lines add to 340.00 but total says 390.00`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `extract_invoices.py`, look for the `KEY` comments:

- **KEY 1.** One Pydantic model is the schema for both methods. extra='forbid' adds the additionalProperties: false that strict mode needs.
- **KEY 2.** due_date is nullable, so a missing value has an honest answer instead of a guess.
- **KEY 3.** strict: true guarantees the tool arguments match the schema exactly.
- **KEY 4.** Forced tool_choice: Claude must call record_invoice.
- **KEY 5.** messages.parse validates the reply straight into an Invoice object.
- **KEY 6.** The semantic check: valid JSON with wrong numbers is only caught by your code.

## The code: `extract_invoices.py`

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0", "pydantic>=2"]
# ///
"""Lab 38: structured output two ways, then the check the schema can't do for you.
  1. strict tool use: tool_choice forces record_invoice, strict:true guarantees the arguments match the schema
  2. messages.parse: output_config.format with a Pydantic model, validated into a Python object
Run:  uv run extract_invoices.py           (strict tool use)
      uv run extract_invoices.py --parse   (messages.parse + Pydantic)"""
import sys
import anthropic
from dotenv import find_dotenv, load_dotenv
from pydantic import BaseModel, ConfigDict
from invoices import INVOICES

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"
PROMPT = "Extract this invoice. Use null for any field that is not in the text; never guess.\n\n"


class Line(BaseModel):
    model_config = ConfigDict(extra="forbid")   # emits additionalProperties: false, which strict mode requires
    description: str
    amount: float


class Invoice(BaseModel):                       # KEY 1: one schema, used by both methods
    model_config = ConfigDict(extra="forbid")
    invoice_id: str
    supplier: str
    issue_date: str
    due_date: str | None                        # KEY 2: nullable, so "missing" has an honest answer
    lines: list[Line]
    total: float


RECORD_TOOL = {"name": "record_invoice", "description": "Record one extracted invoice.",
               "strict": True,                  # KEY 3: arguments are guaranteed to match input_schema
               "input_schema": Invoice.model_json_schema()}
```

```python


def extract_with_tool(text):
    r = client.messages.create(model=MODEL, max_tokens=2048, tools=[RECORD_TOOL],
                               tool_choice={"type": "tool", "name": "record_invoice"},   # KEY 4: forced
                               messages=[{"role": "user", "content": PROMPT + text}])
    block = next(b for b in r.content if b.type == "tool_use")
    return Invoice.model_validate(block.input)


def extract_with_parse(text):
    r = client.messages.parse(model=MODEL, max_tokens=2048, output_format=Invoice,       # KEY 5: no tool needed
                              messages=[{"role": "user", "content": PROMPT + text}])
    return r.parsed_output


extract = extract_with_parse if "--parse" in sys.argv else extract_with_tool
print("Method:", "messages.parse (output_config.format)" if "--parse" in sys.argv else "strict tool use")
for inv_id, text in INVOICES.items():
    inv = extract(text)
    problems = []
    if inv.due_date is None:
        problems.append("no due date in the source")
    line_sum = round(sum(line.amount for line in inv.lines), 2)
    if abs(line_sum - inv.total) > 0.01:        # KEY 6: valid JSON, wrong numbers: only YOUR code catches this
        problems.append(f"lines add to {line_sum:.2f} but total says {inv.total:.2f}")
    status = "REVIEW: " + "; ".join(problems) if problems else "OK"
    print(f"\n{inv.invoice_id}  {inv.supplier}  total {inv.total:.2f}  due {inv.due_date}\n   {status}")
```

## Try this

Remove '| None' from due_date and run again. Watch what Claude puts in a required field the invoice doesn't have.

## How this shows up in the exam

Task 4.3: tool use or structured outputs guarantee syntax, not semantics. Nullable fields stop fabrication; business rules are checked after extraction.
