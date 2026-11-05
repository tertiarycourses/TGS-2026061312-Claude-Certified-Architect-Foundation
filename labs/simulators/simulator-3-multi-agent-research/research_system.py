#!/usr/bin/env python3
"""Simulator 3 - Multi-Agent Research System on the Claude Agent SDK.

A coordinator delegates to four subagents (web-search, document-analysis,
synthesis, report). The web and the document store are local mocks served
through an in-process MCP server, so the only thing you need is Claude Code
logged in on this machine.

    uv run research_system.py                 # broad decomposition (correct)
    uv run research_system.py --narrow        # the exam guide's failure mode
    uv run research_system.py --case UC-21    # one practice-test use case
    uv run research_system.py --case all      # every use case (reuses runs)

Evidence lands in evidence/run-<mode>.json, evidence/report-<mode>.md and,
for use cases, evidence/cases/UC-<id>.json.
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

from claude_agent_sdk import (
    AgentDefinition,
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
    create_sdk_mcp_server,
    query,
    tool,
)

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence"
CASES = HERE / "cases"
SOURCES = json.loads((HERE / "fixtures" / "sources.json").read_text())
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
BUDGET = float(os.environ.get("LAB_BUDGET_USD", "4.0"))
TOPIC = SOURCES["topic"]

# ----------------------------------------------------------------- mock backend
TOOL_CALLS: list[dict] = []          # every MCP call, for evidence
_timeout_attempts = {"count": 0}
STATE_FILE = EVIDENCE / "research_state.json"


def _text(payload) -> dict:
    return {"content": [{"type": "text", "text": json.dumps(payload, indent=1)}]}


@tool(
    "search_web",
    "Search the public web for recent articles, surveys and industry reports on one "
    "sub-topic. Input: a short query such as 'AI adoption in music production 2026'. "
    "Returns up to three hits, each with url, title, published date and an excerpt. "
    "A transient failure comes back as a structured error (failure_type, "
    "attempted_query, partial_results, alternatives) so you can decide whether to "
    "retry, rephrase, or report a coverage gap. Not for reading PDFs: use "
    "load_document for those.",
    {"query": str},
)
async def search_web(args):
    q = args["query"].lower()
    TOOL_CALLS.append({"tool": "search_web", "query": args["query"], "t": time.time()})
    web = SOURCES["web"]
    sector = next((s for s, pat in {
        "music": r"\b(music|musician|song|label|audio|composer)",
        "writing": r"\b(writ|author|book|publish|journal|novel|freelance writer)",
        "film": r"\b(film|vfx|video|cinema|television|tv|previs|storyboard)",
        "visual_arts": r"\b(visual art|artist|arts\b|design|photo|illustrat|graphic|painting)",
    }.items() if re.search(pat, q)), None)
    if sector is None:
        return _text({"results": [], "note": "valid empty result: no sector matched this query"})
    hits = web[sector]
    if hits == "TIMEOUT":
        _timeout_attempts["count"] += 1
        return {
            "is_error": True,
            "content": [{"type": "text", "text": json.dumps({
                "failure_type": "timeout",
                "attempted_query": args["query"],
                "attempts": _timeout_attempts["count"],
                "partial_results": [],
                "is_retryable": True,
                "alternatives": [
                    "retry once with a narrower query",
                    "ask document-analysis to cover visual arts from the WIPO PDF",
                    "report visual arts as a coverage gap in the final synthesis",
                ],
            }, indent=1)}],
        }
    return _text({"results": hits})


@tool(
    "load_document",
    "Load one PDF from the internal document store by its exact file name. "
    "Returns the relevant page excerpt together with the publication date; keep "
    "both in your findings. Available names: WIPO-Creative-Economy-2025.pdf, "
    "UNESCO-Culture-Report-2026.pdf. Not a web search.",
    {"doc_id": str},
)
async def load_document(args):
    TOOL_CALLS.append({"tool": "load_document", "doc_id": args["doc_id"], "t": time.time()})
    doc = next((d for d in SOURCES["documents"] if d["name"].lower() == args["doc_id"].lower()), None)
    if doc is None:
        return {"is_error": True, "content": [{"type": "text", "text": json.dumps({
            "failure_type": "not_found", "attempted_query": args["doc_id"], "is_retryable": False,
            "alternatives": [d["name"] for d in SOURCES["documents"]]})}]}
    return _text(doc)


@tool(
    "verify_fact",
    "Scoped fact-check for the synthesis agent only: confirms a single short claim "
    "(a date, a name, a sample size) against the fact bank. Returns verified true or "
    "false with the recorded value. Use it for simple checks; anything needing a new "
    "search goes back to the coordinator.",
    {"claim": str},
)
async def verify_fact(args):
    TOOL_CALLS.append({"tool": "verify_fact", "claim": args["claim"], "t": time.time()})
    bank = SOURCES["fact_bank"]
    claim = args["claim"].lower()
    for key, value in bank.items():
        tokens = [w for w in re.findall(r"[a-z0-9%]+", key.lower()) if len(w) > 3]
        if sum(w in claim for w in tokens) >= max(2, len(tokens) // 2):
            return _text({"fact": key, "recorded_value": value,
                          "verified": value.lower().replace(",", "") in claim.replace(",", "")})
    return _text({"verified": False, "reason": "no matching entry in fact bank; claim stays unverified, not refuted"})


@tool(
    "save_research_state",
    "Persist the research state (sector taxonomy, claim-to-source map, rejected sources, open "
    "questions) as JSON so later phases start from facts instead of a long transcript. Input: "
    "the state object as a JSON string.",
    {"state_json": str},
)
async def save_research_state(args):
    TOOL_CALLS.append({"tool": "save_research_state", "t": time.time()})
    try:
        state = json.loads(args["state_json"])
    except json.JSONDecodeError as e:
        return {"is_error": True, "content": [{"type": "text", "text": f"state_json is not valid JSON: {e}"}]}
    EVIDENCE.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))
    return _text({"saved": str(STATE_FILE.name), "keys": list(state)})


@tool(
    "load_research_state",
    "Load the research state saved earlier in this run. Call it right before you build the "
    "synthesis packet and copy the taxonomy and source map into that packet.",
    {},
)
async def load_research_state(args):
    TOOL_CALLS.append({"tool": "load_research_state", "t": time.time()})
    if not STATE_FILE.exists():
        return {"is_error": True, "content": [{"type": "text", "text": "no research state saved yet"}]}
    return {"content": [{"type": "text", "text": STATE_FILE.read_text()}]}


research = create_sdk_mcp_server("research", tools=[search_web, load_document, verify_fact,
                                                     save_research_state, load_research_state])
SEARCH, LOAD, VERIFY = "mcp__research__search_web", "mcp__research__load_document", "mcp__research__verify_fact"
SAVE, LOADSTATE = "mcp__research__save_research_state", "mcp__research__load_research_state"

# ------------------------------------------------------------------- subagents
DOC_PROMPT = (
    "Load each document named in your prompt with load_document. Return ONLY JSON: "
    "{\"findings\": [{\"claim\": str, \"value\": str, \"document\": str, \"page\": int, "
    "\"published\": \"YYYY-MM-DD\", \"methodology_note\": str{EXTRA}}]}. When two documents give "
    "different values for the same quantity, include BOTH findings unchanged and add "
    "\"conflict_with\": <other document>; do not pick a winner."
)
ENUM_EXTRA = (
    ", \"evidence_type\": one of [\"experiment\", \"survey\", \"expert_interview\", \"market_report\", "
    "\"unclear\", \"other\"], \"other_detail\": str (required when evidence_type is other, else \"\")"
    "}. Pick \"unclear\" when the passage does not say how the number was produced; pick \"other\" "
    "with a short other_detail for a source type not in the list; never force a vague passage into "
    "a specific category. {"
)


def agents(mode: str) -> dict:
    a = {
        "web-search": AgentDefinition(
            description="Searches the web for one sub-topic and returns dated, cited findings as JSON.",
            prompt=(
                "You research exactly the sub-topic in your prompt using search_web: at most THREE queries, "
                "each naming the sector (e.g. 'AI adoption in music production 2026'). The corpus is a small "
                "sandbox; take what it returns and stop. Return ONLY a JSON object: {\"subtopic\": str, "
                "\"findings\": [{\"claim\": str, \"value\": str, \"source_url\": str, \"source_title\": str, "
                "\"published\": \"YYYY-MM-DD\"}], \"errors\": [...], \"coverage\": \"complete|partial|none\"}. "
                "If search_web returns a structured error, retry ONCE with a narrower query; if it fails "
                "again, copy the error object into \"errors\" and set coverage to \"none\". Never invent a "
                "number that is not in a search result."
            ),
            tools=[SEARCH], model="sonnet",
        ),
        "document-analysis": AgentDefinition(
            description="Reads internal PDFs with load_document and extracts every statistic with page and date.",
            prompt=DOC_PROMPT.replace("{EXTRA}", ENUM_EXTRA if mode == "enum" else ""),
            tools=[LOAD], model="sonnet",
        ),
        "synthesis": AgentDefinition(
            description="Merges findings from the other agents into a claim-source table, preserving conflicts and gaps.",
            prompt=(
                "You receive findings as JSON in your prompt; you have no other context. Produce ONLY JSON: "
                "{\"claims\": [{\"claim\": str, \"value\": str, \"status\": \"established|contested\", "
                "\"sources\": [{\"name\": str, \"published\": str}], \"conflict_note\": str|null}], "
                "\"coverage_gaps\": [str], \"verifications\": [{\"claim\": str, \"verified\": bool}]}. "
                "Keep conflicting values side by side with attribution. Use verify_fact for at most two "
                "simple checks (a date, a sample size). Do not search; if something needs a new search, "
                "put it in coverage_gaps."
            ),
            tools=[VERIFY], model="sonnet",
        ),
        "report": AgentDefinition(
            description="Turns a synthesis JSON into the final cited markdown report.",
            prompt=(
                "Write the final report in markdown from the synthesis JSON in your prompt. Required "
                "sections: '## Established findings', '## Contested findings' (each conflicting value with "
                "its source and date, side by side), '## Coverage gaps', and a statistics table with columns "
                "Claim | Value | Source | Published. Financial or survey numbers go in the table, narrative "
                "context in prose. Do not add facts that are not in the synthesis."
            ),
            tools=[], model="sonnet",
        ),
    }
    if mode == "review":
        a["reviewer"] = AgentDefinition(
            description="Independent reviewer with a fresh context: checks one bundle of claims against the excerpts it is given.",
            prompt=(
                "You review ONLY the claim-source bundle in your prompt; you have seen nothing else. For each "
                "claim return JSON: {\"reviews\": [{\"claim\": str, \"supported\": bool, \"reason\": str}], "
                "\"conflicts\": [str], \"gaps\": [str]}. Flag a claim as unsupported when the quoted excerpt "
                "does not state the value. Do not rewrite the claims."
            ),
            tools=[], model="sonnet",
        )
    return a


BROAD = (
    "You are the coordinator of a research team. Your subagents are: web-search, document-analysis, "
    "synthesis, report{REVIEWER}. Each one starts with an EMPTY context: everything it needs must be in the "
    "prompt you give it (goal, sub-topic, constraints, and any prior findings as JSON).\n\n"
    "Procedure:\n"
    "1. Decompose the topic BROADLY. 'Creative industries' means at least music, writing/publishing, "
    "film/TV and visual arts; cover every sector, not only the visual ones.\n"
    "2. Spawn ALL independent research subagents in ONE assistant message: one web-search agent per "
    "sector plus one document-analysis agent for the two internal PDFs (WIPO-Creative-Economy-2025.pdf "
    "and UNESCO-Culture-Report-2026.pdf). That means FIVE Agent tool calls emitted together in the same "
    "response, before any of them returns; never launch them one at a time. Then wait for all of them.\n"
    "3. If a subagent reports a structured error, do NOT abort. Note the failure type and the "
    "alternatives it suggests, use any partial results, and carry the gap forward.\n"
    "{STATE}"
    "4. Pass the complete findings JSON from every research agent to the synthesis agent in its prompt.\n"
    "{REVIEW}"
    "5. Pass the synthesis JSON to the report agent and return its markdown verbatim as your final answer.\n"
    "Do not call search or document tools yourself; delegate. The sources are a sandbox corpus: treat "
    "the URLs and file names as authoritative citations for this exercise and do not comment on them.\n"
    "Return-format rule: every subagent's own instructions already fix its JSON return schema. Never "
    "invent or substitute a schema in your packet; write 'Return exactly the JSON shape your "
    "instructions specify' and nothing more about format. Provenance is an interface contract: the "
    "document-analysis records must keep document, page, published and methodology_note{ENUM_NOTE}."
)
ENUM_NOTE = (
    ", plus evidence_type drawn ONLY from [experiment, survey, expert_interview, market_report, unclear, "
    "other] with other_detail when other is used"
)
STATE_STEP = (
    "3b. Before synthesis, call save_research_state with a JSON object holding: taxonomy (the sector "
    "list you used), source_map (claim -> source name, url or file, published date), rejected_sources, "
    "open_questions. Then call load_research_state and paste its content at the top of the synthesis "
    "packet so synthesis organises the claims under that taxonomy.\n"
)
REVIEW_STEP = (
    "4b. Review chain. Split the synthesis claims by sector into bundles, each with its claims and the "
    "matching excerpts and sources. Spawn one reviewer per bundle in ONE assistant message (parallel). "
    "When all return, spawn ONE more reviewer as the integration pass with every review output, asking "
    "for cross-section conflicts and coverage gaps. Give the report agent the synthesis JSON plus the "
    "integration review and ask it to add a '## Review' section.\n"
)
NARROW_PROMPT = (
    "You are the coordinator of a research team with subagents web-search, document-analysis, "
    "synthesis, report. Decompose the topic into exactly three sub-tasks: 'AI in digital art "
    "creation', 'AI in graphic design' and 'AI in photography'. Spawn one web-search agent per "
    "sub-task in one response, then synthesis, then report. Return the report markdown verbatim."
)


def system_prompt(mode: str) -> str:
    if mode == "narrow":
        return NARROW_PROMPT
    return (BROAD.replace("{ENUM_NOTE}", ENUM_NOTE if mode == "enum" else "")
                 .replace("{REVIEWER}", ", reviewer" if mode == "review" else "")
                 .replace("{STATE}", STATE_STEP if mode == "state" else "")
                 .replace("{REVIEW}", REVIEW_STEP if mode == "review" else ""))


# --------------------------------------------------------------------- the run
async def run_mode(mode: str, prompt: str) -> dict:
    EVIDENCE.mkdir(exist_ok=True)
    TOOL_CALLS.clear()
    _timeout_attempts["count"] = 0
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    ag = agents(mode)
    allowed = ["Agent", SEARCH, LOAD, VERIFY] + ([SAVE, LOADSTATE] if mode == "state" else [])
    options = ClaudeAgentOptions(
        model=MODEL, system_prompt=system_prompt(mode), mcp_servers={"research": research},
        allowed_tools=allowed, agents=ag, permission_mode="bypassPermissions",
        max_turns=40, max_budget_usd=BUDGET, cwd=str(HERE),
        env={"CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1"},
    )
    run = {
        "mode": mode, "model": MODEL, "topic": TOPIC, "prompt": prompt,
        "coordinator": {"allowed_tools": allowed},
        "agents": {k: {"tools": v.tools, "model": v.model} for k, v in ag.items()},
        "assistant_turns": [], "subagent_messages": 0, "structured_errors": [],
        "subagent_results": [], "tool_calls": TOOL_CALLS,
    }
    turns_by_id: dict = {}
    sub_text: dict = {}
    final = ""
    async for msg in query(prompt=prompt, options=options):
        simkit.narrate(msg)
        if isinstance(msg, SystemMessage) and msg.subtype == "init":
            run["init_tools"] = msg.data.get("tools")
        elif isinstance(msg, AssistantMessage):
            inside = bool(getattr(msg, "parent_tool_use_id", None))
            spawns = [b for b in msg.content if isinstance(b, ToolUseBlock) and b.name in ("Agent", "Task")]
            if inside:
                run["subagent_messages"] += 1
                text = " ".join(b.text for b in msg.content if isinstance(b, TextBlock)).strip()
                if text:
                    sub_text[msg.parent_tool_use_id] = text      # keep the latest text = the hand-back
                continue
            # The CLI streams one SDK message per content block, so one API response
            # holding five Agent calls arrives as five messages sharing a message_id.
            turn = turns_by_id.get(msg.message_id)
            if turn is None:
                turn = {"message_id": msg.message_id, "agent_calls_in_this_response": 0,
                        "subagent_types": [], "packets": [], "text": ""}
                turns_by_id[msg.message_id] = turn
                run["assistant_turns"].append(turn)
            turn["agent_calls_in_this_response"] += len(spawns)
            turn["subagent_types"] += [b.input.get("subagent_type") for b in spawns]
            turn["packets"] += [{"subagent_type": b.input.get("subagent_type"),
                                 "prompt_chars": len(b.input.get("prompt", "")),
                                 "prompt_head": b.input.get("prompt", "")[:160],
                                 "prompt": b.input.get("prompt", "")} for b in spawns]
            turn["text"] += " ".join(b.text for b in msg.content if isinstance(b, TextBlock))[:400]
            if spawns:
                print(f"[coordinator] response {str(msg.message_id)[-6:]} now holds "
                      f"{turn['agent_calls_in_this_response']} Agent call(s): {turn['subagent_types']}")
        elif isinstance(msg, UserMessage):
            inside = bool(getattr(msg, "parent_tool_use_id", None))
            if inside:
                run["subagent_messages"] += 1
            for b in (msg.content if isinstance(msg.content, list) else []):
                if not isinstance(b, ToolResultBlock):
                    continue
                body = b.content if isinstance(b.content, str) else json.dumps(b.content)
                if b.is_error and "failure_type" in body:
                    run["structured_errors"].append(body[:600])
                    print("[tool] structured error observed:", body[:110].replace("\n", " "))
                elif not inside and not b.is_error:
                    run["subagent_results"].append(body[:20000])
        elif isinstance(msg, ResultMessage):
            run["result"] = {"subtype": msg.subtype, "num_turns": msg.num_turns,
                             "total_cost_usd": msg.total_cost_usd, "session_id": msg.session_id,
                             "duration_ms": msg.duration_ms}
            final = msg.result or ""
            print(f"[result] {msg.subtype} turns={msg.num_turns} cost=${(msg.total_cost_usd or 0):.4f}")
    run["subagent_outputs"] = list(sub_text.values())
    run["max_parallel_spawns"] = max((t["agent_calls_in_this_response"] for t in run["assistant_turns"]), default=0)
    run["report_markdown"] = final
    run["report_markdown_chars"] = len(final)
    if STATE_FILE.exists():
        run["research_state"] = json.loads(STATE_FILE.read_text())
    suffix = "" if mode == "broad" else f"-{mode}"
    (EVIDENCE / f"run{suffix}.json").write_text(json.dumps(run, indent=2))
    (EVIDENCE / f"report{suffix}.md").write_text(final)
    print(f"[evidence] evidence/run{suffix}.json, evidence/report{suffix}.md")
    return run


def load_run(mode: str):
    p = EVIDENCE / ("run.json" if mode == "broad" else f"run-{mode}.json")
    return json.loads(p.read_text()) if p.exists() else None


# ---------------------------------------------------------------- use cases
def packets(run, kind):
    return [p for t in run["assistant_turns"] for p in t["packets"] if p["subagent_type"] == kind]


def spawn_order(run):
    return [p["subagent_type"] for t in run["assistant_turns"] for p in t["packets"]]


def first_json(text: str):
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    return None


def doc_result(run):
    """The document-analysis subagent's final JSON (its last message, or the Agent tool result)."""
    for body in list(run.get("subagent_outputs", [])) + list(run.get("subagent_results", [])):
        if "methodology_note" not in body:
            continue
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = None
        if isinstance(parsed, dict):           # the hand-back itself was the JSON object
            if parsed.get("findings"):
                return parsed
            continue
        if isinstance(parsed, list):           # a list of content blocks (Agent tool result)
            text = " ".join(b.get("text", "") for b in parsed if isinstance(b, dict))
        else:
            text = body
        obj = first_json(text) or first_json(text.encode().decode("unicode_escape"))
        if obj and obj.get("findings"):
            return obj
    return None


def evaluate(case: dict, run: dict) -> list[dict]:
    uc = case["id"]
    syn = packets(run, "synthesis")
    rep = packets(run, "report")
    syn_prompt = syn[0]["prompt"] if syn else ""
    rl = run["report_markdown"].lower()
    sources = ["example.org/ifpi", "example.org/musicians", "example.org/authors", "example.org/vfx",
               "wipo-creative-economy", "unesco-culture-report"]
    hits = lambda s: sum(x in s.lower() for x in sources)
    order = spawn_order(run)
    R: list = []
    if uc == "UC-06":
        revs = [t for t in run["assistant_turns"] if t["subagent_types"].count("reviewer") >= 2]
        last_rev = max((i for i, k in enumerate(order) if k == "reviewer"), default=-1)
        section = revs[0]["subagent_types"].count("reviewer") if revs else 0
        R = [("reviewer agents spawned >=2 in one response", bool(revs)),
             ("an integration reviewer runs after the section reviewers",
              order.count("reviewer") > section and last_rev > -1 and order[last_rev:].count("report") == 1),
             ("report still includes the coverage gap and contested findings", "coverage gap" in rl and "contested" in rl)]
    elif uc == "UC-10":
        R = [("synthesis packet >= 2000 characters", len(syn_prompt) >= 2000),
             ("synthesis packet contains at least 3 source URLs or document names", hits(syn_prompt) >= 3),
             ("synthesis packet contains publication dates", len(re.findall(r"20\d\d-\d\d-\d\d", syn_prompt)) >= 3)]
    elif uc == "UC-19":
        rv = packets(run, "reviewer")
        section = rv[:-1] if len(rv) >= 2 else []
        R = [("each section-review packet is smaller than the synthesis packet",
              bool(section) and all(p["prompt_chars"] < max(1, len(syn_prompt)) for p in section)),
             ("integration pass launched after all section reviews returned",
              len(rv) >= 3 and order[-2:] == ["reviewer", "report"]),
             ("final report mentions the integration review", "review" in rl)]
    elif uc == "UC-21":
        tools = [c["tool"] for c in run["tool_calls"]]
        st = run.get("research_state") or {}
        tax = st.get("taxonomy") or []
        tax_names = [t if isinstance(t, str) else json.dumps(t) for t in (tax if isinstance(tax, list) else list(tax))]
        R = [("save_research_state called before load_research_state",
              "save_research_state" in tools and "load_research_state" in tools
              and tools.index("save_research_state") < tools.index("load_research_state")),
             ("research_state.json holds a taxonomy with >=3 sectors and a source map",
              len(tax_names) >= 3 and bool(st.get("source_map"))),
             ("synthesis packet contains the taxonomy sector names",
              bool(tax_names) and sum(n.lower()[:6] in syn_prompt.lower() for n in tax_names) >= 3)]
    elif uc == "UC-24":
        d = doc_result(run)
        f = (d or {}).get("findings", [])
        keys = {"document", "page", "published", "methodology_note"}
        sme = [x for x in f if "sme" in json.dumps(x).lower()]
        R = [("document-analysis result parses as JSON with a findings list", bool(f)),
             ("every finding has document, page, published and methodology_note", bool(f) and all(keys <= set(x) for x in f)),
             ("the two SME adoption findings are both present with conflict_with set",
              len(sme) >= 2 and sum(bool(x.get("conflict_with")) for x in sme) >= 2)]
    elif uc == "UC-28":
        d = doc_result(run)
        f = (d or {}).get("findings", [])
        enum = {"experiment", "survey", "expert_interview", "market_report", "unclear", "other"}
        R = [("every evidence_type is a member of the six-value enum", bool(f) and all(x.get("evidence_type") in enum for x in f)),
             ("no finding is forced into a specific category when the text is vague",
              bool(f) and (any(x.get("evidence_type") in ("unclear", "other") for x in f)
                           or all(x.get("methodology_note") for x in f))),
             ("every other has a non-empty other_detail",
              all(x.get("other_detail") for x in f if x.get("evidence_type") == "other"))]
    elif uc == "UC-35":
        R = [("synthesis packet contains >=3 source links/doc names from phase 1", hits(syn_prompt) >= 3),
             ("report packet contains the synthesis output (>=1500 chars)", bool(rep) and rep[0]["prompt_chars"] >= 1500),
             ("no packet exceeds 60000 characters (no full transcripts)",
              all(p["prompt_chars"] <= 60000 for t in run["assistant_turns"] for p in t["packets"]))]
    return [{"check": n, "passed": bool(p)} for n, p in R]


async def run_case(uc: str, fresh: bool):
    case = json.loads((CASES / f"{uc}.json").read_text())
    task = case["task"]
    out = {"id": uc, "title": case["title"], "source": case["source"], "type": task["type"]}
    (EVIDENCE / "cases").mkdir(parents=True, exist_ok=True)
    if task.get("driver") == "rules_sim.py":
        rs_file = EVIDENCE / "rules_sim.json"
        if fresh or not rs_file.exists():
            print(f"[{uc}] running rules_sim.py (eight claude -p calls)")
            import subprocess
            subprocess.run([sys.executable, "-B", str(HERE / "rules_sim.py")], cwd=HERE, check=False)
        else:
            print(f"[{uc}] reusing evidence/rules_sim.json (pass --fresh to rerun)")
        rs = json.loads(rs_file.read_text())["variants"]
        tok = lambda v, k: rs[v]["runs"][k]["token_seen"]
        out.update(command="uv run rules_sim.py", config_change=task.get("config_change"),
                   cost_usd=sum((x["cost_usd"] or 0) for v in rs.values() for x in v["runs"].values()),
                   matrix={v: {"copies": rs[v]["guidance_copies"], "test": tok(v, "test"), "impl": tok(v, "impl")} for v in rs},
                   rubric=[{"check": case["rubric"][0], "passed": tok("D", "test") and not tok("D", "impl") and rs["D"]["guidance_copies"] == 1},
                           {"check": case["rubric"][1], "passed": all(tok(v, k) for v in "AB" for k in ("test", "impl"))},
                           {"check": case["rubric"][2], "passed": rs["C"]["guidance_copies"] == 3 and tok("C", "impl")}])
    elif task["type"] == "discussion":
        out.update(prompt=task["prompt_template"], expected_answer=task["expected_answer"],
                   rubric=[{"check": r, "passed": None, "note": "learner-assessed"} for r in case["rubric"]])
        print(f"[{uc}] discussion use case. Prompt:\n  {task['prompt_template']}\n  Expected: {task['expected_answer'][:160]}...")
    else:
        mode = task["mode"]
        prompt = task["prompt_template"].replace("{{topic}}", TOPIC)
        run = None if fresh else load_run(mode)
        if run is None or run.get("prompt") != prompt:
            print(f"[{uc}] running mode={mode}")
            run = await run_mode(mode, prompt)
        else:
            print(f"[{uc}] reusing evidence/run{'' if mode == 'broad' else '-' + mode}.json (pass --fresh to rerun)")
        out.update(mode=mode, prompt=prompt, config_change=task.get("config_change"),
                   cost_usd=run["result"]["total_cost_usd"], rubric=evaluate(case, run))
    for r in out["rubric"]:
        print(f"  {'PASS' if r['passed'] else ('----' if r['passed'] is None else 'FAIL')} - {r['check']}")
    (EVIDENCE / "cases" / f"{uc}.json").write_text(json.dumps(out, indent=2))


async def main():
    args = sys.argv[1:]
    fresh = "--fresh" in args
    if "--case" in args:
        wanted = args[args.index("--case") + 1]
        ids = sorted(p.stem for p in CASES.glob("UC-*.json")) if wanted == "all" else [wanted]
        for uc in ids:
            await run_case(uc, fresh)
        return
    if "--ask" in args:  # the website's live question; the shipped run.json stays as it is
        await run_mode("ask", args[args.index("--ask") + 1])
        return
    mode = "narrow" if "--narrow" in args else "broad"
    await run_mode(mode, f"Research this topic and deliver a cited report: {TOPIC}.")


if __name__ == "__main__":
    asyncio.run(main())
