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
