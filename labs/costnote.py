"""The estimated API cost line printed at the end of every lab run.

The Agent SDK reports `total_cost_usd` for each Claude run: the tokens used, priced at Claude API
rates. Learners run the labs on their own Claude subscription (OAuth sign-in), so this is a
simulated API bill, not a charge. The launchers (engine.run_steps, run_lab.py) set
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
    return (f"Estimated API cost: US${usd:.4f} for {runs}, priced at Claude API rates. "
            "This is a simulation: on your Claude subscription you are not charged this amount, "
            "and the run counts toward your plan's usage limits instead.")


def finish(path):
    """Read the ledger, delete it, and return the line to print."""
    usd, calls = total(path)
    try:
        os.remove(path)
    except OSError:
        pass
    return note(usd, calls)
