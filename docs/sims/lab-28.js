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
  // The scenario board (assets/scene.js): who reads the noisy legacy repo, and where the findings end up.
  scene: {
    title: "The legacy billing repo: find every caller of calculate_total without drowning the main session",
    caption: "Both designs search the same repo: 3 live callers hidden among 6 billing logs, 6 SQL migrations, a minified bundle and an archived copy. Only where the search runs changes.",
    lanes: [
      { key: "T", label: "Trap (option B)", sub: "the main session reads everything itself", tone: "trap", on: /Trap \(option B\)/, stages: [
        { id: "tmain", icon: "🧠", t: "Main session", s: "\"read every file so nothing is missed\"", claude: true },
        { id: "tsearch", icon: "🗑", t: "Grep + Read in main context", s: "logs, migrations, the .min.js bundle pour in", tools: ["Grep", "Glob", "Read"], diff: true },
        { id: "tcallers", icon: "🔎", t: "Callers in its answer", s: "report.py, validation.py, export.py" },
        { id: "tctx", icon: "📏", t: "Main context afterwards", s: "want: no log or migration lines in it", out: true } ] },
      { key: "F", label: "Fix (option A)", sub: "explore subagent + NOTES.md", tone: "fix", on: /Fix \(option A\)/, stages: [
        { id: "fmain", icon: "🧠", t: "Main session", s: "ONE explore call, then Write NOTES.md", claude: /^$/ },
        { id: "fsub", icon: "🔎", t: "Explore subagent", s: "own context: the noisy Grep and Read", claude: /subagent/, tools: ["Grep", "Glob", "Read"], diff: true },
        { id: "fnotes", icon: "📝", t: "NOTES.md scratchpad", s: "path:line findings, kept in a file", tools: ["Write"] },
        { id: "fctx", icon: "📏", t: "Main context afterwards", s: "want: no log or migration lines in it", out: true } ] },
      { key: "N", label: "Next session", sub: "after /compact or a restart", on: /fresh session/, stages: [
        { id: "nnew", icon: "🌅", t: "Fresh session", s: "no search tools, never saw the search", claude: true },
        { id: "nread", icon: "📖", t: "Reads NOTES.md", s: "the only thing its predecessor left", tools: ["Read"] },
        { id: "nans", icon: "💬", t: "Who calls calculate_total?", s: "want: report.py named from the notes", out: true } ] },
    ],
  },
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
    // Measured, not assumed: noise lines (billing logs, SQL migrations, the minified bundle) that reached a context,
    // and which of the three live callers a final answer names.
    const NOISE = /INFO billing\.calculate_total invoice=|ALTER TABLE invoices|UPDATE invoices SET|fetch\("\/api\/calculate_total/;
    const noiseLines = (calls) => calls.reduce((n, c) => n + String(typeof c.result === "string" ? c.result : JSON.stringify(c.result ?? "")).split(/\n|\\n/).filter((l) => NOISE.test(l)).length, 0);
    const named = (txt) => CALLERS.filter((c) => String(txt || "").includes(c.split("/").pop()));
    const searchCalls = (calls) => calls.filter((c) => ["Grep", "Glob", "Read"].includes(c.name)).length;
    const trapNoise = noiseLines(trap.calls), trapNamed = named(trap.text);
    s.show("tmain", `${trap.turns} turns · ${trap.stop_reason}`, "done");
    s.show("tsearch", `${searchCalls(trap.calls)} searches in the main thread`, "done");
    s.show("tcallers", trap.text ? `${trapNamed.length} of 3: ${trapNamed.map((c) => c.split("/").pop()).join(", ") || "none"}` : "no answer (turn cap)", "done");
    s.show("tctx", `≈ ${trapCtx.toLocaleString()} tokens · ${trapNoise} noise lines`, trapNoise === 0 ? "good" : "bad");
    await s.pause({
      title: "The trap finished: the main session did the wide search itself",
      outcome: `${searchCalls(trap.calls)} Grep/Glob/Read calls ran in the main thread and left about **${trapCtx.toLocaleString()} tokens** in its context, including **${trapNoise} lines of log, migration and bundle noise**. ` +
        `Its answer named ${trapNamed.length} of the 3 live callers${trapNamed.length ? ` (${trapNamed.map((c) => c.split("/").pop()).join(", ")})` : ""}, and nothing was written down for the next session.`,
      next: "Fix: delegate the search to an explore subagent and keep the findings in NOTES.md",
    });

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
    const mainNoise = noiseLines(main.calls), notesNamed = named(notes);
    s.show("fmain", `${sub.runs} explore call${sub.runs === 1 ? "" : "s"} · ${searchCalls(main.calls)} searches of its own`, "done");
    s.show("fsub", `${searchCalls(sub.calls)} searches · ≈ ${sub.ctx.toLocaleString()} tokens, discarded`, "done");
    s.show("fnotes", notes ? `${notes.length} chars · ${notesNamed.length} of 3 callers` : "not written", notes && notesNamed.length === 3 ? "done" : "bad");
    s.show("fctx", `≈ ${mainCtx.toLocaleString()} tokens · ${mainNoise} noise lines`, mainNoise === 0 && mainCtx * 2 < trapCtx ? "good" : "bad");

    // A fresh session (after /compact or a restart) starts from the scratchpad, not from the search.
    s.log("== A fresh session: no search tools, only the NOTES.md scratchpad", "note");
    const fresh = await E.runAgent(s, { system: "You are a new session in this repository. Your predecessor left NOTES.md. Answer from it.", prompt: "Which files call calculate_total? Read NOTES.md, then answer in one or two lines.", tools: { Read: r.tools.Read }, maxTurns: 3 });
    const readNotes = E.called(fresh.calls, "Read").some((c) => /NOTES\.md/.test(c.input.path || ""));
    const freshNamed = named(fresh.text);
    s.show("nread", readNotes ? `read NOTES.md (${notes.length} chars)` : "did not read NOTES.md", readNotes ? "done" : "bad");
    s.show("nans", `${freshNamed.length} of 3: ${freshNamed.map((c) => c.split("/").pop()).join(", ") || "none"}`, readNotes && /report\.py/.test(fresh.text) ? "good" : "bad");

    // The case study's three verdict lines (as the Python simulator prints them), then the checks.
    const spawned = sub.runs > 0;
    const rows = s.trace.filter((t) => t.label === "(subagent)" && t.tools.some((x) => ["Grep", "Glob", "Read"].includes(x.name))).length > 0;
    const notesOk = /calculate_total/.test(notes) && /report\.py/.test(notes);
    s.log("== Case study verdict", "note");
    for (const [ok, label] of [[spawned, "explore subagent spawned"], [rows, "tool rows with agent=(subagent) exist"], [notesOk, "NOTES.md mentions calculate_total and a caller (report.py)"]])
      s.log(`${ok ? "PASS" : "FAIL"} - ${label}`, ok ? "result" : "error");

    const tone = (ok) => (ok ? "good" : "bad");
    const smaller = mainCtx * 2 < trapCtx;
    const fixRight = spawned && mainNoise === 0 && smaller && notesNamed.length === 3;
    return {
      final: `${main.text}\n\n--- Fresh session, answering from NOTES.md ---\n${fresh.text}`,
      compare: {
        cols: [
          { title: "Trap: the main session reads everything", short: "Trap (B)", tone: "trap", said: trap.text,
            verdict: `${trapNamed.length === 3 ? "Found all three callers, but paid for it" : `Named ${trapNamed.length} of the 3 live callers`}: about ${trapCtx.toLocaleString()} tokens stay in the main context, ${trapNoise ? `${trapNoise} of them lines of log, migration and bundle noise` : "though no noise lines this time"}, and nothing is written down for the next session.` },
          { title: "Fix: explore subagent + NOTES.md", short: "Fix (A)", tone: "fix", said: main.text,
            verdict: fixRight ? `The noisy search ran in the subagent (${searchCalls(sub.calls)} calls, then discarded); the main session kept about ${mainCtx.toLocaleString()} tokens and NOTES.md holds all three callers for the next session.`
              : `Not clean this run: ${[!spawned && "no explore subagent ran", mainNoise && `${mainNoise} noise lines reached the main context`, !smaller && "the main session was not under half the trap's size", notesNamed.length < 3 && `NOTES.md names ${notesNamed.length} of 3 callers`].filter(Boolean).join("; ")}.` },
        ],
        rows: [
          ["Who ran Grep / Glob / Read", `main session: ${searchCalls(trap.calls)} calls`, `explore subagent: ${searchCalls(sub.calls)} calls · main: ${searchCalls(main.calls)}`],
          ["Main context afterwards", { v: `≈ ${trapCtx.toLocaleString()} tokens`, tone: tone(!smaller) }, { v: `≈ ${mainCtx.toLocaleString()} tokens`, tone: tone(smaller) }],
          ["Log / migration / bundle lines in it", { v: String(trapNoise), tone: tone(trapNoise === 0) }, { v: String(mainNoise), tone: tone(mainNoise === 0) }],
          ["Live callers named (of 3)", { v: `${trapNamed.length} in its answer`, tone: tone(trapNamed.length === 3) }, { v: `${notesNamed.length} in NOTES.md`, tone: tone(notesNamed.length === 3) }],
          ["Findings that survive a new session", { v: "none: only in the transcript", tone: "bad" }, { v: notes ? `NOTES.md, ${notes.length} chars` : "none", tone: tone(!!notes) }],
          ["Fresh session answers \"who calls it?\"", "n/a: nothing to start from", { v: readNotes && /report\.py/.test(fresh.text) ? `yes, from NOTES.md (${freshNamed.length} of 3)` : "no", tone: tone(readNotes && /report\.py/.test(fresh.text)) }],
        ],
        note: "Both runs search the same noisy repo with the same Grep, Glob and Read. The only change is where the search runs: in the main session's own context, or in an explore subagent whose context is thrown away once it returns its summary.",
      },
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
