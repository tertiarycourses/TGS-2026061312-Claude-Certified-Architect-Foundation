"""Claim-source schema shared by the synthesis subagent and the report generator.

Refactor 2026-10: `excerpt` was renamed to `quote`, and `citation` became a separate field."""
CLAIM_FIELDS = ("claim", "source_id", "quote", "citation")


def validate(item: dict) -> list[str]:
    return [f"missing {f}" for f in CLAIM_FIELDS if f not in item]
