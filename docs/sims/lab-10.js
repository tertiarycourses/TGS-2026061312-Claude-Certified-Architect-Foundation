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
    const trap = await E.runAgent(s, {
      prompt: `You are the CI step for PR 418. Review the change, write tests for it, and update the PR labels.\n\nstock/totals.py:\n${numbered(TOTALS)}\n\n${TESTS}`,
      tools: shared, maxTurns: 3, max_tokens: 1500,
    });
    const used = [...new Set(trap.calls.map((c) => c.name))];
    s.log(`Phase 1 result: one conversation called ${used.join(", ") || "no tools"}; it ended with ${trap.text.trim() ? `${trap.text.trim().split(/\s+/).length} words of prose` : "no prose"}${trap.stop_reason === "tool_use" ? " (stopped by the turn cap)" : ""}. Review output and test writing share one context and one tool list.`, "note");

    s.log("\n== Phase 2: the review step: only report_findings, forced with tool_choice", "note");
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
    s.log(`Review step result: ${review.name || "prose"} · schema ${rErrs.length ? "INVALID: " + rErrs.slice(0, 2).join("; ") : "valid"} · ${findings.length} finding(s): ${findings.map((f) => `${f.severity}/${f.category} line ${f.line}: ${E.short(f.issue, 70)}`).join(" | ")}`, "note");

    s.log("\n== Phase 3: the test step: only propose_tests, forced with tool_choice", "note");
    const tests = await oneShot(s, E, {
      label: "Test step",
      prompt: `TEST GENERATION STEP ONLY.\n\nstock/totals.py:\n${TOTALS}\n\n${TESTS}\n\nConsider these candidate scenarios for total_qty: (1) several items are all counted, (2) a single item returns its qty, (3) an empty list returns 0. For each candidate, check whether an existing test already covers it: put covered ones in skipped_as_duplicate with the existing test's name, and propose at most two new pytest cases for the rest.`,
      tools: { propose_tests: { description: "Return the test plan for this PR: new pytest cases to write, and candidate scenarios skipped because an existing test already covers them.", input_schema: PROPOSALS_SCHEMA, run: (a) => ({ received: `${(a.proposed || []).length} proposed, ${(a.skipped_as_duplicate || []).length} skipped` }) } },
      tool_choice: { type: "tool", name: "propose_tests" }, max_tokens: 1000,
    });
    const tErrs = tests.input ? validate(PROPOSALS_SCHEMA, tests.input) : ["no tool call"];
    const skipped = (tests.input?.skipped_as_duplicate || []).some((x) => /test_total_counts_all_items/.test(x.existing_test));
    s.log(`Test step result: ${tests.name || "prose"} · schema ${tErrs.length ? "INVALID" : "valid"} · proposed: ${(tests.input?.proposed || []).map((p) => p.test_name).join(", ") || "none"} · skipped: ${(tests.input?.skipped_as_duplicate || []).map((x) => x.existing_test).join(", ") || "none"}`, "note");

    return {
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
