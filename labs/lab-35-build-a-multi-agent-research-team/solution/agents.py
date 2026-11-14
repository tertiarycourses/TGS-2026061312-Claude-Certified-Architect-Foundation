"""The three subagents. Each run starts a FRESH conversation that holds only its task: no subagent sees the
coordinator's messages or another subagent's work. Each gets only its own tools."""
import json
import re
import sys

import anthropic
from dotenv import load_dotenv

from research_tools import TOOLS, run_tool

load_dotenv()
MODEL = "claude-haiku-5-5"

AGENTS = {
    "search": {
        "tools": ["search_web"],
        "system": """You are a web-search subagent. Research only the sector named in your task, with at most two search_web calls.
Return ONLY a JSON object: {"sector": str, "findings": [{"claim": str, "source_url": str, "source_title": str, "published": str}], "gaps": [str]}.
Every claim must come from a search result; copy its url exactly. The search index is a small curated sandbox: treat its
results as authoritative and do not comment on the sources. "gaps" lists only searches that failed or found nothing: if a
search fails, keep any partial_results as findings and add a gap that says what failed and for which query. Never invent a source.""",
    },
    "documents": {
        "tools": ["read_document"],
        "system": """You are a document-analysis subagent. Read every document named in your task with read_document.
Return ONLY a JSON object: {"findings": [{"claim": str, "source": "<file name>, p.<page>", "evidence": "<kind of document and its method>"}], "gaps": [str]}.
Say which findings are peer-reviewed and which come from a vendor. "gaps" lists only documents you could not read.
Never invent a source.""",
    },
    "synthesis": {
        "tools": [],
        "system": """You are a synthesis subagent. Write a short research report using ONLY the findings in your task.
Return ONLY a JSON object: {"title": str, "summary": str, "findings": [{"sector": str, "claim": str, "source": str}], "gaps": [str]}.
Summary under 80 words. One finding per source, and every finding keeps its source (url or document reference) exactly
as given: never a finding without a source. "gaps" lists, one line each, the failed searches, the searches that found
nothing and the unreadable documents you were told about.""",
    },
}


def parse_json(text):
    """Pull the JSON object out of a reply, even when it is wrapped in ``` fences."""
    m = re.search(r"\{.*\}", text, re.S)
    try:
        return json.loads(m.group(0)) if m else None
    except json.JSONDecodeError:
        return None


def run_subagent(agent, task, max_turns=6):
    """Run one subagent on its task in a fresh context. Returns {"agent", "task", "text", "json", "calls"}."""
    spec = AGENTS[agent]
    client = anthropic.Anthropic()
    tools = [TOOLS[t] for t in spec["tools"]]
    messages = [{"role": "user", "content": task}]          # the task is ALL this subagent knows
    calls = []
    for _ in range(max_turns):
        kwargs = {"tools": tools} if tools else {}
        response = client.messages.create(model=MODEL, max_tokens=8000, system=spec["system"], messages=messages, **kwargs)
        messages.append({"role": "assistant", "content": response.content})
        if response.stop_reason != "tool_use":
            text = "".join(b.text for b in response.content if b.type == "text")
            return {"agent": agent, "task": task, "text": text, "json": parse_json(text), "calls": calls}
        results = []
        for block in response.content:
            if block.type == "tool_use":
                if block.name not in spec["tools"]:                     # a subagent may only use its own tools
                    result, is_error = {"message": f"{block.name} is not available to this agent"}, True
                else:
                    result, is_error = run_tool(block.name, block.input)
                calls.append({"tool": block.name, "input": block.input, "result": result, "is_error": is_error})
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(result), "is_error": is_error})
        messages.append({"role": "user", "content": results})
    return {"agent": agent, "task": task, "text": "(stopped: turn limit)", "json": None, "calls": calls}


if __name__ == "__main__":
    out = run_subagent(sys.argv[1], sys.argv[2])
    for c in out["calls"]:
        print(f"  {c['tool']}({c['input']}) -> {'ERROR ' if c['is_error'] else ''}{json.dumps(c['result'])[:160]}")
    print(out["text"])
