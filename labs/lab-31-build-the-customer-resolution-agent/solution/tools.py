"""Orderly's four support tools: the Python functions, and the definitions Claude reads."""
import json
import uuid
from pathlib import Path

DATA = json.loads((Path(__file__).parent / "backend.json").read_text())


class ToolFailure(Exception):
    """A structured error the agent can act on: what went wrong, and whether a retry could help."""
    def __init__(self, category: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.info = {"errorCategory": category, "isRetryable": retryable, "message": message}


def get_customer(email: str) -> dict:
    """Verify a customer by email. Returns customer_id, name, email and tier. Call this before any order tool."""
    for c in DATA["customers"].values():
        if c["email"].lower() == email.strip().lower():
            return c
    raise ToolFailure("not_found", f"No customer with email {email}. Ask the customer to check it.")


def lookup_order(order_id: str, customer_id: str) -> dict:
    """Fetch one order (format ORD-####) for a verified customer_id: item, amount, placed_at, status, damage_photo, eta."""
    order = DATA["orders"].get(order_id.strip().upper())
    if not order:
        raise ToolFailure("not_found", f"Order {order_id} not found.")
    if order["customer_id"] != customer_id:
        raise ToolFailure("permission", f"Order {order_id} does not belong to customer {customer_id}.")
    return order


def process_refund(order_id: str, amount: float, reason: str) -> dict:
    """Issue a cash refund to the original payment method for one order."""
    order = DATA["orders"].get(order_id.strip().upper())
    if not order:
        raise ToolFailure("not_found", f"Order {order_id} not found.")
    if amount <= 0 or amount > order["amount"]:
        raise ToolFailure("validation", f"Amount {amount} must be above 0 and at most the order amount {order['amount']}.")
    return {"refund_id": f"RF-{uuid.uuid4().hex[:6].upper()}", "order_id": order["order_id"], "amount": amount, "status": "issued"}


def escalate_to_human(customer_id: str, root_cause: str, recommended_action: str, refund_amount: float, order_ids: list) -> dict:
    """Hand the case to a human agent, who cannot see this conversation: give a complete handoff."""
    return {"ticket_id": f"HS-{uuid.uuid4().hex[:4].upper()}", "status": "queued", "customer_id": customer_id,
            "root_cause": root_cause, "recommended_action": recommended_action, "refund_amount": refund_amount, "order_ids": order_ids}


FUNCTIONS = {f.__name__: f for f in (get_customer, lookup_order, process_refund, escalate_to_human)}

TOOLS = [  # what Claude reads: a clear description and an input_schema per tool
    {"name": "get_customer", "description": get_customer.__doc__,
     "input_schema": {"type": "object", "properties": {"email": {"type": "string"}}, "required": ["email"]}},
    {"name": "lookup_order", "description": lookup_order.__doc__,
     "input_schema": {"type": "object", "properties": {"order_id": {"type": "string"}, "customer_id": {"type": "string"}},
                      "required": ["order_id", "customer_id"]}},
    {"name": "process_refund", "description": process_refund.__doc__,
     "input_schema": {"type": "object", "properties": {"order_id": {"type": "string"}, "amount": {"type": "number"}, "reason": {"type": "string"}},
                      "required": ["order_id", "amount", "reason"]}},
    {"name": "escalate_to_human", "description": escalate_to_human.__doc__,
     "input_schema": {"type": "object", "properties": {"customer_id": {"type": "string"}, "root_cause": {"type": "string"},
                                                       "recommended_action": {"type": "string"}, "refund_amount": {"type": "number"},
                                                       "order_ids": {"type": "array", "items": {"type": "string"}}},
                      "required": ["customer_id", "root_cause", "recommended_action", "refund_amount", "order_ids"]}},
]


def run_tool(name: str, args: dict) -> tuple[dict, bool]:
    """Run one tool. Returns (result, is_error)."""
    try:
        return FUNCTIONS[name](**args), False
    except ToolFailure as e:
        return e.info, True
