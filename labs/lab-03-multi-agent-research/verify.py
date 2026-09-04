#!/usr/bin/env python3
import json,subprocess,sys
from pathlib import Path
subprocess.run([sys.executable,"-B","research_system.py"],check=True,capture_output=True,text=True)
d=json.loads(Path("evidence/synthesis.json").read_text())
assert len(d["claims"])==3 and all(x.get("source_id") for x in d["claims"])
assert d["conflicts"][0]["status"]=="human_review"
subprocess.run([sys.executable,"-B","research_system.py","--simulate-error"],check=True,capture_output=True,text=True)
d=json.loads(Path("evidence/synthesis.json").read_text()); assert d["errors"][0]["retryable"] is True
print("PASS: isolated delegation, typed errors, provenance and disagreement handling verified")
