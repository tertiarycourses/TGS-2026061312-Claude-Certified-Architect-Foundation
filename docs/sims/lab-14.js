// Lab 14 · Task 3.2 · Simulator 1: keep a noisy case review out of your main session.
// The /case_review skill from Simulator 1 (case_review.py) reviews one saved support run, a 9.7 KB evidence
// file. The emulator in shared/t3-claudecode.js finds skills the way Claude Code does (a directory holding
// SKILL.md) and honours its frontmatter: context: fork runs the skill as a nested subagent and returns only
// its answer; context: main runs the same instructions inside your conversation.
import { SIM1_CASE_FILES, SIM1_SKILL } from "./shared/t3-workspaces.js";
import { workspace, slash, discoverSkills, autocomplete, showFile, contextText } from "./shared/t3-claudecode.js";

const skillMd = (ctx) => SIM1_SKILL.replace("name: case-review", "name: case_review").replace("context: fork", `context: ${ctx}`);
// A slice from the middle of the evidence file: if it is in a conversation, the file itself is in that context.
const EVIDENCE = SIM1_CASE_FILES["evidence/runs/CS-02.json"];
const MARK = EVIDENCE.slice(4000, 4200);
const size = (msgs) => contextText(msgs).length;

export default {
  id: 14,
  see: "With context: main the 9.7 KB evidence file lands in your conversation; with context: fork a (subagent) reads it and your session receives only the PASS/FAIL summary.",
  try: "Change allowed-tools to just Read and run it again: watch whether the review still Greps cases/ and gets flagged as not pre-approved.",
  slide: {
    title: "context: fork keeps a noisy skill out of your session",
    code: `.claude/skills/case_review/SKILL.md      # KEY 1
---
name: case_review
description: Review one support case run
context: fork                             # KEY 2
allowed-tools: Read, Grep                 # KEY 3
argument-hint: [case-id]                  # KEY 4
---
1. Read evidence/runs/$ARGUMENTS.json
2. Reply in at most 12 lines: PASS or FAIL per check`,
    keys: [["1", "A directory with SKILL.md", "A loose case_review.md is not a skill."],
           ["2", "fork isolates the noise", "Only the summary reaches your session."],
           ["3", "Pre-approved, not a fence", "Reads run without a permission prompt."],
           ["4", "A hint, not a validator", "Autocomplete shows [case-id]."]],
  },
  async run(s, E) {
    s.log("== Option B: a loose .claude/skills/case_review.md", "note");
    const loose = workspace(E, { ".claude/skills/case_review.md": skillMd("fork"), ...SIM1_CASE_FILES });
    s.log(`  [Claude Code] skills found: ${Object.keys(discoverSkills(loose.fs).skills).join(", ") || "none"} · ignored: ${discoverSkills(loose.fs).ignored.join(", ")}`, "note");
    await slash(s, E, loose, "/case_review CS-02");

    s.log("== Option A: .claude/skills/case_review/SKILL.md with context: main", "note");
    const wsMain = workspace(E, { ".claude/skills/case_review/SKILL.md": skillMd("main"), ...SIM1_CASE_FILES });
    const a = await slash(s, E, wsMain, "/case_review CS-02", { maxTurns: 6 });
    const aSize = size(a.mainMessages), aHas = contextText(a.mainMessages).includes(MARK);
    s.log(`  [main session] now holds ${aSize.toLocaleString()} characters; the evidence file is ${aHas ? "IN" : "not in"} your conversation`, aHas ? "deny" : "note");

    s.log("== Option C: .claude/skills/case_review/SKILL.md with context: fork", "note");
    const wsFork = workspace(E, { ".claude/skills/case_review/SKILL.md": skillMd("fork"), ...SIM1_CASE_FILES });
    showFile(s, ".claude/skills/case_review/SKILL.md", wsFork.fs[".claude/skills/case_review/SKILL.md"], 8);
    s.log(`  [autocomplete] ${autocomplete(discoverSkills(wsFork.fs).skills)[0]}`, "note");
    const c = await slash(s, E, wsFork, "/case_review CS-02", { maxTurns: 6 });
    const cSize = size(c.mainMessages), cHas = contextText(c.mainMessages).includes(MARK);
    s.log(`  [main session] now holds ${cSize.toLocaleString()} characters; the evidence file is ${cHas ? "IN" : "not in"} your conversation`, cHas ? "deny" : "note");

    const subReads = c.sub.calls.filter((x) => x.name === "Read").map((x) => String(x.input.path || "").replace(/^\/repo\//, ""));
    const used = [...new Set(c.sub.calls.map((x) => x.name))];
    const verdicts = (c.sub.text.match(/\b(PASS|FAIL|N\/A)\b/g) || []).length;
    return {
      final: `Forked review (what your main session received):\n${c.sub.text}\n\nYour session: ${aSize.toLocaleString()} characters with context: main, ${cSize.toLocaleString()} with context: fork.`,
      checks: [
        E.check("With context: fork, the (subagent) read evidence/runs/CS-02.json in its own context", subReads.includes("evidence/runs/CS-02.json")),
        E.check(`context: main put the evidence in your session (${aSize.toLocaleString()} chars); context: fork kept it out (${cSize.toLocaleString()} chars)`, aHas && !cHas && cSize < aSize),
        E.check(`The forked review came back as a short PASS/FAIL summary (${verdicts} verdicts)`, verdicts >= 3 && c.sub.text.split("\n").length <= 20),
        E.check(`Every tool the forked review used (${used.join(", ")}) was pre-approved by allowed-tools`, used.length > 0 && c.sub.notPreApproved.length === 0),
      ],
    };
  },
};
