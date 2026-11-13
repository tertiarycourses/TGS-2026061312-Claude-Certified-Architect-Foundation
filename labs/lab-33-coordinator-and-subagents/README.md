# Lab 33: Be the coordinator: brief your subagents or they work blind

> Day 2 · Topic 1: Agentic Architecture & Orchestration · Task statements 1.2, 1.3 · Code lab · Claude Haiku 5.5

**A subagent starts with an empty head. Whatever the coordinator leaves out of the brief, the subagent never knows.**

## What you'll do

Build a coordinator that launches subagents as tool calls, runs them in parallel, and combines their findings. Then starve the subagents of context and watch what they lose.

## What's in this folder

| File | What it is |
|---|---|
| `coordinator.py` | coordinator + run_subagent tool; each subagent is a fresh messages.create call |

## Before you start

- Open a terminal in the labs folder. Windows: use Git Bash for the .sh scripts (it comes with Git); PowerShell is fine for the Python ones.
- Set your Anthropic API key once, if you haven't already. It is saved to labs/.env on your laptop and never uploaded. Run `uv run set_api_key.py`.
- Go into this lab's folder. Run `cd lab-33-coordinator-and-subagents`.

You need uv (https://docs.astral.sh/uv/) for the Python scripts. Every call uses Claude Haiku 5.5 and costs a fraction of a US cent.

## Steps

**Step 1.** Run the coordinator. Note how many subagents it launches in ONE response and what context each one gets.

```
uv run coordinator.py
```

**Step 2.** Run it again, but tell the coordinator to pass only the task name.

```
uv run coordinator.py --thin
```

**Step 3.** Compare the 'context passed' lines and the final recommendation of the two runs.

## What you should see

From a live run on Claude Haiku 5.5 (your wording will differ; the behaviour should not):

- `Coordinator turn 1: stop_reason=tool_use, subagents launched: 3`
- context passed: 'costs: Staffing quote: evening chat shift costs SGD 14,500/month; an AI chat agent pilot costs SGD 3,200/month.'
- --thin: context passed: 'Should we add evening chat support?' and the coordinator notes the subagents 'received only the task name, not the source figures'.

The full output of our run is in `sample-output.txt`.

## The key lines, explained

In `coordinator.py`, look for the `KEY` comments:

- **KEY 1.** A subagent is a brand-new conversation: its own system prompt plus the brief. No shared memory, no access to the coordinator's sources.
- **KEY 2.** Print what each subagent was handed. This is the line to debug when a report comes back thin.
- **KEY 3.** Parallel tool calls run at the same time, so three subagents take about as long as one.
- **KEY 4.** All tool_result blocks return in one user message, so the coordinator sees every finding together.

## The code: `coordinator.py`

```python
# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 33: a coordinator that delegates to subagents, all on the Claude API.
Each subagent is a FRESH messages.create call: it sees only the brief the coordinator writes.
Run:  uv run coordinator.py
      uv run coordinator.py --thin     (the coordinator is told to pass task names only: watch quality drop)"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"
THIN = "--thin" in sys.argv

SOURCES = {  # what the coordinator knows; subagents know nothing unless it is passed on
    "survey": "Q3 survey, 1,240 customers: 61% want chat support after 6pm; 22% would pay for priority support.",
    "tickets": "Ticket log Jul-Sep: 38% of tickets arrive 6pm-11pm; median first response after 6pm is 9h 40m.",
    "costs": "Staffing quote: evening chat shift costs SGD 14,500/month; an AI chat agent pilot costs SGD 3,200/month.",
}

DELEGATE = {
    "name": "run_subagent",
    "description": ("Start a specialist subagent. It starts with an EMPTY context: it cannot see this conversation, "
                    "the sources or other subagents. Put every fact it needs into `context`."),
    "input_schema": {"type": "object", "properties": {
        "role": {"type": "string", "description": "e.g. 'demand analyst', 'cost analyst'"},
        "task": {"type": "string", "description": "One concrete question to answer"},
        "context": {"type": "string", "description": "All source text and figures the subagent needs, quoted in full"}},
        "required": ["role", "task", "context"]},
}

COORDINATOR_SYSTEM = (
    "You coordinate an analysis team. Split the question into independent parts and call run_subagent for each part, "
    "all in ONE response so they run in parallel. Then combine their findings into a recommendation that cites figures.\n"
    + ("Pass only the task name in `context`, nothing else." if THIN else "Quote the relevant source text in `context`.")
```

```python
    + "\n\nSources:\n" + "\n".join(f"- {k}: {v}" for k, v in SOURCES.items()))


def subagent(role, task, context):
    """KEY 1: a brand-new conversation. Its whole world is this system prompt plus the brief."""
    r = client.messages.create(model=MODEL, max_tokens=4096,
                               system=f"You are a {role}. Use only the context given. If a figure is missing, say so.",
                               messages=[{"role": "user", "content": f"Task: {task}\n\nContext:\n{context}"}])
    text = "".join(b.text for b in r.content if b.type == "text")
    return text or f"(subagent stopped with {r.stop_reason} and wrote no answer)"


messages = [{"role": "user", "content": "Should we add evening chat support? Recommend a human shift or an AI pilot."}]
for turn in range(1, 6):
    response = client.messages.create(model=MODEL, max_tokens=4096, system=COORDINATOR_SYSTEM,
                                      tools=[DELEGATE], messages=messages)
    messages.append({"role": "assistant", "content": response.content})
    calls = [b for b in response.content if b.type == "tool_use"]
    print(f"Coordinator turn {turn}: stop_reason={response.stop_reason}, subagents launched: {len(calls)}")
    if response.stop_reason != "tool_use":
        print("\n=== Recommendation\n" + "".join(b.text for b in response.content if b.type == "text"))
        break
    for c in calls:  # KEY 2: show exactly what each subagent was given
        print(f"   -> {c.input['role']}: {c.input['task']}\n      context passed: {c.input['context'][:140]!r}")
    with ThreadPoolExecutor() as pool:  # KEY 3: the parallel calls run at the same time
        outputs = list(pool.map(lambda c: subagent(**c.input), calls))
    messages.append({"role": "user", "content": [  # KEY 4: all results in one user message
        {"type": "tool_result", "tool_use_id": c.id, "content": out} for c, out in zip(calls, outputs)]})
```

## Try this

Give each subagent a different system prompt role (sceptic, optimist) and see whether the coordinator's recommendation changes.

## How this shows up in the exam

Tasks 1.2-1.3: the coordinator routes everything; subagents do not inherit its context, so the brief must carry the facts. A thin report means fix the coordinator's decomposition and briefs, not the workers.
