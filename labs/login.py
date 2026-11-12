#!/usr/bin/env python3
"""Check this laptop is signed in to Claude for the live labs, and start the sign-in if not.
Usage: uv run login.py          (prints the sign-in state)
       uv run login.py --login  (opens the browser sign-in when needed)"""
import json, subprocess, sys
import engine

exe = engine.claude_cli()
if not exe: sys.exit("No claude program found. Run: uv sync   (it installs the Agent SDK, which brings its own copy)")
ok, how = engine.login()
if ok:
    print(f"Signed in to Claude ({how}). The live labs are ready."); sys.exit(0)
if "--login" not in sys.argv:
    print("Not signed in yet. Run: uv run login.py --login"); sys.exit(1)
print("Opening the Claude sign-in in your browser. Approve it there, then come back.")
subprocess.call([exe, "auth", "login"])
ok, how = engine.login()
print(f"Signed in to Claude ({how})." if ok else "Still not signed in. Run: uv run login.py --login"); sys.exit(0 if ok else 1)
