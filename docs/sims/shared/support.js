// Simulator 1 · Customer Support Resolution Agent: the shared backend, ported from the Python simulator.
// Fake customers and orders, real Claude. Every lab on Simulator 1 builds its agent from these tools.

export const BACKEND = {
 "policy": {
  "refund_auto_limit": 500,
  "return_window_days": 30,
  "price_match": "own-site price drops within 14 days only; competitor price matching is not covered"
 },
 "customers": {
  "C-1001": {
   "customer_id": "C-1001",
   "name": "Mei Lin Tan",
   "email": "meilin@example.com",
   "tier": "standard",
   "created_at": 1767225600,
   "status": 1
  },
  "C-1002": {
   "customer_id": "C-1002",
   "name": "Arjun Rao",
   "email": "arjun@example.com",
   "tier": "plus",
   "created_at": "2023-11-02T08:15:00Z",
   "status": "active"
  },
  "C-1003": {
   "customer_id": "C-1003",
   "name": "Sofia Alvarez",
   "email": "sofia@example.com",
   "tier": "standard",
   "created_at": 1782864000,
   "status": 2
  },
  "C-1004": {
   "customer_id": "C-1004",
   "name": "Sofia Alvarez",
   "email": "sofia.alvarez@example.org",
   "tier": "standard",
   "created_at": 1785542400,
   "status": 1
  }
 },
 "orders": {
  "ORD-5501": {
   "order_id": "ORD-5501",
   "customer_id": "C-1001",
   "amount": 120.0,
   "item": "Ceramic table lamp",
   "placed_at": 1790812800,
   "status": 3,
   "damage_photo": true,
   "charges": 1,
   "shipped": true,
   "eta": "2026-10-06"
  },
  "ORD-5502": {
   "order_id": "ORD-5502",
   "customer_id": "C-1002",
   "amount": 780.0,
   "item": "Standing desk",
   "placed_at": "2026-10-20T10:00:00Z",
   "status": "delivered",
   "damage_photo": true,
   "charges": 1,
   "shipped": true,
   "eta": "2026-10-25"
  },
  "ORD-5503": {
   "order_id": "ORD-5503",
   "customer_id": "C-1001",
   "amount": 45.0,
   "item": "Desk organiser",
   "placed_at": 1792800000,
   "status": "delivered",
   "damage_photo": false,
   "charges": 2,
   "shipped": true,
   "eta": "2026-10-28"
  },
  "ORD-5504": {
   "order_id": "ORD-5504",
   "customer_id": "C-1001",
   "amount": 60.0,
   "item": "Monitor arm",
   "placed_at": 1793318400,
   "status": 2,
   "damage_photo": false,
   "charges": 1,
   "shipped": true,
   "eta": "2026-11-09"
  },
  "ORD-5505": {
   "order_id": "ORD-5505",
   "customer_id": "C-1003",
   "amount": 95.0,
   "item": "Office chair mat",
   "placed_at": 1792800000,
   "status": "delivered",
   "damage_photo": false,
   "charges": 1,
   "shipped": true,
   "eta": "2026-10-29",
   "return_window_open": true
  },
  "ORD-5506": {
   "order_id": "ORD-5506",
   "customer_id": "C-1002",
   "amount": 30.0,
   "item": "Cable tray",
   "placed_at": 1793491200,
   "status": 1,
   "damage_photo": false,
   "charges": 1,
   "shipped": false,
   "eta": "2026-11-12"
  },
  "ORD-5507": {
   "order_id": "ORD-5507",
   "customer_id": "C-1002",
   "amount": 210.0,
   "item": "Ergonomic keyboard",
   "placed_at": 1792800000,
   "status": "delivered",
   "damage_photo": false,
   "charges": 1,
   "shipped": true,
   "eta": "2026-10-28",
   "competitor_price": 170.0
  },
  "ORD-5508": {
   "order_id": "ORD-5508",
   "customer_id": "C-1003",
   "amount": 140.0,
   "item": "Bookshelf",
   "placed_at": 1785888000,
   "status": "delivered",
   "damage_photo": false,
   "charges": 1,
   "shipped": true,
   "eta": "2026-08-10",
   "return_window_open": false
  },
  "ORD-5509": {
   "order_id": "ORD-5509",
   "customer_id": "C-1002",
   "amount": 138.0,
   "item": "Desk set (3 items)",
   "placed_at": "2026-10-26T09:30:00Z",
   "status": "delivered",
   "damage_photo": true,
   "charges": 1,
   "shipped": true,
   "eta": "2026-10-30",
   "shipping_fee": 8.0,
   "line_items": [
    {
     "sku": "LAMP-S",
     "name": "Small desk lamp",
     "price": 55.0
    },
    {
     "sku": "TRAY",
     "name": "Pen tray",
     "price": 25.0
    },
    {
     "sku": "MAT",
     "name": "Desk mat",
     "price": 50.0
    }
   ]
  }
 },
 "status_codes": {
  "1": "pending",
  "2": "shipped",
  "3": "delivered"
 },
 "flaky_orders": {
  "ORD-5504": 1
 }
};

export const SYSTEM = "You are the support resolution agent for Orderly, an online furniture store. You resolve returns, billing disputes, delivery questions and account issues on first contact whenever policy allows, and you escalate when it does not.\n\n## Tools and order of operations\n1. Verify identity with `get_customer` before any order operation. A customer who volunteers an order number is still unverified until `get_customer` returns a customer_id.\n2. Use `lookup_order` for anything about an order (status, delivery, charges, damage). Pass the verified customer_id.\n3. Before any refund, call `recommend_refund` with the structured recommendation (per-line item adjustments, shipping refund, store credit, cash total). The backend validates the business rules and either confirms it or returns the specific failures: fix them and call it again.\n4. Use `process_refund` only for the validated cash total, after `lookup_order` shows the evidence the policy requires.\n5. Use `escalate_to_human` with a complete handoff: the human cannot see this conversation.\n\nA transient tool error (isRetryable true) is worth one retry. A validation, permission or business error is not: explain it and move on. Never fabricate a result for a tool that failed.\n\n## Resolution policy\n- Damaged item with photo evidence: refund the order amount on the spot if it is within the auto-approval limit of $500.\n- Duplicate charge (charges > 1): refund the extra charges.\n- Return within the 30-day window: approve the return and tell the customer the next step.\n- Delivery status questions: answer from the order record (status, eta).\n- Multi-concern messages: break the request into distinct items, investigate each, then give one unified answer that covers all of them.\n\n## Escalation criteria\nEscalate immediately, without investigating first, when the customer explicitly asks for a human.\nEscalate when policy is silent or ambiguous for the request, for example competitor price matching (our policy only covers our own price drops), or any refund above $500.\nEscalate when `get_customer` returns several matches and the customer cannot give another identifier.\nDo not escalate standard cases just because the customer sounds upset: acknowledge the frustration, then resolve. Escalate only if they repeat the request for a human.\n\nExamples:\n- \"My lamp arrived cracked, photo attached, refund please\" with damage_photo true and amount $120: resolve, refund $120.\n- \"Refund the $780 desk, it is bent\" with photo: do not call process_refund; escalate with refund_amount 780 and the recommended action.\n- \"I want to talk to a person\": escalate at once with what you know; do not call lookup_order first.\n- \"Can you match the $170 price I saw elsewhere?\": policy is silent on competitor matching, escalate.\n- \"I am furious, where is ORD-5504?\": acknowledge, look it up, answer.\n\n## Handoff format\nWhen escalating, give the human: customer_id, root_cause (one sentence), recommended_action, refund_amount (0 if none), order_ids.\n\n## Reply format\nStart every reply with a `CASE FACTS` block listing the customer_id, order ids, amounts, statuses and dates you confirmed from tools, then the resolution in plain language. Keep it under 150 words.\n";

// The same prompt without the $500 rule (Lab 5 shows a hook enforcing what the prompt forgot).
export const SYSTEM_NOGUARD = "<!-- Same prompt with the $500 rule removed: shows what the PreToolUse hook catches when the prompt is silent. -->\nYou are the support resolution agent for Orderly, an online furniture store. You resolve returns, billing disputes, delivery questions and account issues on first contact whenever policy allows, and you escalate when it does not.\n\n## Tools and order of operations\n1. Verify identity with `get_customer` before any order operation. A customer who volunteers an order number is still unverified until `get_customer` returns a customer_id.\n2. Use `lookup_order` for anything about an order (status, delivery, charges, damage). Pass the verified customer_id.\n3. Before any refund, call `recommend_refund` with the structured recommendation (per-line item adjustments, shipping refund, store credit, cash total). The backend validates the business rules and either confirms it or returns the specific failures: fix them and call it again.\n4. Use `process_refund` only for the validated cash total, after `lookup_order` shows the evidence the policy requires.\n5. Use `escalate_to_human` with a complete handoff: the human cannot see this conversation.\n\nA transient tool error (isRetryable true) is worth one retry. A validation, permission or business error is not: explain it and move on. Never fabricate a result for a tool that failed.\n\n## Resolution policy\n- Damaged item with photo evidence: refund the order amount on the spot.\n- Duplicate charge (charges > 1): refund the extra charges.\n- Return within the 30-day window: approve the return and tell the customer the next step.\n- Delivery status questions: answer from the order record (status, eta).\n- Multi-concern messages: break the request into distinct items, investigate each, then give one unified answer that covers all of them.\n\n## Escalation criteria\nEscalate immediately, without investigating first, when the customer explicitly asks for a human.\nEscalate when policy is silent or ambiguous for the request, for example competitor price matching (our policy only covers our own price drops).\nEscalate when `get_customer` returns several matches and the customer cannot give another identifier.\nDo not escalate standard cases just because the customer sounds upset: acknowledge the frustration, then resolve. Escalate only if they repeat the request for a human.\n\nExamples:\n- \"My lamp arrived cracked, photo attached, refund please\" with damage_photo true and amount $120: resolve, refund $120.\n- \"I want to talk to a person\": escalate at once with what you know; do not call lookup_order first.\n- \"Can you match the $170 price I saw elsewhere?\": policy is silent on competitor matching, escalate.\n- \"I am furious, where is ORD-5504?\": acknowledge, look it up, answer.\n\n## Handoff format\nWhen escalating, give the human: customer_id, root_cause (one sentence), recommended_action, refund_amount (0 if none), order_ids.\n\n## Reply format\nStart every reply with a `CASE FACTS` block listing the customer_id, order ids, amounts, statuses and dates you confirmed from tools, then the resolution in plain language. Keep it under 150 words.\n";

const ok = (data) => data;
const err = (errorCategory, message, isRetryable, extra = {}) => ({ isError: true, errorCategory, isRetryable, message, ...extra });

// Fresh state for every run: refunds issued, escalations, validated recommendations, flaky-order hits.
export function newState() { return { refunds: [], escalations: [], validated: {}, flakyHits: {} }; }

export function supportTools(state) {
  const customers = BACKEND.customers, orders = BACKEND.orders;
  return {
    get_customer: {
      description: "Look up and verify a customer by email (preferred) or exact full name. Returns customer_id, name, email, tier. Call this before any order operation.",
      input_schema: { type: "object", properties: { email: { type: "string" }, name: { type: "string" } } },
      run: ({ email = "", name = "" }) => {
        email = email.trim().toLowerCase(); name = name.trim().toLowerCase();
        if (email) { const c = Object.values(customers).find((c) => c.email.toLowerCase() === email); return c ? ok(c) : err("validation", `No customer with email ${email}`, false); }
        if (name) {
          const m = Object.values(customers).filter((c) => c.name.toLowerCase() === name);
          if (m.length === 1) return ok(m[0]);
          if (m.length > 1) return err("ambiguous", `${m.length} customers named '${name}'. Ask for the email or order number.`, false, { candidates: m.map((c) => c.customer_id) });
          return err("validation", `No customer named ${name}`, false);
        }
        return err("validation", "Provide an email or a name", false);
      },
    },
    lookup_order: {
      description: "Fetch one order by its order number (format 'ORD-####'). Requires a verified customer_id from get_customer; the order must belong to that customer. Returns item, amount, status, charges, damage_photo, return_window_open.",
      input_schema: { type: "object", properties: { order_id: { type: "string" }, customer_id: { type: "string" } }, required: ["order_id"] },
      run: ({ order_id = "", customer_id = "" }) => {
        order_id = order_id.trim().toUpperCase();
        const flaky = BACKEND.flaky_orders || {};
        if (flaky[order_id] && (state.flakyHits[order_id] || 0) < flaky[order_id]) {
          state.flakyHits[order_id] = (state.flakyHits[order_id] || 0) + 1;
          return err("transient", "Order service timed out after 3000 ms", true, { attempted_query: order_id });
        }
        const o = orders[order_id];
        if (!o) return err("validation", `Order ${order_id} not found`, false);
        if (customer_id && o.customer_id !== customer_id) return err("permission", `Order ${order_id} does not belong to customer ${customer_id}`, false);
        return ok(o);
      },
    },
    recommend_refund: {
      description: "Submit a structured refund recommendation for validation before any refund: order_id, item_adjustments [{sku, amount}], shipping_refund, merchandise_credit (store credit, never cash), refund_total (cash = items + shipping), rationale. Returns validated or the business-rule failures to fix.",
      input_schema: { type: "object", properties: { order_id: { type: "string" }, item_adjustments: { type: "array", items: { type: "object", properties: { sku: { type: "string" }, amount: { type: "number" } }, required: ["sku", "amount"] } }, shipping_refund: { type: "number" }, merchandise_credit: { type: "number" }, refund_total: { type: "number" }, rationale: { type: "string" } }, required: ["order_id", "item_adjustments", "shipping_refund", "merchandise_credit", "refund_total", "rationale"] },
      run: (a) => {
        const o = orders[(a.order_id || "").toUpperCase()];
        if (!o) return err("validation", `Order ${a.order_id} not found`, false);
        const failures = [];
        const items = (a.item_adjustments || []).reduce((t, x) => t + Number(x.amount || 0), 0);
        if (Math.abs(items + Number(a.shipping_refund || 0) - Number(a.refund_total)) > 0.01) failures.push(`refund_total ${a.refund_total} must equal item_adjustments (${items}) + shipping_refund (${a.shipping_refund})`);
        if (Number(a.refund_total) > o.amount * (o.charges || 1)) failures.push(`refund_total ${a.refund_total} exceeds the ${o.amount * (o.charges || 1)} charged for ${o.order_id}`);
        if (failures.length) return err("business", "Refund recommendation failed business-rule validation", false, { failures, hint: "Correct the fields named above and call recommend_refund again." });
        state.validated[o.order_id] = Number(a.refund_total);
        return ok({ validated: true, order_id: o.order_id, cash_refund: Number(a.refund_total), message: "Recommendation validated. You may call process_refund for the cash amount." });
      },
    },
    process_refund: {
      description: "Issue a CASH refund to the original payment method. Input: order_id, amount (must equal the validated refund_total), reason. Refunds above the $500 auto-approval limit must go through escalate_to_human.",
      input_schema: { type: "object", properties: { order_id: { type: "string" }, amount: { type: "number" }, reason: { type: "string" } }, required: ["order_id", "amount", "reason"] },
      run: ({ order_id = "", amount = 0, reason = "" }) => {
        order_id = order_id.trim().toUpperCase(); const o = orders[order_id];
        if (!o) return err("validation", `Order ${order_id} not found`, false);
        const plain = !o.damage_photo && (o.charges || 1) === 1;
        if (plain && o.return_window_open === false) return err("business", `Order ${order_id} is outside the 30-day return window`, false, { customer_message: "This order was delivered more than 30 days ago, so a change-of-mind return is no longer available." });
        if (amount <= 0 || amount > o.amount * (o.charges || 1)) return err("business", `Refund ${amount} exceeds the amount charged for ${order_id}`, false);
        const r = { refund_id: `RF-${Math.floor(Math.random() * 90000) + 10000}`, order_id, amount, reason, status: "issued" };
        state.refunds.push(r); return ok(r);
      },
    },
    escalate_to_human: {
      description: "Hand the case to a human agent who CANNOT see this conversation. Use when the customer asks for a human, policy is silent or ambiguous, a refund exceeds the auto-approval limit, or you cannot make progress. Input: customer_id, root_cause, recommended_action, refund_amount (0 if none), order_ids.",
      input_schema: { type: "object", properties: { customer_id: { type: "string" }, root_cause: { type: "string" }, recommended_action: { type: "string" }, refund_amount: { type: "number" }, order_ids: { type: "string" } }, required: ["root_cause", "recommended_action"] },
      run: (a) => { const t = { ticket_id: `HS-${String(state.escalations.length + 1).padStart(4, "0")}`, handoff: a, status: "queued" }; state.escalations.push(t); return ok(t); },
    },
  };
}
