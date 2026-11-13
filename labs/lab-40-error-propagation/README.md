# Lab 40: When a subagent fails, tell the coordinator everything

> Day 2 · Topic 5: Context Management & Reliability · Task statement 5.3 · Code lab · Claude Haiku 5.5

**'search failed' got a blind retry and lost a source. A structured error got no wasted retry and an honest gap.**

## What you'll do

Make one of three search subagents time out, and compare a structured error (what failed, what was tried, partial results, retryable) with a generic one.

## What's in this folder

| File | What it is |
|---|---|
| `research_errors.py` | coordinator with three search sources, one of which times out |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-40-error-propagation`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Run with the structured error. Note that the coordinator does not retry and uses the partial result.

```
uv run research_errors.py
```

**Step 2.** Run with the generic error.

```
uv run research_errors.py --generic
```

**Step 3.** Compare: how many news searches ran, and did the Straits Times result make it into the brief?

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `Structured: one news search, brief says 'News coverage is incomplete... only one article was retrieved'`
- Generic: search_source(news) -> ERROR "search failed" twice, and the partial news result is missing from the brief

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `research_errors.py`, look for the `KEY` comments:

- **KEY 1.** A generic error gives the coordinator nothing to act on.
- **KEY 2.** A structured error: type, what was attempted, partial results, retryable, and a suggestion.
- **KEY 3.** Flag it with is_error so the coordinator knows this source failed rather than came back empty.

## The code: `research_errors.py`

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 40: when a subagent fails, tell the coordinator everything it needs to decide what to do next.
One of three search subagents times out. Compare a structured error with a generic one.
Run:  uv run research_errors.py            (structured error: what failed, what was tried, partial results, retryable?)
      uv run research_errors.py --generic  (the subagent just says "search failed")"""
import json
import sys
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"
GENERIC = "--generic" in sys.argv

SOURCES = {
    "industry_reports": {"ok": True, "findings": ["Gartner (2026): 41% of retailers run AI chat for after-hours support."]},
    "academic": {"ok": True, "findings": ["Field study, 3 retailers: AI chat resolved 52% of evening tickets without a human."]},
    "news": {"ok": False, "partial": ["Straits Times, 2 Nov 2026: local retailer reports 30% fewer complaints after AI chat pilot."]},
}

SEARCH = {"name": "search_source",
          "description": "Run the search subagent on ONE source: industry_reports, academic or news. Returns findings or a structured error.",
          "input_schema": {"type": "object", "properties": {"source": {"type": "string", "enum": list(SOURCES)}},
                           "required": ["source"]}}


def search_source(source):
    s = SOURCES[source]
    if s["ok"]:
        return False, {"source": source, "status": "ok", "findings": s["findings"]}
    if GENERIC:
        return True, "search failed"                              # KEY 1: the agent learns nothing it can act on
    return True, {"source": source, "status": "error",            # KEY 2: everything the coordinator needs to decide
                  "error_type": "timeout", "attempted": "news archive query 'AI chat retail', 30s limit, 2 tries",
                  "partial_results": s["partial"], "retryable": False,
                  "suggestion": "Report with the partial result and mark news coverage as incomplete."}
```

```python


messages = [{"role": "user", "content": "Research: is AI chat effective for after-hours retail support? "
             "Search all three sources, then write a 5-line brief. Mark any gap in coverage."}]
for turn in range(1, 8):
    r = client.messages.create(model=MODEL, max_tokens=4096, tools=[SEARCH], messages=messages,
                               system="You are a research coordinator. Never present partial evidence as complete.")
    messages.append({"role": "assistant", "content": r.content})
    if r.stop_reason != "tool_use":
        print("\n=== Brief\n" + "".join(b.text for b in r.content if b.type == "text"))
        break
    results = []
    for b in r.content:
        if b.type == "tool_use":
            is_error, out = search_source(**b.input)
            print(f"Turn {turn}: search_source({b.input['source']}) -> {'ERROR ' if is_error else ''}{json.dumps(out)[:110]}")
            results.append({"type": "tool_result", "tool_use_id": b.id, "is_error": is_error,   # KEY 3: flag it as an error
                            "content": json.dumps(out) if isinstance(out, dict) else out})
    messages.append({"role": "user", "content": results})
```

## Try this

Set retryable to True in the structured error and see whether the coordinator retries.

## How this shows up in the exam

Task 5.3: propagate the failure with context (type, attempt, partial results) so the coordinator can retry, route around or report the gap; never silently drop it or report success.
