// Lab 17 · Task 3.5 · Simulator 3: two linked defects go in one detailed request.
// Ported from plan_request.py. report-repo is a small report pipeline with both defects from the question:
// citations render twice, and evidence excerpts vanish between the synthesis subagent and the report.
// Claude Code runs in plan mode (shared/t3-claudecode.js: read tools only, edits blocked) three times:
//   1a "citations render twice" and 1b "excerpts disappear" as two separate requests, then
//   2  one detailed request naming both symptoms, the three files, the shared interface and the acceptance test.
import { SIM3_REPORT_REPO } from "./shared/t3-workspaces.js";
import { workspace, session, hashTree, changedFiles } from "./shared/t3-claudecode.js";

const FILES = { schema: "schema.py", "synthesis prompt": "synthesis_prompt.md", "report template": "render.py" };
const ASKS = {
  "1a": "Citations render twice in the final report. Plan a fix.",
  "1b": "Some evidence excerpts disappear from the final report. Plan a fix.",
  "2": "Two linked defects since the claim-source refactor: citations render twice in the final report, and evidence excerpts " +
    "disappear when the synthesis subagent's output reaches the report generator. The cause likely spans the claim-source " +
    "schema (report/schema.py), the synthesis prompt (report/synthesis_prompt.md) and the report template (report/render.py). " +
    "Plan one fix for both, agree the shared interface between those three, and finish with an acceptance test that " +
    "checks each claim appears once, with its excerpt and exactly one citation.",
};

// render.py, ported line for line: TEMPLATE = "- {claim} [{source_id}]\n  > {quote}\n"
const render = (items) => items.map((it) => `- ${it.claim ?? ""} [${it.source_id ?? ""}]\n  > ${it.quote ?? ""}\n`).join("");

async function plan(s, E, key, maxTurns) {
  s.log(`== Run ${key} · ${key === "2" ? "ONE detailed request" : "a separate request"} (plan mode, at most ${maxTurns} turns)`, "note");
  s.log(`  request: ${ASKS[key]}`, "note");
  const ws = workspace(E, SIM3_REPORT_REPO);
  const before = hashTree(ws.fs);
  const r = await session(s, E, ws, { prompt: ASKS[key], mode: "plan", tools: ["Read", "Grep", "Glob", "Edit", "Write"], maxTurns, max_tokens: 3000, echoMemory: false });
  const text = r.plan || r.text || "";
  const touches = Object.entries(FILES).filter(([, f]) => text.includes(f)).map(([k]) => k);
  const test = /acceptance test|test_\w+|tests\//i.test(text);
  const looks = r.calls.filter((c) => ["Read", "Grep", "Glob"].includes(c.name)).length;
  s.log(`  plan touches: ${touches.join(", ") || "none of the three"} · acceptance test: ${test ? "yes" : "no"} · ${looks} reads/searches · ${r.turns} turns`, "reply");
  return { key, r, text, touches, test, looks, reads: r.reads, unchanged: changedFiles(before, hashTree(ws.fs)).length === 0 };
}

export default {
  id: 17,
  see: "render.py prints the bug first (the citation twice, an empty excerpt line). Then three plan-mode runs: two separate requests each re-read the same files to plan their own fix; the one detailed request plans a single claim-source interface across schema.py, synthesis_prompt.md and render.py and ends with an acceptance test.",
  try: "Compare the field names in the two separate plans: does 1a keep the citation inside the claim while 1b moves it to its own field? That disagreement is what one shared request prevents.",
  // The scenario board (assets/scene.js): the bug in render.py, then three plan-mode runs. Runs 1a and 1b, one
  // request per symptom, are the trap together; run 2, one detailed request for both, is the fix.
  scene: {
    title: "Citations twice, excerpts gone: two symptoms of one claim-source refactor",
    caption: "All three runs are in plan mode on the same report repo, so no file changes. What differs is the request: one symptom at a time, or both symptoms with the three files, the shared interface and an acceptance test.",
    lanes: [
      { key: "bug", label: "The bug, reproduced", sub: "render.py on one synthesis item, no Claude call", stages: [
        { id: "item", icon: "🧾", t: "Synthesis item", s: "claim ends with [S3]; the field is excerpt" },
        { id: "tmpl", icon: "🖨", t: "render.py TEMPLATE", s: "- {claim} [{source_id}]  /  > {quote}" },
        { id: "bugout", icon: "🐞", t: "Rendered report line", s: "the citation twice, an empty excerpt line" } ] },
      { key: "1a", label: "Run 1a: \"citations render twice\"", sub: "a separate request, its own session", tone: "trap", on: /Run 1a/, stages: [
        { id: "aask", icon: "💬", t: "One symptom only", s: "\"Citations render twice. Plan a fix.\"", diff: true },
        { id: "aread", icon: "🔍", t: "Plan-mode research", s: "reads the repo from scratch", tools: ["Read", "Grep", "Glob", "Edit", "Write"], claude: true },
        { id: "aout", icon: "📋", t: "Plan 1a covers", s: "want: schema + prompt + template + test", out: true } ] },
      { key: "1b", label: "Run 1b: \"excerpts disappear\"", sub: "a second separate request, a fresh session", tone: "trap", on: /Run 1b/, stages: [
        { id: "bask", icon: "💬", t: "The other symptom only", s: "\"Excerpts disappear. Plan a fix.\"", diff: true },
        { id: "bread", icon: "🔍", t: "Plan-mode research", s: "re-reads the same files again", tools: ["Read", "Grep", "Glob", "Edit", "Write"], claude: true },
        { id: "bout", icon: "📋", t: "Plan 1b covers", s: "want: schema + prompt + template + test", out: true } ] },
      { key: "2", label: "Run 2: one detailed request", sub: "both symptoms, three files, interface, test", tone: "fix", on: /Run 2/, stages: [
        { id: "oask", icon: "💬", t: "Both symptoms, one request", s: "names schema.py, synthesis_prompt.md, render.py", diff: true },
        { id: "oread", icon: "🔍", t: "Plan-mode research", s: "one session for the shared cause", tools: ["Read", "Grep", "Glob", "Edit", "Write"], claude: true },
        { id: "oout", icon: "📋", t: "Plan 2 covers", s: "want: schema + prompt + template + test", out: true } ] },
    ],
  },
  slide: {
    title: "Linked defects: one detailed request, in plan mode",
    code: `claude --permission-mode plan                  # KEY 1
> Two linked defects since the claim-source     # KEY 2
  refactor: citations render twice, and
  excerpts disappear between synthesis and
  the report. Likely spans report/schema.py,     # KEY 3
  synthesis_prompt.md and render.py.
  Plan ONE fix, agree the shared interface,
  and finish with an acceptance test: each       # KEY 4
  claim once, with its excerpt, one citation.`,
    keys: [["1", "Plan before editing", "Uncertain cause across several files."],
           ["2", "Both symptoms together", "They share one cause: the schema."],
           ["3", "Name the affected areas", "Claude reads the right three files."],
           ["4", "Say what fixed means", "An acceptance test proves both fixes."]],
  },
  async run(s, E) {
    s.log("== The bug, reproduced: render.py on one item from the synthesis subagent", "note");
    const item = { claim: "Completion rose to 72% [S3]", source_id: "S3", excerpt: "72% of the cohort completed." };
    s.log(`  item: ${JSON.stringify(item)}`, "result");
    for (const ln of render([item]).replace(/\n$/, "").split("\n")) s.log(`  | ${ln}`, "result");
    s.log("  the citation appears twice, and the excerpt line is empty (the prompt says excerpt, render.py reads quote)", "deny");
    const out = render([item]);
    s.show("item", `excerpt: "${item.excerpt}"`, "done");
    s.show("tmpl", "reads quote, which the item lacks", "done");
    s.show("bugout", `[S3] ×${(out.match(/\[S3\]/g) || []).length} · excerpt line ${/>\s*\n/.test(out) ? "empty" : "present"}`, "bad");

    // A plan's coverage: which of the three files it names, whether it settles excerpt vs quote, and the test.
    const covers = (r) => `${r.touches.length}/3 files${r.test ? " + test" : ", no test"}`;
    const full = (r) => r.touches.length === 3 && r.test;
    const shareIface = (r) => /\bquote\b/.test(r.text) && /\bexcerpt\b/.test(r.text);
    const a = await plan(s, E, "1a", 6);
    s.show("aask", "citations only", "done");
    s.show("aout", `${covers(a)} · ${a.touches.join(", ") || "none of the three"}`, full(a) ? "good" : "bad");
    await s.pause({
      title: "Run 1a finished: \"citations render twice\", on its own",
      outcome: `Plan 1a covers **${a.touches.join(", ") || "none of the three files"}**${a.test ? " and names a test" : ", with no acceptance test"}, after ${a.looks} reads/searches. ${shareIface(a) ? "It touches excerpt vs quote too, but run 1b will start over without seeing this plan." : "It never settles excerpt vs quote: the excerpt bug is not its problem."}`,
      next: "Run 1b: the other symptom, \"excerpts disappear\", as its own request in a fresh session",
    });
    const b = await plan(s, E, "1b", 6);
    s.show("bask", "excerpts only", "done");
    s.show("bout", `${covers(b)} · ${b.touches.join(", ") || "none of the three"}`, full(b) ? "good" : "bad");
    const reread = a.reads.filter((f) => b.reads.includes(f));
    await s.pause({
      title: "Run 1b finished: two separate plans for one cause",
      outcome: `Two sessions spent **${a.looks + b.looks} reads/searches**; 1b re-read ${reread.length ? reread.map((f) => `\`${f}\``).join(", ") : "no file 1a had read"}. Plan 1a covers ${a.touches.join(", ") || "none of the three"}; plan 1b covers ${b.touches.join(", ") || "none of the three"}. Nothing makes the two agree on one set of field names.`,
      next: "Run 2: ONE detailed request naming both symptoms, the three files, the shared interface and an acceptance test",
    });
    const one = await plan(s, E, "2", 8);
    s.show("oask", "both symptoms + 3 files + test", "done");
    s.show("oout", `${covers(one)}${shareIface(one) ? " · settles excerpt vs quote" : ""}`, full(one) && shareIface(one) ? "good" : "bad");
    const runs = [a, b, one];
    const overlap = a.reads.filter((f) => b.reads.includes(f));
    s.log("== Separate requests vs one detailed request", "note");
    s.log(`  separate: 2 sessions, ${a.looks + b.looks} reads/searches, both re-read ${overlap.join(", ") || "(no shared file)"}`, "reply");
    s.log(`  detailed: 1 session, ${one.looks} reads/searches, plan covers ${one.touches.join(", ")}${one.test ? " and ends with an acceptance test" : ""}`, "reply");

    const yes = (ok) => ({ v: ok ? "yes" : "no", tone: ok ? "good" : "bad" });
    const fileCell = (r) => ({ v: r.touches.join(", ") || "none of the three", tone: r.touches.length === 3 ? "good" : "bad" });
    const sepVerdict = (r, sym) => full(r) && shareIface(r)
      ? `Planned the whole fix this time (all three files and a test) from "${sym}" alone, but in its own session: nothing ties it to the other plan's field names.`
      : `Asked about "${sym}" alone: the plan covers ${r.touches.join(", ") || "none of the three files"}${r.test ? " and names a test" : " but has **no acceptance test**"}${shareIface(r) ? "" : ", and never settles excerpt vs quote"}, in a session the other symptom never reached.`;
    return {
      compare: {
        cols: [
          { title: "Run 1a: \"citations render twice\"", short: "1a: separate", tone: "trap", said: a.text, verdict: sepVerdict(a, "citations render twice") },
          { title: "Run 1b: \"excerpts disappear\"", short: "1b: separate", tone: "trap", said: b.text, verdict: sepVerdict(b, "excerpts disappear") },
          { title: "Run 2: one detailed request", short: "2: one request", tone: "fix", said: one.text,
            verdict: full(one) && shareIface(one) ? `One plan for both symptoms: covers all three files, settles **excerpt vs quote** in one shared interface, and ends with an acceptance test, in ${one.looks} reads/searches.`
                                                  : `Covers ${one.touches.join(", ") || "none of the three"}${one.test ? " with a test" : ", no test"}${shareIface(one) ? "" : ", excerpt vs quote unsettled"}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Request", "one symptom: citations", "one symptom: excerpts", "both symptoms, 3 files, interface, test"],
          ["Files the plan covers", fileCell(a), fileCell(b), fileCell(one)],
          ["Settles excerpt vs quote", yes(shareIface(a)), yes(shareIface(b)), yes(shareIface(one))],
          ["Acceptance test", yes(a.test), yes(b.test), yes(one.test)],
          ["Reads / searches", String(a.looks), `${b.looks} (re-read ${overlap.length} of 1a's files)`, String(one.looks)],
          ["Files changed (plan mode)", String(runs[0].unchanged ? 0 : "some"), String(runs[1].unchanged ? 0 : "some"), String(runs[2].unchanged ? 0 : "some")],
        ],
        note: "All three runs use plan mode on the same repo. The only difference is the request: two linked symptoms asked separately become two sessions that each rediscover the schema change; asked together, with the files and the acceptance test named, they become one interface and one test.",
      },
      final: one.text,
      checks: [
        E.check("The detailed request's plan covers the schema, the synthesis prompt and the report template", one.touches.length === 3),
        E.check("The detailed plan defines one shared field set, settling excerpt vs quote", /\bquote\b/.test(one.text) && /\bexcerpt\b/.test(one.text)),
        E.check("The detailed plan ends with an acceptance test", one.test),
        E.check(`The separate requests repeated the research: both sessions read ${overlap.join(", ") || "nothing in common"}`, overlap.length > 0),
        E.check("Plan mode changed no file in any of the three runs", runs.every((r) => r.unchanged)),
      ],
    };
  },
};
