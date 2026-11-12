#!/usr/bin/env python3
"""Lab 4, live: three subagents investigate extraction failures, first with the same brief, then partitioned.

Usage: uv run partition_review.py [--max-turns 5]

The coordinator (this script) starts three subagents. Each is its own Claude session with an isolated
context and one tool, load_document. The script records every document each subagent actually loads.
  Run 1  the same brief to every subagent: "find schema-validation failures across all documents"
  Run 2  one document group and one concern per subagent, and a three-line deliverable
The table at the end shows which subagents read each document. Every subagent stops at --max-turns.
Evidence: evidence/partition_review.json
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit
import argparse, json, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVID = HERE / "evidence" / "partition_review.json"
LOCK = threading.Lock()
def emit(line):
    with LOCK: simkit.emit(line)

def parse_docs():
    docs = []
    for block in (HERE / "fixtures" / "invoices.txt").read_text(encoding="utf-8").split("=== ")[1:]:
        head, body = block.split("\n", 1)
        doc_id, dtype = head.split("| type:")
        docs.append({"id": doc_id.strip(), "type": dtype.strip(), "text": body.strip()})
    return docs

DOCS = parse_docs(); BY_ID = {d["id"]: d for d in DOCS}
SYSTEM = "You are a subagent investigating why documents fail JSON-schema validation during extraction. Load documents with load_document before you comment on them."
TOOLS = [{"name": "load_document", "description": "Load one document's raw text by its id, e.g. DOC-03.",
          "input_schema": {"type": "object", "properties": {"doc_id": {"type": "string"}}, "required": ["doc_id"]}}]
CONCERN = {"invoice": "dates and currency that won't normalise", "receipt": "totals that include tax not shown as a line item",
           "credit_note": "the sign of the total and a missing currency"}

def briefs(partitioned):
    if not partitioned:
        ids = ", ".join(BY_ID)
        same = f"Find the causes of schema-validation failures across all documents: {ids}. Report your findings."
        return [(f"investigator-{i}", same) for i in (1, 2, 3)]
    groups = {}
    for d in DOCS: groups.setdefault(d["type"], []).append(d["id"])
    out = []
    for i, (g, ids) in enumerate(sorted(groups.items()), 1):
        out.append((f"investigator-{i}", f"Your group: the {g} documents {', '.join(ids)}. Your concern: {CONCERN.get(g, 'schema validation failures')}. "
                                          "Load only your documents. Reply in at most 3 lines, one finding per line, each starting with the document id."))
    return out

def subagent(client, model, name, brief, max_turns):
    """One subagent: its own conversation, so it sees only what its brief and its own tool calls give it."""
    messages = [{"role": "user", "content": brief}]; loaded, reply, cost = [], "", 0.0
    for n in range(1, max_turns + 1):
        r = client.messages.create(model=model, max_tokens=500, system=SYSTEM, tools=TOOLS, messages=messages)
        cost += r.cost_usd or 0
        uses = [b for b in r.content if b.type == "tool_use"]
        if not uses:
            reply = " ".join(b.text for b in r.content if b.type == "text").strip(); break
        results = []
        for u in uses:
            doc = BY_ID.get(str(u.input.get("doc_id", "")).strip().upper())
            if doc: loaded.append(doc["id"])
            emit(f"  {name}  turn {n}: load_document({u.input.get('doc_id')})")
            results.append({"type": "tool_result", "tool_use_id": u.id, "content": doc["text"] if doc else "No such document."})
        messages += [{"role": "assistant", "content": r.content}, {"role": "user", "content": results}]
    else:
        emit(f"  {name}  LOOP GUARD: stopped after {max_turns} turns")
    asked = " (asked for at most 3)" if "at most 3 lines" in brief else ""
    emit(f"  {name}  done: loaded {len(loaded)} documents, wrote {len(reply.splitlines()) if reply else 0} lines{asked}")
    return {"agent": name, "brief": brief, "loaded": loaded, "reply": reply, "cost_usd": round(cost, 4)}

def run(client, model, partitioned, max_turns):
    emit(""); emit("=== Run 2 · partitioned: one group and one concern per subagent" if partitioned else "=== Run 1 · the same brief to every subagent")
    bs = briefs(partitioned)
    for name, b in bs: emit(f"  brief to {name}: {simkit.short(b, 150)}")
    with ThreadPoolExecutor(3) as ex:
        agents = list(ex.map(lambda nb: subagent(client, model, nb[0], nb[1], max_turns), bs))
    readers = {d: [a["agent"] for a in agents if d in a["loaded"]] for d in BY_ID}
    emit("  document -> subagents that loaded it")
    for d, who in readers.items():
        mark = "one owner" if len(set(who)) == 1 else ("NOT READ" if not who else f"read {len(set(who))} times")
        emit(f"    {d} ({BY_ID[d]['type']:<11}) -> {', '.join(sorted(set(who))) or '-':<45} {mark}")
    words = sum(len(a["reply"].split()) for a in agents)
    emit(f"  synthesis input: {words} words of findings from 3 subagents")
    return {"partitioned": partitioned, "agents": agents, "readers": readers, "synthesis_words": words,
            "cost_usd": round(sum(a["cost_usd"] for a in agents), 4)}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-turns", type=int, default=5, help="hard cap on turns for each subagent (default 5)")
    a = ap.parse_args(); max_turns = max(2, min(a.max_turns, 8))
    model = simkit.MODEL; client = simkit.Anthropic(); began = time.time()
    emit(f"Lab 4 · partitioning subagent work · {len(DOCS)} documents · 3 subagents · model {model} · at most {max_turns} turns each")
    same = run(client, model, False, max_turns)
    part = run(client, model, True, max_turns)
    overlap = sum(1 for w in same["readers"].values() if len(set(w)) > 1)
    owned = all(len(set(w)) == 1 for w in part["readers"].values())
    checks = [
        {"check": f"same brief: {overlap} of {len(DOCS)} documents were read by more than one subagent", "pass": overlap > 0},
        {"check": "partitioned: every document was read by exactly one subagent", "pass": owned},
        {"check": f"partitioned findings are shorter for synthesis ({part['synthesis_words']} vs {same['synthesis_words']} words)",
         "pass": 0 < part["synthesis_words"] < same["synthesis_words"]},
        {"check": "partitioned: each subagent loaded only the documents in its own group",
         "pass": all(set(x["loaded"]) and set(x["loaded"]) <= set(d for d in BY_ID if d in x["brief"]) for x in part["agents"])}]
    out = {"lab": 4, "model": model, "message": "Investigate extraction failures across the documents with three subagents.",
           "tool_calls": [{"tool": "load_document", "agent": x["agent"], "doc_id": d} for r in (same, part) for x in r["agents"] for d in x["loaded"]],
           "reply": "\n".join(f"{x['agent']}: {x['reply']}" for x in part["agents"]),
           "runs": [same, part], "checks": checks, "cost_usd": round(same["cost_usd"] + part["cost_usd"], 4), "seconds": round(time.time() - began, 1)}
    EVID.parent.mkdir(parents=True, exist_ok=True); EVID.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    emit(""); emit(f"done: same brief -> {overlap} documents read by several subagents, {same['synthesis_words']} words to merge; "
                   f"partitioned -> each document has one owner, {part['synthesis_words']} words. cost ${out['cost_usd']}")
    for x in part["agents"]: emit(f"  {x['agent']}: {simkit.short(x['reply'], 170)}")
    for c in checks: emit(f"  {'PASS' if c['pass'] else 'FAIL'}  {c['check']}")
    sys.exit(0 if all(c["pass"] for c in checks) else 1)

if __name__ == "__main__":
    main()
