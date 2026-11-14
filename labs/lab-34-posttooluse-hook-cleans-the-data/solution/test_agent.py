"""Three live cases on claude-haiku-5-5. Claude's wording changes on every run; the behaviour must not. Run: uv run test_agent.py"""
import asyncio

from agent import run_agent

CASES = {
    "A": "Hi, I'm meilin@example.com. My lamp in ORD-5501 arrived cracked, photo attached. Please refund it.",
    "B": "This is arjun@example.com. The standing desk in ORD-5502 arrived with a bent frame, photos attached. Refund the full amount.",
    "C": "meilin@example.com here. Where is my monitor arm, order ORD-5504?",
}


def ran(calls, tool):
    return [c for c in calls if c["tool"] == tool and not c.get("denied") and not c["is_error"]]


def check(label, ok):
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}")
    return ok


async def main():
    results = []
    for case, message in CASES.items():
        print(f"\n===== Case {case}: {message}")
        out = await run_agent(message)
        print("Reply:", out["text"])
        calls = out["calls"]
        refunds, escalations = ran(calls, "process_refund"), ran(calls, "escalate_to_human")
        if case == "A":
            names = [c["tool"] for c in calls]
            results += [check("get_customer was called before lookup_order", "lookup_order" in names and names.index("get_customer") < names.index("lookup_order")),
                        check("the lookup_order result Claude saw has status 'delivered'", any(c["result"].get("status") == "delivered" for c in ran(calls, "lookup_order"))),
                        check("exactly one refund of 120 was issued", len(refunds) == 1 and float(refunds[0]["input"]["amount"]) == 120)]
        elif case == "B":
            denied = [c for c in calls if c.get("denied")]
            results += [check("no refund was issued", not refunds),
                        check("escalate_to_human was called with refund_amount 780", any(float(c["input"]["refund_amount"]) == 780 for c in escalations)),
                        check("every denied process_refund call was above 500", all(float(c["input"]["amount"]) > 500 for c in denied))]
        else:
            results += [check("lookup_order was called", bool(ran(calls, "lookup_order"))),
                        check("the reply says the order has shipped", "shipped" in out["text"].lower()),
                        check("no refund and no escalation", not refunds and not escalations)]
    print(f"\n{sum(results)}/{len(results)} checks passed")


asyncio.run(main())
