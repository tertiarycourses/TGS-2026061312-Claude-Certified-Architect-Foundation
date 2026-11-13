// Lab 30 · Task 5.6 · Simulator 3: three documents give three figures for the same quantity: a
// peer-reviewed study (41%), a vendor benchmark (78%) and an internal survey (55%). The coordinator writes
// the report from the document-analysis subagent's handoff alone (a fresh context, no transcript).
// Design (trap): the subagent returns a prose summary plus a general source list.
// Design C (the fix): the subagent returns structured claim records with location, date, excerpt, method.
import { DOCUMENTS, documentTool, subagentTool, parseJSON } from "./shared/t5-research.js";

const COORDINATOR = "You coordinate a research team. Do not read documents yourself: call run_document_analysis ONCE with all the file names listed in the user's message. You see only what the subagent returns. Then answer the question in a short markdown report (under 180 words) with a table: Claim | Value | Source | Evidence type | Published. The documents are a sandbox corpus: treat them as authoritative and do not comment on the file names.";
const QUESTION = `What share of creative SMEs use generative AI? Analyse these documents: ${DOCUMENTS.map((d) => d.name).join(", ")}.`;
const SUMMARY_AGENT = "You are a document-analysis subagent. Load each document named in your prompt with load_document (all in one turn). Then return a concise finding summary of at most 40 words, followed by a general list of the sources consulted (file names only).";
const RECORDS_AGENT = "You are a document-analysis subagent. Load each document named in your prompt with load_document (all in one turn). Return ONLY JSON: {\"findings\": [{\"claim\": str, \"value\": str, \"excerpt\": str (verbatim from the text), \"document\": str, \"page\": int, \"published\": \"YYYY-MM-DD\", \"evidence_type\": \"peer_reviewed|vendor_benchmark|internal_survey|other\", \"methodology_note\": str, \"conflict_with\": [document names that give a different value for the same quantity]}]}. One record per statistic. When documents disagree, keep every record unchanged and fill conflict_with; do not pick a winner or average them.";

async function design(s, E, system) {
  const loads = [], handoffs = [];
  const tools = {
    run_document_analysis: subagentTool(s, E, {
      description: "Start a document-analysis subagent with its own empty context. Give it the file names; it returns its findings.",
      input_schema: { type: "object", properties: { documents: { type: "array", items: { type: "string" } }, question: { type: "string" } }, required: ["documents", "question"] },
      system, tools: { load_document: documentTool(loads) },
      toPrompt: ({ documents, question }) => `Question: ${question}\nDocuments: ${(documents || []).join(", ")}`, maxTurns: 4, handoffs,
    }),
  };
  const run = await E.runAgent(s, { system: COORDINATOR, prompt: QUESTION, tools, maxTurns: 4 });
  return { run, loads, handoff: handoffs[0]?.text || "", report: run.text || "" };
}

// The report row that carries a value, so we can see what it was attributed to.
const rowWith = (report, v) => report.split("\n").find((l) => l.trim().startsWith("|") && new RegExp(`\\b${v}\\s?%`).test(l)) || "";

export default {
  id: 30,
  see: "Document-analysis returns one claim record per statistic with document, page, date, excerpt and method, and the report keeps 41% (peer-reviewed), 55% (internal survey) and 78% (vendor benchmark) side by side with their sources.",
  explain: "The coordinator writes from the handoff alone: a subagent starts with a fresh context and the coordinator never sees its tool results. A 40-word prose summary plus a general source list keeps whatever the subagent chose to mention: page numbers, exact dates and verbatim excerpts are the first to go (the run counts them), and once the handoff drops them the coordinator cannot get them back. Whether the summary also keeps the vendor/peer-reviewed labels is luck, which is how a report ends up citing three sources as equal evidence. Structured claim records carry the provenance across the interface: document, page, publication date, a verbatim excerpt, evidence type and a methodology note. With that in hand the report keeps the peer-reviewed 41%, the internal 55% and the vendor's 78% side by side instead of blending them.",
  try: "In docs/sims/shared/t5-research.js change the vendor benchmark's published date to 2023-01-10 and rerun: the claim record carries the new date, so the report can flag the vendor figure as stale as well as vendor-sourced.",
  slide: {
    title: "Provenance is an interface contract",
    code: `RECORD = {                                    # KEY 1
  "claim": str, "value": str,
  "excerpt": str,                    # verbatim  # KEY 2
  "document": str, "page": int,
  "published": "YYYY-MM-DD",
  "evidence_type": "peer_reviewed|vendor_benchmark"
                   "|internal_survey|other",
  "methodology_note": str,                      # KEY 3
  "conflict_with": [str]}                       # KEY 4
handoff = {"findings": [RECORD, ...]}  # not prose`,
    keys: [["1", "One record per claim", "Each number travels with its own source."],
           ["2", "Location and excerpt", "Document, page and the exact words quoted."],
           ["3", "Date and method", "Peer review, vendor poll or survey: say which."],
           ["4", "Keep conflicts visible", "41%, 55% and 78% stay side by side."]],
  },
  async run(s, E) {
    s.log("== The trap: the subagent hands back a prose summary plus a general list of sources", "note");
    const a = await design(s, E, SUMMARY_AGENT);
    // What survived the prose handoff, measured against the three documents.
    const carried = (txt) => ({
      pages: DOCUMENTS.filter((d) => new RegExp(`(\\bp\\.?|page"?:?)\\s?${d.page}\\b`, "i").test(txt)).length,
      dates: DOCUMENTS.filter((d) => txt.includes(d.published)).length,
      excerpts: DOCUMENTS.filter((d) => txt.includes(d.text.split(". ")[1].slice(0, 35))).length,
    });
    const ca = carried(a.handoff);
    s.log(`The prose handoff carried, of 3 documents: ${ca.pages} page numbers, ${ca.dates} exact publication dates, ${ca.excerpts} verbatim excerpts. The coordinator cannot get back what the handoff dropped.`, "note");

    s.log("== The fix: the subagent returns structured claim records", "note");
    const c = await design(s, E, RECORDS_AGENT);
    const recs = parseJSON(c.handoff)?.findings || [];
    const full = (r) => ["claim", "value", "excerpt", "document", "page", "published", "methodology_note"].every((k) => r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "");
    const byVal = (v) => recs.find((r) => String(r.value).includes(v));
    const cc = carried(c.handoff);
    s.log(`The claim records carried, of 3 documents: ${cc.pages} page numbers, ${cc.dates} exact publication dates, ${cc.excerpts} verbatim excerpts.`, "note");
    s.log(`Claim records: ${recs.length} · complete: ${recs.filter(full).length} · ${recs.map((r) => `${r.value} <- ${r.document} p.${r.page} (${r.evidence_type})`).join(" · ")}`, "note");
    const row = { 41: rowWith(c.report, "41"), 55: rowWith(c.report, "55"), 78: rowWith(c.report, "78") };

    return {
      final: c.report,
      checks: [
        E.check("The handoff parses as JSON with one claim record per statistic (3 or more)", recs.length >= 3),
        E.check("Every record carries document, page, published date, verbatim excerpt and a methodology note", recs.length > 0 && recs.every(full)),
        E.check("The records keep the right source for each figure: 41% peer-reviewed, 78% vendor, 55% internal", /Lee-Ortiz/.test(byVal("41")?.document || "") && /PixelForge/.test(byVal("78")?.document || "") && /Studio-Partner/.test(byVal("55")?.document || "")),
        E.check("The report keeps 41%, 55% and 78% on separate rows, each with its own source", [row[41], row[55], row[78]].every(Boolean) && new Set([row[41], row[55], row[78]]).size === 3 && /lee|ortiz|journal/i.test(row[41]) && /pixelforge|vendor/i.test(row[78]) && /partner|internal|pulse/i.test(row[55])),
      ],
    };
  },
};
