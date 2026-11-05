"""Play it live: each simulator's real system, driven turn by turn through the Claude Agent SDK."""
import importlib, importlib.util, json, sys
from pathlib import Path
import simkit
from claude_agent_sdk import AssistantMessage, ClaudeSDKClient, ResultMessage, TextBlock, ToolResultBlock, ToolUseBlock, UserMessage
import engine

def _load(n, name):
    d = str(engine.sim_dir(n))
    if d not in sys.path: sys.path.insert(0, d)
    return importlib.import_module(name)

def new_session(n, switches=None):
    s = dict(sim=n, session_id=None, turns=[], switches=switches or {}, trace=None, state={}, cwd=None, cost=0.0)
    if n == 1:
        _load(1, "backend_tools").reset(None)
        s["trace"] = {"case_id": "live", "title": "live", "message": "", "customer": {}, "tool_calls": [], "hooks": [], "assistant_text": [], "settings": {}}
    if n == 2: s["cwd"] = engine.copy_of(2, "workspace")
    if n == 4:
        ex = _load(4, "explorer"); ex.fresh_workdir(); ex.CURRENT["phase"] = "live"; s["cwd"] = ex.WORK
    return s

def _options(s, model):
    n = s["sim"]
    if n == 1:
        sa = _load(1, "support_agent"); backend = _load(1, "backend_tools"); sw = s["switches"]
        sa.MODEL = model
        return simkit.options(model=model, system_prompt=(engine.sim_dir(1) / sw.get("prompt", "prompts/system.md")).read_text(), mcp_servers={"backend": backend.build_server()}, tools=[], allowed_tools=backend.TOOL_NAMES,
                                  permission_mode="bypassPermissions", max_turns=12, hooks=sa.make_hooks(s["trace"], s["state"], sw.get("gate", True), sw.get("limit", True), sw.get("validation", True)), cwd=str(engine.sim_dir(1)), resume=s["session_id"])
    if n == 2:
        return simkit.options(model=model, system_prompt=simkit.PRESET, setting_sources=["project", "local"], cwd=str(s["cwd"]), permission_mode="acceptEdits", allowed_tools=["Read", "Grep", "Glob", "Edit", "Write", "Skill", "Agent", "Bash(node *)", "Bash(npm test*)"], max_turns=20, resume=s["session_id"])
    if n == 4:
        ex = _load(4, "explorer"); ex.MODEL = model
        o = ex.options(max_turns=20, resume=s["session_id"]); o.model = model
        return o

async def chat_turn(job, s, text, model):
    """One turn of conversation. Streams each step into job.events as it happens."""
    n = s["sim"]; opts = _options(s, model)
    prompt = text
    if n == 1:
        who = s["switches"].get("email"); c = f" (email: {who})" if who else ""
        prompt = f"Incoming support message{c}:\n\n{text}" if not s["session_id"] else f"Customer replies:\n\n{text}"
    seen_hooks = len(s["trace"]["hooks"]) if n == 1 else 0
    names = {}
    async with ClaudeSDKClient(options=opts) as client:
        await client.query(prompt)
        async for m in client.receive_response():
            if job.stopped: break
            simkit.narrate(m)
            if isinstance(m, AssistantMessage):
                for b in m.content:
                    if isinstance(b, ToolUseBlock):
                        short = b.name.split("__")[-1]; names[b.id] = short
                        if short != "ToolSearch": job.event(k="tool", name=short, input=b.input, sub=bool(getattr(m, "parent_tool_use_id", None)))
                    elif isinstance(b, TextBlock) and b.text.strip():
                        job.event(k="text", text=b.text)
            elif isinstance(m, UserMessage) and isinstance(m.content, list):
                for b in m.content:
                    if isinstance(b, ToolResultBlock) and names.get(b.tool_use_id, "ToolSearch") != "ToolSearch":
                        body = b.content if isinstance(b.content, str) else json.dumps(b.content, default=str)
                        job.event(k="result", name=names[b.tool_use_id], error=bool(b.is_error), text=body[:1500])
            elif isinstance(m, ResultMessage):
                s["session_id"] = m.session_id; s["cost"] += m.total_cost_usd or 0
                job.event(k="done", cost=m.total_cost_usd or 0, turns=m.num_turns, reply=m.result, error=m.is_error)
    if n == 1:
        for h in s["trace"]["hooks"][seen_hooks:]:
            if h.get("decision") == "deny": job.event(k="deny", tool=h["tool"], reason=h["reason"])
    if n == 2:
        ch = engine.changed_files(s["cwd"])
        if ch: job.event(k="changed", files=ch)

async def review_file(job, path, model):
    """Simulator 5: the CI reviewer on one file, with schema-checked findings and a gate."""
    d = engine.sim_dir(5); schema = json.loads((d / "finding.schema.json").read_text()); criteria = (d / "prompts" / "review-criteria.txt").read_text()
    simkit.ON_EVENT = job.line
    prompt = f"CI review of PR 418, per-file pass for {path}. Apply these criteria:\n\n{criteria}\n\nRead {path} and record findings. Report only what the criteria say to report."
    opts = simkit.options(model=model, system_prompt=simkit.PRESET, setting_sources=["project", "local"], cwd=str(d / "repo"), permission_mode="dontAsk", allowed_tools=["Read", "Grep", "Glob"], max_turns=6, output_format={"type": "json_schema", "schema": schema})
    env = await simkit._run(prompt, opts)
    if env.get("is_error") or env.get("structured_output") is None:  # a failed run must never read as a passing gate
        job.line("!! The review didn't finish, so there's no verdict. Run it again.")
        job.result = None
    else:
        job.result = env["structured_output"]
    simkit.ON_EVENT = None

async def extract_document(job, text, doc_type, model, retries):
    """Simulator 6: one pasted document through the real pipeline."""
    d = engine.sim_dir(6); sys.path.insert(0, str(d))
    spec = importlib.util.spec_from_file_location("extract_live", d / "extract.py"); ex = importlib.util.module_from_spec(spec); spec.loader.exec_module(ex)
    simkit.ON_EVENT = job.line
    import asyncio
    doc = {"custom_id": "YOUR-DOC", "document_type_label": doc_type, "text": text}
    job.result = await asyncio.to_thread(ex.extract_one, simkit.Anthropic(), doc, model, ex.tool_choice_param("auto"), retries, True)
    simkit.ON_EVENT = None
