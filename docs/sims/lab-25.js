// Lab 25 · Task 5.1 · Simulator 1: a long multi-order conversation (case CS-12) where the older turns get
// compacted into a summary. Design A continues from the summary alone; design B also gets a CASE FACTS
// block that the application (not Claude) builds from every tool result and resends on every turn.
import { SYSTEM, newState, supportTools } from "./shared/support.js";

const CUSTOMER = "meilin@example.com";
const TURNS = [
  "Hi, two things. My lamp from ORD-5501 arrived cracked, photo attached, and I think I was double charged on ORD-5503. Please check both and tell me what you find before you refund anything.",
  "Thanks. Can you also tell me when ORD-5504 is arriving? And remind me how long I have to return things, I might send the organiser back too.",
  "OK. Now please process the refund for the double charge only. Not the lamp yet, I want to think about whether I keep it.",
];

// The application's own structured state: filled from tool results, never from Claude's prose.
function newFacts() { return { customer_id: null, email: null, orders: {}, refunds_issued: [] }; }
function recordFacts(facts) {
  return (name, input, out) => {
    if (!out || out.isError) return;
    if (name === "get_customer") Object.assign(facts, { customer_id: out.customer_id, email: out.email });
    if (name === "lookup_order") facts.orders[out.order_id] = { item: out.item, amount_per_charge: out.amount, charges: out.charges, status: out.status, eta: out.eta, damage_photo: out.damage_photo };
    if (name === "process_refund") facts.refunds_issued.push({ order_id: out.order_id, amount: out.amount, refund_id: out.refund_id });
  };
}
const factsBlock = (f) => `CASE FACTS (kept by the application from tool results; exact and authoritative):\n${JSON.stringify(f, null, 1)}`;
const transcript = (messages) => messages.map((m) => {
  if (typeof m.content === "string") return `${m.role.toUpperCase()}: ${m.content}`;
  const t = m.content.map((b) => b.type === "text" ? b.text : b.type === "tool_use" ? `[calls ${b.name} ${JSON.stringify(b.input)}]` : b.type === "tool_result" ? `[result ${String(b.content).slice(0, 300)}]` : "").join(" ");
  return `${m.role.toUpperCase()}: ${t}`;
}).join("\n");

export default {
  id: 25,
  see: "The app's CASE FACTS block keeps ORD-5501 $120, ORD-5503 $45 × 2 charges and ORD-5504 exact after the older turns are compacted, and with it the only refund is $45 on ORD-5503 (the lamp stays deferred).",
  explain: "Every re-summary is a lossy rewrite. Some runs keep each order id and amount; others drop the $45 or the fact that ORD-5503 was charged twice, and nothing tells the agent which happened. The application owns a CASE FACTS block filled from tool results (get_customer, lookup_order, process_refund) and puts it at the top of every turn, so exact values never pass through a summary. With it, turn 3 refunds $45 on ORD-5503 and leaves the $120 lamp on ORD-5501 alone, as the customer asked.",
  try: "In docs/sims/lab-25.js change the third customer turn to \"Refund the lamp now, keep the double charge for later\" and rerun: with the facts block the refund moves to $120 on ORD-5501, and only there.",
  slide: {
    title: "The app owns the case facts, not the summary",
    code: `facts = {"customer_id": None, "orders": {}}     # KEY 1
def post_tool_use(name, result):
    if name == "lookup_order":                  # KEY 2
        facts["orders"][result["order_id"]] = {
            "amount": result["amount"],
            "charges": result["charges"]}
history = summarise(old_turns)                  # lossy
prompt = ("CASE FACTS:\\n" + json.dumps(facts) # KEY 3
          + "\\nSummary: " + history
          + "\\nCustomer: " + new_message)
run_agent(SYSTEM, prompt, tools)                # KEY 4`,
    keys: [["1", "Structured state you own", "Order ids, amounts, refunds: outside the transcript."],
           ["2", "Fill it from tool results", "Exact values come from the backend, not prose."],
           ["3", "Resend it every turn", "The summary may drop amounts; the block cannot."],
           ["4", "Same agent, same tools", "Only the context it reads has changed."]],
  },
  async run(s, E) {
    const facts = newFacts();
    const shared = newState();
    s.log(`Case CS-12 · ${CUSTOMER} · three customer turns about ORD-5501, ORD-5503 and ORD-5504`, "note");

    // Turns 1-2: the whole history still fits, so the conversation runs normally.
    s.log("== Turns 1-2: full history; the app records every tool result into its CASE FACTS store", "note");
    let messages = [];
    const turnStart = [];
    for (const [i, msg] of TURNS.slice(0, 2).entries()) {
      s.log(`Customer turn ${i + 1}: "${msg}"`, "note");
      turnStart.push(messages.length);
      messages.push({ role: "user", content: i === 0 ? `Incoming support message (email: ${CUSTOMER}):\n\n${msg}` : `Customer replies:\n\n${msg}` });
      const r = await E.runAgent(s, { system: SYSTEM, messages, tools: supportTools(shared), postToolUse: recordFacts(facts), maxTurns: 7 });
      messages = r.messages;
    }
    const refundsEarly = shared.refunds.length;

    // Rolling compaction (MCQ option A): after each turn the history is summarised again and the new
    // summary REPLACES the previous one, so turn-1 details pass through two lossy summaries.
    s.log("== The conversation grows, so it is re-summarised after every turn; each summary replaces the last", "note");
    const compact = async (prior, part) => {
      const r = await E.callClaude(s, {
        max_tokens: 1500,                 // room for adaptive thinking before the 20-word summary
        system: "You compact long support conversations so the agent can continue in a smaller context.",
        messages: [{ role: "user", content: `${prior ? `Summary so far: ${prior}\n\nNew exchange:\n` : ""}${transcript(part)}\n\nWrite the updated summary of the whole conversation in at most 20 words.` }],
      });
      return E.textOf(r.content).trim();
    };
    const s1 = await compact("", messages.slice(0, turnStart[1]));
    s.log(`Summary after turn 1: ${s1}`, "reply");
    const summary = await compact(s1, messages.slice(turnStart[1]));
    s.log(`Summary after turn 2 (replaces the first): ${summary}`, "reply");
    const exact = ["ORD-5501", "120", "ORD-5503", "45", "ORD-5504"];
    const lost = exact.filter((v) => !summary.includes(v));
    if (!/double|duplicate|twice|2 charges|charged 2/i.test(summary)) lost.push("ORD-5503 charged twice");
    s.log(`Exact values the latest summary kept: ${exact.filter((v) => !lost.includes(v)).join(", ") || "none"} · dropped: ${lost.join(", ") || "none"}`, "note");
    s.log(factsBlock(facts), "note");

    // Design A: continue from the summary alone.
    s.log("== Design A (the trap): turn 3 continues from the latest summary alone", "note");
    s.log(`Customer turn 3: "${TURNS[2]}"`, "note");
    const stA = newState();
    const a = await E.runAgent(s, {
      system: SYSTEM, tools: supportTools(stA), maxTurns: 8,
      messages: [{ role: "user", content: `Earlier conversation (summarised): ${summary}\n\nCustomer replies:\n\n${TURNS[2]}` }],
    });
    s.log(`Design A refunds: ${stA.refunds.map((r) => `$${r.amount} on ${r.order_id}`).join(", ") || "none"} · lookup_order calls in turn 3: ${E.called(a.calls, "lookup_order").length}. ` +
      (lost.length ? `The summary had dropped ${lost.join(", ")}, so whatever design A got right came from re-querying, not from its context.`
                   : "This time the summary happened to keep every value: design A is only as safe as the next summary."), "note");

    // Design B: the same summary, plus the CASE FACTS block the app resends on every turn.
    s.log("== Design B (the fix): turn 3 with the same summary plus the app's CASE FACTS block", "note");
    const stB = newState();
    const b = await E.runAgent(s, {
      system: SYSTEM, tools: supportTools(stB), postToolUse: recordFacts(facts), maxTurns: 8,
      messages: [{ role: "user", content: `${factsBlock(facts)}\n\nEarlier conversation (summarised): ${summary}\n\nCustomer replies:\n\n${TURNS[2]}` }],
    });
    s.log(`Design B refunds: ${stB.refunds.map((r) => `$${r.amount} on ${r.order_id}`).join(", ") || "none"} · lookup_order calls in turn 3: ${E.called(b.calls, "lookup_order").length}`, "note");

    const o = facts.orders;
    return {
      final: b.text,
      checks: [
        E.check("Turns 1-2 issued no refund: the customer asked to check first", refundsEarly === 0),
        E.check("The app's CASE FACTS hold exact values for ORD-5501 ($120), ORD-5503 ($45 × 2) and ORD-5504", o["ORD-5501"]?.amount_per_charge === 120 && o["ORD-5503"]?.amount_per_charge === 45 && o["ORD-5503"]?.charges === 2 && !!o["ORD-5504"]),
        E.check("Design B's only refund is $45 on ORD-5503", stB.refunds.length === 1 && stB.refunds[0].order_id === "ORD-5503" && Number(stB.refunds[0].amount) === 45),
        E.check("Design B left the lamp (ORD-5501) unrefunded, as the customer asked", !stB.refunds.some((r) => r.order_id === "ORD-5501")),
      ],
    };
  },
};
