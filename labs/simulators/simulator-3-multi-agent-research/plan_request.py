#!/usr/bin/env python3
"""Lab 17, live: two linked defects, asked as two separate requests, then as one detailed plan-mode request.

Usage: uv run plan_request.py [--max-turns 15]

report-repo/ is a small report pipeline with both defects from the question: citations render twice, and
evidence excerpts disappear between the synthesis subagent and the report. Claude Code runs in plan mode
(read-only) three times:
  Run 1a  "citations render twice": plan a fix
  Run 1b  "excerpts disappear": plan a fix
  Run 2   one request with both defects, the shared claim-source interface, and the acceptance test
You see which files each plan touches and whether it ends with a test. Every run stops at --max-turns.
Evidence: evidence/plan_request.json
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit
import argparse, hashlib, json, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE / "report-repo"
EVID = HERE / "evidence" / "plan_request.json"
emit = simkit.emit
FILES = {"schema": "schema.py", "synthesis prompt": "synthesis_prompt.md", "report template": "render.py"}
ASKS = {
    "1a": "Citations render twice in the final report. Plan a fix.",
    "1b": "Some evidence excerpts disappear from the final report. Plan a fix.",
    "2": ("Two linked defects since the claim-source refactor: citations render twice in the final report, and evidence excerpts "
          "disappear when the synthesis subagent's output reaches the report generator. The cause likely spans the claim-source "
          "schema (report/schema.py), the synthesis prompt (report/synthesis_prompt.md) and the report template (report/render.py). "
          "Plan one fix for both, agree the shared interface between those three, and finish with an acceptance test that "
          "checks each claim appears once, with its excerpt and exactly one citation."),
}

def tree_hash():
    h = hashlib.sha1()
    for p in sorted(REPO.rglob("*")):
        if p.is_file() and "__pycache__" not in p.parts: h.update(p.read_bytes())
    return h.hexdigest()

def bug_demo():
    sys.path.insert(0, str(REPO))
    from report.render import render
    item = {"claim": "Completion rose to 72% [S3]", "source_id": "S3", "excerpt": "72% of the cohort completed."}
    return render([item])

def plan(key, max_turns):
    emit(""); emit(f"=== Run {key} · {'one detailed request' if key == '2' else 'a separate request'}")
    emit(f"  request: {simkit.short(ASKS[key], 160)}")
    # Headless runs have nobody to approve a plan, so Claude gives the plan as its reply instead of submitting it.
    ask = ASKS[key] + " Give the plan as your final reply; don't save or submit it."
    r = simkit.run_agent(ask, cwd=REPO, mode="plan", max_turns=max_turns, tools=["Read", "Grep", "Glob"],
                         disallowed=["Edit", "Write", "Bash", "NotebookEdit", "ExitPlanMode"])  # plan mode also blocks edits
    text = r.get("result") or ""
    touched = [k for k, f in FILES.items() if f in text]
    test = any(w in text.lower() for w in ("acceptance test", "test_", "tests/"))
    reads = [t for t in r.get("context", {}).get("main", {}).get("tool_calls", []) if t in ("Read", "Grep", "Glob")]
    emit(f"  plan touches: {', '.join(touched) or 'none of the three'}  ·  acceptance test: {'yes' if test else 'no'}  ·  {len(reads)} file reads/searches")
    return {"run": key, "request": ASKS[key], "plan": text, "touches": touched, "has_test": test, "reads": len(reads),
            "turns": r.get("num_turns"), "cost_usd": round(r.get("total_cost_usd") or 0, 4)}

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-turns", type=int, default=15, help="hard cap on agent turns in each run (default 15)")
    a = ap.parse_args(); max_turns = max(5, min(a.max_turns, 25)); began = time.time(); before = tree_hash()
    emit(f"Lab 17 · linked defects in one plan-mode request · model {simkit.MODEL} · at most {max_turns} turns per run")
    demo = bug_demo()
    emit("The bug, reproduced by render.py on one synthesis item:")
    for line in demo.rstrip("\n").splitlines(): emit(f"  | {line}")
    emit("  citation appears twice, and the excerpt line is empty")
    runs = [plan(k, max_turns) for k in ("1a", "1b", "2")]
    split = set(runs[0]["touches"]) | set(runs[1]["touches"]); one = runs[2]
    checks = [
        {"check": "the single detailed plan covers schema, synthesis prompt and report template", "pass": set(one["touches"]) == set(FILES)},
        {"check": "the single detailed plan ends in an acceptance test", "pass": one["has_test"]},
        {"check": f"separate requests: two sessions, {runs[0]['reads'] + runs[1]['reads']} reads/searches and ${runs[0]['cost_usd'] + runs[1]['cost_usd']:.4f}, "
                  f"vs {one['reads']} and ${one['cost_usd']:.4f} for the one detailed request; compare whether the two plans agree on the field name",
         "pass": None},
        {"check": "plan mode changed no files", "pass": tree_hash() == before}]
    out = {"lab": 35, "model": simkit.MODEL, "message": ASKS["2"], "bug_demo": demo, "runs": runs, "split_touches": sorted(split),
           "tool_calls": [], "reply": one["plan"], "checks": checks,
           "cost_usd": round(sum(r["cost_usd"] for r in runs), 4), "seconds": round(time.time() - began, 1)}
    EVID.parent.mkdir(parents=True, exist_ok=True); EVID.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    emit(""); emit(f"done: separate plans touched {', '.join(sorted(split)) or 'nothing'}; the detailed plan touched {', '.join(one['touches'])} "
                   f"{'with' if one['has_test'] else 'without'} an acceptance test. cost ${out['cost_usd']}")
    emit(f"  detailed plan: {simkit.short(one['plan'], 300)}")
    for c in checks: emit(f"  {'PASS' if c['pass'] else ('INFO' if c['pass'] is None else 'FAIL')}  {c['check']}")
    sys.exit(0 if all(c["pass"] is not False for c in checks) else 1)

if __name__ == "__main__":
    main()
