// Lab 22 · Task 4.4 · Simulator 6 · Case Study: retry when the format is wrong, stop when the data is absent.
// extract.py's loop, live. Each document goes to Claude with a forced extract_invoice tool call (strict: true).
// The validator then checks what the schema cannot: ISO dates, that every amount is really printed in the
// document (Claude copies each one into an *_text field), and that the line items add up to the total.
//   format or grounding error  -> retry, resending the document, the failed extraction and the exact error
//   totals disagree, but every amount is printed in the document -> the conflict is in the SOURCE:
//                                 no retry, keep both totals, route to a human
// Part 1 first runs the tempting design on DOC-03: "retry until it validates".
import { DOCS, LABELS, EXTRACT_TOOL, validate, retryDecision, userContent, lastToolInput } from "./shared/t4-extract.js";

const SYSTEM = "You are an accounts-payable extraction service. You read one financial document at a time and record it with the extract_invoice tool.";
const MAX_RETRIES = 2;
const tools = { extract_invoice: { ...EXTRACT_TOOL.extract_invoice, run: () => "Recorded. The pipeline validates it next." } };
const money = (x) => Number(x).toFixed(2);
const errLine = (e) => `${e.field}: ${e.message} [${e.kind}]`;

// One document through the loop. policy(v) decides accept / retry / human_review after each attempt.
async function extractDoc(s, E, id, policy) {
  const text = DOCS[id].text;
  let failed = null, errors = [], last = null;
  const attempts = [];
  for (let a = 1; a <= MAX_RETRIES + 1; a++) {
    const run = await E.runAgent(s, {
      label: `${id} attempt ${a}`, system: SYSTEM, prompt: userContent(text, failed, errors), tools,
      tool_choice: { type: "tool", name: "extract_invoice", disable_parallel_tool_use: true }, maxTurns: 1,
    });
    const ext = lastToolInput(run, "extract_invoice");
    if (!ext) { attempts.push({ a, errors: [{ kind: "call", field: "root", message: "no tool_use block" }] }); break; }
    const v = validate(ext, text);
    last = { ext, v };
    const d = policy(v);
    attempts.push({ a, errors: v.errors, decision: d });
    s.log(`    ${id} attempt ${a}: ${v.errors.length ? v.errors.map(errLine).join("; ") : "valid"} -> ${d.action.toUpperCase()}${d.why ? ` (${d.why})` : ""}`, v.errors.length ? "error" : "result");
    if (d.action !== "retry") return { id, status: d.action, attempts, ...last };
    failed = ext; errors = v.errors.filter((e) => d.send ? d.send.includes(e.kind) : true);
  }
  return { id, status: "human_review", exhausted: true, attempts, ...(last || {}) };
}

export default {
  id: 22,
  see: "Part 1: \"retry until it validates\" on DOC-03 either invents an amount the receipt never prints or keeps failing. Part 2, one line per document: DOC-01's DD/MM dates fail format validation and one retry with the exact error fixes them; DOC-03's totals (line items 35.00, printed 38.00) conflict in the receipt itself, so it is not retried and goes to human review with both totals kept.",
  try: "Change DOC-03's printed total to 35.00 in sims/shared/t4-extract.js and rerun: the conflict disappears and DOC-03 is auto-accepted on the first attempt.",
  // The scenario board (assets/scene.js): extract.py's retry loop, first as "retry until it validates", then
  // as "retry what a retry can fix, route what the source cannot answer".
  scene: {
    title: "extract.py: when is a retry worth it, and when is the answer not in the document?",
    caption: "Both designs force the same extract_invoice tool (strict: true) and cap retries at 2. They differ in what the validator checks and in what a failure triggers.",
    lanes: [
      { key: "docs", label: "The documents", sub: "real gaps, planted on purpose", stages: [
        { id: "d03", icon: "🧾", t: "DOC-03 receipt R-7781", s: "Day pass 35.00 · Amount paid 38.00 (incl. 9% GST)" },
        { id: "d01", icon: "📅", t: "DOC-01 invoice INV-2041", s: "dates printed DD/MM: 03/10/2026, 02/11/2026" },
        { id: "d24", icon: "📄", t: "DOC-02 · DOC-04", s: "invoices that should pass first time: 279, 456" } ] },
      { key: "A", label: "Part 1 · retry until it validates", sub: "DOC-03 only; any failed check means try again", tone: "trap", on: /^Part 1/, stages: [
        { id: "aext", icon: "🤖", t: "extract_invoice (forced)", s: "the receipt, then the failed record + error", claude: true },
        { id: "achk", icon: "🧮", t: "Arithmetic check only", s: "line items vs total; no grounding check", diff: true },
        { id: "aretry", icon: "🔁", t: "Retry on any failure", s: "up to 2 retries, until it \"passes\"" },
        { id: "aout", icon: "📥", t: "DOC-03 outcome", s: "want: both totals, to a human", out: true } ] },
      { key: "B", label: "Part 2 · retry format, route conflicts", sub: "DOC-01..DOC-04 in parallel, retryDecision()", tone: "fix", on: /^Part 2/, stages: [
        { id: "bext", icon: "🤖", t: "extract_invoice × 4", s: "four documents in parallel", claude: true },
        { id: "bval", icon: "🔍", t: "Full validator", s: "ISO dates · every amount printed · sums" },
        { id: "bdec", icon: "🔀", t: "retryDecision()", s: "format → retry · source conflict → human", diff: true },
        { id: "bfix", icon: "📅", t: "DOC-01 date retry", s: "the exact error resent with the document" },
        { id: "bout", icon: "📥", t: "Routing", s: "want: DOC-03 to a human; 3 auto-accepted", out: true } ] },
    ],
  },
  slide: {
    title: "Retry a format error; route a source conflict",
    code: `for attempt in range(1, MAX_RETRIES + 2):      # KEY 1
    ext = claude(doc, failed, errors,
                 tool_choice=extract_invoice)
    errors = validate(ext, doc)                # KEY 2
    if not errors: return accept(ext)
    if all(e.kind == "conflict" for e in errors) \\
       and every_amount_printed(ext, doc):     # KEY 3
        return human_review(ext)       # in the source
    failed = ext                               # KEY 4
return human_review(ext)                       # cap hit`,
    keys: [["1", "A capped retry loop", "Two retries at most, then a human."],
           ["2", "Validate after schema", "ISO dates, grounding, arithmetic."],
           ["3", "Answer not in source?", "Route it to a human; never retry."],
           ["4", "Retry with the evidence", "Document, failed extraction, exact error."]],
  },
  async run(s, E) {
    // ---- Part 1: the tempting design. Retry on ANY failed check, until the record validates.
    s.log("== Part 1 · the tempting design: \"retry DOC-03 until it validates\" (arithmetic check only)", "note");
    const naive = await extractDoc(s, E, "DOC-03", (v) => {
      const blocking = v.errors.filter((e) => e.kind !== "grounding");        // this pipeline only checks format and arithmetic
      return blocking.length ? { action: "retry", send: ["format", "conflict"] } : { action: "accept" };
    });
    const naiveValid = naive.status === "accept";
    const invented = naiveValid && !naive.v.grounded;
    const fake = invented ? naive.v.errors.filter((e) => e.kind === "grounding").map((e) => e.message).join("; ") : "";
    s.log(naiveValid
      ? `   -> DOC-03 "passed" on attempt ${naive.attempts.length}${invented ? `, but ${fake}: the retry made the number up` : ""}`
      : `   -> DOC-03 never validated in ${naive.attempts.length} attempts: no retry can supply what the receipt does not say`, invented ? "error" : "note");
    const sumTxt = (r) => r.v ? `items ${money(r.v.sum)} vs total ${money(r.ext.stated_total)}` : "no record";
    s.show("achk", naive.attempts.map((x) => `#${x.a}: ${x.errors.filter((e) => e.kind !== "grounding").length ? "fail" : "pass"}`).join(" · "), "done");
    s.show("aretry", `${naive.attempts.length - 1} retr${naive.attempts.length - 1 === 1 ? "y" : "ies"} spent`, "done");
    const naiveBad = !naiveValid || invented;
    s.show("aout", naiveValid ? (invented ? `"passed" with ${fake}` : `passed: ${sumTxt(naive)}`) : `never validated in ${naive.attempts.length} attempts`, naiveBad ? "bad" : "good");
    await s.pause({
      title: "Part 1 finished: \"retry DOC-03 until it validates\"",
      outcome: naiveValid
        ? `DOC-03 "passed" on attempt ${naive.attempts.length} (${sumTxt(naive)})${invented ? `, but **${fake}**: the retry made the number up to make the sum work` : ""}.`
        : `DOC-03 never validated: **${naive.attempts.length} attempts, ${naive.attempts.length - 1} retries spent**, and the receipt still says 35.00 and 38.00. No retry can supply what the document does not say.`,
      next: "Part 2: retry only format and grounding errors, and send a conflict that is in the source to a human",
    });

    // ---- Part 2: the right design, four documents in parallel.
    s.log("== Part 2 · validation + retry with error feedback, and stop when the gap is in the source (DOC-01..DOC-04)", "note");
    const ids = ["DOC-01", "DOC-02", "DOC-03", "DOC-04"];
    const results = await Promise.all(ids.map((id) => extractDoc(s, E, id, (v) => retryDecision(v.errors, v.grounded))));

    s.log("== One line per document", "note");
    const lines = results.map((r) => {
      const x = r.ext || {};
      const retried = r.attempts.length - 1;
      const head = `${r.id} ${DOCS[r.id].type.padEnd(7)} attempts=${r.attempts.length}`;
      if (r.status === "accept") return `${head} -> AUTO-ACCEPT  total ${money(x.stated_total)}  issued ${x.issue_date}  due ${x.due_date ?? "none"}${retried ? `  (retry fixed: ${r.attempts[0].errors.map((e) => e.field).join(", ")})` : ""}`;
      return `${head} -> HUMAN REVIEW  line items ${money(r.v.sum)} vs printed total ${money(x.stated_total)}${r.exhausted ? "  (retries exhausted)" : "  (not retried: the conflict is in the source)"}`;
    });
    for (const l of lines) s.log(`   ${l}`, /HUMAN/.test(l) ? "error" : "result");

    const by = Object.fromEntries(results.map((r) => [r.id, r]));
    {
      const nAcc = results.filter((r) => r.status === "accept").length, nHum = results.filter((r) => r.status === "human_review").length;
      const errKinds = [...new Set(results.flatMap((r) => r.attempts.flatMap((x) => x.errors.map((e) => e.kind))))];
      s.show("bval", `${results.reduce((a, r) => a + r.attempts.length, 0)} attempts checked · errors: ${errKinds.join(", ") || "none"}`, "done");
      s.show("bdec", results.map((r) => `${r.id.slice(4)} ${r.status === "accept" ? "accept" : "human"}${r.attempts.length > 1 ? ` (${r.attempts.length - 1} retry)` : ""}`).join(" · "), "done");
      const b1 = by["DOC-01"], b1Fmt = b1.attempts[0].errors.some((e) => e.kind === "format");
      s.show("bfix", b1Fmt ? (b1.status === "accept" ? `retried once -> ${b1.ext.issue_date} / ${b1.ext.due_date}` : "retried, still failing") : (b1.status === "accept" ? `ISO first time: ${b1.ext.issue_date}` : "not accepted"), b1.status === "accept" ? "good" : "bad");
      const d3ok = by["DOC-03"].status === "human_review" && by["DOC-03"].attempts.length === 1;
      s.show("bout", `${nAcc} auto-accepted · ${nHum} to a human${d3ok ? " (DOC-03, attempt 1)" : ""}`, d3ok && nAcc === 3 ? "good" : "bad");
      s.show("d03", `${sumTxt(naive)} in part 1 · ${by["DOC-03"].status === "human_review" ? "human review" : "accepted"} in part 2`, "done");
      s.show("d01", b1Fmt ? "DD/MM caught by the validator" : "Claude wrote ISO dates first time", "done");
      s.show("d24", ["DOC-02", "DOC-04"].map((id) => `${id.slice(4)}: ${by[id].status === "accept" ? money(by[id].ext.stated_total) : "not accepted"}`).join(" · "), "done");
    }
    const formatRetries = results.filter((r) => r.attempts.length > 1 && r.attempts[0].errors.some((e) => e.kind === "format"));
    const d1 = by["DOC-01"], d3 = by["DOC-03"];
    const accepted = results.filter((r) => r.status === "accept");
    const totalsRight = ["DOC-01", "DOC-02", "DOC-04"].every((id) => by[id].status === "accept" && Math.abs(Number(by[id].ext.stated_total) - LABELS[id].stated_total) < 0.01);
    const naiveRetries = naive.attempts.length - 1;
    return {
      compare: {
        cols: [
          { title: "Part 1: retry until it validates", short: "Retry until valid", tone: "trap",
            verdict: naiveValid
              ? (invented ? `DOC-03 "passed" on attempt ${naive.attempts.length}, but only because **${fake}**. A retry under pressure invents the missing number.` : `DOC-03 passed on attempt ${naive.attempts.length} with every amount printed: unusual. Read the live output before trusting it.`)
              : `DOC-03 never validated: ${naive.attempts.length} attempts, ${naiveRetries} retries spent on a gap that is in the receipt itself. It reached a human only when the cap hit (last attempt: ${sumTxt(naive)}).` },
          { title: "Part 2: retry format, route source conflicts", short: "Retry or route", tone: "fix",
            verdict: d3.status === "human_review" && d3.attempts.length === 1
              ? `DOC-03 went to a human on attempt 1 with both totals kept (${money(d3.v.sum)} vs ${money(d3.ext.stated_total)}). ${formatRetries.length ? `Format errors on ${formatRetries.map((r) => r.id).join(" and ")} were retried with the exact error${formatRetries.every((r) => r.status === "accept") ? " and fixed" : ""}.` : "No format retry was needed this run."}`
              : `DOC-03 ended as ${d3.status} after ${d3.attempts.length} attempt(s). Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["Attempts on DOC-03", { v: String(naive.attempts.length), tone: naive.attempts.length > 1 ? "bad" : "" }, { v: String(d3.attempts.length), tone: d3.attempts.length === 1 ? "good" : "bad" }],
          ["DOC-03 outcome", { v: naiveValid ? (invented ? "accepted with an invented amount" : "accepted") : "failed every attempt, then a human when the cap hit", tone: naiveBad ? "bad" : "good" },
                             { v: d3.status === "human_review" ? "human review" : d3.status, tone: d3.status === "human_review" ? "good" : "bad" }],
          ["Amounts not printed in the receipt", { v: invented ? fake : naiveValid ? "none" : "not checked", tone: invented ? "bad" : "" }, { v: d3.v?.grounded ? "none" : "some", tone: d3.v?.grounded ? "good" : "bad" }],
          ["Both totals kept for the reviewer", { v: naiveValid ? "no: one number accepted" : `only after the cap (${sumTxt(naive)})`, tone: "bad" }, { v: d3.v ? `${money(d3.v.sum)} vs ${money(d3.ext.stated_total)}` : "no", tone: d3.status === "human_review" ? "good" : "bad" }],
          ["DOC-01 DD/MM dates", "not run", { v: d1.status === "accept" ? `${d1.ext.issue_date} / ${d1.ext.due_date}${d1.attempts.length > 1 ? " after 1 retry" : ""}` : "not accepted", tone: d1.status === "accept" ? "good" : "bad" }],
          ["Documents auto-accepted", "not run", { v: `${accepted.length}/4`, tone: totalsRight ? "good" : "bad" }],
        ],
        note: "Same tool, same cap of 2 retries. The difference is the decision after a failure: a format or grounding error gets one more try with the exact error; a conflict where every amount is printed in the source goes straight to a human.",
      },
      final: [
        naiveValid ? `Part 1 (retry until valid): DOC-03 passed on attempt ${naive.attempts.length}${invented ? ` with an invented amount (${fake})` : ""}.` : `Part 1 (retry until valid): DOC-03 failed all ${naive.attempts.length} attempts.`,
        "Part 2:", ...lines,
      ].join("\n"),
      checks: [
        E.check(naiveValid ? (invented ? `Retry-until-valid made DOC-03 "pass" with a made-up amount (${fake})` : "Retry-until-valid made DOC-03 pass (no invented amount detected)")
                           : `Retry-until-valid never fixed DOC-03 (${naive.attempts.length} attempts): the missing fact is not in the receipt`, !naiveValid || invented),
        E.check(`A format error was retried with the document, the failed extraction and the exact error, and fixed (${formatRetries.map((r) => r.id).join(", ") || "none fired"})`,
          formatRetries.length > 0 && formatRetries.every((r) => r.status === "accept")),
        E.check(`DOC-01 ends with ISO dates 2026-10-03 / 2026-11-02 (got ${d1.ext?.issue_date} / ${d1.ext?.due_date})`, d1.status === "accept" && d1.ext.issue_date === "2026-10-03" && d1.ext.due_date === "2026-11-02"),
        E.check(`DOC-03 went to human review on attempt 1, not retried, with both totals kept (${money(d3.v?.sum ?? 0)} vs ${money(d3.ext?.stated_total ?? 0)})`,
          d3.status === "human_review" && !d3.exhausted && d3.attempts.length === 1 && Math.abs(d3.v.sum - 35) < 0.01 && Math.abs(Number(d3.ext.stated_total) - 38) < 0.01),
        E.check("DOC-01, DOC-02 and DOC-04 were auto-accepted with the printed totals (160, 279, 456), every amount found in the document", totalsRight && accepted.every((r) => r.v.grounded)),
      ],
    };
  },
};
