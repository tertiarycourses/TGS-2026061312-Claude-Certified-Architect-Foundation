"""Hooks: code that runs around every tool call, whatever the prompt says."""
REFUND_LIMIT = 500


def pre_tool_use(tool_name: str, tool_input: dict) -> dict:
    """PreToolUse: runs BEFORE every tool call. Returns {"decision": "allow"} or {"decision": "deny", "reason": ...}."""
    if tool_name == "process_refund" and float(tool_input.get("amount", 0)) > REFUND_LIMIT:
        return {"decision": "deny",
                "reason": f"Policy: refunds above ${REFUND_LIMIT} need human approval. Do not retry process_refund. "
                          f"Call escalate_to_human with refund_amount={tool_input.get('amount')} instead."}
    return {"decision": "allow"}
