# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 39: keep the facts that matter, pay less for the context that repeats.
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
    history.append({"role": "assistant", "content": r.content})
    u = r.usage
    print(f"\nTurn {n}: cache write {u.cache_creation_input_tokens}, cache read {u.cache_read_input_tokens}, "
          f"uncached {u.input_tokens}")                           # KEY 4: proof the cache is working
    print("  Customer:", question)
    print("  Agent   :", " ".join(reply.split())[:300])
