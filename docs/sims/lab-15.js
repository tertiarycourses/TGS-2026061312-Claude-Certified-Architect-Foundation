// Lab 15 · Task 3.3 · Simulator 3: testing rules for test files spread across every folder.
// Ported from rules_sim.py: three top-level folders, each with an implementation and a sibling *.test.ts.
// The same testing guidance carries a marker token. Wherever the guidance reaches Claude, Claude starts its
// reply with the token, so the reply itself shows whether the guidance loaded for that edit.
// The emulator (shared/t3-claudecode.js) loads a rule with paths: only when Claude reads or edits a match.
import { SIM3_RULES_FILES } from "./shared/t3-workspaces.js";
import { workspace, session, startupMemory, pathMemory, showFile } from "./shared/t3-claudecode.js";

const TOKEN = "TESTING-GUIDANCE-LOADED";
const FOLDERS = ["citation-verification", "report-rendering", "orchestration"];
const GUIDANCE = `# Testing guidance

- Tests sit beside the implementation they cover (\`foo.ts\` next to \`foo.test.ts\`).
- Every new assertion needs a one-line comment naming the behaviour it protects.
- Never weaken an existing assertion to make a test pass.
- Reporting convention (applies to every reply while this guidance is loaded, whatever file you
  edited): begin the reply with ${TOKEN} and the name of this guidance file, so reviewers can see
  which guidance was applied.
`;
const ROOT = "# Research system repo\n\nTypeScript monorepo for the multi-agent research system. Do not run commands in this sandbox; edit and report.\n";
const PROMPTS = {
  test: "In orchestration/orchestrator.test.ts, inside the existing test, add one more assertion: the first planned item contains 'music'. Edit the file, do not run any command, then reply in at most three lines.",
  impl: "In report-rendering/renderer.ts change the header line so the last column reads 'Date' instead of 'Published'. Edit the file, do not run any command, then reply in at most three lines.",
};
const TARGET = { test: "orchestration/orchestrator.test.ts", impl: "report-rendering/renderer.ts" };

function variant(v) {
  const f = { ...SIM3_RULES_FILES, "CLAUDE.md": ROOT };
  if (v === "A") f[".claude/rules/testing.md"] = GUIDANCE;
  if (v === "B") f["CLAUDE.md"] = ROOT + "\n" + GUIDANCE;
  if (v === "C") for (const d of FOLDERS) f[`${d}/CLAUDE.md`] = GUIDANCE;
  if (v === "D") f[".claude/rules/testing.md"] = '---\npaths: ["**/*.test.ts"]\n---\n' + GUIDANCE;
  return f;
}
const copies = (f) => Object.values(f).filter((t) => t.includes(TOKEN)).length;
// Does the guidance reach Claude for this file? Startup memory plus what touching the file loads.
const reaches = (f, path) => [...startupMemory(f), ...pathMemory(f, path, new Set(startupMemory(f).map((e) => e.path)))].some((e) => e.body.includes(TOKEN));

async function edit(s, E, v, kind) {
  s.log(`== Variant ${v} · ${kind === "test" ? "edit the TEST file" : "edit the IMPLEMENTATION file"} (${TARGET[kind]})`, "note");
  const ws = workspace(E, variant(v));
  const r = await session(s, E, ws, { prompt: PROMPTS[kind], tools: ["Read", "Edit"], allowedTools: ["Read", "Edit"], mode: "acceptEdits", maxTurns: 6, max_tokens: 1500 });
  const seen = r.text.includes(TOKEN);
  s.log(`  -> reply ${seen ? "STARTS WITH " + TOKEN : "has no token"}: the guidance ${seen ? "reached" : "did not reach"} Claude for this edit`, seen ? "reply" : "note");
  return { r, seen, after: ws.fs[TARGET[kind]] };
}

export default {
  id: 15,
  see: "Variant D's one rule file (paths: **/*.test.ts) loads when Claude reads orchestrator.test.ts, so that reply opens with TESTING-GUIDANCE-LOADED; the renderer.ts edit gets no token. Variant A, the same file without frontmatter, puts the token on the renderer.ts edit too.",
  try: "Change variant D's glob to \"orchestration/**\" in your head: which of the two edits would now carry the token, and why is that the wrong scope for tests spread across every folder?",
  slide: {
    title: "One rule file, scoped by paths, reaches every test",
    code: `.claude/rules/testing.md                 # KEY 1
---
paths: ["**/*.test.ts"]                  # KEY 2
---
# Testing guidance
- Tests sit beside the implementation.
- Never weaken an existing assertion.

# no frontmatter = loads for every file  # KEY 3
# CLAUDE.md per folder = 3 copies drift  # KEY 4`,
    keys: [["1", "Topic rules live here", "Separate from broad CLAUDE.md memory."],
           ["2", "A glob crosses folders", "Matches tests wherever they sit."],
           ["3", "The file name scopes nothing", "Without paths it loads always."],
           ["4", "Copies drift", "One rule file replaces three CLAUDE.md."]],
  },
  async run(s, E) {
    s.log("== The repo: tests beside their code in three top-level folders", "note");
    for (const p of Object.keys(SIM3_RULES_FILES)) s.log(`  ${p}`, "result");
    s.log("== Where the guidance goes, and what Claude Code would load (context assembly, no Claude call)", "note");
    const where = { A: ".claude/rules/testing.md, no frontmatter", B: "root CLAUDE.md", C: "CLAUDE.md in every folder", D: ".claude/rules/testing.md + paths" };
    s.log("  variant | guidance placed in                        | copies | test edit | impl edit", "result");
    for (const v of "ABCD") { const f = variant(v);
      s.log(`     ${v}    | ${where[v].padEnd(41)} |   ${copies(f)}    |   ${reaches(f, TARGET.test) ? "loads" : "  -  "}   |   ${reaches(f, TARGET.impl) ? "loads" : "  -  "}`, "result"); }
    showFile(s, ".claude/rules/testing.md (variant D)", variant("D")[".claude/rules/testing.md"], 4);

    s.log("== The tempting design, live: variant A (rule file, no paths frontmatter)", "note");
    const aImpl = await edit(s, E, "A", "impl");
    s.log("== The right design, live: variant D (paths: [\"**/*.test.ts\"])", "note");
    const dTest = await edit(s, E, "D", "test");
    const dImpl = await edit(s, E, "D", "impl");

    const testEdited = dTest.after !== SIM3_RULES_FILES[TARGET.test] && /music/.test(dTest.after);
    const implEdited = /\|\s*Date\s*\|/.test(dImpl.after) && !/Published/.test(dImpl.after);
    return {
      final: `Variant D, test edit:\n${dTest.r.text}\n\nVariant D, implementation edit:\n${dImpl.r.text}\n\nVariant A (no frontmatter), implementation edit:\n${aImpl.r.text}`,
      checks: [
        E.check("Variant D: the rule loaded when Claude touched orchestrator.test.ts, and its reply opens with the token", dTest.seen && dTest.r.pathLoaded.some((e) => e.path === ".claude/rules/testing.md")),
        E.check("Variant D: the renderer.ts edit got no testing guidance (no token)", !dImpl.seen && !dImpl.r.loaded.includes(".claude/rules/testing.md")),
        E.check("Variant D: Claude really made both edits (a 'music' assertion; the header now ends in Date)", testEdited && implEdited),
        E.check("Variant A: without paths the same rule reached the renderer.ts edit too (token present)", aImpl.seen),
      ],
    };
  },
};
