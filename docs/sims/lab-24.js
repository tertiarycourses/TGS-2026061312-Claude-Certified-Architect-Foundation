// Lab 24 · Task 4.6 · Simulator 5: 14 files, shallow comments: split the review.
// ci_review.py's design, live: one focused per-file pass for each file PR 418 changed (each pass sees ONLY
// its own file, so its attention is not spread across the PR), then one integration pass that reads every
// changed file and reports only cross-file issues. A severity gate turns critical/high findings into exit 1.
import { PR, CHANGES, numbered, changedLines, asJson, CRITERIA, parseFindings, fmt } from "./shared/t4-ci.js";

const SYSTEM = "You are one pass of an automated CI code review. Return your findings as JSON.";

async function perFilePass(s, E, c) {
  const run = await E.runAgent(s, {
    label: `per-file ${c.path}`,
    system: SYSTEM,
    prompt: `CI review of pull request ${PR}, per-file pass for ${c.path}.\n\n### ${c.path}\n${numbered(c.path)}\n\nThe lines changed by this PR are:\n${changedLines(c)}\n\n${CRITERIA}\n\nReview ONLY this one file in isolation; you cannot see any other file, so do not guess about code you cannot see (cross-file issues belong to the integration pass). Set pass to "per-file". Use the line numbers shown. Return an empty findings array when nothing qualifies.`,
    output_config: asJson,
    maxTurns: 1,
  });
  return { path: c.path, findings: parseFindings(run.text)?.findings || [] };
}

async function integrationPass(s, E) {
  const run = await E.runAgent(s, {
    label: "integration",
    system: SYSTEM,
    prompt: `CI review of pull request ${PR}, INTEGRATION pass. Every changed file:\n\n${CHANGES.map((c) => `### ${c.path}\n${numbered(c.path)}\n\nChanged lines:\n${changedLines(c)}`).join("\n\n")}\n\n${CRITERIA}\n\nReport ONLY cross-file issues: a changed signature whose callers were not updated, data flow between modules, shared state. Do not repeat single-file findings (SQL construction, loop bounds, None handling inside one function). Set pass to "integration". Anchor each finding on the caller's file and line.`,
    output_config: asJson,
    maxTurns: 1,
  });
  return parseFindings(run.text)?.findings || [];
}

// The design the question starts from (the trap): ONE review pass over the whole PR, every file at once.
async function singlePass(s, E) {
  const run = await E.runAgent(s, {
    label: "single pass",
    system: SYSTEM,
    prompt: `CI review of pull request ${PR}. Review the whole PR in one pass. Every changed file:\n\n${CHANGES.map((c) => `### ${c.path}\n${numbered(c.path)}\n\nChanged lines:\n${changedLines(c)}`).join("\n\n")}\n\n${CRITERIA}\n\nSet pass to "single". Use the line numbers shown. Return an empty findings array when nothing qualifies.`,
    output_config: asJson,
    maxTurns: 1,
  });
  return parseFindings(run.text)?.findings || [];
}

const signatureBreak = (f) => f.file.endsWith("jobs.py") && f.line >= 11 && f.line <= 13 && /warehouse|argument|signature|parameter/i.test(`${f.issue} ${f.detected_pattern}`);

export default {
  id: 24,
  see: "Four focused per-file passes run side by side, each blind to the other files: they catch the f-string SQL and the range(1, …) off-by-one, and the jobs.py pass sees nothing wrong. Only the integration pass finds jobs.py calling get_stock(sku) without the new warehouse argument.",
  try: "Add stock/pricing.py to CHANGES in sims/shared/t4-ci.js (lines 10 and 12), rerun, and check that its None crash shows up in its own per-file pass, not in the integration pass.",
  // The scenario board (assets/scene.js): PR 418 reviewed as four focused per-file passes, then one
  // integration pass for the seams, then the severity gate. Both passes are part of the design; the pause
  // shows what the per-file passes alone would have shipped.
  scene: {
    title: "PR 418: deep on every file, and one look at the seams between them",
    caption: "Each per-file pass sees one file only. The integration pass reads all four and reports only cross-file issues. The same review criteria and findings schema in every pass.",
    lanes: [
      { key: "pr", label: "PR 418", sub: "4 changed files, 3 planted problems", stages: [
        { id: "repo", icon: "🗃", t: "stock/repository.py", s: "line 11: f-string SQL" },
        { id: "totals", icon: "🧮", t: "stock/totals.py", s: "line 10: range(1, len(items))" },
        { id: "api", icon: "🔌", t: "stock/api.py", s: "get_stock(sku, warehouse): a new argument" },
        { id: "jobs", icon: "⏰", t: "stock/jobs.py", s: "line 12: api.get_stock(sku), not updated" } ] },
      { key: "T", label: "Today: one pass", sub: "the whole PR in a single review", tone: "trap", on: /^Today/, stages: [
        { id: "tscope", icon: "📚", t: "All 4 files at once", s: "one review spreads its attention", diff: true },
        { id: "tclaude", icon: "🤖", t: "Single-pass review", s: "every issue type, every file", claude: true },
        { id: "tbugs", icon: "🐞", t: "The 3 planted problems", s: "SQL · off-by-one · get_stock break", out: true } ] },
      { key: "P1", label: "Pass 1 · per-file", sub: "4 focused reviews in parallel, each blind to the rest", on: /^Pass 1/, stages: [
        { id: "split", icon: "✂", t: "One file per pass", s: "full attention on each file", diff: true },
        { id: "p1claude", icon: "🤖", t: "4 per-file reviews", s: "repository · totals · api · jobs", claude: true },
        { id: "local", icon: "🐞", t: "Single-file bugs", s: "want: SQL and off-by-one", out: true },
        { id: "jobsp", icon: "🙈", t: "The jobs.py pass", s: "cannot see that api.py changed" } ] },
      { key: "P2", label: "Pass 2 · integration", sub: "all four files, cross-file issues only", tone: "fix", on: /^Pass 2/, stages: [
        { id: "scope", icon: "🔭", t: "All 4 files together", s: "signatures, callers, data flow", diff: true },
        { id: "p2claude", icon: "🤖", t: "Integration review", s: "anchored on the caller's file and line", claude: true },
        { id: "seam", icon: "🔗", t: "jobs.py → get_stock", s: "want: the missing warehouse argument", out: true },
        { id: "dups", icon: "♻", t: "No repeats", s: "deduped on (file, line)" } ] },
      { key: "gate", label: "Severity gate", sub: "critical or high fails the build", on: /^Severity gate/, stages: [
        { id: "blocking", icon: "🚦", t: "Critical/high findings", s: "from both passes" },
        { id: "exit", icon: "⛔", t: "CI exit code", s: "want: exit 1, merge blocked", out: true } ] },
    ],
  },
  slide: {
    title: "Per-file passes for depth, one pass for the seams",
    code: `findings = []
for f in changed_files:                        # KEY 1
    findings += review(f, criteria,
                       pass_="per-file")       # sees one file
findings += review(changed_files, criteria,    # KEY 2
                   pass_="integration",
                   only="cross-file issues")   # KEY 3
blocking = [x for x in findings
            if x.severity in ("critical", "high")]
sys.exit(1 if blocking else 0)                 # KEY 4`,
    keys: [["1", "One file per pass", "Full attention on each file; same depth."],
           ["2", "A separate seam pass", "Reads every file for cross-file data flow."],
           ["3", "No repeats", "Integration reports only what spans files."],
           ["4", "A severity gate", "Critical or high findings fail the build."]],
  },
  async run(s, E) {
    s.log(`PR ${PR} changes ${CHANGES.length} files: ${CHANGES.map((c) => c.path).join(", ")}.`, "note");
    s.log("== Today's design (the trap): one single-pass review of the whole PR", "note");
    const single = await singlePass(s, E);
    s.log(`   ${single.length} finding(s)`, "note");
    for (const f of single) s.log(`      ${fmt(f)}`, "result");
    const hit = {
      sql: single.some((f) => f.file.endsWith("repository.py") && f.line >= 10 && f.line <= 12),
      off: single.some((f) => f.file.endsWith("totals.py") && f.line >= 9 && f.line <= 11),
      seam: single.some(signatureBreak),
    };
    const nHit = Object.values(hit).filter(Boolean).length;
    s.show("tscope", `${CHANGES.length} files, ${single.length} finding(s)`, "done");
    s.show("tbugs", `${nHit} of 3: SQL ${hit.sql ? "✓" : "✘"} · off-by-one ${hit.off ? "✓" : "✘"} · get_stock ${hit.seam ? "✓" : "✘"}`, nHit === 3 ? "good" : "bad");
    await s.pause({
      title: "Today's design finished: one pass over the whole PR",
      outcome: `The single pass caught **${nHit} of the 3** planted problems (SQL ${hit.sql ? "caught" : "missed"}, off-by-one ${hit.off ? "caught" : "missed"}, get_stock break ${hit.seam ? "caught" : "missed"}). ` +
        (nHit === 3 ? "On a 4-file PR one pass can cope; at 14 files its attention spreads thin and the misses start. Nothing in this design gives each file full attention." : "One review holding every file at once spread its attention thin."),
      next: "Pass 1: split the review, one focused pass per file",
    });
    s.log("== Pass 1 · per-file: one focused review per file, run in parallel, each sees only its own file", "note");
    const perFile = await Promise.all(CHANGES.map((c) => perFilePass(s, E, c)));
    for (const p of perFile) {
      s.log(`   ${p.path}: ${p.findings.length} finding(s)`, "note");
      for (const f of p.findings) s.log(`      ${fmt(f)}`, "result");
    }
    {
      const fs = perFile.flatMap((p) => p.findings);
      const sq = fs.some((f) => f.file.endsWith("repository.py") && f.category === "security" && f.line >= 10 && f.line <= 12);
      const ob = fs.some((f) => f.file.endsWith("totals.py") && f.category === "bug" && f.line >= 9 && f.line <= 11);
      const jl = perFile.find((p) => p.path === "stock/jobs.py").findings;
      s.show("split", perFile.map((p) => `${p.path.split("/")[1]}: ${p.findings.length}`).join(" · "), "done");
      s.show("local", `SQL ${sq ? "✓" : "✘"} · off-by-one ${ob ? "✓" : "✘"}`, sq && ob ? "good" : "bad");
      s.show("jobsp", jl.some(signatureBreak) ? "flagged get_stock (a guess: it cannot see api.py)" : `${jl.length} finding(s); get_stock(sku) not flagged`, jl.some(signatureBreak) ? "done" : "bad");
      s.show("repo", sq ? "SQL caught in its own pass" : "SQL missed", "done");
      s.show("totals", ob ? "off-by-one caught in its own pass" : "off-by-one missed", "done");
      await s.pause({
        title: "Pass 1 finished: four per-file passes",
        outcome: `The per-file passes posted **${fs.length} finding${fs.length === 1 ? "" : "s"}**: the f-string SQL ${sq ? "**caught**" : "**missed**"}, the off-by-one ${ob ? "**caught**" : "**missed**"}. ` +
          (jl.some(signatureBreak) ? "The jobs.py pass flagged the get_stock call this time, though it cannot see api.py: a guess, not a finding." : "The jobs.py pass saw nothing wrong with `api.get_stock(sku)`: it cannot see that api.py now needs `warehouse`. Ship now and the nightly job breaks."),
        next: "Pass 2: one integration pass over all four files, cross-file issues only",
      });
    }
    s.log("== Pass 2 · integration: all four files together, cross-file issues only", "note");
    const integ = await integrationPass(s, E);
    s.log(`   ${integ.length} cross-file finding(s)`, "note");
    for (const f of integ) s.log(`      ${fmt(f)}`, "result");

    const local = perFile.flatMap((p) => p.findings);
    const all = [...local, ...integ];
    const blocking = all.filter((f) => ["critical", "high"].includes(f.severity));
    const exit = blocking.length ? 1 : 0;
    s.log(`== Severity gate: ${blocking.length} blocking finding(s) -> exit ${exit}`, "note");

    const jobsLocal = perFile.find((p) => p.path === "stock/jobs.py").findings;
    const sqli = local.some((f) => f.file.endsWith("repository.py") && f.category === "security" && f.line >= 10 && f.line <= 12);
    const offByOne = local.some((f) => f.file.endsWith("totals.py") && f.category === "bug" && f.line >= 9 && f.line <= 11);
    const localKeys = new Set(local.map((f) => `${f.file}:${f.line}`));      // ci_review.py dedupes on (file, line)
    const repeats = integ.filter((f) => localKeys.has(`${f.file}:${f.line}`));

    const seamFound = integ.some(signatureBreak);
    s.show("scope", "4 files + their changed lines", "done");
    s.show("seam", seamFound ? "found: get_stock(sku) lacks warehouse" : "not found", seamFound ? "good" : "bad");
    s.show("dups", `${repeats.length} repeat(s) of a per-file finding`, repeats.length ? "bad" : "good");
    s.show("jobs", `per-file: ${jobsLocal.some(signatureBreak) ? "flagged" : "missed"} · integration: ${seamFound ? "caught" : "missed"}`, "done");
    s.show("api", "the signature change behind the break", "done");
    s.show("blocking", `${blocking.length}: ${blocking.map((f) => `${f.file.split("/")[1]}:${f.line}`).join(", ") || "none"}`, "done");
    s.show("exit", `exit ${exit}${exit ? ": merge blocked" : ": merge allowed"}`, exit === 1 ? "good" : "bad");
    const mark = (ok, yes, no) => ({ v: ok ? yes : no, tone: ok ? "good" : "bad" });
    const sev = (fs) => fs.filter((f) => ["critical", "high"].includes(f.severity)).length;
    const final = [
      ...perFile.map((p) => `Per-file ${p.path}: ${p.findings.length ? p.findings.map((f) => `line ${f.line} ${f.severity}/${f.category}: ${f.issue}`).join(" · ") : "no findings"}`),
      `Integration: ${integ.length ? integ.map(fmt).join(" · ") : "no findings"}`,
      `Gate: ${blocking.length} blocking finding(s) -> exit ${exit}`,
    ].join("\n");
    return {
      final,
      compare: {
        cols: [
          { title: "Today: one pass over the whole PR", short: "Single pass", tone: "trap",
            verdict: nHit === 3 ? `Caught all 3 on this 4-file PR. At 14 files the same single review spreads thin: the design gives no file guaranteed attention.` : `Caught ${nHit} of 3 (${[!hit.sql && "SQL", !hit.off && "off-by-one", !hit.seam && "get_stock break"].filter(Boolean).join(", ")} missed) with ${single.length} finding(s).` },
          { title: "Pass 1: four per-file passes", short: "Per-file", tone: "",
            verdict: `${local.length} findings. ${sqli && offByOne ? "Caught the f-string SQL and the off-by-one" : `SQL ${sqli ? "caught" : "missed"}, off-by-one ${offByOne ? "caught" : "missed"}`}, each with one file's full attention. ` +
              (jobsLocal.some(signatureBreak) ? "The jobs.py pass flagged get_stock without seeing api.py: a guess." : "Blind to api.py, the jobs.py pass let `get_stock(sku)` through.") },
          { title: "Pass 2: one integration pass", short: "Integration", tone: "fix",
            verdict: seamFound ? `Found the seam: jobs.py calls \`get_stock(sku)\` without the new \`warehouse\` argument${repeats.length ? `, but repeated ${repeats.length} per-file finding(s)` : ", and repeated no per-file finding"}.`
                               : `Missed the get_stock break this run (${integ.length} cross-file finding(s)). Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["What each review sees", "all 4 files at once", "one file", "all 4 changed files"],
          ["f-string SQL (repository.py:11)", mark(hit.sql, "caught", "missed"), mark(sqli, "caught", "missed"), integ.some((f) => f.file.endsWith("repository.py") && f.line >= 10 && f.line <= 12) ? { v: "repeated", tone: "bad" } : "left to per-file"],
          ["`range(1, …)` off-by-one (totals.py:10)", mark(hit.off, "caught", "missed"), mark(offByOne, "caught", "missed"), integ.some((f) => f.file.endsWith("totals.py") && f.line >= 9 && f.line <= 11) ? { v: "repeated", tone: "bad" } : "left to per-file"],
          ["jobs.py calls `get_stock(sku)` without `warehouse`", mark(hit.seam, "caught", "missed"), { v: jobsLocal.some(signatureBreak) ? "flagged (a guess)" : "missed", tone: jobsLocal.some(signatureBreak) ? "" : "bad" }, mark(seamFound, "caught", "missed")],
          ["Findings posted", String(single.length), String(local.length), String(integ.length)],
          ["Critical/high (feed the gate)", String(sev(single)), String(sev(local)), String(sev(integ))],
        ],
        note: `Same criteria and schema in every pass, including today's single pass. What differs is what each pass can see: one file buys depth, all four files expose the seam. Together they gave the gate ${blocking.length} blocking finding(s) -> exit ${exit}.`,
      },
      checks: [
        E.check("The per-file passes caught the f-string SQL in repository.py and the range(1, …) off-by-one in totals.py", sqli && offByOne),
        E.check("The per-file pass on jobs.py, blind to api.py, did not flag the get_stock call", !jobsLocal.some(signatureBreak)),
        E.check("Only the integration pass found jobs.py calling get_stock(sku) without the new warehouse argument", integ.some(signatureBreak)),
        E.check("The integration pass repeated no per-file finding (same file and line)", repeats.length === 0),
        E.check(`The severity gate blocks the merge (${blocking.length} critical/high -> exit 1)`, exit === 1),
      ],
    };
  },
};
