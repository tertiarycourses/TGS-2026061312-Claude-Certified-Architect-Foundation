#!/usr/bin/env python3
"""Simulator 4 - Developer Productivity with Claude, on the Claude Agent SDK.

Four runs against a copy of sample_repo/ (the pristine fixture is never touched):

  1. explore  - Grep before Read, an Explore-style subagent for the noisy part,
                a scratchpad file, an MCP resource catalogue, hooks that log every
                tool call and block `rm -rf`.
  2. edit     - resume the SAME session, tell it which files changed, fix the
                rounding defect (Edit fallback to Read+Write when the anchor is
                not unique), run the tests with Bash.
  3. fork     - fork the explore session twice to compare two refactoring
                approaches without polluting either branch.
  4. recover  - start a FRESH session from evidence/manifest.json (crash
                recovery) and continue without re-exploring.

    uv run explorer.py              # all four runs
    uv run explorer.py explore      # one phase (later phases need the
                                        # session id from evidence/sessions.json)
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from claude_agent_sdk import (
    AgentDefinition,
    AssistantMessage,
    ClaudeAgentOptions,
    HookMatcher,
    ResultMessage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
    create_sdk_mcp_server,
    query,
    tool,
)

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence"
WORK = HERE / "work"                      # disposable copy of sample_repo
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
BUDGET = float(os.environ.get("LAB_BUDGET_USD", "3.0"))
TOOL_LOG = EVIDENCE / "tool_log.jsonl"
SESSIONS = EVIDENCE / "sessions.json"
CURRENT = {"phase": "explore"}

# --------------------------------------------------------------- MCP catalogue
CATALOG = json.loads((HERE / "mcp_resources.json").read_text())


@tool(
    "list_catalog",
    "List the orderly-docs content catalogue: every internal document with its URI, "
    "name and a one-line summary. Call this FIRST to learn what documentation exists "
    "before you Glob or Read anything. (In Claude Code proper this catalogue would be "
    "exposed as MCP resources; an SDK MCP server exposes tools, so here it is a tool.)",
    {},
)
async def list_catalog(args):
    rows = []
    for r in CATALOG["resources"]:
        summary = (WORK / r["path"].replace("sample_repo/", "")).read_text().splitlines()[0] if r["path"] else "(schema stub, no file)"
        rows.append({"uri": r["uri"], "name": r["name"], "summary": summary[:120]})
    return {"content": [{"type": "text", "text": json.dumps({"server": CATALOG["server"], "resources": rows}, indent=1)}]}


@tool(
    "read_resource",
    "Read one catalogue entry by its URI (for example docs://architecture). Returns the "
    "full text. Use list_catalog first to learn the URIs.",
    {"uri": str},
)
async def read_resource(args):
    r = next((x for x in CATALOG["resources"] if x["uri"] == args["uri"]), None)
    if r is None or not r["path"]:
        return {"is_error": True, "content": [{"type": "text", "text": f"no readable resource at {args.get('uri')}"}]}
    return {"content": [{"type": "text", "text": (WORK / r["path"].replace("sample_repo/", "")).read_text()}]}


docs = create_sdk_mcp_server("orderly-docs", tools=[list_catalog, read_resource])
CATALOG_TOOLS = ["mcp__orderly-docs__list_catalog", "mcp__orderly-docs__read_resource"]

# ---------------------------------------------------------------------- hooks
def _short(v):
    if isinstance(v, str):
        return v.replace(str(WORK) + "/", "")[:160]
    return v


async def log_tool(input_data, tool_use_id, context):
    """PostToolUse: append every tool call to evidence/tool_log.jsonl."""
    rec = {
        "phase": CURRENT["phase"],
        "t": round(time.time(), 3),
        "tool": input_data["tool_name"],
        "agent": input_data.get("agent_type") or "main",
        "input": {k: _short(v) for k, v in (input_data.get("tool_input") or {}).items()},
        "error": _looks_like_error(input_data.get("tool_response")),
    }
    with TOOL_LOG.open("a") as fh:
        fh.write(json.dumps(rec) + "\n")
    return {}


def _looks_like_error(resp) -> bool:
    text = json.dumps(resp) if not isinstance(resp, str) else resp
    return any(s in text for s in ("Found 2 matches", "not unique", "did not find", "Error:", "is_error\": true"))


async def block_rm_rf(input_data, tool_use_id, context):
    """PreToolUse on Bash: deny destructive deletes."""
    cmd = input_data["tool_input"].get("command", "")
    destructive = (re.search(r"\brm\b[^|;&\n]*(\s-\w*[rf]|\btests\b)", cmd) or re.search(r"\bmv\b[^|;&\n]*\btests\b", cmd)
                   or "rmdir" in cmd or "shutil.rmtree" in cmd)
    if destructive:
        with TOOL_LOG.open("a") as fh:
            fh.write(json.dumps({"phase": CURRENT["phase"], "t": round(time.time(), 3), "tool": "Bash", "agent": "main", "blocked": cmd[:160]}) + "\n")
        return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                       "permissionDecisionReason": "Blocked by lab policy: the tests directory must not be deleted, emptied or moved. Report this to the user instead of working around it."}}
    return {}


async def log_tool_failure(input_data, tool_use_id, context):
    """PostToolUseFailure: a failed Edit (non-unique anchor) never reaches PostToolUse, so log it here."""
    rec = {"phase": CURRENT["phase"], "t": round(time.time(), 3), "tool": input_data["tool_name"],
           "agent": input_data.get("agent_type") or "main",
           "input": {k: _short(v) for k, v in (input_data.get("tool_input") or {}).items()},
           "error": True, "error_text": str(input_data.get("error") or input_data.get("tool_response") or "")[:200]}
    with TOOL_LOG.open("a") as fh:
        fh.write(json.dumps(rec) + "\n")
    return {}


HOOKS = {
    "PostToolUse": [HookMatcher(hooks=[log_tool])],
    "PostToolUseFailure": [HookMatcher(hooks=[log_tool_failure])],
    "PreToolUse": [HookMatcher(matcher="Bash", hooks=[block_rm_rf])],
}

# ------------------------------------------------------------------ subagent
AGENTS = {
    "explore": AgentDefinition(
        description="Read-only codebase explorer. Use for any question that needs many Grep/Read calls; it returns a short summary so the verbose output stays out of the main context.",
        prompt=("You explore the codebase in cwd with Grep, Glob and Read only. Start with Grep for the symbol "
                "or entry point, follow imports with Read, and never read every file up front. Return at most "
                "15 lines: definition site (file:line), every caller (file:line), and one sentence on the data flow."),
        tools=["Read", "Grep", "Glob"],
        model="sonnet",
    )
}

SYSTEM = (
    "You are a developer-productivity agent working in a legacy Python billing repo (cwd). Rules:\n"
    "- Consult the orderly-docs catalogue (list_catalog / read_resource) before exploring files.\n"
    "- Build understanding incrementally: Grep for entry points first, then Read only the files you need. "
    "Never Read every file.\n"
    "- Delegate wide discovery questions ('find every caller') to the explore subagent and use its summary.\n"
    "- Keep a scratchpad at NOTES.md in cwd: append what you learned (file:line facts, decisions, next step) "
    "after each phase so a later session can resume without re-exploring.\n"
    "- Prefer Edit for targeted changes. If Edit fails because the anchor text is not unique, Read the file and "
    "Write it back whole instead of guessing.\n"
    "- Run tests with Bash: python3 -m pytest -q\n"
    "- Never delete directories."
)

BASE_TOOLS = ["Read", "Grep", "Glob", "Bash", "Write", "Edit", "Agent"] + CATALOG_TOOLS


def options(**extra) -> ClaudeAgentOptions:
    system = extra.pop("system_prompt", SYSTEM)
    return ClaudeAgentOptions(
        model=MODEL, system_prompt=system, cwd=str(WORK), mcp_servers={"orderly-docs": docs},
        allowed_tools=BASE_TOOLS, agents=AGENTS, hooks=HOOKS, permission_mode="acceptEdits",
        max_turns=extra.pop("max_turns", 25), max_budget_usd=BUDGET,
        env={"CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1"}, **extra,
    )


async def run(phase: str, prompt: str, **extra) -> dict:
    CURRENT["phase"] = phase
    out = {"phase": phase, "prompt": prompt, "spawned_subagents": 0, "text": ""}
    print(f"\n=== {phase} ===")
    pending: dict = {}
    async for msg in query(prompt=prompt, options=options(**extra)):
        simkit.narrate(msg)
        if isinstance(msg, AssistantMessage):
            for b in msg.content:
                if isinstance(b, ToolUseBlock):
                    pending[b.id] = (b.name, b.input)
            if getattr(msg, "parent_tool_use_id", None):
                continue
            out["spawned_subagents"] += sum(1 for b in msg.content if isinstance(b, ToolUseBlock) and b.name in ("Agent", "Task"))
            for b in msg.content:
                if isinstance(b, TextBlock):
                    out["text"] += b.text + "\n"
        elif isinstance(msg, UserMessage) and isinstance(msg.content, list):
            for b in msg.content:
                if isinstance(b, ToolResultBlock) and b.is_error and b.tool_use_id in pending:
                    name, tin = pending[b.tool_use_id]
                    body = b.content if isinstance(b.content, str) else json.dumps(b.content)
                    with TOOL_LOG.open("a") as fh:
                        fh.write(json.dumps({"phase": phase, "t": round(time.time(), 3), "tool": name, "agent": "main",
                                             "input": {k: _short(v) for k, v in (tin or {}).items()},
                                             "error": True, "error_text": body[:200]}) + "\n")
        elif isinstance(msg, ResultMessage):
            out.update(session_id=msg.session_id, subtype=msg.subtype, num_turns=msg.num_turns,
                       total_cost_usd=msg.total_cost_usd, result=msg.result)
            print(f"[{phase}] {msg.subtype} turns={msg.num_turns} cost=${(msg.total_cost_usd or 0):.4f} session={msg.session_id}")
    dest = (EVIDENCE / "cases" / f"{phase[5:]}.run.json") if phase.startswith("case-") else (EVIDENCE / f"{phase}.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, indent=2))
    return out


def fresh_workdir():
    if WORK.exists():
        shutil.rmtree(WORK)
    shutil.copytree(HERE / "sample_repo", WORK)
    (WORK / "NOTES.md").write_text("# Scratchpad\n\n")


def load_sessions() -> dict:
    return json.loads(SESSIONS.read_text()) if SESSIONS.exists() else {}


def save_session(phase, sid):
    s = load_sessions(); s[phase] = sid; SESSIONS.write_text(json.dumps(s, indent=2))


async def explore():
    fresh_workdir()
    if TOOL_LOG.exists():
        TOOL_LOG.unlink()
    r = await run("explore",
                  "A customer reports invoice totals with more than two decimal places. Find where invoice "
                  "totals are computed and validated, and every caller of calculate_total. Use the explore "
                  "subagent for the caller search. Do not change any code yet. Write your findings and the "
                  "proposed fix to NOTES.md, then summarise in five lines.")
    save_session("explore", r["session_id"])
    notes = (WORK / "NOTES.md").read_text()
    (EVIDENCE / "scratchpad.md").write_text(notes)
    manifest = {"phase_completed": "explore", "session_id": r["session_id"], "model": MODEL,
                "findings": notes, "next_step": "apply the rounding fix in src/billing/invoice.py and run pytest",
                "files_of_interest": ["src/billing/invoice.py", "src/billing/validation.py", "src/legacy/report.py"]}
    (EVIDENCE / "manifest.json").write_text(json.dumps(manifest, indent=2))


async def edit():
    sid = load_sessions()["explore"]
    # Simulate work done outside the session: a teammate touched the docs.
    (WORK / "docs" / "runbook.txt").write_text((WORK / "docs" / "runbook.txt").read_text() + "\nTotals must be rounded to 2 dp (finance policy 2026-04).\n")
    r = await run("edit",
                  "Since your last turn, docs/runbook.txt changed (re-read only that file; everything else is "
                  "as you left it). Now fix the defect: in src/billing/invoice.py make calculate_total return "
                  "the total quantized to 2 decimal places (Decimal('0.01'), ROUND_HALF_UP). Change only the "
                  "final return in calculate_total. Note that 'return total' appears more than once in that "
                  "file, so if Edit rejects a non-unique anchor, fall back to Read + Write. Then run "
                  "python3 -m pytest -q and append the outcome to NOTES.md.",
                  resume=sid)
    save_session("edit", r["session_id"])
    (EVIDENCE / "scratchpad.md").write_text((WORK / "NOTES.md").read_text())
    (EVIDENCE / "patched-invoice.py.txt").write_text((WORK / "src" / "billing" / "invoice.py").read_text())


async def fork():
    sid = load_sessions()["explore"]
    forks = {}
    for label, approach in {
        "fork-a": "Approach A: keep calculate_total's signature and quantize inside it.",
        "fork-b": "Approach B: leave calculate_total unrounded and quantize in validate_invoice and report.py instead.",
    }.items():
        r = await run(label,
                      f"{approach} Without editing any file, assess this approach in at most eight lines: files touched, "
                      "risk to callers, test impact. Do not explore again; use what you already know from this session.",
                      resume=sid, fork_session=True, max_turns=6)
        forks[label] = r["session_id"]
        save_session(label, r["session_id"])
    assert len(set(forks.values())) == 2 and sid not in forks.values(), "forks must have new ids"


async def recover():
    manifest = json.loads((EVIDENCE / "manifest.json").read_text())
    r = await run("recover",
                  "The previous session crashed. Here is its state manifest; continue from it without "
                  "re-exploring the repo (no Grep, no explore subagent). Confirm the fix is present in "
                  "src/billing/invoice.py by reading only that file, run python3 -m pytest -q, and report.\n\n"
                  + json.dumps(manifest, indent=2),
                  max_turns=8)
    save_session("recover", r["session_id"])


PHASES = {"explore": explore, "edit": edit, "fork": fork, "recover": recover}

# ------------------------------------------------------------------ use cases
CASES = HERE / "cases"


def rows(phase):
    if not TOOL_LOG.exists():
        return []
    return [json.loads(l) for l in TOOL_LOG.read_text().splitlines() if l.strip() and json.loads(l).get("phase") == phase]


def evaluate_case(uc: str, log: list, out: dict) -> list:
    tools = [r.get("tool") for r in log]
    main_rows = [r for r in log if r.get("agent") in ("main", None)]
    greps = [r for r in log if r.get("tool") == "Grep"]
    reads = [r for r in log if r.get("tool") == "Read"]
    agent_calls = out.get("spawned_subagents", 0)
    sess = load_sessions()
    R = []
    if uc == "UC-37":
        g = greps[0]["input"] if greps else {}
        bash_grep = any(r.get("tool") == "Bash" and "grep" in json.dumps(r.get("input")) for r in log)
        R = [("Grep used with pattern == helper name", any("calculate_total" in str(r["input"].get("pattern", "")) for r in greps)),
             ("Grep scoped with a *.py glob and output_mode content",
              any(str(r["input"].get("glob", "")).endswith(".py") and r["input"].get("output_mode") == "content" for r in greps)),
             ("no Bash grep and fewer than 3 Read calls", not bash_grep and len(reads) < 3)]
    elif uc == "UC-D1":
        edits = [r for r in log if r.get("tool") == "Edit"]
        writes = [r for r in log if r.get("tool") == "Write"]
        src = (WORK / "src" / "billing" / "invoice.py").read_text()
        R = [("Edit attempted on invoice.py", any("invoice.py" in str(r["input"].get("file_path", "")) for r in edits)),
             ("after an Edit failure a Write (or a second unique Edit) lands the change",
              (any(r.get("error") for r in edits) and bool(writes)) or any(not r.get("error") for r in edits)),
             ("pytest exits 0 and quantize present", "quantize" in src and subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=WORK, capture_output=True).returncode == 0)]
    elif uc == "UC-D2":
        real = [x for x in tools if x != "ToolSearch"]   # ToolSearch is the harness loading deferred MCP tools
        touches_docs = lambda r: bool(re.search(r"(?<![:/\w])docs/", json.dumps(r.get("input"))))
        R = [("list_catalog is the first tool call", bool(real) and real[0] == "mcp__orderly-docs__list_catalog"),
             ("read_resource docs://runbook follows", any(r.get("tool") == "mcp__orderly-docs__read_resource" and "runbook" in json.dumps(r.get("input")) for r in log)),
             ("no Glob/Read/Bash over docs/", not any(r.get("tool") in ("Glob", "Read", "Bash") and touches_docs(r) for r in log))]
    elif uc == "UC-D3":
        notes = (WORK / "NOTES.md").read_text() if (WORK / "NOTES.md").exists() else ""
        R = [("explore subagent spawned", agent_calls >= 1),
             ("tool rows with agent=explore exist", any(r.get("agent") == "explore" for r in log)),
             ("NOTES.md mentions calculate_total and a caller", "calculate_total" in notes and ("report.py" in notes or "validation.py" in notes))]
    elif uc == "UC-D4":
        R = [("session id equals the explore session", out.get("session_id") == sess.get("explore")),
             ("no Grep and no Agent call", not greps and agent_calls == 0),
             ("Read count <= 2", len(reads) <= 2)]
    elif uc == "UC-D5":
        R = [("new session id", out.get("session_id") not in (None, sess.get("explore"))),
             ("no Grep and no Agent call", not greps and agent_calls == 0),
             ("pytest exits 0", subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=WORK, capture_output=True).returncode == 0)]
    elif uc == "UC-D6":
        R = [("a blocked row for rm -rf appears in tool_log.jsonl", any("blocked" in r for r in log)),
             ("work/tests still exists afterwards", (WORK / "tests").is_dir()),
             ("agent's final text acknowledges the block", any(w in (out.get("result") or "").lower() for w in ("block", "denied", "policy", "not allowed", "refus", "didn't delete", "did not delete", "won't delete")))]
    return [{"check": n, "passed": bool(p)} for n, p in R]


async def run_case(uc: str):
    case = json.loads((CASES / f"{uc}.json").read_text())
    task = case["task"]
    (EVIDENCE / "cases").mkdir(parents=True, exist_ok=True)
    prompt = task["prompt_template"]
    for k, v in (task.get("placeholders") or {}).items():
        prompt = prompt.replace("{{" + k + "}}", v)
    extra = {}
    if task.get("fresh_workdir") or not WORK.exists():
        fresh_workdir()
    if task.get("resume"):
        sess = load_sessions()
        if task["resume"] not in sess:
            await explore()
            sess = load_sessions()
        extra["resume"] = sess[task["resume"]]
    if task.get("manifest"):
        if not (EVIDENCE / "manifest.json").exists():
            await explore()
        prompt = prompt.replace("{{manifest}}", (EVIDENCE / "manifest.json").read_text())
    if task.get("max_turns"):
        extra["max_turns"] = task["max_turns"]
    if task.get("drop_prompt_rule"):
        # Show the hook as the deterministic layer: remove the prompt-only rule it backs up.
        extra["system_prompt"] = SYSTEM.replace("- Never delete directories.", "")
    phase = f"case-{uc}"
    out = await run(phase, prompt, **extra)
    rubric = evaluate_case(uc, rows(phase), out)
    record = {"id": uc, "title": case["title"], "source": case["source"], "prompt": prompt,
              "session_id": out.get("session_id"), "cost_usd": out.get("total_cost_usd"),
              "expected_outcome": case["expected_outcome"], "rubric": rubric, "result": (out.get("result") or "")[:1500]}
    for r in rubric:
        print(f"  {'PASS' if r['passed'] else 'FAIL'} - {r['check']}")
    (EVIDENCE / "cases" / f"{uc}.json").write_text(json.dumps(record, indent=2))


async def main():
    EVIDENCE.mkdir(exist_ok=True)
    args = sys.argv[1:]
    if "--case" in args:
        wanted = args[args.index("--case") + 1]
        ids = sorted(p.stem for p in CASES.glob("UC-*.json")) if wanted == "all" else [wanted]
        for uc in ids:
            await run_case(uc)
        return
    wanted = [a for a in args if a in PHASES] or list(PHASES)
    for p in wanted:
        await PHASES[p]()
    print("\n[evidence]", ", ".join(sorted(p.name for p in EVIDENCE.iterdir())))


if __name__ == "__main__":
    asyncio.run(main())
