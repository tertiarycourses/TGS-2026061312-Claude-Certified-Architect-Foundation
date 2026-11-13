// Topic 5 helper for Simulator 4 · Developer Productivity with Claude (Lab 28).
// The legacy billing repo from labs/simulators/simulator-4-developer-productivity/sample_repo, plus the
// noise a real legacy repo carries (billing logs, a minified bundle, SQL migrations, an archived copy of
// the function), so a wide search for calculate_total floods whichever context runs it.

const SOURCE = {
  "src/__init__.py": "",
  "src/billing/__init__.py": "",
  "src/billing/invoice.py": `"""Invoice totals for the legacy billing module."""
from decimal import Decimal

TAX_RATE = Decimal("0.09")


def line_total(qty, unit_price):
    total = Decimal(qty) * Decimal(unit_price)
    return total


def calculate_total(lines, discount=Decimal("0")):
    total = sum(line_total(q, p) for q, p in lines)
    total = total - discount
    total = total + total * TAX_RATE
    return total
`,
  "src/billing/validation.py": `from decimal import Decimal
from .invoice import calculate_total


def validate_invoice(lines, stated_total):
    computed = calculate_total(lines)
    if abs(computed - Decimal(stated_total)) > Decimal("0.01"):
        raise ValueError(f"stated {stated_total} != computed {computed}")
    return computed
`,
  "src/legacy/__init__.py": `from .report import monthly_report
__all__ = ["monthly_report"]
`,
  "src/legacy/report.py": `from src.billing.invoice import calculate_total


def monthly_report(invoices):
    return {inv_id: calculate_total(lines) for inv_id, lines in invoices.items()}
`,
  "src/api/__init__.py": "",
  "src/api/export.py": `"""CSV export of invoice totals for finance."""
from src.billing import invoice


def export_rows(invoices):
    for inv_id, lines in invoices.items():
        yield inv_id, str(invoice.calculate_total(lines))
`,
  "src/api/handlers.py": `# TODO(2019): switch the quote endpoint to calculate_total once tax rules settle
def quote(lines):
    return sum(q * p for q, p in lines)
`,
  "archive/old_billing.py": `# Archived 2021. Not imported anywhere. Kept for audit.
def calculate_total(items):
    return sum(i["price"] for i in items)
`,
  "tests/test_invoice.py": `from decimal import Decimal
from src.billing.invoice import calculate_total


def test_total_with_tax():
    assert calculate_total([(2, "10.00")]) == Decimal("21.80")
`,
  "tests/test_validation.py": `import pytest
from src.billing.validation import validate_invoice


def test_rejects_mismatch():
    with pytest.raises(ValueError):
        validate_invoice([(1, "10.00")], "99.00")
`,
  "docs/architecture.txt": "Billing module: invoice.py computes totals; validation.py compares against stated totals.\nLegacy report.py wraps calculate_total for the monthly job.\n",
  "docs/runbook.txt": "Monthly billing job: run python -m src.legacy.report after the 1st of each month.\n",
  "docs/CHANGELOG.md": "## 4.2.0\n- calculate_total now applies discount before tax\n## 4.1.0\n- calculate_total moved from archive/old_billing.py to src/billing/invoice.py\n## 3.9.0\n- calculate_total returns Decimal\n",
};

// Noise: deterministic, so every run sees the same repo.
function noise() {
  const f = {};
  for (let d = 1; d <= 6; d++) {
    const rows = [];
    for (let i = 0; i < 40; i++) rows.push(`2026-10-0${d}T0${i % 10}:${String(10 + i).padStart(2, "0")}:00 INFO billing.calculate_total invoice=INV-${2000 + d * 100 + i} lines=${(i % 5) + 1} total=${(41.3 * ((i % 7) + 1)).toFixed(2)} took_ms=${3 + (i % 9)}`);
    f[`logs/billing-2026-10-0${d}.log`] = rows.join("\n");
  }
  for (let m = 1; m <= 6; m++) f[`migrations/00${m}_billing_${["init", "tax", "discount", "currency", "rounding", "audit"][m - 1]}.sql`] = `-- Migration ${m}: totals are recomputed by calculate_total after this runs\nALTER TABLE invoices ADD COLUMN c${m} NUMERIC;\nUPDATE invoices SET c${m} = 0; -- backfilled by calculate_total job\n`;
  f["dist/app.bundle.min.js"] = Array.from({ length: 25 }, (_, i) => `function q${i}(a){return fetch("/api/calculate_total?v=${i}",{body:a}).then(r=>r.json())}`).join(";");
  f["vendor/decimal_utils.py"] = "def round_half_up(x):\n    return x.quantize(1)\n";
  return f;
}

export const LEGACY_FILES = { ...SOURCE, ...noise() };

// The callers a complete search finds (the tests call it too, but they are tests).
export const CALLERS = ["src/legacy/report.py", "src/billing/validation.py", "src/api/export.py"];

// A Write tool for the scratchpad, sharing the in-memory file system of E.repo().
export function writeTool(fs, log) {
  return {
    description: "Create or overwrite a file with the given content. Use it for the NOTES.md scratchpad.",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    run: ({ path, content }) => { fs[path] = String(content); log.push(path); return `Wrote ${path} (${String(content).length} chars)`; },
  };
}

// Rough size of a conversation, as the model would see it (about 4 characters per token).
export const contextTokens = (messages) => Math.round(JSON.stringify(messages).length / 4);
