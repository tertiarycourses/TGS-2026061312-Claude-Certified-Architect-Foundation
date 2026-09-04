#!/usr/bin/env python3
import json, subprocess, sys
from pathlib import Path
subprocess.run([sys.executable,"-B","support_agent.py","--case","fixtures/eligible.json"],check=True,capture_output=True,text=True)
d=json.loads(Path("evidence/session.json").read_text())
assert d["terminal_state"]=="ESCALATE" and d["tool_result"]["code"]=="APPROVAL_REQUIRED"
assert d["tool_result"]["data"]["executed"] is False and d["idempotency_key"].startswith("refund:")
subprocess.run([sys.executable,"-B","support_agent.py","--case","fixtures/ambiguous.json"],check=True,capture_output=True,text=True)
d=json.loads(Path("evidence/session.json").read_text()); assert d["tool_result"]["code"]=="AMBIGUOUS_EVIDENCE"
print("PASS: bounded loop, eligibility gate, typed escalation and checkpoint verified")
