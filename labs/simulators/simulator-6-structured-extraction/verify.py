#!/usr/bin/env python3
"""Acceptance checks for Simulator 6. Reads the evidence written by extract.py.

Run `uv run extract.py` (sync) and `uv run extract.py --batch` first.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EV = HERE / "evidence"


def load(name):
    p = EV / name
    return json.loads(p.read_text()) if p.exists() else None


rep, acc, batch = load("extraction.json"), load("accuracy.json"), load("batch.json")
if not rep or not acc:
    sys.exit("FAIL - run `uv run extract.py` first (evidence/extraction.json and accuracy.json missing)")
R = {r["custom_id"]: r for r in rep["results"]}
tool = json.loads((HERE / "invoice.schema.json").read_text())
props = tool["input_schema"]["properties"]


def ext(cid):
    return R.get(cid, {}).get("extraction", {})


def attempts(cid):
    return R.get(cid, {}).get("attempts", [])


checks = [
    ("tool is strict with additionalProperties false and every field required",
     tool.get("strict") is True and tool["input_schema"]["additionalProperties"] is False
     and set(tool["input_schema"]["required"]) == set(props)),
    ("schema has nullable due_date, enum escape hatches (other + detail, unclear) and per-field confidence",
     props["due_date"]["type"] == ["string", "null"] and "other" in props["currency"]["enum"] and "unclear" in props["category"]["enum"]
     and set(props["confidence"]["required"]) == {"vendor", "stated_total", "due_date", "line_items"}),
    ("every extraction came back as an extract_invoice tool_use call",
     all(r["tool"] == "extract_invoice" and r["extraction"] for r in R.values())),
    ("tool_choice observation recorded (accepted, or HTTP 400 lesson on a 5.5 model)",
     rep["tool_choice"]["outcome"] == "accepted" or "400" in rep["tool_choice"]["outcome"]),
    ("DOC-01 due date normalised to 2026-11-02",
     ext("DOC-01").get("due_date") == "2026-11-02"),
    ("DOC-02 states no due date -> null, not a guess",
     "DOC-02" in R and ext("DOC-02").get("due_date") is None),
    ("DOC-03 receipt: calculated 35.00 vs stated 38.00 flagged as conflict, routed to a human",
     abs(float(ext("DOC-03").get("calculated_total", 0)) - 35.0) < 0.01 and ext("DOC-03").get("conflict_detected") is True
     and R.get("DOC-03", {}).get("routing") == "human_review"),
    ("DOC-05 credit note: negative total and currency unclear",
     float(ext("DOC-05").get("stated_total", 0)) < 0 and ext("DOC-05").get("currency") == "unclear"),
    ("DOC-06 Thai baht -> currency other with currency_detail THB",
     ext("DOC-06").get("currency") == "other" and (ext("DOC-06").get("currency_detail") or "").upper() == "THB"),
    ("DOC-07 names the missing attachment, spends no retry on it, and goes to a human",
     bool(ext("DOC-07").get("missing_information")) and (len(attempts("DOC-07")) == 1 or any(str(a.get("retry_decision", "")).startswith("stop") for a in attempts("DOC-07")))
     and R.get("DOC-07", {}).get("routing") == "human_review"),
    ("every retry carried the exact validation error back to the model",
     all("errors" in a for r in R.values() for a in r["attempts"] if "error" not in a)),
    ("routing uses field confidence, conflict or missing information, with reasons recorded",
     all(r["routing_reasons"] for r in R.values() if r["routing"] == "human_review")),
    ("accuracy reported overall, by field and by document type",
     set(acc) >= {"overall", "by_field", "by_document_type"} and {"invoice", "receipt", "credit_note"} <= set(acc["by_document_type"])),
    ("stratified audit sample drawn per document type from auto-accepted records",
     set(acc["stratified_sample_for_audit"]) == {"invoice", "receipt", "credit_note"}),
]
if batch:
    checks += [
        ("batch submitted with one custom_id per document and results keyed by custom_id",
         len(batch["submitted"]) == len(set(batch["submitted"])) and set(batch["succeeded"]) <= set(batch["submitted"])),
        ("only failed custom_ids were resubmitted, with a stated modification",
         batch["resubmission"] is None or (set(batch["resubmission"]["custom_ids"]) == {f["custom_id"] for f in batch["failed"]}
                                            and bool(batch["resubmission"]["modification"]))),
    ]
else:
    checks.append(("batch evidence present (run `uv run extract.py --batch`)", False))

# ---- practice-test use cases (checked when their evidence exists)
UC = EV / "cases"
def uc(n):
    p = UC / f"{n}.json"
    return json.loads(p.read_text()) if p.exists() else None
u11, u12, u22, u31, u32, u36 = (uc(f"UC-{n}") for n in (11, 12, 22, 31, 32, 36))
if u11:
    checks.append(("UC-11: split tools route every document to extract_invoice; the generic tool drifts to other operations",
                   u11["runs"]["split_tools"]["extraction_selected"] == u11["runs"]["split_tools"]["documents"]
                   and u11["runs"]["generic_single_tool"]["extraction_selected"] < u11["runs"]["generic_single_tool"]["documents"]))
if u12:
    checks.append(("UC-12: the gate blocks an unvalidated submit; every executed submit had a prior validation; ticket opened",
                   u12.get("gate_probe", {}).get("blocked") is True and u12["every_executed_submit_had_prior_validation"] and len(u12["review_tickets"]) >= 1
                   and all(t.get("stop_reason") != "loop_cap" for t in u12["transcript"])))
if u22:
    checks.append(("UC-22: discussion case rendered with no unfilled placeholders", "{{" not in u22["rendered_prompt"] and u22["correct_option"] == "B"))
if u31:
    rc = u31["reconciliation"]
    checks.append(("UC-31: section passes find more records than the single pass; duplicate merged; three unique ids",
                   u31["section_passes"]["records_returned"] > u31["single_pass"]["records_returned"] and rc["duplicates_merged"] >= 1
                   and len(rc["unique_invoice_ids"]) == u31["distinct_documents_in_packet"]))
if u32:
    r = {w["workload_name"]: w for w in u32["routing"]}
    checks.append(("UC-32: interactive upload -> sync, nightly archive -> batch at 0.5x",
                   r["interactive_upload"]["route"].startswith("sync") and r["nightly_archive"]["route"].startswith("Message Batches")
                   and r["nightly_archive"]["cost_multiplier"] == 0.5 and "batch_id" in r["nightly_archive"]["result"]))
if u36:
    checks.append(("UC-36: partition is non-overlapping and every prompt caps the deliverable",
                   u36["non_overlapping"] and all("at most 8 lines" in p["prompt"] for p in u36["partition"])))
missing = [n for n, v in zip((11, 12, 22, 31, 32, 36), (u11, u12, u22, u31, u32, u36)) if v is None]
if missing:
    checks.append((f"practice-test use cases run (missing: {', '.join('UC-%d' % n for n in missing)})", False))

ok = True
lines = []
for name, passed in checks:
    lines.append(f"{'PASS' if passed else 'FAIL'} - {name}")
    ok &= bool(passed)
print("\n".join(lines))
(EV / "verification.txt").write_text("\n".join(lines) + "\n")
sys.exit(0 if ok else 1)
