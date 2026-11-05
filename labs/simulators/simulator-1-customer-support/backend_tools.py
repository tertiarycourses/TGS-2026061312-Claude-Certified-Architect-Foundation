"""Mock backend exposed as MCP tools for the support agent.

Four tools, exactly as the exam scenario names them:
get_customer, lookup_order, process_refund, escalate_to_human.

Every tool returns either a JSON payload or a STRUCTURED error
(errorCategory, isRetryable, message) so the agent can decide whether to
retry, explain, or escalate. The raw backend deliberately mixes formats
(unix timestamps vs ISO 8601, numeric vs text status codes); the agent's
PostToolUse hook normalises them before Claude sees the result.
"""
import json
import time
from pathlib import Path

from claude_agent_sdk import tool, create_sdk_mcp_server

HERE = Path(__file__).resolve().parent
BACKEND = json.loads((HERE / "fixtures" / "backend.json").read_text())
STATE = {"flaky_hits": {}, "refunds": [], "escalations": [], "overrides": {}, "validated_refunds": {}, "validation_log": []}


def reset(overrides=None):
    STATE["flaky_hits"] = {}
    STATE["refunds"] = []
    STATE["escalations"] = []
    STATE["overrides"] = overrides or {}
    STATE["validated_refunds"] = {}
    STATE["validation_log"] = []


def _ok(payload):
    return {"content": [{"type": "text", "text": json.dumps(payload)}]}


def _err(category, message, retryable, **extra):
    body = {"error": True, "errorCategory": category, "isRetryable": retryable, "message": message, **extra}
    return {"content": [{"type": "text", "text": json.dumps(body)}], "isError": True}


def _customers():
    merged = dict(BACKEND["customers"])
    merged.update(STATE["overrides"].get("customers", {}))
    return merged


def _orders():
    merged = dict(BACKEND["orders"])
    merged.update(STATE["overrides"].get("orders", {}))
    return merged


@tool(
    "get_customer",
    "Verify a customer's identity and return their account record. ALWAYS call this first, "
    "before lookup_order or process_refund. Input: the email address the customer wrote from "
    "(e.g. 'meilin@example.com') or a full name. Returns customer_id, name, tier, created_at, "
    "status. If several accounts match a name, returns errorCategory 'ambiguous' with the "
    "candidate ids: ask the customer for another identifier instead of guessing. Do NOT use "
    "this tool to look up orders.",
    {"email": str, "name": str},
)
async def get_customer(args):
    email = (args.get("email") or "").strip().lower()
    name = (args.get("name") or "").strip().lower()
    customers = _customers()
    if email:
        for c in customers.values():
            if c["email"].lower() == email:
                return _ok(c)
        return _err("validation", f"No customer with email {email}", False)
    if name:
        matches = [c for c in customers.values() if c["name"].lower() == name]
        if len(matches) == 1:
            return _ok(matches[0])
        if len(matches) > 1:
            return _err("ambiguous", f"{len(matches)} customers named '{args.get('name')}'. Ask for the email or order number.",
                        False, candidates=[c["customer_id"] for c in matches])
        return _err("validation", f"No customer named {args.get('name')}", False)
    return _err("validation", "Provide an email or a name", False)


@tool(
    "lookup_order",
    "Fetch one order by its order number (format 'ORD-####', e.g. 'ORD-5501'). Use this for "
    "'where is my order', delivery status, charges and refund eligibility. Requires a verified "
    "customer_id from get_customer; the order must belong to that customer. Returns order_id, "
    "item, amount, status, placed_at, shipped, eta, charges (number of times the card was "
    "charged), damage_photo. Transient backend errors return isRetryable=true: retry once.",
    {"order_id": str, "customer_id": str},
)
async def lookup_order(args):
    order_id = (args.get("order_id") or "").strip().upper()
    customer_id = (args.get("customer_id") or "").strip()
    flaky = BACKEND.get("flaky_orders", {})
    if order_id in flaky and STATE["flaky_hits"].get(order_id, 0) < flaky[order_id]:
        STATE["flaky_hits"][order_id] = STATE["flaky_hits"].get(order_id, 0) + 1
        return _err("transient", "Order service timed out after 3000 ms", True, attempted_query=order_id)
    order = _orders().get(order_id)
    if not order:
        return _err("validation", f"Order {order_id} not found", False)
    if customer_id and order["customer_id"] != customer_id:
        return _err("permission", f"Order {order_id} does not belong to customer {customer_id}", False)
    return _ok(order)


RECOMMEND_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["order_id", "item_adjustments", "shipping_refund", "merchandise_credit", "refund_total", "rationale"],
    "properties": {
        "order_id": {"type": "string", "pattern": "^ORD-[0-9]{4}$"},
        "item_adjustments": {"type": "array", "items": {"type": "object", "additionalProperties": False,
            "required": ["sku", "amount"], "properties": {"sku": {"type": "string"}, "amount": {"type": "number", "minimum": 0}}}},
        "shipping_refund": {"type": "number", "minimum": 0, "description": "shipping fee returned to the card; 0 unless shipping was charged and is being refunded in cash"},
        "merchandise_credit": {"type": "number", "minimum": 0, "description": "store credit, never cash"},
        "refund_total": {"type": "number", "minimum": 0, "description": "cash amount that process_refund will send: item_adjustments + shipping_refund"},
        "rationale": {"type": "string"},
    },
}


def validate_recommendation(rec: dict, order: dict, customer_text: str = "") -> list:
    """Business rules the schema cannot express (practice test Q4)."""
    errors = []
    items = {li["sku"]: li["price"] for li in order.get("line_items", [])} or {"WHOLE": order["amount"]}
    item_sum = 0.0
    for adj in rec.get("item_adjustments", []):
        if adj["sku"] not in items:
            errors.append(f"sku {adj['sku']} is not on order {order['order_id']} (valid: {', '.join(items)})")
        elif adj["amount"] > items[adj["sku"]] + 0.01:
            errors.append(f"sku {adj['sku']} refund {adj['amount']} exceeds its price {items[adj['sku']]}")
        item_sum += adj["amount"]
    fee = order.get("shipping_fee", 0.0)
    if rec.get("shipping_refund", 0) > fee + 0.01:
        errors.append(f"shipping_refund {rec.get('shipping_refund')} exceeds the shipping fee charged ({fee})")
    if rec.get("merchandise_credit", 0) > 0 and rec.get("shipping_refund", 0) > 0 and abs(rec["merchandise_credit"] - fee) < 0.01 and abs(rec["shipping_refund"] - fee) < 0.01:
        errors.append("the shipping fee appears both as shipping_refund and as merchandise_credit; choose one")
    expected_total = item_sum + rec.get("shipping_refund", 0)
    if abs(expected_total - rec.get("refund_total", -1)) > 0.01:
        errors.append(f"refund_total {rec.get('refund_total')} must equal item_adjustments ({item_sum:.2f}) + shipping_refund ({rec.get('shipping_refund', 0):.2f}) = {expected_total:.2f}; merchandise_credit is not cash")
    if rec.get("refund_total", 0) > order["amount"] * order.get("charges", 1) + fee + 0.01:
        errors.append("refund_total exceeds everything charged on this order")
    return errors


@tool(
    "recommend_refund",
    "Propose a refund for ONE order before executing it. Required before process_refund. Input is the "
    "structured recommendation: order_id; item_adjustments (sku + amount for each refunded line, use sku "
    "'WHOLE' for an order without line items); shipping_refund (cash for the shipping fee, 0 if none); "
    "merchandise_credit (store credit, never cash); refund_total (the CASH amount = item_adjustments + "
    "shipping_refund); rationale. The backend validates business rules (line prices, shipping fee, "
    "totals) and returns either validated:true or isError with the specific failures: fix them and call "
    "again. Do not call process_refund until this tool returns validated:true.",
    RECOMMEND_SCHEMA,
)
async def recommend_refund(args):
    order = _orders().get((args.get("order_id") or "").upper())
    if not order:
        return _err("validation", f"Order {args.get('order_id')} not found", False)
    errors = validate_recommendation(args, order)
    STATE["validation_log"].append({"recommendation": dict(args), "errors": errors})
    if errors:
        return _err("business", "Refund recommendation failed business-rule validation", False, failures=errors,
                    hint="Correct the fields named above and call recommend_refund again.")
    STATE["validated_refunds"][order["order_id"]] = {"refund_total": float(args["refund_total"]), "merchandise_credit": float(args.get("merchandise_credit", 0))}
    return _ok({"validated": True, "order_id": order["order_id"], "cash_refund": float(args["refund_total"]),
                "merchandise_credit": float(args.get("merchandise_credit", 0)), "message": "Recommendation validated. You may call process_refund for the cash amount."})


@tool(
    "process_refund",
    "Issue a CASH refund to the customer's original payment method. Input: order_id, amount in "
    "dollars (must equal the validated refund_total from recommend_refund), and a one-line reason. Only call after get_customer and lookup_order confirm "
    "the order, the customer, and the eligibility evidence (damage photo, duplicate charge, "
    "open return window). Policy: refunds above the auto-approval limit are blocked and must "
    "go through escalate_to_human. Returns refund_id and status.",
    {"order_id": str, "amount": float, "reason": str},
)
async def process_refund(args):
    order_id = (args.get("order_id") or "").strip().upper()
    order = _orders().get(order_id)
    if not order:
        return _err("validation", f"Order {order_id} not found", False)
    amount = float(args.get("amount") or 0)
    plain_return = not order.get("damage_photo") and order.get("charges", 1) == 1
    if plain_return and order.get("return_window_open") is False:
        return _err("business", f"Order {order_id} is outside the {BACKEND['policy']['return_window_days']}-day return window", False,
                    customer_message="This order was delivered more than 30 days ago, so a change-of-mind return is no longer available.")
    if amount <= 0 or amount > order["amount"] * order.get("charges", 1):
        return _err("business", f"Refund {amount} exceeds the amount charged for {order_id}", False,
                    customer_message="The refund amount is higher than what was charged, so it cannot be issued as requested.")
    refund = {"refund_id": f"RF-{int(time.time()) % 100000}", "order_id": order_id, "amount": amount,
              "reason": args.get("reason", ""), "status": "issued"}
    STATE["refunds"].append(refund)
    return _ok(refund)


@tool(
    "escalate_to_human",
    "Hand the case to a human support agent who CANNOT see this conversation. Use when the "
    "customer asks for a human, when policy is silent or ambiguous for the request, when a "
    "refund exceeds the auto-approval limit, or when you cannot make progress. Input is a "
    "structured handoff: customer_id, root_cause, recommended_action, refund_amount (0 if "
    "none), order_ids (comma-separated). Returns a ticket id.",
    {"customer_id": str, "root_cause": str, "recommended_action": str, "refund_amount": float, "order_ids": str},
)
async def escalate_to_human(args):
    ticket = {"ticket_id": f"HS-{len(STATE['escalations']) + 1:04d}", "handoff": dict(args), "status": "queued"}
    STATE["escalations"].append(ticket)
    return _ok(ticket)


def build_server():
    return create_sdk_mcp_server(name="support-backend", version="1.0.0",
                                 tools=[get_customer, lookup_order, recommend_refund, process_refund, escalate_to_human])


TOOL_NAMES = ["mcp__backend__get_customer", "mcp__backend__lookup_order", "mcp__backend__recommend_refund",
              "mcp__backend__process_refund", "mcp__backend__escalate_to_human"]


if __name__ == "__main__":
    # uv run backend_tools.py --demo : run the business-rule validator on recommendations that are
    # schema-valid yet wrong in meaning (practice test Q4), without calling the model.
    import sys
    if "--demo" in sys.argv:
        order = BACKEND["orders"]["ORD-5509"]
        samples = {
            "store credit typed into shipping_refund": {"order_id": "ORD-5509", "item_adjustments": [{"sku": "LAMP-S", "amount": 55}, {"sku": "MAT", "amount": 50}],
                                                         "shipping_refund": 8, "merchandise_credit": 8, "refund_total": 113, "rationale": "x"},
            "itemised lines do not add up to the total": {"order_id": "ORD-5509", "item_adjustments": [{"sku": "LAMP-S", "amount": 55}, {"sku": "MAT", "amount": 50}],
                                                          "shipping_refund": 0, "merchandise_credit": 8, "refund_total": 113, "rationale": "x"},
            "sku that is not on the order": {"order_id": "ORD-5509", "item_adjustments": [{"sku": "CHAIR", "amount": 55}],
                                              "shipping_refund": 0, "merchandise_credit": 0, "refund_total": 55, "rationale": "x"},
            "correct recommendation": {"order_id": "ORD-5509", "item_adjustments": [{"sku": "LAMP-S", "amount": 55}, {"sku": "MAT", "amount": 50}],
                                        "shipping_refund": 0, "merchandise_credit": 8, "refund_total": 105, "rationale": "x"},
        }
        for title, rec in samples.items():
            errs = validate_recommendation(rec, order)
            print(f"\n{title}:\n  schema: valid\n  business rules: " + ("validated" if not errs else "\n   - " + "\n   - ".join(errs)))
