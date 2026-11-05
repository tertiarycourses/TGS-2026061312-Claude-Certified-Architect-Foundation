#!/usr/bin/env python3
"""Acceptance checks for Simulator 2. Reads evidence/run.json written by simulator.py."""
import json, re, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
WS = HERE / "workspace"
run = json.loads((HERE / "evidence" / "run.json").read_text())
S = run["steps"]
s1, s2, s3, s4, s5 = (S.get(k, {}) for k in "12345")
rules = s1.get("rules_by_file", {})
test_rules = set(rules.get("src/components/Button.test.tsx", {}).get("loaded", []))
api_rules = set(rules.get("src/api/orders.js", {}).get("loaded", []))
skill = (WS / ".claude/skills/codebase-map/SKILL.md").read_text()
cmd = (WS / ".claude/commands/review.md").read_text()
checks = [
    ("CLAUDE.md @imports resolve and Claude quoted the imported testing standard",
     len(s1.get("imports_resolved", [])) == 2 and "regression test" in (s1.get("claude_md_quote") or "")),
    ("editing a *.test.* file loads tests.md (path-scoped rule)", "tests.md" in test_rules),
    ("api handler loads api-handlers.md and not the test rule", "api-handlers.md" in api_rules and "tests.md" not in api_rules),
    ("/review slash command ran non-interactively and ended with a VERDICT", s2.get("review", {}).get("verdict") in ("approve", "request-changes")),
    ("codebase-map skill (context: fork, read-only) summarised src/api", s2.get("codebase_map", {}).get("mentions_orders_handler") is True),
    ("skill and command frontmatter: context: fork, allowed-tools without Write, argument-hint",
     "context: fork" in skill and "argument-hint" in skill and "Write" not in re.search(r"allowed-tools:(.*)", skill).group(1) and "argument-hint" in cmd),
    ("plan mode on the 47-file migration produced a plan and changed no files",
     s3.get("runs", {}).get("T2", {}).get("files_changed") == [] and len(s3.get("runs", {}).get("T2", {}).get("plan_excerpt", "")) > 200),
    ("direct execution fixed the one-file bug and added its regression test",
     any(f.endswith("formatDate.js") for f in s3.get("runs", {}).get("T1", {}).get("files_changed", [])) and "null" in s3.get("runs", {}).get("T1", {}).get("fixed_source", "").lower() or "?." in s3.get("runs", {}).get("T1", {}).get("fixed_source", "")),
    ("the real workspace was not modified by step 3", s3.get("workspace_modified") is False),
    ("--resume keeps the session id; --fork-session mints a new one", s4.get("resume_kept_id") is True and s4.get("fork_new_id") is True),
    ("project .mcp.json uses ${ENV} placeholders and holds no literal secret",
     s5.get("placeholders") and not s5.get("literal_secrets")),
    ("user-scope servers stay out of the shared project file", bool(s5.get("user_servers")) and not set(s5.get("user_servers", [])) & set(s5.get("project_servers", []))),
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
(HERE / "evidence" / "verification.txt").write_text("\n".join(f"{'PASS' if p else 'FAIL'} - {n}" for n, p in checks) + f"\nmodel: {run['model']}  cost_usd: {run['cost_usd']}\n")
sys.exit(0 if ok else 1)
