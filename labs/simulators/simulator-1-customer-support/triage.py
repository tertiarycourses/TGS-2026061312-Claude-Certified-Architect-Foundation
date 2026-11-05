#!/usr/bin/env python3
"""Simulator 1 drill: evaluate the prompt template BEFORE the overnight batch.

The team wants to classify 35,000 archived transcripts overnight through the
Message Batches API. Practice-test Q1 says: build a representative evaluation
set first, refine the templated prompt against clear criteria, and only then
submit the batch. Q4 adds: schema-valid output can still be wrong in meaning,
so validate business rules and feed specific failures back.

  uv run triage.py --pilot                        # 10 transcripts, v1 template, local Claude Code login
  uv run triage.py --pilot --template prompts/triage_template_v0.md   # the weak template, for comparison
  uv run triage.py --batch                        # same 10 through the batch workflow, simulated locally

Pilot mode runs through the Claude Agent SDK with output_format = the JSON
schema, so the SHAPE is guaranteed. Then business rules run on each result
(refund_total must equal the parts; store credit never sits in
shipping_refund; order ids must appear in the transcript). A failing record
is re-sent once with the specific errors appended. Results, first-pass
success and the retry log land in evidence/triage.json.
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
import asyncio
import json
import os
import re
import time
from pathlib import Path

import jsonschema

HERE = Path(__file__).resolve().parent
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
SCHEMA = json.loads((HERE / "triage.schema.json").read_text())
POLICY = json.loads((HERE / "fixtures" / "backend.json").read_text())["policy"]
POLICY_EXCERPT = (f"Refunds up to ${POLICY['refund_auto_limit']} may be issued by the agent; above that a human approves. "
                  f"Change-of-mind returns are accepted within {POLICY['return_window_days']} days of delivery. "
                  f"Price matching: {POLICY['price_match']}.")


def render(template: str, **vars) -> str:
    out = template
    for k, v in vars.items():
        out = out.replace("{{" + k + "}}", str(v))
    missing = re.findall(r"{{(\w+)}}", out)
    if missing:
        raise ValueError(f"template placeholders not filled: {missing}")
    return out


def business_rules(record: dict, transcript: str) -> list[str]:
    errors = []
    r = record.get("refund", {})
    parts = r.get("shipping_refund", 0) + r.get("merchandise_credit", 0) + sum(i["amount"] for i in r.get("item_refunds", []))
    if abs(parts - r.get("refund_total", 0)) > 0.01:
        errors.append(f"refund_total {r.get('refund_total')} does not equal shipping_refund + merchandise_credit + item_refunds = {parts:.2f}")
    if r.get("shipping_refund", 0) > 0 and not re.search(r"shipping", transcript, re.I):
        errors.append("shipping_refund is non-zero but the transcript never mentions shipping")
    if r.get("merchandise_credit", 0) > 0 and not re.search(r"credit", transcript, re.I):
        errors.append("merchandise_credit is non-zero but the transcript never mentions store credit")
    for item in r.get("item_refunds", []):
        if item["order_id"] not in transcript:
            errors.append(f"item_refunds names {item['order_id']}, which is not in the transcript")
    if record.get("disposition") == "escalated" and r.get("refund_total", 0) > 0 and not re.search(r"recommend", transcript, re.I):
        errors.append("escalated case shows money moved, but the transcript only recommends a refund")
    return errors


def load_transcripts():
    items = []
    for p in sorted((HERE / "fixtures" / "transcripts").glob("T-*.txt")):
        items.append({"transcript_id": p.stem, "transcript": p.read_text().strip()})
    return items


async def ask_sdk(prompt: str) -> dict | None:
    from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query
    out, cost = None, 0.0
    async for msg in query(prompt=prompt, options=ClaudeAgentOptions(
            model=MODEL, max_turns=1, allowed_tools=[], permission_mode="bypassPermissions", cwd=str(HERE),
            output_format={"type": "json_schema", "schema": SCHEMA})):
        if isinstance(msg, ResultMessage):
            out = msg.structured_output
            if out is None and msg.result:
                try:
                    out = json.loads(msg.result[msg.result.find("{"):msg.result.rfind("}") + 1])
                except Exception:
                    out = None
            cost = msg.total_cost_usd or 0
    return {"record": out, "cost": cost}


async def pilot(template_path: Path, limit: int | None):
    template = template_path.read_text()
    items = load_transcripts()[:limit] if limit else load_transcripts()
    labels = json.loads((HERE / "fixtures" / "transcripts" / "labels.json").read_text())
    results, first_pass, cost = [], 0, 0.0
    for it in items:
        prompt = render(template, transcript=it["transcript"], transcript_id=it["transcript_id"], policy_excerpt=POLICY_EXCERPT)
        attempts = []
        for attempt in range(2):
            res = await ask_sdk(prompt)
            cost += res["cost"]
            rec = res["record"]
            errs = []
            if rec is None:
                errs = ["no JSON object returned"]
            else:
                try:
                    jsonschema.validate(rec, SCHEMA)
                except jsonschema.ValidationError as e:
                    errs.append(f"schema: {e.message}")
                errs += business_rules(rec, it["transcript"])
            attempts.append({"attempt": attempt + 1, "record": rec, "errors": errs})
            if not errs:
                if attempt == 0:
                    first_pass += 1
                break
            prompt = prompt + "\n\nYour previous answer failed validation:\n- " + "\n- ".join(errs) + "\nReturn a corrected answer that fixes every listed problem."
        final = attempts[-1]["record"] or {}
        label = labels.get(it["transcript_id"], {})
        results.append({"transcript_id": it["transcript_id"], "attempts": attempts, "final": final,
                        "label": label,
                        "disposition_correct": final.get("disposition") == label.get("disposition"),
                        "refund_total_correct": abs(float(final.get("refund", {}).get("refund_total", -1)) - float(label.get("refund_total", -2))) < 0.01})
        ok = "ok " if not attempts[-1]["errors"] else "FAIL"
        print(f"{ok} {it['transcript_id']} disposition={final.get('disposition')} refund_total={final.get('refund', {}).get('refund_total')} attempts={len(attempts)}"
              + (f"  errors: {attempts[-1]['errors']}" if attempts[-1]["errors"] else ""))
    n = len(results)
    summary = {
        "mode": "pilot", "model": MODEL, "template": str(template_path.name), "transcripts": n,
        "first_pass_success": first_pass, "first_pass_rate": round(100 * first_pass / n, 1) if n else 0,
        "disposition_accuracy": round(100 * sum(r["disposition_correct"] for r in results) / n, 1) if n else 0,
        "refund_total_accuracy": round(100 * sum(r["refund_total_correct"] for r in results) / n, 1) if n else 0,
        "cost_usd": round(cost, 4), "ready_for_batch": first_pass == n and n > 0, "results": results,
    }
    out = HERE / "evidence" / f"triage-{template_path.stem}.json"
    out.write_text(json.dumps(summary, indent=2))
    print(f"\nfirst-pass success {first_pass}/{n} · disposition accuracy {summary['disposition_accuracy']}% · refund accuracy {summary['refund_total_accuracy']}% · cost ${cost:.3f}")
    print("ready for the overnight batch" if summary["ready_for_batch"] else "NOT ready: refine the template and rerun the pilot before submitting the batch")
    print(f"-> {out.name}")


def batch(template_path: Path):
    """The Message Batches workflow, run locally through the Agent SDK: custom_id per row, no mid-request tool loop.
    On the real API this is 50% cheaper with a window of up to 24 h; this stand-in has neither."""
    from simkit import MessageCreateParamsNonStreaming, Request
    client = simkit.Anthropic()
    template = template_path.read_text()
    items = load_transcripts()
    tool = {"name": "record_triage", "description": "Record the triage result for one transcript.", "strict": True, "input_schema": SCHEMA}
    requests = [Request(custom_id=it["transcript_id"], params=MessageCreateParamsNonStreaming(
        model=MODEL, max_tokens=2048, tools=[tool],
        messages=[{"role": "user", "content": render(template, transcript=it["transcript"], transcript_id=it["transcript_id"], policy_excerpt=POLICY_EXCERPT)
                   + "\n\nCall the record_triage tool with your answer."}])) for it in items]
    b = client.messages.batches.create(requests=requests)
    print(f"batch {b.id} submitted with {len(requests)} requests; polling (this can take minutes)")
    while True:
        b = client.messages.batches.retrieve(b.id)
        if b.processing_status == "ended":
            break
        time.sleep(15)
    out = {"mode": "batch", "simulated_locally": True, "batch_id": b.id, "counts": b.request_counts.model_dump(), "results": {}}
    for r in client.messages.batches.results(b.id):
        if r.result.type == "succeeded":
            msg = r.result.message
            call = next((blk for blk in msg.content if blk.type == "tool_use"), None)
            rec = call.input if call else None
            transcript = next(it["transcript"] for it in items if it["transcript_id"] == r.custom_id)
            out["results"][r.custom_id] = {"record": rec, "errors": business_rules(rec, transcript) if rec else ["no tool call"],
                                           "stop_reason": msg.stop_reason}
        else:
            out["results"][r.custom_id] = {"record": None, "errors": [r.result.type]}
    failed = [k for k, v in out["results"].items() if v["errors"]]
    out["failed_custom_ids"] = failed
    out["note"] = ("Failed rows are resubmitted by custom_id with a corrected prompt, not the whole archive. "
                   "A row whose answer needs a client tool (get_customer, lookup_order) stops at stop_reason tool_use: "
                   "execute the tool and continue that case in a normal Messages request.")
    (HERE / "evidence" / "triage-batch.json").write_text(json.dumps(out, indent=2, default=str))
    print(json.dumps(out["counts"]), "failed:", failed)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--batch", action="store_true")
    ap.add_argument("--template", default="prompts/triage_template.md")
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    if a.batch:
        batch(HERE / a.template)
    else:
        asyncio.run(pilot(HERE / a.template, a.limit))
