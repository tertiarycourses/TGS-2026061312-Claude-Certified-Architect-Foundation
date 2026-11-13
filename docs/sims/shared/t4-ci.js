// Simulator 5 · Claude Code for Continuous Integration: pull request 418 on the stock tracking service,
// ported from labs/simulators/simulator-5-ci-cd (repo/, finding.schema.json, prompts/review-criteria.txt).
// Fake repository, real Claude. Used by Lab 19 (explicit criteria) and Lab 24 (per-file + integration passes).
// The hint comments in the Python copy ("p is None ...", "caller not updated ...") are removed here,
// so Claude has to find the bugs from the code itself.

export const PR = 418;

export const FILES = {
  "stock/pricing.py": `"""Price lookups for the stock API (added in PR 418)."""
import logging

logger = logging.getLogger(__name__)
CATALOG = {"A1": {"amount": 12.5, "currency": "SGD"}, "B2": {"amount": 3.0, "currency": "SGD"}}


def getPrice(sku):
    """Return the catalogue price for a SKU."""
    p = CATALOG.get(sku)
    logger.info("price lookup %s", sku)
    return p["amount"]


def Apply_Discount(amount, pct):
    """Apply a percentage discount."""
    x = amount - amount * pct / 100
    return x


def total_price(skus):
    t = 0
    for s in skus:
        t = t + getPrice(s)
    return t
`,
  "stock/repository.py": `"""Stock repository: reads quantities from the warehouse database."""
import os
import sys

from stock.db import get_cursor


def fetch(sku: str, warehouse: str) -> dict:
    """Return the stock row for one SKU in one warehouse."""
    cursor = get_cursor()
    cursor.execute(f"SELECT qty FROM stock WHERE sku = '{sku}' AND warehouse = '{warehouse}'")
    row = cursor.fetchone()
    return {"sku": sku, "warehouse": warehouse, "qty": row[0] if row else 0}


def fetch_many(skus: list[str], warehouse: str) -> list[dict]:
    return [fetch(s, warehouse) for s in skus]
`,
  "stock/totals.py": `"""Totals across stock items."""
import logging

logger = logging.getLogger(__name__)


def total_qty(items: list) -> int:
    """Sum the qty of every item in the list."""
    total = 0
    for i in range(1, len(items)):
        total += items[i].qty
    logger.info("totals computed %s", len(items))
    return total


def low_stock(items: list, threshold: int = 5) -> list:
    return [i for i in items if i.qty < threshold]
`,
  "stock/api.py": `"""HTTP-facing stock API."""
from stock import repository


def get_stock(sku: str, warehouse: str) -> dict:
    """Return stock for one SKU in one warehouse."""
    return repository.fetch(sku, warehouse)


def get_many(skus: list[str], warehouse: str) -> list[dict]:
    return repository.fetch_many(skus, warehouse)
`,
  "stock/jobs.py": `"""Nightly stock sync job."""
import logging

from stock import api

logger = logging.getLogger(__name__)


def sync(skus: list[str]) -> list[dict]:
    out = []
    for sku in skus:
        stock = api.get_stock(sku)
        out.append(stock)
    logger.info("job done")
    return out
`,
  "tests/test_totals.py": `from stock.totals import total_qty


def test_total_counts_all_items(sample_stock):
    assert total_qty(sample_stock) == 12
`,
};

// The four files PR 418 changed, with the changed lines (fixtures/changes.json).
export const CHANGES = [
  { path: "stock/repository.py", lines: [11, 2, 3] },
  { path: "stock/totals.py", lines: [10, 12] },
  { path: "stock/api.py", lines: [5, 7] },
  { path: "stock/jobs.py", lines: [12, 14] },
];

// A file with line numbers, the way a reviewer (and Claude Code's Read tool) sees it.
export const numbered = (path) => FILES[path].replace(/\n$/, "").split("\n").map((l, i) => `${String(i + 1).padStart(3)}  ${l}`).join("\n");
export const changedLines = (c) => c.lines.map((n) => `  ${c.path}:${n}  ${FILES[c.path].split("\n")[n - 1].trim()}`).join("\n");

// A Read tool over the fake repository that returns numbered lines.
export const readTool = {
  Read: {
    description: "Read a file from the pull request's repository. Returns the file with line numbers. Input: path, e.g. stock/pricing.py.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    run: ({ path }) => (path in FILES ? numbered(path) : { isError: true, message: `No such file: ${path}. Files: ${Object.keys(FILES).join(", ")}` }),
  },
};

// finding.schema.json, as an output_config schema. The category enum keeps ALL eight categories
// (bug ... architecture) for every run, so any difference between two prompts comes from the prompt alone.
// (Structured outputs reject minimum/maximum on numbers, so confidence carries its range in the description.)
export const FINDINGS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["pass", "findings"],
  properties: {
    pass: { type: "string", enum: ["per-file", "integration"] },
    findings: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["file", "line", "severity", "category", "detected_pattern", "issue", "suggested_fix", "confidence"],
        properties: {
          file: { type: "string" },
          line: { type: "integer" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          category: { type: "string", enum: ["bug", "security", "data-loss", "contract", "style", "naming", "test-coverage", "architecture"] },
          detected_pattern: { type: "string", description: "the code construct that triggered the finding" },
          issue: { type: "string" },
          suggested_fix: { type: "string" },
          confidence: { type: "number", description: "0 to 1" },
        },
      },
    },
  },
};
export const asJson = { format: { type: "json_schema", schema: FINDINGS_SCHEMA } };

// prompts/review-criteria.txt: explicit, categorical report and skip rules.
export const CRITERIA = `REVIEW CRITERIA (explicit, categorical; never "be conservative")

Report a finding ONLY when one of these holds:
- bug: the code's behaviour contradicts the function name, docstring, or an adjacent test, or it crashes on input the caller can pass.
- security: untrusted input reaches SQL, shell, file paths or HTML without validation or parameterisation.
- data-loss: a write, delete or migration can drop or overwrite records without a guard.
- contract: a public signature, return shape or error code changes without a matching caller update.

Do NOT report:
- formatting, naming, import order, unused imports, comment style;
- a pattern already used elsewhere in the same file or module;
- missing tests (the test-generation step handles those).

Severity:
- critical: exploitable security flaw or guaranteed data loss (e.g. f-string SQL with request input).
- high: wrong result or crash on common input (e.g. off-by-one in a loop every request uses).
- medium: wrong result or crash on an edge case (e.g. None not handled when the caller can pass it).
- low: contract drift with no current caller impact.`;

export const isNoise = (f) => ["style", "naming", "test-coverage", "architecture"].includes(f.category);
export const parseFindings = (text) => { try { return JSON.parse(text); } catch { return null; } };
export const fmt = (f) => `${f.file}:${f.line} [${f.severity}/${f.category}] ${f.issue}`;
