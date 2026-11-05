#!/usr/bin/env python3
"""Acceptance checks for Simulator 3 against the evidence of a real run.

Run research_system.py first (and optionally --narrow); then:  uv run verify.py
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EV = HERE / "evidence"
run = json.loads((EV / "run.json").read_text())
report = (EV / "report.md").read_text()
narrow_path = EV / "run-narrow.json"
narrow = json.loads(narrow_path.read_text()) if narrow_path.exists() else None
rl = report.lower()

tool_calls = run["tool_calls"]
queries = " ".join(c.get("query", "") for c in tool_calls if c["tool"] == "search_web").lower()
sectors_hit = [s for s in ("music", "writ", "film") if s in queries]

checks = [
    ("coordinator may spawn subagents (Agent/Task in allowed tools)",
     "Agent" in run["coordinator"]["allowed_tools"]),
    ("four subagents, each holding at most one scoped tool",
     set(run["agents"]) == {"web-search", "document-analysis", "synthesis", "report"}
     and all(len(a["tools"]) <= 1 for a in run["agents"].values())),
    ("parallel delegation: >=3 Agent calls in ONE coordinator response",
     run["max_parallel_spawns"] >= 3),
    ("broad decomposition: web searches covered music, writing and film",
     len(sectors_hit) == 3),
    ("context packets are explicit prompts (>=120 chars each)",
     all(p["prompt_chars"] >= 120 for t in run["assistant_turns"] for p in t["packets"])),
    ("subagent traffic observed via parent_tool_use_id", run["subagent_messages"] > 0),
    ("visual-arts timeout surfaced as a structured error with the four fields",
     any(all(k in e for k in ("failure_type", "attempted_query", "partial_results", "alternatives"))
         for e in run["structured_errors"])),
    ("run completed despite the failure and the report names the gap",
     run["result"]["subtype"] == "success" and "coverage gap" in rl and "visual" in rl),
    ("conflicting SME adoption figures (41% and 55%) both survive with sources",
     "41%" in report and "55%" in report and "wipo" in rl and "unesco" in rl),
    ("statistics carry publication dates (YYYY-MM-DD) in the report",
     len(re.findall(r"20\d\d-\d\d-\d\d", report)) >= 4),
    ("established and contested findings are separated",
     "contested" in rl and "established" in rl),
    ("synthesis used the scoped verify_fact tool",
     any(c["tool"] == "verify_fact" for c in tool_calls)),
]
rs_path = EV / "rules_sim.json"
if rs_path.exists():
    rs = json.loads(rs_path.read_text())["variants"]
    tok = lambda v, k: rs[v]["runs"][k]["token_seen"]
    checks += [
        ("rules_sim D: path-scoped rule loads for the test edit only, one copy",
         tok("D", "test") and not tok("D", "impl") and rs["D"]["guidance_copies"] == 1),
        ("rules_sim A and B: rule without frontmatter and root CLAUDE.md load on both edits",
         all(tok(v, k) for v in "AB" for k in ("test", "impl"))),
        ("rules_sim C: per-folder CLAUDE.md needs one copy per folder (3) and loads for the impl edit",
         rs["C"]["guidance_copies"] == 3 and tok("C", "impl")),
    ]
if narrow:
    nq = " ".join(c.get("query", "") for c in narrow["tool_calls"] if c["tool"] == "search_web").lower()
    checks.append(("narrow decomposition reproduces the exam failure: music/writing/film never searched",
                   not any(s in nq for s in ("music", "writ", "film"))))

ok = True
lines = []
for name, passed in checks:
    lines.append(f"{'PASS' if passed else 'FAIL'} - {name}")
    ok &= bool(passed)
print("\n".join(lines))
print(f"\nrun cost: ${run['result']['total_cost_usd']:.4f}" + (f"  narrow: ${narrow['result']['total_cost_usd']:.4f}" if narrow else ""))

# ---- use-case summary (optional; produced by --case)
cases_dir = EV / "cases"
if cases_dir.exists():
    print("\nuse cases:")
    for cp in sorted(cases_dir.glob("UC-*.json")):
        c = json.loads(cp.read_text())
        res = c["rubric"]
        n_pass = sum(1 for r in res if r["passed"]); n_disc = sum(1 for r in res if r["passed"] is None)
        tag = "discussion" if n_disc == len(res) else ("PASS" if n_pass == len(res) else "FAIL")
        print(f"  {tag:10s} {c['id']}  {c['title']}  ({n_pass}/{len(res)})")
        lines.append(f"{tag} - {c['id']} {c['title']} ({n_pass}/{len(res)})")
        if tag == "FAIL":
            ok = False
(EV / "verification.txt").write_text("\n".join(lines) + "\n")
sys.exit(0 if ok else 1)
