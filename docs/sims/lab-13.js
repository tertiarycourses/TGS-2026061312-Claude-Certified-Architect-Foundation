// Lab 13 · Task 3.1 · Simulator 2 (Case Study): which instructions actually reached Claude?
// The Orderly workspace from Simulator 2: a project CLAUDE.md that @imports two standards, four path-scoped
// rules in .claude/rules/, plus one developer's personal ~/.claude/CLAUDE.md. The emulator in
// shared/t3-claudecode.js assembles Claude's context the way Claude Code does: CLAUDE.md files and their
// imports at startup, a rule only when Claude reads a file its paths: globs match. Then we ask Claude.
import { SIM2_WORKSPACE } from "./shared/t3-workspaces.js";
import { workspace, session, startupMemory, pathMemory, frontmatter, showFile } from "./shared/t3-claudecode.js";

const USER_MD = "# My preferences (only on my laptop)\n- Keep replies short.\n";
const STANDARD = "Every bug fix ships with a regression test that fails before the fix.";
const FILES = ["src/components/Button.test.tsx", "src/api/orders.js"];
const names = (t) => [...new Set((t.match(/[\w-]+\.md/g) || []).map((x) => x.toLowerCase()))].sort();
const base = (p) => p.split("/").pop();

export default {
  id: 13,
  see: "Claude quotes the testing standard that reached it through CLAUDE.md's @import, then names tests.md and react-components.md for Button.test.tsx but only api-handlers.md for orders.js: the rules that loaded by path.",
  try: "Add `src/api/**/*.test.*` to the paths in tests.md (in your head or a copy of the workspace) and predict which rules a Read of src/api/orders.test.js would load before you check.",
  slide: {
    title: "Shared rules in git, area rules by path, then ask",
    code: `# CLAUDE.md  (project: in git, reaches everyone)  # KEY 1
@docs/standards/testing.md                        # KEY 2
@docs/standards/review-criteria.md

# .claude/rules/tests.md
---
paths: ["**/*.test.*"]                            # KEY 3
---
Name tests it("<verb> <outcome> when <condition>")

> Read src/components/Button.test.tsx. Which      # KEY 4
  .claude/rules/ files are loaded now?`,
    keys: [["1", "Project file, shared by git", "~/.claude/CLAUDE.md reaches only you."],
           ["2", "@import keeps it modular", "Standards live in their own files."],
           ["3", "paths: loads by file", "Test rules load only for test files."],
           ["4", "Ask what loaded", "Claude names the rules in its context."]],
  },
  async run(s, E) {
    const files = { "~/.claude/CLAUDE.md": USER_MD, ...SIM2_WORKSPACE };
    s.log("== The configuration in play (Simulator 2 workspace)", "note");
    showFile(s, "CLAUDE.md", files["CLAUDE.md"], 9);
    for (const p of Object.keys(files).filter((p) => p.startsWith(".claude/rules/")))
      s.log(`  ${p.padEnd(34)} paths: ${frontmatter(files[p]).meta.paths.join(", ")}`, "result");
    s.log("  ~/.claude/CLAUDE.md                user level: this laptop only, never in git", "result");

    s.log("== Session 1: what loaded at startup, and the standard Claude follows", "note");
    const q = await session(s, E, workspace(E, files), {
      prompt: "Quote, word for word and nothing else, the first bullet under 'Testing standards' in your project instructions. Then on a second line write SOURCE: followed by the path of the file that bullet came from.",
      tools: [], maxTurns: 1, max_tokens: 200,
    });
    const quoteLine = (q.text.split("\n").find((l) => l.trim() && !/^SOURCE:/i.test(l.trim())) || "").replace(/^[\s>*"'`-]+|["'`\s]+$/g, "");
    const source = (/SOURCE:\s*(.+)/i.exec(q.text) || [])[1] || "";

    const per = {};
    for (const f of FILES) {
      s.log(`== Session for ${f}: Claude reads it, then names the rules in its context`, "note");
      const r = await session(s, E, workspace(E, files), {
        prompt: `Read ${f}. Then answer with ONLY a comma-separated list of the rule file names (for example tests.md) from .claude/rules/ that are now loaded in your context because of that file. No other words.`,
        tools: ["Read"], maxTurns: 3, max_tokens: 200, echoMemory: false,
      });
      const expected = pathMemory(files, f, new Set(startupMemory(files).map((e) => e.path))).filter((e) => e.kind === "rule").map((e) => base(e.path)).sort();
      per[f] = { said: names(r.text), expected, read: r.reads.includes(f), loaded: r.pathLoaded.map((e) => e.path) };
    }

    const start = startupMemory(files).map((e) => `${e.path}${e.kind === "user" ? " (user)" : e.why ? " (@import)" : " (project)"}`);
    s.log("== What reached Claude, file by file", "note");
    s.log(`TESTING STANDARD CLAUDE FOLLOWED: "${quoteLine}"`, "reply");
    s.log(`  came from: ${source.trim() || "(no source given)"}, pulled in by the @import in CLAUDE.md`, "reply");
    for (const f of FILES) {
      s.log(`FILE ${f}`, "reply");
      s.log(`  CLAUDE.md files loaded at startup: ${start.join(", ")}`, "reply");
      s.log(`  rules loaded by path:              ${per[f].loaded.join(", ") || "none"}`, "reply");
      s.log(`  Claude says it has loaded:         ${per[f].said.join(", ") || "(nothing named)"}`, "reply");
    }

    const final = [`Testing standard Claude quoted: "${quoteLine}" (source: ${source.trim()}, @imported by CLAUDE.md).`, "",
      ...FILES.map((f) => `${f}: always-loaded ${start.join(", ")}; rules loaded by path: ${per[f].loaded.join(", ") || "none"}. Claude named: ${per[f].said.join(", ") || "nothing"}.`)].join("\n");
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    const [t, a] = FILES.map((f) => per[f]);
    return {
      final,
      checks: [
        E.check(`Claude quoted the @imported testing standard word for word ("${STANDARD.slice(0, 40)}…")`, quoteLine.replace(/\s+/g, " ").trim() === STANDARD),
        E.check("Claude traced that standard to docs/standards/testing.md, the file CLAUDE.md @imports", /docs\/standards\/testing\.md/.test(source)),
        E.check(`For ${FILES[0]} Claude named exactly the rules its path loaded: ${t.expected.join(", ")}`, t.read && same(t.said, t.expected)),
        E.check(`For ${FILES[1]} Claude named only ${a.expected.join(", ")}: no test or React rules`, a.read && same(a.said, a.expected)),
      ],
    };
  },
};
