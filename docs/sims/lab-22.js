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
    const formatRetries = results.filter((r) => r.attempts.length > 1 && r.attempts[0].errors.some((e) => e.kind === "format"));
    const d1 = by["DOC-01"], d3 = by["DOC-03"];
    const accepted = results.filter((r) => r.status === "accept");
    const totalsRight = ["DOC-01", "DOC-02", "DOC-04"].every((id) => by[id].status === "accept" && Math.abs(Number(by[id].ext.stated_total) - LABELS[id].stated_total) < 0.01);
    return {
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
