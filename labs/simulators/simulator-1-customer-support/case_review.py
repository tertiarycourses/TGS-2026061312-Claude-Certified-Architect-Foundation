#!/usr/bin/env python3
"""Run the project's /case-review skill through the Agent SDK. Usage: uv run case_review.py CS-02"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
case = sys.argv[1] if len(sys.argv) > 1 else "CS-02"
r = simkit.run_agent(f"/case-review {case}", cwd=HERE, max_turns=8, mode="dontAsk", tools=["Read", "Grep", "Skill", "Agent"])
print(r["result"] or "")
(HERE / "evidence" / f"case-review-{case}.txt").write_text(r["result"] or "")
sys.exit(1 if r["is_error"] else 0)
