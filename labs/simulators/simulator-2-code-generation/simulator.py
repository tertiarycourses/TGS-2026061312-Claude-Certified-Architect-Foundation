#!/usr/bin/env python3
"""Simulator 2 - Code Generation with Claude Code.

Drives Claude Code's engine through the Agent SDK inside workspace/ to prove, with
evidence you can read back, how a team workspace behaves:

  step 1  CLAUDE.md + @import loading, and path-scoped rules that load only
          for matching files
  step 2  the project /review slash command and the forked codebase-map skill
  step 3  plan mode on a 47-file migration vs direct execution on a one-file
          bug (runs in a scratch copy, the workspace is never modified)
  step 4  --resume and --fork-session on a named investigation session
  step 5  .mcp.json environment expansion and the user-scope alternative

Usage:  uv run simulator.py            # every step
        uv run simulator.py 3          # one step
Requires: Claude Code installed and logged in. Model from $LAB_MODEL
(default claude-opus-5-5). A full run costs roughly US$3.
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
WS = HERE / "workspace"
EV = HERE / "evidence"
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
EV.mkdir(exist_ok=True)
RUN = EV / "run.json"
state = json.loads(RUN.read_text()) if RUN.exists() else {"model": MODEL, "steps": {}, "cost_usd": 0.0}


def claude(prompt, cwd, *, mode="dontAsk", tools=None, schema=None, resume=None,
           fork=False, name=None, max_turns=6, extra=()):
    """Run `claude -p` and return the parsed JSON result envelope."""
    cmd = ["claude", "-p", prompt, "--model", MODEL, "--output-format", "json",
           "--permission-mode", mode, "--max-turns", str(max_turns)]
    if tools:
        cmd += ["--allowedTools", *tools]
    if schema:
        cmd += ["--json-schema", json.dumps(schema)]
    if resume:
        cmd += ["--resume", resume]
    if fork:
        cmd += ["--fork-session"]
    if name:
        cmd += ["--name", name]
    cmd += list(extra)
    t0 = time.time()
    proc = simkit.run_cli(cmd, cwd=cwd)
    if proc.returncode != 0 and not proc.stdout.strip():
        raise SystemExit(f"claude failed ({proc.returncode}): {proc.stderr[-800:]}")
    data = json.loads(proc.stdout)
    data["_elapsed_s"] = round(time.time() - t0, 1)
    data["_cmd"] = " ".join(c if " " not in c else repr(c[:60] + ("…" if len(c) > 60 else "")) for c in cmd)
    state["cost_usd"] = round(state["cost_usd"] + (data.get("total_cost_usd") or 0), 4)
    return data


def save():
    RUN.write_text(json.dumps(state, indent=2))


def tree_hash(root):
    out = {}
    for p in sorted(root.rglob("*")):
        if p.is_file() and ".claude" not in p.parts:
            out[str(p.relative_to(root))] = hashlib.sha1(p.read_bytes()).hexdigest()
    return out


# --------------------------------------------------------------------------- 1
def step1():
    print("== step 1: instruction hierarchy and path-scoped rules")
    r = claude("Quote, word for word and nothing else, the first bullet under "
               "'Testing standards' in your project instructions.", WS, max_turns=2)
    rules = {}
    for target, label in (("src/components/Button.test.tsx", "test file"), ("src/api/orders.js", "api handler")):
        q = (f"Read {target}. Then answer with ONLY a comma-separated list of the rule file names "
             f"(for example tests.md) from .claude/rules/ that are now loaded in your context "
             f"because of that file. No other words.")
        rr = claude(q, WS, tools=["Read"], max_turns=3)
        rules[target] = {"label": label, "answer": rr.get("result"), "session_id": rr.get("session_id"),
                         "cost_usd": rr.get("total_cost_usd"), "loaded": sorted(set(re.findall(r"[\w-]+\.md", rr.get("result") or "")))}
    state["steps"]["1"] = {
        "claude_md_quote": r.get("result"), "quote_session": r.get("session_id"),
        "imports_resolved": [str(p) for p in ("docs/standards/testing.md", "docs/standards/review-criteria.md") if (WS / p).exists()],
        "rules_by_file": rules,
    }
    save()
    print("   quote:", r.get("result"))
    for k, v in rules.items():
        print(f"   {k}: {v['loaded']}")


# --------------------------------------------------------------------------- 2
def step2():
    print("== step 2: /review command and codebase-map skill (scratch git repo with a real diff)")
    import casekit
    with tempfile.TemporaryDirectory(prefix="lab02-review-") as tmp:
        scratch = Path(tmp) / "workspace"
        shutil.copytree(WS, scratch)
        casekit.git_init(scratch)                       # baseline commit on main
        target = scratch / "src/api/orders.js"          # an uncommitted change for /review to diff
        target.write_text(target.read_text().replace(
            'if (!authorize(req.user, "orders:read")) return res.status(403).end();\n  const order',
            'const order'))                              # drops the auth check on getOrder: a real finding
        rev = claude("/review main", scratch, tools=["Read", "Grep", "Glob", "Bash(git diff:*)", "Bash(git log:*)"], max_turns=8)
    skill = claude("Use the codebase-map skill on src/api and return its summary verbatim.", WS,
                   tools=["Read", "Grep", "Glob", "Skill", "Agent"], max_turns=8)
    verdict = re.search(r"VERDICT:\s*(approve|request-changes)", rev.get("result") or "")
    state["steps"]["2"] = {
        "review": {"session_id": rev.get("session_id"), "verdict": verdict.group(1) if verdict else None,
                   "diff_under_review": "src/api/orders.js: authorize() check removed from getOrder",
                   "output": rev.get("result"), "cost_usd": rev.get("total_cost_usd")},
        "codebase_map": {"session_id": skill.get("session_id"), "output": skill.get("result"),
                         "mentions_orders_handler": bool(re.search(r"orders\.js|getOrder", skill.get("result") or "")),
                         "cost_usd": skill.get("total_cost_usd")},
    }
    save()
    print("   /review verdict:", state["steps"]["2"]["review"]["verdict"])
    print("   codebase-map mentions orders handler:", state["steps"]["2"]["codebase_map"]["mentions_orders_handler"])


# --------------------------------------------------------------------------- 3
def step3():
    print("== step 3: plan mode vs direct execution (scratch copy)")
    tasks = {t["task_id"]: t for t in json.loads((HERE / "tasks.json").read_text())}
    results = {}
    with tempfile.TemporaryDirectory(prefix="lab02-") as tmp:
        scratch = Path(tmp) / "workspace"
        shutil.copytree(WS, scratch)
        before = tree_hash(scratch)
        # T2: 47-file migration -> plan mode. Claude may read and plan but cannot edit.
        t2 = claude(f"Task: {tasks['T2']['title']}. In the full repo this touches about 47 files; this checkout holds a "
                    f"representative slice (package.json, src/api, src/db, src/services). Two migration strategies are viable "
                    f"(big-bang swap vs adapter module). Produce the implementation plan.", scratch, mode="plan",
                    tools=["Read", "Grep", "Glob"], max_turns=12)
        after_t2 = tree_hash(scratch)
        # T1: one file, clear stack trace -> direct execution with acceptEdits.
        t1 = claude("Task: formatDate crashes with 'TypeError: Cannot read properties of null (reading "
                    "\"toISOString\")' at src/utils/formatDate.js when an order has no shippedAt. "
                    "Fix it directly in src/utils/formatDate.js (return an empty string for a missing date). "
                    "Follow the project testing standard: add the regression test file "
                    "src/utils/formatDate.test.js using tests/fixtures/orders.json. Do not touch other files.",
                    scratch, mode="acceptEdits", tools=["Read", "Edit", "Write", "Glob", "Grep"], max_turns=8)
        after_t1 = tree_hash(scratch)
        changed_t1 = sorted(set(k for k in set(before) | set(after_t1) if before.get(k) != after_t1.get(k)))
        results = {
            "T2": {"mode": "plan", "session_id": t2.get("session_id"), "subtype": t2.get("subtype"), "files_changed": sorted(k for k in after_t2 if before.get(k) != after_t2.get(k)),
                   "plan_excerpt": (t2.get("result") or "")[:1500], "cost_usd": t2.get("total_cost_usd")},
            "T1": {"mode": "direct execution (acceptEdits)", "session_id": t1.get("session_id"), "files_changed": changed_t1,
                   "fixed_source": (scratch / "src/utils/formatDate.js").read_text(), "cost_usd": t1.get("total_cost_usd")},
            "T3": {"mode": "plan (decision only, not executed)", "reason": "three valid approaches and an architectural decision: websocket vs SSE vs polling"},
        }
    assert tree_hash(WS) == tree_hash(WS), "workspace untouched"
    state["steps"]["3"] = {"decisions": {k: ("plan mode" if k != "T1" else "direct execution") for k in tasks}, "runs": results,
                           "workspace_modified": False}
    save()
    print("   T2 plan mode changed files:", results["T2"]["files_changed"])
    print("   T1 direct execution changed files:", results["T1"]["files_changed"])


# --------------------------------------------------------------------------- 4
def step4():
    print("== step 4: named session, --resume, --fork-session")
    base = claude("Investigation session: find the order API handler and the repository it should call. "
                  "Report the file paths in one line.", WS, tools=["Read", "Grep", "Glob"], name="orderly-investigation", max_turns=5)
    sid = base["session_id"]
    resumed = claude("Which files did you already examine in this session? Answer with the paths only.", WS,
                     resume=sid, max_turns=2)
    forked = claude("Fork: assume we switch the repository to Prisma. Which of the files you examined would change? "
                    "Paths only.", WS, resume=sid, fork=True, max_turns=2)
    state["steps"]["4"] = {
        "baseline_session": sid, "baseline_answer": base.get("result"),
        "resumed_session": resumed.get("session_id"), "resumed_answer": resumed.get("result"),
        "forked_session": forked.get("session_id"), "forked_answer": forked.get("result"),
        "resume_kept_id": resumed.get("session_id") == sid, "fork_new_id": forked.get("session_id") != sid,
        "cost_usd": round(sum(x.get("total_cost_usd") or 0 for x in (base, resumed, forked)), 4),
    }
    save()
    print("   baseline", sid, "| resume kept id:", state["steps"]["4"]["resume_kept_id"], "| fork new id:", state["steps"]["4"]["fork_new_id"])


# --------------------------------------------------------------------------- 5
def step5():
    print("== step 5: MCP scopes and environment expansion (no API call)")
    proj = json.loads((WS / ".mcp.json").read_text())
    user = json.loads((WS / "user-claude.example.json").read_text())
    raw = (WS / ".mcp.json").read_text()
    literal = re.findall(r"(ghp_[A-Za-z0-9]{10,}|sk-[A-Za-z0-9_-]{10,}|xox[a-z]-[A-Za-z0-9-]{10,})", raw)
    placeholders = re.findall(r"\$\{([A-Z_]+)\}", raw)
    expanded = {k: {ek: os.path.expandvars(ev) for ek, ev in (v.get("env") or {}).items()} for k, v in proj["mcpServers"].items()}
    state["steps"]["5"] = {
        "project_scope_file": ".mcp.json", "project_servers": list(proj["mcpServers"]),
        "placeholders": placeholders, "literal_secrets": literal,
        "expansion_demo": {k: {ek: ("<set from environment>" if ev and not ev.startswith("$") else "<unset: keep placeholder>") for ek, ev in v.items()} for k, v in expanded.items()},
        "user_scope_file": "~/.claude.json (example in user-claude.example.json; not written by this lab)",
        "user_servers": list(user["mcpServers"]),
    }
    save()
    print("   project servers:", state["steps"]["5"]["project_servers"], "| placeholders:", placeholders, "| literal secrets:", literal)


STEPS = {"1": step1, "2": step2, "3": step3, "4": step4, "5": step5}
if __name__ == "__main__":
    if sys.argv[1:2] == ["--case"]:
        import casekit
        sys.exit(subprocess.call([sys.executable, "-B", str(HERE / "casekit.py"), "--case", *sys.argv[2:3]]))
    which = sys.argv[1:] or list(STEPS)
    for w in which:
        STEPS[w]()
    print(f"== cumulative cost: US${state['cost_usd']:.2f}  (evidence/run.json)")
