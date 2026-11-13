// Lab 19 · Task 4.1 · Simulator 5: "only high confidence" didn't quiet the reviewer.
// Two real reviews of the same three files changed in PR 418, with the same output schema (all eight
// categories allowed, style and naming included). Only the review rules change:
//   1. the noisy reviewer as the stem describes it: a broad review scope, filtered by
//      "Report only issues you are highly confident about."
//   2. explicit, categorical report and skip rules (prompts/review-criteria.txt).
import { PR, numbered, asJson, CRITERIA, isNoise, parseFindings, fmt } from "./shared/t4-ci.js";

const FILES = ["stock/pricing.py", "stock/repository.py", "stock/totals.py"];
// The reviewer the team has today: a broad scope, and a confidence filter meant to quiet it.
const CURRENT = `Review for correctness, security, readability, naming, test coverage and maintainability.
Report only issues you are highly confident about.`;

async function review(s, E, label, rules) {
  s.log(`== ${label}`, "note");
  const run = await E.runAgent(s, {
    system: "You are the automated pull request reviewer in CI. Return your findings as JSON.",
    prompt: `Review the files changed in PR ${PR}.\n\n${FILES.map((f) => `### ${f}\n${numbered(f)}`).join("\n\n")}\n\n${rules}\n\nSet pass to "per-file". Return an empty findings array when nothing qualifies.`,
    output_config: asJson,
    maxTurns: 1,
  });
  const out = parseFindings(run.text);
  const findings = out?.findings || [];
  s.log(`   ${findings.length} comment(s) posted:`, "note");
  for (const f of findings) s.log(`   ${isNoise(f) ? "noise" : "keep "}  ${fmt(f)}`, isNoise(f) ? "error" : "result");
  return { out, findings };
}

const has = (fs, file, cats, lo, hi, re) => fs.some((f) => f.file.endsWith(file) && cats.includes(f.category) && f.line >= lo && f.line <= hi && re.test(`${f.issue} ${f.detected_pattern}`));

export default {
  id: 19,
  see: "Same three files, same schema, two prompts. The broad scope filtered by \"highly confident\" still posts naming and unused-import comments; the explicit report-and-skip rules keep the three real bugs and drop every naming and style comment.",
  try: "Delete the line \"formatting, naming, import order, unused imports\" from the criteria in sims/shared/t4-ci.js, rerun, and watch the naming comments come back.",
  slide: {
    title: "Define what to report, not how sure to be",
    code: `vague = "...Report only issues you are highly confident."
rules = """Report ONLY:                              # KEY 1
- bug: crashes on input the caller can pass
- security: untrusted input reaches SQL or shell
Do NOT report:                                 # KEY 2
- formatting, naming, import order
- missing tests
Severity: medium = None not handled            # KEY 3
"""
for prompt in (vague, rules):                  # KEY 4
    review(pr_418_files, prompt, schema)`,
    keys: [["1", "Testable report rules", "Bugs, security, data loss, broken contracts."],
           ["2", "Explicit skip rules", "Naming and style are named and excluded."],
           ["3", "Severity by example", "Each level anchored on a concrete case."],
           ["4", "Same files, same schema", "Only the prompt changes between the runs."]],
  },
  async run(s, E) {
    s.log(`PR ${PR}: developers say the reviewer is noisy. Two reviews of ${FILES.join(", ")}: same schema (style and naming allowed), different rules.`, "note");
    const vague = await review(s, E, "Run 1 · today's prompt: broad scope + \"Report only issues you are highly confident about.\"", CURRENT);
    const rules = await review(s, E, "Run 2 · explicit report-and-skip criteria (prompts/review-criteria.txt)", CRITERIA);

    const vagueNoise = vague.findings.filter(isNoise);
    const R = rules.findings;
    const noneBug = has(R, "pricing.py", ["bug"], 8, 12, /none|unknown|missing|keyerror|typeerror/i);
    const sqli = has(R, "repository.py", ["security"], 10, 12, /sql|inject|f-string|interpolat/i);
    const offByOne = has(R, "totals.py", ["bug"], 9, 11, /first|skip|range|off-by-one|index 0/i);
    s.log(`== Result: today's prompt ${vague.findings.length} comment(s), ${vagueNoise.length} on naming/style/tests · criteria ${R.length} comment(s), ${R.filter(isNoise).length} noise`, "note");

    const final = [
      `Today's prompt: ${vague.findings.length} comment(s), ${vagueNoise.length} of them naming, style or test preferences.`,
      ...vague.findings.map((f) => `  - ${fmt(f)}`),
      ``,
      `Explicit criteria: ${R.length} comment(s).`,
      ...R.map((f) => `  - ${fmt(f)}`),
    ].join("\n");
    return {
      final,
      checks: [
        E.check(`"Highly confident" still posted naming/style comments (${vagueNoise.length} of ${vague.findings.length})`, vagueNoise.length > 0),
        E.check("With explicit criteria, no naming, style, test-coverage or architecture comment appears", !!rules.out && !R.some(isNoise)),
        E.check("With explicit criteria, the None crash in getPrice is reported as a bug", noneBug),
        E.check("With explicit criteria, the f-string SQL (security) and the range(1, …) off-by-one (bug) are reported", sqli && offByOne),
        E.check(`The criteria posted fewer comments than today's prompt (${R.length} vs ${vague.findings.length})`, R.length < vague.findings.length),
      ],
    };
  },
};
