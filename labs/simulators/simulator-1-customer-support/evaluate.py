#!/usr/bin/env python3
"""Score every run in evidence/runs/ against its use-case template.

Two layers:
  1. Deterministic checks straight from the tool trace: required tools called,
     forbidden tools absent, verification before order operations, refund
     amounts, retries after transient errors, handoff completeness.
  2. Optional LLM judge (--judge): an independent Claude instance that never
     saw the conversation scores the rubric lines from the trace and reply.

Prints a per-case table and the first-contact resolution (FCR) rate, and
writes evidence/evaluation.json.

  uv run evaluate.py            # deterministic only
  uv run evaluate.py --judge    # add the independent reviewer
  uv run evaluate.py --tag nogate   # score the --tag nogate runs instead
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
import asyncio
import json
import os
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")


def index_of(calls, name, ok_only=False):
    for i, c in enumerate(calls):
        if c["tool"] == name and (not ok_only or not c.get("is_error")):
            return i
    return None


def deterministic(case, trace):
    exp = case["expected"]
    calls = trace.get("tool_calls", [])
    names = [c["tool"] for c in calls]
    checks = {}
    for t in exp.get("must_call", []):
        checks[f"called:{t}"] = t in names
    for t in exp.get("must_not_call", []):
        checks[f"not_called:{t}"] = t not in names
    gc = index_of(calls, "get_customer", ok_only=True)
    first_order_ok = next((i for i, c in enumerate(calls) if c["tool"] in ("lookup_order", "process_refund") and not c.get("is_error")), None)
    if first_order_ok is not None:
        checks["verified_before_order_ops"] = gc is not None and gc < first_order_ok
    refunds = trace.get("backend_state", {}).get("refunds", [])
    issued = sum(r["amount"] for r in refunds)
    if "refund_issued" in exp:
        checks["refund_amount"] = abs(issued - float(exp["refund_issued"])) < 0.01
    if exp.get("hook_block_expected") == "refund_limit":
        hook_fired = any(h.get("decision") == "deny" and h["tool"] == "process_refund" for h in trace.get("hooks", []))
        checks["limit_respected"] = issued <= 500 and bool(trace.get("backend_state", {}).get("escalations"))
        trace["hook_fired"] = hook_fired
    if exp.get("validated_before_refund"):
        vi = index_of(calls, "recommend_refund")
        pi = index_of(calls, "process_refund", ok_only=True)
        validated = trace.get("backend_state", {}).get("validated_refunds", {})
        checks["validated_before_refund"] = vi is not None and pi is not None and vi < pi and bool(validated)
        if "merchandise_credit" in exp:
            checks["credit_not_cash"] = any(abs(v.get("merchandise_credit", 0) - exp["merchandise_credit"]) < 0.01 for v in validated.values())
    if exp.get("tool_error_expected"):
        checks["tool_error_surfaced"] = any(c["tool"] == exp["tool_error_expected"] and c.get("is_error") for c in calls) or not any(
            c["tool"] == exp["tool_error_expected"] for c in calls)
        checks["no_false_success"] = not re.search(r"refund (has been|was|is) (issued|processed|completed)", (trace.get("reply") or ""), re.I)
    if exp.get("refund_order"):
        checks["refund_on_right_order"] = all(r["order_id"] == exp["refund_order"] for r in refunds) and bool(refunds)
    if trace.get("turn_replies") and len(trace["turn_replies"]) > 1:
        checks["case_facts_every_turn"] = all("CASE FACTS" in (r or "").upper() for r in trace["turn_replies"])
    if exp.get("min_lookup_calls"):
        checks["retried_after_transient"] = names.count("lookup_order") >= exp["min_lookup_calls"] and any(
            c["tool"] == "lookup_order" and c.get("is_error") for c in calls)
    for oid in exp.get("orders_touched", []):
        checks[f"looked_up:{oid}"] = any(c["tool"] == "lookup_order" and (c["input"].get("order_id") or "").upper() == oid for c in calls)
    esc = trace.get("backend_state", {}).get("escalations", [])
    if exp["disposition"] == "escalated":
        h = esc[0]["handoff"] if esc else {}
        checks["handoff_complete"] = all(h.get(k) for k in ("customer_id", "root_cause", "recommended_action"))
    # disposition observed
    if esc:
        observed = "escalated"
    elif trace.get("reply") and not calls[-1:] or (calls and calls[-1]["tool"] == "get_customer" and len(calls) == 1):
        observed = "clarified"
    else:
        observed = "resolved"
    if exp["disposition"] == "clarified":
        observed = "clarified" if not any(c["tool"] in ("lookup_order", "process_refund") and not c.get("is_error") for c in calls) and not esc else observed
    checks["disposition"] = observed == exp["disposition"]
    return checks, observed


async def judge(case, trace):
    from claude_agent_sdk import ResultMessage, query
    rubric = "\n".join(f"- {k}: {v}" for k, v in case["rubric"].items())
    packet = {
        "customer_message": trace["message"],
        "tool_calls": [{"tool": c["tool"], "input": c["input"], "result": c.get("result"), "is_error": c.get("is_error")} for c in trace.get("tool_calls", [])],
        "final_reply": trace.get("reply"),
        "expected_disposition": case["expected"]["disposition"],
    }
    prompt = f"{(HERE / 'prompts' / 'judge.md').read_text()}\n\nRUBRIC (ids and criteria):\n{rubric}\n\nCASE PACKET (JSON):\n{json.dumps(packet, indent=1)}"
    text = ""
    async for msg in query(prompt=prompt, options=simkit.options(model=MODEL, max_turns=1, tools=[], allowed_tools=[], permission_mode="bypassPermissions", cwd=str(HERE))):
        simkit.narrate(msg)
        if isinstance(msg, ResultMessage):
            text = msg.result or ""
    # loop runs to completion so the SDK generator closes cleanly
    start, end = text.find("{"), text.rfind("}")
    try:
        return json.loads(text[start:end + 1])
    except Exception:
        return {"scores": {}, "disposition_observed": "unclear", "notes": "judge output not parseable", "raw": text[:300]}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--judge", action="store_true")
    ap.add_argument("--tag", default="")
    args = ap.parse_args()
    cases = {json.loads(p.read_text())["case_id"]: json.loads(p.read_text()) for p in (HERE / "cases").glob("CS-*.json")}
    suffix = f"-{args.tag}" if args.tag else ""
    rows, resolved_first_contact, total_cost = [], 0, 0.0
    for cid, case in sorted(cases.items()):
        path = HERE / "evidence" / "runs" / f"{cid}{suffix}.json"
        if not path.exists():
            continue
        trace = json.loads(path.read_text())
        checks, observed = deterministic(case, trace)
        row = {"case_id": cid, "title": case["title"], "exam_task": case["exam_task"], "expected": case["expected"]["disposition"],
               "observed": observed, "checks": checks, "passed": all(checks.values()),
               "cost_usd": (trace.get("result") or {}).get("total_cost_usd") or 0}
        if args.judge:
            row["judge"] = await judge(case, trace)
            row["rubric_score"] = sum(row["judge"].get("scores", {}).values())
            row["rubric_total"] = len(case["rubric"])
        total_cost += row["cost_usd"]
        if row["passed"] and observed in ("resolved", "escalated", "clarified"):
            resolved_first_contact += 1
        rows.append(row)
        flag = "PASS" if row["passed"] else "FAIL"
        failed = [k for k, v in checks.items() if not v]
        extra = f"  judge {row['rubric_score']}/{row['rubric_total']}" if args.judge else ""
        print(f"{flag} {cid} expected={row['expected']:<9} observed={observed:<9}{extra}  {'; '.join(failed)}")
    n = len(rows)
    fcr = 100.0 * resolved_first_contact / n if n else 0.0
    summary = {"model": MODEL, "tag": args.tag, "cases": n, "passed": resolved_first_contact, "fcr_percent": round(fcr, 1),
               "target_percent": 80, "meets_target": fcr >= 80, "total_cost_usd": round(total_cost, 4), "rows": rows}
    out = HERE / "evidence" / f"evaluation{suffix}.json"
    out.write_text(json.dumps(summary, indent=2))
    print(f"\nFirst-contact resolution: {resolved_first_contact}/{n} = {fcr:.0f}% (target 80%) · cost ${total_cost:.3f} · {out.name}")


if __name__ == "__main__":
    asyncio.run(main())
