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
  // The scenario board (assets/scene.js): one shared extraction, then two review decisions from two reports.
  scene: {
    title: "22 accounts-payable documents: a 97% average, and three credit notes it hides",
    caption: "Both decisions use the same extraction and the same scores. Only the QA report the ops lead reads changes: the single overall number, or the breakdown.",
    lanes: [
      { key: "X", label: "Extract and score", sub: "shared by both decisions", on: /== Extract/, stages: [
        { id: "xdocs", icon: "🧾", t: "22 documents", s: "9 invoices · 10 receipts · 3 credit notes" },
        { id: "xclaude", icon: "🤖", t: "Claude extracts", s: "vendor, due_date, stated_total · one tool call", claude: true },
        { id: "xscore", icon: "🎯", t: "Scored against labels", s: "66 fields vs human-verified values" },
        { id: "xacc", icon: "📊", t: "Accuracy three ways", s: "overall · by_document_type · by_field" } ] },
      { key: "A", label: "Trap (option A)", sub: "decide from the overall number", tone: "trap", on: /Trap \(option A\)/, stages: [
        { id: "arep", icon: "1️⃣", t: "QA report: one number", s: "overall field accuracy vs the 95% bar", diff: true },
        { id: "alead", icon: "🧑‍💼", t: "Ops lead (Claude)", s: "decide_review: cut, keep, sample rates", claude: true },
        { id: "acut", icon: "✂", t: "Credit notes", s: "want: kept under full human review", out: true },
        { id: "asample", icon: "🎲", t: "Stratified sampling", s: "want: every type > 0, credit notes ≥ 0.5", out: true } ] },
      { key: "B", label: "Fix (option B)", sub: "decide from the breakdown", tone: "fix", on: /Fix \(option B\)/, stages: [
        { id: "brep", icon: "🧮", t: "QA report: the breakdown", s: "by_document_type, by_field and every miss", diff: true },
        { id: "blead", icon: "🧑‍💼", t: "Ops lead (Claude)", s: "decide_review: cut, keep, sample rates", claude: true },
        { id: "bcut", icon: "✂", t: "Credit notes", s: "want: kept under full human review", out: true },
        { id: "bsample", icon: "🎲", t: "Stratified sampling", s: "want: every type > 0, credit notes ≥ 0.5", out: true } ] },
    ],
  },
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

    const done = DOCS.filter((d) => records.some((r) => r.doc_id === d.id)).length;
    s.show("xdocs", `${done} of ${DOCS.length} extracted`, "done");
    s.show("xscore", `${acc.misses.length} miss${acc.misses.length === 1 ? "" : "es"}${acc.misses.length ? `: ${[...new Set(acc.misses.map((m) => `${m.type}.${m.field}`))].join(", ")}` : ""}`, "done");
    s.show("xacc", `overall ${acc.overall}% · credit_note ${acc.by_document_type.credit_note}%`, "done");

    // What each decision did to the weak segment, and to sampling.
    const cnKept = (d) => (d.keep_review_for || []).includes("credit_note") && !(d.cut_review_for || []).includes("credit_note");
    const sampleOk = (d) => ["invoice", "receipt", "credit_note"].every((k) => Number((d.sample_rate || {})[k]) > 0) && Number((d.sample_rate || {}).credit_note) >= 0.5;
    const cnText = (d) => cnKept(d) ? "kept under review" : (d.cut_review_for || []).includes("credit_note") ? "review CUT" : "not decided";
    const rates = (d) => ["invoice", "receipt", "credit_note"].map((k) => `${k} ${(d.sample_rate || {})[k] ?? "?"}`).join(" · ");
    const list = (xs) => (xs || []).join(", ") || "none";

    s.log("== Trap (option A): decide from the single overall number", "note");
    s.show("arep", `overall ${acc.overall}% · bar ${BAR}%`, "done");
    const trap = decisionOf(await ask(E, s, `QA report for the extraction pipeline.\nDocument types: invoice, receipt, credit_note (${DOCS.length} documents).\nOverall field accuracy: ${acc.overall}%.\nTeam rule: cut human review where accuracy is at least ${BAR}%.\nDecide.`));
    s.log(`Decision from the aggregate: ${show(trap)}`, "result");
    s.show("alead", `cut: ${list(trap.cut_review_for)}`, "done");
    s.show("acut", `${cnText(trap)} (${acc.by_document_type.credit_note}% accurate)`, cnKept(trap) ? "good" : "bad");
    s.show("asample", rates(trap), sampleOk(trap) ? "good" : "bad");
    await s.pause({
      title: "The trap finished: the review decision came from one number",
      outcome: `The ops lead saw only **${acc.overall}% overall** against the ${BAR}% bar and cut review for **${list(trap.cut_review_for)}**. ` +
        `Credit notes, at **${acc.by_document_type.credit_note}%** on their own, are ${cnKept(trap) ? "still under review this time, though nothing in the report said why they should be" : "**no longer checked by a human**"}.`,
      next: "Fix: the same scores, broken down by document type and by field",
    });

    s.log("== Fix (option B): decide from the breakdown by document type and by field", "note");
    s.show("brep", `credit_note ${acc.by_document_type.credit_note}% · stated_total ${acc.by_field.stated_total}%`, "done");
    const fix = decisionOf(await ask(E, s, `QA report for the extraction pipeline.\nOverall field accuracy: ${acc.overall}%.\nby_document_type (accuracy %): ${JSON.stringify(acc.by_document_type)}\ndocuments per type: ${JSON.stringify(acc.documents_per_type)}\nby_field (accuracy %): ${JSON.stringify(acc.by_field)}\nMisses: ${JSON.stringify(acc.misses)}\nTeam rule: cut human review only for a document type whose own accuracy is at least ${BAR}%, and keep stratified sampling running on every type to catch drift.\nDecide.`));
    s.log(`Decision from the breakdown: ${show(fix)}`, "result");
    s.show("blead", `cut: ${list(fix.cut_review_for)}`, "done");
    s.show("bcut", `${cnText(fix)} (${acc.by_document_type.credit_note}% accurate)`, cnKept(fix) ? "good" : "bad");
    s.show("bsample", rates(fix), sampleOk(fix) ? "good" : "bad");

    const t = acc.by_document_type, f = acc.by_field;
    const rate = fix.sample_rate || {};
    const tone = (ok) => (ok ? "good" : "bad");
    const verdict = (d, fix) => cnKept(d) && sampleOk(d)
      ? `${fix ? "Kept" : "Right this time: kept"} credit notes (${t.credit_note}%) under human review, cut it for ${list(d.cut_review_for)}, and kept sampling every type.${fix ? "" : " The report it read gave no reason to: it was a guess that happened to be safe."}`
      : `${fix ? "Not this run: " : "Wrong: "}${cnKept(d) ? "kept credit notes under review" : `cut review for credit notes, the ${t.credit_note}% segment`}${sampleOk(d) ? "" : ["invoice", "receipt", "credit_note"].every((k) => Number((d.sample_rate || {})[k]) > 0) ? `, and credit notes are sampled at only ${(d.sample_rate || {}).credit_note} (want at least 0.5)` : `, and sampling stops on some types (${rates(d)})`}.`;
    return {
      final: `Extraction accuracy: overall ${acc.overall}% · by_document_type ${JSON.stringify(t)} · by_field ${JSON.stringify(f)}\n\nDecision from the aggregate: ${show(trap)}\n\nDecision from the breakdown: ${show(fix)}\nReason: ${fix.reason || ""}`,
      compare: {
        cols: [
          { title: "Trap: decide from the overall number", short: "Trap (A)", tone: "trap", verdict: verdict(trap, false), said: trap.reason },
          { title: "Fix: decide from the breakdown", short: "Fix (B)", tone: "fix", verdict: verdict(fix, true), said: fix.reason },
        ],
        rows: [
          ["What the ops lead read", `overall **${acc.overall}%** only`, `credit_note **${t.credit_note}%** · stated_total **${f.stated_total}%** · ${acc.misses.length} misses`],
          ["Review cut for", list(trap.cut_review_for), list(fix.cut_review_for)],
          [`Credit notes (${t.credit_note}% accurate)`, { v: cnText(trap), tone: tone(cnKept(trap)) }, { v: cnText(fix), tone: tone(cnKept(fix)) }],
          [`Receipts (${t.receipt}% accurate)`, (trap.cut_review_for || []).includes("receipt") ? "review cut" : "kept under review", (fix.cut_review_for || []).includes("receipt") ? "review cut" : "kept under review"],
          ["Sample rates", { v: rates(trap), tone: tone(sampleOk(trap)) }, { v: rates(fix), tone: tone(sampleOk(fix)) }],
        ],
        note: `Same ${DOCS.length} documents, same extraction, same scores. The only change is the report the decision was made from: one ${acc.overall}% average, or the same numbers split by document type and by field, which shows where the ${acc.misses.length} miss${acc.misses.length === 1 ? "" : "es"} sit${acc.misses.length === 1 ? "s" : ""}${acc.misses.length ? ` (${[...new Set(acc.misses.map((m) => `${m.type}.${m.field}`))].join(", ")})` : ""}.`,
      },
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
