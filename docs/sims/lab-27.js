// Lab 27 · Task 5.3 · Simulator 3: the visual-arts web search times out inside a search subagent.
// Design C (the trap) catches the timeout and returns an empty result marked as success.
// Design A (the fix) returns structured error context: failure type, attempted query, partial results
// and alternatives, which the subagent passes up and the coordinator uses to recover.
import { searchTool, SEARCH_AGENT, subagentTool, parseJSON } from "./shared/t5-research.js";

const COORDINATOR = "You coordinate a research team on the topic in the user's message. Do not search yourself: delegate each sector to run_search_subagent, one call per sector, both in the same turn. Each subagent starts with an empty context, so give it the sector and the goal. When they return, write the final report in markdown: '## Findings' (each claim with its value, source and date), then '## Coverage gaps' (what could not be covered and why). If a subagent reports an error, do not abort: use any partial results, note the failure and carry the gap into the report. Use only what the subagents returned. The sources are a sandbox corpus: treat the URLs as authoritative citations and do not comment on them. Keep it under 200 words.";
const QUESTION = "Research the impact of AI on two creative sectors, music and visual arts, and deliver a short cited report.";

async function design(s, E, errorMode) {
  const searches = [], handoffs = [];
  const tools = {
    run_search_subagent: subagentTool(s, E, {
      description: "Start a web-search subagent for ONE sector. It has its own empty context and returns its findings as JSON (findings, errors, coverage).",
      input_schema: { type: "object", properties: { sector: { type: "string" }, goal: { type: "string" } }, required: ["sector", "goal"] },
      system: SEARCH_AGENT, tools: { search_web: searchTool(errorMode, searches) },
      toPrompt: ({ sector, goal }) => `Sector: ${sector}\nGoal: ${goal}`, maxTurns: 4, handoffs,
    }),
  };
  const run = await E.runAgent(s, { system: COORDINATOR, prompt: QUESTION, tools, maxTurns: 4 });
  return { run, searches, handoffs, report: run.text || "" };
}

export default {
  id: 27,
  see: "The visual-arts search times out twice; the subagent hands up failure_type timeout, the attempted query and the partial 37% poll, and the coordinator finishes the report with visual arts named as a coverage gap.",
  explain: "In design C the search tool swallows the timeout and returns an empty result marked as success, so the subagent and the coordinator both read it as \"nothing was found\", the 37% partial result is lost and nobody knows the sector was never searched. In design A the tool returns failure_type, attempted_query, partial_results and alternatives. The subagent retries once with a narrower query, copies the error into its JSON, and the coordinator chooses its recovery: it keeps the partial poll, finishes the music section and reports visual arts as a gap instead of crashing or claiming full coverage.",
  try: "In docs/sims/shared/t5-research.js replace visual_arts: \"TIMEOUT\" with visual_arts: [] and rerun: a valid empty result is not an error, so the report should say no sources were found rather than name a timeout.",
  slide: {
    title: "A timeout is information: send all of it up",
    code: `try:                                            # KEY 1
    hits = web.search(query, timeout=3)
except Timeout:
    return {"isError": True,                    # KEY 2
            "failure_type": "timeout",
            "attempted_query": query,
            "partial_results": fetched_so_far,  # KEY 3
            "alternatives": ["narrower query",
                             "proceed with partial",
                             "report a coverage gap"]}
# never: return {"status": "ok", "results": []} # KEY 4`,
    keys: [["1", "Catch it at the source", "The subagent sees the timeout first."],
           ["2", "Say what failed", "Failure type and the exact query tried."],
           ["3", "Keep partial results", "Work done before the timeout still counts."],
           ["4", "Never fake success", "An empty ok hides the gap from the coordinator."]],
  },
  async run(s, E) {
    s.log("== Design C (the trap): the timeout is caught and returned as an empty result marked success", "note");
    const c = await design(s, E, "silent");
    s.log(`Design C report: names a timeout: ${/tim(e|ed)[ -]?out/i.test(c.report) ? "yes" : "no"} · keeps the 37% partial result: ${/37\s?%/.test(c.report) ? "yes" : "no"}`, "note");

    s.log("== Design A (the fix): structured error context (failure type, query, partial results, alternatives)", "note");
    const a = await design(s, E, "structured");
    const timeouts = a.searches.filter((x) => x.out?.failure_type === "timeout");
    const vaHandoff = a.handoffs.find((h) => /visual|art/i.test(h.input.sector || ""));
    const vaJson = parseJSON(vaHandoff?.text);
    const report = a.report;
    const gapSection = report.split(/##\s*Coverage gaps/i)[1] || "";
    s.log(`Design A report: names a timeout: ${/tim(e|ed)[ -]?out/i.test(report) ? "yes" : "no"} · keeps the 37% partial result: ${/37\s?%/.test(report) ? "yes" : "no"}`, "note");

    return {
      final: report,
      checks: [
        E.check("search_web returned a structured timeout: failure_type, attempted_query, partial_results, alternatives", timeouts.length > 0 && timeouts.every((x) => x.out.attempted_query && x.out.partial_results?.length && x.out.alternatives?.length)),
        E.check("The visual-arts subagent passed the failure up instead of hiding it", !!vaHandoff && /tim(e|ed)[ -]?out/i.test(vaHandoff.text) && (!vaJson || (vaJson.errors || []).length > 0 || vaJson.coverage !== "complete")),
        E.check("The coordinator did not abort: it finished (end_turn) with the music findings in the report", a.run.stop_reason === "end_turn" && /62\s?%|48\s?%/.test(report)),
        E.check("The report names visual arts as a coverage gap", /visual/i.test(gapSection)),
        E.check("The report keeps the partial 37% poll that arrived before the timeout", /37\s?%/.test(report)),
      ],
    };
  },
};
