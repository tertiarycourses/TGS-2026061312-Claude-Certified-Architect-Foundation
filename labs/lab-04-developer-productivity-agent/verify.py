#!/usr/bin/env python3
import json,subprocess,sys
from pathlib import Path
subprocess.run([sys.executable,"-B","explorer.py","calculate_total"],check=True,capture_output=True,text=True)
d=json.loads(Path("evidence/retrieval.json").read_text())
assert d["grep_matches"] and "sample_repo/src/validation.py" in d["dependencies"]
assert d["budget"]["files_read"] < d["budget"]["candidate_files"]+2
assert "Open question" in Path("evidence/scratchpad.md").read_text()
print("PASS: progressive retrieval, focused context and durable scratchpad verified")
