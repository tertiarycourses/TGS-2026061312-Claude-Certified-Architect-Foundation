"""Turn synthesis output into the final report section."""
TEMPLATE = "- {claim} [{source_id}]\n  > {quote}\n"


def render(items: list[dict]) -> str:
    out = []
    for it in items:
        out.append(TEMPLATE.format(claim=it.get("claim", ""), source_id=it.get("source_id", ""), quote=it.get("quote", "")))
    return "".join(out)
