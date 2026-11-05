#!/usr/bin/env python3
"""Acceptance checks for Simulator 5. Reads the evidence written by ci_review.py (run it first)."""
import json, sys
from pathlib import Path
import jsonschema
HERE = Path(__file__).resolve().parent
EV = HERE / "evidence"
schema = json.loads((HERE / "finding.schema.json").read_text())
r = json.loads((EV / "review.json").read_text())
cmd = (HERE / "prompts" / "claude-command.txt").read_text()
valid = True
for p in sorted(EV.glob("review-*.json")):
    try:
        jsonschema.validate(json.loads(p.read_text()), schema)
    except jsonschema.ValidationError as e:
        valid = False; print("   schema error in", p.name, e.message)
pf, integ = r["per_file_findings"], r["integration_findings"]
rerun = r["rerun_with_prior"]
sql = [f for f in pf if f["file"] == "stock/repository.py" and f["line"] == 11]
obo = [f for f in pf if f["file"] == "stock/totals.py" and f["line"] == 10]
style_lines = {("stock/repository.py", 2), ("stock/repository.py", 3), ("stock/totals.py", 12), ("stock/jobs.py", 14)}
checks = [
    ("documented command uses -p, --output-format json and --json-schema", all(s in cmd for s in ("claude -p", "--output-format json", "--json-schema"))),
    ("pipeline passed the same flags to the real CLI", {"-p", "--output-format json", "--json-schema"} <= set(r["cli_flags"])),
    ("every per-file and integration output validates against finding.schema.json", valid),
    ("f-string SQL reported as critical security with a detected_pattern", any(f["severity"] == "critical" and f["category"] == "security" and f["detected_pattern"] for f in sql)),
    ("off-by-one loop reported as a bug (high) on totals.py:10", any(f["category"] == "bug" and f["severity"] in ("high", "critical") for f in obo)),
    ("style-only imports and established logging lines produce no findings", not any((f["file"], f["line"]) in style_lines for f in pf + integ)),
    ("re-run with prior findings in context does not repeat the SQL finding", len(rerun["repeated_prior"]) == 0 and any(p["detected_pattern"] == "f-string SQL" for p in rerun["prior"])),
    ("integration pass catches the get_stock arity mismatch in jobs.py", any(f["file"] == "stock/jobs.py" and f["category"] in ("contract", "bug") for f in integ)),
    ("test proposals skip the scenario test_total_counts_all_items already covers",
     any("test_total_counts_all_items" in d["existing_test"] for d in r["test_proposals"]["skipped_as_duplicate"]) and not any("all items" in p["scenario"].lower() and "total" in p["target"].lower() for p in r["test_proposals"]["proposed"])),
    ("pre-merge -> synchronous API, overnight and weekly jobs -> Message Batches API", r["api_routing"][0]["api"].startswith("synchronous") and all(x["api"].startswith("Message Batches") for x in r["api_routing"][1:])),
    ("review criteria hold 2-4 few-shot examples", 2 <= (HERE / "prompts" / "review-criteria.txt").read_text().count("Example ") <= 4),
    ("severity gate fails the job while critical/high findings remain", r["gate"]["exit_code"] == 1 and r["gate"]["blocking_findings"] >= 2),
]

# ---- approval gate sub-lab (hook_gate.py)
_hg = EV / "hook_gate.json"
_g = json.loads(_hg.read_text()) if _hg.exists() else None
_s = _g["scenarios"] if _g else [{}, {}]
checks += [
    ("hook_gate.py has run (PreToolUse command hook in repo/.claude/settings.json)", _g is not None),
    ("approval denied with the hook's stderr reason while the artifact is missing", bool(_s[0].get("denied")) and not _s[0].get("approval_posted")),
    ("approval posted once ./ci/run_tests.sh wrote the passing artifact", bool(_s[1].get("approval_posted")) and not _s[1].get("denied")),
    ("hook script exits 2 on the deny path (block + feedback semantics)", (HERE / "repo/hooks/require-passing-tests.sh").read_text().count("exit 2") >= 2),
]
# ---- use cases from the practice test (evidence/cases/UC-*.json written by casekit.py)
import glob as _glob
_case_files = sorted(_glob.glob(str(HERE / "evidence" / "cases" / "UC-*.json")))
_expected = sorted(p.stem for p in (HERE / "cases").glob("UC-*.json"))
_case_results = {}
for _cf in _case_files:
    _c = json.loads(Path(_cf).read_text())
    _case_results[_c["id"]] = all(r["pass"] for r in _c["evaluation"])
checks.append(("every practice-test use case has been run (%d/%d)" % (len(_case_results), len(_expected)), len(_case_results) == len(_expected)))
for _cid in _expected:
    checks.append((f"{_cid} rubric passes", _case_results.get(_cid, False)))
ok = True
for n, p in checks:
    print(("PASS" if p else "FAIL"), "-", n); ok &= bool(p)
(EV / "verification.txt").write_text("\n".join(f"{'PASS' if p else 'FAIL'} - {n}" for n, p in checks) + f"\nmodel: {r['model']}  calls: {r['calls']}  cost_usd: {r['cost_usd']}\n")
sys.exit(0 if ok else 1)
