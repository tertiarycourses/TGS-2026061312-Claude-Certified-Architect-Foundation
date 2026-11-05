#!/usr/bin/env python3
"""Acceptance checks for Simulator 1. Run after support_agent.py --all and evaluate.py."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNS = HERE / "evidence" / "runs"
results = []


def check(label, ok, detail=""):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'} - {label}{(' · ' + detail) if detail else ''}")


def load(cid):
    p = RUNS / f"{cid}.json"
    return json.loads(p.read_text()) if p.exists() else None


runs = {p.stem: json.loads(p.read_text()) for p in RUNS.glob("CS-*.json")} if RUNS.exists() else {}
check("thirteen use cases were run through the live agent", len([k for k in runs if "-" not in k[3:]]) >= 13, f"{len(runs)} run files")

ev_path = HERE / "evidence" / "evaluation.json"
ev = json.loads(ev_path.read_text()) if ev_path.exists() else None
check("evaluation.json exists", ev is not None)
if ev:
    check("first-contact resolution meets the 80% target", ev["meets_target"], f"{ev['fcr_percent']}%")

t = load("CS-01")
if t:
    names = [c["tool"] for c in t["tool_calls"] if c["tool"] != "ToolSearch"]
    check("CS-01: get_customer precedes lookup_order and process_refund",
          names and names[0] == "get_customer" and "process_refund" in names)
    check("CS-01: refund of $120 issued", any(abs(r["amount"] - 120) < 0.01 for r in t["backend_state"]["refunds"]))
    check("CS-01: PostToolUse normalised a unix timestamp to ISO",
          any(h.get("event") == "PostToolUse" and isinstance(h.get("raw", {}).get("created_at"), int)
              and "T" in str(h.get("normalised", {}).get("created_at")) for h in t["hooks"]))
    check("CS-01: reply carries a CASE FACTS block", "CASE FACTS" in (t.get("reply") or "").upper())

t = load("CS-02")
if t:
    ng = load("CS-02-noguard")
    fired = any(h.get("decision") == "deny" and h["tool"] == "process_refund" for h in (t["hooks"] + (ng["hooks"] if ng else [])))
    check("CS-02: PreToolUse hook denied a $780 refund (prompt-guarded or --prompt prompts/system-noguard.md run)", fired)
    check("CS-02: no refund issued, escalation recorded", not t["backend_state"]["refunds"] and bool(t["backend_state"]["escalations"]))
    if t["backend_state"]["escalations"]:
        h = t["backend_state"]["escalations"][0]["handoff"]
        check("CS-02: handoff has customer_id, root_cause, recommended_action, refund_amount",
              all(h.get(k) for k in ("customer_id", "root_cause", "recommended_action")) and float(h.get("refund_amount") or 0) >= 780)

t = load("CS-05")
if t:
    names = [c["tool"] for c in t["tool_calls"]]
    check("CS-05: human request escalated without lookup_order", "escalate_to_human" in names and "lookup_order" not in names)

t = load("CS-06")
if t:
    calls = [c for c in t["tool_calls"] if c["tool"] == "lookup_order"]
    check("CS-06: transient error retried", len(calls) >= 2 and calls[0].get("is_error") and not calls[-1].get("is_error"))

t = load("CS-11")
if t:
    check("CS-11: no refund issued for the closed return window and no false success claimed",
          not t["backend_state"]["refunds"] and not re.search(r"refund (has been|was|is) (issued|processed)", t.get("reply") or "", re.I))

t = load("CS-12")
if t:
    refunds = t["backend_state"]["refunds"]
    check("CS-12: after three turns the only refund is $45 on ORD-5503", len(refunds) == 1 and refunds[0]["order_id"] == "ORD-5503" and abs(refunds[0]["amount"] - 45) < 0.01)
    check("CS-12: every turn's reply carries a CASE FACTS block", len(t.get("turn_replies", [])) == 3 and all("CASE FACTS" in (r or "").upper() for r in t["turn_replies"]))

t = load("CS-13")
if t:
    names = [c["tool"] for c in t["tool_calls"] if c["tool"] != "ToolSearch"]
    bs = t["backend_state"]
    check("CS-13: recommend_refund validated before process_refund", "recommend_refund" in names and "process_refund" in names
          and names.index("recommend_refund") < names.index("process_refund") and bool(bs.get("validated_refunds")))
    check("CS-13: cash refund is $105 (lamp + mat) and the $8 is store credit, not shipping cash",
          any(abs(r["amount"] - 105) < 0.01 for r in bs["refunds"]) and any(abs(v.get("merchandise_credit", 0) - 8) < 0.01 for v in bs.get("validated_refunds", {}).values()))
    check("CS-13: business-rule validation log recorded", bool(bs.get("validation_log")))

t = load("CS-09")
if t:
    names = [c["tool"] for c in t["tool_calls"]]
    check("CS-09: ambiguous name handled by asking, not guessing", "lookup_order" not in names and "process_refund" not in names)

for cid, t in runs.items():
    if "-" in cid[3:]:
        continue
    r = t.get("result") or {}
    if r.get("stop_reason") not in (None, "end_turn") and r.get("terminal_reason") == "max_turns":
        check(f"{cid}: loop ended by the model (end_turn), not by the turn cap", False, r.get("terminal_reason"))
        break
else:
    check("every loop terminated on end_turn, not an iteration cap", True)

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
