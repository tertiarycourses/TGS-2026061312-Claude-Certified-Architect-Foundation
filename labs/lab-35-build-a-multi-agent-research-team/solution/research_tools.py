"""The research team's two tools. Both read sources.json (a fictional sandbox), never the real web."""
import json
from pathlib import Path

DATA = json.loads((Path(__file__).parent / "sources.json").read_text())


class ToolFailure(Exception):
    def __init__(self, category, message, retryable=False, **extra):
        super().__init__(message)
        self.info = {"errorCategory": category, "isRetryable": retryable, "message": message, **extra}


def sector_of(text):
    """The first sector in sources.json whose keyword appears in the text, or None."""
    low = text.lower()
    return next((s for s, words in DATA["sectors"].items() if any(w in low for w in words)), None)


def search_web(query):
    """Search the web for recent surveys and reports on ONE creative sector. Use a short query that names the sector."""
    sector = sector_of(query)
    if sector is None:
        return {"query": query, "sector": None, "results": []}
    hits = DATA["web"][sector]
    if isinstance(hits, dict):                      # this sector's search always times out
        raise ToolFailure("timeout", f"search timed out for '{query}'", retryable=False,
                          sector=sector, attempted_query=query, partial_results=hits["partial_results"])
    return {"query": query, "sector": sector, "results": hits}


def read_document(name):
    """Load one internal PDF by its exact file name. Returns its kind, page, publication date and text."""
    doc = next((d for d in DATA["documents"] if d["name"].lower() == name.strip().lower()), None)
    if doc is None:
        raise ToolFailure("not_found", f"no document named '{name}'", available=[d["name"] for d in DATA["documents"]])
    return doc


FUNCTIONS = {"search_web": search_web, "read_document": read_document}
TOOLS = {
    "search_web": {"name": "search_web", "description": search_web.__doc__,
                   "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    "read_document": {"name": "read_document", "description": read_document.__doc__ + " Available: "
                      + ", ".join(d["name"] for d in DATA["documents"]),
                      "input_schema": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}},
}


def run_tool(name, args):
    """Run one tool. Returns (result, is_error)."""
    try:
        return FUNCTIONS[name](**args), False
    except ToolFailure as e:
        return e.info, True
