#!/usr/bin/env python3
"""ls, cat, head, tail, grep, wc and pwd for the built-in terminal on Windows, which has none of them.
engine.typed_command uses this only when the real command is missing. Usage: lookcmd.py <command> [args]"""
import os, re, sys
from pathlib import Path

def files(args):
    return [a for a in args if not a.startswith("-")]

def num(args, default=10):
    for i, a in enumerate(args):
        if a == "-n" and i + 1 < len(args): return int(args[i + 1])
        if re.fullmatch(r"-\d+", a): return int(a[1:])
    return default

def text(p):
    return Path(p).read_text(encoding="utf-8", errors="replace")

def ls(args):
    targets = files(args) or ["."]
    long = any(a.startswith("-") and "l" in a for a in args)
    for t in targets:
        p = Path(t)
        if len(targets) > 1: print(f"{t}:")
        entries = sorted(p.iterdir(), key=lambda x: x.name) if p.is_dir() else [p]
        for e in entries:
            if e.name.startswith(".") and not any("a" in a for a in args if a.startswith("-")): continue
            name = e.name + ("/" if e.is_dir() else "")
            print(f"{e.stat().st_size:>10}  {name}" if long else name)

def cat(args):
    for f in files(args): sys.stdout.write(text(f))

def head(args):
    n = num(args); fs = [f for f in files(args) if not re.fullmatch(r"\d+", f)]
    for f in fs: print("".join(text(f).splitlines(True)[:n]), end="")

def tail(args):
    n = num(args); fs = [f for f in files(args) if not re.fullmatch(r"\d+", f)]
    for f in fs: print("".join(text(f).splitlines(True)[-n:]), end="")

def grep(args):
    flags = "".join(a[1:] for a in args if a.startswith("-") and not a.startswith("--"))
    rest = files(args)
    if not rest: sys.exit("usage: grep [-n] [-i] [-r] PATTERN [FILE...]")
    pat = re.compile(rest[0], re.I if "i" in flags else 0)
    paths = rest[1:] or ["."]
    todo = []
    for p in paths:
        p = Path(p)
        todo += [x for x in p.rglob("*") if x.is_file()] if p.is_dir() else [p]
    found = False
    for f in todo:
        try: lines = text(f).splitlines()
        except OSError: continue
        for i, line in enumerate(lines, 1):
            if pat.search(line):
                found = True
                pre = (f"{f}:" if len(todo) > 1 else "") + (f"{i}:" if "n" in flags else "")
                print(pre + line)
    sys.exit(0 if found else 1)

def wc(args):
    flags = "".join(a[1:] for a in args if a.startswith("-"))
    for f in files(args):
        t = text(f); counts = {"l": t.count("\n"), "w": len(t.split()), "c": len(t.encode("utf-8"))}
        keys = [k for k in "lwc" if k in flags] or list("lwc")
        print(" ".join(f"{counts[k]:>7}" for k in keys), f)

def pwd(args):
    print(os.getcwd())

if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    try:
        {"ls": ls, "cat": cat, "head": head, "tail": tail, "grep": grep, "wc": wc, "pwd": pwd}[cmd](args)
    except FileNotFoundError as e:
        sys.exit(f"{cmd}: {e.filename}: No such file or directory")
