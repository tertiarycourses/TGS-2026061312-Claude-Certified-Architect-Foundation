#!/usr/bin/env python3
"""Use-case runner shared by the Claude Code labs.

A use case lives in cases/UC-<n>.json and mirrors one practice-test question:
the situation, the question, the correct option and why, then a runnable
task list (real `claude -p` prompt templates, shell commands) and a rubric
that is evaluated deterministically. Evidence lands in evidence/cases/.

    uv run casekit.py --case UC-9            # run + evaluate one case
    uv run casekit.py --case all             # every case in cases/
    uv run casekit.py --list                 # table of cases
    uv run casekit.py --evaluate UC-9        # re-score saved evidence

Task kinds: "claude" (prompt, mode, tools, schema, settings, agents, resume,
fork, max_turns, snapshot, restore_before), "shell" (cmd), "note".
Placeholders in prompts and commands: {{lab}}, {{work}}, {{model}}.
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
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

LAB = Path(__file__).resolve().parent
CASES = LAB / "cases"
EVID = LAB / "evidence" / "cases"
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
SOURCE_DIRS = {"workspace": LAB / "workspace", "repo": LAB / "repo"}


def fill(s, ctx):
    for k, v in ctx.items():
        s = s.replace("{{" + k + "}}", str(v))
    return s


def tree_hash(root):
    out = {}
    for p in sorted(Path(root).rglob("*")):
        if p.is_file() and ".git" not in p.parts and "node_modules" not in p.parts:
            out[str(p.relative_to(root))] = hashlib.sha1(p.read_bytes()).hexdigest()
    return out


def changed(before, after):
    return sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))


def git_init(work):
    env = {**os.environ, "GIT_AUTHOR_NAME": "lab", "GIT_AUTHOR_EMAIL": "lab@example.com",
           "GIT_COMMITTER_NAME": "lab", "GIT_COMMITTER_EMAIL": "lab@example.com"}
    for cmd in (["git", "init", "-q", "-b", "main"], ["git", "add", "-A"], ["git", "commit", "-qm", "baseline"]):
        subprocess.run(cmd, cwd=work, check=True, capture_output=True, env=env)


def run_claude(task, ctx, work, prev):
    cmd = ["claude", "-p", fill(task["prompt"], ctx), "--model", MODEL, "--output-format", "json",
           "--max-turns", str(task.get("max_turns", 5))]
    if task.get("mode"):
        cmd += ["--permission-mode", task["mode"]]
    if task.get("tools"):
        cmd += ["--allowedTools", *task["tools"]]
    if task.get("disallowed"):
        cmd += ["--disallowedTools", *task["disallowed"]]
    if task.get("schema"):
        schema = task["schema"] if isinstance(task["schema"], dict) else json.loads((LAB / task["schema"]).read_text())
        cmd += ["--json-schema", json.dumps(schema)]
    if task.get("settings"):
        cmd += ["--settings", json.dumps(json.loads(fill((LAB / task["settings"]).read_text(), ctx)))]
    if task.get("agents"):
        cmd += ["--agents", (LAB / task["agents"]).read_text()]
    if task.get("resume"):
        cmd += ["--resume", prev[task["resume"]]["session_id"]]
    if task.get("fork"):
        cmd += ["--fork-session"]
    if task.get("name"):
        cmd += ["--name", task["name"]]
    if task.get("effort"):
        cmd += ["--effort", task["effort"]]
    before = tree_hash(work) if task.get("snapshot") else None
    t0 = time.time()
    proc = simkit.run_cli(cmd, cwd=work)
    rec = {"kind": "claude", "elapsed_s": round(time.time() - t0, 1), "exit_code": proc.returncode,
           "command": " ".join(c if len(c) < 70 else c[:67] + "…" for c in cmd)}
    try:
        env = json.loads(proc.stdout)
    except json.JSONDecodeError:
        env = {"result": proc.stdout, "stderr": proc.stderr[-800:]}
    rec.update({k: env.get(k) for k in ("subtype", "result", "session_id", "total_cost_usd", "num_turns",
                                        "structured_output", "permission_denials", "is_error")})
    if before is not None:
        rec["files_changed"] = changed(before, tree_hash(work))
    return rec


def run_shell(task, ctx, work):
    cmd = fill(task["cmd"], ctx)
    t0 = time.time()
    proc = subprocess.run(cmd, cwd=work, shell=True, capture_output=True, text=True)
    return {"kind": "shell", "command": cmd, "exit_code": proc.returncode, "stdout": proc.stdout[-4000:],
            "stderr": proc.stderr[-1000:], "elapsed_s": round(time.time() - t0, 1)}


def run_case(case):
    EVID.mkdir(parents=True, exist_ok=True)
    out = {k: case.get(k) for k in ("id", "question_n", "timestamp", "title", "type", "correct", "expected_outcome")}
    out["model"] = MODEL
    out["tasks"] = {}
    if case.get("type") == "discussion":
        out["note"] = "discussion use case: no runnable step; expected answer recorded"
    else:
        setup = case.get("setup", {})
        src = SOURCE_DIRS.get(setup.get("workdir", "workspace"))
        tmp = tempfile.mkdtemp(prefix=f"{case['id']}-")
        work = Path(tmp) / src.name
        shutil.copytree(src, work)
        for rel, content in (setup.get("files") or {}).items():
            p = work / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content)
        if setup.get("git_init"):
            git_init(work)
        for rel, content in (setup.get("files_after_commit") or {}).items():
            (work / rel).parent.mkdir(parents=True, exist_ok=True)
            (work / rel).write_text(content)
        ctx = {"lab": str(LAB), "work": str(work), "model": MODEL}
        baseline = tree_hash(work)
        prev = {}
        for task in case["tasks"]:
            if task.get("restore_before"):
                shutil.rmtree(work)
                shutil.copytree(src, work)
                for rel, content in (setup.get("files") or {}).items():
                    (work / rel).parent.mkdir(parents=True, exist_ok=True)
                    (work / rel).write_text(content)
                if setup.get("git_init"):
                    git_init(work)
                prev.setdefault("_restores", []).append(task["id"])
            if task["kind"] == "claude":
                rec = run_claude(task, ctx, work, prev)
            elif task["kind"] == "shell":
                rec = run_shell(task, ctx, work)
            else:
                rec = {"kind": "note", "text": task.get("text")}
            for rel in task.get("capture_files", []):
                p = work / rel
                rec.setdefault("files", {})[rel] = p.read_text()[:20000] if p.exists() else None
            prev[task["id"]] = rec
            out["tasks"][task["id"]] = rec
            print(f"   {case['id']} {task['id']}: {rec.get('subtype') or rec.get('exit_code')}  "
                  f"{'$%.2f' % rec['total_cost_usd'] if rec.get('total_cost_usd') else ''}")
        out["restores"] = prev.get("_restores", [])
        shutil.rmtree(tmp, ignore_errors=True)
    out["cost_usd"] = round(sum(t.get("total_cost_usd") or 0 for t in out["tasks"].values()), 4)
    out["evaluation"] = evaluate(case, out)
    (EVID / f"{case['id']}.json").write_text(json.dumps(out, indent=2))
    return out


def field(rec, name):
    v = rec.get(name)
    if name in ("structured_output", "permission_denials", "files", "files_changed") and not isinstance(v, str):
        return json.dumps(v)
    return "" if v is None else str(v)


def evaluate(case, out):
    results = []
    for item in case.get("rubric", []):
        chk = item.get("check", {"type": "discussion"})
        t = chk.get("type")
        ok, note = False, ""
        try:
            if t == "discussion":
                ok, note = True, "reviewed against the expected answer"
            else:
                rec = out["tasks"].get(chk.get("task", ""), {})
                val = field(rec, chk.get("field", "result"))
                if t == "regex":
                    ok = re.search(chk["pattern"], val, re.I | re.S) is not None
                elif t == "not_regex":
                    ok = re.search(chk["pattern"], val, re.I | re.S) is None
                elif t == "files_changed_empty":
                    ok = rec.get("files_changed") == []
                elif t == "files_changed_contains":
                    ok = any(chk["path"] in f for f in rec.get("files_changed") or [])
                elif t == "distinct":
                    vals = [out["tasks"].get(x, {}).get(chk.get("field", "session_id")) for x in chk["tasks"]]
                    ok = len(set(vals)) == len(vals) and all(vals)
                elif t == "same":
                    vals = [out["tasks"].get(x, {}).get(chk.get("field", "session_id")) for x in chk["tasks"]]
                    ok = len(set(vals)) == 1 and all(vals)
                elif t == "structured_present":
                    ok = rec.get("structured_output") is not None
                elif t == "json_path":
                    cur = rec.get("structured_output")
                    for part in chk["path"].split("."):
                        cur = cur[int(part)] if isinstance(cur, list) else cur.get(part)
                    ok = cur == chk["equals"] if "equals" in chk else cur is not None
                    note = f"value={cur!r}"
                elif t == "all_in_range":
                    items = rec.get("structured_output", {}).get(chk["list"], [])
                    ok = bool(items) and all(chk["lo"] <= x.get(chk["key"], -1) <= chk["hi"] for x in items)
                elif t == "exit_code":
                    ok = rec.get("exit_code") == chk["equals"]
                elif t == "elapsed_lt":
                    ok = (rec.get("elapsed_s") or 1e9) < chk["seconds"]
                elif t == "restored_before":
                    ok = chk["task"] in out.get("restores", [])
                elif t == "ratio_lt":
                    a = float(re.search(r"\d+", field(out["tasks"][chk["a"]], "stdout")).group())
                    b = float(re.search(r"\d+", field(out["tasks"][chk["b"]], "stdout")).group())
                    ok = a / b < chk["ratio"]
                    note = f"{a:.0f}/{b:.0f}"
                elif t == "any_of":
                    ok = any(evaluate({"rubric": [{"criterion": "any_of", "check": c}]}, out)[0]["pass"] for c in chk["checks"])
        except Exception as e:  # a broken check is a failed check, with the reason recorded
            ok, note = False, f"check error: {e}"
        results.append({"criterion": item["criterion"], "pass": bool(ok), "note": note})
    return results


def load(case_id):
    return json.loads((CASES / f"{case_id}.json").read_text())


def print_eval(out):
    for r in out["evaluation"]:
        print(f"   {'PASS' if r['pass'] else 'FAIL'} - {r['criterion']}" + (f"  ({r['note']})" if r["note"] else ""))
    print(f"   cost US${out['cost_usd']:.2f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", help="UC-<n> or all")
    ap.add_argument("--evaluate", help="re-score saved evidence for UC-<n>")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    ids = sorted((p.stem for p in CASES.glob("UC-*.json")), key=lambda s: int(s.split("-")[1]))
    if a.list:
        for i in ids:
            c = load(i)
            print(f"{i:6s} Q{c['question_n']:<3} {c['timestamp']:>6}  {c['type']:10s} {c['title']}")
    elif a.evaluate:
        c = load(a.evaluate)
        out = json.loads((EVID / f"{a.evaluate}.json").read_text())
        out["evaluation"] = evaluate(c, out)
        (EVID / f"{a.evaluate}.json").write_text(json.dumps(out, indent=2))
        print_eval(out)
    elif a.case:
        total = 0.0
        for i in (ids if a.case == "all" else [a.case]):
            c = load(i)
            print(f"== {i}  Q{c['question_n']} ({c['timestamp']})  {c['title']}")
            out = run_case(c)
            print_eval(out)
            total += out["cost_usd"]
        print(f"== total cost US${total:.2f}")
    else:
        ap.print_help()
