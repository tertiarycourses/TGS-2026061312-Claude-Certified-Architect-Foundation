#!/usr/bin/env python3
import json,subprocess,sys
from pathlib import Path
subprocess.run([sys.executable,"-B","extract.py","--batch-size","2"],check=True,capture_output=True,text=True)
d=json.loads(Path("evidence/extraction.json").read_text()); req={"source_id","invoice_id","subtotal","tax","total","confidence","review"}
assert all(req <= set(r) and r["valid"] for r in d["records"])
amb=[r for r in d["records"] if r["source_id"]=="SRC-02"][0]
assert amb["retry_count"]==1 and amb["review"]=="human" and amb["feedback"]
assert len(d["manifest"])==2
print("PASS: batching, semantic validation, bounded retry, confidence and provenance verified")
