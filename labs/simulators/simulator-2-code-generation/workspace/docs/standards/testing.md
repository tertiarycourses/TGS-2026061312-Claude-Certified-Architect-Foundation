# Testing standards
- Every bug fix ships with a regression test that fails before the fix.
- Use the fixtures in `tests/fixtures/` instead of inventing new sample data.
- Cover expected behaviour, one edge case and one failure path per public function.
