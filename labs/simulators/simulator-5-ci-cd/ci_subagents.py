#!/usr/bin/env python3
"""Simulator 5: subagents inside the CI review pipeline (Claude Agent SDK).

A coordinator spawns security-reviewer, test-coverage-reviewer and
maintainability-reviewer in ONE response (parallel Agent calls) over the PR
files in repo/, then hands the review-synthesis subagent its prompt.

  --pass-findings   the coordinator pastes every reviewer's complete JSON
                    findings into the synthesis prompt (correct answer)
  --lossy           the coordinator only asks synthesis to "summarise the
                    review"; file paths, test names and evidence vanish
  --compare         score both saved runs: % of file paths and test names
                    preserved in the final PR comment

The terminal shows a live timeline (time, agent, tool, findings count) and
the number of Agent calls per assistant message proves parallel spawning.
Evidence: evidence/subagents-<mode>.json and evidence/pr-comment-<mode>.md.
Model: $LAB_MODEL for the coordinator (default claude-opus-5-5), sonnet for
the subagents, spend capped by --budget (default US$4 per run).
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

from claude_agent_sdk import (AgentDefinition, AssistantMessage, HookMatcher,
                              ResultMessage, SystemMessage, TextBlock, ToolResultBlock, ToolUseBlock,
                              UserMessage, query)

HERE = Path(__file__).resolve().parent
REPO = HERE / "repo"
EV = HERE / "evidence"
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
CHANGES = json.loads((HERE / "fixtures" / "changes.json").read_text())
FILES = [f["path"] for f in CHANGES["files"]]
FIELDS = "file, line, severity (critical|high|medium|low), category, detected_pattern, issue, suggested_fix, confidence (0-1)"

REVIEWERS = {
    "security-reviewer": AgentDefinition(
        description="Security review of the changed Python files in a pull request.",
        prompt=f"Read each file you are given. Report security flaws only: untrusted input reaching SQL, shell, "
               f"paths or HTML; authorisation gaps. Return ONLY a JSON array of findings with fields {FIELDS}. "
               f"Quote the offending line as evidence inside issue.",
        tools=["Read", "Grep"], model="sonnet"),
    "test-coverage-reviewer": AgentDefinition(
        description="Test coverage review: which changed functions the existing tests cover and which test would fail or is missing.",
        prompt=f"Read tests/ and each changed file you are given. For every changed public function return a finding "
               f"(category 'test-coverage' is allowed here) that names the existing test id that covers it, or the "
               f"failing/missing test name such as tests/test_totals.py::test_total_counts_all_items. "
               f"Return ONLY a JSON array of findings with fields {FIELDS}.",
        tools=["Read", "Grep", "Glob"], model="sonnet"),
    "maintainability-reviewer": AgentDefinition(
        description="Maintainability review: contracts between modules, dead code, misleading names, logging.",
        prompt=f"Read each file you are given plus its callers. Report contract breaks (a changed signature whose caller "
               f"was not updated), duplicated logic and misleading names. Return ONLY a JSON array of findings with "
               f"fields {FIELDS}.",
        tools=["Read", "Grep", "Glob"], model="sonnet"),
    "review-synthesis": AgentDefinition(
        description="Writes the final pull-request review comment from the material supplied in its prompt.",
        prompt="You write the final PR review comment in markdown. You have NO access to the repository and NO memory "
               "of earlier agents: use only what your prompt contains. Keep every file path, line number, test name "
               "and evidence snippet you are given. If you were given none, say so in one line and write a generic summary.",
        tools=[], model="sonnet"),
}


def coordinator_prompt(mode):
    common = (f"You coordinate the CI review of pull request {CHANGES['pr']}. Changed files: {', '.join(FILES)}.\n"
              "Step 1: spawn security-reviewer, test-coverage-reviewer and maintainability-reviewer IN THIS SAME RESPONSE "
              "(three Agent calls at once, not one after another), each with the file list above in its prompt, and wait "
              "for all three to return.\n")
    if mode == "pass-findings":
        step2 = ("Step 2: call review-synthesis exactly once. Its prompt MUST start with the line 'FINDINGS FROM REVIEWERS' "
                 "followed by each reviewer's name and its COMPLETE JSON findings array copied verbatim (every file path, "
                 "line, test name and evidence snippet), then the instruction to write the PR comment.\n")
    else:
        step2 = ("Step 2: call review-synthesis exactly once with this prompt and nothing else: "
                 "'Summarise the review of this pull request as a short PR comment.' Do not include the findings.\n")
    return common + step2 + ("Step 3: reply with two sections: '## Reviewer findings (verbatim)' holding the three JSON "
                             "arrays exactly as returned, then '## Synthesis comment' holding the review-synthesis output verbatim.")


async def run(mode, budget):
    EV.mkdir(exist_ok=True)
    t0 = time.time()
    timeline, spawns_per_message, agents_by_id, spawn_by_msg = [], [], {}, {}
    synthesis_prompt, final, result = None, "", None

    def log(agent, event):
        line = f"{time.time() - t0:6.1f}s  {agent:26s} {event}"
        timeline.append(line)
        print(line, flush=True)

    async def on_start(inp, tool_use_id, ctx):
        agents_by_id[inp.get("agent_id")] = inp.get("agent_type")
        log(inp.get("agent_type") or "subagent", "SubagentStart")
        return {}

    async def on_stop(inp, tool_use_id, ctx):
        log(inp.get("agent_type") or agents_by_id.get(inp.get("agent_id"), "subagent"), "SubagentStop")
        return {}

    options = simkit.options(
        cwd=str(REPO), model=MODEL, permission_mode="dontAsk", setting_sources=["project", "local"],
        allowed_tools=["Read", "Grep", "Glob", "Agent"], agents=REVIEWERS,
        max_turns=16, max_budget_usd=budget,
        hooks={"SubagentStart": [HookMatcher(hooks=[on_start])], "SubagentStop": [HookMatcher(hooks=[on_stop])]},
    )
    pending = {}  # tool_use_id -> agent name, to label results
    async for m in query(prompt=coordinator_prompt(mode), options=options):
        simkit.narrate(m)
        if isinstance(m, SystemMessage) and m.subtype == "init":
            log("coordinator", f"session {m.data.get('session_id')} model {m.data.get('model')}")
        elif isinstance(m, AssistantMessage):
            who = "coordinator" if not m.parent_tool_use_id else pending.get(m.parent_tool_use_id, "subagent")
            agent_calls = [b for b in m.content if isinstance(b, ToolUseBlock) and b.name in ("Agent", "Task")]
            if agent_calls:  # the CLI streams one AssistantMessage per content block: group by message_id
                mid = getattr(m, "message_id", None) or id(m)
                spawn_by_msg[mid] = spawn_by_msg.get(mid, 0) + len(agent_calls)
                spawns_per_message = list(spawn_by_msg.values())
                for b in agent_calls:
                    name = b.input.get("subagent_type", "?")
                    pending[b.id] = name
                    log("coordinator", f"Agent -> {name}  (prompt {len(b.input.get('prompt', ''))} chars)")
                    if name == "review-synthesis":
                        synthesis_prompt = b.input.get("prompt", "")
            for b in m.content:
                if isinstance(b, ToolUseBlock) and b.name not in ("Agent", "Task"):
                    target = b.input.get("file_path") or b.input.get("pattern") or ""
                    log(who, f"{b.name} {str(target)[-50:]}")
        elif isinstance(m, UserMessage) and isinstance(m.content, list):
            for b in m.content:
                if isinstance(b, ToolResultBlock) and b.tool_use_id in pending:
                    text = b.content if isinstance(b.content, str) else " ".join(p.get("text", "") for p in (b.content or []) if isinstance(p, dict))
                    n = len(re.findall(r'"file"\s*:', text))
                    log(pending[b.tool_use_id], f"returned {len(text)} chars, {n} finding(s)" if n else f"returned {len(text)} chars")
        elif isinstance(m, ResultMessage):
            result = m
            final = m.result or ""
            log("coordinator", f"{m.subtype} turns={m.num_turns} cost=${(m.total_cost_usd or 0):.2f}")

    findings_json = extract_findings(final)
    comment = final.split("## Synthesis comment", 1)[1].strip() if "## Synthesis comment" in final else final
    (EV / f"pr-comment-{mode}.md").write_text(comment + "\n")
    out = {"mode": mode, "model": MODEL, "subagent_model": "sonnet", "session_id": result.session_id if result else None,
           "cost_usd": result.total_cost_usd if result else None, "num_turns": result.num_turns if result else None,
           "agent_calls_per_assistant_message": spawns_per_message, "max_parallel_spawn": max(spawns_per_message or [0]),
           "max_concurrent_reviewers": max_overlap(timeline),
           "synthesis_prompt": synthesis_prompt, "synthesis_prompt_chars": len(synthesis_prompt or ""),
           "reviewer_findings": findings_json, "final_answer": final, "timeline": timeline}
    (EV / f"subagents-{mode}.json").write_text(json.dumps(out, indent=2))
    print(f"\n== parallel spawn per message: {spawns_per_message}  synthesis prompt: {len(synthesis_prompt or '')} chars"
          f"  cost ${(out['cost_usd'] or 0):.2f}  -> evidence/subagents-{mode}.json")
    return out


def max_overlap(timeline):
    """How many reviewer subagents were running at the same moment (from SubagentStart/Stop lines)."""
    live, peak = 0, 0
    for line in timeline:
        if "review-synthesis" in line:
            continue
        if line.rstrip().endswith("SubagentStart"):
            live += 1; peak = max(peak, live)
        elif line.rstrip().endswith("SubagentStop"):
            live -= 1
    return peak


def extract_findings(text):
    """Every JSON array of finding objects in the coordinator's verbatim section."""
    arrays = []
    for m in re.finditer(r"\[\s*\{.*?\}\s*\]", text, re.S):
        try:
            arr = json.loads(m.group(0))
            if arr and isinstance(arr[0], dict) and "file" in arr[0]:
                arrays.append(arr)
        except json.JSONDecodeError:
            continue
    return arrays


def score(out):
    findings = [f for arr in out["reviewer_findings"] for f in arr]
    paths = {f.get("file") for f in findings if f.get("file")}
    tests = set(re.findall(r"test_\w+", json.dumps(findings)))
    comment = (EV / f"pr-comment-{out['mode']}.md").read_text()
    kept_p = {p for p in paths if p in comment or Path(p).name in comment}
    kept_t = {t for t in tests if t in comment}
    return {"paths": len(paths), "paths_kept": len(kept_p), "tests": len(tests), "tests_kept": len(kept_t),
            "paths_pct": round(100 * len(kept_p) / max(1, len(paths))), "tests_pct": round(100 * len(kept_t) / max(1, len(tests))),
            "comment_chars": len(comment), "synthesis_prompt_chars": out["synthesis_prompt_chars"],
            "max_parallel_spawn": out["max_parallel_spawn"],
            "max_concurrent_reviewers": out.get("max_concurrent_reviewers") or max_overlap(out["timeline"])}


def compare():
    rows = {}
    for mode in ("pass-findings", "lossy"):
        p = EV / f"subagents-{mode}.json"
        if not p.exists():
            raise SystemExit(f"missing {p.name}: run ci_subagents.py --{mode} first")
        rows[mode] = score(json.loads(p.read_text()))
    print(f"{'mode':14s} {'paths kept':>12s} {'tests kept':>12s} {'synthesis prompt':>18s} {'comment':>9s}")
    for mode, s in rows.items():
        print(f"{mode:14s} {s['paths_kept']:>3}/{s['paths']:<3} paths {s['paths_pct']:3d}%  {s['tests_kept']:>3}/{s['tests']:<3} tests {s['tests_pct']:3d}%"
              f"  {s['synthesis_prompt_chars']:>8} chars  {s['comment_chars']:>6} chars")
    pf, lo = rows["pass-findings"], rows["lossy"]
    print(f"parallel spawn: {pf['max_concurrent_reviewers']} reviewers running concurrently "
          f"({pf['max_parallel_spawn']} Agent call(s) in the largest single coordinator message)")
    better = pf["paths_pct"] + pf["tests_pct"] > lo["paths_pct"] + lo["tests_pct"]
    print("VERDICT: pass-findings keeps more of the evidence" if better else "VERDICT: no difference measured; rerun")
    (EV / "subagents-compare.json").write_text(json.dumps(rows, indent=2))
    return 0 if better else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--pass-findings", action="store_true")
    g.add_argument("--lossy", action="store_true")
    g.add_argument("--compare", action="store_true")
    ap.add_argument("--budget", type=float, default=4.0)
    ap.add_argument("--evaluate-only-if-cached", action="store_true", help="exit 0 without running when evidence exists")
    a = ap.parse_args()
    if a.compare:
        sys.exit(compare())
    mode = "lossy" if a.lossy else "pass-findings"
    if a.evaluate_only_if_cached:
        sys.exit(0 if (EV / f"subagents-{mode}.json").exists() else 1)
    asyncio.run(run(mode, a.budget))
