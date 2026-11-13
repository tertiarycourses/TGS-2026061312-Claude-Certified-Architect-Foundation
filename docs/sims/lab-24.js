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

const signatureBreak = (f) => f.file.endsWith("jobs.py") && f.line >= 11 && f.line <= 13 && /warehouse|argument|signature|parameter/i.test(`${f.issue} ${f.detected_pattern}`);

export default {
  id: 24,
  see: "Four focused per-file passes run side by side, each blind to the other files: they catch the f-string SQL and the range(1, …) off-by-one, and the jobs.py pass sees nothing wrong. Only the integration pass finds jobs.py calling get_stock(sku) without the new warehouse argument.",
  try: "Add stock/pricing.py to CHANGES in sims/shared/t4-ci.js (lines 10 and 12), rerun, and check that its None crash shows up in its own per-file pass, not in the integration pass.",
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
    s.log("== Pass 1 · per-file: one focused review per file, run in parallel, each sees only its own file", "note");
    const perFile = await Promise.all(CHANGES.map((c) => perFilePass(s, E, c)));
    for (const p of perFile) {
      s.log(`   ${p.path}: ${p.findings.length} finding(s)`, "note");
      for (const f of p.findings) s.log(`      ${fmt(f)}`, "result");
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

    const final = [
      ...perFile.map((p) => `Per-file ${p.path}: ${p.findings.length ? p.findings.map((f) => `line ${f.line} ${f.severity}/${f.category}: ${f.issue}`).join(" · ") : "no findings"}`),
      `Integration: ${integ.length ? integ.map(fmt).join(" · ") : "no findings"}`,
      `Gate: ${blocking.length} blocking finding(s) -> exit ${exit}`,
    ].join("\n");
    return {
      final,
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
