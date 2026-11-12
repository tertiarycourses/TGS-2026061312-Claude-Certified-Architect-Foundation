#!/usr/bin/env python3
"""Lab 57, live: the same discovery job, done in the main thread, then delegated to an explorer subagent.

Usage: uv run discovery_delegate.py [--max-turns 20]

Claude Code works on this simulator's own code: it must find how documents are parsed, validated against
the schema, labelled in fixtures and retried, then write a five-line plan for a new document type.
  Run 1  the main thread searches and reads every file itself
  Run 2  the main thread hands discovery to an explorer subagent that returns at most 10 lines
You see how many characters of tool output landed in the main thread each time, and both plans.
Read-only tools only, and each run stops at --max-turns. Evidence: evidence/discovery_delegate.json
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit
import argparse, hashlib, json, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVID = HERE / "evidence" / "discovery_delegate.json"
emit = simkit.emit
JOB = ("We are adding a 'purchase_order' document type to this extraction project. First find: where documents are parsed, "
       "how extractions are validated against the JSON schema, how fixtures are labelled, and how failed validations are retried. "
       "Then write a plan of at most five lines that names the files to change. Do not edit anything.")
EXPLORER = {"explorer": {"description": "Explores this codebase and returns a short factual summary.",
                         "prompt": "You explore code with Read, Grep and Glob. Return at most 10 lines: one fact per line with its file path. Never paste code.",
                         "tools": ["Read", "Grep", "Glob"]}}

def tree_hash():
    h = hashlib.sha1()
    for p in sorted(HERE.rglob("*.py")) + sorted(HERE.glob("*.json")):
        if "evidence" not in p.parts: h.update(p.read_bytes())
    return h.hexdigest()

def run(label, prompt, max_turns, delegate):
    emit(""); emit(f"=== {label}")
    r = simkit.run_agent(prompt, cwd=HERE, max_turns=max_turns, mode="dontAsk",
                         tools=["Agent"] if delegate else ["Read", "Grep", "Glob"],
                         disallowed=["Edit", "Write", "Bash"] + ([] if delegate else ["Agent", "Task"]),
                         agents=EXPLORER if delegate else None)
    ctx = r.get("context", {}); main, sub = ctx.get("main", {}), ctx.get("subagent", {})
    emit(f"  main thread: {len(main.get('tool_calls', []))} tool calls ({', '.join(sorted(set(main.get('tool_calls', [])))) or 'none'}), "
         f"{main.get('tool_result_chars', 0):,} characters of tool output in its context")
    if delegate: emit(f"  explorer subagent: {len(sub.get('tool_calls', []))} tool calls, {sub.get('tool_result_chars', 0):,} characters kept out of the main thread")
    return {"label": label, "delegated": delegate, "turns": r.get("num_turns"), "main": main, "subagent": sub,
            "plan": r.get("result") or "", "cost_usd": round(r.get("total_cost_usd") or 0, 4), "is_error": r.get("is_error")}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-turns", type=int, default=20, help="hard cap on agent turns in each run (default 20)")
    a = ap.parse_args(); max_turns = max(5, min(a.max_turns, 30)); began = time.time(); before = tree_hash()
    emit(f"Lab 57 · keep discovery out of the main thread · model {simkit.MODEL} · at most {max_turns} turns per run")
    inline = run("Run 1 · the main thread does the discovery itself", JOB, max_turns, delegate=False)
    deleg = run("Run 2 · discovery delegated to the explorer subagent",
                "Delegate all of the discovery below to the explorer subagent, then write the plan from its summary.\n\n" + JOB, max_turns, delegate=True)
    m1, m2 = inline["main"].get("tool_result_chars", 0), deleg["main"].get("tool_result_chars", 0)
    cites = lambda p: sum(f in p for f in ("extract.py", "invoice.schema.json", "labels.json", "invoices.txt"))
    checks = [
        {"check": f"delegating kept discovery output out of the main thread ({m2:,} vs {m1:,} characters)", "pass": 0 < m1 and m2 < 0.5 * m1},
        {"check": "in run 2 the main thread made no Read, Grep or Glob calls of its own",
         "pass": not (set(deleg["main"].get("tool_calls", [])) & {"Read", "Grep", "Glob"}) and bool(deleg["subagent"].get("tool_calls"))},
        {"check": f"both plans name the files to change ({cites(inline['plan'])} and {cites(deleg['plan'])} of 4 key files)",
         "pass": cites(inline["plan"]) >= 2 and cites(deleg["plan"]) >= 2},
        {"check": "no files changed", "pass": tree_hash() == before}]
    out = {"lab": 57, "model": simkit.MODEL, "message": JOB, "max_turns": max_turns,
           "tool_calls": [{"tool": t} for r in (inline, deleg) for t in r["main"].get("tool_calls", []) + r["subagent"].get("tool_calls", [])],
           "reply": deleg["plan"], "runs": [inline, deleg], "checks": checks,
           "cost_usd": round(inline["cost_usd"] + deleg["cost_usd"], 4), "seconds": round(time.time() - began, 1)}
    EVID.parent.mkdir(parents=True, exist_ok=True); EVID.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    emit(""); emit(f"done: main-thread tool output {m1:,} characters inline, {m2:,} delegated. cost ${out['cost_usd']}")
    emit(f"  plan (delegated): {simkit.short(deleg['plan'], 300)}")
    for c in checks: emit(f"  {'PASS' if c['pass'] else 'FAIL'}  {c['check']}")
    sys.exit(0 if all(c["pass"] for c in checks) else 1)

if __name__ == "__main__":
    main()
