#!/usr/bin/env python3
"""Simulator 6 - Structured Data Extraction with the Claude API.

Every document is extracted through a tool_use call against the
`extract_invoice` tool in invoice.schema.json (strict: true). The pipeline:

  1. sends the document with a normalisation prompt and the chosen tool_choice,
  2. validates the tool input twice: syntax (jsonschema) and meaning
     (line items must sum to the stated total),
  3. retries with the original document + the failed extraction + the exact
     validation error, unless the model reported that the information is
     absent from the source, in which case retrying cannot help,
  4. routes low-confidence or conflicting records to human review,
  5. measures accuracy by document type and by field against fixtures/labels.json,
  6. optionally submits the whole set through the Message Batches API
     (--batch) with a custom_id per document and resubmits only the failures.

Runs through the Claude Agent SDK on your Claude login: uv run extract.py
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
import json
import random
import sys
import time
from pathlib import Path

import simkit as anthropic
import jsonschema
from simkit import MessageCreateParamsNonStreaming
from simkit import Request

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence"
TOOL = json.loads((HERE / "invoice.schema.json").read_text())
SCHEMA = TOOL["input_schema"]
DEFAULT_MODEL = simkit.MODEL
LOW_CONFIDENCE = 0.7

SYSTEM = """You are an accounts-payable extraction service. You read one financial
document at a time and record it with the extract_invoice tool. Always call the tool;
never answer in prose.

Normalisation rules:
- Dates: DD/MM/YYYY, D Mon YYYY and DD.MM.YYYY all become YYYY-MM-DD.
- Amounts: strip currency symbols and thousands separators; keep two decimals.
- Currency: "S$", "SGD" or a GST line mean SGD. A named currency outside the enum
  (Thai baht, Japanese yen ...) is "other" with currency_detail set to the ISO code.
  No currency anywhere in the document is "unclear".
- A credit note has a negative stated_total.
- A field the document does not state is null. Do not guess a due date, a vendor
  suffix or a line item. If the document says the detail is somewhere else
  (an attachment, a schedule, a link), set missing_information to describe it and
  still return the fields you can see.
- confidence holds your own 0-1 certainty per field, based on how explicit the
  document is, not on how plausible the value looks."""


# ----------------------------------------------------------------- fixtures
def parse_docs():
    docs = []
    for block in (HERE / "fixtures" / "invoices.txt").read_text().split("=== ")[1:]:
        head, _, body = block.partition("\n")
        doc_id, _, dtype = head.partition(" | type: ")
        docs.append({"custom_id": doc_id.strip(), "document_type_label": dtype.strip(), "text": body.strip()})
    return docs


def tool_choice_param(mode):
    if mode == "any":
        return {"type": "any"}
    if mode == "forced":
        return {"type": "tool", "name": TOOL["name"]}
    return {"type": "auto"}


def user_content(doc_text, failed=None, errors=None):
    if not failed:
        return f"<document>\n{doc_text}\n</document>\nRecord this document with the extract_invoice tool."
    return (
        f"<document>\n{doc_text}\n</document>\n"
        f"<previous_extraction>\n{json.dumps(failed, indent=1)}\n</previous_extraction>\n"
        "<validation_errors>\n" + "\n".join(f"- {e['field']}: {e['message']} [{e['kind']}]" for e in errors) + "\n</validation_errors>\n"
        "Your previous extraction failed validation for the reasons listed. Call extract_invoice again, "
        "correcting only the failing fields from the document text. If the failing information is not in "
        "the document, keep the field null or empty and describe it in missing_information."
    )


def request_params(model, doc_text, tool_choice, failed=None, errors=None):
    """Shared request body for the sync and batch paths."""
    return {
        "model": model,
        "max_tokens": 4096,
        "system": SYSTEM,
        "tools": [TOOL],
        "tool_choice": tool_choice,
        "messages": [{"role": "user", "content": user_content(doc_text, failed, errors)}],
    }


# ----------------------------------------------------------------- model call
def create_message(client, params, use_fallbacks=True):
    """One raw Messages request (beta endpoint with server-side refusal fallbacks by default)."""
    kwargs = dict(params)
    if use_fallbacks:
        # Safety classifiers can decline a request on Claude Opus 5.5; the server-side
        # fallback reroutes it instead of returning stop_reason "refusal".
        kwargs["betas"] = ["server-side-fallback-2026-07-01"]
        kwargs["fallbacks"] = "default"
        response = client.beta.messages.create(**kwargs)
    else:
        response = client.messages.create(**kwargs)
    return response


def call_model(client, params, use_fallbacks=True, any_tool=False):
    """One Messages request. Returns (tool_input, meta), or (tool_name, tool_input) when any_tool=True."""
    response = create_message(client, params, use_fallbacks)
    meta = {"stop_reason": response.stop_reason, "model": response.model,
            "input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens}
    if response.stop_reason == "refusal":
        raise RuntimeError(f"model refused the request: {getattr(response, 'stop_details', None)}")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("response truncated at max_tokens; raise max_tokens before trusting the tool input")
    tool_block = next((b for b in response.content if b.type == "tool_use" and (any_tool or b.name == TOOL["name"])), None)
    if tool_block is None:
        text = " ".join(b.text for b in response.content if b.type == "text")[:200]
        raise RuntimeError(f"no extract_invoice tool call in the response (model answered in prose: {text!r})")
    if any_tool:
        return tool_block.name, tool_block.input
    return tool_block.input, meta


# ----------------------------------------------------------------- validation
def validate(ext):
    """Syntax first (schema), then meaning (arithmetic and enum escape hatches)."""
    errors = []
    try:
        jsonschema.validate(ext, SCHEMA)
    except jsonschema.ValidationError as e:
        errors.append({"kind": "schema", "field": "/".join(str(p) for p in e.absolute_path) or "root",
                       "message": e.message.split("\n")[0][:160]})
    items = ext.get("line_items") or []
    calc = round(sum(float(i.get("amount", 0)) for i in items), 2)
    stated = ext.get("stated_total")
    if items and stated is not None and abs(calc - float(stated)) > 0.01:
        errors.append({"kind": "semantic", "field": "stated_total",
                       "message": f"line items sum to {calc} but stated_total is {stated}"})
    if ext.get("calculated_total") is not None and abs(float(ext["calculated_total"]) - calc) > 0.01:
        errors.append({"kind": "semantic", "field": "calculated_total",
                       "message": f"model reported {ext['calculated_total']} but the line items sum to {calc}"})
    if ext.get("currency") == "other" and not ext.get("currency_detail"):
        errors.append({"kind": "semantic", "field": "currency_detail", "message": "currency is 'other' but currency_detail is null"})
    if ext.get("category") == "other" and not ext.get("category_detail"):
        errors.append({"kind": "semantic", "field": "category_detail", "message": "category is 'other' but category_detail is null"})
    return errors, calc


def retry_decision(errors, ext):
    """Format and structure errors are worth a retry; absent information is not."""
    missing = ext.get("missing_information")
    for e in errors:
        if missing and e["field"].split("/")[0] in ("line_items", "stated_total", "calculated_total"):
            return "stop", f"information absent from the source ({missing}); a retry cannot recover it"
    only_tax_gap = all(e["kind"] == "semantic" and e["field"] in ("stated_total", "calculated_total") for e in errors)
    if only_tax_gap and errors:
        return "stop", "arithmetic conflict is real data (tax or rounding not itemised); keep conflict_detected and route to a human"
    return "retry", "format or structural error; resend the document, the failed extraction and the exact error"


# ----------------------------------------------------------------- sync path
def extract_one(client, doc, model, tool_choice, max_retries, use_fallbacks):
    attempts, failed, errors, ext = [], None, [], None
    for attempt in range(1, max_retries + 2):
        params = request_params(model, doc["text"], tool_choice, failed, errors)
        try:
            ext, meta = call_model(client, params, use_fallbacks)
        except anthropic.BadRequestError as e:
            raise
        except Exception as e:  # refusal, truncation, prose answer: record and stop
            attempts.append({"attempt": attempt, "error": str(e)})
            break
        errors, calc = validate(ext)
        ext["calculated_total"] = calc
        ext["conflict_detected"] = bool(ext.get("line_items")) and ext.get("stated_total") is not None and abs(calc - float(ext["stated_total"])) > 0.01
        record = {"attempt": attempt, "model": meta["model"], "stop_reason": meta["stop_reason"],
                  "tokens": {"in": meta["input_tokens"], "out": meta["output_tokens"]}, "errors": errors}
        attempts.append(record)
        if not errors:
            break
        decision, why = retry_decision(errors, ext)
        record["retry_decision"] = f"{decision}: {why}"
        if decision == "stop" or attempt > max_retries:
            break
        failed = ext
    return finish(doc, ext, attempts, errors)


def finish(doc, ext, attempts, errors):
    ext = ext or {}
    conf = ext.get("confidence") or {}
    low = [k for k, v in conf.items() if isinstance(v, (int, float)) and v < LOW_CONFIDENCE]
    reasons = []
    if low:
        reasons.append(f"low confidence: {', '.join(low)}")
    if ext.get("conflict_detected"):
        reasons.append("conflict_detected")
    if ext.get("missing_information"):
        reasons.append(f"missing information: {ext['missing_information']}")
    if errors:
        reasons.append("unresolved validation errors")
    if not ext or any("error" in a for a in attempts):
        reasons.append("model call failed: " + "; ".join(str(a.get("error")) for a in attempts if "error" in a))
    return {"custom_id": doc["custom_id"], "document_type": doc["document_type_label"], "tool": TOOL["name"],
            "extraction": ext, "attempts": attempts, "final_errors": errors,
            "routing": "human_review" if reasons else "auto_accept", "routing_reasons": reasons,
            "low_confidence_fields": low}


# ----------------------------------------------------------------- batch path
def run_batch(client, docs, model, tool_choice, poll_seconds):
    """Submit every document in one Message Batch, poll, collect by custom_id,
    resubmit only the failures with a modification."""
    def submit(batch_docs, note):
        reqs = [Request(custom_id=d["custom_id"],
                        params=MessageCreateParamsNonStreaming(**request_params(model, d["text"], tool_choice)))
                for d in batch_docs]
        batch = client.messages.batches.create(requests=reqs)
        print(f"batch {batch.id} submitted: {len(reqs)} requests ({note})")
        while True:
            batch = client.messages.batches.retrieve(batch.id)
            if batch.processing_status == "ended":
                break
            c = batch.request_counts
            print(f"  {batch.processing_status}: processing={c.processing} succeeded={c.succeeded} errored={c.errored}")
            time.sleep(poll_seconds)
        outcomes = {}
        for r in client.messages.batches.results(batch.id):  # any order: key by custom_id
            outcomes[r.custom_id] = r
        return batch, outcomes

    by_id = {d["custom_id"]: d for d in docs}
    batch, outcomes = submit(docs, "initial submission")
    log = {"batch_id": batch.id, "submitted": [d["custom_id"] for d in docs], "succeeded": [], "failed": [], "resubmission": None,
           "note": "The Batches API cannot run a tool loop inside one request; validation retries happen on the sync path afterwards."}
    extractions = {}
    for cid, r in outcomes.items():
        if r.result.type == "succeeded":
            msg = r.result.message
            block = next((b for b in msg.content if b.type == "tool_use"), None)
            if block is not None:
                extractions[cid] = block.input
                log["succeeded"].append(cid)
                continue
            log["failed"].append({"custom_id": cid, "why": "no tool_use block"})
        else:
            detail = getattr(r.result, "error", None)
            log["failed"].append({"custom_id": cid, "why": r.result.type, "detail": str(detail)[:200]})

    if log["failed"]:
        retry_ids = [f["custom_id"] for f in log["failed"]]
        modified = []
        for cid in retry_ids:
            d = dict(by_id[cid])
            # The modification: split a long document so the request fits, keep only the lines that carry amounts.
            lines = d["text"].splitlines()
            d["text"] = "\n".join(lines[:1] + [l for l in lines[1:] if any(ch.isdigit() for ch in l)])
            modified.append(d)
        batch2, outcomes2 = submit(modified, "resubmission of failed custom_ids only")
        log["resubmission"] = {"batch_id": batch2.id, "custom_ids": retry_ids,
                               "modification": "chunked to the header plus amount-bearing lines",
                               "succeeded": [], "failed": []}
        for cid, r in outcomes2.items():
            if r.result.type == "succeeded":
                block = next((b for b in r.result.message.content if b.type == "tool_use"), None)
                if block is not None:
                    extractions[cid] = block.input
                    log["resubmission"]["succeeded"].append(cid)
                    continue
            log["resubmission"]["failed"].append(cid)
    return extractions, log


# ----------------------------------------------------------------- reporting
def accuracy(results, labels):
    by_type, by_field = {}, {}
    for r in results:
        lab = labels.get(r["custom_id"], {})
        for f, truth in lab.items():
            got = r["extraction"].get(f)
            if isinstance(truth, float):
                hit = got is not None and abs(float(got) - truth) < 0.01
            elif isinstance(truth, str) and isinstance(got, str):
                hit = got.strip().lower().rstrip(".") == truth.strip().lower().rstrip(".")
            else:
                hit = got == truth
            by_field.setdefault(f, []).append(hit)
            by_type.setdefault(r["document_type"], []).append(hit)
    pct = lambda xs: round(100 * sum(xs) / len(xs)) if xs else None
    return {"overall": pct([h for v in by_field.values() for h in v]),
            "by_field": {k: pct(v) for k, v in by_field.items()},
            "by_document_type": {k: pct(v) for k, v in by_type.items()},
            "lesson": "an aggregate can hide a weak segment; read by_document_type and by_field before reducing human review"}


def stratified_sample(results, seed=7):
    random.seed(seed)
    sample = {}
    for t in sorted({r["document_type"] for r in results}):
        pool = [r["custom_id"] for r in results if r["document_type"] == t and r["routing"] == "auto_accept"]
        sample[t] = random.sample(pool, 1) if pool else []
    return sample


def run_case(uc, client, docs, a):
    import cases
    tool_choice = tool_choice_param("auto")
    if uc == "UC-11":
        p = cases.run_uc11(client, docs, a.model, TOOL, call_model, SCHEMA)
        print(p["observation"])
    elif uc == "UC-12":
        p = cases.run_uc12(client, docs, a.model, lambda params: create_message(client, params, not a.no_fallbacks))
        print("submits executed:", p["submits_executed"], "blocked:", p["submits_blocked"], "tickets:", [t["record_id"] for t in p["review_tickets"]])
    elif uc == "UC-22":
        p = cases.run_uc22()
        print("discussion case; delegation prompt rendered in evidence/cases/UC-22.json")
    elif uc == "UC-31":
        p = cases.run_uc31(client, docs, a.model, TOOL, call_model, SCHEMA)
        print("single pass records:", p["single_pass"]["records_returned"], "| section records:", p["section_passes"]["records_returned"],
              "| unique after reconciliation:", p["reconciliation"]["unique_invoice_ids"], "| duplicates merged:", p["reconciliation"]["duplicates_merged"])
    elif uc == "UC-32":
        p = cases.run_uc32(client, docs, a.model, extract_one, run_batch, tool_choice)
        for w in p["routing"]:
            print(w["decision_line"])
    elif uc == "UC-36":
        p = cases.run_uc36(docs)
        print("partition non-overlapping:", p["non_overlapping"], "| subagents:", [x["agent_name"] for x in p["partition"]])
    else:
        sys.exit(f"unknown case {uc}; see cases/")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--tool-choice", default="auto", choices=["auto", "any", "forced"],
                    help="auto, or ask for any tool or the named tool. See the lesson in evidence/extraction.json")
    ap.add_argument("--batch", action="store_true", help="the Message Batches workflow, simulated locally through the Agent SDK")
    ap.add_argument("--sync", action="store_true", help="(default) blocking Messages API path with validation retries")
    ap.add_argument("--max-retries", type=int, default=2)
    ap.add_argument("--max-docs", type=int, default=0, help="limit documents while experimenting")
    ap.add_argument("--poll-seconds", type=float, default=5.0)
    ap.add_argument("--no-fallbacks", action="store_true", help="plain messages.create without server-side refusal fallbacks")
    ap.add_argument("--case", help="run a practice-test use case: UC-11, UC-12, UC-22, UC-31, UC-32 or UC-36")
    a = ap.parse_args()

    client = anthropic.Anthropic()
    docs = parse_docs()
    if a.max_docs:
        docs = docs[: a.max_docs]
    if a.case:
        return run_case(a.case.upper(), client, docs, a)
    labels = json.loads((HERE / "fixtures" / "labels.json").read_text())
    EVIDENCE.mkdir(exist_ok=True)
    tool_choice = tool_choice_param(a.tool_choice)
    observation = {"requested": a.tool_choice, "sent": tool_choice, "outcome": "accepted"}

    # Teaching point: tool_choice is a Messages API parameter. The Agent SDK has no such setting, so this
    # simulator asks for the same behaviour in the system prompt and records what Claude actually did.
    if a.tool_choice in ("any", "forced"):
        observation["outcome"] = "requested through the system prompt"
        observation["lesson"] = ("On the Messages API, any means Claude must call a tool and forced names the tool. "
                                 "The Agent SDK has no tool_choice setting, so here the instruction carries it. "
                                 "Validate that a tool_use block came back, because an instruction is not a guarantee.")
    print("tool_choice in use:", tool_choice)

    results, batch_log = [], None
    if a.batch:
        extractions, batch_log = run_batch(client, docs, a.model, tool_choice, a.poll_seconds)
        for d in docs:
            ext = extractions.get(d["custom_id"])
            if ext is None:
                results.append(finish(d, None, [{"attempt": 1, "error": "no result from batch"}], [{"kind": "batch", "field": "root", "message": "no result"}]))
                continue
            errors, calc = validate(ext)
            ext["calculated_total"] = calc
            ext["conflict_detected"] = bool(ext.get("line_items")) and ext.get("stated_total") is not None and abs(calc - float(ext["stated_total"])) > 0.01
            attempts = [{"attempt": 1, "via": "batch", "errors": errors}]
            if errors and retry_decision(errors, ext)[0] == "retry":
                # Retries are multi-turn, so they run on the sync path.
                sync = extract_one(client, d, a.model, tool_choice, a.max_retries, not a.no_fallbacks)
                sync["attempts"] = attempts + sync["attempts"]
                results.append(sync)
                continue
            if errors:
                attempts[0]["retry_decision"] = "stop: " + retry_decision(errors, ext)[1]
            results.append(finish(d, ext, attempts, errors))
        (EVIDENCE / "batch.json").write_text(json.dumps(batch_log, indent=2) + "\n")
    else:
        for d in docs:
            results.append(extract_one(client, d, a.model, tool_choice, a.max_retries, not a.no_fallbacks))
            r = results[-1]
            print(f"{r['custom_id']} {r['document_type']:11s} attempts={len(r['attempts'])} errors={len(r['final_errors'])} "
                  f"conflict={r['extraction'].get('conflict_detected')} -> {r['routing']}")

    report = {"model": a.model, "mode": "batch" if a.batch else "sync", "engine": "Claude Agent SDK, one model turn per call", "tool_choice": observation,
              "tool": {"name": TOOL["name"], "strict": TOOL.get("strict", False)},
              "routing_summary": {k: [r["custom_id"] for r in results if r["routing"] == k] for k in ("auto_accept", "human_review")},
              "results": results}
    acc = accuracy(results, labels)
    acc["stratified_sample_for_audit"] = stratified_sample(results)
    (EVIDENCE / "extraction.json").write_text(json.dumps(report, indent=2) + "\n")
    (EVIDENCE / "accuracy.json").write_text(json.dumps(acc, indent=2) + "\n")
    print("accuracy:", json.dumps({k: acc[k] for k in ("overall", "by_field", "by_document_type")}))
    print("routing:", report["routing_summary"])
    if batch_log:
        print("batch:", batch_log["batch_id"], "succeeded", len(batch_log["succeeded"]), "failed", [f["custom_id"] for f in batch_log["failed"]])


if __name__ == "__main__":
    try:
        main()
    except anthropic.AuthenticationError:
        sys.exit("Not signed in. Run: claude auth login")
