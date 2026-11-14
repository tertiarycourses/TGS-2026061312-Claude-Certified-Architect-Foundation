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
  // The scenario board (assets/scene.js): PR 418 reviewed twice; only the review rules change.
  scene: {
    title: "PR 418: developers mute the reviewer. Is it the bugs or the noise?",
    caption: "Both runs read the same three files with the same findings schema (style and naming allowed). Only the rules in the prompt differ.",
    lanes: [
      { key: "pr", label: "PR 418", sub: "the same input for both runs", stages: [
        { id: "files", icon: "📂", t: "3 changed files", s: "pricing.py · repository.py · totals.py" },
        { id: "bugs", icon: "🐞", t: "3 real bugs inside", s: "None crash · f-string SQL · range(1, …) off-by-one" },
        { id: "schema", icon: "🧾", t: "Same findings schema", s: "8 categories, naming and style included" } ] },
      { key: "A", label: "Run 1 · today's prompt", sub: "broad scope + \"only issues you are highly confident about\"", tone: "trap", on: /^Run 1/, stages: [
        { id: "arules", icon: "🎚", t: "\"Highly confident\" filter", s: "a certainty threshold, no report or skip rules", diff: true },
        { id: "areview", icon: "🤖", t: "CI reviewer", s: "one pass over all three files", claude: true },
        { id: "areal", icon: "🐞", t: "Real bugs caught", s: "None crash · SQL · off-by-one" },
        { id: "anoise", icon: "💬", t: "Naming/style comments", s: "want: 0", out: true } ] },
      { key: "B", label: "Run 2 · explicit criteria", sub: "prompts/review-criteria.txt: report ONLY … / do NOT report …", tone: "fix", on: /^Run 2/, stages: [
        { id: "brules", icon: "📋", t: "Report and skip rules", s: "bug, security, data-loss, contract; never naming", diff: true },
        { id: "breview", icon: "🤖", t: "CI reviewer", s: "one pass over all three files", claude: true },
        { id: "breal", icon: "🐞", t: "Real bugs caught", s: "None crash · SQL · off-by-one" },
        { id: "bnoise", icon: "💬", t: "Naming/style comments", s: "want: 0", out: true } ] },
    ],
  },
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
    s.show("files", `${FILES.length} files, numbered lines`, "done");
    s.show("schema", "all 8 categories allowed", "done");
    // Which of the three planted bugs a run reported (same tests as the checks below, applied to both runs).
    const caught = (fs) => ({
      none: has(fs, "pricing.py", ["bug"], 8, 12, /none|unknown|missing|keyerror|typeerror/i),
      sqli: has(fs, "repository.py", ["security"], 10, 12, /sql|inject|f-string|interpolat/i),
      off: has(fs, "totals.py", ["bug"], 9, 11, /first|skip|range|off-by-one|index 0/i),
    });
    const conf = (fs) => { const c = fs.map((f) => Number(f.confidence)).filter((x) => !isNaN(x)); return c.length ? (Math.min(...c) === Math.max(...c) ? `${Math.min(...c)}` : `${Math.min(...c)}–${Math.max(...c)}`) : "n/a"; };
    const nCaught = (c) => [c.none, c.sqli, c.off].filter(Boolean).length;
    const showRun = (p, r) => {
      const c = caught(r.findings), noise = r.findings.filter(isNoise);
      s.show(`${p}real`, `${nCaught(c)}/3 caught`, nCaught(c) === 3 ? "good" : "bad");
      s.show(`${p}noise`, `${noise.length} of ${r.findings.length} comments${noise.length ? `: ${[...new Set(noise.map((f) => f.category))].join(", ")}` : ""}`, noise.length ? "bad" : "good");
      return { c, noise };
    };

    const vague = await review(s, E, "Run 1 · today's prompt: broad scope + \"Report only issues you are highly confident about.\"", CURRENT);
    s.show("arules", "\"Report only issues you are highly confident about.\"", "done");
    const A = showRun("a", vague);
    const missedA = [!A.c.none && "the None crash", !A.c.sqli && "the f-string SQL", !A.c.off && "the off-by-one"].filter(Boolean);
    await s.pause({
      title: "Run 1 finished: today's prompt with \"highly confident\"",
      outcome: `The reviewer posted **${vague.findings.length} comment${vague.findings.length === 1 ? "" : "s"}**, **${A.noise.length}** of them naming, style or test preferences` +
        `${A.noise.length ? ` (${[...new Set(A.noise.map((f) => f.category))].join(", ")})` : ""}. ` +
        `It caught ${nCaught(A.c)} of the 3 real bugs${missedA.length ? ` and missed ${missedA.join(", ")}` : ""}.` +
        (A.noise.length ? ` Claude rated that noise at confidence ${conf(A.noise)}: being sure is not the same as mattering.` : " This run happened to stay quiet; nothing in the prompt says it must."),
      next: "Run 2: the same files and schema, with explicit report-and-skip criteria",
    });
    const rules = await review(s, E, "Run 2 · explicit report-and-skip criteria (prompts/review-criteria.txt)", CRITERIA);
    s.show("brules", "report ONLY bug/security/data-loss/contract", "done");
    const B = showRun("b", rules);
    s.show("bugs", `run 1 caught ${nCaught(A.c)}/3 · run 2 caught ${nCaught(B.c)}/3`, "done");

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
    const yes = (ok) => ({ v: ok ? "reported" : "missed", tone: ok ? "good" : "bad" });
    const noiseCell = (n, of) => ({ v: `${n} of ${of}`, tone: n ? "bad" : "good" });
    const cats = (fs) => [...new Set(fs.map((f) => f.category))].join(", ") || "none";
    return {
      final,
      compare: {
        cols: [
          { title: "Run 1: broad scope + \"highly confident\"", short: "Today's prompt", tone: "trap",
            verdict: A.noise.length
              ? `Still noisy: ${A.noise.length} of ${vague.findings.length} comments were **${cats(A.noise)}**, posted at confidence ${conf(A.noise)}. It caught ${nCaught(A.c)}/3 real bugs. A confidence filter asks how sure, not whether it matters.`
              : `Quiet this time: no naming or style comments, ${nCaught(A.c)}/3 real bugs. Nothing in the prompt rules the noise out, so the next run may differ.` },
          { title: "Run 2: explicit report-and-skip criteria", short: "Explicit criteria", tone: "fix",
            verdict: !B.noise.length && nCaught(B.c) === 3
              ? `${rules.findings.length} comments, all of them **${cats(rules.findings)}**: the three real bugs and no naming or style noise.`
              : `${rules.findings.length} comments (${cats(rules.findings)}), ${B.noise.length} noise, ${nCaught(B.c)}/3 real bugs. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Comments posted", String(vague.findings.length), String(rules.findings.length)],
          ["Naming, style, test or architecture comments", noiseCell(A.noise.length, vague.findings.length), noiseCell(B.noise.length, rules.findings.length)],
          ["None crash in `getPrice` (pricing.py)", yes(A.c.none), yes(B.c.none)],
          ["f-string SQL in `fetch` (repository.py)", yes(A.c.sqli), yes(B.c.sqli)],
          ["`range(1, …)` off-by-one (totals.py)", yes(A.c.off), yes(B.c.off)],
        ],
        note: "Same three files, same schema, same model. The only change is the rules: a certainty threshold in run 1, named categories to report and to skip in run 2.",
      },
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
