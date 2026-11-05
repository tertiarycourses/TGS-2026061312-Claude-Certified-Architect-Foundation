#!/usr/bin/env python3
"""Simulator 3 drill (practice-test Q7): where does testing guidance belong?

Materialises a small TypeScript-style repo under repo-rules/ (three top-level
folders, each with an implementation file and a sibling *.test.ts), then tries
four ways of placing the same testing guidance and asks `claude -p` to edit a
test file and an implementation file under each one. The guidance carries a
token, so the final reply shows whether the guidance was loaded.

  A  .claude/rules/testing.md with NO frontmatter   -> loads always
  B  guidance inside the root CLAUDE.md             -> loads always
  C  a CLAUDE.md copied into every folder           -> loads for any file in those folders, N copies
  D  .claude/rules/testing.md, paths: ["**/*.test.ts"] -> loads only for the test-file edit, one copy

    uv run rules_sim.py            # eight Claude calls through the Agent SDK, evidence/rules_sim.json
    uv run rules_sim.py D          # one variant
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE / "repo-rules"
EVIDENCE = HERE / "evidence"
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
TOKEN = "TESTING-GUIDANCE-LOADED"
FOLDERS = ["citation-verification", "report-rendering", "orchestration"]

GUIDANCE = f"""# Testing guidance

- Tests sit beside the implementation they cover (`foo.ts` next to `foo.test.ts`).
- Every new assertion needs a one-line comment naming the behaviour it protects.
- Never weaken an existing assertion to make a test pass.
- When this testing guidance is loaded, begin your reply with the token {TOKEN} and
  name the file this guidance came from.
"""

FILES = {
    "citation-verification/verifier.ts": "export function verifyCitation(c: {url: string; date?: string}): boolean {\n  return c.url.startsWith('https://') && Boolean(c.date);\n}\n",
    "citation-verification/verifier.test.ts": "import { verifyCitation } from './verifier';\n\ntest('accepts a dated https citation', () => {\n  expect(verifyCitation({url: 'https://a.org', date: '2026-01-01'})).toBe(true);\n});\n",
    "report-rendering/renderer.ts": "export function renderTable(rows: string[][]): string {\n  const header = '| Claim | Value | Source | Published |';\n  return [header, ...rows.map(r => '| ' + r.join(' | ') + ' |')].join('\\n');\n}\n",
    "report-rendering/renderer.test.ts": "import { renderTable } from './renderer';\n\ntest('renders the header row', () => {\n  expect(renderTable([])).toContain('| Claim |');\n});\n",
    "orchestration/orchestrator.ts": "export function plan(topic: string): string[] {\n  return ['music', 'writing', 'film', 'visual arts'].map(s => `${topic}: ${s}`);\n}\n",
    "orchestration/orchestrator.test.ts": "import { plan } from './orchestrator';\n\ntest('plans four sectors', () => {\n  expect(plan('AI')).toHaveLength(4);\n});\n",
}
ROOT_CLAUDE = "# Research system repo\n\nTypeScript monorepo for the multi-agent research system. Do not run commands in this sandbox; edit and report.\n"

PROMPTS = {
    "test": "In orchestration/orchestrator.test.ts add one more assertion inside the existing test that checks the first planned item contains 'music'. Edit the file, do not run any command, then reply in at most three lines.",
    "impl": "In report-rendering/renderer.ts change the header line so the last column reads 'Date' instead of 'Published'. Edit the file, do not run any command, then reply in at most three lines.",
}


def materialise(variant: str) -> int:
    """Write the repo for one variant; return how many files carry the guidance."""
    if REPO.exists():
        shutil.rmtree(REPO)
    for rel, body in FILES.items():
        p = REPO / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body)
    copies = 0
    root = ROOT_CLAUDE
    if variant == "A":
        (REPO / ".claude" / "rules").mkdir(parents=True)
        (REPO / ".claude" / "rules" / "testing.md").write_text(GUIDANCE)
        copies = 1
    elif variant == "B":
        root += "\n" + GUIDANCE
        copies = 1
    elif variant == "C":
        for f in FOLDERS:
            (REPO / f / "CLAUDE.md").write_text(GUIDANCE)
        copies = len(FOLDERS)
    elif variant == "D":
        (REPO / ".claude" / "rules").mkdir(parents=True)
        (REPO / ".claude" / "rules" / "testing.md").write_text('---\npaths: ["**/*.test.ts"]\n---\n' + GUIDANCE)
        copies = 1
    (REPO / "CLAUDE.md").write_text(root)
    return copies


def run_claude(prompt: str) -> dict:
    cmd = ["claude", "-p", prompt, "--model", MODEL, "--max-turns", "8",
           "--allowedTools", "Read,Edit", "--disallowedTools", "Bash", "--output-format", "json"]
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}   # allow nesting inside a Claude Code session
    r = simkit.run_cli(cmd, cwd=REPO)
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        data = {"result": r.stdout, "stderr": r.stderr[-500:], "is_error": True}
    return {"result": data.get("result") or "", "cost_usd": data.get("total_cost_usd"),
            "turns": data.get("num_turns"), "subtype": data.get("subtype"),
            "is_error": data.get("is_error", False) or not data.get("result")}


def main():
    EVIDENCE.mkdir(exist_ok=True)
    variants = [v for v in sys.argv[1:] if v in "ABCD"] or list("ABCD")
    out = {"model": MODEL, "token": TOKEN, "variants": {}}
    for v in variants:
        copies = materialise(v)
        rec = {"guidance_copies": copies, "runs": {}}
        for kind, prompt in PROMPTS.items():
            res = run_claude(prompt)
            if res["is_error"]:                      # empty reply (max turns, API error): one retry, else inconclusive
                res = run_claude(prompt)
            res["token_seen"] = TOKEN in res["result"]
            res["inconclusive"] = res["is_error"]
            rec["runs"][kind] = res
            print(f"[{v}:{kind}] token={'yes' if res['token_seen'] else 'no '} turns={res['turns']} cost=${(res['cost_usd'] or 0):.3f}")
        out["variants"][v] = rec
    (EVIDENCE / "rules_sim.json").write_text(json.dumps(out, indent=2))
    print("\nvariant | guidance placed in                      | copies | test edit | impl edit")
    print("--------+-----------------------------------------+--------+-----------+----------")
    where = {"A": ".claude/rules/testing.md, no frontmatter", "B": "root CLAUDE.md",
             "C": "CLAUDE.md in every folder", "D": ".claude/rules/testing.md, paths: **/*.test.ts"}
    for v, rec in out["variants"].items():
        t = rec["runs"]["test"]["token_seen"]; i = rec["runs"]["impl"]["token_seen"]
        cell = lambda r: "n/a" if r["inconclusive"] else ("yes" if r["token_seen"] else "no ")
        print(f"   {v}    | {where[v]:<39} |   {rec['guidance_copies']}    |   {cell(rec['runs']['test'])}     |   {cell(rec['runs']['impl'])}")
    total = sum((r["cost_usd"] or 0) for rec in out["variants"].values() for r in rec["runs"].values())
    print(f"\ntotal cost: ${total:.3f}   evidence/rules_sim.json")


if __name__ == "__main__":
    main()
