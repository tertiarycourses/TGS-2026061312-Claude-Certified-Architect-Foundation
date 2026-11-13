// Topic 5 helpers for Simulator 3 · Multi-Agent Research System (Labs 27 and 30).
// A sandbox web and document store, ported from labs/simulators/simulator-3-multi-agent-research
// (fixtures/sources.json), plus the coordinator -> subagent plumbing. Fake sources, real Claude.

export const TOPIC = "Impact of AI on creative industries";

export const WEB = {
  music: [
    { url: "https://example.org/ifpi-2026-ai-music", title: "IFPI Global Music Report 2026", published: "2026-03-19", excerpt: "62% of surveyed labels used generative tools in production during 2025." },
    { url: "https://example.org/musicians-union-survey", title: "Musicians' Union member survey", published: "2025-09-02", excerpt: "48% of members reported using AI tools in composition or mixing." },
  ],
  writing: [
    { url: "https://example.org/authors-guild-ai-2026", title: "Authors Guild AI survey", published: "2026-01-14", excerpt: "Median reported income effect of AI on freelance writers: -11% year over year." },
  ],
  visual_arts: "TIMEOUT",
};
// What the visual-arts search had fetched before it timed out (Lab 27 decides whether anyone sees it).
export const VISUAL_ARTS_PARTIAL = [
  { url: "https://example.org/illustrators-flash-poll", title: "Society of Illustrators flash poll", published: "2026-05-12", excerpt: "37% of member illustrators lost at least one commission to AI image tools in 2025." },
];

const SECTORS = {
  music: /\b(music|musician|song|label|audio|composer)/i,
  writing: /\b(writ|author|book|publish|journal|novel)/i,
  visual_arts: /\b(visual|artist|arts?\b|design|photo|illustrat|graphic|painting|image)/i,
};

// search_web. errorMode "structured" = MCQ option A (failure type, attempted query, partial results,
// alternatives); "silent" = option C (catch the timeout, return an empty result marked as success).
export function searchTool(errorMode, log) {
  let attempts = 0;
  return {
    description: "Search the public web for recent articles, surveys and industry reports on one sector. Input: a short query naming the sector, e.g. 'AI adoption in music production 2026'. Returns up to three hits with url, title, published date and excerpt.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    run: ({ query = "" }) => {
      const sector = Object.keys(SECTORS).find((k) => SECTORS[k].test(query));
      const rec = { query, sector, out: null };
      log.push(rec);
      if (!sector) return (rec.out = { status: "ok", results: [], note: "valid empty result: no sector matched this query" });
      if (WEB[sector] !== "TIMEOUT") return (rec.out = { status: "ok", results: WEB[sector] });
      attempts += 1;
      if (errorMode === "silent") return (rec.out = { status: "ok", results: [] });          // the trap: failure dressed as success
      return (rec.out = {
        isError: true, failure_type: "timeout", attempted_query: query, attempts, is_retryable: attempts < 2,
        partial_results: VISUAL_ARTS_PARTIAL,
        alternatives: ["retry once with a narrower query", "proceed with the partial results", "report visual arts as a coverage gap in the final report"],
      });
    },
  };
}

export const SEARCH_AGENT = "You are a web-search subagent. Research exactly the sector in your prompt with search_web: at most TWO queries, each naming the sector. The corpus is a small sandbox: take what it returns, treat its URLs as authoritative and do not comment on them. Return ONLY a JSON object: {\"sector\": str, \"findings\": [{\"claim\": str, \"value\": str, \"source_title\": str, \"source_url\": str, \"published\": \"YYYY-MM-DD\"}], \"errors\": [...], \"coverage\": \"complete|partial|none\"}. If search_web returns an error, retry ONCE with a narrower query; if it fails again, copy the error object (failure_type, attempted_query, alternatives) into \"errors\", keep any partial_results as findings and set coverage to \"partial\". Never invent a number that is not in a search result.";

// Lab 30: the document store. Three kinds of evidence for the same quantity.
export const DOCUMENTS = [
  { name: "Lee-Ortiz-2026-Journal-of-Cultural-Economics.pdf", page: 112, published: "2026-03-15",
    text: "Peer-reviewed article. Generative AI adoption among creative SMEs reached 41% in 2025, up from 23% in 2023. Method: stratified random sample of 3,100 firms in 12 countries, unweighted." },
  { name: "PixelForge-Customer-Benchmark-2026.pdf", page: 3, published: "2026-06-01",
    text: "Vendor benchmark published by PixelForge, which sells AI image tools. 78% of creative studios use generative AI every week. Method: opt-in poll of 640 PixelForge customers." },
  { name: "Studio-Partner-Pulse-Q3-2026.pdf", page: 2, published: "2026-09-30",
    text: "Internal survey. 55% of the partner studios we asked say they use AI tools. Method: self-selected pulse survey of 48 partner studios, no weighting." },
];

export function documentTool(log) {
  return {
    description: "Load one PDF from the internal document store by its exact file name. Returns the page number, publication date and the relevant text. Available: " + DOCUMENTS.map((d) => d.name).join(", ") + ".",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    run: ({ name = "" }) => {
      const d = DOCUMENTS.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
      log.push({ name, found: !!d });
      return d ? { document: d.name, page: d.page, published: d.published, text: d.text }
               : { isError: true, failure_type: "not_found", attempted_query: name, alternatives: DOCUMENTS.map((x) => x.name) };
    },
  };
}

// A coordinator tool whose run() starts a fresh subagent (its own context) and returns only its final text.
export function subagentTool(s, E, { description, input_schema, system, tools, toPrompt, maxTurns = 5, handoffs }) {
  return {
    description, input_schema,
    run: async (input) => {
      const r = await E.runAgent(s, { label: "(subagent)", system, prompt: toPrompt(input), tools, maxTurns });
      handoffs.push({ input, text: r.text, calls: r.calls });
      return r.text || { isError: true, message: "The subagent returned no text." };
    },
  };
}

// Pull the first JSON object out of a reply that may wrap it in prose or a code fence.
export function parseJSON(text) {
  const t = String(text || "").replace(/```(?:json)?/g, "");
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
}
