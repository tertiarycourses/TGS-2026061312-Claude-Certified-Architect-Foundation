# Lab 38: Half price, no hurry: triage tickets with the Batches API

> Day 2 · Topic 4: Prompt Engineering & Structured Output · Task statement 4.5 · Code lab · Claude Haiku 5.5

**Five tickets, one batch, results in a couple of minutes at 50% off, keyed by custom_id because they arrive in any order.**

## What you'll do

Submit a batch of classification requests, poll until it ends, and match each result to its ticket by custom_id.

## What's in this folder

| File | What it is |
|---|---|
| `batch_triage.py` | submit, poll, read results |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-38-message-batches`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Submit the batch and let it poll every 15 seconds. It usually ends within a few minutes; the API allows up to 24 hours.

```
uv run batch_triage.py
```

**Step 2.** Check the order of the results against the order of TICKETS in the code.

**Step 3.** If you closed the window, pick the batch up again with its ID.

```
uv run batch_triage.py --check msgbatch_...
```

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `Submitted batch msgbatch_... with 5 requests. Status: in_progress`
- `ended: 0 processing, 5 succeeded, 0 errored`
- `T-103: billing   high   Customer was charged twice... (T-103 came back first)`

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `batch_triage.py`, look for the `KEY` comments:

- **KEY 1.** custom_id is your only link from a result back to the request.
- **KEY 2.** Batches are asynchronous: you poll processing_status until it is 'ended'.
- **KEY 3.** Results arrive in any order and each can fail on its own; resubmit only the failed ones.

## The code: `batch_triage.py`

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 38: triage support tickets with the Message Batches API: half price, results within 24 hours, no tool loop.
Run:  uv run batch_triage.py                 (submit, then wait for the results)
      uv run batch_triage.py --check BATCH_ID (pick up a batch you submitted earlier)"""
import json
import sys
import time
import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"

TICKETS = {
    "T-101": "My lamp arrived cracked, order ORD-5501. I want my money back.",
    "T-102": "How do I change the email address on my account?",
    "T-103": "You charged me twice for ORD-5520!! Fix this today or I call my bank.",
    "T-104": "Do you ship to Malaysia, and how long does it take?",
    "T-105": "The rug I ordered (ORD-5508) is the wrong colour. Can I swap it?",
}
SYSTEM = ('Classify the support ticket. Reply with JSON only: {"category": "refund|billing|account|shipping|exchange", '
          '"urgency": "low|medium|high", "summary": "<10 words"}')


def submit():
    batch = client.messages.batches.create(requests=[
        Request(custom_id=tid,                                          # KEY 1: your only link back to the input
                params=MessageCreateParamsNonStreaming(model=MODEL, max_tokens=1024, system=SYSTEM,
                                                       messages=[{"role": "user", "content": text}]))
        for tid, text in TICKETS.items()])
    print(f"Submitted batch {batch.id} with {len(TICKETS)} requests. Status: {batch.processing_status}")
    return batch.id


```

```python
batch_id = sys.argv[sys.argv.index("--check") + 1] if "--check" in sys.argv else submit()

while True:                                                              # KEY 2: poll; batches are asynchronous
    batch = client.messages.batches.retrieve(batch_id)
    c = batch.request_counts
    print(f"  {time.strftime('%H:%M:%S')}  {batch.processing_status}: {c.processing} processing, {c.succeeded} succeeded, {c.errored} errored")
    if batch.processing_status == "ended":
        break
    time.sleep(15)

print()
for result in client.messages.batches.results(batch_id):                # KEY 3: results come back in ANY order
    if result.result.type != "succeeded":
        print(f"{result.custom_id}: {result.result.type}  -> resubmit just this one")
        continue
    text = "".join(b.text for b in result.result.message.content if b.type == "text")
    try:
        label = json.loads(text.strip().removeprefix("```json").removesuffix("```"))
        print(f"{result.custom_id}: {label['category']:<9} {label['urgency']:<6} {label['summary']}")
    except (json.JSONDecodeError, KeyError):
        print(f"{result.custom_id}: could not parse -> {text[:80]!r}")
```

## Try this

Add a ticket with a blank message and see how its result differs from the others.

## How this shows up in the exam

Task 4.5: batches suit overnight and bulk jobs, never a customer waiting on the reply; no multi-turn tool loop inside a batch; prove the prompt on a small sample first.
