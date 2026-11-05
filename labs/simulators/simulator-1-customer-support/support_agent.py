#!/usr/bin/env python3
"""Customer Support Resolution Agent on the Claude Agent SDK.

Runs one or all use cases in cases/ through a real Claude agent that talks
to the mock backend through four MCP tools, with three hooks:

  PreToolUse  prerequisite gate  - lookup_order / process_refund are denied
                                   until get_customer has returned a verified id
  PreToolUse  refund limit       - process_refund above $500 is denied and the
                                   agent is told to escalate instead
  PostToolUse normaliser         - unix timestamps and numeric status codes are
                                   rewritten to ISO dates and words before the
                                   model reads them

Usage:
  uv run support_agent.py --case CS-01          # one use case
  uv run support_agent.py --all                 # every case in cases/
  uv run support_agent.py --all --no-gate       # switch the prerequisite gate off
  uv run support_agent.py --all --no-limit-hook # switch the refund hook off
  uv run support_agent.py --case CS-01 --prompt prompts/system.md

Each run writes evidence/runs/<case_id>.json: the customer message, every
tool call with its raw and normalised result, hook decisions, the agent's
reply, stop reason, turns and cost. Run evaluate.py afterwards.
"""
import sys as _s, pathlib as _p; _s.path.insert(0, str(_p.Path(__file__).resolve().parents[2])); import simkit  # Claude Agent SDK engine, OAuth login
import argparse
import asyncio
import datetime as dt
import json
import os
import sys
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage, ClaudeAgentOptions, ClaudeSDKClient, HookMatcher, ResultMessage,
    TextBlock, ToolResultBlock, ToolUseBlock, UserMessage, query,
)

import backend_tools as backend

HERE = Path(__file__).resolve().parent
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
MAX_BUDGET_USD = float(os.environ.get("LAB_MAX_BUDGET_USD", "1.50"))
REFUND_LIMIT = backend.BACKEND["policy"]["refund_auto_limit"]
STATUS_WORDS = backend.BACKEND["status_codes"]


def load_cases(selected=None):
    cases = [json.loads(p.read_text()) for p in sorted((HERE / "cases").glob("CS-*.json"))]
    cases += [json.loads(p.read_text()) for p in sorted((HERE / "my_cases").glob("MY-*.json"))]  # tests written on the simulator's web page
    if selected:
        cases = [c for c in cases if c["case_id"] in selected]
    return cases


def normalise(payload: dict) -> dict:
    """Rewrite heterogeneous backend fields into one shape (PostToolUse)."""
    out = dict(payload)
    for key in ("created_at", "placed_at"):
        v = out.get(key)
        if isinstance(v, (int, float)):
            out[key] = dt.datetime.fromtimestamp(v, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    st = out.get("status")
    if isinstance(st, (int, float)) or (isinstance(st, str) and st.isdigit()):
        out["status"] = STATUS_WORDS.get(str(int(st)), "active" if str(st) == "1" else str(st))
    return out


def make_hooks(trace: dict, state: dict, gate: bool, limit_hook: bool, validation_gate: bool = True):
    async def pre_tool(input_data, tool_use_id, context):
        name = input_data["tool_name"].split("__")[-1]
        args = input_data["tool_input"]
        decision = {}
        if gate and name in ("lookup_order", "process_refund") and not state.get("verified_customer_id"):
            decision = {"permissionDecision": "deny",
                        "permissionDecisionReason": "Prerequisite not met: call get_customer and obtain a verified customer_id before any order operation."}
        elif gate and name == "process_refund" and validation_gate:
            vr = backend.STATE["validated_refunds"].get((args.get("order_id") or "").upper())
            if not vr:
                decision = {"permissionDecision": "deny",
                            "permissionDecisionReason": "No validated recommendation for this order. Call recommend_refund first; it checks the business rules and returns validated:true."}
            elif abs(vr["refund_total"] - float(args.get("amount") or 0)) > 0.01:
                decision = {"permissionDecision": "deny",
                            "permissionDecisionReason": f"Amount {args.get('amount')} differs from the validated refund_total {vr['refund_total']}. Use the validated amount or recommend again."}
        if not decision and limit_hook and name == "process_refund" and float(args.get("amount") or 0) > REFUND_LIMIT:
            decision = {"permissionDecision": "deny",
                        "permissionDecisionReason": f"Policy: refunds above ${REFUND_LIMIT} need human approval. Call escalate_to_human with refund_amount={args.get('amount')} instead."}
        trace["hooks"].append({"event": "PreToolUse", "tool": name, "args": args,
                               "decision": decision.get("permissionDecision", "allow"),
                               "reason": decision.get("permissionDecisionReason")})
        if decision:
            return {"hookSpecificOutput": {"hookEventName": "PreToolUse", **decision}}
        return {}

    async def post_tool(input_data, tool_use_id, context):
        name = input_data["tool_name"].split("__")[-1]
        resp = input_data.get("tool_response")
        raw_text = None
        try:
            content = resp.get("content") if isinstance(resp, dict) else resp
            if isinstance(content, list) and content and isinstance(content[0], dict):
                raw_text = content[0].get("text")
        except Exception:
            pass
        payload = None
        if raw_text:
            try:
                payload = json.loads(raw_text)
            except json.JSONDecodeError:
                payload = None
        if payload and not payload.get("error"):
            if name == "get_customer" and payload.get("customer_id"):
                state["verified_customer_id"] = payload["customer_id"]
            normalised = normalise(payload)
            trace["hooks"].append({"event": "PostToolUse", "tool": name, "raw": payload, "normalised": normalised})
            if normalised != payload:
                return {"hookSpecificOutput": {"hookEventName": "PostToolUse",
                                               "updatedToolOutput": {"content": [{"type": "text", "text": json.dumps(normalised)}]}}}
        else:
            trace["hooks"].append({"event": "PostToolUse", "tool": name, "raw": payload, "error": True})
        return {}

    return {
        "PreToolUse": [HookMatcher(matcher="^mcp__backend__", hooks=[pre_tool])],
        "PostToolUse": [HookMatcher(matcher="^mcp__backend__", hooks=[post_tool])],
    }


async def run_case(case: dict, system_prompt: str, gate: bool, limit_hook: bool, validation_gate: bool = True) -> dict:
    backend.reset(case.get("backend_overrides"))
    state = {}
    trace = {"case_id": case["case_id"], "title": case["title"], "message": case["message"],
             "customer": case["customer"], "tool_calls": [], "hooks": [], "assistant_text": [],
             "settings": {"model": MODEL, "gate": gate, "limit_hook": limit_hook}}
    pending = {}
    contact = ", ".join(f"{k}: {v}" for k, v in case["customer"].items())
    prompt = f"Incoming support message ({contact}):\n\n{case['message']}"
    options = ClaudeAgentOptions(
        model=MODEL,
        system_prompt=system_prompt,
        mcp_servers={"backend": backend.build_server()},
        allowed_tools=backend.TOOL_NAMES,
        permission_mode="bypassPermissions",
        max_turns=12,
        max_budget_usd=MAX_BUDGET_USD,
        hooks=make_hooks(trace, state, gate, limit_hook, validation_gate),
        cwd=str(HERE),
    )
    turns = case.get("turns") or [prompt]
    if case.get("turns"):
        turns = [f"Incoming support message ({contact}):\n\n{turns[0]}"] + [f"Customer replies:\n\n{t}" for t in turns[1:]]
    trace["turn_replies"] = []
    try:
      async with ClaudeSDKClient(options=options) as client:
        for turn in turns:
          await client.query(turn)
          async for msg in client.receive_response():
              simkit.narrate(msg)
              if isinstance(msg, AssistantMessage):
                  for block in msg.content:
                      if isinstance(block, ToolUseBlock):
                          pending[block.id] = {"tool": block.name.split("__")[-1], "input": block.input}
                          trace["tool_calls"].append(pending[block.id])
                      elif isinstance(block, TextBlock) and block.text.strip():
                          trace["assistant_text"].append(block.text)
              elif isinstance(msg, UserMessage) and isinstance(msg.content, list):
                  for block in msg.content:
                      if isinstance(block, ToolResultBlock) and block.tool_use_id in pending:
                          content = block.content
                          text = content[0].get("text") if isinstance(content, list) and content else content
                          pending[block.tool_use_id]["result"] = text
                          pending[block.tool_use_id]["is_error"] = bool(block.is_error) or ('"error": true' in str(text))
              elif isinstance(msg, ResultMessage):
                  prev = (trace.get("result") or {}).get("total_cost_usd") or 0
                  trace["result"] = {"subtype": msg.subtype, "stop_reason": msg.stop_reason, "num_turns": msg.num_turns,
                                     "total_cost_usd": (msg.total_cost_usd or 0) + prev, "session_id": msg.session_id,
                                     "is_error": msg.is_error, "terminal_reason": msg.terminal_reason}
                  trace["reply"] = msg.result
                  trace["turn_replies"].append(msg.result)
    except Exception as exc:  # the SDK raises after an error result
        trace["exception"] = repr(exc)
    trace["backend_state"] = {"refunds": backend.STATE["refunds"], "escalations": backend.STATE["escalations"],
                              "validated_refunds": backend.STATE["validated_refunds"], "validation_log": backend.STATE["validation_log"]}
    return trace


async def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--case", action="append", help="case id, repeatable")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--prompt", default="prompts/system.md")
    ap.add_argument("--no-gate", action="store_true", help="disable the prerequisite gate hook")
    ap.add_argument("--no-limit-hook", action="store_true", help="disable the $500 refund hook")
    ap.add_argument("--no-validation", action="store_true", help="let process_refund run without a validated recommend_refund")
    ap.add_argument("--tag", default="", help="suffix for the evidence file, e.g. nogate")
    args = ap.parse_args()
    if not args.all and not args.case:
        ap.error("choose --case ID or --all")
    system_prompt = (HERE / args.prompt).read_text()
    out_dir = HERE / "evidence" / "runs"
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0.0
    for case in load_cases(args.case):
        print(f"\n=== {case['case_id']} · {case['title']}")
        trace = await run_case(case, system_prompt, gate=not args.no_gate, limit_hook=not args.no_limit_hook, validation_gate=not args.no_validation)
        for h in trace["hooks"]:
            if h["event"] == "PreToolUse" and h["decision"] == "deny":
                print(f"  !! hook denied {h['tool']}: {h['reason']}")
        for v in trace["backend_state"].get("validation_log", []):
            print(f"  ?? recommend_refund {json.dumps(v['recommendation'])[:110]} -> {'validated' if not v['errors'] else v['errors']}")
        print("  reply:", (trace.get("reply") or "").replace("\n", " | "))
        cost = (trace.get("result") or {}).get("total_cost_usd") or 0
        total += cost
        print(f"  cost ${cost:.4f}")
        suffix = f"-{args.tag}" if args.tag else ""
        (out_dir / f"{case['case_id']}{suffix}.json").write_text(json.dumps(trace, indent=2, default=str))
    print(f"\nTotal cost ${total:.4f}. Evidence in {out_dir}")


if __name__ == "__main__":
    asyncio.run(main())
