// Lab 6 · Task 1.6 · Simulator 6 (Case UC-31): predictable packets get a fixed pipeline.
// Local first: one extraction pass per section, so each call sees a small evidence set.
// Global second: a reconciliation pass in code validates each record, deduplicates by invoice_id and
// checks totals across sections. The packet is built from fixtures/invoices.txt: the supplies invoice
// INV-2041 appears in the Invoices section AND again as a copy in Attachments.

const DOC01 = `INVOICE INV-2041
From: Harbour Office Supplies Pte Ltd
Date: 03/10/2026   Due: 02/11/2026   Currency: SGD
1 x A4 paper (10 reams) ......... 48.00
1 x Toner cartridge ............. 112.00
TOTAL DUE: 160.00`;
const DOC04 = `INVOICE INV-2043   Northgate Logistics   Issued 2026-10-09   Due 2026-11-08
Freight Singapore->Johor ........... 420.00
Fuel surcharge ..................... 36.00
TOTAL: 456.00`;
const DOC05 = `CREDIT NOTE CN-118 against INV-1990, Harbour Office Supplies, 10 Oct 2026
Returned: 2 x Desk lamp .......... -78.00
Credit total: -78.00   Currency: not shown`;
const SECTIONS = [
  ["Intake form", "Claimant: Harbour Office Supplies account. Packet assembled 2026-10-15 for expense reconciliation."],
  ["Narrative notes", "Finance note: the October supplies invoice and the freight invoice were both approved by the department head; the lamp credit offsets INV-1990."],
  ["Invoices", DOC01 + "\n\n" + DOC04],
  ["Credits", DOC05],
  ["Attachments", "Copy of supplier invoice for records:\n" + DOC01],
];
const PACKET = SECTIONS.map(([n, t]) => `[section: ${n}]\n${t}`).join("\n\n");

const SCHEMA = {
  type: "object",
  properties: {
    invoice_id: { type: "string", description: "The document's own reference number (INV-, R-, CN- ...)" },
    vendor: { type: "string" },
    document_type: { type: "string", enum: ["invoice", "credit_note", "receipt", "other"] },
    issue_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    stated_total: { type: "number", description: "The total printed on the document; negative for a credit note" },
    line_items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, amount: { type: "number" } }, required: ["description", "amount"] } },
  },
  required: ["invoice_id", "vendor", "document_type", "issue_date", "stated_total", "line_items"],
};

// Each pass gets its own extract_invoice tool that records what Claude sends.
function extractTool(sink, source) {
  return {
    description: "Record one financial document (invoice, receipt or credit note) as structured data. Call it once per document. Use only the document text; dates as YYYY-MM-DD, amounts as plain decimals.",
    input_schema: SCHEMA,
    run: (input) => { sink.push({ source, ...input }); return { recorded: input.invoice_id }; },
  };
}

// Reconciliation pass (code): schema check, dedupe by invoice_id, cross-section total consistency.
function reconcile(records) {
  const merged = {}, conflicts = [], schemaErrors = [];
  for (const r of records) {
    const miss = SCHEMA.required.filter((k) => r[k] === undefined);
    const sum = (r.line_items || []).reduce((t, x) => t + Number(x.amount || 0), 0);
    if (miss.length) schemaErrors.push(`${r.source}: missing ${miss.join(", ")}`);
    if (r.issue_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.issue_date)) schemaErrors.push(`${r.source}: issue_date ${r.issue_date} is not YYYY-MM-DD`);
    if (Math.abs(sum - Number(r.stated_total)) > 0.01) schemaErrors.push(`${r.source}: ${r.invoice_id} line items sum to ${sum}, stated total ${r.stated_total}`);
    const key = String(r.invoice_id || "").toUpperCase();
    if (merged[key]) {
      if (Math.abs(Number(merged[key].stated_total) - Number(r.stated_total)) > 0.01) conflicts.push(`${key}: ${merged[key].source} says ${merged[key].stated_total}, ${r.source} says ${r.stated_total}`);
      merged[key].also_seen_in.push(r.source);
    } else merged[key] = { source: r.source, stated_total: Number(r.stated_total), also_seen_in: [] };
  }
  const dups = Object.values(merged).reduce((t, v) => t + v.also_seen_in.length, 0);
  return { merged, unique: Object.keys(merged).sort(), duplicatesMerged: dups, conflicts, schemaErrors };
}

const ids = (recs) => recs.map((r) => r.invoice_id).join(", ") || "none";

export default {
  id: 6,
  see: "Phase 1, the single pass, returns its own list of records for the whole packet (three in our runs), with nothing showing that INV-2041 appeared twice or that its totals were ever compared. Phase 2's section passes (Invoices, Credits, Attachments) return four records, and the reconciliation pass merges them into three unique documents (CN-118, INV-2041, INV-2043), merges the Attachments copy as one duplicate, and finds every total consistent.",
  try: "Change TOTAL DUE in the Attachments copy to 165.00 (build it from a modified DOC01 in SECTIONS) and run it again: reconciliation now flags a cross-section total conflict on INV-2041, a check that only makes sense once every section's record exists.",
  explain: "One pass over a whole packet asks the model to find every document and enforce cross-section rules at the same time; its record set is whatever that one call happened to produce. The fixed pipeline splits the job. Each section pass looks at a small evidence set, so a failure is easy to isolate to one section. The reconciliation pass then runs the checks that only make sense once every partial record exists: deduplicating INV-2041, which appears in Invoices and again in Attachments, and comparing its totals across sections. Predictable sections suit this fixed sequence; adaptive decomposition is for exploratory work where the next step depends on what you find.",
  slide: {
    title: "Extract each section, then reconcile the whole packet",
    code: `records = []
for name, text in sections:                     # KEY 1
    if not has_financial_doc(text): continue
    records += extract(f"[section: {name}]\\n{text}")
merged = {}
for r in records:                               # KEY 2
    validate(r, SCHEMA)
    key = r.invoice_id
    if key in merged:                           # KEY 3
        if merged[key].total != r.stated_total:
            conflicts.append(key)               # KEY 4
        merged[key].also_seen_in.append(r.source)
    else: merged[key] = r`,
    keys: [["1", "Local first", "Each pass sees one section, a small evidence set."],
           ["2", "Global second", "Reconcile only once every section record exists."],
           ["3", "Deduplicate by id", "INV-2041 in Attachments merges into one record."],
           ["4", "Cross-section totals", "A copy with a different total is flagged."]],
  },
  async run(s, E) {
    s.log("Case UC-31 · a five-section packet: Intake form, Narrative notes, Invoices (INV-2041, INV-2043), Credits (CN-118), Attachments (a copy of INV-2041)", "note");

    s.log("== Phase 1 · single pass: the whole packet in one extraction call", "note");
    const single = [];
    await E.runAgent(s, {
      system: "Record financial documents with extract_invoice. One call per document.",
      prompt: `<document>\n${PACKET}\n</document>\nRecord every financial document in this packet with the extract_invoice tool.`,
      tools: { extract_invoice: extractTool(single, "whole packet") },
      maxTurns: 2, max_tokens: 2500,
    });
    const singleIds = single.map((r) => String(r.invoice_id).toUpperCase());
    const singleDup = singleIds.length - new Set(singleIds).size;
    s.log(`Single pass: ${single.length} record(s) [${ids(single)}]${singleDup ? `, ${singleDup} duplicate(s) left in the output` : ""}. Nothing in that output says which section each record came from, whether INV-2041 appeared twice, or whether its totals agree: on a five-section toy packet one pass can look right, and on a 60-page packet nobody can tell when it is wrong.`, "note");

    s.log("== Phase 2 · section passes: one extraction per section that holds a financial document", "note");
    const sectionRecords = [];
    for (const [name, text] of SECTIONS) {
      if (!/(INVOICE|RECEIPT|CREDIT NOTE)/.test(text)) { s.log(`Section "${name}": no financial document, skipped in code`, "note"); continue; }
      await E.runAgent(s, {
        label: `(section pass: ${name})`,
        system: "Record financial documents with extract_invoice. One call per document.",
        prompt: `<document>\n[section: ${name}]\n${text}\n</document>\nRecord each financial document in this section with the extract_invoice tool.`,
        tools: { extract_invoice: extractTool(sectionRecords, name) },
        maxTurns: 2, max_tokens: 1500,
      });
    }
    s.log(`Section passes: ${sectionRecords.length} records [${sectionRecords.map((r) => `${r.invoice_id} from ${r.source}`).join("; ")}]`, "note");

    s.log("== Phase 3 · reconciliation pass (code): schema and arithmetic check, dedupe by invoice_id, cross-section totals", "note");
    const rec = reconcile(sectionRecords);
    const lines = rec.unique.map((k) => `${k}: ${rec.merged[k].stated_total.toFixed(2)} (from ${rec.merged[k].source}${rec.merged[k].also_seen_in.length ? `; duplicate merged from ${rec.merged[k].also_seen_in.join(", ")}` : ""})`);
    const final = `Reconciled packet: ${rec.unique.length} unique documents from ${sectionRecords.length} section records.\n${lines.join("\n")}\nDuplicates merged: ${rec.duplicatesMerged}. Cross-section total conflicts: ${rec.conflicts.length ? rec.conflicts.join("; ") : "none"}. Validation problems: ${rec.schemaErrors.length ? rec.schemaErrors.join("; ") : "none"}.`;
    for (const l of final.split("\n")) s.log(l, "reply");

    const count = (id) => sectionRecords.filter((r) => String(r.invoice_id).toUpperCase() === id).length;
    return {
      final,
      checks: [
        E.check("Section passes returned four records: INV-2041 twice, INV-2043 and CN-118", sectionRecords.length === 4 && count("INV-2041") === 2 && count("INV-2043") === 1 && count("CN-118") === 1),
        E.check("Reconciliation left three unique documents: CN-118, INV-2041, INV-2043", rec.unique.join() === "CN-118,INV-2041,INV-2043"),
        E.check("The Attachments copy of INV-2041 was merged as one duplicate", rec.duplicatesMerged === 1 && rec.merged["INV-2041"]?.also_seen_in.join() === "Attachments"),
        E.check("Every record passed validation and the totals agree across sections", rec.schemaErrors.length === 0 && rec.conflicts.length === 0),
      ],
    };
  },
};
