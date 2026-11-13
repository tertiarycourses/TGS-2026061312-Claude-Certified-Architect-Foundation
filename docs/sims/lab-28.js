// Lab 28 · Task 5.4 · Simulator 4 · Case Study lab: map a legacy billing repo and find every caller of
// calculate_total. The repo (shared/t5-legacy-repo.js) carries noise: billing logs, SQL migrations, a
// minified bundle and an archived copy of the function, so a wide search floods whichever context runs it.
// Trap (option B): the main session greps and reads everything itself.
// Fix (option A): the main session delegates the search to an explore subagent (its own context, rows
// logged with "(subagent)"), writes the findings to a NOTES.md scratchpad, and a fresh session later
// answers from NOTES.md alone.
import { LEGACY_FILES, CALLERS, writeTool, contextTokens } from "./shared/t5-legacy-repo.js";

const TASK = "Map this repo for a new engineer: entry points, where totals are computed and validated, and every caller of calculate_total.";
const EXPLORE = "You are an explore subagent with your own context window. Search the repository with Grep, Glob and Read to answer the task in your prompt. Logs, migrations, minified bundles and archived files are noise: check whether each hit is a real call in live source code. Return ONLY a short summary (under 120 words): each finding as path:line with one line of explanation. Never paste raw search output.";
const MAIN = "You are the main session of a coding assistant in a large legacy repository. Keep your own context small. Do not search the repository yourself: make ONE explore call that covers the whole search task; it runs a subagent with its own context and returns only a summary. Record what you learn in the NOTES.md scratchpad with Write, so the findings survive compaction and new sessions. Then reply with a three-line summary.";
const TRAP = "You are the main session of a coding assistant in a legacy repository. Read every file in the main thread so nothing is missed, then answer.";

export default {
  id: 28,
  see: "The explore subagent's Grep and Read rows run in their own context, the main session stays a fraction of the size of the read-everything session, NOTES.md names calculate_total and src/legacy/report.py, and a fresh session answers from NOTES.md alone.",
  explain: "Reading everything in the main thread pours log lines, migrations and a minified bundle into the context you need for the rest of the session, which is how long sessions start quoting generic patterns instead of the classes they found. The explore subagent does the same noisy Grep and Read work in its own context window and hands back only a short summary, so the main session holds the conclusions, not the search output. Writing them to NOTES.md makes them durable: a fresh session that never saw the search answers the caller question from the scratchpad.",
  try: "In docs/sims/shared/t5-legacy-repo.js add a fourth caller (for example src/jobs/nightly.py calling invoice.calculate_total) and rerun: only the explore subagent's context grows, and NOTES.md picks up the new file.",
  slide: {
    title: "Search in a subagent, keep findings in a file",
    code: `explore = AgentDefinition(                      # KEY 1
    description="Wide read-only codebase search",
    prompt="Grep, Glob, Read. Return a summary "
           "of path:line findings, never raw output.",
    tools=["Grep", "Glob", "Read"])
options = ClaudeAgentOptions(
    agents={"explore": explore},
    allowed_tools=["Agent", "Write"])           # KEY 2
prompt = ("Find every caller of calculate_total "
          "with the explore subagent, then write "
          "the findings to NOTES.md.")          # KEY 3
# later: a fresh session reads NOTES.md         # KEY 4`,
    keys: [["1", "Own context window", "The noisy reads never reach the main session."],
           ["2", "Main thread delegates", "It keeps Agent and Write, not raw search."],
           ["3", "A scratchpad file", "NOTES.md holds path:line findings."],
           ["4", "Survives compaction", "A new session starts from the notes."]],
  },
  async run(s, E) {
    // Trap: the main session does the wide search itself.
    s.log("== Trap (option B): the main session greps and reads everything itself", "note");
    const trapRepo = E.repo({ ...LEGACY_FILES });
    const trap = await E.runAgent(s, { system: TRAP, prompt: TASK, tools: { Grep: trapRepo.tools.Grep, Glob: trapRepo.tools.Glob, Read: trapRepo.tools.Read }, maxTurns: 5 });
    const trapCtx = contextTokens(trap.messages);
    s.log(`Trap: the main context now holds about ${trapCtx.toLocaleString()} tokens of search output and file text (${trap.calls.length} tool calls in the main thread).`, "note");

    // Fix: delegate to an explore subagent, keep a scratchpad.
    s.log("== Fix (option A): delegate the noisy search to an explore subagent, write NOTES.md", "note");
    const r = E.repo({ ...LEGACY_FILES });
    const writes = [], sub = { runs: 0, calls: [], ctx: 0 };
    const tools = {
      explore: {
        description: "Run an explore subagent with its own context window for a wide, read-only search of the repository (Grep, Glob, Read). Input: the search task. Returns a short summary of path:line findings.",
        input_schema: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
        run: async ({ task }) => {
          sub.runs += 1;
          const x = await E.runAgent(s, { label: "(subagent)", system: EXPLORE, prompt: task, tools: { Grep: r.tools.Grep, Glob: r.tools.Glob, Read: r.tools.Read }, maxTurns: 6 });
          sub.calls.push(...x.calls); sub.ctx += contextTokens(x.messages);
          return x.text || { isError: true, message: "The explore subagent returned no summary." };
        },
      },
      Write: writeTool(r.fs, writes),
    };
    const main = await E.runAgent(s, { system: MAIN, prompt: `${TASK} Use the explore subagent for the caller search and write the map to NOTES.md.`, tools, maxTurns: 5 });
    const mainCtx = contextTokens(main.messages);
    const notes = r.fs["NOTES.md"] || "";
    s.log(`Context sizes: main session about ${mainCtx.toLocaleString()} tokens · explore subagent about ${sub.ctx.toLocaleString()} tokens (discarded after it returned) · trap main session about ${trapCtx.toLocaleString()} tokens.`, "note");
    s.log(`NOTES.md (${notes.length} chars):\n${notes.slice(0, 900)}`, "note");

    // A fresh session (after /compact or a restart) starts from the scratchpad, not from the search.
    s.log("== A fresh session: no search tools, only the NOTES.md scratchpad", "note");
    const fresh = await E.runAgent(s, { system: "You are a new session in this repository. Your predecessor left NOTES.md. Answer from it.", prompt: "Which files call calculate_total? Read NOTES.md, then answer in one or two lines.", tools: { Read: r.tools.Read }, maxTurns: 3 });

    // The case study's three verdict lines (as the Python simulator prints them), then the checks.
    const spawned = sub.runs > 0;
    const rows = s.trace.filter((t) => t.label === "(subagent)" && t.tools.some((x) => ["Grep", "Glob", "Read"].includes(x.name))).length > 0;
    const notesOk = /calculate_total/.test(notes) && /report\.py/.test(notes);
    s.log("== Case study verdict", "note");
    for (const [ok, label] of [[spawned, "explore subagent spawned"], [rows, "tool rows with agent=(subagent) exist"], [notesOk, "NOTES.md mentions calculate_total and a caller (report.py)"]])
      s.log(`${ok ? "PASS" : "FAIL"} - ${label}`, ok ? "result" : "error");

    return {
      final: `${main.text}\n\n--- Fresh session, answering from NOTES.md ---\n${fresh.text}`,
      checks: [
        E.check("The explore subagent ran the search: its Grep/Glob/Read rows are logged as (subagent), none in the main session", spawned && rows && !main.calls.some((c) => ["Grep", "Glob", "Read"].includes(c.name))),
        E.check("The main session stayed under half the size of the read-everything session", mainCtx * 2 < trapCtx),
        E.check("NOTES.md names calculate_total and its caller src/legacy/report.py", notesOk),
        E.check(`NOTES.md lists all three live callers (${CALLERS.map((c) => c.split("/").pop()).join(", ")}), including the indirect invoice.calculate_total in export.py`, CALLERS.every((c) => notes.includes(c.split("/").pop()))),
        E.check("A fresh session answered from NOTES.md alone and named report.py", E.called(fresh.calls, "Read").some((c) => /NOTES\.md/.test(c.input.path || "")) && /report\.py/.test(fresh.text)),
      ],
    };
  },
};
