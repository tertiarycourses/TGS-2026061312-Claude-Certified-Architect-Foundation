#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def worker(packet, source):
    if source["status"]!="available": return {"ok":False,"code":"SOURCE_UNAVAILABLE","retryable":True,"source_id":source["id"]}
    return {"ok":True,"source_id":source["id"],"claim":source["claim"],"confidence":source["confidence"]}
def run(simulate=False):
    src=json.loads(Path("fixtures/sources.json").read_text())
    if simulate: src[1]["status"]="unavailable"
    packets=[{"task_id":f"R{i+1}","source_id":s["id"],"tools":["read_assigned_source"]} for i,s in enumerate(src)]
    results=[worker(p,s) for p,s in zip(packets,src)]
    claims=[r for r in results if r["ok"]]; errors=[r for r in results if not r["ok"]]
    out={"claims":claims,"errors":errors,"conflicts":[{"topic":"production writes","sources":["SRC-A","SRC-B"],"status":"human_review"}],"task_packets":packets}
    Path("evidence").mkdir(exist_ok=True); Path("evidence/synthesis.json").write_text(json.dumps(out,indent=2)+"\n")
    return out
if __name__=="__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("--show-plan",action="store_true"); ap.add_argument("--simulate-error",action="store_true"); a=ap.parse_args()
    if a.show_plan: print(json.dumps([{"task_id":f"R{i}","context":"isolated","tools":["read_assigned_source"]} for i in range(1,4)],indent=2))
    else: print(json.dumps(run(a.simulate_error),indent=2))
