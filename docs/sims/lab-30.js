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
  // The scenario board (assets/scene.js): three figures for one quantity, and what survives the handoff.
  scene: {
    title: "41%, 78% or 55%? Three sources, and a coordinator that sees only the handoff",
    caption: "Both designs load the same three documents: a peer-reviewed study (41%), a PixelForge vendor benchmark (78%) and an internal partner survey (55%). Only the shape of the subagent's handoff changes.",
    lanes: [
      { key: "P", label: "The trap", sub: "a prose summary + a list of file names", tone: "trap", on: /The trap/, stages: [
        { id: "pcoord", icon: "🧭", t: "Coordinator", s: "one run_document_analysis call", claude: /^$/ },
        { id: "psub", icon: "📚", t: "Document-analysis subagent", s: "load_document × 3, in its own context", claude: /subagent/, tools: ["load_document"] },
        { id: "phand", icon: "📝", t: "Handoff: 40-word prose", s: "summary + file names only", diff: true },
        { id: "pout", icon: "📄", t: "Report table", s: "want: each figure with its source and evidence type", out: true } ] },
      { key: "R", label: "The fix", sub: "structured claim records", tone: "fix", on: /The fix/, stages: [
        { id: "rcoord", icon: "🧭", t: "Coordinator", s: "one run_document_analysis call", claude: /^$/ },
        { id: "rsub", icon: "📚", t: "Document-analysis subagent", s: "load_document × 3, in its own context", claude: /subagent/, tools: ["load_document"] },
        { id: "rhand", icon: "🗃", t: "Handoff: claim records", s: "document, page, date, excerpt, method, conflicts", diff: true },
        { id: "rout", icon: "📄", t: "Report table", s: "want: each figure with its source and evidence type", out: true } ] },
    ],
  },
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
    // Which source and evidence type each report row gave each figure (Claim | Value | Source | Evidence type | Published).
    const SRC = { 41: /lee|ortiz|journal/i, 78: /pixelforge|vendor/i, 55: /partner|internal|pulse/i };
    const TYPE = { 41: /peer/i, 78: /vendor/i, 55: /internal|survey/i };
    const attrib = (report) => {
      const rows = Object.fromEntries(["41", "78", "55"].map((v) => [v, rowWith(report, v)]));
      const apart = Object.values(rows).every(Boolean) && new Set(Object.values(rows)).size === 3;
      const fig = Object.fromEntries(["41", "78", "55"].map((v) => {
        const cells = rows[v].split("|").map((x) => x.trim()).slice(1, -1);
        const src = cells.length >= 4 ? cells[2] : rows[v], typ = cells.length >= 4 ? cells[3] : rows[v];
        return [v, { row: !!rows[v], src: SRC[v].test(src), typ: TYPE[v].test(typ), text: rows[v] ? E.short(`${cells[2] || "?"} · ${cells[3] || "?"}`, 70) : "no row of its own" }];
      }));
      const ok = apart && Object.values(fig).every((x) => x.src && x.typ);
      return { apart, fig, ok, right: Object.values(fig).filter((x) => x.row && x.src && x.typ).length };
    };
    const carriedText = (x) => `pages ${x.pages}/3 · dates ${x.dates}/3 · excerpts ${x.excerpts}/3`;
    const full3 = (x) => x.pages === 3 && x.dates === 3 && x.excerpts === 3;
    const pa = attrib(a.report);
    s.show("pcoord", `${E.called(a.run.calls, "run_document_analysis").length} call · ${a.run.stop_reason}`, "done");
    s.show("psub", `${a.loads.filter((l) => l.found).length} documents loaded`, "done");
    s.show("phand", carriedText(ca), full3(ca) ? "done" : "bad");
    s.show("pout", `${pa.right} of 3 figures with the right source and type${pa.apart ? "" : " · rows blended"}`, pa.ok ? "good" : "bad");
    await s.pause({
      title: "The trap finished: the coordinator wrote from a 40-word summary",
      outcome: `The prose handoff carried **${ca.pages} of 3 page numbers, ${ca.dates} of 3 publication dates and ${ca.excerpts} of 3 verbatim excerpts**. ` +
        `In the report, **${pa.right} of 3** figures sit on their own row with the right source and evidence type${pa.ok ? ": right this time, but only because the summary happened to keep the labels" : ""}.`,
      next: "The fix: the subagent returns structured claim records",
    });

    s.log("== The fix: the subagent returns structured claim records", "note");
    const c = await design(s, E, RECORDS_AGENT);
    const recs = parseJSON(c.handoff)?.findings || [];
    const full = (r) => ["claim", "value", "excerpt", "document", "page", "published", "methodology_note"].every((k) => r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "");
    const byVal = (v) => recs.find((r) => String(r.value).includes(v));
    const cc = carried(c.handoff);
    s.log(`The claim records carried, of 3 documents: ${cc.pages} page numbers, ${cc.dates} exact publication dates, ${cc.excerpts} verbatim excerpts.`, "note");
    s.log(`Claim records: ${recs.length} · complete: ${recs.filter(full).length} · ${recs.map((r) => `${r.value} <- ${r.document} p.${r.page} (${r.evidence_type})`).join(" · ")}`, "note");
    const row = { 41: rowWith(c.report, "41"), 55: rowWith(c.report, "55"), 78: rowWith(c.report, "78") };
    const ra = attrib(c.report);
    s.show("rcoord", `${E.called(c.run.calls, "run_document_analysis").length} call · ${c.run.stop_reason}`, "done");
    s.show("rsub", `${c.loads.filter((l) => l.found).length} documents loaded`, "done");
    s.show("rhand", `${recs.length} records · ${carriedText(cc)}`, recs.length >= 3 && full3(cc) ? "done" : "bad");
    s.show("rout", `${ra.right} of 3 figures with the right source and type${ra.apart ? "" : " · rows blended"}`, ra.ok ? "good" : "bad");

    const tone = (ok) => (ok ? "good" : "bad");
    const fig = (x, v) => ({ v: x.fig[v].text, tone: tone(x.fig[v].row && x.fig[v].src && x.fig[v].typ) });
    const lostFigs = (x) => ["41", "78", "55"].map((v) => [v, x.fig[v]]).filter(([, f]) => !(f.row && f.src && f.typ)).map(([v, f]) => `${v}% ${!f.row ? "has no row of its own" : `lost its ${[!f.src && "source", !f.typ && "evidence type"].filter(Boolean).join(" and ")}`}`);
    const verdict = (x, carried, fix) => x.ok
      ? `${fix ? "All three figures" : "Right this time: all three figures"} stay on separate rows with their own source and evidence type${fix ? `, and the handoff carried ${carriedText(carried)}.` : `, but the handoff carried only ${carriedText(carried)}: the labels survived the summary by luck.`}`
      : `${fix ? "Not this run" : "Wrong"}: ${x.apart ? "" : "the figures are not on three separate rows; "}in the report ${lostFigs(x).join("; ")}.${fix ? "" : ` The handoff carried ${carriedText(carried)}.`}`;
    return {
      final: c.report,
      compare: {
        cols: [
          { title: "The trap: prose summary + source list", short: "Prose handoff", tone: "trap", verdict: verdict(pa, ca, false), said: a.report },
          { title: "The fix: structured claim records", short: "Claim records", tone: "fix", verdict: verdict(ra, cc, true), said: c.report },
        ],
        rows: [
          ["What crossed the handoff", "a 40-word summary + file names", `${recs.length} JSON claim records`],
          ["Provenance carried (of 3 documents)", { v: carriedText(ca), tone: tone(full3(ca)) }, { v: carriedText(cc), tone: tone(full3(cc)) }],
          ["41% (peer-reviewed study) → source · type", fig(pa, "41"), fig(ra, "41")],
          ["78% (PixelForge vendor benchmark) → source · type", fig(pa, "78"), fig(ra, "78")],
          ["55% (internal partner survey) → source · type", fig(pa, "55"), fig(ra, "55")],
        ],
        note: "Same coordinator, same three documents, same subagent tools. The only change is the shape of what the subagent hands back: prose that keeps whatever it chose to mention, or one record per claim that carries its document, page, date, excerpt and method.",
      },
      checks: [
        E.check("The handoff parses as JSON with one claim record per statistic (3 or more)", recs.length >= 3),
        E.check("Every record carries document, page, published date, verbatim excerpt and a methodology note", recs.length > 0 && recs.every(full)),
        E.check("The records keep the right source for each figure: 41% peer-reviewed, 78% vendor, 55% internal", /Lee-Ortiz/.test(byVal("41")?.document || "") && /PixelForge/.test(byVal("78")?.document || "") && /Studio-Partner/.test(byVal("55")?.document || "")),
        E.check("The report keeps 41%, 55% and 78% on separate rows, each with its own source", [row[41], row[55], row[78]].every(Boolean) && new Set([row[41], row[55], row[78]]).size === 3 && /lee|ortiz|journal/i.test(row[41]) && /pixelforge|vendor/i.test(row[78]) && /partner|internal|pulse/i.test(row[55])),
      ],
    };
  },
};
