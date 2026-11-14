# Lab 45: Keep the facts, cache the handbook

> Extra code build (optional, not in the deck) · Topic 5: Context Management & Reliability · Task statement 5.1 · Code lab · Claude Haiku 5.5

**A 1,402-token policy is cached once and read back at a tenth of the price, while the case facts ride along every turn.**

**Lab page:** [the main lab page](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/) lists every lab (Day 1 runs there live in your browser). This lab's guide online: [https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-45-context-and-prompt-caching.html](https://tertiarycourses.github.io/TGS-2026061312-Claude-Certified-Architect-Foundation/guides/lab-45-context-and-prompt-caching.html).

## What you'll do

Run a three-turn support chat that caches a long policy handbook, restates a case-facts block every turn, and trims a 40-field tool record to the 5 fields that matter.

## What's in this folder

| File | What it is |
|---|---|
| `policy.md` | the support handbook (cached) |
| `cached_support.py` | the three-turn chat |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-45-context-and-prompt-caching`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Run the chat. Read the cache numbers on each turn.

```
uv run cached_support.py
```

**Step 2.** Check that the refund amount (SGD 480) and the courier rule (over 20 kg) stay right in turns 2 and 3.

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `Order record: 40 fields from the system, 5 kept`
- `Turn 1: cache write 1402, cache read 0`
- `Turn 2: cache write 0, cache read 1402`
- `Turn 3: cache write 0, cache read 1402`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `cached_support.py`, look for the `KEY` comments:

- **KEY 1.** Stable text first, with the cache marker on the last stable block. Anything that changes goes after it.
- **KEY 2.** Trim tool output before it enters the context: 5 fields kept out of 40.
- **KEY 3.** The case-facts block is restated every turn, so key numbers never depend on an old message.
- **KEY 4.** usage proves it: cache write on turn 1, cache read on every turn after.

## The code: `cached_support.py`

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 45: keep the facts that matter, pay less for the context that repeats.
  - prompt caching: the long policy handbook is cached once, then read at a tenth of the price
  - a case-facts block: the numbers that must survive a long chat are restated every turn, not left in old messages
  - trimmed tool output: keep the 5 fields you need, not the 40 the system returns
Run:  uv run cached_support.py"""
import json
from pathlib import Path
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"

SYSTEM = [  # KEY 1: stable text first, cache marker on the last stable block
    {"type": "text", "text": "You are a Lumen Home Goods support agent. Follow the handbook exactly."},
    {"type": "text", "text": Path("policy.md").read_text(), "cache_control": {"type": "ephemeral"}},
]

RAW_ORDER = {"order_id": "ORD-5508", "customer": "CUS-0042", "item": "Wool rug 2x3m", "amount_sgd": 480.0,
             "delivered": "2026-11-02", "weight_kg": 24, **{f"warehouse_field_{i}": "…" for i in range(34)}}
KEEP = ("order_id", "item", "amount_sgd", "delivered", "weight_kg")
order = {k: RAW_ORDER[k] for k in KEEP}                         # KEY 2: trim before it enters the context
print(f"Order record: {len(RAW_ORDER)} fields from the system, {len(order)} kept")

case_facts = {"customer": "Mei Ling (CUS-0042)", "order": order, "promised_so_far": "nothing"}
turns = ["Hi, I'm Mei Ling. My rug from ORD-5508 is the wrong colour. Can I swap it?",
         "Actually, just refund me instead. How much do I get back?",
         "And who collects it? It's really heavy."]

history = []
for n, question in enumerate(turns, 1):
    facts = f"<case_facts>\n{json.dumps(case_facts, indent=1)}\n</case_facts>\n\n"   # KEY 3: restated every turn
    history.append({"role": "user", "content": facts + question})
    r = client.messages.create(model=MODEL, max_tokens=2048, system=SYSTEM, messages=history)
    reply = "".join(b.text for b in r.content if b.type == "text")
```

```python
    history.append({"role": "assistant", "content": r.content})
    u = r.usage
    print(f"\nTurn {n}: cache write {u.cache_creation_input_tokens}, cache read {u.cache_read_input_tokens}, "
          f"uncached {u.input_tokens}")                           # KEY 4: proof the cache is working
    print("  Customer:", question)
    print("  Agent   :", " ".join(reply.split())[:300])
```

## Try this

Put today's date at the start of the first system block and run twice. The cache never hits: one changing byte early in the prefix breaks it.

## How this shows up in the exam

Task 5.1: keep transactional facts in a persistent case-facts block, trim verbose tool output, and put key material where it won't be lost in a long context.
