// Lab 29 · Task 5.5 · Simulator 6: Claude extracts vendor, due_date and stated_total from 22 documents
// (invoices, receipts, credit notes); the script scores every field against human-verified labels and
// reports accuracy three ways, as extract.py does. Then Claude decides where human review can be cut:
// once from the single overall number (the trap), once from the per-type and per-field breakdown.
import { DOCS, EXTRACT_TOOL, DECIDE_TOOL, accuracy } from "./shared/t5-extract.js";

const BAR = 95;
const ask = (E, s, content) => E.callClaude(s, {
  max_tokens: 2000,
  system: "You are the operations lead for an accounts-payable extraction pipeline. You decide, per document type, whether human review can be cut, and what share of documents humans keep sampling. Decide only from the QA report you are given.",
  messages: [{ role: "user", content }], tools: [DECIDE_TOOL], tool_choice: { type: "tool", name: "decide_review" },
});
const decisionOf = (r) => r.content.find((b) => b.type === "tool_use")?.input || {};
const show = (d) => `cut review for [${(d.cut_review_for || []).join(", ")}] · keep review for [${(d.keep_review_for || []).join(", ")}] · sample rates ${JSON.stringify(d.sample_rate || {})}`;

export default {
  id: 29,
  see: "Overall accuracy prints near 97%, yet by_document_type.credit_note sits far lower and by_field.stated_total is the weak field; deciding from the breakdown keeps credit notes under review while sampling the other types.",
  explain: "Two Brightline credit notes arrive as thermal-fax copies with a faded total, so Claude rightly returns null for stated_total and both miss against the labels. Spread over 66 scored fields, two misses barely move the aggregate, which still clears the 95% bar, so a decision made from that one number cuts review everywhere. The breakdown puts both misses in one place: by_document_type.credit_note and by_field.stated_total fall, while invoices and receipts stay near 100%. Deciding from the breakdown automates the safe segments, keeps humans on credit notes and keeps stratified sampling running on every type to catch drift.",
  try: "In docs/sims/shared/t5-extract.js fade the total on one invoice (for example DOC-13's TOTAL DUE line) and rerun: only by_document_type.invoice and by_field.stated_total fall, while receipts hold.",
  slide: {
    title: "A 97% average can hide a failing segment",
    code: `def accuracy(results, labels):                  # KEY 1
    by_type, by_field = {}, {}
    for doc in results:
        t = labels[doc.id]["type"]
        for f in FIELDS:
            hit = doc[f] == labels[doc.id][f]
            by_type.setdefault(t, []).append(hit)   # KEY 2
            by_field.setdefault(f, []).append(hit)  # KEY 3
    return {"overall": pct(all_hits),
            "by_document_type": pct_each(by_type),
            "by_field": pct_each(by_field)}
sample = stratified(docs, by="type", rate=0.1)  # KEY 4`,
    keys: [["1", "Score against labels", "Human-verified values, field by field."],
           ["2", "Break down by type", "A weak document type cannot hide."],
           ["3", "Break down by field", "Shows which field is failing."],
           ["4", "Keep sampling", "Stratified checks on every type catch drift."]],
  },
  async run(s, E) {
    s.log(`== Extract: ${DOCS.length} documents (${["invoice", "receipt", "credit_note"].map((t) => `${DOCS.filter((d) => d.type === t).length} ${t}`).join(", ")}) in one forced tool call`, "note");
    const ex = await E.callClaude(s, {
      max_tokens: 6000,
      messages: [{ role: "user", content: `Extract vendor, due_date and stated_total from every document below and record them with record_extractions.\n\n${DOCS.map((d) => `=== ${d.id} | type: ${d.type}\n${d.text}`).join("\n\n")}` }],
      tools: [EXTRACT_TOOL], tool_choice: { type: "tool", name: "record_extractions" },
    });
    const records = ex.content.find((b) => b.type === "tool_use")?.input?.records || [];
    s.log(`Claude returned ${records.length} records.`, "result");
    const acc = accuracy(records);
    s.log(`overall: ${acc.overall}%`, "note");
    s.log(`by_field: ${JSON.stringify(acc.by_field)}`, "note");
    s.log(`by_document_type: ${JSON.stringify(acc.by_document_type)}`, "note");
    s.log(`misses: ${acc.misses.map((m) => `${m.doc} ${m.type}.${m.field} got ${JSON.stringify(m.got)} want ${JSON.stringify(m.want)}`).join(" · ") || "none"}`, "note");

    s.log("== Trap (option A): decide from the single overall number", "note");
    const trap = decisionOf(await ask(E, s, `QA report for the extraction pipeline.\nDocument types: invoice, receipt, credit_note (${DOCS.length} documents).\nOverall field accuracy: ${acc.overall}%.\nTeam rule: cut human review where accuracy is at least ${BAR}%.\nDecide.`));
    s.log(`Decision from the aggregate: ${show(trap)}`, "result");

    s.log("== Fix (option B): decide from the breakdown by document type and by field", "note");
    const fix = decisionOf(await ask(E, s, `QA report for the extraction pipeline.\nOverall field accuracy: ${acc.overall}%.\nby_document_type (accuracy %): ${JSON.stringify(acc.by_document_type)}\ndocuments per type: ${JSON.stringify(acc.documents_per_type)}\nby_field (accuracy %): ${JSON.stringify(acc.by_field)}\nMisses: ${JSON.stringify(acc.misses)}\nTeam rule: cut human review only for a document type whose own accuracy is at least ${BAR}%, and keep stratified sampling running on every type to catch drift.\nDecide.`));
    s.log(`Decision from the breakdown: ${show(fix)}`, "result");

    const t = acc.by_document_type, f = acc.by_field;
    const rate = fix.sample_rate || {};
    return {
      final: `Extraction accuracy: overall ${acc.overall}% · by_document_type ${JSON.stringify(t)} · by_field ${JSON.stringify(f)}\n\nDecision from the aggregate: ${show(trap)}\n\nDecision from the breakdown: ${show(fix)}\nReason: ${fix.reason || ""}`,
      checks: [
        E.check(`Claude extracted all ${DOCS.length} documents`, DOCS.every((d) => records.some((r) => r.doc_id === d.id))),
        E.check(`The aggregate clears the ${BAR}% bar while credit_note is below 80% and invoice and receipt are at least 95%`, acc.overall >= BAR && t.credit_note < 80 && t.invoice >= 95 && t.receipt >= 95),
        E.check("by_field shows stated_total as the weakest field", f.stated_total < f.vendor && f.stated_total < f.due_date),
        E.check("From the breakdown, review is kept for credit notes and cut for receipts", (fix.keep_review_for || []).includes("credit_note") && !(fix.cut_review_for || []).includes("credit_note") && (fix.cut_review_for || []).includes("receipt")),
        E.check("Stratified sampling keeps running: every type has a sample rate above 0, credit notes at least 0.5", ["invoice", "receipt", "credit_note"].every((k) => Number(rate[k]) > 0) && Number(rate.credit_note) >= 0.5),
      ],
    };
  },
};
