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
  // The scenario board (assets/scene.js): which instructions reached Claude in the Orderly repo, session by
  // session. No trap and no fix here: three inspections of one correct setup, so no pause. The side-by-side
  // sets the two file sessions next to each other, because the rules that load by path are the whole point.
  scene: {
    title: "Orderly: which instructions reached Claude, file by file?",
    caption: "Every session starts with the same CLAUDE.md and its @imports. Only the file Claude reads changes, and with it the .claude/rules/ files that load by path.",
    lanes: [
      { key: "start", label: "Every session: startup", sub: "loads before Claude reads any file", stages: [
        { id: "user", icon: "🏠", t: "~/.claude/CLAUDE.md", s: "user level: this laptop only, never in git" },
        { id: "proj", icon: "📘", t: "CLAUDE.md (project, in git)", s: "@docs/standards/testing.md, @…/review-criteria.md" },
        { id: "ask1", icon: "💬", t: "Quote the testing standard", s: "word for word, then SOURCE: <file>", claude: true },
        { id: "quote", icon: "✅", t: "Standard that reached Claude", s: "want: the regression-test bullet, from testing.md", out: true } ] },
      { key: "test", label: "Session: Button.test.tsx", sub: "a React test file", on: /Session for src\/components\//, stages: [
        { id: "tread", icon: "📖", t: "Read Button.test.tsx", s: "the Read triggers path matching", tools: ["Read"] },
        { id: "trules", icon: "📏", t: "Rules loaded by path", s: "**/*.test.* and src/components/**/*.tsx", diff: true },
        { id: "task", icon: "🤖", t: "Claude names its rules", s: "only the rule file names, comma-separated", claude: true },
        { id: "tout", icon: "🎯", t: "Named = loaded?", s: "want: react-components.md, tests.md", out: true } ] },
      { key: "api", label: "Session: orders.js", sub: "an API handler, not a test", on: /Session for src\/api\//, stages: [
        { id: "aread", icon: "📖", t: "Read src/api/orders.js", s: "the Read triggers path matching", tools: ["Read"] },
        { id: "arules", icon: "📏", t: "Rules loaded by path", s: "src/api/**/* only", diff: true },
        { id: "aask", icon: "🤖", t: "Claude names its rules", s: "only the rule file names, comma-separated", claude: true },
        { id: "aout", icon: "🎯", t: "Named = loaded?", s: "want: api-handlers.md, no test or React rules", out: true } ] },
    ],
  },
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
    const startup = startupMemory(files);
    s.show("user", startup.some((e) => e.kind === "user") ? "loaded: reaches only this laptop" : "not loaded", "done");
    s.show("proj", `${startup.length} files at startup · ${startup.filter((e) => e.why && e.kind === "project").length} via @import`, "done");
    s.show("ask1", E.short(quoteLine || q.text, 70), "done");
    const quoted = quoteLine.replace(/\s+/g, " ").trim() === STANDARD && /docs\/standards\/testing\.md/.test(source);
    s.show("quote", quoted ? "quoted word for word · SOURCE: docs/standards/testing.md" : `said: ${E.short(q.text, 70)}`, quoted ? "good" : "bad");

    const per = {};
    for (const f of FILES) {
      s.log(`== Session for ${f}: Claude reads it, then names the rules in its context`, "note");
      const r = await session(s, E, workspace(E, files), {
        prompt: `Read ${f}. Then answer with ONLY a comma-separated list of the rule file names (for example tests.md) from .claude/rules/ that are now loaded in your context because of that file. No other words.`,
        tools: ["Read"], maxTurns: 3, max_tokens: 200, echoMemory: false,
      });
      const expected = pathMemory(files, f, new Set(startupMemory(files).map((e) => e.path))).filter((e) => e.kind === "rule").map((e) => base(e.path)).sort();
      per[f] = { said: names(r.text), expected, read: r.reads.includes(f), loaded: r.pathLoaded.map((e) => e.path), text: r.text, turns: r.turns, stop: r.stop_reason };
      const st = f === FILES[0] ? { rules: "trules", out: "tout" } : { rules: "arules", out: "aout" };
      const ok = per[f].read && per[f].said.join() === expected.join();
      s.show(st.rules, per[f].loaded.map(base).join(", ") || "none", "done");
      s.show(st.out, `named: ${per[f].said.join(", ") || "nothing"}`, ok ? "good" : "bad");
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
    const yes = (ok) => ({ v: ok ? "yes" : "no", tone: ok ? "good" : "bad" });
    const ruleList = (xs) => xs.map((x) => `\`${base(x)}\``).join(", ") || "none";
    const verdict = (f, p) => !p.read ? `Claude never read ${f} (the session ended with stop_reason \`${p.stop}\` before any tool call), so no rule could load by path. Run it again.`
      : same(p.said, p.expected) ? `Reading it loaded ${ruleList(p.loaded)}, and Claude named exactly those.`
      : `Reading it loaded ${ruleList(p.loaded)}, but Claude named ${p.said.join(", ") || "nothing"}. Read the live output: Claude writes each run fresh.`;
    return {
      final,
      compare: {
        cols: [
          { title: `Session: ${FILES[0]}`, short: "Button.test.tsx", tone: "", said: t.text, verdict: verdict(FILES[0], t) },
          { title: `Session: ${FILES[1]}`, short: "orders.js", tone: "", said: a.text, verdict: verdict(FILES[1], a) },
        ],
        rows: [
          ["Loaded at startup (both)", ...Array(2).fill(startup.map((e) => `\`${e.kind === "user" ? e.path : base(e.path)}\``).join(", "))],
          ["Rules loaded by the Read", ruleList(t.loaded), ruleList(a.loaded)],
          ["Rules Claude named", { v: t.said.join(", ") || "nothing", tone: same(t.said, t.expected) ? "good" : "bad" }, { v: a.said.join(", ") || "nothing", tone: same(a.said, a.expected) ? "good" : "bad" }],
          ["tests.md in context", yes(t.loaded.includes(".claude/rules/tests.md")), { v: a.loaded.includes(".claude/rules/tests.md") ? "yes" : "no", tone: a.loaded.includes(".claude/rules/tests.md") ? "bad" : "good" }],
          ["Turns", String(t.turns), String(a.turns)],
        ],
        note: "Same CLAUDE.md, same @imports, same question. The only difference is the file Claude read: its path decided which .claude/rules/ files joined the context.",
      },
      checks: [
        E.check(`Claude quoted the @imported testing standard word for word ("${STANDARD.slice(0, 40)}…")`, quoteLine.replace(/\s+/g, " ").trim() === STANDARD),
        E.check("Claude traced that standard to docs/standards/testing.md, the file CLAUDE.md @imports", /docs\/standards\/testing\.md/.test(source)),
        E.check(`For ${FILES[0]} Claude named exactly the rules its path loaded: ${t.expected.join(", ")}`, t.read && same(t.said, t.expected)),
        E.check(`For ${FILES[1]} Claude named only ${a.expected.join(", ")}: no test or React rules`, a.read && same(a.said, a.expected)),
      ],
    };
  },
};
