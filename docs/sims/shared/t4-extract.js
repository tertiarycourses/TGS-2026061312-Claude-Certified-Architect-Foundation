// Simulator 6 · Structured Data Extraction: the documents, the extraction tools and the validator,
// ported from labs/simulators/simulator-6-structured-extraction (fixtures/invoices.txt, labels.json,
// invoice.schema.json, extract.py). Fake documents, real Claude. Used by Lab 21 and Lab 22.

export const DOCS = {
  "DOC-01": { type: "invoice", text: `INVOICE INV-2041
From: Harbour Office Supplies Pte Ltd
Date: 03/10/2026   Due: 02/11/2026   Currency: SGD
1 x A4 paper (10 reams) ......... 48.00
1 x Toner cartridge ............. 112.00
TOTAL DUE: 160.00` },
  "DOC-02": { type: "invoice", text: `Tax invoice no. INV-2042 issued by Meridian Catering on 5 Oct 2026.
Items: lunch boxes 24 pax $264.00; delivery $15.00.
Amount payable S$ 279.00. Payment terms: on receipt.` },
  "DOC-03": { type: "receipt", text: `RECEIPT R-7781   Lumen Coworking   2026-10-07
Day pass ............................ 35.00
Amount paid: 38.00 (incl. 9% GST)` },
  "DOC-04": { type: "invoice", text: `INVOICE INV-2043   Northgate Logistics   Issued 2026-10-09   Due 2026-11-08
Freight Singapore->Johor ........... 420.00
Fuel surcharge ..................... 36.00
TOTAL: 456.00` },
  "DOC-05": { type: "credit_note", text: `CREDIT NOTE CN-118 against INV-1990, Harbour Office Supplies, 10 Oct 2026
Returned: 2 x Desk lamp .......... -78.00
Credit total: -78.00   Currency: not shown` },
  // Not in the Python fixtures: a supplier letter that none of the extraction schemas fits (Lab 21).
  "DOC-08": { type: "notice", text: `PRICE NOTICE   Harbour Office Supplies Pte Ltd   20 Oct 2026
From 1 Dec 2026 our list prices for paper and toner rise by 5%.
Orders placed before 30 Nov 2026 keep current pricing.` },
};

// fixtures/labels.json (the fields the accuracy report scores)
export const LABELS = {
  "DOC-01": { stated_total: 160.0, due_date: "2026-11-02", vendor: "Harbour Office Supplies Pte Ltd" },
  "DOC-02": { stated_total: 279.0, due_date: null, vendor: "Meridian Catering" },
  "DOC-03": { stated_total: 38.0, due_date: null, vendor: "Lumen Coworking" },
  "DOC-04": { stated_total: 456.0, due_date: "2026-11-08", vendor: "Northgate Logistics" },
  "DOC-05": { stated_total: -78.0, due_date: null, vendor: "Harbour Office Supplies" },
};

const str = { type: "string" };
const num = { type: "number" };
const nullable = (description) => ({ type: ["string", "null"], description });
const obj = (properties, description) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties, ...(description ? { description } : {}) });

// ---------------------------------------------------------------- Lab 21: one tool per document type
// strict: true, so every object carries additionalProperties: false and every field is required.
export const TYPED_TOOLS = {
  extract_invoice: { strict: true,
    description: "Record an INVOICE (a bill asking for payment). Dates YYYY-MM-DD; due_date null when none is stated; amounts as plain numbers.",
    input_schema: obj({ invoice_id: str, vendor: str, issue_date: str, due_date: nullable("YYYY-MM-DD or null"), total_due: num }) },
  extract_receipt: { strict: true,
    description: "Record a RECEIPT (proof that a payment was already made). Dates YYYY-MM-DD; amounts as plain numbers.",
    input_schema: obj({ receipt_id: str, vendor: str, paid_date: str, amount_paid: num }) },
  extract_credit_note: { strict: true,
    description: "Record a CREDIT NOTE (money credited back against an earlier invoice). credit_total is negative. Dates YYYY-MM-DD.",
    input_schema: obj({ credit_note_id: str, vendor: str, against_invoice: str, issue_date: str, credit_total: num }) },
};
export const TOOL_FOR_TYPE = { invoice: "extract_invoice", receipt: "extract_receipt", credit_note: "extract_credit_note" };

// ---------------------------------------------------------------- Lab 22: one extraction tool + a validator
// The schema fixes the SHAPE (strict: true). It does not spell out a date format, and it cannot do arithmetic
// or check that a value is really in the document: the validator below does that, after every attempt.
export const EXTRACT_TOOL = {
  extract_invoice: { strict: true,
    description: "Record one financial document (invoice or receipt). Fill every field from the document text only; never infer, estimate or invent a value. For every amount, copy the exact characters printed in the document into the matching *_text field.",
    input_schema: obj({
      invoice_id: str,
      vendor: str,
      issue_date: { type: "string", description: "the issue date" },
      due_date: nullable("the due date; null when the document states none"),
      line_items: { type: "array", items: obj({ description: str, amount: num, amount_text: { type: "string", description: "the amount exactly as printed, e.g. 48.00" } }) },
      stated_total: { type: "number", description: "the total printed on the document" },
      stated_total_text: { type: "string", description: "the printed total exactly as printed" },
    }) },
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const r2 = (x) => Math.round(Number(x) * 100) / 100;

// Validate one extraction against its source document. Returns { errors, sum, grounded }.
// kind "format"    a value is in the document but written in the wrong form  -> worth a retry
// kind "grounding" a value is not in the document at all (made up)            -> worth a retry
// kind "conflict"  every value is printed in the document, yet they disagree   -> the gap is in the source
export function validate(ext, docText) {
  const errors = [];
  for (const f of ["issue_date", "due_date"]) {
    const v = ext[f];
    if (v !== null && v !== undefined && !ISO.test(v)) errors.push({ kind: "format", field: f, message: `${f} is "${v}"; it must be YYYY-MM-DD` });
  }
  const items = ext.line_items || [];
  const flat = docText.replace(/,(?=\d{3})/g, "");
  const inDoc = (t) => !!t && flat.includes(String(t).replace(/,(?=\d{3})/g, "").replace(/^\$|^S\$\s*/, ""));
  const ungrounded = [];
  items.forEach((it, i) => { if (!inDoc(it.amount_text)) ungrounded.push(`line_items[${i}] "${it.description}" amount ${it.amount_text}`); });
  if (!inDoc(ext.stated_total_text)) ungrounded.push(`stated_total ${ext.stated_total_text}`);
  for (const u of ungrounded) errors.push({ kind: "grounding", field: u.split(" ")[0], message: `${u} does not appear in the document` });
  const sum = r2(items.reduce((a, it) => a + Number(it.amount || 0), 0));
  if (items.length && Math.abs(sum - Number(ext.stated_total)) > 0.01)
    errors.push({ kind: "conflict", field: "stated_total", message: `line items sum to ${sum.toFixed(2)} but stated_total is ${Number(ext.stated_total).toFixed(2)}` });
  return { errors, sum, grounded: ungrounded.length === 0 };
}

// extract.py's retry_decision: retry what a second attempt can fix; never retry a gap in the source.
export function retryDecision(errors, grounded) {
  if (!errors.length) return { action: "accept" };
  const fixable = errors.filter((e) => e.kind !== "conflict");
  if (fixable.length) return { action: "retry", why: "format or grounding error: resend the document, the failed extraction and the exact error" };
  if (grounded) return { action: "human_review", why: "every amount is printed in the document and they still disagree: the conflict is in the source, so a retry could only invent a number" };
  return { action: "retry", why: "the totals disagree and some amounts are not in the document" };
}

export function userContent(docText, failed, errors) {
  if (!failed) return `<document>\n${docText}\n</document>\nRecord this document with the extract_invoice tool.`;
  return `<document>\n${docText}\n</document>\n<previous_extraction>\n${JSON.stringify(failed, null, 1)}\n</previous_extraction>\n<validation_errors>\n${errors.map((e) => `- ${e.field}: ${e.message} [${e.kind}]`).join("\n")}\n</validation_errors>\nYour previous extraction failed validation for the reasons listed. Call extract_invoice again, correcting only the failing fields from the document text.`;
}

export const lastToolInput = (run, name) => [...run.calls].reverse().find((c) => c.name === name)?.input || null;
