"""Hooks: code that runs around every tool call, whatever the prompt says."""
import json
from datetime import datetime, timezone

REFUND_LIMIT = 500
STATUS = {1: "pending", 2: "shipped", 3: "delivered"}
AUDIT_LOG = "audit.log"


def audit(hook: str, tool_name: str, tool_input: dict, **detail) -> None:
    """One JSON line per hook decision."""
    with open(AUDIT_LOG, "a") as f:
        f.write(json.dumps({"time": datetime.now(timezone.utc).isoformat(timespec="seconds"), "hook": hook,
                            "tool": tool_name, "input": tool_input, **detail}) + "\n")


def pre_tool_use(tool_name: str, tool_input: dict) -> dict:
    """PreToolUse: runs BEFORE every tool call. Returns {"decision": "allow"} or {"decision": "deny", "reason": ...}."""
    if tool_name == "process_refund" and float(tool_input.get("amount", 0)) > REFUND_LIMIT:
        reason = (f"Policy: refunds above ${REFUND_LIMIT} need human approval. Do not retry process_refund. "
                  f"Call escalate_to_human with refund_amount={tool_input.get('amount')} instead.")
        audit("PreToolUse", tool_name, tool_input, decision="deny", reason=reason)
        return {"decision": "deny", "reason": reason}
    audit("PreToolUse", tool_name, tool_input, decision="allow")
    return {"decision": "allow"}


def post_tool_use(tool_name: str, tool_input: dict, result: dict) -> tuple[dict, list[str]]:
    """PostToolUse: runs AFTER every successful tool call, BEFORE Claude reads the result. Returns (clean_result, changes)."""
    clean, changes = dict(result), []
    if isinstance(clean.get("placed_at"), (int, float)):
        iso = datetime.fromtimestamp(clean["placed_at"], tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        changes.append(f"placed_at {clean['placed_at']} -> {iso}")
        clean["placed_at"] = iso
    if isinstance(clean.get("status"), int):
        text = STATUS.get(clean["status"], "unknown")
        changes.append(f"status {clean['status']} -> {text}")
        clean["status"] = text
    audit("PostToolUse", tool_name, tool_input, changes=changes)
    return clean, changes
