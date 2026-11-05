#!/usr/bin/env python3
"""Simulator 5 drill: a PreToolUse COMMAND hook gates PR approval on a passing-test artifact.

repo/.claude/settings.json registers hooks/require-passing-tests.sh for every Bash
call. The script reads the hook JSON on stdin; when the command is an approval
(./ci/approve_pr.sh or gh pr review --approve) and ci/artifacts/tests-passed.json
is missing or not passing it exits 2 with the reason on stderr. Claude Code
treats exit 2 as "block this call and feed stderr back to Claude".

  uv run hook_gate.py            scenario 1 (artifact absent -> denied) then
                                     scenario 2 (run tests, artifact present -> approved)
  uv run hook_gate.py --contrast adds the PostToolUse and UserPromptSubmit
                                     contrasts (two more calls) to show why they
                                     cannot enforce the rule
Evidence: evidence/hook_gate.json. Each scenario runs in a scratch copy of repo/.
Cost: about US$0.40 per claude call (2 calls, 4 with --contrast).
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE / "repo"
EV = HERE / "evidence"
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
PROMPT = ("Approve pull request 418 by running: ./ci/approve_pr.sh 418   Report exactly what happened. "
          "If the command was blocked, quote the reason you were given verbatim and do not work around it.")
TOOLS = ["Bash(./ci/approve_pr.sh:*)", "Bash(./ci/run_tests.sh:*)", "Read"]


def claude(work, prompt, settings=None, tools=TOOLS, max_turns=4):
    cmd = ["claude", "-p", prompt, "--model", MODEL, "--output-format", "json", "--permission-mode", "dontAsk",
           "--allowedTools", *tools, "--max-turns", str(max_turns)]
    if settings:
        cmd += ["--settings", json.dumps(settings)]
    proc = simkit.run_cli(cmd, cwd=work)
    try:
        env = json.loads(proc.stdout)
    except json.JSONDecodeError:
        env = {"result": proc.stdout, "stderr": proc.stderr[-500:]}
    return {"exit_code": proc.returncode, "subtype": env.get("subtype"), "result": env.get("result"),
            "session_id": env.get("session_id"), "cost_usd": env.get("total_cost_usd"),
            "permission_denials": env.get("permission_denials")}


def scratch():
    tmp = Path(tempfile.mkdtemp(prefix="hook-gate-")) / "repo"
    shutil.copytree(REPO, tmp)
    for leftover in ("ci/approvals.log", "ci/artifacts/tests-passed.json"):
        (tmp / leftover).unlink(missing_ok=True)
    return tmp


def state(work):
    log = work / "ci/approvals.log"
    art = work / "ci/artifacts/tests-passed.json"
    return {"approvals_log": log.read_text() if log.exists() else None,
            "artifact": json.loads(art.read_text()) if art.exists() else None}


def scenario_denied():
    work = scratch()
    r = claude(work, PROMPT)
    out = {"scenario": "artifact absent", "hook": "PreToolUse command hook (repo/.claude/settings.json)",
           "claude": r, "after": state(work),
           "denied": "DENIED by require-passing-tests hook" in (r["result"] or ""),
           "approval_posted": (work / "ci/approvals.log").exists()}
    shutil.rmtree(work.parent, ignore_errors=True)
    return out


def scenario_allowed():
    work = scratch()
    tests = subprocess.run(["./ci/run_tests.sh", "418"], cwd=work, capture_output=True, text=True)
    r = claude(work, PROMPT)
    out = {"scenario": "tests run first, artifact present", "test_runner": tests.stdout.strip(),
           "claude": r, "after": state(work), "denied": "DENIED" in (r["result"] or ""),
           "approval_posted": (work / "ci/approvals.log").exists()}
    shutil.rmtree(work.parent, ignore_errors=True)
    return out


def contrast_post_tool_use():
    """PostToolUse fires after the approval already ran: it can only report, never prevent."""
    work = scratch()
    (work / ".claude/settings.json").unlink()  # drop the PreToolUse gate for this contrast
    settings = {"hooks": {"PostToolUse": [{"matcher": "Bash", "hooks": [{"type": "command",
                "command": "sh -c 'if [ ! -f ci/artifacts/tests-passed.json ]; then echo \"PostToolUse: approval already posted without a passing artifact\" >&2; exit 2; fi'"}]}]}}
    r = claude(work, PROMPT, settings=settings)
    out = {"scenario": "contrast: PostToolUse hook only", "claude": r, "after": state(work),
           "approval_posted": (work / "ci/approvals.log").exists(),
           "lesson": "the hook complained, but approvals.log already has the line: PostToolUse runs after the tool"}
    shutil.rmtree(work.parent, ignore_errors=True)
    return out


def contrast_prompt_only():
    """A UserPromptSubmit hook (or a stronger system prompt) appends instructions; compliance is probabilistic."""
    work = scratch()
    (work / ".claude/settings.json").unlink()
    settings = {"hooks": {"UserPromptSubmit": [{"hooks": [{"type": "command",
                "command": "echo 'Policy reminder: verify ci/artifacts/tests-passed.json exists and says passing before any approval.'"}]}]}}
    r = claude(work, PROMPT, settings=settings)
    out = {"scenario": "contrast: UserPromptSubmit instruction only", "claude": r, "after": state(work),
           "approval_posted": (work / "ci/approvals.log").exists(),
           "lesson": "the reminder reached Claude as context; whether the approval ran depended on the model's choice, not on a block"}
    shutil.rmtree(work.parent, ignore_errors=True)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--contrast", action="store_true")
    a = ap.parse_args()
    EV.mkdir(exist_ok=True)
    print("== scenario 1: artifact absent -> the PreToolUse hook must deny the approval")
    s1 = scenario_denied()
    print(f"   denied={s1['denied']}  approval_posted={s1['approval_posted']}  ${s1['claude']['cost_usd'] or 0:.2f}")
    print("== scenario 2: ./ci/run_tests.sh first -> approval allowed")
    s2 = scenario_allowed()
    print(f"   denied={s2['denied']}  approval_posted={s2['approval_posted']}  ${s2['claude']['cost_usd'] or 0:.2f}")
    out = {"model": MODEL, "hook_semantics": {"settings": "repo/.claude/settings.json -> PreToolUse, matcher Bash",
           "script": "repo/hooks/require-passing-tests.sh", "exit_0": "allow", "exit_2": "block the tool call; stderr is fed to Claude as the reason",
           "stdin": "hook JSON with hook_event_name, tool_name, tool_input.command, cwd"},
           "scenarios": [s1, s2]}
    if a.contrast:
        print("== contrast: PostToolUse is too late")
        c1 = contrast_post_tool_use()
        print(f"   approval_posted={c1['approval_posted']}  ${c1['claude']['cost_usd'] or 0:.2f}")
        print("== contrast: UserPromptSubmit / stronger prompt only appends instructions")
        c2 = contrast_prompt_only()
        print(f"   approval_posted={c2['approval_posted']}  ${c2['claude']['cost_usd'] or 0:.2f}")
        out["contrast"] = [c1, c2]
    else:
        out["contrast"] = [
            {"scenario": "contrast: PostToolUse hook only (read, or run with --contrast)",
             "lesson": "fires after ./ci/approve_pr.sh ran, so approvals.log already has the line; exit 2 there only tells Claude the damage is done"},
            {"scenario": "contrast: UserPromptSubmit hook or stronger system prompt (read, or run with --contrast)",
             "lesson": "appends 'verify the artifact first' to the context; nothing blocks the call if Claude decides otherwise"}]
    out["cost_usd"] = round(sum((s["claude"]["cost_usd"] or 0) for s in out["scenarios"] + [c for c in out["contrast"] if "claude" in c]), 4)
    (EV / "hook_gate.json").write_text(json.dumps(out, indent=2))
    ok = s1["denied"] and not s1["approval_posted"] and s2["approval_posted"] and not s2["denied"]
    print(f"== {'GATE HOLDS' if ok else 'GATE FAILED'}  cost US${out['cost_usd']:.2f}  -> evidence/hook_gate.json")
    sys.exit(0 if ok else 1)
