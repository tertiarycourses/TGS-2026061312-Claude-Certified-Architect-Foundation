#!/usr/bin/env python3
"""Simulator 5 - Claude Code for Continuous Integration.

Runs the real CI contract against pull request 418 in repo/ with the Claude
Code CLI in non-interactive mode:

  per-file passes    claude -p --output-format json --json-schema finding.schema.json
                     with explicit criteria and few-shot examples, one call per
                     changed file
  integration pass   one call over all four files for cross-file issues
  re-run with prior  prior findings in context; report only new/unaddressed
  test generation    existing tests in context so no duplicate scenarios
  API routing        deterministic: synchronous vs Message Batches per workload
  severity gate      exit 1 while any critical or high finding remains

Usage:  uv run ci_review.py [--skip-tests] [--gate-only]
Requires: Claude Code installed and logged in. Model from $LAB_MODEL
(default claude-opus-5-5). A full run makes 7 calls, roughly US$3.
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import jsonschema

HERE = Path(__file__).resolve().parent
REPO = HERE / "repo"
EV = HERE / "evidence"
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
SCHEMA = json.loads((HERE / "finding.schema.json").read_text())
CRITERIA = (HERE / "prompts" / "review-criteria.txt").read_text()
CHANGES = json.loads((HERE / "fixtures" / "changes.json").read_text())
WORKLOADS = json.loads((HERE / "fixtures" / "workloads.json").read_text())
TEST_SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["proposed", "skipped_as_duplicate"],
    "properties": {
        "proposed": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                     "required": ["test_name", "target", "scenario"],
                     "properties": {"test_name": {"type": "string"}, "target": {"type": "string"}, "scenario": {"type": "string"}}}},
        "skipped_as_duplicate": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                                 "required": ["existing_test", "scenario"],
                                 "properties": {"existing_test": {"type": "string"}, "scenario": {"type": "string"}}}},
    },
}
COST = {"usd": 0.0, "calls": 0}


def claude(prompt, schema, tools=("Read", "Grep", "Glob"), max_turns=6):
    """claude -p in CI mode: no keyboard, JSON envelope, schema-enforced output."""
    cmd = ["claude", "-p", prompt, "--model", MODEL, "--output-format", "json",
           "--json-schema", json.dumps(schema), "--permission-mode", "dontAsk",
           "--allowedTools", *tools, "--max-turns", str(max_turns)]
    t0 = time.time()
    proc = simkit.run_cli(cmd, cwd=REPO)
    if not proc.stdout.strip():
        raise SystemExit(f"claude produced no output ({proc.returncode}): {proc.stderr[-600:]}")
    env = json.loads(proc.stdout)
    COST["usd"] += env.get("total_cost_usd") or 0
    COST["calls"] += 1
    out = env.get("structured_output")
    if out is None:  # schema not honoured: fall back to the text result
        out = json.loads(env.get("result") or "{}")
    jsonschema.validate(out, schema)
    return out, {"session_id": env.get("session_id"), "cost_usd": env.get("total_cost_usd"),
                 "num_turns": env.get("num_turns"), "elapsed_s": round(time.time() - t0, 1)}


def diff_text(f):
    return "\n".join(f"  {f['path']}:{d['line']}  {d['code']}" for d in f["diff"])


def per_file_pass(f, prior=None):
    prior_txt = ""
    if prior:
        prior_txt = ("\nPRIOR FINDINGS already posted on this PR (do NOT repeat them; report only NEW or "
                     "still-unaddressed issues on OTHER lines/patterns):\n" + json.dumps(prior, indent=1) + "\n")
    prompt = (f"CI review of pull request {CHANGES['pr']}, per-file pass for {f['path']}.\n"
              f"Read {f['path']} in full. The lines changed by this PR are:\n{diff_text(f)}\n\n"
              f"{CRITERIA}\n{prior_txt}\n"
              "Review ONLY the changed lines of this one file in isolation (cross-file issues belong to the "
              "integration pass). Set pass to \"per-file\". Use the exact line numbers above. "
              "Return an empty findings array when nothing qualifies.")
    return claude(prompt, SCHEMA)


def integration_pass(files):
    listing = "\n".join(diff_text(f) for f in files)
    prompt = (f"CI review of pull request {CHANGES['pr']}, INTEGRATION pass.\n"
              f"Read every changed file: {', '.join(f['path'] for f in files)}. Changed lines:\n{listing}\n\n"
              f"{CRITERIA}\n\n"
              "Report ONLY cross-file issues: a changed signature whose callers were not updated, data flow "
              "between modules, shared state. Do not repeat single-file findings. Set pass to \"integration\". "
              "Anchor each finding on the caller's file and line.")
    return claude(prompt, SCHEMA)


def propose_tests(files):
    changed = ", ".join(f"{f['path']} (lines {', '.join(str(d['line']) for d in f['diff'])})" for f in files)
    prompt = (f"Test generation for pull request {CHANGES['pr']}. Read CLAUDE.md for the testing standards and "
              f"fixture names, then read tests/ and the changed files: {changed}.\n"
              f"Existing tests: {', '.join(CHANGES['existing_tests'])}.\n"
              "Propose NEW pytest cases for the changed public functions only. A scenario that an existing test "
              "already covers goes in skipped_as_duplicate with that test's id, never in proposed. "
              "Do not propose tests for logging or private helpers. Keep each proposal to one sentence.")
    return claude(prompt, TEST_SCHEMA)


def approval_gate():
    """Result of the PreToolUse command-hook sub-lab (hook_gate.py), if it has run."""
    p = EV / "hook_gate.json"
    if not p.exists():
        return {"status": "not run", "how": "uv run hook_gate.py"}
    g = json.loads(p.read_text())
    s1, s2 = g["scenarios"]
    return {"status": "holds" if (s1["denied"] and not s1["approval_posted"] and s2["approval_posted"]) else "FAILED",
            "hook": g["hook_semantics"]["script"], "denied_without_artifact": s1["denied"],
            "approved_with_artifact": s2["approval_posted"]}


def route(w):
    if w["blocking"] or w["latency_tolerance_hours"] < 24:
        return "synchronous Messages API (developer waits; Batches has no latency SLA)"
    return "Message Batches API (50% cheaper, up to 24 h, correlate by custom_id, resubmit failures by custom_id)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-tests", action="store_true", help="skip the test-generation call")
    args = ap.parse_args()
    EV.mkdir(exist_ok=True)
    files = CHANGES["files"]
    runs = {}

    print("== per-file passes")
    per_file = []
    for f in files:
        out, meta = per_file_pass(f)
        name = Path(f["path"]).name
        (EV / f"review-{name}.json").write_text(json.dumps(out, indent=2))
        runs[f"per-file:{f['path']}"] = meta
        per_file += out["findings"]
        print(f"   {f['path']}: {len(out['findings'])} finding(s)  ${meta['cost_usd']:.2f}")

    print("== integration pass")
    integ, meta = integration_pass(files)
    (EV / "review-integration.json").write_text(json.dumps(integ, indent=2))
    runs["integration"] = meta
    print(f"   {len(integ['findings'])} cross-file finding(s)  ${meta['cost_usd']:.2f}")

    print("== re-run on repository.py with prior findings in context")
    prior = CHANGES["prior_findings"]
    rep = next(f for f in files if f["path"] == "stock/repository.py")
    rerun, meta = per_file_pass(rep, prior=prior)
    (EV / "review-repository.py.rerun.json").write_text(json.dumps(rerun, indent=2))
    runs["rerun-with-prior"] = meta
    prior_keys = {(p["file"], p["line"]) for p in prior}
    repeated = [x for x in rerun["findings"] if (x["file"], x["line"]) in prior_keys]
    print(f"   first run: {sum(1 for x in per_file if x['file'] == rep['path'])} finding(s); "
          f"re-run with prior: {len(rerun['findings'])} finding(s), {len(repeated)} repeated prior")

    tests = {"proposed": [], "skipped_as_duplicate": []}
    if not args.skip_tests:
        print("== test generation with existing tests in context")
        tests, meta = propose_tests(files)
        runs["test-generation"] = meta
        print(f"   proposed {len(tests['proposed'])}, skipped as duplicate {len(tests['skipped_as_duplicate'])}")

    routing = [{"workload": w["workload"], "api": route(w)} for w in WORKLOADS]
    severe = [x for x in per_file + integ["findings"] if x["severity"] in ("critical", "high")]
    gate = {"blocking_findings": len(severe), "exit_code": 1 if severe else 0}
    summary = {
        "pr": CHANGES["pr"], "model": MODEL,
        "cli_flags": ["-p", "--output-format json", "--json-schema", "--permission-mode dontAsk", "--allowedTools", "--max-turns"],
        "per_file_findings": per_file, "integration_findings": integ["findings"],
        "rerun_with_prior": {"prior": prior, "findings": rerun["findings"], "repeated_prior": repeated},
        "test_proposals": tests, "api_routing": routing, "gate": gate,
        "runs": runs, "cost_usd": round(COST["usd"], 4), "calls": COST["calls"],
        "approval_gate": approval_gate(),
    }
    (EV / "review.json").write_text(json.dumps(summary, indent=2))
    print("== routing:", "; ".join(f"{r['workload']} -> {r['api'].split(' (')[0]}" for r in routing))
    print(f"== gate: {len(severe)} blocking finding(s) -> exit {gate['exit_code']}   cost US${COST['usd']:.2f} over {COST['calls']} calls")
    sys.exit(gate["exit_code"])


if __name__ == "__main__":
    if sys.argv[1:2] == ["--case"]:  # uv run ci_review.py --case UC-3  -> use-case runner
        sys.exit(subprocess.call([sys.executable, "-B", str(HERE / "casekit.py"), "--case", *sys.argv[2:3]]))
    main()
