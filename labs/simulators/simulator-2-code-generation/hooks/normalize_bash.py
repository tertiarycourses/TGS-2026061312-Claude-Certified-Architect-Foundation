#!/usr/bin/env python3
"""PostToolUse hook for Bash: drop dependency warnings and absolute paths from stdout.

Reads the hook JSON on stdin and returns updatedToolOutput in the Bash result
shape ({stdout, stderr, interrupted}). The command itself already ran; this
only changes what Claude reads next.
"""
import json, re, sys
d = json.load(sys.stdin)
resp = d.get("tool_response") or {}
stdout = resp.get("stdout", "") if isinstance(resp, dict) else str(resp)
keep = [l for l in stdout.splitlines() if "npm WARN" not in l and "DeprecationWarning" not in l]
norm = "\n".join(re.sub(r"(/Users|/home|/private)/\S+?/(?=tests/|src/)", "<repo>/", l) for l in keep)
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse",
      "updatedToolOutput": {"stdout": norm, "stderr": resp.get("stderr", "") if isinstance(resp, dict) else "", "interrupted": False}}}))
