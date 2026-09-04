#!/usr/bin/env python3
import json,sys
from pathlib import Path
changes=json.loads(Path(sys.argv[1]).read_text())["files"]; findings=[]
if "refund(" in changes.get("api.py","") and "idempotency" not in changes.get("api.py",""):
    findings.append({"file":"api.py","line":1,"severity":"high","evidence":"refund calls the gateway without an idempotency key","remediation":"derive and pass a stable order-scoped idempotency key","pass":"per-file"})
if "event['order_id']" in changes.get("handler.py","") and "refund(" in changes.get("api.py",""):
    findings.append({"file":"handler.py","line":1,"severity":"medium","evidence":"the handler forwards an unvalidated event value into a side-effecting refund path","remediation":"validate the event schema and authorization before calling refund","pass":"integration"})
out={"findings":findings,"summary":f"{len(findings)} actionable findings","exit_gate":"fail" if any(f["severity"]=="high" for f in findings) else "pass"}
Path("evidence").mkdir(exist_ok=True); Path("evidence/review.json").write_text(json.dumps(out,indent=2)+"\n"); print(json.dumps(out,indent=2))
