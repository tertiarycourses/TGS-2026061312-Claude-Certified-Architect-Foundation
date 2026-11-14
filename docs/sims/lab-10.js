// Lab 10 · Task 2.3 · Simulator 5: review and test generation fight over one Claude call.
// The trap: one shared CI step holds every tool (findings, test writing, PR labels) with tool_choice auto.
// The fix: separate steps. The review step holds only its reporting tool and is forced to call it with
// tool_choice {"type": "tool", "name": "report_findings"}; the test step holds only its own contract.
import { oneShot, validate } from "./shared/t2-kit.js";

// PR 418 in Simulator 5's repo (repo/stock/totals.py and repo/tests/test_totals.py).
const TOTALS = `"""Totals across stock items."""
import logging

logger = logging.getLogger(__name__)


def total_qty(items: list) -> int:
    """Sum the qty of every item in the list."""
    total = 0
    for i in range(1, len(items)):  # PR 418 change
        total += items[i].qty
    logger.info("totals computed %s", len(items))
    return total


def low_stock(items: list, threshold: int = 5) -> list:
    return [i for i in items if i.qty < threshold]`;
const TESTS = `# tests/test_totals.py
from stock.totals import total_qty


def test_total_counts_all_items(sample_stock):
    assert total_qty(sample_stock) == 12

# tests/conftest.py: sample_stock = items with qty 3, 0, 9; empty_stock = []`;
const numbered = (src) => src.split("\n").map((l, i) => `${String(i + 1).padStart(3)}  ${l}`).join("\n");

// Simulator 5's review criteria (prompts/review-criteria.txt), few-shot examples trimmed to the ones that don't give the answer away.
const CRITERIA = `REVIEW CRITERIA (explicit, categorical)
Report a finding ONLY when one of these holds:
- bug: the code's behaviour contradicts the function name, docstring, or an adjacent test.
- security: untrusted input reaches SQL, shell, file paths or HTML without validation or parameterisation.
- data-loss: a write, delete or migration can drop or overwrite records without a guard.
- contract: a public signature, return shape or error code changes without a matching caller update.
Do NOT report: formatting, naming, import order, comment style; a pattern already used elsewhere in the same file; missing tests (the test-generation step handles those).
Severity: critical = exploitable security flaw or guaranteed data loss; high = wrong result on common input; medium = wrong result on an edge case; low = contract drift with no current caller impact.
Example (skip): import os, sys -> import os\\nimport sys. No finding: formatting only.`;

const FINDING_SCHEMA = {
  type: "object", additionalProperties: false, required: ["pass", "findings"],
  properties: {
    pass: { type: "string", enum: ["per-file", "integration"] },
    findings: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["file", "line", "severity", "category", "detected_pattern", "issue", "suggested_fix", "confidence"],
      properties: { file: { type: "string" }, line: { type: "integer", minimum: 1 }, severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
        category: { type: "string", enum: ["bug", "security", "data-loss", "contract"] },
        detected_pattern: { type: "string", description: "the code construct that triggered the finding" },
        issue: { type: "string" }, suggested_fix: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 } } } },
  },
};
const PROPOSALS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["proposed", "skipped_as_duplicate"],
  properties: {
    proposed: { type: "array", items: { type: "object", additionalProperties: false, required: ["test_name", "target", "scenario"],
      properties: { test_name: { type: "string" }, target: { type: "string" }, scenario: { type: "string" } } } },
    skipped_as_duplicate: { type: "array", items: { type: "object", additionalProperties: false, required: ["existing_test", "scenario"],
      properties: { existing_test: { type: "string" }, scenario: { type: "string" } } } },
  },
};

export default {
  id: 10,
  see: "The shared step mixes review, test writing and PR labels in one conversation, while the scoped review step is forced to call report_findings and flags the range(1, ...) loop, and the separate test step skips the scenario test_total_counts_all_items already covers.",
  explain: "Every extra tool is another chance of an irrelevant call, so a step that holds test-writing and label tools mixes those jobs into its review. Give review only its reporting tool and force it with tool_choice {\"type\": \"tool\", \"name\": \"report_findings\"}, and the step has to return a structured finding. Test generation runs as its own step with its own tool and schema. The two scoped steps are single calls: the pipeline reads the forced tool's input and does not call Claude again.",
  try: "Give the review step write_test_file as well and change its tool_choice to {\"type\": \"any\"}: run it a few times and see whether a test file ever appears where you wanted findings.",
  // The scenario board (assets/scene.js): PR 418's CI run, first as one shared step, then as two scoped steps.
  scene: {
    title: "PR 418: one CI call doing three jobs, or two steps that each do one",
    caption: "The same diff of stock/totals.py goes to every step. What changes is which tools each call holds and whether tool_choice forces the report.",
    lanes: [
      { key: "A", label: "One shared CI step", sub: "review + tests + labels, every tool, tool_choice auto", tone: "trap", on: /Phase 1/, stages: [
        { id: "apr", icon: "📝", t: "PR 418: stock/totals.py", s: "for i in range(1, len(items))" },
        { id: "atools", icon: "🧰", t: "3 tools, tool_choice auto", s: "report_findings · write_test_file · update_pr_labels", diff: true,
          tools: ["report_findings", "write_test_file", "update_pr_labels"] },
        { id: "aclaude", icon: "🤖", t: "One CI conversation", s: "review, write tests, label: up to 3 turns", claude: true },
        { id: "aout", icon: "📤", t: "What review hands on", s: "want: a schema-valid finding object", out: true } ] },
      { key: "B", label: "Review step", sub: "only report_findings, forced with tool_choice", tone: "fix", on: /Phase 2/, stages: [
        { id: "btools", icon: "🧰", t: "Only report_findings", s: "tool_choice {type: tool, name: report_findings}", diff: true, tools: ["report_findings"] },
        { id: "bclaude", icon: "🤖", t: "Review step, one call", s: "criteria: bug · security · data-loss · contract", claude: true },
        { id: "bout", icon: "📋", t: "Finding object", s: "want: valid schema, the range(1) bug, no test talk", out: true } ] },
      { key: "C", label: "Test step", sub: "only propose_tests, forced with tool_choice", tone: "fix", on: /Phase 3/, stages: [
        { id: "ctools", icon: "🧰", t: "Only propose_tests", s: "tool_choice {type: tool, name: propose_tests}", diff: true, tools: ["propose_tests"] },
        { id: "cclaude", icon: "🤖", t: "Test step, one call", s: "3 candidate scenarios for total_qty", claude: true },
        { id: "cout", icon: "🧪", t: "Test plan", s: "want: valid, skips the duplicate, ≤ 2 new tests", out: true } ] },
    ],
  },
  slide: {
    title: "Give each CI step only its tools, then force the report",
    code: `# trap: one step, every tool, tool_choice auto
claude(tools=[report_findings, write_test_file,
              update_pr_labels])                  # KEY 1

# review step: one tool, and it must be called
claude(tools=[report_findings],                   # KEY 2
       tool_choice={"type": "tool",
                    "name": "report_findings"})   # KEY 3

# test step: its own tool, its own contract   KEY 4
claude(tools=[propose_tests],
       tool_choice={"type": "tool", "name": "propose_tests"})`,
    keys: [["1", "Extra tools invite drift", "Review can drift into writing tests or labels."],
           ["2", "Scope tools to the role", "Review holds no test-writing tool at all."],
           ["3", "Force the reporting tool", "A named tool_choice means no prose comes back."],
           ["4", "Tests keep their own step", "Test generation still runs, with its schema."]],
  },
  async run(s, E) {
    const shared = {
      report_findings: { description: "Report code-review findings for the pipeline (the finding schema).", input_schema: FINDING_SCHEMA, run: (a) => ({ received: (a.findings || []).length + " finding(s)" }) },
      write_test_file: { description: "Write a pytest file into tests/.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }, run: (a) => ({ written: a.path }) },
      update_pr_labels: { description: "Set labels on the pull request.", input_schema: { type: "object", properties: { labels: { type: "array", items: { type: "string" } } }, required: ["labels"] }, run: (a) => ({ labels: a.labels }) },
    };

    s.log("== Phase 1: the trap: one shared CI step, every tool, tool_choice auto", "note");
    s.show("apr", "diff + tests/test_totals.py", "done");
    const trap = await E.runAgent(s, {
      prompt: `You are the CI step for PR 418. Review the change, write tests for it, and update the PR labels.\n\nstock/totals.py:\n${numbered(TOTALS)}\n\n${TESTS}`,
      tools: shared, maxTurns: 3, max_tokens: 1500,
    });
    const used = [...new Set(trap.calls.map((c) => c.name))];
    s.log(`Phase 1 result: one conversation called ${used.join(", ") || "no tools"}; it ended with ${trap.text.trim() ? `${trap.text.trim().split(/\s+/).length} words of prose` : "no prose"}${trap.stop_reason === "tool_use" ? " (stopped by the turn cap)" : ""}. Review output and test writing share one context and one tool list.`, "note");
    const findingRe = /range\(1|off.by.one|first (item|element)|skips? the first|index 0/i;
    const trapReport = trap.calls.find((c) => c.name === "report_findings");
    const trapErrs = trapReport ? validate(FINDING_SCHEMA, trapReport.input) : ["no report_findings call"];
    const trapLoop = !!trapReport && (trapReport.input?.findings || []).some((f) => findingRe.test(`${f.detected_pattern} ${f.issue}`));
    const trapWords = trap.text.trim() ? trap.text.trim().split(/\s+/).length : 0;
    const mixed = used.filter((n) => n !== "report_findings");
    const trapReportText = trapReport ? (trapErrs.length ? "report_findings payload INVALID" : `report_findings valid${trapLoop ? ", range(1) bug found" : ", range(1) bug missed"}`) : "no finding object";
    s.show("atools", `called: ${used.join(", ") || "none"}`, "done");
    s.show("aclaude", `${trap.turns} turn${trap.turns === 1 ? "" : "s"} · ${trapWords} words of prose`, "done");
    s.show("aout", `${trapReportText}${mixed.length ? ` · mixed with ${mixed.join(", ")}` : ""}`, trapErrs.length === 0 && trapLoop ? "good" : "bad");
    await s.pause({
      title: "The shared step finished: one conversation held every CI tool",
      outcome: `It called **${used.join(", ") || "no tools"}** in ${trap.turns} turn${trap.turns === 1 ? "" : "s"} and ended with ${trapWords ? `${trapWords} words of prose` : "no prose"}. ` +
               `What review handed on: **${trapReportText}**${mixed.length ? `, in the same context as ${mixed.join(" and ")}` : ""}.`,
      next: "The review step on its own: only report_findings, forced with tool_choice",
    });

    s.log("== Phase 2: the review step: only report_findings, forced with tool_choice", "note");
    const review = await oneShot(s, E, {
      label: "Review step",
      prompt: `REVIEW STEP ONLY. Review this file from PR 418.\n\n${CRITERIA}\n\nstock/totals.py:\n${numbered(TOTALS)}\n\nSet pass to "per-file". Return findings only; do not propose tests.`,
      tools: { report_findings: { ...shared.report_findings, description: "Report the review findings for this PR in the pipeline's finding schema. One call with every finding; an empty findings list when nothing meets the criteria." } },
      tool_choice: { type: "tool", name: "report_findings" }, max_tokens: 1200,
    });
    const rErrs = review.input ? validate(FINDING_SCHEMA, review.input) : ["no tool call"];
    const findings = review.input?.findings || [];
    const loopBug = findings.some((f) => /range\(1|off.by.one|first (item|element)|skips? the first|index 0/i.test(`${f.detected_pattern} ${f.issue}`));
    const aboutTests = findings.filter((f) => /missing test|no test|add (a )?(unit )?test|test coverage|write (a )?test/i.test(`${f.issue} ${f.detected_pattern}`));
    const reviewOk = review.name === "report_findings" && rErrs.length === 0 && loopBug && aboutTests.length === 0;
    s.show("bclaude", `${review.name || "prose"} · stop_reason ${review.stop_reason}`, "done");
    s.show("bout", `schema ${rErrs.length ? "INVALID" : "valid"} · ${findings.length} finding(s)${loopBug ? " · range(1) bug" : " · range(1) bug missed"}${aboutTests.length ? ` · ${aboutTests.length} about tests` : ""}`, reviewOk ? "good" : "bad");
    s.log(`Review step result: ${review.name || "prose"} · schema ${rErrs.length ? "INVALID: " + rErrs.slice(0, 2).join("; ") : "valid"} · ${findings.length} finding(s): ${findings.map((f) => `${f.severity}/${f.category} line ${f.line}: ${E.short(f.issue, 70)}`).join(" | ")}`, "note");
    await s.pause({
      title: "The review step finished: one tool, forced",
      outcome: `Claude returned \`${review.name || "prose"}\` with a ${rErrs.length ? "**schema-invalid**" : "schema-valid"} payload: ${findings.length} finding(s)` +
               `${findings.length ? ` (${findings.map((f) => `${f.severity}/${f.category} line ${f.line}`).join(", ")})` : ""}; the range(1, ...) bug ${loopBug ? "**reported**" : "**missed**"}; ${aboutTests.length} about tests.`,
      next: "The test step on its own: only propose_tests, forced with tool_choice",
    });

    s.log("== Phase 3: the test step: only propose_tests, forced with tool_choice", "note");
    const tests = await oneShot(s, E, {
      label: "Test step",
      prompt: `TEST GENERATION STEP ONLY.\n\nstock/totals.py:\n${TOTALS}\n\n${TESTS}\n\nConsider these candidate scenarios for total_qty: (1) several items are all counted, (2) a single item returns its qty, (3) an empty list returns 0. For each candidate, check whether an existing test already covers it: put covered ones in skipped_as_duplicate with the existing test's name, and propose at most two new pytest cases for the rest.`,
      tools: { propose_tests: { description: "Return the test plan for this PR: new pytest cases to write, and candidate scenarios skipped because an existing test already covers them.", input_schema: PROPOSALS_SCHEMA, run: (a) => ({ received: `${(a.proposed || []).length} proposed, ${(a.skipped_as_duplicate || []).length} skipped` }) } },
      tool_choice: { type: "tool", name: "propose_tests" }, max_tokens: 1000,
    });
    const tErrs = tests.input ? validate(PROPOSALS_SCHEMA, tests.input) : ["no tool call"];
    const skipped = (tests.input?.skipped_as_duplicate || []).some((x) => /test_total_counts_all_items/.test(x.existing_test));
    s.log(`Test step result: ${tests.name || "prose"} · schema ${tErrs.length ? "INVALID" : "valid"} · proposed: ${(tests.input?.proposed || []).map((p) => p.test_name).join(", ") || "none"} · skipped: ${(tests.input?.skipped_as_duplicate || []).map((x) => x.existing_test).join(", ") || "none"}`, "note");

    const proposed = tests.input?.proposed || [];
    const testsOk = tests.name === "propose_tests" && tErrs.length === 0 && skipped && proposed.length <= 2;
    s.show("cclaude", `${tests.name || "prose"} · stop_reason ${tests.stop_reason}`, "done");
    s.show("cout", `schema ${tErrs.length ? "INVALID" : "valid"} · ${proposed.length} proposed · duplicate ${skipped ? "skipped" : "NOT skipped"}`, testsOk ? "good" : "bad");
    const yes = (v, want = true) => ({ v: v ? "yes" : "no", tone: v === want ? "good" : "bad" });
    return {
      compare: {
        cols: [
          { title: "One shared CI step, every tool, auto", short: "Shared step", tone: "trap", said: trap.text,
            verdict: trapErrs.length === 0 && trapLoop && !mixed.length ? "This time it kept to a clean, valid report and touched no other tool, but nothing in the setup made it do so."
              : `Called ${used.join(", ") || "no tools"}: ${trapReport ? (trapErrs.length ? "its finding payload failed the schema" : trapLoop ? "the finding object was valid" : "the finding object missed the range(1) bug") : "**no finding object at all**"}` +
                `${mixed.length ? `, mixed in one context with ${mixed.join(" and ")}` : ""}${trapWords ? `, ending in ${trapWords} words of prose` : ""}.` },
          { title: "Review step: report_findings forced", short: "Review step", tone: "fix",
            verdict: reviewOk ? `One forced call, a schema-valid finding object with the range(1, ...) bug, and nothing about tests.`
              : `report_findings ${rErrs.length ? "payload invalid" : "valid"}; range(1) bug ${loopBug ? "reported" : "missed"}; ${aboutTests.length} test-related finding(s). Read the live output: Claude writes each run fresh.` },
          { title: "Test step: propose_tests forced", short: "Test step", tone: "fix",
            verdict: testsOk ? `A valid test plan: ${proposed.length} new case(s), and the scenario test_total_counts_all_items already covers was skipped.`
              : `propose_tests ${tErrs.length ? "payload invalid" : "valid"}; duplicate ${skipped ? "skipped" : "not skipped"}; ${proposed.length} proposed.` },
        ],
        rows: [
          ["Tools the call held", "3", { v: "1", tone: "good" }, { v: "1", tone: "good" }],
          ["tool_choice", "`auto`", "`{\"type\": \"tool\", \"name\": \"report_findings\"}`", "`{\"type\": \"tool\", \"name\": \"propose_tests\"}`"],
          ["Tools actually called", { v: used.join(", ") || "none", tone: mixed.length ? "bad" : "" }, review.name || "prose", tests.name || "prose"],
          ["Schema-valid structured output", yes(trapErrs.length === 0), yes(rErrs.length === 0), yes(tErrs.length === 0)],
          ["range(1, ...) bug reported", yes(trapLoop), yes(loopBug), "—"],
          ["Ended in prose", trapWords ? { v: `${trapWords} words`, tone: "bad" } : { v: "no", tone: "good" }, yes(!!review.text, false), yes(!!tests.text, false)],
        ],
        note: "The same PR goes to every call. The fix changes only what each call holds: the review step has one tool and tool_choice forces it, so a finding object always comes back; test generation keeps its own step and its own schema.",
      },
      final: `Review step (report_findings, forced):\n${JSON.stringify(review.input, null, 1)}\n\nTest step (propose_tests, forced):\n${JSON.stringify(tests.input, null, 1)}`,
      checks: [
        E.check("The review step held only report_findings (no test-writing or label tool) and returned it as a tool call, not prose", review.name === "report_findings" && review.stop_reason === "tool_use" && !review.text),
        E.check("The review payload matches the finding schema and reports the range(1, ...) loop that skips the first item", rErrs.length === 0 && loopBug),
        E.check(`The review reported nothing about tests (${aboutTests.length} test-related finding(s))`, aboutTests.length === 0),
        E.check("The test step returned its own schema-valid contract and skipped the scenario test_total_counts_all_items covers", tests.name === "propose_tests" && tErrs.length === 0 && skipped && (tests.input.proposed || []).length <= 2),
      ],
    };
  },
};
