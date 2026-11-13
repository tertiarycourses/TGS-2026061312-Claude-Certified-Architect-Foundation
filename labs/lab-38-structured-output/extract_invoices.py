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
