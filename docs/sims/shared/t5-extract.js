// Topic 5 helper for Simulator 6 · Structured Data Extraction (Lab 29).
// Documents and human-verified labels in the style of labs/simulators/simulator-6-structured-extraction
// (fixtures/invoices.txt, fixtures/labels.json), plus the accuracy breakdown from extract.py:
// overall, by_field and by_document_type. One segment is weak on purpose: the thermal-fax credit notes
// from one supplier arrive with a faded total line, so their totals cannot be read off the document.

export const DOCS = [
  ["DOC-01", "invoice", "INVOICE INV-2041\nFrom: Harbour Office Supplies Pte Ltd\nIssued 2026-10-03   Due 2026-11-02   SGD\n1 x A4 paper (10 reams) ......... 48.00\n1 x Toner cartridge ............. 112.00\nTOTAL DUE: 160.00"],
  ["DOC-02", "receipt", "RECEIPT R-7781   Lumen Coworking   2026-10-07\nDay pass ............................ 35.00\nAmount paid: 38.00 (incl. 9% GST)"],
  ["DOC-03", "invoice", "INVOICE INV-2043   Northgate Logistics   Issued 2026-10-09   Due 2026-11-08\nFreight Singapore->Johor ........... 420.00\nFuel surcharge ..................... 36.00\nTOTAL: 456.00"],
  ["DOC-04", "credit_note", "CREDIT NOTE CN-118 against INV-1990, Harbour Office Supplies, 10 Oct 2026\nReturned: 2 x Desk lamp .......... -78.00\nCredit total: -78.00"],
  ["DOC-05", "receipt", "Kopi Corner\nRcpt #55120   2026-10-08 12:41\n2 x Kopi C ......................... 3.60\n1 x Kaya toast ..................... 2.40\nTOTAL PAID 6.00 (CASH)"],
  ["DOC-06", "invoice", "Tax invoice no. INV-2042 issued by Meridian Catering on 5 Oct 2026, due 19 Oct 2026.\nItems: lunch boxes 24 pax $264.00; delivery $15.00.\nAmount payable S$ 279.00."],
  ["DOC-07", "receipt", "GRAB RECEIPT   2026-10-09\nTrip: Raffles Place -> Changi Airport\nFare 28.50   Booking fee 0.70\nTotal charged: 29.20"],
  ["DOC-08", "invoice", "INVOICE INV-2045  Kaya Software Pte Ltd  issued 2026-10-14  due 2026-11-13  SGD\nAnnual licence (see schedule A)\nTOTAL: 1,200.00"],
  ["DOC-09", "credit_note", "*** CREDIT NOTE ***  CN-121  (thermal fax copy)\nSupplier: Brightline Electrical Pte Ltd   12 Oct 2026\nRef INV-3307   Returned goods: cable reels, wall sockets\nCredit total: S$ ░░░.░░   [print faded]"],
  ["DOC-10", "receipt", "Popular Bookstore  Receipt 0098812  2026-10-10\n1 x Notebook A5 ........ 7.90\n1 x Gel pens (5) ....... 9.50\nTotal: 17.40"],
  ["DOC-11", "invoice", "INVOICE INV-2046   Pacific Print Works   Issued 2026-10-12   Due 2026-11-11\nBanners 3 pcs ...................... 240.00\nTOTAL: 240.00"],
  ["DOC-12", "receipt", "Shell Station Bukit Timah   2026-10-11 08:02\nPump 4  V-Power 32.10 L\nAmount: 98.55"],
  ["DOC-13", "invoice", "INVOICE INV-2047   CloudNest Hosting   Issued 2026-10-15   Due 2026-10-29\nVPS hosting (Oct) ................... 85.00\nBackups ............................. 15.00\nTOTAL DUE: 100.00"],
  ["DOC-14", "receipt", "FairPrice Xtra   Receipt 448810   2026-10-12\nWater 1.5L x6 ........ 5.95\nPaper towels ......... 4.20\nTOTAL 10.15"],
  ["DOC-15", "credit_note", "*** CREDIT NOTE ***  CN-124  (thermal fax copy)\nSupplier: Brightline Electrical Pte Ltd   16 Oct 2026\nRef INV-3311   Pricing correction on LED panels\nCredit total: S$ ░░.░░   [print faded]"],
  ["DOC-16", "invoice", "INVOICE INV-2048   Meridian Catering   Issued 2026-10-16   Due 2026-10-30\nTea reception 40 pax ................ 520.00\nTOTAL: 520.00"],
  ["DOC-17", "receipt", "RECEIPT R-7802   Lumen Coworking   2026-10-14\nMeeting room 2h ..................... 60.00\nAmount paid: 65.40 (incl. 9% GST)"],
  ["DOC-18", "invoice", "INVOICE INV-2049   Northgate Logistics   Issued 2026-10-17   Due 2026-11-16\nFreight Singapore->KL ................ 610.00\nTOTAL: 610.00"],
  ["DOC-19", "receipt", "Comfort Taxi  2026-10-15  Receipt 77310\nFare 14.80  ERP 1.00\nTOTAL 15.80"],
  ["DOC-20", "invoice", "INVOICE INV-2050   Harbour Office Supplies Pte Ltd   Issued 2026-10-18   Due 2026-11-17\nChairs x2 ........................... 330.00\nTOTAL DUE: 330.00"],
  ["DOC-21", "receipt", "Kopi Corner\nRcpt #55188   2026-10-16 08:15\n1 x Teh tarik ....................... 1.90\nTOTAL PAID 1.90 (CASH)"],
  ["DOC-22", "receipt", "Popular Bookstore  Receipt 0098955  2026-10-17\n1 x Desk calendar 2027 ... 12.90\nTotal: 12.90"],
].map(([id, type, text]) => ({ id, type, text }));

// Human-verified values (the credit-note totals come from the supplier's ERP statement, not the fax).
export const LABELS = {
  "DOC-01": { vendor: "Harbour Office Supplies Pte Ltd", due_date: "2026-11-02", stated_total: 160.0 },
  "DOC-02": { vendor: "Lumen Coworking", due_date: null, stated_total: 38.0 },
  "DOC-03": { vendor: "Northgate Logistics", due_date: "2026-11-08", stated_total: 456.0 },
  "DOC-04": { vendor: "Harbour Office Supplies", due_date: null, stated_total: -78.0 },
  "DOC-05": { vendor: "Kopi Corner", due_date: null, stated_total: 6.0 },
  "DOC-06": { vendor: "Meridian Catering", due_date: "2026-10-19", stated_total: 279.0 },
  "DOC-07": { vendor: "Grab", due_date: null, stated_total: 29.2 },
  "DOC-08": { vendor: "Kaya Software Pte Ltd", due_date: "2026-11-13", stated_total: 1200.0 },
  "DOC-09": { vendor: "Brightline Electrical Pte Ltd", due_date: null, stated_total: -412.5 },
  "DOC-10": { vendor: "Popular Bookstore", due_date: null, stated_total: 17.4 },
  "DOC-11": { vendor: "Pacific Print Works", due_date: "2026-11-11", stated_total: 240.0 },
  "DOC-12": { vendor: "Shell", due_date: null, stated_total: 98.55 },
  "DOC-13": { vendor: "CloudNest Hosting", due_date: "2026-10-29", stated_total: 100.0 },
  "DOC-14": { vendor: "FairPrice Xtra", due_date: null, stated_total: 10.15 },
  "DOC-15": { vendor: "Brightline Electrical Pte Ltd", due_date: null, stated_total: -36.0 },
  "DOC-16": { vendor: "Meridian Catering", due_date: "2026-10-30", stated_total: 520.0 },
  "DOC-17": { vendor: "Lumen Coworking", due_date: null, stated_total: 65.4 },
  "DOC-18": { vendor: "Northgate Logistics", due_date: "2026-11-16", stated_total: 610.0 },
  "DOC-19": { vendor: "Comfort Taxi", due_date: null, stated_total: 15.8 },
  "DOC-20": { vendor: "Harbour Office Supplies Pte Ltd", due_date: "2026-11-17", stated_total: 330.0 },
  "DOC-21": { vendor: "Kopi Corner", due_date: null, stated_total: 1.9 },
  "DOC-22": { vendor: "Popular Bookstore", due_date: null, stated_total: 12.9 },
};
export const FIELDS = ["vendor", "due_date", "stated_total"];

export const EXTRACT_TOOL = {
  name: "record_extractions",
  description: "Record the extracted fields for every document, one record per document.",
  input_schema: {
    type: "object",
    properties: {
      records: {
        type: "array",
        items: {
          type: "object",
          properties: {
            doc_id: { type: "string" },
            vendor: { type: "string", description: "The issuer's name as printed." },
            due_date: { type: ["string", "null"], description: "Payment due date as YYYY-MM-DD, or null if none is printed." },
            stated_total: { type: ["number", "null"], description: "The document total exactly as printed, signed (credit notes are negative). null if it is not printed or not legible: never compute or guess it." },
          },
          required: ["doc_id", "vendor", "due_date", "stated_total"],
        },
      },
    },
    required: ["records"],
  },
};

const norm = (v) => String(v || "").toLowerCase().replace(/\b(pte|ltd|station|receipt)\b/g, "").replace(/[^a-z0-9]/g, "");
function match(field, got, want) {
  if (field === "vendor") { const a = norm(got), b = norm(want); return !!a && !!b && (a.includes(b) || b.includes(a)); }
  if (field === "due_date") return (got ?? null) === (want ?? null);
  return got !== null && got !== undefined && Math.abs(Number(got) - Number(want)) < 0.005;
}

// The breakdown from extract.py: overall, by_field and by_document_type (percent of fields correct).
export function accuracy(records) {
  const byId = Object.fromEntries((records || []).map((r) => [r.doc_id, r]));
  const all = [], byField = {}, byType = {}, misses = [];
  for (const d of DOCS) {
    for (const f of FIELDS) {
      const got = byId[d.id]?.[f], want = LABELS[d.id][f], hit = !!byId[d.id] && match(f, got, want);
      all.push(hit); (byField[f] ||= []).push(hit); (byType[d.type] ||= []).push(hit);
      if (!hit) misses.push({ doc: d.id, type: d.type, field: f, got: got ?? null, want });
    }
  }
  const pct = (xs) => Math.round((1000 * xs.filter(Boolean).length) / xs.length) / 10;
  const counts = Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length / FIELDS.length]));
  return {
    overall: pct(all),
    by_field: Object.fromEntries(Object.entries(byField).map(([k, v]) => [k, pct(v)])),
    by_document_type: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, pct(v)])),
    documents_per_type: counts, misses,
  };
}

export const DECIDE_TOOL = {
  name: "decide_review",
  description: "Record the human-review decision for each document type.",
  input_schema: {
    type: "object",
    properties: {
      cut_review_for: { type: "array", items: { type: "string", enum: ["invoice", "receipt", "credit_note"] }, description: "Document types whose extractions go straight through without full human review." },
      keep_review_for: { type: "array", items: { type: "string", enum: ["invoice", "receipt", "credit_note"] }, description: "Document types that stay under full human review." },
      sample_rate: { type: "object", properties: { invoice: { type: "number" }, receipt: { type: "number" }, credit_note: { type: "number" } }, required: ["invoice", "receipt", "credit_note"], description: "Share of each type's documents a human checks from now on (0 to 1)." },
      reason: { type: "string" },
    },
    required: ["cut_review_for", "keep_review_for", "sample_rate", "reason"],
  },
};
