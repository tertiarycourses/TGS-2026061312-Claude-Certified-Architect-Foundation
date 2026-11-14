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
  // The scenario board (assets/scene.js): case CS-03, the same lean prompt with and without the prerequisite gate.
  scene: {
    title: "Case CS-03: Mei Lin names ORD-5504. Is she verified before the lookup?",
    caption: "Both phases send the same message with the same lean prompt and tools. Only the PreToolUse gate differs.",
    lanes: [
      { key: "p1", label: "Phase 1 · prompt only", sub: "nothing in code checks the call order", tone: "trap", on: /Phase 1/, stages: [
        { id: "a_msg", icon: "👤", t: "\"Check my order ORD-5504\"", s: "a stated name and order number, unverified" },
        { id: "a_agent", icon: "🤖", t: "Support agent", s: "lean prompt: no verify-first rule", claude: true },
        { id: "a_gate", icon: "🚧", t: "PreToolUse gate", s: "none: every call goes straight through", diff: true },
        { id: "a_be", icon: "🗄", t: "Backend", s: "get_customer, lookup_order", tools: ["get_customer", "lookup_order"] },
        { id: "a_out", icon: "📦", t: "ORD-5504 answered", s: "want: C-1001 verified first, then shipped", out: true } ] },
      { key: "p2", label: "Phase 2 · same prompt + gate", sub: "lookup_order needs a verified customer_id", tone: "fix", on: /Phase 2/, stages: [
        { id: "b_msg", icon: "👤", t: "\"Check my order ORD-5504\"", s: "the same message, the same prompt" },
        { id: "b_agent", icon: "🤖", t: "Support agent", s: "lean prompt: no verify-first rule", claude: true },
        { id: "b_gate", icon: "🚧", t: "PreToolUse gate", s: "deny lookup_order until get_customer ran", diff: true },
        { id: "b_be", icon: "🗄", t: "Backend", s: "get_customer, lookup_order", tools: ["get_customer", "lookup_order"] },
        { id: "b_out", icon: "📦", t: "ORD-5504 answered", s: "want: C-1001 verified first, then shipped", out: true } ] },
    ],
  },
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
           ["4", "Only a real result opens it", "The id comes from get_customer, not the message."]],
  },
  async run(s, E) {
    s.log("Case CS-03 · meilin@example.com: \"Check my order ORD-5504, where is it? This is Mei Lin.\"", "note");
    s.log("== Phase 1 · prompt only, no gate: nothing in code checks the order of tool calls", "note");
    s.show("a_msg", "Mei Lin, ORD-5504", "done");
    const p1 = await phase(s, E, false);
    s.log(p1.unverified.length ? `Phase 1 result: lookup_order ran ${p1.unverified.length} time(s) without a verified customer_id, on the order number alone. Nothing in code stopped it.` : "Phase 1 result: this time every lookup_order carried a verified customer_id. Nothing guaranteed it.", "note");
    // What each phase really did: the call sequence, the gate's denials, unverified lookups, the answer.
    // Calls grouped by turn ("+" = asked for in the same turn); ⚠ marks a lookup_order that ran without a verified id.
    const seq = (p) => Object.values(p.run.calls.reduce((g, c) => ((g[c.turn] ||= []).push(`${c.name}${c.denied ? " ⛔" : c.isError ? " ✘" : p.unverified.includes(c) ? " ⚠" : ""}`), g), {}))
      .map((x) => x.join(" + ")).join(" → ") || "no tool calls";
    const answered = (p) => /shipped/i.test(p.run.text) && /(2026-11-09|9 Nov|Nov(ember)? 9)/i.test(p.run.text);
    const verifiedFirst = (p) => p.firstCust > -1 && p.firstOk > p.firstCust && p.unverified.length === 0;
    const board = (x, p, gateOn) => {
      const denied = p.run.calls.filter((c) => c.denied).length;
      s.show(`${x}_gate`, gateOn ? (denied ? `⛔ denied ${denied} call${denied === 1 ? "" : "s"} until C-1001 verified` : "allowed every call: verified first") : "no gate: nothing checked", gateOn ? "done" : null);
      s.show(`${x}_be`, E.short(seq(p), 60), "done");
      s.show(`${x}_out`, p.unverified.length ? `lookup_order ran ${p.unverified.length}× unverified` : answered(p) ? "verified C-1001, then shipped 2026-11-09" : "verified, but no shipped/eta answer",
        verifiedFirst(p) && answered(p) ? "good" : "bad");
    };
    board("a", p1, false);
    await s.pause({
      title: "Phase 1 finished: the prompt alone, no gate",
      outcome: (p1.unverified.length ? `**lookup_order ran ${p1.unverified.length} time${p1.unverified.length === 1 ? "" : "s"} with no verified customer_id**, on the order number Mei Lin volunteered. Nothing in code stopped it.`
        : "This time Claude **called get_customer first**, but nothing in code made it: that is the 88% of cases, not a guarantee.") + ` Calls: ${seq(p1)}.`,
      next: "Phase 2: the same prompt with a PreToolUse prerequisite gate",
    });

    s.log("== Phase 2 · same prompt, PreToolUse prerequisite gate on lookup_order and process_refund", "note");
    s.show("b_msg", "Mei Lin, ORD-5504", "done");
    const p2 = await phase(s, E, true);
    const denied = p2.run.calls.filter((c) => c.denied);
    const reply = p2.run.text;
    board("b", p2, true);

    return {
      final: reply,
      compare: {
        cols: [
          { title: "Phase 1: prompt only, no gate", short: "No gate", tone: "trap", said: p1.run.text,
            verdict: p1.unverified.length
              ? `lookup_order ran **${p1.unverified.length}× on the stated name and order number alone**: the 12% failure, and nothing in code noticed.`
              : "Verified first this time, but only because Claude chose to: no code would have stopped an unverified lookup." },
          { title: "Phase 2: same prompt + PreToolUse gate", short: "With the gate", tone: "fix", said: reply,
            verdict: verifiedFirst(p2) && answered(p2)
              ? `${denied.length ? `The gate denied ${denied.length} premature call${denied.length === 1 ? "" : "s"}; ` : "Claude verified first, so the gate had nothing to deny; "}get_customer returned C-1001 before the lookup ran, and the reply gives shipped, eta 2026-11-09.`
              : `Calls: ${seq(p2)}. Read the live output: Claude writes each run fresh.` },
        ],
        rows: [
          ["PreToolUse gate on lookup_order", "none", { v: "deny until a verified customer_id", tone: "good" }],
          ["Tool calls, turn by turn (⛔ denied, ⚠ no verified id)", seq(p1), seq(p2)],
          ["Calls the gate denied", "0 (no gate)", String(denied.length)],
          ["lookup_order run without a verified id", { v: String(p1.unverified.length), tone: p1.unverified.length ? "bad" : "good" }, { v: String(p2.unverified.length), tone: p2.unverified.length ? "bad" : "good" }],
          ["Answer: ORD-5504 shipped, eta 2026-11-09", { v: answered(p1) ? "yes" : "no", tone: answered(p1) ? "good" : "bad" }, { v: answered(p2) ? "yes" : "no", tone: answered(p2) ? "good" : "bad" }],
        ],
        note: "Same message, same lean prompt, same tools. The only difference is code that runs before every tool call: a sentence in the prompt makes verification likely, the gate makes it certain.",
      },
      checks: [
        E.check("Phase 1 (no gate): lookup_order ran without a verified customer_id", p1.unverified.length >= 1),
        E.check("Phase 2: the PreToolUse gate denied lookup_order until it carried a verified customer_id", denied.length >= 1 && denied.every((c) => c.name === "lookup_order" || c.name === "process_refund")),
        E.check("Phase 2: get_customer returned C-1001 before the first lookup_order that ran", p2.firstCust > -1 && p2.firstOk > p2.firstCust && p2.run.calls[p2.firstCust].result.customer_id === "C-1001" && p2.unverified.length === 0),
        E.check("Phase 2: the reply gives ORD-5504 as shipped with eta 2026-11-09", /shipped/i.test(reply) && /(2026-11-09|9 Nov|Nov(ember)? 9)/i.test(reply)),
      ],
    };
  },
};
