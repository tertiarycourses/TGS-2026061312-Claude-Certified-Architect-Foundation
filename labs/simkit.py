"""The engine behind all six simulators: Python on the Claude Agent SDK.

Everything runs locally on your Claude login (`claude auth login`). No API key is used:
importing this module removes any key from the environment so the SDK falls back to OAuth.
"""
import asyncio, json, os, shlex, sys
from pathlib import Path
from types import SimpleNamespace

for _k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE"):
    os.environ.pop(_k, None)

from claude_agent_sdk import (AgentDefinition, AssistantMessage, ClaudeAgentOptions, ResultMessage, SystemMessage, TextBlock, ThinkingBlock,
                              ToolResultBlock, ToolUseBlock, UserMessage, create_sdk_mcp_server, query, tool)
from claude_agent_sdk.types import StreamEvent

MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
ON_EVENT = None  # the website sets this to stream lines into its console


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
    kw["include_partial_messages"] = True
    project_mcp = "project" in kw["setting_sources"] and kw.get("cwd") and (Path(kw["cwd"]) / ".mcp.json").exists()
    env = {"ENABLE_CLAUDEAI_MCP_SERVERS": "false"}
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
        emit(f"  done: {msg.subtype}, {msg.num_turns} turns, cost ${(msg.total_cost_usd or 0):.4f}")


PRESET = {"type": "preset", "preset": "claude_code"}


def _agents(text):
    if not text:
        return None
    raw = json.loads(text) if isinstance(text, str) else text
    return {k: AgentDefinition(description=v.get("description", k), prompt=v.get("prompt", ""), tools=v.get("tools"), model=v.get("model")) for k, v in raw.items()}


async def _run(prompt, opts):
    out = {"result": None, "session_id": None, "total_cost_usd": 0, "num_turns": 0, "subtype": None, "structured_output": None, "permission_denials": [], "is_error": False}
    got = False
    try:
        async for m in query(prompt=prompt, options=opts):
            narrate(m)
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
    kw = dict(model=model or MODEL, cwd=str(cwd) if cwd else None, system_prompt=system, setting_sources=list(sources) if sources else None)
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


# ------------------------------------------------------------------- Messages-style calls, answered by the Agent SDK
class BadRequestError(Exception):
    message = ""
class AuthenticationError(Exception):
    pass

def Request(custom_id, params): return {"custom_id": custom_id, "params": params}
def MessageCreateParamsNonStreaming(**k): return k

class Block(SimpleNamespace):
    def model_dump(self): return dict(vars(self))

def _flatten(messages):
    parts = []
    for m in messages:
        c = m["content"]
        if isinstance(c, str):
            parts.append((m["role"], c)); continue
        bits = []
        for b in c:
            t = b.get("type") if isinstance(b, dict) else b.type
            g = (lambda k, d=None: b.get(k, d)) if isinstance(b, dict) else (lambda k, d=None: getattr(b, k, d))
            if t == "text": bits.append(g("text"))
            elif t == "tool_use": bits.append(f"[you called tool {g('name')} with {json.dumps(g('input'))}]")
            elif t == "tool_result": bits.append(f"[tool result: {json.dumps(g('content'), default=str)}]")
        parts.append((m["role"], "\n".join(bits)))
    if len(parts) == 1: return parts[0][1]
    return "\n\n".join(f"{r.upper()}:\n{t}" for r, t in parts) + "\n\nContinue from here."


async def _one(params):
    """One model turn: Claude may answer or call a tool, and control comes straight back, as on the Messages API."""
    specs = params.get("tools") or []
    captured = []
    def handler_for(name):
        async def h(args):
            captured.append(name); return {"content": [{"type": "text", "text": "recorded"}]}
        return h
    sdk_tools = [tool(t["name"], t.get("description", ""), t["input_schema"])(handler_for(t["name"])) for t in specs]
    system = params.get("system") or ""
    tc = (params.get("tool_choice") or {}).get("type", "auto")
    if tc == "any": system += "\n\nYou must respond by calling one of the provided tools."
    if tc == "tool": system += f"\n\nYou must respond by calling the {params['tool_choice']['name']} tool."
    kw = dict(model=params.get("model") or MODEL, system_prompt=system or None, tools=[], max_turns=1, permission_mode="bypassPermissions", env={"ENABLE_TOOL_SEARCH": "false"}, cwd=str(Path(__file__).parent))
    if sdk_tools:
        kw["mcp_servers"] = {"local": create_sdk_mcp_server("local", tools=sdk_tools)}
        kw["allowed_tools"] = [f"mcp__local__{t['name']}" for t in specs]
    content, model, usage, cost = [], kw["model"], {}, 0
    try:
        async for m in query(prompt=_flatten(params["messages"]), options=options(**kw)):
            if isinstance(m, StreamEvent) and m.event.get("type") == "message_delta" and m.event.get("delta", {}).get("stop_reason"):
                emit(f"  stop_reason: {m.event['delta']['stop_reason']}")
            elif isinstance(m, AssistantMessage):
                model = m.model or model
                for b in m.content:
                    if isinstance(b, ToolUseBlock):
                        content.append(Block(type="tool_use", id=b.id, name=b.name.split("__")[-1], input=b.input))
                        emit(f"  -> {b.name.split('__')[-1]}({short(b.input)})")
                    elif isinstance(b, TextBlock) and b.text.strip():
                        content.append(Block(type="text", text=b.text))
            elif isinstance(m, ResultMessage):
                usage = m.usage or {}; cost = m.total_cost_usd or 0
    except Exception as e:
        if not content: raise RuntimeError(f"Agent SDK call failed: {e}")
    stop = "tool_use" if any(b.type == "tool_use" for b in content) else "end_turn"
    return SimpleNamespace(content=content, stop_reason=stop, model=model, cost_usd=cost,
                           usage=SimpleNamespace(input_tokens=usage.get("input_tokens", 0), output_tokens=usage.get("output_tokens", 0)))


class _Counts(SimpleNamespace):
    def model_dump(self): return dict(vars(self))


class _Batches:
    """A local stand-in for the Message Batches API: same custom_id workflow, one Agent SDK call per row, no tool loop.
    The real API's 50% discount and 24-hour window do not apply here."""
    store = {}
    def create(self, requests):
        async def go():
            sem = asyncio.Semaphore(4)
            async def row(r):
                async with sem:
                    try:
                        return SimpleNamespace(custom_id=r["custom_id"], result=SimpleNamespace(type="succeeded", message=await _one(r["params"])))
                    except Exception as e:
                        return SimpleNamespace(custom_id=r["custom_id"], result=SimpleNamespace(type="errored", error=str(e)))
            return await asyncio.gather(*(row(r) for r in requests))
        out = asyncio.run(go()); bid = f"local_batch_{len(self.store) + 1}"; self.store[bid] = out
        ok = sum(r.result.type == "succeeded" for r in out)
        return self.retrieve(bid) if ok >= 0 else None
    def retrieve(self, bid):
        out = self.store[bid]; ok = sum(r.result.type == "succeeded" for r in out)
        return SimpleNamespace(id=bid, processing_status="ended", request_counts=_Counts(processing=0, succeeded=ok, errored=len(out) - ok, canceled=0, expired=0))
    def results(self, bid): return self.store[bid]


class _Messages:
    batches = _Batches()
    def create(self, **params): return asyncio.run(_one(params))


class Anthropic:
    """Answers the shape extract.py and triage.py expect, through the Agent SDK and your Claude login."""
    def __init__(self): self.messages = _Messages(); self.beta = SimpleNamespace(messages=self.messages)
