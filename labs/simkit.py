"""The engine behind all six simulators: Python on the Claude Agent SDK.

Everything runs locally on your Claude login (`claude auth login`). No API key is used:
importing this module removes any key from the environment so the SDK falls back to OAuth.
"""
import asyncio, json, os, shlex, sys
from pathlib import Path
from types import SimpleNamespace

for _k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE"):
    os.environ.pop(_k, None)

from claude_agent_sdk import (AgentDefinition, AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, ToolResultBlock,
                              ToolUseBlock, UserMessage, create_sdk_mcp_server, query, tool)

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


def narrate(msg, seen=None):
    """Print each step as it happens, so a run is never silent."""
    if isinstance(msg, AssistantMessage):
        who = "  (subagent)" if getattr(msg, "parent_tool_use_id", None) else ""
        for b in msg.content:
            if isinstance(b, ToolUseBlock):
                if b.name != "ToolSearch":
                    emit(f"  -> {b.name.split('__')[-1]}({short(b.input)}){who}")
            elif isinstance(b, TextBlock) and b.text.strip():
                emit(f"  claude: {short(b.text, 200)}{who}")
    elif isinstance(msg, UserMessage) and isinstance(msg.content, list):
        for b in msg.content:
            if isinstance(b, ToolResultBlock) and b.is_error:
                emit(f"  !! tool error: {short(b.content, 160)}")
    elif isinstance(msg, ResultMessage):
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
    return asyncio.run(_run(prompt, ClaudeAgentOptions(**kw)))


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
        async for m in query(prompt=_flatten(params["messages"]), options=ClaudeAgentOptions(**kw)):
            if isinstance(m, AssistantMessage):
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
