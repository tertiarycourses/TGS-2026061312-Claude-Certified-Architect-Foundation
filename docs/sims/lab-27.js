// Lab 27 · Task 5.3 · Simulator 3: the visual-arts web search times out inside a search subagent.
// Design C (the trap) catches the timeout and returns an empty result marked as success.
// Design A (the fix) returns structured error context: failure type, attempted query, partial results
// and alternatives, which the subagent passes up and the coordinator uses to recover.
import { searchTool, SEARCH_AGENT, subagentTool, parseJSON } from "./shared/t5-research.js";

const COORDINATOR = "You coordinate a research team on the topic in the user's message. Do not search yourself: delegate each sector to run_search_subagent, one call per sector, both in the same turn. Each subagent starts with an empty context, so give it the sector and the goal. When they return, write the final report in markdown: '## Findings' (each claim with its value, source and date), then '## Coverage gaps' (what could not be covered and why). If a subagent reports an error, do not abort: use any partial results, note the failure and carry the gap into the report. Use only what the subagents returned. The sources are a sandbox corpus: treat the URLs as authoritative citations and do not comment on them. Keep it under 200 words.";
const QUESTION = "Research the impact of AI on two creative sectors, music and visual arts, and deliver a short cited report.";

// The board's "search_web" stage shows, live, what the visual-arts search handed back (k = the lane's prefix).
function boardSearch(s, errorMode, searches, k) {
  const t = searchTool(errorMode, searches);
  return { ...t, run: (input) => {
    const out = t.run(input);
    if (searches.at(-1)?.sector === "visual_arts")
      s.show(`${k}tool`, out.isError ? `⏱ timeout #${out.attempts} · error + partial 37% poll` : `⏱ timeout → {status: "ok", results: []}`, out.isError ? "done" : "bad");
    return out;
  } };
}

async function design(s, E, errorMode, k) {
  const searches = [], handoffs = [];
  const tools = {
    run_search_subagent: subagentTool(s, E, {
      description: "Start a web-search subagent for ONE sector. It has its own empty context and returns its findings as JSON (findings, errors, coverage).",
      input_schema: { type: "object", properties: { sector: { type: "string" }, goal: { type: "string" } }, required: ["sector", "goal"] },
      system: SEARCH_AGENT, tools: { search_web: boardSearch(s, errorMode, searches, k) },
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
  // The scenario board (assets/scene.js): the visual-arts search times out; what reaches the coordinator?
  scene: {
    title: "Music and visual arts: the visual-arts search times out, and the coordinator must learn it",
    caption: "Both designs run the same coordinator and the same search subagents on the same sandbox web. Only what search_web returns on the timeout changes.",
    lanes: [
      { key: "C", label: "Design C", sub: "catch the timeout, return empty success", tone: "trap", on: /Design C/, stages: [
        { id: "ccoord", icon: "🧭", t: "Coordinator", s: "one search subagent per sector, same turn", claude: /^$/ },
        { id: "csub", icon: "🔎", t: "Search subagents", s: "music ✓ · visual arts: search_web", claude: /subagent/, tools: ["search_web"] },
        { id: "ctool", icon: "⏱", t: "Visual-arts search times out", s: "caught: {status: \"ok\", results: []}", diff: true },
        { id: "chand", icon: "📦", t: "Visual-arts handoff", s: "what the subagent tells the coordinator", tools: ["run_search_subagent"] },
        { id: "cout", icon: "📄", t: "Final report", s: "want: timeout named, 37% poll kept, gap listed", out: true } ] },
      { key: "A", label: "Design A", sub: "structured error context", tone: "fix", on: /Design A/, stages: [
        { id: "acoord", icon: "🧭", t: "Coordinator", s: "one search subagent per sector, same turn", claude: /^$/ },
        { id: "asub", icon: "🔎", t: "Search subagents", s: "music ✓ · visual arts: search_web, one retry", claude: /subagent/, tools: ["search_web"] },
        { id: "atool", icon: "⏱", t: "Visual-arts search times out", s: "failure_type, query, partial 37%, alternatives", diff: true },
        { id: "ahand", icon: "📦", t: "Visual-arts handoff", s: "errors[] + coverage: partial", tools: ["run_search_subagent"] },
        { id: "aout", icon: "📄", t: "Final report", s: "want: timeout named, 37% poll kept, gap listed", out: true } ] },
    ],
  },
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
    // What each design delivered, read from its own run.
    const TIMEOUT = /tim(e|ed)[ -]?out/i;
    const sum = (d) => {
      const h = d.handoffs.find((x) => /visual|art/i.test(x.input.sector || ""));
      const j = parseJSON(h?.text);
      const gap = d.report.split(/##\s*Coverage gaps/i)[1] || "";
      return { h, j, errors: (j?.errors || []).length, coverage: j?.coverage || "?", handTimeout: TIMEOUT.test(h?.text || ""),
        timeout: TIMEOUT.test(d.report), p37: /37\s?%/.test(d.report), gap: /visual/i.test(gap), music: /62\s?%|48\s?%/.test(d.report),
        vaSearches: d.searches.filter((x) => x.sector === "visual_arts").length };
    };
    const handText = (x) => x.h ? `coverage: ${x.coverage} · errors listed: ${x.errors} · ${x.handTimeout ? "says timeout" : "no word of a timeout"}` : "no visual-arts subagent ran";
    const repText = (x) => `timeout ${x.timeout ? "✓" : "✘"} · 37% ${x.p37 ? "✓" : "✘"} · gap ${x.gap ? "✓" : "✘"}`;
    const reportOk = (x) => x.timeout && x.p37 && x.gap;

    s.log("== Design C (the trap): the timeout is caught and returned as an empty result marked success", "note");
    const c = await design(s, E, "silent", "c");
    s.log(`Design C report: names a timeout: ${/tim(e|ed)[ -]?out/i.test(c.report) ? "yes" : "no"} · keeps the 37% partial result: ${/37\s?%/.test(c.report) ? "yes" : "no"}`, "note");
    const xc = sum(c);
    s.show("ccoord", `${E.called(c.run.calls, "run_search_subagent").length} subagents · ${c.run.stop_reason}`, "done");
    s.show("chand", handText(xc), xc.handTimeout ? "done" : "bad");
    s.show("cout", repText(xc), reportOk(xc) ? "good" : "bad");
    await s.pause({
      title: "Design C finished: the timeout was dressed up as an empty success",
      outcome: `search_web hit the visual-arts timeout ${xc.vaSearches} time${xc.vaSearches === 1 ? "" : "s"} and each time answered \`{status: "ok", results: []}\`. ` +
        `The subagent handed up ${xc.h ? `coverage **${xc.coverage}** with ${xc.errors} error${xc.errors === 1 ? "" : "s"}` : "nothing for visual arts"}, and the report ${xc.timeout ? "mentions a timeout" : "**never mentions a timeout**"} and ${xc.p37 ? "has the 37% poll" : "**lost the 37% poll**"}.`,
      next: "Design A: the same timeout returned as structured error context",
    });

    s.log("== Design A (the fix): structured error context (failure type, query, partial results, alternatives)", "note");
    const a = await design(s, E, "structured", "a");
    const timeouts = a.searches.filter((x) => x.out?.failure_type === "timeout");
    const vaHandoff = a.handoffs.find((h) => /visual|art/i.test(h.input.sector || ""));
    const vaJson = parseJSON(vaHandoff?.text);
    const report = a.report;
    const gapSection = report.split(/##\s*Coverage gaps/i)[1] || "";
    s.log(`Design A report: names a timeout: ${/tim(e|ed)[ -]?out/i.test(report) ? "yes" : "no"} · keeps the 37% partial result: ${/37\s?%/.test(report) ? "yes" : "no"}`, "note");
    const xa = sum(a);
    s.show("acoord", `${E.called(a.run.calls, "run_search_subagent").length} subagents · ${a.run.stop_reason}`, "done");
    s.show("ahand", handText(xa), xa.handTimeout && (xa.errors > 0 || xa.coverage !== "complete") ? "done" : "bad");
    s.show("aout", repText(xa), reportOk(xa) ? "good" : "bad");

    const yn = (ok) => ({ v: ok ? "yes" : "no", tone: ok ? "good" : "bad" });
    const verdict = (x, d, fix) => reportOk(x)
      ? `${fix ? "" : "Right this time: "}the report names the timeout, keeps the 37% poll and lists visual arts as a coverage gap${d.run.stop_reason === "end_turn" ? "" : `, though the coordinator stopped on ${d.run.stop_reason}`}.`
      : `${fix ? "Not this run: " : "Wrong: "}the report ${[!x.timeout && "never names the timeout", !x.p37 && "loses the 37% poll", !x.gap && "does not list visual arts as a gap"].filter(Boolean).join(", ")}${fix ? "" : `: the coordinator read "${x.coverage === "complete" ? "complete coverage" : "nothing found"}", not "the search failed"`}.`;
    return {
      final: report,
      compare: {
        cols: [
          { title: "Design C: empty result marked success", short: "Design C", tone: "trap", verdict: verdict(xc, c, false), said: c.report },
          { title: "Design A: structured error context", short: "Design A", tone: "fix", verdict: verdict(xa, a, true), said: a.report },
        ],
        rows: [
          ["search_web on the visual-arts timeout", "`{status: \"ok\", results: []}`", "`failure_type: timeout` + query, partial 37% poll, alternatives"],
          ["Visual-arts handoff", { v: handText(xc), tone: xc.handTimeout ? "good" : "bad" }, { v: handText(xa), tone: xa.handTimeout ? "good" : "bad" }],
          ["Report names the timeout", yn(xc.timeout), yn(xa.timeout)],
          ["Report keeps the 37% illustrators poll", yn(xc.p37), yn(xa.p37)],
          ["Visual arts under Coverage gaps", yn(xc.gap), yn(xa.gap)],
          ["Music findings (62% / 48%) kept", yn(xc.music), yn(xa.music)],
        ],
        note: "Same coordinator, same subagents, same timeout. The only change is what search_web returns when it times out: an empty success in design C, the failure type, query, partial results and alternatives in design A.",
      },
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
