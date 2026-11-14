# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 37: a coordinator that delegates to subagents, all on the Claude API.
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
