# Scratchpad

## Phase 1: invoice total bug (customer: totals with >2 decimal places)

Status: investigation only. No code changed.

### Where totals are computed and validated
- src/billing/invoice.py:4 `TAX_RATE = Decimal("0.09")`
- src/billing/invoice.py:7-9 `line_total(qty, unit_price)`: `Decimal(qty) * Decimal(unit_price)`, no quantize.
- src/billing/invoice.py:12-16 `calculate_total(lines, discount=Decimal("0"))`: sums line totals, subtracts discount, adds `total * TAX_RATE`. Never rounds to cents. **Root cause.**
- src/billing/validation.py:5-9 `validate_invoice(lines, stated_total)`: calls calculate_total, accepts if abs diff <= 0.01, returns the unrounded `computed`. Tolerance hides the sub-cent drift at validation time, but the returned value still carries extra decimals.

### Reproduced (python3 -c, repo code)
- `calculate_total([(3,'3.33')])` -> `10.8891` (4 dp)
- `calculate_total([(1,'10.01')])` -> `10.9109` (4 dp)
- `calculate_total([(2,'10.00')])` -> `21.8000` (only passes tests because Decimal equality ignores exponent)

### Callers (from Grep over *.py)
- src/legacy/report.py:5 `monthly_report` -> `calculate_total`. Feeds the monthly billing job (runbook: `python -m src.legacy.report`). Output is stored/printed unrounded.
- src/billing/validation.py:6 `validate_invoice` -> `calculate_total`.
- tests/test_invoice.py:6 `test_total_with_tax` asserts `Decimal("21.80")` for `[(2,"10.00")]`. Passes today, does not cover odd cents.
- tests/test_validation.py:7 calls `validate_invoice` (explore sweep; not yet read by me). Covers the 0.01 tolerance path.
- Explore sweep, all file types (confirmed, nothing modified): invoice.py:13 calls `line_total`; validation.py:2 and report.py:1 and test_invoice.py:2 import; test_validation.py:2 imports `validate_invoice`; docs/architecture.txt:2 mentions `calculate_total` (doc only). No other callers, no non-.py code callers.

### Proposed fix (not applied)
1. In invoice.py, quantize the final result to cents: `return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` at the end of `calculate_total`. Keep the tax step unrounded internally so only the final value is rounded.
2. Optionally quantize `line_total` too, if the business rule is per-line rounding. Confirm with the customer or billing owner before choosing; per-line and per-invoice rounding can differ by cents.
3. In validation.py, compare on the quantized value and drop the 0.01 tolerance only if stated totals are always cent-exact. Otherwise keep the tolerance and return the quantized value.
4. Add tests: odd unit prices (3.33, 10.01), discount, and an assertion on `as_tuple().exponent == -2` so the test catches extra decimals.
5. Check whether `monthly_report` output has existing consumers expecting 4 dp before shipping.

### Next step
Wait for the explore subagent caller sweep (all file types), add its findings here, then give the user the five-line summary. Do not edit code until the user approves the fix.


## Phase 2: fix applied

- docs/runbook.txt:3 (re-read this session): "Totals must be rounded to 2 dp (finance policy 2026-04)." Confirms the fix target.
- src/billing/invoice.py:2 import changed to `from decimal import Decimal, ROUND_HALF_UP` (needed for the return; outside the return line).
- src/billing/invoice.py:16 final return now `total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)`. `line_total` untouched.
- Tests: `python3 -m pytest -q` -> 2 passed.
- Spot check: `[(3,'3.33')]` -> 10.89, `[(1,'10.01')]` -> 10.91, `[(2,'10.00')]` -> 21.80 (all 2 dp).
- Not yet done: no new regression test for odd cents; validation.py tolerance unchanged; monthly_report consumers not checked.
