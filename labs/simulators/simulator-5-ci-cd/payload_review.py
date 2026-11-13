#!/usr/bin/env python3
"""Extra practice (not a numbered lab), live: the same review twice, once with a 40-field tool result and once with a compact one.

Usage: uv run payload_review.py [--max-turns 3]

Claude reviews stock/totals.py through a client-executed analyze_file tool. The tool wrapper is the only
difference between the two runs: --verbose returns everything the CI platform knows (build metadata,
ownership, full lint, CI history, dependencies); --compact returns the five fields a reviewer uses.
You see the payload size, the real input tokens Claude was charged for on the turn that read it, and
both reviews side by side. Every loop stops at --max-turns. Evidence: evidence/payload_review.json
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit
import argparse, json, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVID = HERE / "evidence" / "payload_review.json"
emit = simkit.emit
FILE = "stock/totals.py"
ASK = (f"Review the change to {FILE}. Call analyze_file on it first. Then answer in two short lines: "
       "which functions changed, and which test covers them.")
SYSTEM = "You are the code-review step in a CI pipeline. Base every statement on the analyze_file result."
TOOLS = [{"name": "analyze_file", "description": "Return the CI platform's analysis of one file in the pull request.",
          "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}]

def analyze(path, mode):
    """The tool wrapper your pipeline owns. Only its output size differs between the two runs."""
    r = subprocess.run([sys.executable, "-B", str(HERE / "tools" / "file_analysis.py"), path, f"--{mode}"],
                       cwd=HERE / "repo", capture_output=True, text=True, encoding="utf-8")
    return r.stdout.strip()

def review(client, model, mode, max_turns):
    emit(""); emit(f"=== Run with the {mode} tool wrapper")
    messages = [{"role": "user", "content": ASK}]
    calls, reply, cost, payload, tokens_after = [], "", 0.0, 0, None
    for n in range(1, max_turns + 1):
        emit(f"Turn {n}: sending the conversation to Claude")
        r = client.messages.create(model=model, max_tokens=300, system=SYSTEM, tools=TOOLS, messages=messages)
        cost += r.cost_usd or 0
        emit(f"  input tokens Claude read this turn: {r.usage.total_input_tokens:,}")
        if n > 1 and tokens_after is None: tokens_after = r.usage.total_input_tokens
        uses = [b for b in r.content if b.type == "tool_use"]
        text = " ".join(b.text for b in r.content if b.type == "text").strip()
        if not uses:
            reply = text; emit(f"  claude: {simkit.short(text, 200)}")
            emit("  -> STOP: no tool_use, so the review is done"); break
        u = uses[0]; result = analyze(u.input.get("path", FILE), mode); payload = len(result.encode("utf-8"))
        calls.append({"tool": "analyze_file", "input": u.input, "tool_use_id": u.id, "payload_bytes": payload})
        emit(f"  -> CONTINUE: analyze_file({u.input.get('path', FILE)}) returned {payload:,} bytes ({mode})")
        messages += [{"role": "assistant", "content": r.content},
                     {"role": "user", "content": [{"type": "tool_result", "tool_use_id": u.id, "content": result}]}]
    else:
        emit(f"  LOOP GUARD: stopped after {max_turns} turns.")
    return {"mode": mode, "turns": n, "payload_bytes": payload, "input_tokens_after_tool": tokens_after,
            "tool_calls": calls, "reply": reply, "cost_usd": round(cost, 4)}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-turns", type=int, default=3, help="hard cap on loop turns in each run (default 3)")
    a = ap.parse_args(); max_turns = max(2, min(a.max_turns, 6))
    model = simkit.MODEL; client = simkit.Anthropic(); began = time.time()
    emit(f"Extra practice · tool-result payload size · model {model} · at most {max_turns} turns per run")
    v = review(client, model, "verbose", max_turns)
    c = review(client, model, "compact", max_turns)
    tv, tc = v["input_tokens_after_tool"] or 0, c["input_tokens_after_tool"] or 0
    checks = [
        {"check": f"compact payload is under 5% of verbose ({c['payload_bytes']:,} vs {v['payload_bytes']:,} bytes)",
         "pass": 0 < c["payload_bytes"] < 0.05 * max(v["payload_bytes"], 1)},
        {"check": f"Claude read far fewer input tokens after the compact result ({tc:,} vs {tv:,})", "pass": 0 < tc < tv},
        {"check": "both runs produced a review", "pass": bool(v["reply"]) and bool(c["reply"])},
        {"check": "the compact review still names the changed functions", "pass": any(f in c["reply"] for f in ("total_qty", "low_stock"))}]
    out = {"lab": 52, "model": model, "message": ASK, "max_turns": max_turns,
           "tool_calls": v["tool_calls"] + c["tool_calls"], "reply": c["reply"], "runs": [v, c], "checks": checks,
           "cost_usd": round(v["cost_usd"] + c["cost_usd"], 4), "seconds": round(time.time() - began, 1)}
    EVID.parent.mkdir(parents=True, exist_ok=True); EVID.write_text(json.dumps(out, indent=1), encoding="utf-8")
    emit(""); emit(f"done: verbose {v['payload_bytes']:,} bytes -> {tv:,} input tokens; compact {c['payload_bytes']:,} bytes -> {tc:,} input tokens. cost ${out['cost_usd']}")
    emit(f"  verbose review: {simkit.short(v['reply'], 150)}"); emit(f"  compact review: {simkit.short(c['reply'], 150)}")
    for x in checks: emit(f"  {'PASS' if x['pass'] else 'FAIL'}  {x['check']}")
    sys.exit(0 if all(x["pass"] for x in checks) else 1)

if __name__ == "__main__":
    main()
