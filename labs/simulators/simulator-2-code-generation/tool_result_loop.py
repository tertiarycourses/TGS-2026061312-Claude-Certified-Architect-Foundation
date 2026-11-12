#!/usr/bin/env python3
"""Lab 2, live: what Claude does when your script never sends the tool_result back, and when it does.

Usage: uv run tool_result_loop.py [--max-turns 3]

Two real runs against Claude, each a hand-written agentic loop with a client-executed run_test tool:
  Scenario 1  the script runs the test, then sends only a text note: no tool_use turn, no tool_result.
  Scenario 2  the script appends the assistant tool_use turn, then a user turn whose tool_result
              carries the same tool_use_id.
Every loop stops at --max-turns, so a run can never spin forever. Evidence: evidence/tool_result_loop.json
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit
import argparse, json, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVID = HERE / "evidence" / "tool_result_loop.json"
emit = simkit.emit

ASK = "Run the test test_totals_rounding in stock/ with the run_test tool, then tell me in one sentence whether it passed and why."
SYSTEM = "You are a CI helper. Use the run_test tool to run tests; never guess a test's result."
TOOLS = [{"name": "run_test", "description": "Run one pytest test in the repository and return its outcome.",
          "input_schema": {"type": "object", "properties": {"test": {"type": "string", "description": "Test name, e.g. test_totals_rounding"}},
                           "required": ["test"]}}]

def run_test_locally(args):
    """The client-executed tool: your script runs it, not Claude. A fixed, fake outcome keeps the lab repeatable."""
    return {"test": args.get("test", "test_totals_rounding"), "outcome": "failed",
            "detail": "AssertionError: totals() returned 10.004, expected 10.0 (rounding happens after the sum, not per line)"}

def turn(client, model, messages, n):
    emit(f"Turn {n}: sending the conversation to Claude ({len(messages)} message{'s' if len(messages) > 1 else ''})")
    r = client.messages.create(model=model, max_tokens=400, system=SYSTEM, tools=TOOLS, messages=messages)
    uses = [b for b in r.content if b.type == "tool_use"]
    text = " ".join(b.text for b in r.content if b.type == "text").strip()
    if text: emit(f"  claude: {simkit.short(text, 160)}")
    return r, uses, text

def scenario(client, model, max_turns, fixed):
    title = "Scenario 2 · the script sends the matching tool_result" if fixed else "Scenario 1 · the script never sends a tool_result"
    emit(""); emit(f"=== {title}")
    messages = [{"role": "user", "content": ASK}]
    calls, ids, reply, cost, stopped_by = [], [], "", 0.0, "end_turn"
    for n in range(1, max_turns + 1):
        r, uses, text = turn(client, model, messages, n); cost += r.cost_usd or 0
        if not uses:
            emit("  -> STOP: no tool_use, so Claude has finished and the loop ends")
            reply = text; break
        u = uses[0]; ids.append(u.id); calls.append({"tool": "run_test", "input": u.input, "tool_use_id": u.id})
        emit(f"  -> CONTINUE: Claude asks for run_test, tool_use id {u.id}")
        result = run_test_locally(u.input)
        emit(f"  script: ran run_test locally -> {result['outcome']}")
        if fixed:
            messages += [{"role": "assistant", "content": r.content},
                         {"role": "user", "content": [{"type": "tool_result", "tool_use_id": u.id, "content": json.dumps(result)}]}]
            emit(f"  script: appends the assistant tool_use turn, then a user tool_result with tool_use_id {u.id}  (ids match)")
        else:
            messages += [{"role": "user", "content": "The test has been run."}]
            emit("  script: appends only a text note. No tool_use turn, no tool_result, so Claude never sees the outcome")
    else:
        stopped_by = "turn cap"
        emit(f"  LOOP GUARD: still asking for run_test after {max_turns} turns, so the script stops here.")
        emit("  Without a cap, this loop would never end: every turn Claude asks again, and never gets an answer.")
    return {"scenario": "fixed" if fixed else "no tool_result", "turns": n, "stopped_by": stopped_by,
            "tool_calls": calls, "tool_use_ids": ids, "reply": reply, "cost_usd": round(cost, 4)}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-turns", type=int, default=3, help="hard cap on loop turns in each scenario (default 3)")
    a = ap.parse_args(); max_turns = max(2, min(a.max_turns, 6))
    model = simkit.MODEL; client = simkit.Anthropic(); began = time.time()
    emit(f"Lab 2 · tool_result loop · model {model} · at most {max_turns} turns per scenario")
    broken = scenario(client, model, max_turns, fixed=False)
    fixed = scenario(client, model, max_turns, fixed=True)
    asks = len(broken["tool_calls"])
    checks = [
        {"check": f"without a tool_result, Claude asked for run_test again ({asks} times in {broken['turns']} turns)", "pass": asks >= 2},
        {"check": "with a matching tool_result, Claude finished on end_turn", "pass": fixed["stopped_by"] == "end_turn" and bool(fixed["reply"])},
        {"check": "Claude's answer uses the tool's outcome (failed / rounding)", "pass": any(w in fixed["reply"].lower() for w in ("fail", "round"))},
        {"check": "every loop stopped within the turn cap", "pass": broken["turns"] <= max_turns and fixed["turns"] <= max_turns}]
    out = {"lab": 2, "model": model, "message": ASK, "max_turns": max_turns,
           "tool_calls": broken["tool_calls"] + fixed["tool_calls"], "reply": fixed["reply"],
           "scenarios": [broken, fixed], "checks": checks, "cost_usd": round(broken["cost_usd"] + fixed["cost_usd"], 4),
           "seconds": round(time.time() - began, 1)}
    EVID.parent.mkdir(parents=True, exist_ok=True); EVID.write_text(json.dumps(out, indent=1), encoding="utf-8")
    emit(""); emit(f"done: scenario 1 asked for run_test {asks} times and never got an answer; "
                   f"scenario 2 finished in {fixed['turns']} turns. cost ${out['cost_usd']}")
    for c in checks: emit(f"  {'PASS' if c['pass'] else 'FAIL'}  {c['check']}")
    sys.exit(0 if all(c["pass"] for c in checks) else 1)

if __name__ == "__main__":
    import sys
    main()
