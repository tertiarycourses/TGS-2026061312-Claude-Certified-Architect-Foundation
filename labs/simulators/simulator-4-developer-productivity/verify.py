#!/usr/bin/env python3
"""Acceptance checks for Simulator 4 against the evidence of a real run.

Run explorer.py first; then:  uv run verify.py
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EV = HERE / "evidence"
log = [json.loads(l) for l in (EV / "tool_log.jsonl").read_text().splitlines() if l.strip()]
sessions = json.loads((EV / "sessions.json").read_text())
phases = {p: json.loads((EV / f"{p}.json").read_text()) for p in ("explore", "edit", "fork-a", "fork-b", "recover") if (EV / f"{p}.json").exists()}
explore_log = [r for r in log if r["phase"] == "explore"]
edit_log = [r for r in log if r["phase"] == "edit"]
recover_log = [r for r in log if r["phase"] == "recover"]
patched = (EV / "patched-invoice.py.txt").read_text()
scratch = (EV / "scratchpad.md").read_text()


def first_index(records, tool):
    return next((i for i, r in enumerate(records) if r["tool"] == tool), None)


def tests_pass():
    """Apply the captured patch to a clean copy of sample_repo and run pytest there."""
    import shutil, tempfile
    tmp = Path(tempfile.mkdtemp(prefix="lab04-verify-"))
    shutil.copytree(HERE / "sample_repo", tmp / "repo")
    (tmp / "repo" / "src" / "billing" / "invoice.py").write_text(patched)
    r = subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=tmp / "repo", capture_output=True, text=True)
    shutil.rmtree(tmp, ignore_errors=True)
    return r.returncode == 0


g, rd = first_index(explore_log, "Grep"), first_index(explore_log, "Read")
checks = [
    ("explore: catalogue consulted before any file read",
     (first_index(explore_log, "mcp__orderly-docs__list_catalog") or 0) < (rd if rd is not None else 10**6)),
    ("explore: a Grep ran before the first main-agent Read",
     g is not None and (rd is None or g < rd)),
    ("explore: discovery delegated to the explore subagent", phases["explore"]["spawned_subagents"] >= 1
     and any(r["agent"] not in ("main", None) for r in explore_log)),
    ("explore: scratchpad records calculate_total and a caller",
     "calculate_total" in scratch and "report.py" in scratch),
    ("explore: no file in the pristine sample_repo changed",
     (HERE / "sample_repo" / "src" / "billing" / "invoice.py").read_text().count("quantize") == 0),
    ("edit: same session resumed (edit session id == explore session id)",
     sessions.get("edit") == sessions.get("explore")),
    ("edit: Edit attempted, and a non-unique-anchor failure or Write fallback is visible",
     any(r["tool"] == "Edit" for r in edit_log) and
     (any(r["tool"] == "Edit" and r.get("error") for r in edit_log) or any(r["tool"] == "Write" for r in edit_log)
      or any(r["tool"] == "Edit" and not r.get("error") for r in edit_log))),
    ("edit: patched calculate_total quantizes to 2 dp", "quantize" in patched and "0.01" in patched),
    ("edit: pytest passes on the patched work copy", tests_pass()),
    ("hooks: every tool call was logged by the PostToolUse hook", len(log) >= 8),
    ("fork: two forks with new session ids, original unchanged",
     len({sessions.get("fork-a"), sessions.get("fork-b")} - {None, sessions.get("explore")}) == 2),
    ("recover: fresh session continued from the manifest without Grep or subagents",
     sessions.get("recover") not in (None, sessions.get("explore")) and
     not any(r["tool"] == "Grep" for r in recover_log) and phases["recover"]["spawned_subagents"] == 0),
]
ok = True
lines = []
for name, passed in checks:
    lines.append(f"{'PASS' if passed else 'FAIL'} - {name}")
    ok &= bool(passed)
print("\n".join(lines))
print("\nreported total_cost_usd per phase (a resumed or forked session reports its cumulative cost):")
for name, p in phases.items():
    print(f"  {name:8s} ${(p.get('total_cost_usd') or 0):.4f}")

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
