# Scratchpad

## Invoice totals with more than 2 decimal places

Status: investigation finished. No code changed; the proposed fix below is neither applied nor tested.

### Root cause
- `src/billing/invoice.py:12-16`: `calculate_total` applies `TAX_RATE` (`invoice.py:4`, 0.09) at line 15 and returns at line 16 with no rounding. A 2dp amount times 0.09 gives 4dp.
- `src/billing/invoice.py:7-9`: `line_total` does not round either. `Decimal(float)` keeps binary noise, which is a second source of long decimals.
- The repo has no `quantize` or `round` anywhere (grep over `*.py`).

### Reproduced (current code)
| Call | Result |
|---|---|
| `calculate_total([(1, "19.99")])` | `21.7891` |
| `calculate_total([(3, "33.33")], Decimal("1.005"))` | `107.89365` |
| `calculate_total([("1.5", "9.99")])` | `16.33365` |
| `calculate_total([(1, 0.1)])` (float price) | `0.1090000000000000060507154842` |
| `validate_invoice([(1, "19.99")], "21.79")` | passes, returns `21.7891` |
| `validate_invoice([(1, "19.99")], "21.78")` | passes, returns `21.7891` (wrong by a cent) |
| `validate_invoice([(1, "19.99")], "21.80")` | raises `ValueError` |

### Validation
- `src/billing/validation.py:5-9`: `validate_invoice` compares the raw total to `stated_total` with a 0.01 tolerance (line 7) and returns the raw total (line 9).
- It never checks decimal places, so a total with too many decimals is not caught. From the code, a stated `21.7891` would pass.
- It calls `calculate_total(lines)` with no discount (line 6), so a discounted invoice is compared against its undiscounted total.

### Callers of `calculate_total`
From the explore subagent; I confirmed these with a grep and by reading the files.
| Caller | Enclosing function | Use of result |
|---|---|---|
| `src/billing/validation.py:6` | `validate_invoice` | compared with tolerance, returned raw |
| `src/legacy/report.py:5` | `monthly_report` | stored raw in `{inv_id: total}`, no discount passed |
| `tests/test_invoice.py:6` | `test_total_with_tax` | `== Decimal("21.80")` |

No aliases, dynamic lookups or re-exports of `calculate_total` were found. Imports are at `validation.py:2`, `report.py:1` and `test_invoice.py:2`. `docs/architecture.txt:2` mentions it (docs only).

One level up:
- `validate_invoice` is called only from `tests/test_validation.py:7`.
- `monthly_report` is re-exported at `src/legacy/__init__.py:1-2` and has no caller in this repo.

### Test gap
- `tests/test_invoice.py:6` cannot catch this bug: `Decimal` equality ignores trailing zeros, so the actual `21.8000` equals `21.80`.
- Both existing tests pass on the buggy code (`2 passed`). The second is `tests/test_validation.py:5`.
- `monthly_report` has no test.

### Proposed fix (not applied)
1. Round once, at the end of `calculate_total`. That covers both production callers, so neither needs its own change.
   ```python
   from decimal import Decimal, ROUND_HALF_UP

   CENT = Decimal("0.01")

   def calculate_total(lines, discount=Decimal("0")):
       total = sum(line_total(q, p) for q, p in lines)
       total = total - discount
       total = total + total * TAX_RATE
       return total.quantize(CENT, rounding=ROUND_HALF_UP)
   ```
   Do not round in `line_total`: rounding each line can change the invoice total.
2. Tighten `validation.py:7` to `if computed != Decimal(stated_total):`. If the tolerance stays, rounding loosens the check: `21.80` is rejected today, but against a rounded `21.79` the difference is exactly 0.01, which passes.
3. Add tests that fail on the current code:
   - `calculate_total([(1, "19.99")]) == Decimal("21.79")`
   - `.as_tuple().exponent == -2`, which catches `21.8000`
   - a half-cent case: `[(1, "0.50")]` is exactly `0.545`, so `0.55` with HALF_UP
   - `monthly_report` returns 2dp values
   - `validate_invoice` rejects a stated `21.7891`

### Decisions needed
- Rounding mode: I assumed `ROUND_HALF_UP`. `quantize` without a mode would normally use `ROUND_HALF_EVEN`, giving `0.54` for the half-cent case. Finance should confirm.
- Exact match in validation: this rejects stated totals from any upstream system that rounds per line or per tax. Check what produces `stated_total` first; no producer is in this repo.
- Invoices already issued: this fix does not correct them. Decide whether they need reissuing.

### Separate issues (not part of this fix)
- Discounts are dropped on both production paths: `validation.py:6` and `report.py:5` pass none, and `monthly_report`'s input has no discount field. Totals are overstated if discounted invoices go through them.
- `docs://runbook` says to run `python -m src.legacy.report`, but `report.py` has no `__main__` block and only defines a function, so that command should do nothing. How the monthly job really runs is unknown.
- The code that renders customer-facing invoices is not in this repo, so the path to the customer's document is inferred, not traced. `schema://billing` is listed as a stub (not read), so stored column precision is unchecked.

### Next step
Get the decisions above, then apply steps 1-3 and run `python3 -m pytest -q`.

## Fix applied: outcome

This section supersedes the Status and Next step lines above. Step 1 of the proposed fix is done; steps 2 and 3 are not.

### Change
- `src/billing/invoice.py:16` is now `return total.quantize(Decimal("0.01"), rounding="ROUND_HALF_UP")`. Nothing else in the file changed.
- `rounding` is the string `"ROUND_HALF_UP"`, the value of `decimal.ROUND_HALF_UP`, so line 2's import did not need to change. This replaces the `CENT` constant and import in the proposal above.
- Edit accepted a two-line anchor that includes line 15, so the Read + Write fallback was not needed.

### Policy
`docs/runbook.txt:3` now says "Totals must be rounded to 2 dp (finance policy 2026-04)." It does not name a rounding mode; `ROUND_HALF_UP` came from the fix request.

### Result
`python3 -m pytest -q`: `2 passed`. These same 2 tests also passed before the fix, so they do not prove it. The direct calls below do.

| Call | Before | After |
|---|---|---|
| `calculate_total([(1, "19.99")])` | `21.7891` | `21.79` |
| `calculate_total([(3, "33.33")], Decimal("1.005"))` | `107.89365` | `107.89` |
| `calculate_total([(1, 0.1)])` | `0.1090000000000000060507154842` | `0.11` |
| `calculate_total([(1, "0.50")])` (half cent) | not run | `0.55` |
| `monthly_report({"A": [(1, "19.99")]})` | not run | `{"A": Decimal("21.79")}` |
| `line_total(3, "33.333")` (should stay unrounded) | not run | `99.999` |

### Regression in validation (still open)
As predicted, rounding loosened `validation.py:7`, because the tolerance is unchanged:
| `validate_invoice([(1, "19.99")], stated)` | Before | After |
|---|---|---|
| stated `21.80` | raises `ValueError` | passes (wrong by a cent) |
| stated `21.78` | passes | passes (wrong by a cent) |
| stated `21.7891` | not run | passes (more than 2dp) |

### Next step
- Step 2: decide on exact match at `validation.py:7`. First check what produces `stated_total`.
- Step 3: add the tests listed above; nothing in the suite yet guards this fix.
- The discount and runbook-command issues above are still open.

