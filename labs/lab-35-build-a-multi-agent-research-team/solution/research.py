"""The coordinator of a multi-agent research team (Scenario 3). It plans, delegates to subagents, and runs every
delegation from one turn IN PARALLEL. Run:  uv run research.py "Impact of AI on creative industries" [--plan "a; b; c"]"""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import anthropic
from dotenv import load_dotenv

from agents import AGENTS, MODEL, run_subagent
from research_tools import DATA, sector_of

load_dotenv()
MAX_TURNS = 8
SYSTEM = """You are the coordinator of a research team. You never search or read documents yourself: you delegate.
1. Decompose the topic into the distinct sectors it spans. For creative industries, cover at least music, writing,
   film and visual arts. Breadth first: a narrow plan makes a narrow report.
2. In ONE turn, delegate one "search" task per sector (they run in parallel), plus one "documents" task that names
   both internal documents: Halden-Rao-2026-Journal-of-Creative-Economies.pdf and BrightCanvas-Customer-Benchmark-2026.pdf.
3. Subagents see nothing but their task text. Put everything a subagent needs in its task.
4. When the results are back, delegate ONE "synthesis" task. Paste into it every finding with its exact source and
   every gap the subagents reported.
5. Then reply with a two-sentence summary for the user."""
RULE_1 = SYSTEM.split("\n2.")[0].split("\n", 1)[1]        # rule 1, the decomposition rule
DELEGATE = {
    "name": "delegate",
    "description": "Give one task to a subagent and get its result back. agent: 'search' (web search on one sector), "
                   "'documents' (reads the internal PDFs), 'synthesis' (writes the final report from the findings you paste in). "
                   "The subagent sees ONLY the task text, never this conversation.",
    "input_schema": {"type": "object", "properties": {
        "agent": {"type": "string", "enum": list(AGENTS)},
        "task": {"type": "string", "description": "everything the subagent needs to know"}},
        "required": ["agent", "task"]},
}


def coverage(delegations):
    """Which sectors were actually searched, and which were never searched at all."""
    searched = {c["result"].get("sector") or sector_of(c["input"].get("query", ""))
                for d in delegations for c in d["calls"] if c["tool"] == "search_web"}
    return sorted(s for s in searched if s), sorted(set(DATA["sectors"]) - searched)


def run_research(topic, plan=None):
    client = anthropic.Anthropic()
    system = SYSTEM
    if plan:   # replay a fixed decomposition, e.g. the narrow one from the exam question
        system = SYSTEM.replace(RULE_1, f"1. Follow exactly this research plan, one search task per subtask and nothing else: {plan}")
    messages = [{"role": "user", "content": f"Research topic: {topic}"}]
    delegations, summary = [], ""
    for turn in range(1, MAX_TURNS + 1):
        response = client.messages.create(model=MODEL, max_tokens=8000, system=system, tools=[DELEGATE], messages=messages)
        messages.append({"role": "assistant", "content": response.content})
        uses = [b for b in response.content if b.type == "tool_use"]
        print(f"\nCoordinator turn {turn}: stop_reason={response.stop_reason}, {len(uses)} delegation(s)")
        if response.stop_reason != "tool_use":
            summary = "".join(b.text for b in response.content if b.type == "text")
            break
        t0 = time.time()
        with ThreadPoolExecutor() as pool:                     # every delegation from this turn runs at once
            outs = list(pool.map(lambda b: run_subagent(b.input["agent"], b.input["task"]), uses))
        results = []
        for block, out in zip(uses, outs):
            out["turn"] = turn
            delegations.append(out)
            print(f"  -> {out['agent']}: {out['task'][:90]!r} ({len(out['calls'])} tool calls)")
            for c in out["calls"]:
                print(f"       {c['tool']}({json.dumps(c['input'])}) {'ERROR ' + c['result'].get('errorCategory', '') if c['is_error'] else 'ok'}")
            results.append({"type": "tool_result", "tool_use_id": block.id, "content": out["text"]})
        print(f"  ({len(uses)} subagent(s) in {time.time() - t0:.0f}s)")
        messages.append({"role": "user", "content": results})
    synth = [d for d in delegations if d["agent"] == "synthesis"]
    report = synth[-1]["json"] if synth and synth[-1]["json"] else {}
    searched, missing = coverage(delegations)
    return {"topic": topic, "summary": summary, "report": report, "delegations": delegations,
            "searched": searched, "missing": missing}


def to_markdown(r):
    rep = r["report"]
    lines = [f"# {rep.get('title', r['topic'])}", "", rep.get("summary", ""), ""]
    lines += [f"- **{f.get('sector', '')}**: {f.get('claim', '')} ({f.get('source', '')})" for f in rep.get("findings", [])]
    lines += ["", "## Gaps"] + [f"- {g}" for g in rep.get("gaps", [])] or ["- none"]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    args = sys.argv[1:]
    plan = args[args.index("--plan") + 1] if "--plan" in args else None
    topic = next((a for a in args if a != "--plan" and a != plan), "Impact of AI on creative industries")
    r = run_research(topic, plan)
    with open("report.json", "w") as f:
        json.dump(r["report"], f, indent=2)
    with open("report.md", "w") as f:
        f.write(to_markdown(r))
    print("\n=== Report (report.md) ===\n" + to_markdown(r))
    print(f"Coverage: searched {', '.join(r['searched']) or 'nothing'}; never searched: {', '.join(r['missing']) or 'none'}")
    print("\n=== Coordinator ===\n" + r["summary"])
