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
  // The scenario board (assets/scene.js): /case_review CS-02 three ways. A loose .md is not found at all;
  // a real SKILL.md with context: main floods your session; context: fork returns only the summary.
  scene: {
    title: "/case_review CS-02: a 9.7 KB evidence file, and where it ends up",
    caption: "The same review instructions three times. What changes is where the skill file sits and its context: line, and with them whether the evidence file lands in your conversation.",
    lanes: [
      { key: "B", label: "Option B: loose case_review.md", sub: "context: fork, but not in a skill directory", tone: "trap", on: /Option B/, stages: [
        { id: "bfile", icon: "📄", t: ".claude/skills/case_review.md", s: "a loose .md file, no <name>/SKILL.md", diff: true },
        { id: "btype", icon: "⌨️", t: "/case_review CS-02", s: "you type the command" },
        { id: "bout", icon: "🔎", t: "Skill found?", s: "want: Claude Code runs the review", out: true } ] },
      { key: "A", label: "Option A: SKILL.md, context: main", sub: "a real skill, run inside your conversation", tone: "trap", on: /Option A/, stages: [
        { id: "afile", icon: "📁", t: "case_review/SKILL.md", s: "allowed-tools: Read, Grep · [case-id]" },
        { id: "actx", icon: "🧵", t: "context: main", s: "the skill runs in your conversation", diff: true },
        { id: "aread", icon: "📖", t: "Review reads CS-02.json", s: "9.7 KB of evidence, plus the case file", tools: ["Read", "Grep", "Glob"], claude: true },
        { id: "aout", icon: "💬", t: "Your main session", s: "want: the summary, not the evidence", out: true } ] },
      { key: "C", label: "Option C: SKILL.md, context: fork", sub: "the same skill, in a forked subagent", tone: "fix", on: /Option C/, stages: [
        { id: "cfile", icon: "📁", t: "case_review/SKILL.md", s: "allowed-tools: Read, Grep · [case-id]" },
        { id: "cctx", icon: "🍴", t: "context: fork", s: "a fresh (subagent) context runs the skill", diff: true },
        { id: "csub", icon: "🤖", t: "(subagent) reviews CS-02", s: "reads the 9.7 KB evidence in its own context", tools: ["Read", "Grep", "Glob"], claude: /subagent/ },
        { id: "cmain", icon: "↩️", t: "Only the answer returns", s: "your session gets the PASS/FAIL summary", claude: true },
        { id: "cout", icon: "💬", t: "Your main session", s: "want: the summary, not the evidence", out: true } ] },
    ],
  },
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
    const bFound = discoverSkills(loose.fs);
    const b = await slash(s, E, loose, "/case_review CS-02");
    s.show("bfile", `ignored: ${bFound.ignored.join(", ") || "none"}`, "done");
    s.show("btype", "typed /case_review CS-02", "done");
    s.show("bout", b.unknown ? "Unknown skill: /case_review" : `found, ran with context: ${b.ctx}`, b.unknown ? "bad" : "good");
    await s.pause({
      title: "Option B finished: a loose .claude/skills/case_review.md",
      outcome: b.unknown ? `Claude Code found **no skill**: \`/case_review\` was an unknown command, so no review ran at all. It ignored \`${bFound.ignored.join(", ")}\` because a skill is a directory holding SKILL.md.`
                         : `Claude Code ran the loose file as a skill (context: ${b.ctx}).`,
      next: "Option A: a real skill directory, case_review/SKILL.md, with context: main",
    });

    s.log("== Option A: .claude/skills/case_review/SKILL.md with context: main", "note");
    const wsMain = workspace(E, { ".claude/skills/case_review/SKILL.md": skillMd("main"), ...SIM1_CASE_FILES });
    const a = await slash(s, E, wsMain, "/case_review CS-02", { maxTurns: 6 });
    const aSize = size(a.mainMessages), aHas = contextText(a.mainMessages).includes(MARK);
    s.log(`  [main session] now holds ${aSize.toLocaleString()} characters; the evidence file is ${aHas ? "IN" : "not in"} your conversation`, aHas ? "deny" : "note");
    s.show("afile", "found: /case_review [case-id]", "done");
    s.show("actx", "ran in your conversation", "done");
    s.show("aout", `${aSize.toLocaleString()} chars · evidence ${aHas ? "IN your session" : "not in it"}`, aHas ? "bad" : "good");
    await s.pause({
      title: "Option A finished: SKILL.md with context: main",
      outcome: `The review ran in ${a.main.turns} turn${a.main.turns === 1 ? "" : "s"}, inside your conversation: your session now holds **${aSize.toLocaleString()} characters**, and the 9.7 KB evidence file is ${aHas ? "**in it**, where every later message has to carry it" : "not in it verbatim this time, but nothing kept it out"}.`,
      next: "Option C: the same SKILL.md with context: fork",
    });

    s.log("== Option C: .claude/skills/case_review/SKILL.md with context: fork", "note");
    const wsFork = workspace(E, { ".claude/skills/case_review/SKILL.md": skillMd("fork"), ...SIM1_CASE_FILES });
    showFile(s, ".claude/skills/case_review/SKILL.md", wsFork.fs[".claude/skills/case_review/SKILL.md"], 8);
    s.log(`  [autocomplete] ${autocomplete(discoverSkills(wsFork.fs).skills)[0]}`, "note");
    const c = await slash(s, E, wsFork, "/case_review CS-02", { maxTurns: 6 });
    const cSize = size(c.mainMessages), cHas = contextText(c.mainMessages).includes(MARK);
    s.log(`  [main session] now holds ${cSize.toLocaleString()} characters; the evidence file is ${cHas ? "IN" : "not in"} your conversation`, cHas ? "deny" : "note");
    s.show("cfile", "found: /case_review [case-id]", "done");
    s.show("cctx", "ran in a (subagent) context", "done");
    s.show("cmain", E.short(c.main.text, 70), "done");
    s.show("cout", `${cSize.toLocaleString()} chars · evidence ${cHas ? "IN your session" : "kept out"}`, !cHas && cSize < aSize ? "good" : "bad");

    const subReads = c.sub.calls.filter((x) => x.name === "Read").map((x) => String(x.input.path || "").replace(/^\/repo\//, ""));
    const used = [...new Set(c.sub.calls.map((x) => x.name))];
    const verdicts = (c.sub.text.match(/\b(PASS|FAIL|N\/A)\b/g) || []).length;
    const aUsed = [...new Set(a.main.calls.map((x) => x.name))];
    const yes = (ok, goodWhen = true) => ({ v: ok ? "yes" : "no", tone: ok === goodWhen ? "good" : "bad" });
    return {
      compare: {
        cols: [
          { title: "Option B: loose case_review.md", short: "B: loose .md", tone: "trap",
            verdict: b.unknown ? "Not a skill. Claude Code only discovers `.claude/skills/<name>/SKILL.md`, so `/case_review` was an unknown command and **no review ran**." : `Ran as a skill (context: ${b.ctx}), which Claude Code should not do for a loose file.` },
          { title: "Option A: SKILL.md, context: main", short: "A: context: main", tone: "trap", said: a.main.text,
            verdict: aHas ? `The review ran, but **in your session**: the evidence file now sits in your conversation (${aSize.toLocaleString()} chars).` : `The review ran in your session (${aSize.toLocaleString()} chars). The evidence text did not land verbatim this time, but context: main did nothing to keep it out.` },
          { title: "Option C: SKILL.md, context: fork", short: "C: context: fork", tone: "fix", said: c.sub.text,
            verdict: !cHas && cSize < aSize ? `The (subagent) read the evidence in its own context; **only its summary** reached your session (${cSize.toLocaleString()} chars, ${Math.round(100 - (100 * cSize) / aSize)}% smaller than A).` : `Your session holds ${cSize.toLocaleString()} chars and the evidence is ${cHas ? "in it" : "not in it"}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Skill file", "`.claude/skills/case_review.md`", "`case_review/SKILL.md`", "`case_review/SKILL.md`"],
          ["Claude Code found the skill", yes(!b.unknown), yes(true), yes(true)],
          ["Where the review ran", { v: "nowhere", tone: "bad" }, "your main conversation", { v: "a forked (subagent) context", tone: "good" }],
          ["Evidence file in your session", "no: nothing ran", yes(aHas, false), yes(cHas, false)],
          ["Your session size", "n/a", { v: `${aSize.toLocaleString()} chars`, tone: aSize > cSize ? "bad" : "" }, { v: `${cSize.toLocaleString()} chars`, tone: cSize < aSize ? "good" : "bad" }],
          ["Tools used, not pre-approved", "n/a", `${aUsed.join(", ") || "none"} · ${a.main.notPreApproved.length} not pre-approved`, `${used.join(", ") || "none"} · ${c.sub.notPreApproved.length} not pre-approved`],
        ],
        note: "B fails on where the file sits; A and C share the same SKILL.md and differ only in the `context:` line. That one line decides whether the 9.7 KB evidence file lives in your conversation or in a throwaway subagent context.",
      },
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
