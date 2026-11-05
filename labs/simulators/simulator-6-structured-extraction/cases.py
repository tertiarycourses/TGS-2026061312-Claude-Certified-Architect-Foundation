#!/usr/bin/env python3
"""Use cases from the SkillCertPro practice test for Simulator 6.

Each case in cases/UC-<n>.json pairs an exam question with a concrete variant
the learner runs: a different tool set (UC-11), an application-level gate in a
manual agent loop (UC-12), section passes plus reconciliation (UC-31), sync
versus batch routing (UC-32), or a discussion case whose delegation prompt is
rendered from the template (UC-22, UC-36). Run via:

    uv run extract.py --case UC-12
"""
import copy
import json
import re
import time
from pathlib import Path

import jsonschema

HERE = Path(__file__).resolve().parent
CASES = HERE / "cases"
EV = HERE / "evidence" / "cases"


def load_case(uc):
    return json.loads((CASES / f"{uc}.json").read_text())


def render(template, **values):
    out = template
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", str(v))
    return out


def write(uc, payload):
    EV.mkdir(parents=True, exist_ok=True)
    (EV / f"{uc}.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote evidence/cases/{uc}.json")


def base_payload(case):
    return {k: case[k] for k in ("id", "question_number", "timestamp", "mode", "title", "exam_question",
                                 "correct_option", "correct_option_text", "why", "rubric")}


# ----------------------------------------------------------------- UC-11 tool design
GENERIC_TOOL = {
    "name": "analyze_document",
    "description": "Analyze a document.",
    "input_schema": {
        "type": "object", "additionalProperties": False,
        "required": ["document_text", "operation", "format"],
        "properties": {
            "document_text": {"type": "string"},
            "operation": {"type": "string", "enum": ["extract", "summarize", "verify"]},
            "format": {"type": "string", "enum": ["json", "text"]},
        },
    },
}

SUMMARIZE_TOOL = {
    "name": "summarize_document",
    "description": "Write a two-sentence plain-language summary of a document for a human reader. Use it only when a person asked for a summary. Do NOT use it when a downstream system expects structured fields: that is extract_invoice.",
    "strict": True,
    "input_schema": {"type": "object", "additionalProperties": False, "required": ["summary"],
                     "properties": {"summary": {"type": "string"}}},
}

VERIFY_TOOL = {
    "name": "verify_claim_against_source",
    "description": "Check one specific claim (for example 'the total is 160.00') against a quoted excerpt of the source document. Requires the exact excerpt; never call it without one. Do NOT use it to extract fields or to summarise.",
    "strict": True,
    "input_schema": {"type": "object", "additionalProperties": False, "required": ["claim", "source_excerpt", "supported"],
                     "properties": {"claim": {"type": "string"}, "source_excerpt": {"type": "string"}, "supported": {"type": "boolean"}}},
}


def run_uc11(client, docs, model, extract_tool, call_model, schema):
    case = load_case("UC-11")
    runs = {}
    for label, tools in (("generic_single_tool", [GENERIC_TOOL]), ("split_tools", [extract_tool, SUMMARIZE_TOOL, VERIFY_TOOL])):
        calls = []
        for d in docs:
            params = {"model": model, "max_tokens": 4096, "tools": tools, "tool_choice": {"type": "auto"},
                      "system": "You feed an accounts-payable pipeline. Pick the tool whose description matches the job.",
                      "messages": [{"role": "user", "content": render(case["prompt_template"], document=d["text"])}]}
            try:
                name, inp = call_model(client, params, any_tool=True)
            except Exception as e:
                calls.append({"custom_id": d["custom_id"], "tool": None, "error": str(e)[:160]})
                continue
            fields_ok = False
            if name == "extract_invoice":
                try:
                    jsonschema.validate(inp, schema)
                    fields_ok = True
                except jsonschema.ValidationError:
                    fields_ok = False
            calls.append({"custom_id": d["custom_id"], "tool": name,
                          "operation": inp.get("operation") if name == "analyze_document" else None,
                          "extraction_tool_selected": name == "extract_invoice",
                          "schema_valid_payload": fields_ok})
        runs[label] = {"tools_offered": [t["name"] for t in tools], "calls": calls,
                       "extraction_selected": sum(1 for c in calls if c.get("extraction_tool_selected")),
                       "schema_valid": sum(1 for c in calls if c.get("schema_valid_payload")),
                       "documents": len(docs)}
    payload = base_payload(case)
    payload.update({"task": case["task"], "prompt_template": case["prompt_template"], "runs": runs,
                    "observation": f"generic tool: extraction chosen on {runs['generic_single_tool']['extraction_selected']}/{len(docs)} documents "
                                   f"(the rest drifted to summarize/verify); split tools: extract_invoice chosen on "
                                   f"{runs['split_tools']['extraction_selected']}/{len(docs)}, schema-valid payload on {runs['split_tools']['schema_valid']}/{len(docs)} "
                                   f"(selection is solved by descriptions; validation is still yours)"})
    write("UC-11", payload)
    return payload


# ----------------------------------------------------------------- UC-12 prerequisite gate
WORKFLOW_TOOLS = [
    {"name": "extract_fields", "description": "Extract the vendor, total and due date from the document text. Returns the fields and a note on any ambiguous required field.",
     "strict": True, "input_schema": {"type": "object", "additionalProperties": False, "required": ["record_id", "document_text"],
                                       "properties": {"record_id": {"type": "string"}, "document_text": {"type": "string"}}}},
    {"name": "validate_record", "description": "Validate an extracted record against the schema and business rules. Must succeed before submit_record.",
     "strict": True, "input_schema": {"type": "object", "additionalProperties": False, "required": ["record_id", "vendor", "stated_total", "due_date"],
                                       "properties": {"record_id": {"type": "string"}, "vendor": {"type": "string"}, "stated_total": {"type": "number"}, "due_date": {"type": ["string", "null"]}}}},
    {"name": "submit_record", "description": "Submit a validated record to the ledger. Only call after validate_record returned ok: true for the same record_id.",
     "strict": True, "input_schema": {"type": "object", "additionalProperties": False, "required": ["record_id"], "properties": {"record_id": {"type": "string"}}}},
    {"name": "create_review_ticket", "description": "Open a human review ticket for a record with an ambiguous or missing required field. Use instead of guessing.",
     "strict": True, "input_schema": {"type": "object", "additionalProperties": False, "required": ["record_id", "reason"],
                                       "properties": {"record_id": {"type": "string"}, "reason": {"type": "string"}}}},
]


def run_uc12(client, docs, model, create_message):
    case = load_case("UC-12")
    transcript, submits_executed, submits_blocked, tickets = [], [], [], []
    validated = {}  # record_id -> True once validate_record succeeded: the application-level gate

    def execute(name, inp):
        rid = inp.get("record_id")
        if name == "extract_fields":
            text = inp["document_text"]
            ambiguous = "schedule A" in text or "see attached" in text
            m = re.search(r"(?:TOTAL DUE|TOTAL|Amount payable|Amount paid|Credit total):?\s*(?:S\$|THB|\$)?\s*(-?[\d,]+\.\d{2})", text)
            return {"record_id": rid, "vendor": text.splitlines()[0][:60], "stated_total": float(m.group(1).replace(",", "")) if m else None,
                    "due_date": None, "ambiguous_required_fields": ["line_items"] if ambiguous else []}, False
        if name == "validate_record":
            ok = inp.get("stated_total") is not None and bool(inp.get("vendor"))
            if ok:
                validated[rid] = True
            return {"record_id": rid, "ok": ok, "errors": [] if ok else ["stated_total missing"]}, False
        if name == "submit_record":
            if not validated.get(rid):  # THE GATE: refuse, tell Claude why, keep the loop alive
                submits_blocked.append(rid)
                return {"error": "blocked by application gate: validate_record has not succeeded for this record_id",
                        "required_next_step": "call validate_record, or create_review_ticket if a required field is ambiguous"}, True
            submits_executed.append(rid)
            return {"record_id": rid, "status": "submitted"}, False
        if name == "create_review_ticket":
            tickets.append({"record_id": rid, "reason": inp.get("reason")})
            return {"ticket_id": f"REV-{len(tickets):03d}", "record_id": rid}, False
        return {"error": f"unknown tool {name}"}, True

    for d in docs:
        rid = d["custom_id"]
        messages = [{"role": "user", "content": render(case["prompt_template"], document=d["text"], record_id=rid)}]
        turns = 0
        while True:  # the agentic loop, driven by stop_reason only
            turns += 1
            resp = create_message({"model": model, "max_tokens": 2048, "tools": WORKFLOW_TOOLS, "tool_choice": {"type": "auto"},
                                   "system": "You process one accounts-payable record. Use the tools; never claim a submission you did not make.",
                                   "messages": messages})
            if resp.stop_reason != "tool_use":
                transcript.append({"record_id": rid, "turn": turns, "stop_reason": resp.stop_reason,
                                   "text": " ".join(b.text for b in resp.content if b.type == "text")[:160]})
                break
            messages.append({"role": "assistant", "content": [b.model_dump() for b in resp.content]})
            results = []
            for b in resp.content:
                if b.type != "tool_use":
                    continue
                out, is_err = execute(b.name, b.input)
                transcript.append({"record_id": rid, "turn": turns, "tool": b.name, "blocked": is_err and b.name == "submit_record"})
                results.append({"type": "tool_result", "tool_use_id": b.id, "content": json.dumps(out), "is_error": is_err})
            messages.append({"role": "user", "content": results})
            if turns > 8:
                transcript.append({"record_id": rid, "turn": turns, "stop_reason": "loop_cap", "text": "safety cap hit"})
                break

    # Claude often validates first, so the gate may never fire in a run. Prove it blocks, without Claude.
    probe_out, probe_blocked = execute("submit_record", {"record_id": "GATE-PROBE"})
    submits_blocked_by_claude = [r for r in submits_blocked if r != "GATE-PROBE"]
    ordered_ok = all(validated.get(r) for r in submits_executed)
    payload = base_payload(case)
    payload.update({"task": case["task"], "prompt_template": case["prompt_template"], "gate": "submit_record executes only when validated[record_id] is True",
                    "submits_executed": submits_executed, "submits_blocked": submits_blocked_by_claude, "gate_probe": {"record_id": "GATE-PROBE", "blocked": probe_blocked, "response": probe_out}, "review_tickets": tickets,
                    "every_executed_submit_had_prior_validation": ordered_ok, "transcript": transcript})
    write("UC-12", payload)
    return payload


# ----------------------------------------------------------------- UC-31 section passes + reconciliation
def build_packet(docs):
    by = {d["custom_id"]: d["text"] for d in docs}
    return [("Intake form", "Claimant: Harbour Office Supplies account. Packet assembled 2026-10-15 for expense reconciliation."),
            ("Narrative notes", "Finance note: the October supplies invoice and the freight invoice were both approved by the department head; the lamp credit offsets INV-1990."),
            ("Invoices", by["DOC-01"] + "\n\n" + by["DOC-04"]),
            ("Credits", by["DOC-05"]),
            ("Attachments", "Copy of supplier invoice for records:\n" + by["DOC-01"])]


def run_uc31(client, docs, model, extract_tool, call_model, schema):
    case = load_case("UC-31")
    sections = build_packet(docs)
    packet = "\n\n".join(f"[section: {n}]\n{t}" for n, t in sections)

    def extract(text, label):
        params = {"model": model, "max_tokens": 4096, "tools": [extract_tool], "tool_choice": {"type": "auto"},
                  "system": "Record financial documents with extract_invoice. One call per document.",
                  "messages": [{"role": "user", "content": text}]}
        try:
            name, inp = call_model(client, params, any_tool=True)
            return {"source": label, "invoice_id": inp.get("invoice_id"), "stated_total": inp.get("stated_total"), "record": inp}
        except Exception as e:
            return {"source": label, "error": str(e)[:160]}

    single = [extract(f"<document>\n{packet}\n</document>\nRecord every financial document in this packet with the extract_invoice tool.", "whole packet")]
    section_records = []
    for name, text in sections:
        if not any(k in text for k in ("INVOICE", "RECEIPT", "CREDIT NOTE")):
            section_records.append({"source": name, "skipped": "no financial document in this section"})
            continue
        # one document per call: split a section that holds two documents
        for part in re.split(r"\n\n(?=INVOICE|RECEIPT|CREDIT NOTE)", text):
            section_records.append(extract(render(case["prompt_template"], section_name=name, section_text=part), name))

    # reconciliation pass: schema check, dedupe by invoice_id, cross-section total consistency
    merged, conflicts, schema_errors = {}, [], []
    for r in section_records:
        if "record" not in r:
            continue
        try:
            jsonschema.validate(r["record"], schema)
        except jsonschema.ValidationError as e:
            schema_errors.append({"source": r["source"], "error": e.message[:120]})
        key = r["invoice_id"]
        if key in merged:
            if abs(float(merged[key]["stated_total"]) - float(r["stated_total"])) > 0.01:
                conflicts.append({"invoice_id": key, "sources": [merged[key]["source"], r["source"]],
                                  "totals": [merged[key]["stated_total"], r["stated_total"]]})
            merged[key]["also_seen_in"].append(r["source"])
        else:
            merged[key] = {"source": r["source"], "stated_total": r["stated_total"], "also_seen_in": []}

    payload = base_payload(case)
    payload.update({"task": case["task"], "prompt_template": case["prompt_template"],
                    "packet_sections": [n for n, _ in sections], "distinct_documents_in_packet": 3,
                    "single_pass": {"records_returned": len([s for s in single if "record" in s]), "detail": single},
                    "section_passes": {"records_returned": len([s for s in section_records if "record" in s]), "detail": section_records},
                    "reconciliation": {"unique_invoice_ids": sorted(merged), "duplicates_merged": sum(len(v["also_seen_in"]) for v in merged.values()),
                                       "cross_section_total_conflicts": conflicts, "schema_errors": schema_errors}})
    write("UC-31", payload)
    return payload


# ----------------------------------------------------------------- UC-32 workload routing
WORKLOADS = [
    {"workload_name": "interactive_upload", "blocking": True, "deadline": "user is waiting (seconds)", "document_count": 1},
    {"workload_name": "nightly_archive", "blocking": False, "deadline": "next business day 09:00", "document_count": None},
]


def run_uc32(client, docs, model, extract_one, run_batch, tool_choice):
    case = load_case("UC-32")
    routing = []
    for w in WORKLOADS:
        w = dict(w)
        w["document_count"] = w["document_count"] or len(docs)
        w["route"] = "sync Messages API" if w["blocking"] else "Message Batches API"
        w["cost_multiplier"] = 1.0 if w["blocking"] else 0.5
        w["decision_line"] = render(case["prompt_template"], **w)
        if w["blocking"]:
            t0 = time.time()
            r = extract_one(client, docs[0], model, tool_choice, 1, True)
            w["result"] = {"custom_id": r["custom_id"], "routing": r["routing"], "latency_seconds": round(time.time() - t0, 2)}
        else:
            extractions, log = run_batch(client, docs, model, tool_choice, 0.5)
            w["result"] = {"batch_id": log["batch_id"], "succeeded": len(log["succeeded"]), "failed": [f["custom_id"] for f in log["failed"]],
                           "resubmitted": log["resubmission"]["custom_ids"] if log["resubmission"] else [],
                           "note": "results reviewed next day; up to 24 h processing window, no latency guarantee"}
        routing.append(w)
    payload = base_payload(case)
    payload.update({"task": case["task"], "prompt_template": case["prompt_template"], "routing": routing,
                    "rule": "blocking user flow -> synchronous; latency-tolerant volume -> batch at 50% price"})
    write("UC-32", payload)
    return payload


# ----------------------------------------------------------------- discussion cases
def run_uc22():
    case = load_case("UC-22")
    payload = base_payload(case)
    payload.update({"task": case["task"], "prompt_template": case["prompt_template"],
                    "rendered_prompt": render(case["prompt_template"], scope_paths="labs/lab-06-structured-data-extraction/ (extract.py, cases.py, invoice.schema.json, fixtures/)",
                                              new_document_type="purchase_order"),
                    "expected_answer": case["correct_option_text"], "expected_outcome": case["expected_outcome"]})
    write("UC-22", payload)
    return payload


def run_uc36(docs):
    case = load_case("UC-36")
    groups = {}
    for d in docs:
        groups.setdefault(d["document_type_label"], []).append(d["custom_id"])
    concerns = {"invoice": "date and currency normalisation failures", "receipt": "totals that include un-itemised tax",
                "credit_note": "sign of totals and missing currency"}
    prompts = []
    for i, (g, ids) in enumerate(sorted(groups.items()), 1):
        prompts.append({"agent_name": f"investigator-{i}", "group": g, "document_ids": ids, "concern": concerns.get(g, "schema validation failures"),
                        "prompt": render(case["prompt_template"], agent_name=f"investigator-{i}", document_ids=", ".join(ids), group=g,
                                         concern=concerns.get(g, "schema validation failures"))})
    all_ids = [i for p in prompts for i in p["document_ids"]]
    payload = base_payload(case)
    payload.update({"task": case["task"], "prompt_template": case["prompt_template"], "partition": prompts,
                    "non_overlapping": len(all_ids) == len(set(all_ids)) == len(docs),
                    "expected_answer": case["correct_option_text"], "expected_outcome": case["expected_outcome"]})
    write("UC-36", payload)
    return payload
