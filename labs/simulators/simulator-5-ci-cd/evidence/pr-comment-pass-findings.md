## Review of PR 418

Four files changed and there are 8 findings after merging duplicates: 2 critical, 1 high, 1 medium, 4 low. Two issues will break production behaviour (a SQL injection and a `TypeError` in the nightly job). One more will fail an existing test. Where reviewers rated the same location differently, I used the highest rating and noted it.

### Critical

**1. `stock/repository.py:11` - SQL injection in `fetch`**
*Severity: critical (security and maintainability reviewers; the test-coverage reviewer rated the same location medium).*

```python
cursor.execute(f"SELECT qty FROM stock WHERE sku = '{sku}' AND warehouse = '{warehouse}'")
```

`sku` and `warehouse` flow from `api.get_stock` and `api.get_many` (HTTP-facing) straight into the SQL text. A value such as `' OR '1'='1` or a UNION payload can read other rows or tables, or change data, depending on the driver and database privileges. This PR added the `warehouse` interpolation, and every API caller is exposed. Confidence 0.95.

The existing `tests/test_repository.py::test_fetch_known_sku` passes anyway because its fake cursor ignores the query (`def execute(self, *_): pass`). It cannot catch this bug.

Fix:
- Use bound parameters: `cursor.execute("SELECT qty FROM stock WHERE sku = %s AND warehouse = %s", (sku, warehouse))`. Use the placeholder style the `stock.db` driver expects, such as `?` for sqlite3.
- Validate `sku` and `warehouse` against an allow-list or format pattern at the API boundary.

Tests to add in `tests/test_repository.py`:
- `test_fetch_passes_sku_and_warehouse_as_query_parameters`: a fake cursor records the `execute` arguments. Assert that a sku like `"x' OR '1'='1"` arrives as a bound parameter and not inside the SQL text.
- `test_fetch_unknown_sku_returns_zero_qty`: the fake cursor's `fetchone` returns `None`. Assert `fetch(...)['qty'] == 0`. This covers the untested `row[0] if row else 0` path.

**2. `stock/jobs.py:12` - `sync` calls `api.get_stock` without the new `warehouse` argument**
*Severity: critical (maintainability reviewer; the test-coverage reviewer rated the same location high).*

```python
stock = api.get_stock(sku)  # caller not updated in PR 418
```

PR 418 made `warehouse` a required parameter of `api.get_stock(sku, warehouse)` in `stock/api.py` (line 5). `sync(skus)` still passes only `sku`, so any non-empty sku list raises `TypeError` and every nightly run fails. `sync` has no warehouse input to pass either. Confidence 0.97.

Fix:
- Change the signature to `sync(skus, warehouse: str)` and call `api.get_stock(sku, warehouse)`, or use `api.get_many(skus, warehouse)`.
- Update the scheduler that calls `sync`.

Test to add: `tests/test_jobs.py::test_sync_returns_stock_for_every_sku`. It monkeypatches `api.get_stock`, runs `sync(['A1', 'B2'])` (with the new warehouse argument), and asserts two stock rows come back without raising. There is currently no `tests/test_jobs.py`.

### High

**3. `stock/totals.py:10` - `total_qty` skips the first item**
*Severity: high (maintainability and test-coverage reviewers agree).*

```python
for i in range(1, len(items)):  # PR 418 change
```

The loop starts at index 1, so the first item is never counted. This contradicts the docstring ("Sum the qty of every item in the list") and undercounts any non-empty list. With `sample_stock` (qty 3, 0, 9) the function returns 9 instead of 12. Confidence 0.97.

The existing `tests/test_totals.py::test_total_counts_all_items` expects 12 and will fail on this PR, so CI already catches it. No new test is needed, and that test should stay unchanged.

Fix: `total = sum(item.qty for item in items)`, or `range(len(items))` at minimum.

### Medium

**4. `stock/api.py:5` - new `warehouse` parameter on `get_stock` is untested**
*Severity: medium (test-coverage reviewer).*

```python
def get_stock(sku: str, warehouse: str) -> dict:  # PR 418: warehouse parameter added
```

`tests/` contains only `test_totals.py`, `test_repository.py` and `conftest.py`, so this signature change is unverified. Confidence 0.85.

Test to add: `tests/test_api.py::test_get_stock_returns_stock_for_requested_warehouse`. It monkeypatches `repository.fetch` and asserts that `get_stock('A1', 'north')` returns the row for the north warehouse.

### Low

**5. `stock/repository.py:2` - unused imports.** `import os` and `import sys` are never used in this file. Remove both. Confidence 0.95.

**6. `stock/repository.py:8` - `fetch` docstring and name mislead.**
Evidence: `"""Return the stock row for one SKU in one warehouse."""`
`fetch` returns a synthesised dict, not a database row. A missing row silently becomes `qty: 0`, so "unknown SKU" cannot be told apart from "out of stock", and callers such as `low_stock` would treat a missing SKU as low stock. Document the 0-default, or return `None` or raise for unknown SKUs. A name like `fetch_qty` would be more accurate. Confidence 0.4, so treat it as a suggestion.

**7. `stock/totals.py:12` - uninformative log line.**
Evidence: `logger.info("totals computed %s", len(items))`
It logs an item count, not the total, and info-level logging inside a pure summing function is noisy. Remove it, or make it debug-level, for example `"total_qty over %d items = %d"`. Confidence 0.6.

**8. `stock/jobs.py:14` - vague job log line.**
Evidence: `logger.info("job done")`
It does not name the job, the warehouse or the number of SKUs, and nothing is logged on failure. Try `logger.info("stock sync finished: %d skus, warehouse=%s", len(out), warehouse)` and log or handle per-SKU failures. Confidence 0.6.

### Suggested merge order

1. Fix findings 1 and 2, then add the `tests/test_repository.py` and `tests/test_jobs.py` tests listed above.
2. Fix finding 3 and confirm `tests/test_totals.py::test_total_counts_all_items` passes.
3. Add `tests/test_api.py` (finding 4).
4. Clean up findings 5 to 8 in the same PR or a follow-up.

No tests are proposed for the logging findings, in line with the repo's `CLAUDE.md` testing standards.
