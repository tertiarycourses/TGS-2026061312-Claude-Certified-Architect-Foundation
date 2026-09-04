#!/usr/bin/env python3
import argparse,json
from pathlib import Path
def parse(line):
    p=line.strip().split("|"); src=p[0]; inv=p[1].split()[-1].rstrip("?"); nums={}
    for x in p[2:]:
        k,v=x.split(maxsplit=1)
        try: nums[k.lower()]=float(v)
        except ValueError: nums[k.lower()]=None
    retry=[]
    if nums.get("tax") is None:
        retry.append("tax: supply numeric tax derived from total minus subtotal"); nums["tax"]=round(nums["total"]-nums["subtotal"],2)
    valid=round(nums["subtotal"]+nums["tax"],2)==nums["total"]
    confidence=0.96 if not retry and valid else 0.63
    return {"source_id":src,"invoice_id":inv,"subtotal":nums["subtotal"],"tax":nums["tax"],"total":nums["total"],"confidence":confidence,"review":"auto" if confidence>=0.85 else "human","retry_count":1 if retry else 0,"feedback":retry,"valid":valid}
def run(batch):
    lines=Path("fixtures/invoices.txt").read_text().splitlines(); records=[]; manifest=[]
    for i in range(0,len(lines),batch):
        chunk=[parse(x) for x in lines[i:i+batch]]; records.extend(chunk); manifest.append({"batch":i//batch+1,"source_ids":[x["source_id"] for x in chunk],"status":"complete"})
    out={"records":records,"manifest":manifest}; Path("evidence").mkdir(exist_ok=True); Path("evidence/extraction.json").write_text(json.dumps(out,indent=2)+"\n"); return out
if __name__=="__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("--batch-size",type=int,default=2); ap.add_argument("--show-feedback",action="store_true"); a=ap.parse_args(); out=run(a.batch_size)
    print(json.dumps([r["feedback"] for r in out["records"]] if a.show_feedback else out,indent=2))
