"""The estimated API cost line printed at the end of every lab run.

The Agent SDK reports `total_cost_usd` for each Claude run, and the Messages API calls are priced
from their usage at Claude Haiku 5.5 rates (US$0.10 / US$0.50 per million input / output tokens).
The labs run on your Anthropic API key, so this is an estimate of what your key is billed. The launchers (engine.run_steps, run_lab.py) set
LAB_COST_LEDGER to a temporary file; simkit appends one line per finished Claude run, and the
launcher prints the total once the run ends. No SDK import here, so the launchers stay light.
"""
import json
import os
import tempfile

ENV = "LAB_COST_LEDGER"


def new_ledger():
    fd, path = tempfile.mkstemp(prefix="lab-cost-", suffix=".jsonl")
    os.close(fd)
    return path


def record(path, usd):
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"usd": float(usd or 0)}) + "\n")
    except OSError:
        pass


def total(path):
    usd, calls = 0.0, 0
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    usd += float(json.loads(line)["usd"])
                    calls += 1
                except (ValueError, KeyError, TypeError):
                    pass
    except OSError:
        pass
    return usd, calls


def note(usd, calls):
    if not calls:
        return "Estimated API cost: US$0.00. This run made no Claude call."
    runs = f"{calls} Claude run{'s' if calls != 1 else ''}"
    return (f"Estimated API cost: US${usd:.4f} for {runs} on Claude Haiku 5.5, "
            "billed to your Anthropic API key.")


def finish(path):
    """Read the ledger, delete it, and return the line to print."""
    usd, calls = total(path)
    try:
        os.remove(path)
    except OSError:
        pass
    return note(usd, calls)
