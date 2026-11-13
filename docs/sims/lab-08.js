// Lab 8 · Task 2.1 · Simulator 6: one catch-all analyze_document tool versus a few non-overlapping tools.
// Same documents, same prompt, two tool sets. The catch-all tool hides three jobs behind an "operation"
// parameter and its schema has no room for invoice fields or a source excerpt. The split set gives each
// job its own description (including when NOT to use it) and its own input_schema contract.
import { oneShot, validate } from "./shared/t2-kit.js";

// Three of Simulator 6's seven fixtures (fixtures/invoices.txt): an invoice, a receipt, a credit note.
const DOCS = [
  { id: "DOC-01", text: "INVOICE INV-2041\nFrom: Harbour Office Supplies Pte Ltd\nDate: 03/10/2026   Due: 02/11/2026   Currency: SGD\n1 x A4 paper (10 reams) ......... 48.00\n1 x Toner cartridge ............. 112.00\nTOTAL DUE: 160.00" },
  { id: "DOC-03", text: "RECEIPT R-7781   Lumen Coworking   2026-10-07\nDay pass ............................ 35.00\nAmount paid: 38.00 (incl. 9% GST)" },
  { id: "DOC-05", text: "CREDIT NOTE CN-118 against INV-1990, Harbour Office Supplies, 10 Oct 2026\nReturned: 2 x Desk lamp .......... -78.00\nCredit total: -78.00   Currency: not shown" },
];
const SYSTEM = "You feed an accounts-payable pipeline. Pick the tool whose description matches the job.";
const EXTRACT_ASK = (d) => `<document>\n${d}\n</document>\nProcess this document for the accounts-payable pipeline. The downstream validator expects extracted invoice fields.`;
const VERIFY_ASK = (d) => `<document>\n${d}\n</document>\nA colleague claims the total of this invoice is 160.00. Check that claim for the audit trail.`;

// The contract the downstream validator enforces (Simulator 6's invoice.schema.json).
const INVOICE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["invoice_id", "vendor", "issue_date", "due_date", "currency", "currency_detail", "document_type", "category", "category_detail",
             "stated_total", "calculated_total", "conflict_detected", "line_items", "missing_information", "confidence"],
  properties: {
    invoice_id: { type: "string", description: "The document's own reference number (INV-, R-, CN- ...)" },
    vendor: { type: "string", description: "Issuing company, exactly as printed" },
    issue_date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    due_date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "null when the document states no due date" },
    currency: { type: "string", enum: ["SGD", "USD", "MYR", "other", "unclear"] },
    currency_detail: { type: ["string", "null"], description: "ISO code when currency is 'other', otherwise null" },
    document_type: { type: "string", enum: ["invoice", "credit_note", "receipt", "other", "unclear"] },
    category: { type: "string", enum: ["office_supplies", "catering", "logistics", "software", "printing", "workspace", "other", "unclear"] },
    category_detail: { type: ["string", "null"], description: "free text when category is 'other', otherwise null" },
    stated_total: { type: "number", description: "The total printed on the document; negative for a credit note" },
    calculated_total: { type: "number", description: "Sum of line_items amounts" },
    conflict_detected: { type: "boolean", description: "true when calculated_total and stated_total differ by more than 0.01" },
    line_items: { type: "array", items: { type: "object", additionalProperties: false, required: ["description", "amount"],
                  properties: { description: { type: "string" }, amount: { type: "number" } } } },
    missing_information: { type: ["string", "null"], description: "What the document refers to but does not contain; null when nothing is missing" },
    confidence: { type: "object", additionalProperties: false, required: ["vendor", "stated_total", "due_date", "line_items"],
                  properties: { vendor: { type: "number" }, stated_total: { type: "number" }, due_date: { type: "number" }, line_items: { type: "number" } } },
  },
};
const VALIDATOR_SCHEMA = { ...INVOICE_SCHEMA, properties: { ...INVOICE_SCHEMA.properties, line_items: { ...INVOICE_SCHEMA.properties.line_items, minItems: 1 } } };

export default {
  id: 8,
  see: "The catch-all analyze_document tool sends only document_text, operation and format, so the validator gets no invoice fields and the verify request carries no excerpt, while the split set calls extract_invoice on every document with a payload the validator accepts and quotes DOC-01 when verifying the claim.",
  explain: "A catch-all analyze_document tool forces Claude to guess the workflow from an operation parameter, and its input_schema has no field that can carry invoice data or a source excerpt, so the validator receives nothing it can use. Split tools give each job its own description, including when NOT to use it, and its own input_schema, so the choice is clear and extract_invoice delivers a schema-valid payload. strict: true keeps the input on the schema; the arithmetic check on the totals is still the pipeline's job. Each step here is a single call: the pipeline takes the tool_use input and hands it to the validator, so it never calls Claude a second time.",
  try: "In this file, delete the line \"Do NOT use it when a downstream system expects structured fields\" from summarize_document's description and run it again: watch whether any document drifts into a summary.",
  slide: {
    title: "Split the catch-all tool into jobs Claude can tell apart",
    code: `# before: one tool, three jobs behind a parameter
analyze_document(document_text, operation, format)  # KEY 1

# after: a few tools that don't overlap
extract_invoice(invoice_id, vendor, line_items, ...) # KEY 2
  "Record one financial document as structured data"
summarize_document(summary)
  "Only when a person asked. Do NOT use when a
   downstream system expects fields"              # KEY 3
verify_claim_against_source(claim, source_excerpt) # KEY 4
  "Requires the exact excerpt; never call without"`,
    keys: [["1", "One tool hides three jobs", "No field in its schema can carry invoice data."],
           ["2", "The schema is the contract", "The validator gets the fields it expects."],
           ["3", "Say when NOT to use", "Descriptions drive which tool Claude picks."],
           ["4", "Require what the job needs", "Verification can't run without its excerpt."]],
  },
  async run(s, E) {
    // The downstream consumers: the AP validator wants invoice fields; the audit trail wants a quoted excerpt.
    const intoValidator = (payload) => {
      const errors = validate(VALIDATOR_SCHEMA, payload);
      return errors.length ? { isError: true, validator: "rejected", errors: errors.slice(0, 3), total_errors: errors.length }
                           : { validator: "accepted", invoice_id: payload.invoice_id, stated_total: payload.stated_total };
    };
    const generic = {
      analyze_document: {
        description: "Analyze a document.",
        input_schema: { type: "object", additionalProperties: false, required: ["document_text", "operation", "format"],
          properties: { document_text: { type: "string" }, operation: { type: "string", enum: ["extract", "summarize", "verify"] }, format: { type: "string", enum: ["json", "text"] } } },
        run: (inp) => intoValidator(inp),
      },
    };
    const split = {
      extract_invoice: {
        description: "Record one financial document (invoice, receipt or credit note) as structured data for the accounts-payable validator. Call this tool exactly once per document. Fill every field from the document text only: use null for any field the document does not state, and never infer, estimate or invent a value. Dates YYYY-MM-DD; amounts as plain decimals. 'S$', 'SGD' and 'GST' imply SGD; no currency stated at all is 'unclear'. Set calculated_total to the sum of line_items and conflict_detected to true when it differs from stated_total by more than 0.01. Do NOT use it to summarise a document or to check a claim.",
        input_schema: INVOICE_SCHEMA, strict: true,
        run: (inp) => intoValidator(inp),
      },
      summarize_document: {
        description: "Write a two-sentence plain-language summary of a document for a human reader. Use it only when a person asked for a summary. Do NOT use it when a downstream system expects structured fields: that is extract_invoice.",
        input_schema: { type: "object", additionalProperties: false, required: ["summary"], properties: { summary: { type: "string" } } }, strict: true,
        run: () => ({ isError: true, validator: "rejected", errors: ["a summary has no invoice fields"] }),
      },
      verify_claim_against_source: {
        description: "Check one specific claim (for example 'the total is 160.00') against a quoted excerpt of the source document. Requires the exact excerpt; never call it without one. Do NOT use it to extract fields or to summarise.",
        input_schema: { type: "object", additionalProperties: false, required: ["claim", "source_excerpt", "supported"],
          properties: { claim: { type: "string" }, source_excerpt: { type: "string", description: "Copied verbatim from the document" }, supported: { type: "boolean" } } }, strict: true,
        run: (inp) => ({ audit: "recorded", claim: inp.claim, supported: inp.supported, excerpt_chars: (inp.source_excerpt || "").length }),
      },
    };
    const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();

    const tally = {};
    for (const [phase, tools, title] of [["generic", generic, "the catch-all analyze_document tool"], ["split", split, "three non-overlapping tools"]]) {
      s.log(`\n== Phase ${phase === "generic" ? 1 : 2}: ${title} [${Object.keys(tools).join(", ")}]`, "note");
      const rows = [];
      for (const d of DOCS) {
        const r = await oneShot(s, E, { label: `P${phase === "generic" ? 1 : 2} ${d.id}`, system: SYSTEM, prompt: EXTRACT_ASK(d.text), tools, tool_choice: { type: "auto" }, max_tokens: 1500 });
        rows.push({ doc: d.id, tool: r.name, operation: r.input?.operation, accepted: !!(r.result && r.result.validator === "accepted") });
      }
      const v = await oneShot(s, E, { label: `P${phase === "generic" ? 1 : 2} verify`, system: SYSTEM, prompt: VERIFY_ASK(DOCS[0].text), tools, tool_choice: { type: "auto" }, max_tokens: 800 });
      const excerpt = v.input?.source_excerpt;
      tally[phase] = { rows, verify: { tool: v.name, operation: v.input?.operation, excerpt, quoted: !!excerpt && norm(DOCS[0].text).includes(norm(excerpt)) } };
      const ok = rows.filter((r) => r.accepted).length;
      s.log(`Phase ${phase === "generic" ? 1 : 2} result: the validator accepted invoice fields on ${ok}/${DOCS.length} documents ` +
            `(tools chosen: ${rows.map((r) => `${r.doc} ${r.tool || "prose"}${r.operation ? "/" + r.operation : ""}`).join(", ")}); ` +
            `verify request: ${v.name || "prose"}${excerpt ? " with a source excerpt" : " with NO source excerpt"}.`, "note");
    }

    const g = tally.generic, sp = tally.split;
    const gOk = g.rows.filter((r) => r.accepted).length;
    const spPicked = sp.rows.filter((r) => r.tool === "extract_invoice").length;
    const spOk = sp.rows.filter((r) => r.accepted).length;
    return {
      final: `Catch-all analyze_document: the validator accepted invoice fields on ${gOk}/${DOCS.length} documents; the verify request carried ${g.verify.excerpt ? "an" : "no"} excerpt.\n` +
             `Split tools: extract_invoice chosen on ${spPicked}/${DOCS.length}, accepted by the validator on ${spOk}/${DOCS.length}; verify_claim_against_source ${sp.verify.quoted ? `quoted "${E.short(sp.verify.excerpt, 80)}"` : "did not quote the document"}.`,
      checks: [
        E.check(`Catch-all tool: the validator got invoice fields on only ${gOk}/${DOCS.length} documents (its schema has no field for them)`, gOk < DOCS.length),
        E.check(`Split tools: Claude chose extract_invoice on ${spPicked}/${DOCS.length} documents`, spPicked === DOCS.length),
        E.check(`Split tools: every extract_invoice payload passed the validator's schema (${spOk}/${DOCS.length})`, spOk === DOCS.length),
        E.check("Verify request: the catch-all call carried no source excerpt; verify_claim_against_source quoted one verbatim from DOC-01",
                !g.verify.excerpt && sp.verify.tool === "verify_claim_against_source" && sp.verify.quoted),
      ],
    };
  },
};
