// Lab 4 · Task 1.4 · Simulator 1 (Case CS-03): a code gate, not a sentence, puts get_customer first.
// The customer volunteers an order number. Phase 1 runs with no gate: nothing in code stops lookup_order
// running on a stated name. Phase 2 runs the SAME prompt with a PreToolUse prerequisite gate: lookup_order
// and process_refund are denied until get_customer has returned a verified customer_id.
import { newState, supportTools, BACKEND } from "./shared/support.js";

// One lean prompt for both phases. Production prompts say "verify first", and 12% of cases still skip it.
// To make that skip visible in one run, this prompt (and the tool descriptions) leave the rule out;
// the only difference between the two phases is the gate.
const LEAN = "You are the support agent for Orderly, an online furniture store. Answer the customer's question with the tools, then reply in under 80 words. A transient tool error (isRetryable true) is worth one retry.";

function tools(state) {
  const t = supportTools(state);
  return {
    get_customer: { ...t.get_customer, description: "Look up a customer by email or exact full name. Returns customer_id, name, email, tier." },
    lookup_order: { ...t.lookup_order, description: "Fetch one order by its order number (format 'ORD-####'). Optional customer_id. Returns item, amount, status, eta." },
  };
}

// PostToolUse: normalise raw backend values (epoch seconds, numeric status codes) before Claude sees them.
function normalise(name, input, out) {
  if (!out || typeof out !== "object" || out.isError) return undefined;
  const o = { ...out };
  for (const k of ["created_at", "placed_at"]) if (typeof o[k] === "number") o[k] = new Date(o[k] * 1000).toISOString().replace(".000", "");
  if (name === "lookup_order" && typeof o.status === "number") o.status = BACKEND.status_codes[String(o.status)] || String(o.status);
  return o;
}

async function phase(s, E, gateOn) {
  const state = newState();
  state.flakyHits["ORD-5504"] = 9;              // no transient timeout in this lab: keep the focus on the gate
  const verified = { id: null };                 // set only when get_customer really returns a customer_id
  const gateLog = [];
  const run = await E.runAgent(s, {
    system: LEAN,
    prompt: "Incoming support message (email: meilin@example.com):\n\nCheck my order ORD-5504, where is it? This is Mei Lin.",
    tools: tools(state),
    maxTurns: 6,
    preToolUse: gateOn ? (name, input) => {
      if ((name === "lookup_order" || name === "process_refund") && (!verified.id || input.customer_id !== verified.id)) {
        gateLog.push({ name, decision: "deny" });
        return { deny: verified.id ? `Pass the verified customer_id (${verified.id}) with this call.` : "Prerequisite not met: call get_customer and obtain a verified customer_id before any order operation." };
      }
      gateLog.push({ name, decision: "allow" });
      return null;
    } : null,
    postToolUse: (name, input, out) => {
      if (name === "get_customer" && out && !out.isError && out.customer_id) verified.id = out.customer_id;
      return normalise(name, input, out);
    },
  });
  // Did any order lookup run without the verified customer_id? (It ran = not blocked by the gate.)
  const unverified = run.calls.filter((c, i) => c.name === "lookup_order" && !c.denied &&
    !run.calls.slice(0, i).some((g) => g.name === "get_customer" && !g.isError && g.result.customer_id && g.result.customer_id === c.input.customer_id));
  const firstOk = run.calls.findIndex((c) => c.name === "lookup_order" && !c.denied && !c.isError);
  const firstCust = run.calls.findIndex((c) => c.name === "get_customer" && !c.isError);
  return { run, gateLog, unverified, firstOk, firstCust };
}

export default {
  id: 4,
  see: "Phase 1 (no gate): lookup_order runs on the order number Mei Lin volunteered, with no verified customer_id. Phase 2 (same prompt, gate on): the PreToolUse hook blocks that first lookup_order, Claude calls get_customer, and only then does lookup_order run with customer_id C-1001 and answer: shipped, due 2026-11-09.",
  try: "Edit LEAN in this lab's code to add \"Always call get_customer first.\" and run it several times: phase 1 now usually verifies first, but only the gate makes it certain. Then add process_refund to the tools and ask for a refund before verifying: the same gate blocks it.",
  explain: "Both phases run the same lean prompt; the only difference is a PreToolUse prerequisite gate. Without it, Claude acts on the order number the customer volunteered and lookup_order runs on a stated name, which is the 12% failure in production. With it, code checks for a verified customer_id on every lookup_order and process_refund call and denies the call until get_customer has returned one. Claude reads the denial, verifies, and retries. Stronger prompt wording and few-shot examples only make the right order more likely; the gate makes it certain.",
  slide: {
    title: "A gate in code puts get_customer first, every time",
    code: `verified = None
def pre_tool_use(name, args):                   # KEY 1
    order_call = name in ("lookup_order", "process_refund")
    if order_call and (verified is None or
            args.customer_id != verified):      # KEY 2
        return deny("Call get_customer first, then "
                    "pass its customer_id")     # KEY 3
    return allow()

def post_tool_use(name, result):
    global verified
    if name == "get_customer" and result.customer_id:
        verified = result.customer_id           # KEY 4
    return normalise(result)`,
    keys: [["1", "Runs before every call", "The hook sees each tool call before it executes."],
           ["2", "Checks state, not wording", "No verified id on the call: the order call is blocked."],
           ["3", "Denial tells Claude why", "Claude reads the reason, verifies, then retries."],
           ["4", "Only a real result unlocks", "The id comes from get_customer, not the message."]],
  },
  async run(s, E) {
    s.log("Case CS-03 · meilin@example.com: \"Check my order ORD-5504, where is it? This is Mei Lin.\"", "note");
    s.log("== Phase 1 · prompt only, no gate: nothing in code checks the order of tool calls", "note");
    const p1 = await phase(s, E, false);
    s.log(p1.unverified.length ? `Phase 1 result: lookup_order ran ${p1.unverified.length} time(s) without a verified customer_id, on the order number alone. Nothing in code stopped it.` : "Phase 1 result: this time every lookup_order carried a verified customer_id. Nothing guaranteed it.", "note");

    s.log("== Phase 2 · same prompt, PreToolUse prerequisite gate on lookup_order and process_refund", "note");
    const p2 = await phase(s, E, true);
    const denied = p2.run.calls.filter((c) => c.denied);
    const reply = p2.run.text;

    return {
      final: reply,
      checks: [
        E.check("Phase 1 (no gate): lookup_order ran without a verified customer_id", p1.unverified.length >= 1),
        E.check("Phase 2: the PreToolUse gate denied lookup_order until it carried a verified customer_id", denied.length >= 1 && denied.every((c) => c.name === "lookup_order" || c.name === "process_refund")),
        E.check("Phase 2: get_customer returned C-1001 before the first lookup_order that ran", p2.firstCust > -1 && p2.firstOk > p2.firstCust && p2.run.calls[p2.firstCust].result.customer_id === "C-1001" && p2.unverified.length === 0),
        E.check("Phase 2: the reply gives ORD-5504 as shipped with eta 2026-11-09", /shipped/i.test(reply) && /(2026-11-09|9 Nov|Nov(ember)? 9)/i.test(reply)),
      ],
    };
  },
};
