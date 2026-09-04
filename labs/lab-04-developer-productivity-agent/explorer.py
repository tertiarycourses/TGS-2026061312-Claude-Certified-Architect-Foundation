#!/usr/bin/env python3
import json,sys
from pathlib import Path
symbol=sys.argv[1] if len(sys.argv)>1 else "calculate_total"; root=Path("sample_repo")
candidates=sorted([p for p in root.rglob("*") if p.suffix in {".py",".md"}])
matches=[]
for p in candidates:
    for n,line in enumerate(p.read_text().splitlines(),1):
        if symbol in line: matches.append({"path":str(p),"line":n,"text":line.strip()})
focused=[]
for m in matches:
    p=Path(m["path"]); lines=p.read_text().splitlines(); lo=max(0,m["line"]-3); hi=min(len(lines),m["line"]+5)
    focused.append({"path":str(p),"range":[lo+1,hi],"text":"\n".join(lines[lo:hi])})
deps=["sample_repo/src/validation.py"] if any("validate_items" in f["text"] for f in focused) else []
out={"glob_count":len(candidates),"grep_matches":matches,"focused_reads":focused,"dependencies":deps,"budget":{"files_read":len(focused)+len(deps),"candidate_files":len(candidates)}}
Path("evidence").mkdir(exist_ok=True); Path("evidence/retrieval.json").write_text(json.dumps(out,indent=2)+"\n")
Path("evidence/scratchpad.md").write_text("# Scratchpad\n\nDecision: invoice totals are calculated in `src/billing.py`.\n\nEvidence: `calculate_total` calls `validate_items` before aggregation.\n\nDependency: `src/validation.py`.\n\nOpen question: should tax rate be configuration rather than a default?\n")
print(json.dumps(out,indent=2))
