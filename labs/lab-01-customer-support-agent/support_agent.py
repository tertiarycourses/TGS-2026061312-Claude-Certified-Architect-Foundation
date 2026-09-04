#!/usr/bin/env python3
import argparse, json
from pathlib import Path

MAX_STEPS = 6
def envelope(ok, code, message, data=None, retryable=False):
    return {"ok":ok,"code":code,"message":message,"data":data or {},"retryable":retryable}
def run(case):
    state="CLASSIFY"; trace=[]
    for step in range(MAX_STEPS):
        trace.append({"step":step+1,"state":state})
        if state=="CLASSIFY": state="CHECK_ELIGIBILITY"
        elif state=="CHECK_ELIGIBILITY":
            if not case.get("purchase_id") or case.get("duplicate_charge") is None:
                result=envelope(False,"AMBIGUOUS_EVIDENCE","Purchase evidence is incomplete",{"confidence":0.42},False); state="ESCALATE"
            elif case["duplicate_charge"]:
                result=envelope(True,"ELIGIBLE","Duplicate charge is eligible",{"purchase_id":case["purchase_id"]}); state="PROPOSE"
            else:
                result=envelope(True,"INELIGIBLE","No duplicate charge detected"); state="RESOLVE"
        elif state=="PROPOSE":
            result=envelope(True,"APPROVAL_REQUIRED","Refund proposed; human approval required",{"executed":False}); state="ESCALATE"
        elif state in {"RESOLVE","ESCALATE"}: break
    else: state="FAILED_MAX_STEPS"
    session={"case_id":case["case_id"],"terminal_state":state,"stop_reason":"end_turn","idempotency_key":"refund:"+case["case_id"],"tool_result":result,"trace":trace}
    Path("evidence").mkdir(exist_ok=True); Path("evidence/session.json").write_text(json.dumps(session,indent=2)+"\n")
    return session
if __name__=="__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("--case"); ap.add_argument("--demo",action="store_true"); a=ap.parse_args()
    p=a.case or "fixtures/eligible.json"; print(json.dumps(run(json.loads(Path(p).read_text())),indent=2))
