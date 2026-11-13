"""The engine behind all six simulators: Python on the Claude Agent SDK and the Claude API.

Every run uses your Anthropic API key (ANTHROPIC_API_KEY in labs/.env, or the course folder's .env)
and one model only: Claude Haiku 5.5 (claude-haiku-5-5).
"""
import asyncio, json, os, shlex, sys
from pathlib import Path
from types import SimpleNamespace

HAIKU = "claude-haiku-5-5"


def load_key():
    """Find ANTHROPIC_API_KEY: the environment first, then the nearest .env walking up from labs/."""
    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        return True
    try:
        from dotenv import load_dotenv
    except ImportError:
        load_dotenv = None
    here = Path(__file__).resolve().parent
    for d in [here, *here.parents]:
        f = d / ".env"
        if f.is_file():
            if load_dotenv:
                load_dotenv(f, override=False)
            else:  # tiny fallback parser
                for line in f.read_text(encoding="utf-8").splitlines():
                    k, sep, v = line.partition("=")
                    if sep and k.strip() and not k.strip().startswith("#"):
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            if os.environ.get("ANTHROPIC_API_KEY", "").strip():
                return True
    return False


HAS_KEY = load_key()
# An OAuth token or a nested Claude Code session must not override the key.
for _k in ("ANTHROPIC_AUTH_TOKEN", "CLAUDECODE"):
    os.environ.pop(_k, None)
# Every model alias Claude Code might reach for (subagents, background calls) resolves to Haiku 5.5.
HAIKU_ENV = {"ANTHROPIC_MODEL": HAIKU, "ANTHROPIC_DEFAULT_HAIKU_MODEL": HAIKU, "ANTHROPIC_DEFAULT_SONNET_MODEL": HAIKU,
             "ANTHROPIC_DEFAULT_OPUS_MODEL": HAIKU, "ANTHROPIC_SMALL_FAST_MODEL": HAIKU, "CLAUDE_CODE_SUBAGENT_MODEL": HAIKU}
os.environ.update(HAIKU_ENV)

from claude_agent_sdk import (AgentDefinition, AssistantMessage, ClaudeAgentOptions, ResultMessage, SystemMessage, TextBlock, ThinkingBlock,
                              ToolResultBlock, ToolUseBlock, UserMessage, create_sdk_mcp_server, query, tool)
from claude_agent_sdk.types import StreamEvent

MODEL = HAIKU  # the course runs every Claude call on Haiku 5.5
ON_EVENT = None  # the website sets this to stream lines into its console

sys.path.insert(0, str(Path(__file__).resolve().parent))
import atexit, costnote  # the estimated API cost line at the end of every run

_COST = {"usd": 0.0, "calls": 0}


def record_cost(usd):
    """Log one finished Claude run. A launcher's ledger collects it; run on its own, the script prints the total at exit."""
    _COST["usd"] += float(usd or 0); _COST["calls"] += 1
    costnote.record(os.environ.get(costnote.ENV), usd)


@atexit.register
def _cost_at_exit():
    if _COST["calls"] and not os.environ.get(costnote.ENV) and not ON_EVENT:
        print("\n" + costnote.note(_COST["usd"], _COST["calls"]), flush=True)


def emit(line):
    print(line, flush=True)
    if ON_EVENT:
        ON_EVENT(line)


def short(v, n=110):
    s = v if isinstance(v, str) else json.dumps(v, default=str)
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


_LOOP = {}          # one entry per agent: which turn it is on, and tool results waiting to print
_MAX_TURNS = None


def options(**kw):
    """ClaudeAgentOptions for one lab run. Only this lab's tools load: none of your personal connectors, plugins or settings.

    That keeps runs quick, and the same on every laptop. Partial messages carry Claude's real stop_reason."""
    global _MAX_TURNS
    _MAX_TURNS = kw.get("max_turns")
    kw.setdefault("setting_sources", [])
    kw["model"] = MODEL  # Haiku 5.5, whatever the caller asked for
    kw["include_partial_messages"] = True
    project_mcp = "project" in kw["setting_sources"] and kw.get("cwd") and (Path(kw["cwd"]) / ".mcp.json").exists()
    env = {"ENABLE_CLAUDEAI_MCP_SERVERS": "false", **HAIKU_ENV}
    if not project_mcp:  # this lab's own tools are all there is, so nothing needs searching for
        env["ENABLE_TOOL_SEARCH"] = "false"
        kw["extra_args"] = {"strict-mcp-config": None, **(kw.get("extra_args") or {})}
    kw["env"] = {**env, **(kw.get("env") or {})}
    return ClaudeAgentOptions(**kw)


def _state(parent):
    return _LOOP.setdefault(parent, {"turn": 0, "waiting": [], "open": False, "calls": 0, "resume": False})


def _next_turn(parent):
    s = _state(parent)
    s["turn"] += 1
    s["open"] = True
    who = "Subagent turn" if parent else "Turn"
    extra = ", with the tool results appended" if s["turn"] > 1 else ""
    emit(f"{who} {s['turn']}: sending the conversation to Claude{extra}")


def _flush(s):
    for line in s["waiting"]:
        emit(line)
    s["waiting"].clear()


def _advance(parent):
    """Once Claude has stopped on tool_use and every tool has answered, the loop goes round again."""
    s = _state(parent)
    if s["resume"]:
        _flush(s)
        if s["calls"] <= 0:
            s["resume"] = False
            if parent or not (_MAX_TURNS and s["turn"] >= int(_MAX_TURNS)):
                _next_turn(parent)


def _text_of(content):
    if isinstance(content, dict) and "content" in content:  # a tool that wrapped its own answer
        return _text_of(content["content"])
    if isinstance(content, list):
        content = " ".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in content)
    if isinstance(content, str) and content.startswith('{"content"'):  # a tool that wrapped its own answer
        try:
            return _text_of(json.loads(content)["content"])
        except (ValueError, KeyError):
            pass
    return content if content is not None else ""


def narrate(msg, seen=None):
    """Print every step of the agentic loop as it happens, with Claude's real stop_reason, so a run is never silent."""
    if isinstance(msg, SystemMessage):
        if msg.subtype == "init" and not _state(None)["turn"]:
            names = [n.split("__")[-1] for n in msg.data.get("tools", [])]
            tools = ", ".join(names) if len(names) <= 8 else f"{len(names)} available"
            emit(f"  connected: {msg.data.get('model', '')}, tools: {tools or 'none'}")
            _next_turn(None)
    elif isinstance(msg, StreamEvent):
        parent, e = msg.parent_tool_use_id, msg.event
        s = _state(parent)
        who = "  (subagent)" if parent else ""
        if e.get("type") == "message_start":
            _flush(s)
            if not s["open"]:
                _next_turn(parent)
        elif e.get("type") == "message_delta" and e.get("delta", {}).get("stop_reason"):
            why = e["delta"]["stop_reason"]
            s["open"] = False
            if why == "tool_use":
                emit(f"  stop_reason: tool_use -> CONTINUE: run the tool, append its result, call Claude again{who}")
                s["resume"] = True
                _advance(parent)
            elif why == "end_turn":
                emit(f"  stop_reason: end_turn -> STOP: Claude has finished, so the loop ends{who}")
            else:
                emit(f"  stop_reason: {why}{who}")
    elif isinstance(msg, AssistantMessage):
        parent = msg.parent_tool_use_id
        who = "  (subagent)" if parent else ""
        for b in msg.content:
            if isinstance(b, ToolUseBlock):
                _state(parent)["calls"] += 1
                emit(f"  -> {b.name.split('__')[-1]}({short(b.input)}){who}")
            elif isinstance(b, ThinkingBlock) and b.thinking.strip():
                emit(f"  thinking: {short(b.thinking, 160)}{who}")
            elif isinstance(b, TextBlock) and b.text.strip():
                emit(f"  claude: {short(b.text, 200)}{who}")
    elif isinstance(msg, UserMessage) and isinstance(msg.content, list):
        parent = getattr(msg, "parent_tool_use_id", None)
        s = _state(parent)
        for b in msg.content:
            if isinstance(b, ToolResultBlock):
                s["calls"] -= 1
                s["waiting"].append(f"  !! tool error: {short(_text_of(b.content), 160)}" if b.is_error else f"  <- result: {short(_text_of(b.content), 160)}")
        _advance(parent)
    elif isinstance(msg, ResultMessage):
        for s in _LOOP.values():
            _flush(s)
        _LOOP.clear()
        record_cost(msg.total_cost_usd)
        emit(f"  done: {msg.subtype}, {msg.num_turns} turns, est. API cost ${(msg.total_cost_usd or 0):.4f}")


PRESET = {"type": "preset", "preset": "claude_code"}


def _agents(text):
    if not text:
        return None
    raw = json.loads(text) if isinstance(text, str) else text
    return {k: AgentDefinition(description=v.get("description", k), prompt=v.get("prompt", ""), tools=v.get("tools"), model="inherit") for k, v in raw.items()}


async def _run(prompt, opts):
    out = {"result": None, "session_id": None, "total_cost_usd": 0, "num_turns": 0, "subtype": None, "structured_output": None, "permission_denials": [], "is_error": False}
    # Who saw what: tool calls and tool-result characters in the main thread vs inside subagents.
    ctx = out["context"] = {"main": {"tool_calls": [], "tool_result_chars": 0}, "subagent": {"tool_calls": [], "tool_result_chars": 0}}
    got = False
    try:
        async for m in query(prompt=prompt, options=opts):
            narrate(m)
            if isinstance(m, AssistantMessage):
                side = ctx["subagent" if m.parent_tool_use_id else "main"]
                side["tool_calls"] += [b.name.split("__")[-1] for b in m.content if isinstance(b, ToolUseBlock)]
            elif isinstance(m, UserMessage) and isinstance(m.content, list):
                side = ctx["subagent" if getattr(m, "parent_tool_use_id", None) else "main"]
                side["tool_result_chars"] += sum(len(_text_of(b.content)) for b in m.content if isinstance(b, ToolResultBlock))
            if isinstance(m, ResultMessage):
                got = True
                out.update(result=m.result, session_id=m.session_id, total_cost_usd=m.total_cost_usd or 0, num_turns=m.num_turns, subtype=m.subtype,
                           structured_output=m.structured_output, permission_denials=list(m.permission_denials or []), is_error=bool(m.is_error))
    except Exception as e:  # the SDK raises after an error result; keep what arrived
        if not got:
            out.update(is_error=True, subtype="exception", result=str(e))
            emit(f"  !! {e}")
    return out


def run_agent(prompt, *, cwd=None, model=None, mode=None, max_turns=None, tools=None, disallowed=None, schema=None, settings=None, agents=None,
              resume=None, fork=False, name=None, effort=None, system=PRESET, sources=("project", "local")):
    """One Claude Code run through the Agent SDK. Returns the same fields as a `claude -p --output-format json` envelope."""
    kw = dict(model=MODEL, cwd=str(cwd) if cwd else None, system_prompt=system, setting_sources=list(sources) if sources else None)
    if mode: kw["permission_mode"] = mode
    if max_turns: kw["max_turns"] = int(max_turns)
    if tools: kw["allowed_tools"] = list(tools)
    if disallowed: kw["disallowed_tools"] = list(disallowed)
    if schema: kw["output_format"] = {"type": "json_schema", "schema": schema}
    if settings: kw["settings"] = settings if isinstance(settings, str) else json.dumps(settings)
    if agents: kw["agents"] = _agents(agents)
    if resume: kw["resume"] = resume
    if fork: kw["fork_session"] = True
    if effort: kw["effort"] = effort
    if name: kw["extra_args"] = {"name": name}
    return asyncio.run(_run(prompt, options(**kw)))


VARIADIC = {"--allowedTools", "--disallowedTools"}


def run_cli(cmd, cwd=None, **_):
    """Take the arguments of a documented `claude -p` command and run them through the Agent SDK.

    The labs keep showing the CI command the exam asks about. The engine underneath is the SDK."""
    a = list(cmd)[1:]; o = {"tools": [], "disallowed": []}; i = 0; prompt = None
    while i < len(a):
        x = a[i]
        if x in ("-p", "--print"):
            prompt = a[i + 1]; i += 2
        elif x in VARIADIC:
            i += 1; vals = []
            while i < len(a) and not a[i].startswith("--"):
                vals += [v.strip() for v in a[i].split(",") if v.strip()] if "(" not in a[i] else [a[i]]; i += 1
            o["tools" if x == "--allowedTools" else "disallowed"] += vals
        elif x == "--fork-session":
            o["fork"] = True; i += 1
        else:
            key = {"--model": "model", "--permission-mode": "mode", "--max-turns": "max_turns", "--settings": "settings", "--agents": "agents", "--resume": "resume", "--name": "name", "--effort": "effort", "--json-schema": "schema", "--output-format": None}.get(x, "?")
            if key == "?": raise ValueError(f"run_cli: flag not mapped to the SDK: {x}")
            if key: o[key] = json.loads(a[i + 1]) if key == "schema" else a[i + 1]
            i += 2
    env = run_agent(prompt, cwd=cwd, **o)
    return SimpleNamespace(returncode=1 if env["is_error"] else 0, stdout=json.dumps(env, default=str), stderr="" if not env["is_error"] else str(env["result"]))


# ------------------------------------------------------------------- Claude API (Messages) calls
import anthropic as _anthropic
from anthropic import AuthenticationError, BadRequestError  # noqa: F401  (re-exported for the simulators)
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming  # noqa: F401
from anthropic.types.messages.batch_create_params import Request  # noqa: F401

PRICE_IN, PRICE_OUT = 0.10, 0.50  # US$ per million tokens, Claude Haiku 5.5 (prompts up to 100K tokens)


def usage_cost(u):
    if not u:
        return 0.0
    cache_w = getattr(u, "cache_creation_input_tokens", 0) or 0
    cache_r = getattr(u, "cache_read_input_tokens", 0) or 0
    return ((u.input_tokens or 0) * PRICE_IN + cache_w * PRICE_IN * 1.25 + cache_r * PRICE_IN * 0.1 + (u.output_tokens or 0) * PRICE_OUT) / 1e6


class _Resp:
    """The real Messages API response, plus cost_usd and usage.total_input_tokens for the lab printouts."""
    def __init__(self, r):
        self._r = r
        self.cost_usd = usage_cost(r.usage)
        u = r.usage
        self.usage = SimpleNamespace(input_tokens=u.input_tokens, output_tokens=u.output_tokens,
                                     cache_creation_input_tokens=getattr(u, "cache_creation_input_tokens", 0) or 0,
                                     cache_read_input_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
                                     total_input_tokens=(u.input_tokens or 0) + (getattr(u, "cache_creation_input_tokens", 0) or 0) + (getattr(u, "cache_read_input_tokens", 0) or 0))
    def __getattr__(self, k): return getattr(self._r, k)
    def model_dump(self, *a, **k): return self._r.model_dump(*a, **k)


STRICT_UNSUPPORTED = {"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "pattern"}


def api_schema(node):
    """A copy of a JSON schema without the keywords strict tool use rejects (numeric and length bounds).
    The simulators still validate the full schema locally, so the bounds are enforced after the call."""
    if isinstance(node, dict):
        return {k: api_schema(v) for k, v in node.items() if k not in STRICT_UNSUPPORTED}
    if isinstance(node, list):
        return [api_schema(v) for v in node]
    return node


def _api_tools(tools):
    return [dict(t, input_schema=api_schema(t["input_schema"])) if t.get("strict") and "input_schema" in t else t for t in tools]


class _Messages:
    def __init__(self, inner, batches=None):
        self._m = inner
        self.batches = batches
    def create(self, **params):
        params["model"] = MODEL
        if params.get("tools"):
            params["tools"] = _api_tools(params["tools"])
        r = _Resp(self._m.create(**params))
        for b in r.content:
            if b.type == "tool_use":
                emit(f"  -> {b.name}({short(b.input)})")
        emit(f"  stop_reason: {r.stop_reason}")
        record_cost(r.cost_usd)
        return r


class _Batches:
    """The real Message Batches API, with each request pinned to Haiku 5.5 and strict schemas made API-safe."""
    def __init__(self, inner): self._b = inner
    def create(self, requests, **kw):
        fixed = []
        for r in requests:
            prm = dict(r["params"], model=MODEL)
            if prm.get("tools"): prm["tools"] = _api_tools(prm["tools"])
            fixed.append({"custom_id": r["custom_id"], "params": prm})
        return self._b.create(requests=fixed, **kw)
    def __getattr__(self, k): return getattr(self._b, k)


class Anthropic:
    """The real Claude API client (anthropic SDK), with every request pinned to Claude Haiku 5.5."""
    def __init__(self, **kw):
        self._c = _anthropic.Anthropic(**kw)
        self.messages = _Messages(self._c.messages, _Batches(self._c.messages.batches))
        self.beta = SimpleNamespace(messages=_Messages(self._c.beta.messages, _Batches(self._c.beta.messages.batches)))
