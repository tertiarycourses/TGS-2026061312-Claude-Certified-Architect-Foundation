"""Check the four tools on their own, no Claude call: uv run check_tools.py"""
import json

from tools import run_tool

for name, args in [("get_customer", {"email": "meilin@example.com"}),
                   ("lookup_order", {"order_id": "ORD-5502", "customer_id": "C-1001"})]:
    result, is_error = run_tool(name, args)
    print(f"{name}({json.dumps(args)}) is_error={is_error} -> {json.dumps(result)}")
