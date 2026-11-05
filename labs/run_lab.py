#!/usr/bin/env python3
"""Run any course lab on its simulator.

  uv run run_lab.py --list            every lab, by topic
  uv run run_lab.py --list --core     only the labs run in class
  uv run run_lab.py 18 --show         print the lab, no Claude call, no cost
  uv run run_lab.py 18                pick your answer, run it, then see the reasoning
  uv run run_lab.py 18 --yes          run without pausing (for demos)
  uv run run_lab.py 18 --question     the situation only, no answer (Claude Code's /lab uses this)
  uv run run_lab.py 18 --answer       the answer, the reasoning and what to change next

A lab is one exam situation. A simulator is the system it runs on. Every command runs
from the simulator's own folder and writes to that simulator's evidence/ folder.
"""
import argparse, json, subprocess, sys, textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
LABS = json.loads((HERE / "labs.json").read_text())
W = 92

def wrap(t, indent=""):
    return "\n".join(textwrap.fill(p, W, initial_indent=indent, subsequent_indent=indent) for p in str(t).split("\n"))

def listing(core_only):
    topic = None
    for l in LABS:
        if core_only and not l["core"]:
            continue
        if l["topic"] != topic:
            topic = l["topic"]
            print(f"\nTopic {topic}: {l['topic_name']}")
        star = "*" if l["core"] else " "
        print(f" {star}{l['id']:>3}  Task {l['task']}  Sim {l['sim']}  {l['title']}")
    print("\n* run in class. The rest are self-practice.")

def header(l):
    print("=" * W)
    print(wrap(f"Lab {l['id']}: {l['title']}"))
    print(f"Topic {l['topic']} · Task {l['task']} {l['task_title']}")
    print(f"Simulator {l['sim']}: {l['sim_name']} · {l['source']}")
    print("=" * W)

def question(l):
    print()
    print(wrap(l.get("stem") or l["trap"]))
    if l.get("options"):
        print()
        for k, v in l["options"].items():
            print(wrap(f"{k}. {v}", "  "))

def reveal(l):
    print("\nThe design to avoid: " + l["trap"])
    print("The answer: " + (f"{l['answer']}. " if l.get("answer") else "") + l["fix"])
    if l.get("why"):
        print("\nWhy:\n" + wrap(l["why"], "  "))
    for k, v in (l.get("wrong") or {}).items():
        print(wrap(f"{k} fails: {v}", "  "))

def evidence_note(l):
    print("\nWhat you should see: " + l["see"])
    print(f"Evidence folder: simulators/{l['dir']}/evidence/")
    if l.get("try"):
        print("Then change one thing: " + l["try"])

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lab", nargs="?", type=int)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--core", action="store_true")
    ap.add_argument("--show", action="store_true", help="print the lab and its commands, make no Claude call")
    ap.add_argument("--yes", action="store_true", help="do not pause for your answer")
    ap.add_argument("--question", action="store_true", help="print the situation and commands, not the answer")
    ap.add_argument("--answer", action="store_true", help="print the answer and what to change next")
    a = ap.parse_args()
    if a.list or a.lab is None:
        return listing(a.core)
    match = [l for l in LABS if l["id"] == a.lab]
    if not match:
        sys.exit(f"No lab {a.lab}. Try: uv run run_lab.py --list")
    l = match[0]
    header(l)
    if a.answer:
        reveal(l)
        return evidence_note(l)
    question(l)
    if a.question:
        print("\nCommands (run from simulators/" + l["dir"] + "):")
        for c in l["cmds"]:
            print("  $ " + c)
        return
    if a.show:
        print("\nCommands (run from simulators/" + l["dir"] + "):")
        for c in l["cmds"]:
            print("  $ " + c)
        reveal(l)
        return evidence_note(l)
    if not a.yes and sys.stdin.isatty():
        pick = input("\nYour answer, and why? ")
        print(f"Noted: {pick}")
    sim = HERE / "simulators" / l["dir"]
    status = 0
    for c in l["cmds"]:
        if c.startswith("#"):
            print("\n" + c)
            continue
        print(f"\n$ {c}")
        status = subprocess.call(c, shell=True, cwd=sim) or status
    reveal(l)
    evidence_note(l)
    print(f"\nSimulator exit status: {status}. Some gates exit non-zero on purpose; read the lab's guide.")

if __name__ == "__main__":
    main()
