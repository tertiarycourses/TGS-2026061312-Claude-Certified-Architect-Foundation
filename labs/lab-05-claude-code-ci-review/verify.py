#!/usr/bin/env python3
import json,subprocess,sys
from pathlib import Path
subprocess.run([sys.executable,"-B","ci_review.py","fixtures/changes.json"],check=True,capture_output=True,text=True)
d=json.loads(Path("evidence/review.json").read_text()); required={"file","line","severity","evidence","remediation"}
assert all(required <= set(f) for f in d["findings"])
assert {f["pass"] for f in d["findings"]}=={"per-file","integration"} and d["exit_gate"]=="fail"
print("PASS: schema contract, two-pass review, evidence filter and exit gate verified")
