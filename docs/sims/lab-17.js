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

    const runs = [await plan(s, E, "1a", 6), await plan(s, E, "1b", 6), await plan(s, E, "2", 8)];
    const [a, b, one] = runs;
    const overlap = a.reads.filter((f) => b.reads.includes(f));
    s.log("== Separate requests vs one detailed request", "note");
    s.log(`  separate: 2 sessions, ${a.looks + b.looks} reads/searches, both re-read ${overlap.join(", ") || "(no shared file)"}`, "reply");
    s.log(`  detailed: 1 session, ${one.looks} reads/searches, plan covers ${one.touches.join(", ")}${one.test ? " and ends with an acceptance test" : ""}`, "reply");

    return {
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
