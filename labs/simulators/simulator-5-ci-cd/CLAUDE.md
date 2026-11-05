# Stock tracking service: CI review context

## Testing standards
- pytest; one test file per module under tests/.
- A valuable test asserts behaviour a user would notice, not implementation detail.
- Fixtures live in tests/conftest.py: `sample_stock` (3 SKUs), `empty_stock`.
- Do not propose tests for logging, private helpers, or scenarios already in tests/.

## Review criteria
See prompts/review-criteria.txt. Findings must validate against finding.schema.json.
